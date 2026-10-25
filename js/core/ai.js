/* =============================================================
 * FightNexus · ai.js
 * §9 AI 行为规格：可读性第一、强度第二；11 个可枚举可验收的行为维度
 * §9.4 禁止输入预读：AI 只能读取「已经发生 N 帧」的游戏状态
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var B = FN.Input, C = FN.CFG;

  function AIController(idx, profileName, opts) {
    opts = opts || {};
    this.idx = idx;
    this.setProfile(profileName || 'standard');
    this.queue = [];
    this.percept = [];               // 对手状态延迟队列（反应延迟）
    this.selfPercept = [];
    this.nextDecision = 0;
    this.seed = (opts.seed || 12345 + idx * 7919) | 0;
    this.aggroBoost = 0;
  }

  AIController.prototype.setProfile = function (name) {
    this.profileName = name;
    this.p = JSON.parse(JSON.stringify(FN.AI_PROFILES[name] || FN.AI_PROFILES.standard));
  };
  /* §6.4 动态难度：±20% 浮动，仅在 Round 之间调整 */
  AIController.prototype.tune = function (hsi) {
    var base = FN.AI_PROFILES[this.profileName] || FN.AI_PROFILES.standard;
    var prof = this.profileName;
    if (FN.DYNAMIC.enabledDefault) {
      var map = { casual: 35, standard: 70, expert: 100 };
      var target = hsi < FN.DYNAMIC.hsi.casual ? 'casual' : (hsi < FN.DYNAMIC.hsi.standard ? 'standard' : 'expert');
      if (map[target] !== map[prof]) prof = target;
    }
    this.p = JSON.parse(JSON.stringify(FN.AI_PROFILES[prof] || base));
    var f = 1 + (this.dynamicAdj || 0);
    this.p.reaction_delay = Math.max(4, Math.round(this.p.reaction_delay / f));
    this.p.guard_probability = Math.min(0.9, this.p.guard_probability * f);
    this.p.punish_rate = Math.min(0.95, this.p.punish_rate * f);
    this.p.anti_air_rate = Math.min(0.95, this.p.anti_air_rate * f);
  };

  AIController.prototype.rand = function () {
    this.seed = (this.seed * 1664525 + 1013904223) | 0;
    return ((this.seed >>> 8) & 0xffffff) / 0x1000000;
  };

  /* ---------- 感知（延迟 = reaction_delay）---------- */
  AIController.prototype.observe = function (M) {
    var me = M.fighters[this.idx], op = M.fighters[1 - this.idx];
    this.percept.push({
      f: M.frame, x: op.x, y: op.y, state: op.state, mf: op.mf,
      moveKey: op.moveKey, stun: op.stun, hp: op.hp, air: op.airborne || op.y > 0,
      blocking: op.blocking, downTimer: op.downTimer
    });
    if (this.percept.length > 40) this.percept.shift();
    this.selfPercept.push({ f: M.frame, x: me.x, hp: me.hp, meter: me.meter, state: me.state, hit: me.moveHasHit, combo: me.comboCount, mf: me.mf, moveKey: me.moveKey });
    if (this.selfPercept.length > 40) this.selfPercept.shift();
  };
  AIController.prototype.seen = function () {
    var d = this.p.reaction_delay, arr = this.percept;
    var want = (arr.length ? arr[arr.length - 1].f : 0) - d;
    for (var i = arr.length - 1; i >= 0; i--) if (arr[i].f <= want) return arr[i];
    return arr[0] || null;
  };
  AIController.prototype.self = function () { return this.selfPercept[this.selfPercept.length - 1] || null; };

  /* ---------- 输出：与玩家完全相同的输入队列 ---------- */
  AIController.prototype.poll = function (frame, M) {
    this.observe(M);
    if (this.queue.length) return this.queue.shift();
    if (frame < this.nextDecision) return this.holdMask || 0;
    this.holdMask = 0;
    this.decide(M);
    this.nextDecision = frame + this.p.decision_interval;
    if (!this.queue.length) this.queue.push(0);
    return this.queue.shift();
  };

  /* ---------- 招式射程 ---------- */
  function reach(mv) { return mv.hitbox ? (mv.hitbox.x + mv.hitbox.w) : 60; }

  /* ---------- 指令脚本（与玩家同样的按键序列）---------- */
  function motionScript(motion, btn, facing) {
    var fwd = facing > 0 ? B.RIGHT : B.LEFT;
    var back = facing > 0 ? B.LEFT : B.RIGHT;
    var out = [];
    var push = function (mask, n) { for (var i = 0; i < n; i++) out.push(mask); };
    if (motion === '236') { push(B.DOWN, 3); push(B.DOWN | fwd, 3); push(fwd | btn, 2); push(btn, 2); }
    else if (motion === '214') { push(B.DOWN, 3); push(B.DOWN | back, 3); push(back | btn, 2); push(btn, 2); }
    else if (motion === '623') { push(fwd, 3); push(B.DOWN, 3); push(B.DOWN | fwd | btn, 2); push(btn, 2); }
    else if (motion === '236236') {
      push(B.DOWN, 2); push(B.DOWN | fwd, 2); push(fwd, 2);
      push(B.DOWN, 2); push(B.DOWN | fwd, 2); push(fwd | btn, 2); push(btn, 2);
    } else if (motion === '214214') {
      push(B.DOWN, 2); push(B.DOWN | back, 2); push(back, 2);
      push(B.DOWN, 2); push(B.DOWN | back, 2); push(back | btn, 2); push(btn, 2);
    } else if (motion === '360' || motion === '360360') {
      var times = motion === '360360' ? 2 : 1;
      for (var t = 0; t < times; t++) {
        push(back, 2); push(B.DOWN | back, 2); push(B.DOWN, 2); push(B.DOWN | fwd, 2); push(fwd, 2); push(B.UP, 2);
      }
      push(btn, 3);
    } else { push(btn, 3); }
    return out;
  }

  /* ---------- 移动指令 ----------
   * §9.2「decision_interval 过低会疯狂抖动」的反面同样成立：
   * 若在一次决策内部逐帧随机方向，AI 会原地小碎步抖动，玩家读不出它的意图。
   * 因此一次决策只锁定一个方向（sticky），并支持「先走进射程再出招」的步进攻击。 */
  AIController.prototype.walkQueue = function (fwd, back, n, fwdP) {
    var dir = this.rand() < fwdP ? fwd : back;
    /* 移动倾向门控：walk 低 / aggression 低的档位（如 Dummy）以站桩为主，
     * 避免 AI 持续走位脱离（或进入）交互，玩家读不到「它想干什么」 */
    var gate = Math.max(0, Math.min(1, 0.25 + this.p.walk * 0.6 + this.p.aggression * 0.15));
    var out = [];
    for (var i = 0; i < n; i++) out.push(this.rand() < gate ? dir : 0);
    return out;
  };
  AIController.prototype.btnFor = function (key) {
    return B[key === 'st_hp' || key === 'cr_hp' || key === 'jp_hp' ? 'HP' :
      (key === 'st_lk' || key === 'cr_lk' ? 'LK' : (key === 'st_hk' || key === 'cr_hk' ? 'HK' : 'LP'))];
  };
  /* 步进攻击：先前进 N 帧进入自己的射程再出招（玩家的真实打法，也最易读） */
  AIController.prototype.stepInAttack = function (M, key, fwd, steps) {
    var me = M.fighters[this.idx], mv = me.frames[key];
    var crouch = mv && mv.crouch ? B.DOWN : 0;
    var btn = this.btnFor(key);
    var out = [];
    for (var i = 0; i < (steps || 8); i++) out.push(fwd);
    out.push(crouch | btn, crouch | btn, crouch);
    for (var j = 0; j < 6; j++) out.push(0);
    return out;
  };
  /* 步进投：破解蹲防的唯一手段，也是 Goro 身份（投技威胁）的兑现路径 */
  AIController.prototype.stepInThrow = function (M, fwd, steps) {
    var out = [];
    for (var i = 0; i < (steps || 8); i++) out.push(fwd);
    return out.concat([B.THROW, B.THROW, 0, 0, 0, 0]);
  };
  /* 走到目标距离所需的帧数 */
  AIController.prototype.stepsTo = function (me, dist, target) {
    var sp = Math.max(1.4, (me.char && me.char.speedF) || 3.0);
    return Math.min(18, Math.max(4, Math.round(Math.max(0, dist - target) / sp)));
  };

  /* ---------- 决策 ---------- */
  AIController.prototype.decide = function (M) {
    var me = M.fighters[this.idx], op = M.fighters[1 - this.idx];
    var p = this.p, r = this.rand.bind(this);
    var seen = this.seen() || { x: op.x, y: op.y, state: 'idle', air: false };
    var self = this.self() || { hp: me.hp, meter: me.meter, hit: false, combo: 0 };
    var dist = Math.abs(seen.x - me.x);
    var facing = me.facing;
    var fwd = facing > 0 ? B.RIGHT : B.LEFT;
    var back = facing > 0 ? B.LEFT : B.RIGHT;
    var fr = me.frames;
    var err = r() < p.input_error_rate;

    if (!me.canAct() && me.state !== 'attack') { this.queue.push(0); return; }
    if (me.state === 'attack') {
      // 连段深度控制（§9.3 专家 5~7 段区间内浮动，避免每次都恰好同段数）
      if (self.hit && (self.combo || 0) < this.comboDepth()) {
        this.queue = this.attackScript(M, 'st_lp', fwd);
        return;
      }
      this.queue.push(0); return;
    }

    var lowHp = self.hp < me.maxHp * 0.28;
    var aggression = p.aggression + (lowHp && p.panic_behavior === 'desperate' ? 0.5 : 0)
      - (lowHp && p.panic_behavior === 'turtle' ? 0.6 : 0);

    /* 1 确反（对手收招 ≥ 12 帧）*/
    var oppRec = false;
    if (seen.state === 'attack' && seen.moveKey) {
      var omv = op.frames[seen.moveKey];
      if (omv && seen.mf > omv.startup + omv.active && omv.recovery >= 12) oppRec = true;
    }
    if (oppRec && dist < 150 && r() < p.punish_rate) {
      this.queue = err ? this.attackScript(M, 'st_lk', fwd) : this.punishScript(M, dist);
      return;
    }
    /* 2 防空 */
    if (seen.air && dist < 240 && r() < p.anti_air_rate) {
      var aa = this.antiAirMove(M);
      this.queue = err ? this.attackScript(M, 'st_lp', fwd) : this.specialOrNormal(M, aa, fwd);
      return;
    }
    /* 3 对手正在出招 → 防御 */
    if (seen.state === 'attack' && dist < 220 && r() < p.guard_probability) {
      this.queue = [];
      var n = Math.min(p.decision_interval, 18);
      for (var i = 0; i < n; i++) this.queue.push(back | (r() < 0.4 ? B.DOWN : 0));
      return;
    }
    /* 4 超必杀 */
    if (self.meter >= 100 && r() < p.resource_use * 0.6 && dist < 220) {
      var sk = this.superKey(M);
      if (sk) { this.queue = motionScript(fr[sk].motion, B.HP, facing); return; }
    }
    /* 5 近身择（上/下段、投/打）。对手在防御时优先投（反龟/兑现 Goro 身份）*/
    var rch = Math.max(reach(fr.st_hk || fr.st_hp), reach(fr.st_hp || fr.st_lp));
    if (dist < 92) {
      var gs = this.grabSpecial(M);
      if (seen.blocking && r() < p.mixup_rate * 0.9) {
        if (gs && dist < reach(fr[gs]) * 0.95 && r() < p.resource_use) {
          this.queue = motionScript(fr[gs].motion, B.HP, facing); return;
        }
        this.queue = this.throwScript(fwd); return;
      }
      if (r() < p.mixup_rate * 0.5) { this.queue = this.throwScript(fwd); return; }
      if (r() < p.mixup_rate) { this.queue = this.attackScript(M, 'cr_lk', fwd); return; }
      if (r() < 0.5 + aggression * 0.3) { this.queue = this.attackScript(M, r() < 0.5 ? 'cr_lp' : 'st_hp', fwd); return; }
      this.queue = this.walkQueue(fwd, back, 8, 0.35);
      return;
    }
    /* 6 射程内：出招；或步进走进投技距离（否则双方永远隔着一个拳头站位）*/
    if (dist <= rch) {
      var sp6 = this.pokeSpecial(M);
      if (sp6 && r() < p.resource_use * 0.45 && dist < reach(fr[sp6]) * 0.98) { this.queue = motionScript(fr[sp6].motion, B.HP, facing); return; }
      if (r() < 0.62 + aggression * 0.25) { this.queue = this.attackScript(M, r() < 0.6 ? 'st_hk' : 'st_hp', fwd); return; }
      if (seen.blocking && r() < 0.35 + p.mixup_rate * 0.4) {
        this.queue = this.stepInThrow(M, fwd, this.stepsTo(me, dist, 70)); return;
      }
      this.queue = this.walkQueue(fwd, back, 10, 0.55 + aggression * 0.25);
      return;
    }
    /* 7 接近带：步进攻击为主（先走 N 帧再出手），这是可读性最好的进攻方式 */
    if (dist < rch * 3.2) {
      var spb = this.pokeSpecial(M);
      if (spb && r() < p.resource_use * 0.4 && dist < reach(fr[spb]) * 1.5) { this.queue = motionScript(fr[spb].motion, B.HP, facing); return; }
      if (r() < 0.4 + aggression * 0.3 + p.walk * 0.2) {
        this.queue = this.stepInAttack(M, r() < 0.55 ? 'st_hk' : 'st_hp', fwd, this.stepsTo(me, dist, rch * 0.8));
        return;
      }
      this.queue = this.walkQueue(fwd, back, 12, 0.55 + aggression * 0.3 + (p.walk - 0.6) * 0.2);
      return;
    }
    /* 8 远距离：牵制或进场（被逼到角落时必须进场，避免双龟） */
    var proj = this.projectileKey(M);
    if (proj && r() < p.resource_use * 0.35) { this.queue = motionScript(fr[proj].motion, B.HP, facing); return; }
    var wall = me.x < 180 || me.x > C.STAGE_W - 180;
    this.queue = this.walkQueue(fwd, back, 14, wall ? 1 : Math.max(0.6, 0.62 + aggression * 0.3));
  };

  AIController.prototype.attackScript = function (M, key, fwd) {
    var me = M.fighters[this.idx], mv = me.frames[key];
    var out = [], crouch = mv && mv.crouch ? B.DOWN : 0;
    var btn = this.btnFor(key);
    out.push(crouch | btn, crouch | btn, crouch);
    for (var i = 0; i < 6; i++) out.push(0);
    return out;
  };
  AIController.prototype.throwScript = function (fwd) {
    return [B.THROW, B.THROW, 0, 0, 0, 0];
  };
  AIController.prototype.punishScript = function (M, dist) {
    var me = M.fighters[this.idx], fr = me.frames;
    if (dist < 110 && fr.st_hp) return this.attackScript(M, 'st_hp', 0);
    if (fr.st_hk) return this.attackScript(M, 'st_hk', 0);
    return this.attackScript(M, 'st_lp', 0);
  };
  AIController.prototype.antiAirMove = function (M) {
    var me = M.fighters[this.idx], fr = me.frames;
    for (var k in fr) if ((fr[k].properties || []).indexOf('antiair') >= 0) return k;
    return 'cr_hp';
  };
  AIController.prototype.projectileKey = function (M) {
    var me = M.fighters[this.idx], fr = me.frames;
    for (var k in fr) if ((fr[k].properties || []).indexOf('projectile') >= 0 && fr[k].key !== 'super') return k;
    return null;
  };
  AIController.prototype.pokeSpecial = function (M) {
    var me = M.fighters[this.idx], fr = me.frames, best = null, bestR = 0;
    for (var k in fr) {
      var mv = fr[k];
      if (mv.key !== 'special' || mv.airOnly) continue;
      if ((mv.properties || []).indexOf('grab') >= 0) continue;   // 投技不用于中距离牵制
      var rr = reach(mv);
      if (rr > bestR) { bestR = rr; best = k; }
    }
    return best;
  };
  AIController.prototype.grabSpecial = function (M) {
    var fr = M.fighters[this.idx].frames;
    for (var k in fr) if (fr[k].key === 'special' && (fr[k].properties || []).indexOf('grab') >= 0) return k;
    return null;
  };
  /* §9.3 combo_depth 是区间（如专家 5~7 段），在同一档内浮动更像人 */
  AIController.prototype.comboDepth = function () {
    var d = this.p.combo_depth;
    if (d >= 5) return 5 + Math.floor(this.rand() * 3);
    return Math.max(1, d);
  };
  AIController.prototype.superKey = function (M) {
    var me = M.fighters[this.idx], fr = me.frames;
    for (var k in fr) if (fr[k].key === 'super') return k;
    return null;
  };
  AIController.prototype.specialOrNormal = function (M, key, fwd) {
    var me = M.fighters[this.idx], mv = me.frames[key];
    if (mv && mv.motion) return motionScript(mv.motion, B.HP, me.facing);
    return this.attackScript(M, key || 'cr_hp', fwd);
  };

  FN.AIController = AIController;
})(window.FN);
