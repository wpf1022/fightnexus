/* =============================================================
 * FightNexus · match.js
 * 对局 / Round / 命中结算 / 飞行道具 / 输入流与快照（高光重演基础）
 * 对应 PRD §8.5 §8.8 §8.10 §10.2 §FR11
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var C = FN.CFG, U = FN.U, B = FN.Input;

  function newStats() {
    return {
      hits: 0, taken: 0, blocks: 0, punish: 0, techs: 0, throws: 0,
      specials: 0, specialTries: 0, supers: 0, maxCombo: 0, damage: 0,
      antiair: 0, okizeme: 0, whiffs: 0
    };
  }

  function Match(opts) {
    opts = opts || {};
    this.mode = opts.mode || 'ai';                 // ai | local | training | ftue | replay
    this.chars = opts.chars || ['kael', 'kael'];
    this.schemes = opts.schemes || ['modern', 'modern'];
    this.providers = opts.providers || [new B.NullProvider(), new B.NullProvider()];
    this.aiProfile = opts.aiProfile || 'standard';
    this.training = opts.training || null;
    this.ftue = opts.ftue || null;
    this.version = opts.version || '1.0.0';

    this.fighters = [
      new FN.Fighter(this.chars[0], 0, this.schemes[0]),
      new FN.Fighter(this.chars[1], 1, this.schemes[1])
    ];
    this.stats = [newStats(), newStats()];
    this.events = [];
    this.projectiles = [];
    this.inputLog = [];
    this.inputLogStart = 0;      // inputLog[0] 对应的全局帧号（滚动缓冲对齐用）
    this.snapshots = {};
    this.frame = 0;
    this.round = 1;
    this.wins = [0, 0];
    this.timer = C.ROUND_TIME * C.FPS;
    this.phase = 'intro';        // intro | fight | roundend | matchend
    this.phaseTimer = C.ROUND_INTRO;
    this.hitstop = 0;
    this.slowmo = { scale: 1, frames: 0 };
    this.comboHold = [0, 0];
    this.roundDamage = [0, 0];
    this.matchDamage = [0, 0];
    this.highlights = [];
    this.result = null;
    this.lastHitFrame = -999;
    this.bestMoment = { frame: 0, score: 0 };
    this.roundLog = [];
    this.resetRound(true);
  }

  Match.prototype.resetRound = function (full) {
    var f = this.fighters;
    var gap = 250;
    var mid = C.STAGE_W / 2;
    f[0].reset(mid - gap, 1);
    f[1].reset(mid + gap, -1);
    f[0].hp = f[0].char.hp; f[1].hp = f[1].char.hp;
    f[0].hpShown = f[0].hp; f[1].hpShown = f[1].hp;
    f[0].hpLinger = 0; f[1].hpLinger = 0;
    if (full) { f[0].meter = 0; f[1].meter = 0; }
    this.projectiles.length = 0;
    this.timer = C.ROUND_TIME * C.FPS;
    this.phase = 'intro';
    this.phaseTimer = C.ROUND_INTRO;
    this.roundDamage = [0, 0];
    this.comboHold = [0, 0];
    if (this.training) {
      f[0].meter = C.METER_MAX;
      if (this.training.infMeter) f[1].meter = C.METER_MAX;
    }
    this.events.push({ t: 'round', round: this.round });
  };

  /* ---------- 快照（Rollback / 高光重演）---------- */
  Match.prototype.snapshot = function () {
    return {
      f: this.frame, p: this.phase, pt: this.phaseTimer, t: this.timer,
      w: this.wins.slice(), r: this.round,
      a: [this.fighters[0].serialize(), this.fighters[1].serialize()],
      pr: this.projectiles.map(function (p) { return { o: p.owner, x: p.x, y: p.y, vx: p.vx, life: p.life, k: p.key, mh: p.moveHits }; })
    };
  };
  Match.prototype.restore = function (s) {
    var self = this;
    this.frame = s.f; this.phase = s.p; this.phaseTimer = s.pt; this.timer = s.t;
    this.wins = s.w.slice(); this.round = s.r;
    this.fighters[0].deserialize(s.a[0]);
    this.fighters[1].deserialize(s.a[1]);
    /* 依据帧表重建弹幕的 mv/w/h —— 快照里只存标量（§10.2 可序列化状态） */
    this.projectiles = (s.pr || []).map(function (p) {
      var owner = self.fighters[p.o];
      var mv = p.k ? owner.frames[p.k] : null;
      var proj = mv && mv.projectile;
      return {
        owner: p.o, key: p.k, mv: proj ? mv : null,
        x: p.x, y: proj ? proj.y : p.y, vx: p.vx, life: p.life,
        w: proj ? proj.w : 40, h: proj ? proj.h : 30, moveHits: p.mh || 0
      };
    });
    this.hitstop = 0; this.comboHold = [0, 0];
    this.inputLog = []; this.inputLogStart = this.frame;
  };

  Match.prototype.addStat = function (idx, key, delta) {
    var s = this.stats[idx];
    if (s[key] == null) s[key] = 0;
    s[key] += delta || 1;
  };

  /* ---------- 主步进（纯函数式：step(inputs)）---------- */
  Match.prototype.step = function () {
    var f = this.fighters, i;
    this.events.length = 0;

    /* 输入流滚动缓冲：超长对局（>32s）也要能对齐帧号重演 */
    this.inputLog.push([this.providers[0] ? this.providers[0].next(this.frame, this) : 0,
    this.providers[1] ? this.providers[1].next(this.frame, this) : 0]);
    if (this.inputLog.length > C.REPLAY_BUFFER * 3) { this.inputLog.shift(); this.inputLogStart++; }
    var inputs = this.inputLog[this.inputLog.length - 1] || [0, 0];
    if (this.frame % C.REPLAY_KEYFRAME === 0) {
      this.snapshots[this.frame] = this.snapshot();
      var keys = Object.keys(this.snapshots);
      if (keys.length > 40) delete this.snapshots[keys[0]];
    }
    this.frame++;

    if (this.hitstop > 0) { this.hitstop--; return; }

    if (this.phase === 'intro') {
      this.phaseTimer--;
      if (this.phaseTimer <= 0) {
        this.phase = 'fight';
        this.events.push({ t: 'fight' });
        if (this.ftue) this.ftueOnFight();
      }
      // intro 期间只做朝向，不接受输入
      f[0].facing = 1; f[1].facing = -1;
      return;
    }

    if (this.phase === 'roundend') {
      this.phaseTimer--;
      for (i = 0; i < 2; i++) f[i].step(0, this.frame, this);
      if (this.phaseTimer <= 0) this.advanceRound();
      return;
    }
    if (this.phase === 'matchend') return;

    /* ---- 战斗帧 ---- */
    for (i = 0; i < 2; i++) {
      var mask = i === 0 ? inputs[0] : inputs[1];
      if (this.ftue && i === 1) mask = 0;         // FTUE 期间 AI 攻击欲望为 0
      if (this.training && this.training.aiMode === 'stand' && i === 1) mask = 0;
      f[i].step(mask, this.frame, this);
    }

    this.resolveHits();
    this.updateProjectiles();
    this.separate();
    this.postFrame();

    if (this.ftue) this.ftueTick();
    if (this.training) this.trainingTick();
  };

  /* ---------- 命中结算（§8.5 判定优先级）---------- */
  Match.prototype.resolveHits = function () {
    var f = this.fighters, i, hits = [];
    for (i = 0; i < 2; i++) {
      var a = f[i], d = f[1 - i];
      if (!a.isActive()) continue;
      var boxes = a.hitboxes();
      if (!boxes) continue;
      var mv = a.move;
      var canMulti = mv.multiHit && a.moveHits < mv.multiHit.count;
      if (mv.multiHit && !canMulti) continue;
      if (mv.multiHit) {
        var rel = a.mf - mv.startup;
        if (rel <= 0 || (rel % mv.multiHit.interval) !== 1) continue;
      }
      if (a.hitTargets[d.idx] && !mv.multiHit) continue;
      var hb = d.hurtbox();
      for (var b = 0; b < boxes.length; b++) {
        if (overlap(boxes[b], hb)) { hits.push({ a: a, d: d, box: boxes[b] }); break; }
      }
    }
    if (hits.length === 2) {
      // 双方同时命中（trade）：各 50% 伤害缩放
      this.applyHit(hits[0].a, hits[0].d, hits[0].a.move, { trade: true, box: hits[0].box });
      this.applyHit(hits[1].a, hits[1].d, hits[1].a.move, { trade: true, box: hits[1].box });
    } else if (hits.length === 1) {
      this.applyHit(hits[0].a, hits[0].d, hits[0].a.move, { box: hits[0].box });
    }
  };

  function overlap(a, b) {
    return a.x0 < b.x0 + b.w && a.x0 + a.w > b.x0 && a.y0 < b.y0 + b.h && a.y0 + a.h > b.y0;
  }

  Match.prototype.applyHit = function (a, d, mv, opt) {
    opt = opt || {};
    var Cg = C, box = opt.box || { x0: d.x, y0: 60, w: 10, h: 10 };
    var hx = box.x0 + box.w / 2, hy = box.y0 + box.h / 2;

    /* 1 无敌 > 一切（§8.5 #1） */
    if (d.isInvulnerable()) {
      a.hitTargets[d.idx] = true;
      this.events.push({ t: 'whiff', p: a.idx, x: hx, y: hy, invuln: true });
      return;
    }
    /* 2 霸体吸收 */
    if (d.hasArmor()) {
      d.armorHits++;
      var ad = Math.round(mv.damage * 0.25 * d.char.defense);
      d.hp = Math.max(0, d.hp - ad); d.hpLinger = 30;
      a.hitTargets[d.idx] = true; a.moveHasHit = true;
      this.addStat(a.idx, 'hits', 1);
      this.events.push({ t: 'armor', p: d.idx, x: d.x, y: d.y + 110, dmg: ad });
      /* 霸体吸收致死也要结算（残血吃霸体削减的边界情况） */
      if (d.hp <= 0) this.checkKO();
      return;
    }
    /* 3 投技（优先于攻击与防御，§8.5 #2 #3） */
    var isGrab = mv.hit_level === 'throw';
    if (isGrab) {
      if (d.airborne || d.y > 0) { a.hitTargets[d.idx] = true; return; }
      // 拆投窗口（BT-7）
      if (d.consume(B.THROW) || d.peek(B.THROW)) {
        this.addStat(d.idx, 'techs', 1);
        a.pushVel = -a.facing * 6; d.pushVel = d.facing * 6;
        a.hitTargets[d.idx] = true; a.moveHasHit = true;
        this.events.push({ t: 'tech', p: d.idx, x: d.x, y: d.y + 90 });
        if (this.training) this.trainingHit('tech', d.idx);
        return;
      }
      var dmgT = Math.round(mv.damage * d.char.defense * (a.ex ? 1.2 : 1));
      d.hp = Math.max(0, d.hp - dmgT); d.hpLinger = 30;
      this.registerDamage(a, d, dmgT, true);
      a.moveHasHit = true; a.hitTargets[d.idx] = true; a.moveHits++;
      d.state = 'thrown'; d.stun = mv.hitstun; d.stunType = 'thrown';
      d.comboCount = 0; a.comboCount = 0;
      this.hitstop = C.HITSTOP.special;
      this.addStat(a.idx, 'throws', 1);
      this.events.push({ t: 'hit', p: a.idx, v: d.idx, x: d.x, y: d.y + 110, dmg: dmgT, type: 'throw', combo: 1, grab: true });
      this.checkKO();
      return;
    }

    /* 4 防御判定 */
    var blocked = false;
    if (d.blocking && !d.airborne) {
      var lvl = mv.hit_level;
      if (lvl === 'mid') blocked = true;
      else if (lvl === 'high' && d.blockType === 'stand') blocked = true;
      else if (lvl === 'low' && d.blockType === 'crouch') blocked = true;
    }

    var n = a.comboCount + 1;
    var scale = FN.scaleFor(n);
    if (scale <= 0) {                          // > 12 段：强制断连
      scale = C.SCALING_FLOOR; a.comboCount = 0; n = 1;
      d.comboCount = 0; this.forceBreak(d);
    }
    if (a.autoFlag) scale *= C.AUTOC_EXTRA;
    if (opt.trade) scale *= C.TRADE_SCALE;
    var base = (mv.multiHit ? mv.multiHit.damage : mv.damage) * (a.ex ? 1.5 : 1);
    var dmg = Math.round(base * Math.max(scale, C.SCALING_FLOOR) * d.char.defense * (d.crushTimer > 0 ? 1 + C.GUARD_CRUSH_BONUS : 1));

    /* 4a 被防御 */
    if (blocked) {
      a.moveHasHit = true; a.hitTargets[d.idx] = true; a.moveHits++;
      d.stunBlockType = d.blockType;           // 防御姿态带入 blockstun（防击穿）
      d.state = 'blockstun'; d.stun = mv.blockstun; d.stunType = 'block';
      d.guardLock = 30;
      d.guard -= (C.GUARD_DRAIN[mv.key === 'super' ? 'super' : (mv.key === 'special' ? 'special' : (mv.damage > 60 ? 'heavy' : 'light'))] || 4);
      if (mv.key === 'special' || mv.key === 'super') {
        var chip = Math.round(dmg * C.CHIP);
        d.hp = Math.max(0, d.hp - chip); d.hpLinger = 30;
        this.registerDamage(a, d, chip, false);
      }
      d.gainMeter(C.METER_GAIN.block); a.gainMeter(15);
      d.pushVel = a.facing * mv.pushback * 0.22;
      a.pushVel = -a.facing * mv.pushback * 0.08;
      this.addStat(d.idx, 'blocks', 1);
      this.hitstop = Math.max(this.hitstop, 3);
      this.events.push({ t: 'block', p: d.idx, x: hx, y: hy, dmg: 0 });
      if (d.guard <= 0) { d.guard = 0; }
      /* 削伤致死同样要结算 KO，否则 HP=0 后对局悬死到时间归零 */
      if (d.hp <= 0) this.checkKO();
      return;
    }

    /* 4b 命中 */
    var hitstun = mv.hitstun;
    if (n >= C.HITSTUN_DECAY_FROM) hitstun = Math.round(hitstun * (1 - C.HITSTUN_DECAY * (n - 2)));
    hitstun = Math.max(8, hitstun);

    d.hp = Math.max(0, d.hp - dmg); d.hpLinger = 30;
    d.hurtFlash = 4;
    this.registerDamage(a, d, dmg, false);
    a.moveHasHit = true; a.hitTargets[d.idx] = true; a.moveHits++;
    a.comboCount = n; this.comboHold[a.idx] = 46;
    d.comboCount = n;
    a.gainMeter(C.METER_GAIN.hit); d.gainMeter(C.METER_GAIN.taken);

    var eff = mv.multiHit ? mv.multiHit.effect : mv.hit_effect;
    if (eff === 'launch') {
      d.state = 'hitstun'; d.stun = hitstun; d.stunType = 'air';
      d.airborne = true; d.y = Math.max(d.y, 0.01);
      d.vy = 9.5 * (1 + C.LAUNCH_GROWTH * Math.max(0, n - 1));
      d.vx = a.facing * (2.2 * (1 + C.LAUNCH_GROWTH * Math.max(0, n - 1)));
    } else if (eff === 'knockdown' || eff === 'crumple') {
      d.state = 'hitstun'; d.stun = Math.min(hitstun, 20); d.stunType = 'down';
      d.vx = a.facing * mv.pushback * 0.16;
    } else {
      d.state = 'hitstun'; d.stun = hitstun; d.stunType = 'hit';
      d.pushVel = a.facing * mv.pushback * 0.14 * (1 + C.LAUNCH_GROWTH * Math.max(0, n - 1));
    }
    a.pushVel = -a.facing * mv.pushback * 0.05;

    /* 确反统计：对手处于 recovery ≥ 12 帧的收招中 */
    var rec = d.recoveryExposed || (d.state === 'attack' ? 0 : 0);
    if (this.punishWindow(d)) {
      this.addStat(a.idx, 'punish', 1);
      this.events.push({ t: 'punish', p: a.idx, x: d.x, y: d.y + 150 });
      if (this.training) this.trainingHit('punish', a.idx);
    }
    if ((d.airborne || d.y > 0) && (mv.properties || []).indexOf('antiair') >= 0) {
      this.addStat(a.idx, 'antiair', 1);
      this.events.push({ t: 'antiair', p: a.idx, x: d.x, y: d.y + 150 });
      if (this.training) this.trainingHit('antiair', a.idx);
    }

    var kind = mv.key === 'super' ? 'super' : (mv.key === 'special' ? 'special' : (mv.damage > 60 ? 'heavy' : 'light'));
    this.hitstop = Math.max(this.hitstop, C.HITSTOP[kind] || 6);
    this.lastHitFrame = this.frame;
    this.events.push({
      t: 'hit', p: a.idx, v: d.idx, x: hx, y: hy, dmg: dmg,
      type: kind, combo: n, ex: a.ex, move: a.moveKey
    });
    if (n > this.stats[a.idx].maxCombo) this.stats[a.idx].maxCombo = n;
    if (this.training) this.trainingHit('combo', a.idx, n);
    this.bestMomentScore(dmg, n, mv);
    this.checkKO();
  };

  Match.prototype.punishWindow = function (d) {
    if (d.lastPunishable && this.frame - d.lastPunishable < 6) return true;
    return false;
  };

  Match.prototype.forceBreak = function (d) {
    d.toDowned('heavy');
    this.events.push({ t: 'break', p: d.idx });
  };

  Match.prototype.registerDamage = function (a, d, dmg, life) {
    this.addStat(a.idx, 'hits', 1);
    this.addStat(d.idx, 'taken', 1);
    this.addStat(a.idx, 'damage', dmg);
    this.roundDamage[a.idx] += dmg;
    this.matchDamage[a.idx] += dmg;
  };

  Match.prototype.bestMomentScore = function (dmg, n, mv) {
    var s = dmg * (1 + n * 0.25) * (mv.key === 'super' ? 2.2 : (mv.key === 'special' ? 1.4 : 1));
    if (s > this.bestMoment.score) this.bestMoment = { frame: this.frame, score: s };
  };

  /* ---------- 飞行道具 ---------- */
  Match.prototype.spawnProjectile = function (owner, mv) {
    var dir = owner.facing;
    this.projectiles.push({
      owner: owner.idx, key: mv.move_id.replace(owner.charId + '_', ''), mv: mv,
      x: owner.x + dir * 60, y: mv.projectile.y, vx: dir * mv.projectile.vx,
      w: mv.projectile.w, h: mv.projectile.h, life: mv.projectile.life, moveHits: 0
    });
    this.events.push({ t: 'projectile', p: owner.idx });
  };

  Match.prototype.updateProjectiles = function () {
    var f = this.fighters;
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      p.x += p.vx; p.life--;
      var d = f[1 - p.owner], a = f[p.owner];
      var box = { x0: p.x - p.w / 2, y0: p.y, w: p.w, h: p.h };
      var hb = d.hurtbox();
      var consumed = false;
      // 被普通攻击打消（§8.4 波动弹备注）
      if (d.isActive()) {
        var dbs = d.hitboxes();
        if (dbs && overlap(dbs[0], box)) { this.projectiles.splice(i, 1); this.events.push({ t: 'projnull', x: p.x, y: p.y }); continue; }
      }
      if (d.isInvulnerable() && overlap(box, hb)) { this.events.push({ t: 'projnull', x: p.x, y: p.y, i: true }); continue; }
      if (overlap(box, hb) && !d.__projHit) {
        var canMulti = p.mv.multiHit && p.moveHits < p.mv.multiHit.count;
        if (!p.mv.multiHit || canMulti) {
          p.moveHits++;
          this.applyHit(a, d, p.mv, { box: box, proj: true });
          d.__projHit = 8;
        }
        if (p.mv.projectile.hp <= 1) { this.projectiles.splice(i, 1); continue; }
      }
      if (p.life <= 0 || p.x < -100 || p.x > C.STAGE_W + 100) this.projectiles.splice(i, 1);
    }
  };

  /* ---------- Pushbox（§8.11）---------- */
  Match.prototype.separate = function () {
    var f = this.fighters;
    var dx = f[1].x - f[0].x;
    var dist = Math.abs(dx);
    var min = C.PUSHBOX_W;
    if (dist < min && f[0].y < 40 && f[1].y < 40) {
      var sgn = dx >= 0 ? 1 : -1;
      var need = min - dist;
      /* 双方各推一半；靠墙者推不动时把配额转给另一侧，避免角落重叠卡死 */
      var cap0 = Math.max(0, sgn > 0 ? f[0].x - C.EDGE_PAD : C.STAGE_W - C.EDGE_PAD - f[0].x);
      var cap1 = Math.max(0, sgn > 0 ? C.STAGE_W - C.EDGE_PAD - f[1].x : f[1].x - C.EDGE_PAD);
      var p0 = Math.min(need / 2, cap0), p1 = Math.min(need / 2, cap1);
      var left = need - p0 - p1;
      if (left > 0) { var e0 = Math.min(left, cap0 - p0); p0 += e0; left -= e0; }
      if (left > 0) { p1 += Math.min(left, cap1 - p1); }
      f[0].x -= sgn * p0; f[1].x += sgn * p1;
      f[0].x = U.clamp(f[0].x, C.EDGE_PAD, C.STAGE_W - C.EDGE_PAD);
      f[1].x = U.clamp(f[1].x, C.EDGE_PAD, C.STAGE_W - C.EDGE_PAD);
    }
  };

  /* ---------- 每帧收尾 ---------- */
  Match.prototype.postFrame = function () {
    var f = this.fighters, i;
    for (i = 0; i < 2; i++) {
      var a = f[i];
      if (this.comboHold[i] > 0) { this.comboHold[i]--; if (this.comboHold[i] === 0) a.comboCount = 0; }
      if (a.hpShown > a.hp) {
        if (a.hpLinger > 0) a.hpLinger--;
        else a.hpShown = Math.max(a.hp, a.hpShown - 8);
      }
      if (a.__projHit > 0) a.__projHit--;   // 与弹幕是否存在无关，统一衰减（防永久免伤）
      // 记录可被确反的窗口
      if (a.state === 'attack' && a.move) {
        var r = a.inRecovery();
        if (r > 0 && a.move.recovery >= 12) a.lastPunishable = this.frame;
      }
      if (a.state === 'attack' && a.mf === a.move.startup + a.move.active + a.move.recovery - 1 && !a.moveHasHit) {
        if (a.whiffCd <= 0) { a.gainMeter(C.METER_GAIN.whiff); a.whiffCd = C.WHIFF_GAIN_CD; }
        this.addStat(i, 'whiffs', 1);
      }
      if (this.training) {
        if (this.training.infHp) { a.hp = a.maxHp; a.hpShown = a.maxHp; }
        if (this.training.infMeter) a.meter = C.METER_MAX;
      }
    }
    // 空中受击落地 → 倒地
    for (i = 0; i < 2; i++) {
      var d = f[i];
      if (d.state === 'hitstun' && d.y <= 0 && d.stunType === 'air') d.toDowned('heavy');
      if (d.state === 'hitstun' && d.stun <= 0 && d.stunType === 'down') d.toDowned('light');
      if (d.downTimer > 0 && (d.state === 'hitstun')) d.state = 'downed';
    }

    if (this.phase !== 'fight') return;
    this.timer--;
    if (this.timer <= 0) this.endRound('time');
  };

  /* ---------- KO / Round / Match ---------- */
  Match.prototype.checkKO = function () {
    var f = this.fighters;
    var d0 = f[0].hp <= 0, d1 = f[1].hp <= 0;
    if (!d0 && !d1) return;
    if (d0 && d1) this.endRound('doubleko');
    else this.endRound('ko', d0 ? 1 : 0);
  };

  Match.prototype.endRound = function (reason, winner) {
    if (this.phase !== 'fight') return;
    this.phase = 'roundend';
    this.phaseTimer = C.KO_FREEZE;
    var f = this.fighters;
    var w = -1;
    if (reason === 'ko') w = winner;
    else if (reason === 'time') {
      if (f[0].hp === f[1].hp) w = -2; else w = f[0].hp > f[1].hp ? 0 : 1;
    } else if (reason === 'doubleko') w = -2;
    if (w >= 0) {
      this.wins[w]++;
      this.fighters[w].wins++;
      if (f[1 - w].hp === f[1 - w].maxHp && reason === 'ko') this.events.push({ t: 'perfect', p: w });
    }
    this.roundLog.push({ round: this.round, reason: reason, winner: w, dmg: this.roundDamage.slice() });
    this.events.push({ t: 'roundend', reason: reason, winner: w, round: this.round });
    this.hitstop = C.HITSTOP.ko;
    this.slowmo = { scale: C.KO_SLOWMO.scale, frames: C.KO_SLOWMO.frames };
    this.captureHighlight(reason, w);
  };

  Match.prototype.advanceRound = function () {
    if (this.wins[0] >= C.ROUNDS_TO_WIN || this.wins[1] >= C.ROUNDS_TO_WIN || this.round >= C.MAX_ROUNDS) {
      this.finishMatch();
      return;
    }
    this.round++;
    this.resetRound(false);
  };

  Match.prototype.finishMatch = function () {
    this.phase = 'matchend';
    var w = -2;
    if (this.wins[0] > this.wins[1]) w = 0;
    else if (this.wins[1] > this.wins[0]) w = 1;
    else if (this.matchDamage[0] !== this.matchDamage[1]) w = this.matchDamage[0] > this.matchDamage[1] ? 0 : 1;
    this.result = this.buildResult(w);
    this.events.push({ t: 'matchend', winner: w });
  };

  Match.prototype.surrender = function (loser) {
    this.roundLog.push({ round: this.round, reason: 'surrender', winner: 1 - loser });
    this.wins[1 - loser] = C.ROUNDS_TO_WIN;
    this.phase = 'matchend';
    this.result = this.buildResult(1 - loser);
  };

  /* ---------- 结算数据（FR5：进步优先）---------- */
  Match.prototype.buildResult = function (winner) {
    var f = this.fighters, r = {
      winner: winner,
      wins: this.wins.slice(),
      rounds: this.roundLog.slice(),
      players: [],
      duration: this.frame / C.FPS
    };
    for (var i = 0; i < 2; i++) {
      var s = this.stats[i];
      r.players.push({
        idx: i, char: f[i].charId, scheme: f[i].scheme,
        win: winner === i, hp: f[i].hp,
        hits: s.hits, taken: s.taken, blocks: s.blocks, punish: s.punish,
        techs: s.techs, supers: s.supers, specials: s.specials,
        maxCombo: s.maxCombo, damage: s.damage,
        antiair: s.antiair, throws: s.throws
      });
    }
    return r;
  };

  /* ---------- 高光截取（FR11：输入重演，非屏幕录制）---------- */
  Match.prototype.captureHighlight = function (reason, winner) {
    var startF = Math.max(0, this.frame - C.FPS * 5);
    var endF = this.frame + C.FPS * 2;
    var key = null, keys = Object.keys(this.snapshots).map(Number).sort(function (a, b) { return a - b; });
    for (var i = keys.length - 1; i >= 0; i--) if (keys[i] <= startF) { key = keys[i]; break; }
    if (key == null && keys.length) key = keys[0];
    this.highlights.push({
      reason: reason, winner: winner, startFrame: startF, endFrame: endF,
      keyFrame: key == null ? 0 : key,
      snapshot: key == null ? null : this.snapshots[key],
      inputs: this.inputLog.slice(Math.max(0, startF - this.inputLogStart),
        Math.max(0, endF - this.inputLogStart)),
      logStart: Math.max(startF, this.inputLogStart),
      version: this.version,
      chars: this.chars.slice(), schemes: this.schemes.slice(),
      peak: this.frame
    });
    if (this.highlights.length > 4) this.highlights.shift();
    this.events.push({ t: 'highlight', reason: reason });
  };

  /* ---------- 训练模式 ---------- */
  Match.prototype.trainingTick = function () {
    var t = this.training;
    if (t.aiMode === 'random' && this.frame % 40 === 0) t.__r = (t.__r || 0) + 1;
    if (t.card) this.cardTick();
  };
  Match.prototype.trainingHit = function (kind, idx, n) {
    var t = this.training;
    if (!t || !t.card) return;
    var c = t.card;
    if (c.key === kind || (c.key === 'combo2' && n >= 2) || (c.key === 'special' && kind === 'combo')) {
      c.cur = (c.cur || 0) + 1;
      if (n >= 2 && c.key === 'combo2') c.cur = (c.cur || 0);
      t.cardProgress = c.cur;
      if (c.cur >= c.target) { t.cardDone = true; this.events.push({ t: 'carddone', id: c.id }); }
    }
  };
  Match.prototype.cardTick = function () { };

  /* ---------- FTUE（§5.3）---------- */
  Match.prototype.ftueOnFight = function () {
    var t = this.ftue;
    if (t.step === 4) {
      this.fighters[0].meter = C.METER_MAX;
      this.fighters[1].hp = Math.max(60, Math.round(this.fighters[1].char.hp * 0.16));
      this.fighters[1].hpShown = this.fighters[1].hp;
    }
  };
  Match.prototype.ftueTick = function () {
    var t = this.ftue, p = this.fighters[0], q = this.fighters[1];
    if (!t || t.done) return;
    if (t.step === 1) {
      if (p.mask !== 0 || p.pressBuf.length) { t.count++; this.events.push({ t: 'ftue', step: 1, n: t.count }); }
      if (t.count >= 5) this.ftueAdvance();
    } else if (t.step === 2) {
      if (p.moveHasHit && p.state === 'attack') this.ftueAdvance();
    } else if (t.step === 3) {
      if (p.comboCount >= 2) this.ftueAdvance();
      if (this.frame % 30 === 0 && p.comboCount === 0 && p.state === 'idle') { /* 等待 */ }
    } else if (t.step === 4) {
      if (p.moveKey && p.frames[p.moveKey] && p.frames[p.moveKey].key === 'super') { this.ftueAdvance(); }
    }
  };
  Match.prototype.ftueAdvance = function () {
    var t = this.ftue;
    t.step++; t.count = 0;
    this.events.push({ t: 'ftueadvance', step: t.step });
    if (t.step === 4) { this.fighters[0].meter = C.METER_MAX; this.fighters[1].hp = Math.round(this.fighters[1].char.hp * 0.16); this.fighters[1].hpShown = this.fighters[1].hp; }
    if (t.step >= 5) { t.done = true; }
  };

  FN.Match = Match;
  FN.__rc = FN.CHAR_ORDER;
})(window.FN);
