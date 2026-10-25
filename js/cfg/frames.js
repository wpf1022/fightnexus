/* =============================================================
 * FightNexus · cfg_move.js  （PRD §8.3 帧数据 Schema / §8.4 基准帧表）
 * 唯一真源：策划配表 · 引擎读取 · 训练面板 · 社区查表 共用这一份
 * 字段：move_id / char_id / move_name / input / startup / active /
 *      recovery / damage / hitstun / blockstun / hit_advantage /
 *      block_advantage / hit_level / cancel_window / invuln_window /
 *      meter_gain / hitbox / hurtbox_modifier / pushback / hit_effect / properties
 * 所有角色以 Kael 为基线，普通技允许 ±2 帧浮动（BT-5 / BT-6）
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  function M(o) { return o; }

  /* ---------- 通用普通技生成器（基线 = Kael §8.4 表 8-4）---------- */
  function normals(o) {
    var st = o.st || 0, dm = o.dmg || 1, rc = o.rec || 0, rch = o.reach || 1;
    var W = function (w) { return Math.round(w * rch); };
    return {
      st_lp: M({
        move_id: o.id + '_st_lp', move_name: '站立轻拳', input: '5LP', key: 'LP',
        startup: 4 + st, active: 3, recovery: 7 + rc, damage: Math.round(40 * dm),
        hitstun: 12, blockstun: 8, hit_advantage: 3, block_advantage: -1,
        hit_level: 'high', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 28, y: -132, w: W(78), h: 30 }, pushback: 6,
        hit_effect: 'none', properties: ['cancelable', 'selfchain'],
        sfx: 'light', anim: [[0, 'idle'], [Math.max(1, 2 + st), 'jabWind'], [4 + st, 'jabHit'], [7 + st, 'jabHit'], [8 + st, 'idle']]
      }),
      st_hp: M({
        move_id: o.id + '_st_hp', move_name: '站立重拳', input: '5HP', key: 'HP',
        startup: 9 + st, active: 4, recovery: 18 + rc, damage: Math.round(90 * dm),
        hitstun: 28, blockstun: 15, hit_advantage: 7, block_advantage: -6,
        hit_level: 'high', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 32, y: -128, w: W(98), h: 38 }, pushback: 12,
        hit_effect: 'none', properties: ['cancelable'],
        sfx: 'heavy', anim: [[0, 'idle'], [3, 'heavyWind'], [9 + st, 'heavyHit'], [13 + st, 'heavyHit'], [16 + st, 'idle']]
      }),
      st_lk: M({
        move_id: o.id + '_st_lk', move_name: '站立轻脚', input: '5LK', key: 'LK',
        startup: 5 + st, active: 3, recovery: 8 + rc, damage: Math.round(35 * dm),
        hitstun: 12, blockstun: 8, hit_advantage: 2, block_advantage: -2,
        hit_level: 'high', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 32, y: -80, w: W(86), h: 30 }, pushback: 7,
        hit_effect: 'none', properties: ['cancelable'],
        sfx: 'light', anim: [[0, 'idle'], [2, 'kickWind'], [5 + st, 'kickHit'], [8 + st, 'kickHit'], [10 + st, 'idle']]
      }),
      st_hk: M({
        move_id: o.id + '_st_hk', move_name: '站立重脚', input: '5HK', key: 'HK',
        startup: 11 + st, active: 5, recovery: 20 + rc, damage: Math.round(85 * dm),
        hitstun: 26, blockstun: 16, hit_advantage: 4, block_advantage: -8,
        hit_level: 'high', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 36, y: -118, w: W(108), h: 42 }, pushback: 14,
        hit_effect: 'none', properties: ['cancelable'],
        sfx: 'heavy', anim: [[0, 'idle'], [4, 'kickWind'], [11 + st, 'kickHit'], [16 + st, 'kickHit'], [22 + st, 'idle']]
      }),
      cr_lp: M({
        move_id: o.id + '_cr_lp', move_name: '蹲轻拳', input: '2LP', key: 'LP', crouch: true,
        startup: 4 + st, active: 3, recovery: 6 + rc, damage: Math.round(30 * dm),
        hitstun: 12, blockstun: 8, hit_advantage: 4, block_advantage: 0,
        hit_level: 'high', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 28, y: -88, w: W(72), h: 28 }, pushback: 6,
        hit_effect: 'none', properties: ['cancelable', 'selfchain', 'lowprofile'],
        sfx: 'light', anim: [[0, 'crouch'], [2, 'crouchJabWind'], [4 + st, 'crouchJabHit'], [7 + st, 'crouchJabHit'], [9 + st, 'crouch']]
      }),
      cr_hp: M({
        move_id: o.id + '_cr_hp', move_name: '蹲重拳', input: '2HP', key: 'HP', crouch: true,
        startup: 8 + st, active: 4, recovery: 22 + rc, damage: Math.round(80 * dm),
        hitstun: 40, blockstun: 15, hit_advantage: 0, block_advantage: -10,
        hit_level: 'high', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 18, y: -166, w: W(82), h: 100 }, pushback: 10,
        hit_effect: 'launch', properties: ['cancelable', 'antiair'],
        sfx: 'heavy', anim: [[0, 'crouch'], [3, 'antiAirWind'], [8 + st, 'antiAirHit'], [12 + st, 'antiAirHit'], [20 + st, 'crouch']]
      }),
      cr_lk: M({
        move_id: o.id + '_cr_lk', move_name: '蹲轻脚', input: '2LK', key: 'LK', crouch: true,
        startup: 4 + st, active: 3, recovery: 6 + rc, damage: Math.round(28 * dm),
        hitstun: 11, blockstun: 7, hit_advantage: 3, block_advantage: -1,
        hit_level: 'low', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 30, y: -40, w: W(76), h: 26 }, pushback: 5,
        hit_effect: 'none', properties: ['cancelable', 'lowprofile'],
        sfx: 'light', anim: [[0, 'crouch'], [2, 'crouch'], [4 + st, 'lowKickHit'], [7 + st, 'lowKickHit'], [9 + st, 'crouch']]
      }),
      cr_hk: M({
        move_id: o.id + '_cr_hk', move_name: '蹲重脚', input: '2HK', key: 'HK', crouch: true,
        startup: 10 + st, active: 4, recovery: 24 + rc, damage: Math.round(75 * dm),
        hitstun: 30, blockstun: 15, hit_advantage: 0, block_advantage: -12,
        hit_level: 'low', cancel_window: [0, 8], meter_gain: 45,
        hitbox: { x: 34, y: -34, w: W(118), h: 28 }, pushback: 16,
        hit_effect: 'knockdown', properties: ['cancelable'],
        sfx: 'heavy', anim: [[0, 'crouch'], [4, 'sweepWind'], [10 + st, 'sweepHit'], [14 + st, 'sweepHit'], [24 + st, 'crouch']]
      }),
      jp_lp: M({
        move_id: o.id + '_jp_lp', move_name: '跳轻拳', input: '8LP', key: 'LP', air: true,
        startup: 5 + st, active: 5, recovery: 6, damage: Math.round(45 * dm),
        hitstun: 18, blockstun: 12, hit_advantage: 6, block_advantage: 2,
        hit_level: 'high', cancel_window: [0, 0], meter_gain: 45,
        hitbox: { x: 24, y: -96, w: W(76), h: 36 }, pushback: 4,
        hit_effect: 'none', properties: ['airborne_ok'],
        sfx: 'light', anim: [[0, 'jump'], [3, 'jumpAtkWind'], [5 + st, 'jumpAtkHit'], [10 + st, 'jumpAtkHit'], [13 + st, 'jump']]
      }),
      jp_hp: M({
        move_id: o.id + '_jp_hp', move_name: '跳重拳', input: '8HP', key: 'HP', air: true,
        startup: 8 + st, active: 5, recovery: 8, damage: Math.round(70 * dm),
        hitstun: 20, blockstun: 14, hit_advantage: 8, block_advantage: 3,
        hit_level: 'high', cancel_window: [0, 0], meter_gain: 45,
        hitbox: { x: 28, y: -92, w: W(90), h: 42 }, pushback: 6,
        hit_effect: 'none', properties: ['airborne_ok'],
        sfx: 'heavy', anim: [[0, 'jump'], [4, 'jumpAtkWindH'], [8 + st, 'jumpAtkHit'], [13 + st, 'jumpAtkHit'], [17 + st, 'jump']]
      }),
      throw: M({
        move_id: o.id + '_throw', move_name: '投技', input: 'LP+LK', key: 'THROW',
        startup: 3, active: 2, recovery: 20, damage: 120,
        hitstun: 44, blockstun: 0, hit_advantage: 0, block_advantage: 0,
        hit_level: 'throw', cancel_window: [0, 0], meter_gain: 45,
        hitbox: { x: 0, y: -100, w: 48, h: 120 }, pushback: 30,
        hit_effect: 'knockdown', properties: ['grab'],
        sfx: 'throw', anim: [[0, 'idle'], [1, 'throwPose'], [3, 'throwPose'], [6, 'throwPoseExt'], [14, 'idle']]
      })
    };
  }

  /* ---------------- Kael：均衡（基线） ---------------- */
  var kael = normals({ id: 'kael', st: 0, dmg: 1.0, rec: 0, reach: 1.0 });
  kael.fireball = M({
    move_id: 'kael_fireball', move_name: '波动弹', input: '236+P', key: 'special', motion: '236',
    startup: 14, active: 2, recovery: 38, damage: 120,
    hitstun: 40, blockstun: 15, hit_advantage: 0, block_advantage: -4,
    hit_level: 'mid', cancel_window: [0, 0], meter_gain: 45,
    hitbox: { x: 40, y: -110, w: 60, h: 40 }, pushback: 14,
    hit_effect: 'knockdown', properties: ['projectile', 'cancelable'],
    projectile: { frame: 14, vx: 7.6, y: -112, life: 200, w: 52, h: 42, hp: 1 },
    sfx: 'special',
    anim: [[0, 'idle'], [5, 'projWind'], [11, 'projWind'], [14, 'projHit'], [18, 'projHit'], [34, 'idle']]
  });
  kael.dp = M({
    move_id: 'kael_dp', move_name: '升龙', input: '623+P', key: 'special', motion: '623',
    startup: 6, active: 8, recovery: 34, damage: 140,
    hitstun: 44, blockstun: 13, hit_advantage: 0, block_advantage: -28,
    hit_level: 'mid', cancel_window: [0, 0], invuln_window: [0, 7], meter_gain: 45,
    hitbox: { x: 18, y: -172, w: 86, h: 116 }, pushback: 18,
    hit_effect: 'launch', properties: ['invincible', 'reversal', 'antiair'],
    launcher: true, rise: 13.5,
    sfx: 'special',
    anim: [[0, 'crouch'], [3, 'dpWind'], [6, 'dpHit'], [11, 'dpHit'], [20, 'dpFall'], [34, 'crouch']]
  });
  kael.super = M({
    move_id: 'kael_super', move_name: '连打冲击波', input: '236236+P', key: 'super', motion: '236236',
    startup: 10, active: 12, recovery: 40, damage: 300,
    hitstun: 50, blockstun: 20, hit_advantage: 0, block_advantage: -18,
    hit_level: 'mid', cancel_window: [0, 0], invuln_window: [0, 9], meter_gain: 0,
    hitbox: { x: 30, y: -150, w: 640, h: 170 }, pushback: 20,
    hit_effect: 'launch', properties: ['projectile', 'super', 'cinematic'],
    multiHit: { count: 6, interval: 2, damage: 50, effect: 'none' },
    projectile: { frame: 10, vx: 11, y: -120, life: 120, w: 300, h: 150, hp: 99 },
    meterCost: 100, superArt: 'beam',
    sfx: 'super',
    anim: [[0, 'idle'], [4, 'superWind'], [10, 'superHit'], [22, 'superHit'], [40, 'idle']]
  });

  /* ---------------- Rina：突进压制 ---------------- */
  var rina = normals({ id: 'rina', st: -1, dmg: 0.92, rec: -1, reach: 0.95 });
  rina.rush = M({
    move_id: 'rina_rush', move_name: '突进撞击', input: '214+P', key: 'special', motion: '214',
    startup: 11, active: 10, recovery: 26, damage: 100,
    hitstun: 32, blockstun: 15, hit_advantage: 0, block_advantage: -6,
    hit_level: 'mid', cancel_window: [0, 0], meter_gain: 45,
    hitbox: { x: 32, y: -124, w: 112, h: 76 }, pushback: 16,
    hit_effect: 'knockdown', properties: ['cancelable', 'advance'],
    dash: 7.2,
    sfx: 'special',
    anim: [[0, 'idle'], [4, 'rushWind'], [11, 'rushHit'], [20, 'rushHit'], [30, 'idle']]
  });
  rina.airspin = M({
    move_id: 'rina_airspin', move_name: '空中旋风脚', input: '(空)214+K', key: 'special', motion: '214',
    startup: 7, active: 14, recovery: 12, damage: 95,
    hitstun: 30, blockstun: 14, hit_advantage: 0, block_advantage: -8,
    hit_level: 'high', cancel_window: [0, 0], invuln_window: [2, 9], meter_gain: 45,
    hitbox: { x: 0, y: -108, w: 96, h: 96 }, pushback: 12,
    hit_effect: 'none', properties: ['airborne_ok', 'reversal', 'antiair', 'invincible'],
    airOnly: true, spin: 720, hover: true,
    sfx: 'special',
    anim: [[0, 'jumpTuck'], [7, 'spin'], [21, 'spin'], [30, 'jump']]
  });
  rina.super = M({
    move_id: 'rina_super', move_name: '百裂突', input: '214214+P', key: 'super', motion: '214214',
    startup: 8, active: 26, recovery: 38, damage: 300,
    hitstun: 48, blockstun: 22, hit_advantage: 0, block_advantage: -14,
    hit_level: 'mid', cancel_window: [0, 0], invuln_window: [0, 7], meter_gain: 0,
    hitbox: { x: 30, y: -130, w: 130, h: 100 }, pushback: 10,
    hit_effect: 'launch', properties: ['super', 'cinematic', 'advance'],
    multiHit: { count: 12, interval: 2, damage: 25, effect: 'none' },
    dash: 5.2, meterCost: 100, superArt: 'rush',
    sfx: 'super',
    anim: [[0, 'idle'], [4, 'superWind'], [8, 'superRush'], [32, 'superRush'], [46, 'idle']]
  });

  /* ---------------- Goro：重型投技 ---------------- */
  var goro = normals({ id: 'goro', st: 1, dmg: 1.15, rec: 2, reach: 1.12 });
  goro.throw.damage = 150;                 // 投技威胁是 Goro 的核心
  goro.st_lp.startup = 5; goro.cr_lp.startup = 5; goro.cr_lk.startup = 5;  // BT-5：极差 ≤ 2
  goro.st_hp.startup = 11; goro.st_hk.startup = 13; goro.cr_hp.startup = 10; goro.cr_hk.startup = 12;
  goro.cmdgrab = M({
    move_id: 'goro_cmdgrab', move_name: '指令投', input: '360+P', key: 'special', motion: '360',
    startup: 5, active: 3, recovery: 30, damage: 180,
    hitstun: 48, blockstun: 0, hit_advantage: 0, block_advantage: 0,
    hit_level: 'throw', cancel_window: [0, 0], meter_gain: 45,
    hitbox: { x: 0, y: -110, w: 62, h: 130 }, pushback: 34,
    hit_effect: 'knockdown', properties: ['grab', 'command'],
    sfx: 'throw',
    anim: [[0, 'idle'], [2, 'grabWind'], [5, 'grabHit'], [10, 'grabHit'], [24, 'idle']]
  });
  goro.smash = M({
    move_id: 'goro_smash', move_name: '猛砸', input: '623+P', key: 'special', motion: '623',
    startup: 13, active: 6, recovery: 32, damage: 155,
    hitstun: 40, blockstun: 16, hit_advantage: 0, block_advantage: -10,
    hit_level: 'mid', cancel_window: [0, 0], meter_gain: 45,
    hitbox: { x: 26, y: -150, w: 108, h: 96 }, pushback: 22,
    hit_effect: 'knockdown', properties: ['armor', 'antiair'],
    armorFrom: 4, armorTo: 16, armorMax: 1,
    sfx: 'special',
    anim: [[0, 'idle'], [6, 'smashWind'], [13, 'smashHit'], [19, 'smashHit'], [34, 'idle']]
  });
  goro.burst = M({
    move_id: 'goro_burst', move_name: '爆发反击', input: '214+P', key: 'special', motion: '214',
    startup: 9, active: 6, recovery: 30, damage: 130,
    hitstun: 38, blockstun: 14, hit_advantage: 0, block_advantage: -22,
    hit_level: 'mid', cancel_window: [0, 0], invuln_window: [0, 4], meter_gain: 45,
    hitbox: { x: 22, y: -128, w: 96, h: 96 }, pushback: 20,
    hit_effect: 'launch', properties: ['invincible', 'reversal'],
    meterCost: 100,
    sfx: 'special',
    anim: [[0, 'idle'], [4, 'burstWind'], [9, 'burstHit'], [15, 'burstHit'], [30, 'idle']]
  });
  goro.super = M({
    move_id: 'goro_super', move_name: '天地投', input: '360360+P', key: 'super', motion: '360360',
    startup: 8, active: 4, recovery: 42, damage: 320,
    hitstun: 52, blockstun: 0, hit_advantage: 0, block_advantage: 0,
    hit_level: 'throw', cancel_window: [0, 0], invuln_window: [0, 7], meter_gain: 0,
    hitbox: { x: 0, y: -120, w: 76, h: 140 }, pushback: 40,
    hit_effect: 'knockdown', properties: ['grab', 'super', 'cinematic'],
    meterCost: 100, superArt: 'grab',
    sfx: 'super',
    anim: [[0, 'idle'], [3, 'grabWind'], [8, 'grabHit'], [16, 'grabSlam'], [34, 'idle']]
  });

  FN.FRAMES = { kael: kael, rina: rina, goro: goro };

  /* 指令 → 招式 映射（供指令解析与教学提示共用） */
  FN.MOTION_TABLE = {
    kael: { '236': 'fireball', '623': 'dp', '236236': 'super' },
    rina: { '214': 'rush', '214K': 'airspin', '214214': 'super' },
    goro: { '360': 'cmdgrab', '623': 'smash', '214': 'burst', '360360': 'super' }
  };

  /* 招式名 i18n */
  FN.MOVE_I18N = {};
  (function () {
    for (var c in FN.FRAMES) {
      var t = FN.FRAMES[c]; FN.MOVE_I18N[c] = {};
      for (var m in t) FN.MOVE_I18N[c][m] = { zh: t[m].move_name, en: m };
    }
  })();
})(window.FN);
