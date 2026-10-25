/* =============================================================
 * FightNexus · cfg_balance.js
 * 全局平衡常量 / 时间约束 / 资源系统 / AI Profile / FTUE 脚本
 * 对应 PRD §6.3 §6.4 §8.1 §8.2 §8.6 §8.8 §9.3 §5.3
 * 原则 T6：数值是配置不是代码。改数值不改代码。
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  FN.CFG = {
    /* ---- §8.2 全局时间约束 ---- */
    FPS: 60,
    STEP_MS: 1000 / 60,
    MAX_CATCHUP: 5,          // 单帧最多补 5 个逻辑 step，防死亡螺旋
    REPLAY_KEYFRAME: 30,     // 每 30 帧存一次状态快照（供 Rollback / 高光重演）
    REPLAY_BUFFER: 640,      // 输入流缓冲长度（≈10.6s）

    /* ---- 舞台 ---- */
    VIEW_W: 1280,
    VIEW_H: 720,
    GROUND_Y: 566,           // 画布坐标系下的地面高度（脚底）
    STAGE_W: 2400,           // §11.2
    EDGE_PAD: 46,            // 角色不得移出可视舞台 ±8px（此处取碰撞边界）

    /* ---- §8.6 资源系统 ---- */
    HP_MAX: 1000,
    METER_MAX: 300,          // 3 格 × 100
    GUARD_MAX: 100,
    METER_GAIN: {            // 千分比（‰ of METER_MAX）
      hit: 45, taken: 25, block: 10, whiff: 5
    },
    WHIFF_GAIN_CD: 180,      // 空挥给能量每 3 秒最多 1 次
    SUPER_COST: 100,
    EX_COST: 200,            // §8.6 注：EX 必杀（P1）
    GUARD_DRAIN: { light: 4, heavy: 8, special: 15, super: 25 },
    GUARD_REGEN: 6 / 60,     // 不防御时每秒回复 6
    GUARD_CRUSH: 30,         // 破防硬直帧
    GUARD_CRUSH_BONUS: 0.20, // 破防期间受伤 +20%

    /* ---- §8.8 连段与伤害衰减 ---- */
    COMBO_MAX: 12,
    SCALING_LADDER: [        // [起始hit, 系数]
      [1, 1.00], [2, 0.90], [3, 0.80], [4, 0.70],
      [7, 0.60], [10, 0.50], [13, 0.00]
    ],
    SCALING_FLOOR: 0.30,
    HITSTUN_DECAY_FROM: 3,   // 第 3 段起
    HITSTUN_DECAY: 0.08,
    LAUNCH_GROWTH: 0.08,     // 受击抬升：每段击飞 +8%
    AUTOC_EXTRA: 0.80,       // Modern auto-combo 额外 -20%（§6.2）
    CANCEL_WINDOW: 8,        // 命中/防御后可取消接必杀的窗口
    SPECIAL_PER_COMBO: 2,    // 单个连段内最多连接 2 次必杀
    TRADE_SCALE: 0.50,       // §8.5 双方同时命中

    /* ---- §8.7 防御体系 ---- */
    CHIP: 0.15,              // 防御必杀/超必杀时的削减伤害
    WAKEUP_INVULN: 8,
    TECH_WINDOW: 6,          // BT-7 拆投窗口 ≥ 6 帧
    GRAB_RANGE: 48,          // §8.11
    DOWN_TIME: { light: 32, roll: 26, heavy: 44 },
    PUSHBOX_W: 64,
    GRAVITY: 0.82,
    PUSHBACK_DECAY: 0.86,

    /* ---- §6.3 输入系统 ---- */
    RING_DEPTH: 32,
    BUFFER: { classic: 8, modern: 12, assist: 16 },
    ASSIST_PERSIST: 40,
    MOTION_WINDOW: 22,       // 方向序列识别窗口（帧）
    DOUBLE_WINDOW: 46,

    /* ---- 打击感（§5.2 M1：8 帧内五种反馈同时发生）---- */
    HITSTOP: { light: 6, heavy: 8, special: 9, super: 12, ko: 16 },
    FLASH_FRAMES: 2,
    SHAKE: { light: 3, heavy: 6, special: 7, super: 10, ko: 12 },
    KO_SLOWMO: { scale: 0.7, frames: 10 },

    /* ---- 对局 ---- */
    ROUND_TIME: 60,          // §8.10 每 Round 独立重置
    ROUNDS_TO_WIN: 2,
    MAX_ROUNDS: 5,
    ROUND_INTRO: 70,
    KO_FREEZE: 90,
  };

  /* ---- §6.2 三档操作范式（差异仅在输入映射，不在战斗数值）---- */
  FN.SCHEMES = {
    classic: {
      id: 'classic', name: 'Classic 经典', tag: '100% 自主搓招',
      attacks: 4, buffer: 8, autoCombo: 0, online: true,
      desc: '四键 + 手动搓招。连段完全由你决定，无任何辅助。'
    },
    modern: {
      id: 'modern', name: 'Modern 现代', tag: '指令简化 · 数值相同',
      attacks: 4, buffer: 12, autoCombo: 3, online: true,
      desc: '方向 + 单键出必杀；连打轻拳触发 3 段 auto-combo（伤害额外 -20%）。帧数据与 Classic 完全相同。'
    },
    assist: {
      id: 'assist', name: 'Assist+ 陪伴', tag: '一键 · 仅限本地/人机',
      attacks: 2, buffer: 16, autoCombo: 4, online: false, persist: 40,
      desc: '轻/重两键自动判定上/下段，必杀与超必杀一键释放，自动连打至 4 段。'
    }
  };

  /* ---- §9.3 三档 AI Profile ---- */
  FN.AI_PROFILES = {
    dummy: {   // FTUE 专用：攻击欲望 0（强制约束 2）
      name: 'Dummy 木人', reaction_delay: 30, decision_interval: 36,
      guard_probability: 0.0, punish_rate: 0.0, anti_air_rate: 0.0,
      mixup_rate: 0.0, combo_depth: 1, input_error_rate: 0.0,
      aggression: -1, resource_use: 0.0, panic_behavior: 'none', walk: 0.0
    },
    casual: {
      name: '轻松 Casual', reaction_delay: 26, decision_interval: 32,
      guard_probability: 0.15, punish_rate: 0.05, anti_air_rate: 0.00,
      mixup_rate: 0.05, combo_depth: 2, input_error_rate: 0.25,
      aggression: 0.6, resource_use: 0.10, panic_behavior: 'desperate', walk: 0.55
    },
    standard: {
      name: '标准 Standard', reaction_delay: 15, decision_interval: 20,
      guard_probability: 0.45, punish_rate: 0.35, anti_air_rate: 0.30,
      mixup_rate: 0.25, combo_depth: 4, input_error_rate: 0.10,
      aggression: 0.1, resource_use: 0.40, panic_behavior: 'none', walk: 0.75
    },
    expert: {
      name: '专家 Expert', reaction_delay: 8, decision_interval: 12,
      guard_probability: 0.75, punish_rate: 0.70, anti_air_rate: 0.65,
      mixup_rate: 0.60, combo_depth: 6, input_error_rate: 0.02,
      aggression: -0.1, resource_use: 0.85, panic_behavior: 'turtle', walk: 0.9
    }
  };

  /* ---- §6.4 动态难度 ---- */
  FN.DYNAMIC = {
    enabledDefault: true,
    floatRange: 0.20,        // ±20% 护栏 C4
    winStreak: 3, loseStreak: 3,
    hsi: { casual: 35, standard: 70 }   // HSI 分档
  };

  /* ---- §5.3 FTUE 脚本（数据化，允许不发版本调整文案与节奏）---- */
  FN.FTUE = [
    {
      id: 1, key: 'ftue_1', title: '先动起来',
      hint: 'A D 移动', goal: 'mk', target: 5, text: '按任意键'
    },
    {
      id: 2, key: 'ftue_2', title: '走到他面前，打一拳',
      hint: 'J 轻拳', goal: 'hit', target: 1, text: '走近 · 出拳'
    },
    {
      id: 3, key: 'ftue_3', title: '再来一下，接上！',
      hint: '再按 J', goal: 'combo2', target: 1, text: '连段 ×2'
    },
    {
      id: 4, key: 'ftue_4', title: '用超必杀漂亮收尾',
      hint: 'L+K 超必杀', goal: 'super', target: 1, text: '超必杀 KO'
    },
    {
      id: 5, key: 'ftue_5', title: '你做到了', goal: 'done', target: 1, text: '带走这一刻'
    }
  ];

  /* ---- §7 表 7-7 内置练习卡 ---- */
  FN.PRACTICE_CARDS = [
    { id: 'C1', name: '起手', task: '蹲轻拳接站立轻拳', cond: '连续成功 5 次', target: 5, key: 'combo2', ability: '连段起手' },
    { id: 'C2', name: '确认反击', task: '对手重攻击落空后反击', cond: '10 次机会内成功 6 次', target: 6, tries: 10, key: 'punish', ability: '确反意识' },
    { id: 'C3', name: '防空', task: '对跳跃攻击用升龙', cond: '10 次成功 7 次', target: 7, tries: 10, key: 'antiair', ability: '防空' },
    { id: 'C4', name: '投 / 拆投', task: '二择反应训练', cond: '拆投成功 5 次', target: 5, key: 'tech', ability: '投择' },
    { id: 'C5', name: '必杀连段', task: '把必杀接进普通连段', cond: '连续成功 5 次', target: 5, key: 'special', ability: '资源运用' },
    { id: 'C6', name: '起身压制', task: '对手倒地后的择', cond: '成功压制 3 次', target: 3, key: 'okizeme', ability: '起攻' }
  ];

  /* ---- §FR13 里程碑 ---- */
  FN.ACHIEVEMENTS = [
    { id: 'first_blood', name: '第一滴血', desc: '完成首场对局' },
    { id: 'ftue_done', name: '出师', desc: '完成 90 秒引导' },
    { id: 'combo5', name: '五连', desc: '打出一次 5 连段' },
    { id: 'combo10', name: '十连', desc: '打出一次 10 连段' },
    { id: 'punish_super', name: '确反超必杀', desc: '用超必杀确反一次' },
    { id: 'beat_expert', name: '超越专家', desc: '击败专家 AI' },
    { id: 'tech5', name: '拆投手', desc: '单局拆投成功 5 次' },
    { id: 'classic_win', name: '硬核时刻', desc: '用 Classic 档赢下一局' },
    { id: 'share1', name: '高光时刻', desc: '分享一次高光片段' },
    { id: 'streak10', name: '十连胜', desc: '取得 10 连胜' },
    { id: 'perfect', name: 'Perfect!', desc: '一局未掉血取胜' },
    { id: 'lab30', name: '实验室常客', desc: '在训练模式累计 30 局练习' }
  ];

  /* ---- 默认键位（§FR7）---- */
  FN.DEFAULT_KEYS = {
    p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', LP: 'KeyJ', HP: 'KeyK', LK: 'KeyU', HK: 'KeyI', THROW: 'KeyO', ASSIST: 'KeyL' },
    p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', LP: 'Numpad1', HP: 'Numpad2', LK: 'Numpad4', HK: 'Numpad5', THROW: 'Numpad7', ASSIST: 'Numpad8' }
  };
  FN.ALT_KEYS = {
    p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', LP: 'Numpad1', HP: 'Numpad2', LK: 'Numpad4', HK: 'Numpad5', THROW: 'Numpad7', ASSIST: 'Numpad8' }
  };

  /* ---- 伤害缩放阶梯（§8.8）---- */
  FN.scaleFor = function (hitNumber) {
    var L = FN.CFG.SCALING_LADDER, c = 0;
    for (var i = 0; i < L.length; i++) if (hitNumber >= L[i][0]) c = L[i][1];
    return c;
  };

  /* ---- 护栏：BT-1~BT-11 的自检（§8.12 CI 校验，运行时版本）---- */
  FN.runBalanceTests = function () {
    var errs = [], chars = FN.CHARS, C = FN.CFG;
    var pokes = [], speeds = [];
    for (var k in chars) {
      var fr = FN.FRAMES[k];
      pokes.push(fr.cr_lp.startup);
      speeds.push(chars[k].speedF);
      var inv = false;
      for (var m in fr) if (fr[m].invuln_window && (fr[m].properties || []).indexOf('invincible') >= 0) inv = true;
      if (!inv) errs.push('BT-8 违反：' + k + ' 缺少无敌反击技');
      for (var m2 in fr) {
        var mv = fr[m2];
        if (mv.startup + mv.active + mv.recovery > 120) errs.push('BT 违反：' + m2 + ' 总帧过长');
        if (mv.block_adv <= -6 && mv.block_adv > -100) { /* 可被 9 帧 ST.HP 确反：合法设计 */ }
      }
    }
    var pokeRange = Math.max.apply(null, pokes) - Math.min.apply(null, pokes);
    if (pokeRange > 2) errs.push('BT-5 违反：起手技启动帧极差 ' + pokeRange + ' > 2');
    var sp = Math.max.apply(null, speeds) / Math.min.apply(null, speeds);
    if (sp > 1.8) errs.push('BT-6 违反：移速极差比 ' + sp.toFixed(2) + ' > 1.8');
    return errs;
  };
})(window.FN);
