/* =============================================================
 * FightNexus · fighter.js
 * 战斗状态机 / 物理 / 命中判定 —— 纯逻辑，不含任何 DOM 与 Canvas
 * 对应 PRD §6.3 §8.3~§8.11
 * 确定性要求（T7）：结算链路禁止 Math.random / Date.now / 浮点比较分支
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var B = FN.Input, C = FN.CFG, U = FN.U;

  var AUTO_ROUTE = ['st_lp', 'st_lp', 'st_lk', 'cr_hk'];

  function Fighter(charId, idx, scheme) {
    this.charId = charId;
    this.char = FN.CHARS[charId];
    this.frames = FN.FRAMES[charId];
    this.idx = idx;
    this.scheme = scheme || 'modern';
    this.reset(0, 1);
    this.stats = null;
  }

  Fighter.prototype.reset = function (x, facing) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.hp = this.char.hp; this.maxHp = this.char.hp;
    this.meter = 0; this.guard = C.GUARD_MAX; this.guardLock = 0;
    this.state = 'idle'; this.sf = 0;
    this.move = null; this.moveKey = null; this.mf = 0; this.moveHasHit = false;
    this.moveHits = 0; this.hitTargets = {};
    this.stun = 0; this.stunType = null;
    this.invuln = 0; this.wakeInvuln = 0;
    this.airborne = false; this.airAttackUsed = false;
    this.downTimer = 0; this.downType = 'light'; this.getupDelay = 0;
    this.pushVel = 0; this.armorHits = 0; this.crushTimer = 0;
    this.crouching = false; this.blocking = false; this.blockType = null;
    this.comboCount = 0; this.comboDamage = 0;
    this.mask = 0; this.prev = 0; this.pressBuf = []; this.dirEvents = []; this.lastDir = 5;
    this.acStep = -1; this.autoQueued = null; this.autoFlag = false; this.ex = false;
    this.whiffCd = 0; this.hoverFrames = 0; this.spinAngle = 0;
    this.lastMoveKey = null; this.recoveryExposed = 0;
    this.lastPunishable = 0; this.__projHit = 0; this.superTap = 0;
    this.hpShown = this.hp; this.flash = 0; this.hurtFlash = 0;
    this.techPending = false;
    this.stunBlockType = null;
    this.delayedOnce = false;
    this.wins = 0;
  };

  /* ---------- 序列化（Rollback / 高光重演 / desync 校验）---------- */
  var SER = ['x', 'y', 'vx', 'vy', 'facing', 'hp', 'meter', 'guard', 'guardLock', 'state', 'sf', 'moveKey', 'mf',
    'moveHasHit', 'moveHits', 'stun', 'stunType', 'invuln', 'wakeInvuln', 'airborne', 'airAttackUsed',
    'downTimer', 'downType', 'getupDelay', 'pushVel', 'armorHits', 'crushTimer', 'crouching', 'blocking',
    'blockType', 'comboCount', 'comboDamage', 'lastDir', 'acStep', 'autoFlag', 'ex', 'whiffCd',
    'hoverFrames', 'spinAngle', 'lastMoveKey', 'recoveryExposed', 'techPending', 'wins', 'hpShown',
    'stunBlockType', 'delayedOnce'];
  Fighter.prototype.serialize = function () {
    var o = { charId: this.charId, idx: this.idx, scheme: this.scheme };
    for (var i = 0; i < SER.length; i++) o[SER[i]] = this[SER[i]];
    o.dirEvents = this.dirEvents.slice(-8);
    return o;
  };
  Fighter.prototype.deserialize = function (o) {
    for (var i = 0; i < SER.length; i++) this[SER[i]] = o[SER[i]];
    this.dirEvents = (o.dirEvents || []).slice();
    this.pressBuf = [];
    this.move = o.moveKey ? this.frames[o.moveKey] : null;
    this.autoQueued = null;
  };

  /* ---------- 输入跟踪 ---------- */
  Fighter.prototype.trackInput = function (frame, mask) {
    var pressed = mask & ~this.prev & B.BTN_MASK;
    if (pressed) {
      var buf = FN.SCHEMES[this.scheme].buffer;
      var persist = FN.SCHEMES[this.scheme].persist || buf;
      for (var i = 0; i < B.ALL_BUTTONS.length; i++) {
        var bit = B[B.ALL_BUTTONS[i]];
        if (pressed & bit) this.pressBuf.push({ b: bit, exp: frame + buf, pexp: frame + persist });
      }
    }
    while (this.pressBuf.length && this.pressBuf[0].pexp < frame) this.pressBuf.shift();
    var d = B.numpad(mask, this.facing);
    if (d !== this.lastDir) {
      this.dirEvents.push({ d: d, f: frame });
      if (this.dirEvents.length > 20) this.dirEvents.shift();
      this.lastDir = d;
    }
  };
  Fighter.prototype.consume = function (bit, late) {
    for (var i = 0; i < this.pressBuf.length; i++) {
      if (this.pressBuf[i].b === bit && this.pressBuf[i].exp >= this.frameNow) {
        this.pressBuf.splice(i, 1); return true;
      }
      if (late && this.pressBuf[i].b === bit && this.pressBuf[i].pexp >= this.frameNow) {
        this.pressBuf.splice(i, 1); return true;
      }
    }
    return false;
  };
  Fighter.prototype.peek = function (bit) {
    for (var i = 0; i < this.pressBuf.length; i++)
      if (this.pressBuf[i].b === bit && this.pressBuf[i].exp >= this.frameNow) return true;
    return false;
  };

  /* ---------- 查询 ---------- */
  Fighter.prototype.canAct = function () {
    return (this.state === 'idle' || this.state === 'walk' || this.state === 'crouch' ||
      this.state === 'jump' || this.state === 'air') && this.stun <= 0;
  };
  Fighter.prototype.isActive = function () {
    if (this.state !== 'attack' || !this.move) return false;
    return this.mf > this.move.startup && this.mf <= this.move.startup + this.move.active;
  };
  Fighter.prototype.inRecovery = function () {
    if (this.state !== 'attack' || !this.move) return 0;
    var r = this.mf - (this.move.startup + this.move.active);
    return r > 0 ? r : 0;
  };
  Fighter.prototype.isInvulnerable = function () {
    if (this.invuln > 0 || this.wakeInvuln > 0) return true;
    if (this.state === 'attack' && this.move && this.move.invuln_window) {
      var w = this.move.invuln_window;
      if (this.mf >= w[0] && this.mf <= w[1] + 1) return true;
    }
    return false;
  };
  Fighter.prototype.hasArmor = function () {
    if (this.state !== 'attack' || !this.move) return false;
    if (!this.move.properties || this.move.properties.indexOf('armor') < 0) return false;
    return this.mf >= (this.move.armorFrom || 0) && this.mf <= (this.move.armorTo || 0) && this.armorHits < (this.move.armorMax || 1);
  };
  Fighter.prototype.hurtbox = function () {
    var w, h, y0;
    if (this.downTimer > 0 || this.state === 'downed') { w = 130; h = 44; y0 = 0; }
    else if (this.crouching && !this.airborne) { w = 84; h = 106; y0 = 0; }
    else if (this.airborne || this.y > 0) { w = 72; h = 140; y0 = this.y; }
    else { w = 78; h = 170; y0 = 0; }
    return { x0: this.x - w / 2, y0: y0, w: w, h: h };
  };
  Fighter.prototype.hitboxes = function () {
    if (!this.isActive()) return null;
    var mv = this.move, hb = mv.hitbox;
    var near = this.x + this.facing * hb.x;
    var x0 = this.facing > 0 ? near : near - hb.w;
    var y0 = (-hb.y) + this.y;
    return [{ x0: x0, y0: y0, w: hb.w, h: hb.h }];
  };
  Fighter.prototype.center = function () { return { x: this.x, y: this.y + 120 }; };

  /* ---------- 主步进 ---------- */
  Fighter.prototype.step = function (mask, frame, M) {
    this.frameNow = frame;
    this.prev = this.mask; this.mask = mask;
    this.trackInput(frame, mask);
    this.sf++;

    if (this.invuln > 0) this.invuln--;
    if (this.wakeInvuln > 0) this.wakeInvuln--;
    if (this.crushTimer > 0) this.crushTimer--;
    if (this.flash > 0) this.flash--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.whiffCd > 0) this.whiffCd--;
    if (this.techPending) this.techPending = false;

    if (Math.abs(this.pushVel) > 0.02) {
      this.x += this.pushVel;
      this.pushVel *= C.PUSHBACK_DECAY;
    } else this.pushVel = 0;

    if (this.guardLock > 0) this.guardLock--;
    else if (this.guard < C.GUARD_MAX) this.guard = Math.min(C.GUARD_MAX, this.guard + C.GUARD_REGEN);

    this.blocking = false; this.blockType = null;

    if (this.downTimer > 0 || this.state === 'downed') this.stepDowned(M);
    else if (this.state === 'hitstun' || this.state === 'blockstun' || this.state === 'guardcrush' || this.state === 'thrown') this.stepStun(M);
    else if (this.state === 'attack') this.stepAttack(M, frame);
    else this.stepFree(M, frame);

    this.physics(M);
    if (this.state !== 'attack') this.crouching = (this.crouching && !this.airborne && B.holdsDown(this.mask));
  };

  /* ---------- 倒地 / 起身博弈（§8.9）---------- */
  Fighter.prototype.stepDowned = function (M) {
    this.state = 'downed';
    this.downTimer--;
    if (this.downTimer <= 0) {
      if (this.getupDelay > 0) { this.getupDelay--; this.downTimer = 1; return; }
      // 起身选项：快速起身 / 原地拖延 / 后滚起身
      var back = B.dirX(this.mask, this.facing) < 0, down = B.holdsDown(this.mask);
      if (down && !this.delayedOnce) { this.delayedOnce = true; this.downTimer = 14; return; }
      this.delayedOnce = false;
      if (back) { this.pushVel = -this.facing * 7; this.downTimer = 0; }
      this.state = 'wakeup'; this.wakeInvuln = C.WAKEUP_INVULN; this.sf = 0;
      M.events.push({ t: 'wakeup', p: this.idx });
    }
  };

  Fighter.prototype.stepStun = function (M) {
    this.stun--;
    if (this.state === 'thrown') {
      if (this.stun <= 0) { this.toDowned('heavy'); }
      return;
    }
    if (this.state === 'blockstun') {
      this.blocking = true;
      /* 防御姿态必须贯穿整个 blockstun，否则连段第二下会因 blockType 为 null 打穿防御 */
      this.blockType = this.stunBlockType || this.blockType || 'stand';
    }
    if (this.stun <= 0) {
      if (this.guard <= 0 && this.state === 'blockstun') {
        this.state = 'guardcrush'; this.stun = C.GUARD_CRUSH; this.crushTimer = C.GUARD_CRUSH;
        this.guard = C.GUARD_MAX * 0.4;
        M.events.push({ t: 'crush', p: this.idx });
        return;
      }
      this.state = 'idle'; this.stunType = null; this.sf = 0;
      this.comboCount = 0;
    }
  };

  /* ---------- 自由状态：移动 / 防御 / 起手 ---------- */
  Fighter.prototype.stepFree = function (M, frame) {
    var opp = M.fighters[1 - this.idx];
    var dir = B.dirX(this.mask, this.facing);
    var down = B.holdsDown(this.mask), up = B.holdsUp(this.mask);

    if (this.state === 'wakeup') {
      // 起身 8 帧无敌内可消耗 1 格做无敌反击（BT-8 / BT-10）
      if (this.tryReversal(M, frame)) return;
      if (this.sf > 8) { this.state = 'idle'; this.sf = 0; }
    }

    if (this.airborne || this.y > 0) {
      this.crouching = false;
      if (this.tryAirActions(M, frame)) return;
      return;
    }

    // 面向
    if (this.state !== 'attack' && opp) {
      var want = (opp.x >= this.x) ? 1 : -1;
      if (this.state === 'idle' || this.state === 'walk' || this.state === 'crouch') this.facing = want;
    }

    if (down) {
      this.crouching = true; this.state = 'crouch';
      if (dir < 0 && opp) { this.blocking = true; this.blockType = 'crouch'; }
      if (this.tryActions(M, frame, true)) { this.blocking = false; this.blockType = null; return; }
      this.vx = 0;
      return;
    }
    this.crouching = false;

    // 防御判定（§8.7）
    if (dir < 0 && opp) {
      var incoming = opp.state === 'attack' && opp.mf <= (opp.move ? opp.move.startup + opp.move.active : 0);
      this.blocking = true; this.blockType = 'stand';
      this.state = 'idle';
      if (this.tryActions(M, frame, false)) { this.blocking = false; return; }
      this.vx = this.facing * (-this.char.speedB) * 0.55;
      if (Math.abs(this.vx) > 0.01) this.state = 'walk';
      return;
    }
    if (this.tryActions(M, frame, false)) return;

    if (up) {
      this.jump(dir);
      return;
    }
    if (dir > 0) { this.vx = this.facing * this.char.speedF; this.state = 'walk'; }
    else if (dir < 0) { this.vx = this.facing * (-this.char.speedB); this.state = 'walk'; }
    else { this.vx = 0; this.state = 'idle'; }
  };

  Fighter.prototype.jump = function (dir) {
    this.vy = C.GRAVITY * this.char.airTime / 2;
    this.y = 0.01; this.airborne = true; this.airAttackUsed = false;
    this.vx = dir > 0 ? this.facing * this.char.speedF * 1.15 : (dir < 0 ? this.facing * (-this.char.speedB * 1.1) : 0);
    this.state = 'jump'; this.sf = 0;
  };

  Fighter.prototype.tryAirActions = function (M, frame) {
    if (this.airAttackUsed) return false;
    var mv = null;
    if (this.consume(B.HP)) mv = 'jp_hp';
    else if (this.consume(B.LP)) mv = 'jp_lp';
    else if (this.scheme !== 'classic' && this.consume(B.HK)) mv = 'jp_hp';
    else if (this.scheme !== 'classic' && this.consume(B.LK)) mv = 'jp_lp';
    if (mv) return this.startMove(mv, null, M);
    // 空中必杀（Rina 空中旋风脚）
    if (this.trySpecial(M, frame, true)) return true;
    return false;
  };

  /* ---------- 动作起手：优先级 Throw > Super > Special > Heavy > Light ---------- */
  Fighter.prototype.tryActions = function (M, frame, crouch) {
    var s = this.scheme;
    // 1 投技
    if (this.consume(B.THROW)) return this.startMove('throw', null, M);
    if ((this.peek(B.LP) && this.peek(B.LK)) && s === 'classic') {
      this.consume(B.LP); this.consume(B.LK);
      return this.startMove('throw', null, M);
    }
    // 2 超必杀
    if (this.trySuper(M, frame)) return true;
    // 3 必杀
    if (this.trySpecial(M, frame, false)) return true;
    // 4/5 普通技
    var lp = this.consume(B.LP), hp = this.consume(B.HP), lk = this.consume(B.LK), hk = this.consume(B.HK);
    if (s === 'assist') { if (lp || lk) lp = true; if (hp || hk) hp = true; lk = hk = false; }
    if (hp) return this.startMove(crouch ? 'cr_hp' : 'st_hp', null, M);
    if (hk) return this.startMove(crouch ? 'cr_hk' : 'st_hk', null, M);
    if (lp) return this.startMove(crouch ? 'cr_lp' : 'st_lp', null, M);
    if (lk) return this.startMove(crouch ? 'cr_lk' : 'st_lk', null, M);
    return false;
  };

  Fighter.prototype.tryReversal = function (M, frame) {
    var m = this.frames;
    if (this.meter < 100) return false;
    for (var k in m) {
      var mv = m[k];
      if (mv.meterCost || (mv.properties && mv.properties.indexOf('reversal') >= 0)) {
        var cost = mv.meterCost || 100;
        if (this.meter < cost) continue;
        if (mv.properties && mv.properties.indexOf('invincible') >= 0 && this.peek(B.ASSIST)) {
          this.consume(B.ASSIST);
          return this.startMove(k, null, M);
        }
        if (this.scheme === 'classic') {
          var mo = B.detectMotion(this.dirEvents.filter(function (e) { return e.f >= frame - 20; }), this.charId);
          if (mo === (mv.motion || '')) return this.startMove(k, null, M);
        }
      }
    }
    return false;
  };

  Fighter.prototype.trySuper = function (M, frame) {
    var s = this.scheme, table = FN.MOTION_TABLE[this.charId] || {};
    var superKey = null;
    for (var k in table) if (this.frames[table[k]] && this.frames[table[k]].key === 'super') { superKey = table[k]; break; }
    if (!superKey) return false;
    var mv = this.frames[superKey];
    if (this.meter < (mv.meterCost || 100)) return false;

    if (s !== 'classic') {
      /* 先确认 Assist+攻击键 组合成立再消耗，避免 Assist 被吞导致一键必杀失灵 */
      if (this.peek(B.ASSIST) && (this.peek(B.HP) || this.peek(B.HK))) {
        this.consume(B.ASSIST);
        if (!this.consume(B.HP)) this.consume(B.HK);
        return this.startMove(superKey, null, M);
      }
      // Modern：Assist 双击也出超必（宽容输入）
      if (this.superTap && this.frameNow - this.superTap < 14 && this.consume(B.ASSIST)) {
        this.superTap = 0; return this.startMove(superKey, null, M);
      }
      if (this.peek(B.ASSIST)) this.superTap = this.superTap ? this.superTap : this.frameNow;
      return false;
    }
    var mo = B.detectMotion(this.dirEvents.filter(function (e) { return e.f >= frame - C.DOUBLE_WINDOW; }), this.charId);
    if (mo && table[mo] === superKey && (this.consume(B.HP) || this.consume(B.HK) || this.consume(B.ASSIST))) {
      return this.startMove(superKey, null, M);
    }
    return false;
  };

  Fighter.prototype.trySpecial = function (M, frame, air) {
    var s = this.scheme, table = FN.MOTION_TABLE[this.charId] || {};
    var got = null;
    if (s !== 'classic') {
      if (this.consume(B.ASSIST, true)) {
        // 一键必杀：优先取空中招（若在空中），否则地面主力必杀
        var cand = null;
        for (var k in table) {
          var v = this.frames[table[k]];
          if (!v || v.key !== 'special') continue;
          if (air && v.airOnly) { cand = table[k]; break; }
          if (!air && !v.airOnly && !cand) cand = table[k];
        }
        if (cand) return this.startMove(cand, null, M);
      }
      return false;
    }
    var mo = B.detectMotion(this.dirEvents.filter(function (e) { return e.f >= frame - C.MOTION_WINDOW; }), this.charId);
    if (!mo || !table[mo]) return false;
    var mvKey = table[mo], mv = this.frames[mvKey];
    if (!mv) return false;
    if (mv.airOnly && !(this.airborne || this.y > 0)) return false;
    if (!mv.airOnly && (this.airborne || this.y > 0)) return false;
    var kk = (this.charId === 'rina' && mv.airOnly) ? B.LK : B.HP;
    if (this.consume(B.HP) || this.consume(B.HK) || this.consume(kk) || this.consume(B.LP) || this.consume(B.LK)) {
      M.addStat(this.idx, 'specialTries', 1);
      return this.startMove(mvKey, null, M);
    }
    return false;
  };

  /* ---------- 出招 ---------- */
  Fighter.prototype.startMove = function (key, opts, M) {
    var mv = this.frames[key];
    if (!mv) return false;
    var cost = mv.meterCost || 0;
    if (opts && opts.ex) cost = C.EX_COST;
    if (cost > 0 && this.meter < cost) return false;
    if (this.state === 'attack' && this.move && !(this.moveHasHit && this.canCancel())) return false;
    if (this.stun > 0 && this.state !== 'attack') return false;

    if (cost > 0) { this.meter -= cost; M.events.push({ t: 'meter', p: this.idx, v: -cost }); }
    this.state = 'attack'; this.move = mv; this.moveKey = key; this.mf = 0;
    this.moveHasHit = false; this.moveHits = 0; this.hitTargets = {};
    this.stun = 0; this.stunType = null;
    this.autoFlag = !!(opts && opts.auto); this.ex = !!(opts && opts.ex);
    this.armorHits = 0; this.lastMoveKey = key;
    this.vx = 0; this.crouching = !!mv.crouch;
    if (mv.air) this.airAttackUsed = true;
    if (mv.dash) this.vx = this.facing * mv.dash;
    if (mv.rise) { this.vy = mv.rise; this.y = Math.max(this.y, 0.01); this.airborne = true; }
    if (mv.hover) { this.hoverFrames = mv.active; this.vy = 0; }
    if (mv.spin) this.spinAngle = 0;
    if (mv.key === 'special' || mv.key === 'super') M.addStat(this.idx, 'specials', 1);
    if (mv.key === 'super') { M.addStat(this.idx, 'supers', 1); M.events.push({ t: 'super', p: this.idx, move: key }); }
    M.events.push({ t: 'move', p: this.idx, move: key, x: this.x, y: this.y, facing: this.facing });
    this.acStep = -1;
    if (mv.properties && mv.properties.indexOf('selfchain') >= 0 && FN.SCHEMES[this.scheme].autoCombo) {
      this.acStep = 0; this.autoQueued = null;
    }
    return true;
  };

  Fighter.prototype.canCancel = function () {
    if (!this.move) return false;
    if (!this.move.properties || this.move.properties.indexOf('cancelable') < 0) return false;
    return this.mf >= this.move.startup && this.mf <= this.move.startup + this.move.active + C.CANCEL_WINDOW;
  };

  Fighter.prototype.stepAttack = function (M, frame) {
    var mv = this.move;
    this.mf++;
    if (this.move && this.move.hover && this.mf <= this.move.startup + this.move.active) { this.vy = 0; this.y = Math.max(this.y, 26); }
    if (mv.spin) this.spinAngle += mv.spin / (mv.startup + mv.active);
    if (mv.dash) {
      var d = mv.dash * (this.mf <= mv.startup + mv.active ? 1 : 0.2);
      this.x += this.facing * d;
    }
    if (mv.properties && mv.properties.indexOf('projectile') >= 0 && mv.projectile && this.mf === mv.projectile.frame) {
      M.spawnProjectile(this, mv);
    }
    // 取消窗口内可接必杀 / auto-combo 推进
    if (this.moveHasHit && this.canCancel()) {
      if (this.trySuper(M, frame)) return;
      if (this.trySpecial(M, frame, false)) return;
      if (FN.SCHEMES[this.scheme].autoCombo && this.acStep >= 0 && this.acStep + 1 < FN.SCHEMES[this.scheme].autoCombo) {
        if (this.consume(B.LP) || this.consume(B.LK)) this.autoQueued = AUTO_ROUTE[this.acStep + 1];
      }
    }
    var total = mv.startup + mv.active + mv.recovery;
    if (this.mf >= total) {
      if (this.autoQueued && this.frames[this.autoQueued]) {
        var nx = this.autoQueued; this.autoQueued = null;
        if (this.startMove(nx, { auto: true }, M)) { if (this.acStep >= 0) this.acStep++; return; }
      }
      if (mv.air && (this.airborne || this.y > 0)) { this.state = 'jump'; }
      else if (this.y > 0) { this.state = 'jump'; }
      else this.state = 'idle';
      this.move = null; this.moveKey = null; this.mf = 0; this.sf = 0; this.vx = 0;
      if (this.airborne) this.state = 'jump';
    }
  };

  /* ---------- 物理 ---------- */
  Fighter.prototype.physics = function (M) {
    if (this.airborne || this.y > 0) {
      if (!(this.move && this.move.hover && this.mf <= this.move.startup + this.move.active)) this.vy -= C.GRAVITY;
      this.y += this.vy; this.x += this.vx;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.vx = 0; this.airborne = false;
        this.airAttackUsed = false;
        if (this.state === 'hitstun') { this.toDowned(this.stunType === 'air' ? 'heavy' : 'light'); }
        else if (this.state === 'jump' || this.state === 'air') { this.state = 'idle'; this.sf = 0; }
        else if (this.state === 'attack' && this.move && this.move.air) { this.state = 'idle'; this.move = null; this.mf = 0; }
        M.events.push({ t: 'land', p: this.idx, x: this.x });
      }
      this.state = (this.state === 'idle') ? 'jump' : this.state;
    } else {
      if (this.state === 'attack' && this.move && this.move.dash) this.x += this.vx * 0.4;
      else this.x += (this.vx || 0);
      this.vx = 0;
    }
    this.x = U.clamp(this.x, C.EDGE_PAD, C.STAGE_W - C.EDGE_PAD);
  };

  /* ---------- 受击 / 防御结算（由 Match 调用）---------- */
  Fighter.prototype.toDowned = function (type) {
    this.state = 'downed'; this.downType = type || 'light';
    this.downTimer = C.DOWN_TIME[this.downType] || 32;
    this.delayedOnce = false; this.getupDelay = 0;
    this.move = null; this.moveKey = null; this.mf = 0; this.stun = 0;
    this.vy = 0; this.y = 0; this.airborne = false;
    this.comboCount = 0;
  };
  Fighter.prototype.toNeutral = function () {
    this.state = 'idle'; this.move = null; this.moveKey = null; this.mf = 0; this.sf = 0;
  };
  Fighter.prototype.gainMeter = function (permille) {
    this.meter = Math.min(C.METER_MAX, this.meter + C.METER_MAX * permille / 1000);
  };

  FN.Fighter = Fighter;
  FN.AUTO_ROUTE = AUTO_ROUTE;
})(window.FN);
