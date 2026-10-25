/* =============================================================
 * FightNexus · main.js
 * 应用状态机 / 固定步长主循环 / 事件→表现 / 教练 / FTUE / 训练 / 高光
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var C = FN.CFG, U = FN.U, B = FN.Input;
  var t = function (k, f) { return FN.I18N.t(k, f); };

  function PairProvider(log, idx, start) {
    this.log = log; this.idx = idx; this.i = start || 0; this.type = 'replay';
  }
  PairProvider.prototype.next = function () {
    var v = this.log[this.i++];
    return v ? v[this.idx] : 0;
  };

  var App = FN.App = {
    canvas: null, ctx: null, off: null, offCtx: null,
    screen: 'boot', prevScreen: null,
    params: { mode: 'ai', difficulty: 'standard', p1: 'kael', p2: 'rina', previewChar: 'kael' },
    match: null, demo: null, ai: [null, null],
    paused: false, pauseReason: null, countdown: 0,
    acc: 0, last: 0, fps: 60, fpsAcc: 0, fpsN: 0, lowFx: false, lowCheck: 0,
    resultData: null, trainingOpts: { aiMode: 'block', infHp: true, infMeter: true, hitbox: false },
    ftueState: null, banner: null, clip: null, replayCanvas: null, replayPlayer: null,
    hudOpts: {},

    /* ---------------- 启动 ---------------- */
    boot: function () {
      var S = FN.Save.load();
      FN.I18N.lang = S.lang;
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.off = document.createElement('canvas');
      this.off.width = C.VIEW_W; this.off.height = C.VIEW_H;
      this.offCtx = this.off.getContext('2d');
      FN.Keyboard.init();
      FN.Stage.build();
      FN.UI.init(document.getElementById('overlay'), this);
      document.documentElement.style.setProperty('--fs', (S.fontScale || 100) / 100);
      this.resize();
      window.addEventListener('resize', this.resize.bind(this));
      var self = this;
      window.addEventListener('keydown', function (e) {
        if (e.code === 'Escape') self.onEscape();
        if (e.code === 'Tab' && self.screen === 'training') { e.preventDefault(); self.toggleTrainingPanel(); }
        if (e.code === 'F3') { S.fps = !S.fps; FN.Save.save(); }
      });
      window.addEventListener('blur', function () {
        if ((self.screen === 'battle' || self.screen === 'training') && !self.paused) self.pause('blur');
      });
      var unlock = function () { FN.Audio.init(); FN.Audio.resume(); FN.Audio.setVol('bgm', S.volume.bgm); FN.Audio.setVol('sfx', S.volume.sfx); FN.Audio.startBGM(); };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });

      // 分享回流：?c=kael 直接进入预置局
      var q = new URLSearchParams(location.search);
      if (q.get('c') && FN.CHARS[q.get('c')]) {
        this.params.p1 = q.get('c'); this.params.p2 = q.get('c') === 'kael' ? 'rina' : 'kael';
        this.params.mode = 'ai';
        FN.Track.emit('share_link_open', { char: q.get('c') });
        this.startMatch({});
        return;
      }
      if (!S.ftueDone) this.startFTUE();
      else { this.startDemo(); this.go('title'); }
      this.last = performance.now();
      requestAnimationFrame(this.loop.bind(this));
    },

    resize: function () {
      var wrap = document.getElementById('stage-wrap');
      var W = window.innerWidth, H = window.innerHeight;
      var s = Math.min(W / C.VIEW_W, H / C.VIEW_H);
      wrap.style.width = Math.round(C.VIEW_W * s) + 'px';
      wrap.style.height = Math.round(C.VIEW_H * s) + 'px';
      this.canvas.style.width = wrap.style.width;
      this.canvas.style.height = wrap.style.height;
      document.documentElement.style.setProperty('--scale', s);
    },

    /* ---------------- 画面导航 ---------------- */
    go: function (screen) {
      if (screen !== 'battle' && this.screen !== screen) this.prevScreen = this.screen;
      this.screen = screen;
      if (screen === 'battle') { FN.UI.hide(); return; }
      if (screen === 'ftue') { FN.UI.go('ftue'); return; }
      if (screen === 'training') { FN.UI.go('training'); return; }
      if (screen === 'pause') { FN.UI.go('pause'); return; }
      FN.UI.go(screen);
      if (screen === 'charselect') this.params.previewChar = this.params.p1;
    },
    back: function () {
      if (this.screen === 'settings' || this.screen === 'about') this.go('title');
      else if (this.screen === 'mode') { this.startDemo(); this.go('title'); }
      else if (this.screen === 'charselect') this.go('mode');
      else this.go('title');
    },

    /* ---------------- 演示对局（主菜单背景）---------------- */
    startDemo: function () {
      var chars = [FN.CHAR_ORDER[(Math.random() * 3) | 0], FN.CHAR_ORDER[(Math.random() * 3) | 0]];
      if (chars[0] === chars[1]) chars[1] = chars[0] === 'kael' ? 'rina' : 'kael';
      var a1 = new FN.AIController(0, 'standard', { seed: 777 });
      var a2 = new FN.AIController(1, 'expert', { seed: 991 });
      this.demo = new FN.Match({
        mode: 'ai', chars: chars, schemes: ['modern', 'modern'],
        providers: [new B.AIProvider(a1), new B.AIProvider(a2)]
      });
    },

    /* ---------------- FTUE（§5.3）---------------- */
    startFTUE: function () {
      this.ftueState = { step: 1, count: 0, done: false, keyHint: '' };
      var ai = new FN.AIController(1, 'dummy', { seed: 5 });
      this.ai[1] = ai;
      this.match = new FN.Match({
        mode: 'ftue', chars: ['kael', 'rina'], schemes: [FN.Save.data.scheme, 'modern'],
        providers: [new B.LocalProvider(FN.Save.data.keymaps.p1), new B.AIProvider(ai)],
        ftue: this.ftueState
      });
      FN.Track.emit('ftue_start', {});
      this.screen = 'battle';
      FN.UI.go('ftue');
      this.screen = 'ftue';
      this.updateFTUEHint();
    },
    updateFTUEHint: function () {
      var f = this.ftueState;
      if (!f) return;
      var km = FN.Save.data.keymaps.p1, sch = FN.Save.data.scheme;
      if (f.step === 1) f.keyHint = FN.Input.keyLabel(km.left) + ' ' + FN.Input.keyLabel(km.right);
      else if (f.step === 2) f.keyHint = FN.Input.keyLabel(km.LP);
      else if (f.step === 3) f.keyHint = FN.Input.keyLabel(km.LP);
      else if (f.step === 4) f.keyHint = FN.Input.hintFor('kael', 'super', sch, km);
      else f.keyHint = '';
      if (this.screen === 'ftue') FN.UI.go('ftue');
    },
    skipFTUE: function () {
      if (!this.ftueState) return;
      this.ftueState.done = true;
      FN.Save.set('ftueDone', true);
      this.endMatch(true);
    },

    /* ---------------- 开局 ---------------- */
    selectMode: function (v) {
      if (v === 'online') { FN.UI.toast('在线对战 R1.1 · Rollback 敬请期待'); FN.Track.emit('mode_select', { mode: 'online', blocked: true }); return; }
      this.params.mode = v;
      FN.Track.emit('mode_select', { mode: v, difficulty: this.params.difficulty });
      if (v === 'training') { this.startTraining(); return; }
      this.params.p1 = this.params.p1 || 'kael';
      this.params.p2 = v === 'local' ? null : (this.params.p2 || 'rina');
      this.go('charselect');
    },
    pickChar: function (id) {
      var p = this.params;
      if (p.mode === 'local') {
        if (!p.p1) { p.p1 = id; }
        else if (p.p1 === id) { p.p1 = null; }
        else if (!p.p2) { p.p2 = id; }
        else if (p.p2 === id) { p.p2 = null; }
        else { p.p2 = id; }
      } else {
        p.p1 = id;
        p.p2 = id === 'kael' ? 'rina' : 'kael';
      }
      p.previewChar = id;
      FN.Track.emit('char_select', { char_id: id });
      this.go('charselect');
    },
    confirmSelection: function () {
      var p = this.params;
      if (!p.p1) { FN.UI.toast('请先选择 P1 角色'); FN.Audio.ui('error'); return; }
      if (p.mode === 'local') {
        if (!p.p2) { FN.UI.toast('等待 P2 加入（按任意键）'); FN.Audio.ui('error'); return; }
        if (p.p1 === p.p2) { FN.UI.toast(t('sel.blocked')); return; }
        var k1 = FN.Save.data.keymaps.p1, k2 = FN.Save.data.keymaps.p2, clash = [];
        /* 任意键位取值冲突都算（不是只有同名动作），否则一个键会同时触发两人的动作 */
        for (var a in k1) for (var b in k2) {
          if (k1[a] === k2[b] && clash.indexOf(FN.Input.keyLabel(k1[a])) < 0) clash.push(FN.Input.keyLabel(k1[a]));
        }
        if (clash.length) { FN.UI.toast('两位玩家使用了相同按键：' + clash.join('/')); FN.Track.emit('keymap_conflict', { keys: clash }); return; }
      }
      this.startMatch({});
    },
    startMatch: function (opts) {
      var p = this.params, S = FN.Save.data;
      var s1 = S.scheme, s2 = p.mode === 'local' ? S.scheme : 'modern';
      var prov = [new B.LocalProvider(S.keymaps.p1), null];
      this.ai = [null, null];
      if (p.mode === 'local') prov[1] = new B.LocalProvider(S.keymaps.p2);
      else {
        var prof = p.mode === 'ftue' ? 'dummy' : (p.difficulty || S.difficulty);
        var ai = new FN.AIController(1, prof, { seed: 1337 });
        ai.dynamicAdj = 0;
        this.ai[1] = ai;
        prov[1] = new B.AIProvider(ai);
      }
      this.match = new FN.Match({
        mode: p.mode, chars: [p.p1, p.p2], schemes: [s1, s2],
        providers: prov, aiProfile: p.difficulty || S.difficulty
      });
      FN.FX.reset();
      this.paused = false; this.countdown = 0; this.banner = null;
      this.resultData = null; this.clip = null;
      this.go('battle');
      this.banner = { text: 'ROUND 1', sub: '', t: 0, color: '#ffd23f' };
      FN.Audio.startBGM();
    },
    startTraining: function () {
      var S = FN.Save.data;
      this.params.p1 = this.params.p1 || 'kael';
      this.params.p2 = this.params.p2 || 'rina';
      var ai = new FN.AIController(1, 'casual', { seed: 4242 });
      this.ai[1] = ai;
      var tr = { aiMode: this.trainingOpts.aiMode, infHp: this.trainingOpts.infHp, infMeter: this.trainingOpts.infMeter, card: null };
      this.match = new FN.Match({
        mode: 'training', chars: [this.params.p1, this.params.p2], schemes: [S.scheme, 'modern'],
        providers: [new B.LocalProvider(S.keymaps.p1), new B.AIProvider(ai)], training: tr
      });
      if (this.trainingOpts.cardId) this.selectCard(this.trainingOpts.cardId);
      FN.FX.reset();
      this.paused = false;
      FN.Save.load(); FN.Save.stats.labSessions++; FN.Save.save();
      this.go('training');
      FN.Audio.startBGM();
    },
    setTrainingAI: function (m) { this.trainingOpts.aiMode = m; if (this.match && this.match.training) this.match.training.aiMode = m; FN.UI.go('training'); },
    setTrainingOpt: function (k, node) {
      this.trainingOpts[k] = !this.trainingOpts[k];
      if (this.match && this.match.training) this.match.training[k] = this.trainingOpts[k];
      if (this.screen === 'training') FN.UI.go('training');
    },
    trainingReset: function () {
      if (!this.match) return;
      this.match.resetRound(true);
      FN.FX.reset();
      FN.UI.toast('已复位');
    },
    selectCard: function (id) {
      var card = null;
      for (var i = 0; i < FN.PRACTICE_CARDS.length; i++) if (FN.PRACTICE_CARDS[i].id === id) card = JSON.parse(JSON.stringify(FN.PRACTICE_CARDS[i]));
      if (card) { card.cur = 0; }
      this.trainingOpts.cardId = id;
      if (this.match && this.match.training) this.match.training.card = card;
      if (this.screen === 'training') FN.UI.go('training');
    },
    toggleTrainingPanel: function () {
      if (this.screen === 'training') { this.screen = 'battle'; FN.UI.hide(); }
      else { this.screen = 'training'; FN.UI.go('training'); }
    },
    frameDataRows: function () {
      var p = this.match.fighters[0], mv = p.move || (p.moveKey ? p.frames[p.moveKey] : null);
      var rows = '';
      var ch = p.charId;
      var list = ['st_lp', 'st_hp', 'cr_lp', 'cr_hp', 'cr_hk', 'throw'];
      var keys = Object.keys(p.frames);
      for (var i = 0; i < keys.length; i++) {
        var m = p.frames[keys[i]];
        rows += `<div class="fd-row ${mv === m ? 'on' : ''}">
          <span>${FN.I18N.moveName(ch, keys[i])}</span>
          <em>${m.input}</em>
          <b>${m.startup}/${m.active}/${m.recovery}</b>
          <i>${m.hit_advantage >= 0 ? '+' + m.hit_advantage : m.hit_advantage}</i>
          <u>${m.block_advantage >= 0 ? '+' + m.block_advantage : m.block_advantage}</u>
          <s>${m.damage}</s></div>`;
      }
      return `<div class="fd-head"><span>招式</span><em>指令</em><b>发/持/收</b><i>命中</i><u>防御</u><s>伤害</s></div>` + rows;
    },

    /* ---------------- 暂停 ---------------- */
    onEscape: function () {
      if (this.screen === 'battle' || this.screen === 'ftue') this.pause('user');
      else if (this.screen === 'pause') this.resume();
      else if (this.screen === 'training') this.quitMatch();
      else if (this.screen !== 'title') this.back();
    },
    pause: function (reason) {
      if (!this.match) return;
      this.paused = true; this.pauseReason = reason;
      FN.Track.emit('pause', { reason: reason });
      this.go('pause');
    },
    resume: function () {
      this.paused = false; this.countdown = 180;
      this.screen = this.ftueState && !this.ftueState.done ? 'ftue' : 'battle';
      if (this.screen === 'ftue') FN.UI.go('ftue'); else FN.UI.hide();
    },
    surrender: function () {
      if (!this.match) return;
      this.match.surrender(0);
      FN.Track.emit('match_surrender', {});
      this.endMatch();
    },
    restartRound: function () {
      if (!this.match) return;
      this.match.resetRound(true);
      this.paused = false;
      this.screen = 'battle'; FN.UI.hide();
    },
    quitMatch: function () {
      FN.Track.emit('match_end', { reason: 'abort' });
      this.match = null; this.resultData = null; this.ftueState = null;
      this.startDemo(); this.go('title');
    },
    rematch: function () {
      if (this.params.mode === 'training') { this.startTraining(); return; }
      this.startMatch({});
    },

    /* ---------------- 主循环 ----------------
     * loop 内任何未捕获异常都会中断 requestAnimationFrame 链，
     * 表现为「画面突然永久冻结」。因此 render/UI 用 try/catch 护栏：
     * 出错时记录并在下一帧恢复，循环绝不死亡。 */
    loop: function (now) {
      var dt = now - this.last; this.last = now;
      if (dt > 250) dt = 250;
      this.acc += dt;
      var steps = 0;
      var running = ((this.screen === 'battle' || this.screen === 'ftue' || this.screen === 'training') && this.match && !this.paused && this.countdown <= 0)
        || (this.screen === 'title' && this.demo);
      try {
        while (this.acc >= C.STEP_MS && steps < C.MAX_CATCHUP) {
          this.acc -= C.STEP_MS; steps++;
          if (running) this.stepLogic();
          else { FN.FX.update(); }
        }
        if (steps >= C.MAX_CATCHUP) this.acc = 0;
        this.fpsAcc += dt; this.fpsN++;
        if (this.fpsAcc > 500) { this.fps = Math.round(1000 / (this.fpsAcc / this.fpsN)); this.fpsAcc = 0; this.fpsN = 0; }
      } catch (err) {
        this.loopError = (this.loopError || 0) + 1;
        if (this.loopError <= 3) console.error('[FightNexus] 逻辑帧异常（已恢复）:', err);
        this.acc = 0;
      }
      try {
        this.render(now);
        FN.UI.tick(now);
      } catch (err) {
        this.loopError = (this.loopError || 0) + 1;
        if (this.loopError <= 3) console.error('[FightNexus] 渲染异常（已恢复）:', err);
      }
      requestAnimationFrame(this.loop.bind(this));
    },

    stepLogic: function () {
      var m = this.match || this.demo;
      if (this.screen === 'title' && this.demo) {
        this.demo.step();
        this.consumeEvents(this.demo, true);
        if (this.demo.phase === 'matchend') this.startDemo();
        FN.FX.update();
        return;
      }
      var mm = this.match;
      mm.step();
      this.consumeEvents(mm, false);
      FN.FX.update();
      if (this.countdown > 0) this.countdown--;
      if (mm.phase === 'matchend' && !this.resultData) this.endMatch();
      if (this.banner) { this.banner.t++; if (this.banner.t > 70) this.banner = null; }
    },

    consumeEvents: function (m, isDemo) {
      var ev = m.events, i, e;
      for (i = 0; i < ev.length; i++) {
        e = ev[i];
        switch (e.t) {
          case 'hit': this.onHit(m, e); break;
          case 'block': FN.Audio.block(); FN.FX.spark(e.x, C.GROUND_Y - e.y, 'block', 1); break;
          case 'armor': FN.FX.spark(e.x, e.y, 'special', 1); break;
          case 'tech': FN.FX.text(e.x, C.GROUND_Y - 100, 'TECH!', '#8cff4d', 30); FN.Audio.block(); break;
          case 'punish': if (FN.Save.data.coach) FN.FX.text(e.x, C.GROUND_Y - e.y - 20, t('coach.punish'), '#ffd23f', 30); break;
          case 'antiair': if (FN.Save.data.coach) FN.FX.text(e.x, C.GROUND_Y - e.y - 20, t('coach.antiair'), '#00e5ff', 26); break;
          case 'ko': break;
          case 'land': FN.FX.dust(e.x, C.GROUND_Y, 6); FN.Audio.step(); break;
          case 'super': this.onSuper(m, e); break;
          case 'roundend': this.onRoundEnd(m, e); break;
          case 'matchend': break;
          case 'ftueadvance': this.onFtueAdvance(m, e); break;
          case 'carddone': FN.UI.toast('练习卡完成：' + e.id); FN.FX.text(C.VIEW_W / 2, 200, 'CLEAR!', '#8cff4d', 46); break;
          case 'wakeup': FN.FX.dust(m.fighters[e.p].x, C.GROUND_Y, 5); break;
          case 'crush': FN.FX.text(m.fighters[e.p].x, C.GROUND_Y - 200, 'GUARD CRUSH', '#ff5a5a', 32); break;
          case 'projectile': FN.Audio.whiff(); break;
        }
      }
    },

    onHit: function (m, e) {
      var f = m.fighters;
      var y = C.GROUND_Y - e.y;
      FN.FX.spark(e.x, y, e.type, f[e.p].facing);
      FN.Audio.hit(e.type === 'throw' ? 'throw' : e.type);
      var shake = C.SHAKE[e.type === 'throw' ? 'special' : e.type] || 4;
      FN.FX.shakeBy(shake * (FN.Save.data.shake / 100));
      if (FN.Save.data.flash) FN.FX.flashBy(C.FLASH_FRAMES);
      FN.FX.text(e.x + (f[e.p].facing * 20), y - 20, '-' + e.dmg, e.type === 'super' ? '#ffd23f' : '#fff', e.type === 'light' ? 26 : 34);
      if (e.combo >= 2) FN.FX.text(e.x, y - 60, e.combo + ' HIT', '#ffd23f', 22);
      if (e.type === 'super') { FN.FX.zoomPulse = 30; FN.FX.speedlines = 30; }
      if (isFinite(e.x)) FN.FX.dust(e.x, C.GROUND_Y, 3, f[e.p].facing);
    },

    onSuper: function (m, e) {
      var f = m.fighters[e.p];
      var mv = f.frames[e.move];
      this.banner = { text: FN.I18N.moveName(f.charId, e.move), sub: f.char.cn + ' · ' + f.char.superInput, t: 0, color: '#ff2fb3' };
      FN.FX.flashBy(8, '#ffd23f');
      FN.FX.zoomPulse = 26;
      FN.Audio.hit('super');
      FN.FX.text(f.x, C.GROUND_Y - 210, FN.I18N.moveName(f.charId, e.move), '#ffd23f', 34);
    },

    onRoundEnd: function (m, e) {
      var txt, sub = '';
      if (e.reason === 'ko') { txt = t('hud.ko'); sub = 'K.O.'; FN.Audio.ko(); }
      else if (e.reason === 'doubleko') { txt = t('hud.doubleko'); FN.Audio.ko(); }
      else { txt = t('hud.time'); sub = 'TIME UP'; }
      this.banner = { text: txt, sub: sub, t: 0, color: '#ff5a5a' };
      FN.FX.flashBy(6, '#fff');
      FN.FX.shakeBy(12);
      if (!this.demo && this.ai[1]) {
        var hsi = FN.Growth.hsi();
        var last = m.roundLog[m.roundLog.length - 1];
        if (FN.Save.data.dynamic && m.roundLog.length) {
          var lost = last && last.winner === 0;
          if (lost) this.ai[1].dynamicAdj = Math.min(0.2, (this.ai[1].dynamicAdj || 0) + 0.07);
          else this.ai[1].dynamicAdj = Math.max(-0.2, (this.ai[1].dynamicAdj || 0) - 0.07);
          this.ai[1].tune(hsi);
        }
      }
    },

    onFtueAdvance: function (m, e) {
      this.ftueState.step = e.step;
      this.updateFTUEHint();
      if (e.step === 4) { m.fighters[0].meter = C.METER_MAX; }
      if (e.step >= 5) {
        FN.Save.set('ftueDone', true);
        FN.Growth.unlock('ftue_done');
        this.endMatch(true);
      }
    },

    /* ---------------- 结算（FR5）---------------- */
    endMatch: function (ftue) {
      var m = this.match;
      if (!m) return;
      if (m.phase !== 'matchend') m.finishMatch();
      var view = 0;
      var r = m.result;
      var prevBest = { combo: FN.Save.stats.longestCombo, dmg: FN.Save.stats.totalDamage };
      var me = r.players[view], op = r.players[1 - view];
      var recs = [];
      if (me.maxCombo > 0) recs.push({ label: '最长连段', value: me.maxCombo + ' 连', new: me.maxCombo > prevBest.combo });
      recs.push({ label: '本局伤害', value: me.damage, new: me.damage > 400 && me.damage > prevBest.dmg * 0.1 });
      if (me.punish > 0) recs.push({ label: '确反', value: me.punish + ' 次', new: me.punish >= 3 });
      if (me.supers > 0) recs.push({ label: '超必杀', value: me.supers + ' 次', new: false });
      if (me.maxCombo >= 5) recs.push({ label: '五连达成', value: '✓', new: !FN.Growth.has('combo5') });
      recs = recs.slice(0, 3);
      var lastRound = m.roundLog[m.roundLog.length - 1] || {};
      var sub = ftue ? '90 秒引导完成' : (lastRound.reason === 'ko' ? 'K.O. · ' + Math.round(m.frame / 60) + 's'
        : (lastRound.reason === 'surrender' ? '投降' : 'TIME UP'));
      this.resultData = {
        winner: r.winner, view: view, players: r.players, records: recs, subtitle: sub,
        coach: this.buildCoach(m, me, op),
        oppLabel: this.params.mode === 'local' ? '本地玩家' : (m.aiProfile === 'expert' ? '专家 AI' : (m.aiProfile === 'casual' ? '轻松 AI' : '标准 AI'))
      };
      // 成就与成长
      var win = r.winner === 0;
      FN.Growth.recordMatch({
        win: r.winner === -2 ? null : win, myChar: me.char, oppChar: op.char, scheme: me.scheme,
        maxCombo: me.maxCombo, punishes: me.punish, techs: me.techs,
        blockRate: me.hits + me.taken > 0 ? me.blocks / Math.max(1, me.taken) : 0,
        specialRate: m.stats[0].specialTries ? m.stats[0].specials / m.stats[0].specialTries : 0,
        punishRate: me.punish / 10, damage: me.damage
      });
      var un = [];
      if (FN.Growth.unlock('first_blood')) un.push('第一滴血');
      if (me.maxCombo >= 5 && FN.Growth.unlock('combo5')) un.push('五连');
      if (me.maxCombo >= 10 && FN.Growth.unlock('combo10')) un.push('十连');
      if (win && this.params.mode === 'ai' && this.params.difficulty === 'expert' && FN.Growth.unlock('beat_expert')) un.push('超越专家');
      if (me.techs >= 5 && FN.Growth.unlock('tech5')) un.push('拆投手');
      if (win && me.scheme === 'classic' && FN.Growth.unlock('classic_win')) un.push('硬核时刻');
      if (FN.Save.stats.streak >= 10 && FN.Growth.unlock('streak10')) un.push('十连胜');
      if (win && me.hp === me.hp && r.players[0].hp === FN.CHARS[me.char].hp && FN.Growth.unlock('perfect')) un.push('Perfect!');
      if (un.length) setTimeout(function () { FN.UI.toast('解锁成就：' + un.join(' · ')); }, 700);
      FN.Track.emit('result_view', { win: win, combo: me.maxCombo });
      this.clip = m.highlights[m.highlights.length - 1] || null;
      this.ftueState = null;
      this.go('result');
    },

    buildCoach: function (m, me, op) {
      var tips = [];
      if (op.hits > 0 && me.blocks === 0) tips.push('这一局你一次都没防住，试着按住后方向做站防。');
      if (me.taken > me.hits * 1.6) tips.push('你被命中的次数明显更多，先练「确认反击」练习卡。');
      if (me.punish === 0) tips.push('还没有确反记录：对手重招落空后，用 9 帧启动的站立重拳去打。');
      if (me.maxCombo < 2) tips.push('先从「蹲轻拳 → 站立轻拳」开始，连续成功 5 次即可形成肌肉记忆。');
      if (me.supers === 0 && m.fighters[0].meter >= 100) tips.push('能量满格却没放超必杀，试试训练模式的 C5 练习卡。');
      if (me.techs === 0 && op.throws > 0) tips.push('被投了 ' + op.throws + ' 次：投技成立后 6 帧内按投技键可以拆投。');
      if (!tips.length) tips.push('节奏不错。下一局试试把必杀接进连段里（C5）。');
      return tips[0];
    },

    /* ---------------- 高光回放（FR11：输入重演）---------------- */
    playReplay: function (canvas) {
      this.replayCanvas = canvas;
      if (!this.clip || !canvas) { this.replayPlayer = null; return; }
      var clip = this.clip;
      try {
        var m = new FN.Match({ mode: 'replay', chars: clip.chars, schemes: clip.schemes, providers: [null, null] });
        if (!clip.snapshot) { this.replayPlayer = null; return; }
        m.restore(clip.snapshot);
        var startIdx = Math.max(0, (clip.logStart != null ? clip.logStart : clip.startFrame) - clip.startFrame);
        m.providers = [new PairProvider(clip.inputs, 0, Math.max(0, startIdx)),
        new PairProvider(clip.inputs, 1, Math.max(0, startIdx))];
        var from = Math.max(clip.startFrame, clip.peak - 110);
        var to = Math.min(clip.endFrame, clip.peak + 70);
        this.replayPlayer = { m: m, from: from, to: to, started: false };
      } catch (err) { this.replayPlayer = null; }
    },
    stepReplay: function () {
      var p = this.replayPlayer;
      if (!p) return;
      var guard = 0;
      while (!p.started && guard++ < 600) {
        p.m.step();
        if (p.m.frame >= p.from) p.started = true;
        if (p.m.frame >= p.to) { p.m.restore(this.clip.snapshot); p.started = false; p.m.providers.forEach(function (pr) { pr.i = Math.max(0, this.clip.keyFrame - this.clip.startFrame); }, this); }
      }
      if (p.started) { p.m.step(); p.m.events.length = 0; }
      if (p.m.frame >= p.to) this.playReplay(this.replayCanvas);
    },
    after_result: null,

    /* ---------------- 分享导出 ---------------- */
    openShare: function () {
      this.go('share');
      var self = this;
      setTimeout(function () { self.drawShareCard(); }, 30);
      FN.Track.emit('highlight_share', { channel: 'panel' });
    },
    drawShareCard: function () {
      var cv = document.getElementById('shareCardCanvas');
      if (!cv) return;
      var ctx = cv.getContext('2d'), r = this.resultData;
      var g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
      g.addColorStop(0, '#2a1040'); g.addColorStop(1, '#c94a3c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, cv.width, 70);
      ctx.fillStyle = '#fff'; ctx.font = '900 30px "Arial Black", system-ui';
      ctx.fillText('FIGHT NEXUS', 20, 46);
      ctx.font = '700 15px system-ui'; ctx.fillStyle = '#ffd23f';
      ctx.fillText(r && r.winner === r.view ? 'WIN' : 'BATTLE', 20, 92);
      if (r) {
        var me = r.players[r.view];
        ctx.fillStyle = '#fff'; ctx.font = '800 17px system-ui';
        var lines = ['最长连段  ' + me.maxCombo, '命中  ' + me.hits, '确反  ' + me.punish, '伤害  ' + me.damage];
        lines.forEach(function (l, i) { ctx.fillText(l, 20, 130 + i * 28); });
      }
      FN.drawPortrait(ctx, this.params.p1, 200, 240, performance.now(), 'win');
      ctx.save(); ctx.translate(cv.width - 130, 0);
      FN.drawPortrait(ctx, this.params.p1 || 'kael', 200, 240, performance.now(), 'win');
      ctx.restore();
    },
    downloadClip: function () {
      var cv = this.replayCanvas || document.getElementById('replayCanvas');
      if (!cv || !cv.captureStream || !window.MediaRecorder) { FN.UI.toast('当前浏览器不支持录制，可下载战绩卡片'); return; }
      var stream = cv.captureStream(60);
      var rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: 'video/webm' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'FightNexus_高光.webm'; a.click();
        FN.UI.toast('片段已生成（≤3MB）');
      };
      rec.start();
      setTimeout(function () { rec.stop(); }, 3200);
      FN.Save.stats.totals.shares++; FN.Growth.unlock('share1'); FN.Save.save();
    },
    downloadCard: function () {
      var cv = document.getElementById('shareCardCanvas');
      if (!cv) return;
      var a = document.createElement('a');
      a.href = cv.toDataURL('image/png'); a.download = 'FightNexus_战绩卡.png'; a.click();
    },
    copyLink: function (node) {
      var url = location.href.split('?')[0] + '?c=' + (this.params.p1 || 'kael');
      var self = this;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { self.copied(node, url); }, function () { self.copied(node, url); });
      else this.copied(node, url);
      FN.Track.emit('share_link', { char: this.params.p1 });
    },
    copied: function (node, url) {
      FN.UI.toast('链接已复制，朋友点开 3s 内即可开打');
      if (node) { var old = node.textContent; node.textContent = '已复制 ✓'; setTimeout(function () { node.textContent = old; }, 1600); }
      var box = document.getElementById('qrBox');
      if (box) box.innerHTML = '<div class="qr-fake">扫码直达<br><span>' + url.slice(-18) + '</span></div>';
    },
    toggleQR: function (node) { },

    /* ---------------- 设置回调 ---------------- */
    onSchemeChange: function (v) {
      FN.Track.emit('control_scheme_change', { to: v, trigger_scene: 'settings' });
      if (this.match) { this.match.fighters[0].scheme = v; }
      FN.UI.toast('已切换：' + FN.SCHEMES[v].name + '（数值与帧数据完全相同）');
    },
    onColorMode: function () { },
    resetKeys: function () {
      FN.Save.data.keymaps = JSON.parse(JSON.stringify(FN.DEFAULT_KEYS));
      FN.Save.save(); FN.UI.go('settings');
    },
    startRebind: function (v, node) {
      var parts = v.split('.');
      node.classList.add('waiting');
      node.querySelector('b').textContent = '按下按键…';
      FN.__onAnyKey = function (e) {
        if (e.code === 'Escape') { FN.__onAnyKey = null; FN.UI.go('settings'); return; }   // Esc 取消
        if (['Tab', 'F3', 'F5', 'F12'].indexOf(e.code) >= 0) { FN.UI.toast('该按键为系统键，无法绑定'); return; }
        /* 冲突检测：同键不得被任一玩家的其他动作占用（否则一次按键触发两个动作） */
        var km = FN.Save.data.keymaps, clash = null;
        ['p1', 'p2'].forEach(function (p) {
          Object.keys(km[p]).forEach(function (k) {
            if (!(p === parts[0] && k === parts[1]) && km[p][k] === e.code) clash = (p === 'p1' ? 'P1' : 'P2') + ' · ' + k;
          });
        });
        if (clash) { FN.UI.toast('按键冲突：已被 ' + clash + ' 占用'); return; }
        FN.Save.data.keymaps[parts[0]][parts[1]] = e.code;
        FN.Save.save();
        FN.__onAnyKey = null;
        FN.UI.go('settings');
      };
    },
    wipeData: function (node) {
      FN.Save.wipe();
      FN.UI.toast('本地数据已清除');
      FN.UI.go('settings');
    },

    /* ---------------- 渲染 ---------------- */
    render: function (now) {
      var ctx = this.ctx, S = FN.Save.data;
      var m = (this.screen === 'title' || this.screen === 'mode' || !this.match) ? this.demo : this.match;
      ctx.clearRect(0, 0, C.VIEW_W, C.VIEW_H);
      if (!m) { ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H); return; }

      var showHud = (this.screen === 'battle' || this.screen === 'ftue' || this.screen === 'training');
      if (this.screen === 'pause') showHud = true;
      var opts = {
        t: now, hitbox: (this.screen === 'training' && this.trainingOpts.hitbox) || (S.hitbox && showHud),
        colorMode: S.colorMode, hudScale: S.hudScale, subtitles: S.subtitles,
        keys: [S.keymaps.p1, S.keymaps.p2]
      };
      FN.drawWorld(ctx, m, opts);
      if (showHud && this.match) {
        FN.drawHUD(ctx, this.match, opts);
        this.drawCoach(ctx, now);
      }
      if (this.banner) FN.drawBanner(ctx, this.banner.text, this.banner.sub, this.banner.t, this.banner.color);
      if (this.countdown > 0) {
        var n = Math.ceil(this.countdown / 60);
        FN.drawBanner(ctx, String(Math.max(1, n)), '已自动暂停', 0, '#00e5ff');
      }
      if (S.fps) {
        ctx.save(); ctx.font = '700 16px monospace'; ctx.fillStyle = '#8cff4d';
        ctx.fillText(this.fps + ' fps', C.VIEW_W - 80, C.VIEW_H - 14);
        ctx.restore();
      }
      // 回放画布
      if (this.screen === 'result') {
        var rc = document.getElementById('replayCanvas');
        if (rc) {
          if (!this.replayCanvas || this.replayCanvas !== rc) this.playReplay(rc);
          this.stepReplay();
          var rctx = rc.getContext('2d');
          var p = this.replayPlayer;
          if (p) {
            rctx.save();
            rctx.scale(rc.width / C.VIEW_W, rc.height / C.VIEW_H);
            FN.drawWorld(rctx, p.m, { t: now, hitbox: false });
            rctx.restore();
          } else if (this.clip) {
            rctx.fillStyle = '#14101f'; rctx.fillRect(0, 0, rc.width, rc.height);
            rctx.fillStyle = '#fff'; rctx.font = '700 16px system-ui';
            rctx.fillText('BEST MOMENT', 20, 30);
          }
        }
      }
    },

    /* 教练系统（§6.5）：连段窗口按键建议 + 确反提示 */
    drawCoach: function (ctx, now) {
      if (!FN.Save.data.coach || !this.match) return;
      var p = this.match.fighters[0], o = this.match.fighters[1];
      if (this.screen === 'training') return;
      // 确反提示：对手 recovery ≥ 14 帧且玩家 3 帧未输入
      if (o.state === 'attack' && o.move) {
        var rec = o.inRecovery();
        if (rec >= 1 && o.move.recovery >= 14 && p.canAct()) {
          ctx.save();
          ctx.globalAlpha = 0.28 + 0.28 * Math.sin(now / 90);
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(0, 0, 12, C.VIEW_H); ctx.fillRect(C.VIEW_W - 12, 0, 12, C.VIEW_H);
          ctx.restore();
          FN.FX.text(p.x, C.GROUND_Y - 210, t('coach.punish'), '#ffd23f', 24);
        }
      }
      // 连段窗口建议
      if (p.state === 'attack' && p.moveHasHit && p.mf >= p.move.startup && p.mf <= p.move.startup + 10) {
        if ((p.mask & B.BTN_MASK) === 0) {
          var km = FN.Save.data.keymaps.p1;
          var hint = FN.Input.hintFor(p.charId, p.frames[p.moveKey].properties.indexOf('cancelable') >= 0 ? (p.charId === 'kael' ? 'dp' : (p.charId === 'rina' ? 'rush' : 'smash')) : 'st_lp', p.scheme, km);
          ctx.save();
          ctx.font = '800 20px system-ui'; ctx.textAlign = 'center';
          var bx = p.x, by = C.GROUND_Y - 230 - Math.sin(now / 200) * 6;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          var w = ctx.measureText(hint).width + 24;
          ctx.fillRect(bx - w / 2, by - 18, w, 34);
          ctx.fillStyle = '#00e5ff'; ctx.fillText(hint, bx, by + 6);
          ctx.restore();
        }
      }
    }
  };

  window.addEventListener('DOMContentLoaded', function () { App.boot(); });
})(window.FN);
