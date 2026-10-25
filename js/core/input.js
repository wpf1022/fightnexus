/* =============================================================
 * FightNexus · input.js
 * §10.2 NetAbstraction：战斗逻辑不得直接读取 DOM keydown，
 *        必须经过 InputProvider（本地 / AI / Replay / Network）
 * §6.3  输入队列与缓冲规格 / 指令解析（弩马克罗数表示）
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  var B = FN.Input = {
    UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8,
    LP: 16, HP: 32, LK: 64, HK: 128, THROW: 256, ASSIST: 512,
    BTN_MASK: 16 + 32 + 64 + 128 + 256 + 512
  };
  B.ALL_BUTTONS = ['LP', 'HP', 'LK', 'HK', 'THROW', 'ASSIST'];

  /* ---------- 键盘状态（唯一读取 DOM 的地方）---------- */
  var Keyboard = FN.Keyboard = {
    down: {},
    enabled: true,
    lastAny: 0,
    init: function () {
      var self = this;
      window.addEventListener('keydown', function (e) {
        if (!self.enabled) return;
        if (e.repeat) { e.preventDefault(); return; }
        self.down[e.code] = true;
        self.lastAny = performance.now();
        if (FN.__onAnyKey) FN.__onAnyKey(e);
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) { self.down[e.code] = false; });
      window.addEventListener('blur', function () { self.down = {}; });
    },
    maskFor: function (km) {
      var m = 0, d = this.down;
      if (d[km.up]) m |= B.UP;
      if (d[km.down]) m |= B.DOWN;
      if (d[km.left]) m |= B.LEFT;
      if (d[km.right]) m |= B.RIGHT;
      if (d[km.LP]) m |= B.LP;
      if (d[km.HP]) m |= B.HP;
      if (d[km.LK]) m |= B.LK;
      if (d[km.HK]) m |= B.HK;
      if (d[km.THROW]) m |= B.THROW;
      if (d[km.ASSIST]) m |= B.ASSIST;
      return m;
    },
    anyDown: function () {
      for (var k in this.down) if (this.down[k]) return true;
      return false;
    }
  };

  /* ---------- Provider：本地 ---------- */
  function LocalProvider(keymap) { this.km = keymap; this.type = 'local'; }
  LocalProvider.prototype.next = function () { return Keyboard.maskFor(this.km); };
  LocalProvider.prototype.serialize = function () { return { type: 'local' }; };

  /* ---------- Provider：AI（与玩家走同一条输入队列，§9.4）---------- */
  function AIProvider(controller) { this.ai = controller; this.type = 'ai'; }
  AIProvider.prototype.next = function (frame, match) { return this.ai.poll(frame, match); };
  AIProvider.prototype.serialize = function () { return { type: 'ai' }; };

  /* ---------- Provider：回放（输入流 + 版本号即可完整重演）---------- */
  function ReplayProvider(log, from) { this.log = log; this.i = from || 0; this.type = 'replay'; }
  ReplayProvider.prototype.next = function () {
    var v = this.log[this.i++];
    return v == null ? 0 : v;
  };

  function NullProvider() { this.type = 'null'; }
  NullProvider.prototype.next = function () { return 0; };

  B.LocalProvider = LocalProvider; B.AIProvider = AIProvider;
  B.ReplayProvider = ReplayProvider; B.NullProvider = NullProvider;

  /* ---------- 方向 → 弩马克罗数（含面向修正）---------- */
  B.numpad = function (mask, facing) {
    var r = (mask & B.RIGHT) ? 1 : 0, l = (mask & B.LEFT) ? 1 : 0;
    var u = (mask & B.UP) ? 1 : 0, d = (mask & B.DOWN) ? 1 : 0;
    var x = facing > 0 ? (r ? 1 : (l ? -1 : 0)) : (l ? 1 : (r ? -1 : 0));
    var y = u ? -1 : (d ? 1 : 0);
    return 5 + x - 3 * y;
  };
  B.dirX = function (mask, facing) {
    var r = (mask & B.RIGHT) ? 1 : 0, l = (mask & B.LEFT) ? 1 : 0;
    return facing > 0 ? (r - l) : (l - r);
  };
  B.holdsDown = function (mask) { return (mask & B.DOWN) ? 1 : 0; };
  B.holdsUp = function (mask) { return (mask & B.UP) ? 1 : 0; };

  /* ---------- 指令（motion）识别 ---------- */
  var MOTION_SEQ = {
    '236': [[2, 3, 6], [2, 6]],
    '623': [[6, 2, 3], [6, 2, 6]],
    '214': [[2, 1, 4], [2, 4]],
    '236236': [[2, 3, 6, 2, 3, 6], [2, 6, 2, 6]],
    '214214': [[2, 1, 4, 2, 1, 4], [2, 4, 2, 4]],
    '360': [[4, 2, 6, 8], [6, 2, 4, 8], [4, 1, 2, 3, 6], [6, 3, 2, 1, 4]],
    '360360': [[4, 2, 6, 8, 4, 2, 6, 8], [6, 2, 4, 8, 6, 2, 4, 8]]
  };
  var MOTION_ORDER = ['360360', '236236', '214214', '360', '623', '236', '214'];

  function endsWith(seq, pat) {
    if (seq.length < pat.length) return false;
    for (var i = 0; i < pat.length; i++) if (seq[seq.length - pat.length + i] !== pat[i]) return false;
    return true;
  }

  B.detectMotion = function (events, charId, window) {
    if (!events.length) return null;
    var seq = [], last = -1;
    for (var i = 0; i < events.length; i++) {
      var d = events[i].d;
      if (d === 5) { last = 5; continue; }
      if (d !== last) { seq.push(d); last = d; }
    }
    var table = FN.MOTION_TABLE[charId] || {};
    for (var k = 0; k < MOTION_ORDER.length; k++) {
      var key = MOTION_ORDER[k];
      if (!table[key]) continue;
      var pats = MOTION_SEQ[key];
      for (var p = 0; p < pats.length; p++) {
        if (endsWith(seq, pats[p])) {
          var pat = pats[p];
          var need = pat.length + (pat.length > 4 ? 2 : 0);
          if (seq.length - need <= 2) return key;   // 容错：允许前缀多出 ≤2 个方向
        }
      }
    }
    return null;
  };

  /* ---------- 显示用 ---------- */
  var KEY_LABEL = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift',
    ControlLeft: 'Ctrl', ControlRight: 'Ctrl', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab'
  };
  B.keyLabel = function (code) {
    if (!code) return '—';
    if (KEY_LABEL[code]) return KEY_LABEL[code];
    if (code.indexOf('Key') === 0) return code.slice(3);
    if (code.indexOf('Digit') === 0) return code.slice(5);
    if (code.indexOf('Numpad') === 0) return 'Num' + code.slice(6);
    return code;
  };
  B.motionLabel = function (motion) {
    var map = { '236': '↓↘→', '623': '→↓↘', '214': '↓↙←', '236236': '↓↘→↓↘→', '214214': '↓↙←↓↙←', '360': '一圈', '360360': '两圈' };
    return map[motion] || motion || '';
  };
  /* 当前操作档位下，某招式的按键提示 */
  B.hintFor = function (charId, moveKey, scheme, km) {
    var mv = FN.FRAMES[charId][moveKey];
    if (!mv) return '';
    var kl = function (b) { return B.keyLabel(km[b]); };
    if (scheme === 'assist') {
      if (mv.key === 'super') return kl('ASSIST') + '+' + kl('HP');
      if (mv.key === 'special') return kl('ASSIST');
      if (mv.key === 'THROW') return kl('THROW');
      if (mv.key === 'LP') return kl('LP');
      if (mv.key === 'HP') return kl('HP');
      if (mv.key === 'LK') return kl('LP');
      if (mv.key === 'HK') return kl('HP');
    }
    if (scheme === 'modern') {
      if (mv.key === 'super') return kl('ASSIST') + '+' + kl('HP');
      if (mv.key === 'special') return B.motionLabel(mv.motion) + '+' + kl('ASSIST');
    }
    if (mv.key === 'super') return B.motionLabel(mv.motion) + '+' + kl('HP');
    if (mv.key === 'special') return B.motionLabel(mv.motion) + '+' + kl(mv.move_id.indexOf('airspin') >= 0 ? 'LK' : 'HP');
    if (mv.key === 'THROW') return kl('LP') + '+' + kl('LK');
    return kl(mv.key);
  };
})(window.FN);
