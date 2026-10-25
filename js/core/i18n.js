/* =============================================================
 * FightNexus · i18n.js   （§12.4 所有显示文本走 i18n key，禁止硬编码）
 * R1.0：简体中文 + English；架构预留日/繁中/西语
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  var DICT = {
    zh: {
      'title.tag': '轻量的正统格斗 · 90 秒学会，一辈子练不完',
      'menu.versus': '对战', 'menu.training': '训练', 'menu.settings': '设置', 'menu.about': '关于',
      'mode.title': '选择模式', 'mode.vs_ai': '人机对战', 'mode.local': '本地双人', 'mode.train': '训练模式',
      'mode.online': '在线对战', 'mode.online.soon': '敬请期待',
      'diff.casual': '轻松', 'diff.standard': '标准', 'diff.expert': '专家',
      'sel.title': '选择角色', 'sel.novice': '新手首选', 'sel.p1': 'P1', 'sel.p2': 'P2',
      'sel.confirm': '确认', 'sel.back': '返回', 'sel.blocked': '不可选：双方不能选同一角色',
      'sel.p2join': 'P2 按下任意键加入',
      'hud.round': 'ROUND', 'hud.fight': 'FIGHT!', 'hud.ko': 'K.O.', 'hud.time': 'TIME UP',
      'hud.draw': 'DRAW', 'hud.doubleko': 'DOUBLE K.O.', 'hud.perfect': 'PERFECT',
      'res.title_win': '胜利', 'res.title_lose': '败北', 'res.title_draw': '平局',
      'res.best': '最佳瞬间', 'res.newrec': '新纪录', 'res.records': '本次做到',
      'res.stats': '数据', 'res.coach': '教练建议', 'res.again': '再来一局', 'res.share': '分享高光',
      'res.resel': '返回选人', 'res.menu': '返回主菜单',
      'stat.hits': '命中', 'stat.taken': '被命中', 'stat.punish': '确反', 'stat.super': '超必杀', 'stat.combo': '最长连段',
      'set.title': '设置', 'set.audio': '音频', 'set.display': '显示', 'set.control': '操作',
      'set.battle': '战斗', 'set.a11y': '无障碍', 'set.data': '数据',
      'set.bgm': 'BGM 音量', 'set.sfx': '音效音量', 'set.hitsfx': '打击音效强度',
      'set.mute': '静音', 'set.fps': '帧率显示', 'set.quality': '画质',
      'set.shake': '震屏强度', 'set.flash': '闪白效果（光敏保护）',
      'set.scheme': '输入档位', 'set.keymap': '键位映射', 'set.buffer': '缓冲窗口',
      'set.difficulty': '默认难度', 'set.dynamic': '动态难度', 'set.coach': '教练系统',
      'set.hitbox': 'Hitbox 可视化',
      'set.color': '色觉模式', 'set.font': '字体缩放', 'set.sub': '字幕开关', 'set.keyhint': '按键提示常显',
      'set.privacy': '隐私说明', 'set.wipe': '清除本地数据', 'set.lang': '语言',
      'set.fair': '三档共享同一套帧数据与伤害，差异仅在输入方式',
      'train.title': '训练模式', 'train.reset': '复位', 'train.infhp': '无限血量', 'train.infmeter': '无限能量',
      'train.ai': 'AI 行为', 'train.ai.stand': '静止', 'train.ai.block': '防御', 'train.ai.counter': '反击', 'train.ai.random': '随机',
      'train.cards': '练习卡', 'train.frame': '帧数据面板', 'train.hint': 'Tab 呼出 / 收起菜单（战斗不暂停）',
      'pause.title': '暂停', 'pause.resume': '继续', 'pause.surrender': '投降', 'pause.restart': '重开本局', 'pause.quit': '退出',
      'about.fair': '公平性契约', 'about.growth': '我的成长', 'about.ver': '版本',
      'ftue.skip': '跳过引导', 'fight': 'FIGHT!',
      'coach.punish': '确反机会！', 'coach.antiair': '防空！',
      'share.title': '分享高光', 'share.copy': '复制链接', 'share.download': '下载片段', 'share.card': '战绩卡片',
      'share.qr': '二维码', 'share.native': '系统分享',
      'ach.title': '成就', 'ach.locked': '未解锁', 'growth.title': '能力趋势',
      'growth.special': '必杀输入成功率', 'growth.combo': '最长连段', 'growth.block': '防御成功率',
      'growth.tech': '拆投成功率', 'growth.punish': '确反成功率',
      'cancel': '取消', 'ok': '确定', 'close': '关闭', 'reset': '重置', 'apply': '应用',
      'press_any': '按任意键加入'
    },
    en: {
      'title.tag': 'Lightweight orthodox fighting · 90 seconds to learn, a lifetime to master',
      'menu.versus': 'VERSUS', 'menu.training': 'TRAINING', 'menu.settings': 'SETTINGS', 'menu.about': 'ABOUT',
      'mode.title': 'Select Mode', 'mode.vs_ai': 'VS CPU', 'mode.local': 'LOCAL 2P', 'mode.train': 'TRAINING',
      'mode.online': 'ONLINE', 'mode.online.soon': 'Coming Soon',
      'diff.casual': 'Casual', 'diff.standard': 'Standard', 'diff.expert': 'Expert',
      'sel.title': 'Select Fighter', 'sel.novice': 'RECOMMENDED', 'sel.p1': 'P1', 'sel.p2': 'P2',
      'sel.confirm': 'Confirm', 'sel.back': 'Back', 'sel.blocked': 'Locked: mirror match disabled',
      'sel.p2join': 'P2 press any key to join',
      'hud.round': 'ROUND', 'hud.fight': 'FIGHT!', 'hud.ko': 'K.O.', 'hud.time': 'TIME UP',
      'hud.draw': 'DRAW', 'hud.doubleko': 'DOUBLE K.O.', 'hud.perfect': 'PERFECT',
      'res.title_win': 'WIN', 'res.title_lose': 'LOSE', 'res.title_draw': 'DRAW',
      'res.best': 'Best Moment', 'res.newrec': 'NEW RECORD', 'res.records': 'You did',
      'res.stats': 'Stats', 'res.coach': 'Coach', 'res.again': 'REMATCH', 'res.share': 'SHARE',
      'res.resel': 'RESELECT', 'res.menu': 'MENU',
      'stat.hits': 'Hits', 'stat.taken': 'Taken', 'stat.punish': 'Punish', 'stat.super': 'Super', 'stat.combo': 'Max Combo',
      'set.title': 'Settings', 'set.audio': 'Audio', 'set.display': 'Display', 'set.control': 'Controls',
      'set.battle': 'Battle', 'set.a11y': 'Accessibility', 'set.data': 'Data',
      'set.bgm': 'BGM', 'set.sfx': 'SFX', 'set.hitsfx': 'Impact SFX',
      'set.mute': 'Mute', 'set.fps': 'FPS', 'set.quality': 'Quality',
      'set.shake': 'Screen Shake', 'set.flash': 'Flash FX (photosensitivity)',
      'set.scheme': 'Input Scheme', 'set.keymap': 'Key Mapping', 'set.buffer': 'Buffer',
      'set.difficulty': 'Difficulty', 'set.dynamic': 'Dynamic Difficulty', 'set.coach': 'Coach',
      'set.hitbox': 'Hitbox View',
      'set.color': 'Color Mode', 'set.font': 'Font Scale', 'set.sub': 'Subtitles', 'set.keyhint': 'Always show key hints',
      'set.privacy': 'Privacy', 'set.wipe': 'Clear local data', 'set.lang': 'Language',
      'set.fair': 'All three schemes share identical frame data and damage. Only the input mapping differs.',
      'train.title': 'Training', 'train.reset': 'Reset', 'train.infhp': 'Infinite HP', 'train.infmeter': 'Infinite Meter',
      'train.ai': 'AI Behavior', 'train.ai.stand': 'Idle', 'train.ai.block': 'Block', 'train.ai.counter': 'Counter', 'train.ai.random': 'Random',
      'train.cards': 'Practice Cards', 'train.frame': 'Frame Data', 'train.hint': 'Tab to toggle (battle keeps running)',
      'pause.title': 'PAUSED', 'pause.resume': 'Resume', 'pause.surrender': 'Surrender', 'pause.restart': 'Restart', 'pause.quit': 'Quit',
      'about.fair': 'Fairness Contract', 'about.growth': 'My Progress', 'about.ver': 'Version',
      'ftue.skip': 'Skip tutorial', 'fight': 'FIGHT!',
      'coach.punish': 'PUNISH!', 'coach.antiair': 'ANTI-AIR!',
      'share.title': 'Share Highlight', 'share.copy': 'Copy Link', 'share.download': 'Download Clip', 'share.card': 'Result Card',
      'share.qr': 'QR', 'share.native': 'Share',
      'ach.title': 'Achievements', 'ach.locked': 'Locked', 'growth.title': 'Skill Trend',
      'growth.special': 'Special input success', 'growth.combo': 'Longest combo', 'growth.block': 'Block rate',
      'growth.tech': 'Throw tech rate', 'growth.punish': 'Punish rate',
      'cancel': 'Cancel', 'ok': 'OK', 'close': 'Close', 'reset': 'Reset', 'apply': 'Apply',
      'press_any': 'Press any key to join'
    }
  };

  FN.I18N = {
    lang: 'zh',
    dict: DICT,
    setLang: function (l) { if (DICT[l]) this.lang = l; },
    t: function (k, fallback) {
      var d = DICT[this.lang] || DICT.zh;
      if (d[k] != null) return d[k];
      return DICT.zh[k] != null ? DICT.zh[k] : (fallback != null ? fallback : k);
    },
    /* 招式名走配置表，同一 key 供帧数据面板与社区查表使用 */
    moveName: function (charId, moveKey) {
      var m = FN.MOVE_I18N && FN.MOVE_I18N[charId] && FN.MOVE_I18N[charId][moveKey];
      if (!m) return moveKey;
      return this.lang === 'en' ? (FN.FRAMES[charId][moveKey].en || moveKey) : m.zh;
    }
  };
})(window.FN);
