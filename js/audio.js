/* =============================================================
 * FightNexus · audio.js
 * 程序化音频（无外部资源）：BGM / SFX / UI / 环境 四条独立轨道（§12.6）
 * 混音优先级：命中 > 必杀 > UI；同一帧同类音效只播放最强的一个
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  var A = FN.Audio = {
    ctx: null, master: null, buses: {}, ready: false, muted: false,
    vol: { bgm: 0.45, sfx: 0.8, ui: 0.6 },
    intensity: 'standard',
    lastPlay: {},

    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      var c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      ['bgm', 'sfx', 'ui', 'amb'].forEach(function (k) {
        var g = c.createGain(); g.gain.value = A.vol[k] == null ? 0.6 : A.vol[k];
        g.connect(A.master); A.buses[k] = g;
      });
      this.ready = true;
    },
    resume: function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVol: function (k, v) { this.vol[k] = v; if (this.buses[k]) this.buses[k].gain.value = v; },
    setMuted: function (m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.9; },

    /* 同一帧同类音效去重 */
    gate: function (key, frames) {
      var now = performance.now();
      if (this.lastPlay[key] && now - this.lastPlay[key] < (frames || 40)) return false;
      this.lastPlay[key] = now; return true;
    },
    noise: function (dur, bus) {
      var c = this.ctx, n = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource(); src.buffer = buf; return src;
    },
    tone: function (freq, dur, type, bus, vol, slideTo) {
      var c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, c.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(this.buses[bus || 'sfx']);
      o.start(); o.stop(c.currentTime + dur + 0.02);
      return o;
    },

    hit: function (type) {
      if (!this.ready || this.muted) return;
      var I = this.intensity === 'soft' ? 0.55 : (this.intensity === 'heavy' ? 1.35 : 1);
      var c = this.ctx;
      if (type === 'light') {
        var s = this.noise(0.09); var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
        var g = c.createGain(); g.gain.value = 0.34 * I;
        s.connect(bp); bp.connect(g); g.connect(this.buses.sfx); s.start();
        this.tone(340, 0.08, 'square', 'sfx', 0.12 * I, 180);
      } else if (type === 'heavy' || type === 'special') {
        var s2 = this.noise(0.16); var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        var g2 = c.createGain(); g2.gain.value = 0.5 * I;
        s2.connect(lp); lp.connect(g2); g2.connect(this.buses.sfx); s2.start();
        this.tone(150, 0.2, 'sine', 'sfx', 0.34 * I, 60);
        this.tone(type === 'special' ? 520 : 300, 0.14, 'sawtooth', 'sfx', 0.12 * I, 120);
      } else { // super
        this.tone(90, 0.55, 'sine', 'sfx', 0.5 * I, 40);
        this.tone(300, 0.5, 'sawtooth', 'sfx', 0.2 * I, 900);
        var s3 = this.noise(0.4); var g3 = c.createGain(); g3.gain.value = 0.35 * I;
        s3.connect(g3); g3.connect(this.buses.sfx); s3.start();
      }
    },
    whiff: function () {
      if (!this.ready || this.muted || !this.gate('whiff', 60)) return;
      var c = this.ctx, s = this.noise(0.13), bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(1800, c.currentTime);
      bp.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.13);
      bp.Q.value = 0.8;
      var g = c.createGain(); g.gain.value = 0.14;
      s.connect(bp); bp.connect(g); g.connect(this.buses.sfx); s.start();
    },
    block: function () {
      if (!this.ready || this.muted) return;
      this.tone(900, 0.06, 'square', 'sfx', 0.12, 600);
      var c = this.ctx, s = this.noise(0.06), g = c.createGain(); g.gain.value = 0.14;
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      s.connect(hp); hp.connect(g); g.connect(this.buses.sfx); s.start();
    },
    ko: function () {
      if (!this.ready || this.muted) return;
      this.tone(70, 0.9, 'sine', 'sfx', 0.5, 30);
      this.tone(180, 0.7, 'sawtooth', 'sfx', 0.22, 60);
      var c = this.ctx, s = this.noise(0.7), g = c.createGain(); g.gain.value = 0.28;
      s.connect(g); g.connect(this.buses.sfx); s.start();
    },
    throwHit: function () {
      if (!this.ready || this.muted) return;
      this.tone(120, 0.3, 'square', 'sfx', 0.3, 50);
      var c = this.ctx, s = this.noise(0.3), g = c.createGain(); g.gain.value = 0.3;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      s.connect(lp); lp.connect(g); g.connect(this.buses.sfx); s.start();
    },
    ui: function (kind) {
      if (!this.ready || this.muted) return;
      var f = kind === 'back' ? 380 : (kind === 'error' ? 200 : 660);
      this.tone(f, 0.07, 'triangle', 'ui', 0.16, f * (kind === 'back' ? 0.7 : 1.3));
    },
    jump: function () {
      if (!this.ready || this.muted || !this.gate('jump', 120)) return;
      this.tone(300, 0.1, 'sine', 'sfx', 0.08, 520);
    },
    step: function () {
      if (!this.ready || this.muted || !this.gate('step', 220)) return;
      var c = this.ctx, s = this.noise(0.05), g = c.createGain(); g.gain.value = 0.06;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      s.connect(lp); lp.connect(g); g.connect(this.buses.sfx); s.start();
    },

    /* BGM：合成循环（黄昏街机厅 · 电子 + 鼓） */
    bgmOn: false, bgmTimer: null, step: 0,
    startBGM: function () {
      if (!this.ready || this.bgmOn) return;
      this.bgmOn = true; this.step = 0;
      var self = this;
      var scale = [0, 3, 5, 7, 10, 12, 15];
      var root = 55;
      var tick = function () {
        if (!self.bgmOn) return;
        var c = self.ctx, s = self.step++;
        /* 上下文被浏览器自动挂起（未解锁/后台）时跳过排程，
         * 否则挂起期间节点会无限堆积，恢复后瞬间涌出造成卡顿 */
        if (c.state === 'running') {
        var freq = function (n) { return root * Math.pow(2, n / 12); };
        // 鼓
        if (s % 4 === 0) { var k = self.noise(0.16); var kg = c.createGain(); kg.gain.value = 0.4; var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; k.connect(lp); lp.connect(kg); kg.connect(self.buses.bgm); k.start(); }
        if (s % 8 === 4) { var h = self.noise(0.08); var hg = c.createGain(); hg.gain.value = 0.12; var hp2 = c.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 4000; h.connect(hp2); hp2.connect(hg); hg.connect(self.buses.bgm); h.start(); }
        // 贝斯
        if (s % 2 === 0) self.tone(freq(scale[(s / 2) % scale.length]), 0.24, 'sawtooth', 'bgm', 0.16);
        // 主旋律
        if (s % 4 === 2) self.tone(freq(24 + scale[(s * 3) % scale.length]), 0.2, 'square', 'bgm', 0.07);
        }
        self.bgmTimer = setTimeout(tick, 235);
      };
      tick();
    },
    stopBGM: function () { this.bgmOn = false; if (this.bgmTimer) clearTimeout(this.bgmTimer); }
  };
})(window.FN);
