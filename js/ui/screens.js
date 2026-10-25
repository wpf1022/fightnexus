/* =============================================================
 * FightNexus · screens.js
 * 全部 UI 文本走 i18n key（§12.4）；DOM 覆盖层 + 游戏画布
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var t = function (k, f) { return FN.I18N.t(k, f); };
  var UI = FN.UI = {
    el: null, app: null, screen: null, anims: [], params: {},

    init: function (el, app) {
      this.el = el; this.app = app;
      var self = this;
      el.addEventListener('click', function (e) {
        var n = e.target.closest('[data-act]');
        if (!n) return;
        var act = n.getAttribute('data-act');
        var d = n.getAttribute('data-v');
        FN.Audio.ui(act === 'back' ? 'back' : 'ok');
        self.onAction(act, d, n, e);
      });
      el.addEventListener('change', function (e) {
        var n = e.target.closest('[data-set]');
        if (!n) return;
        self.onSet(n.getAttribute('data-set'), n.type === 'checkbox' ? n.checked : n.value, n);
      });
      el.addEventListener('input', function (e) {
        var n = e.target.closest('[data-set]');
        if (!n) return;
        self.onSet(n.getAttribute('data-set'), n.type === 'checkbox' ? n.checked : n.value, n, true);
      });
    },

    onAction: function (act, v, node, e) {
      var app = this.app;
      switch (act) {
        case 'goto': app.go(v); break;
        case 'mode': app.selectMode(v); break;
        case 'diff': app.params.difficulty = v; FN.Save.set('difficulty', v); this.go('mode'); break;
        case 'pick': app.pickChar(v); break;
        case 'confirm': app.confirmSelection(); break;
        case 'back': app.back(); break;
        case 'rematch': app.rematch(); break;
        case 'share': app.openShare(); break;
        case 'closeShare': this.go(app.prevScreen || 'result'); break;
        case 'downloadClip': app.downloadClip(); break;
        case 'downloadCard': app.downloadCard(); break;
        case 'copyLink': app.copyLink(node); break;
        case 'achv': this.go('about'); break;
        case 'trainOpt': app.setTrainingOpt(v, node); break;
        case 'trainReset': app.trainingReset(); break;
        case 'card': app.selectCard(v); break;
        case 'aiMode': app.setTrainingAI(v); break;
        case 'resume': app.resume(); break;
        case 'surrender': app.surrender(); break;
        case 'quit': app.quitMatch(); break;
        case 'restart': app.restartRound(); break;
        case 'wipe': app.wipeData(node); break;
        case 'lang': FN.I18N.setLang(v); FN.Save.set('lang', v); this.go('settings'); break;
        case 'resetKeys': app.resetKeys(); break;
        case 'rebind': app.startRebind(v, node); break;
        case 'ftueSkip': app.skipFTUE(); break;
        case 'copyQR': app.toggleQR(node); break;
      }
    },

    onSet: function (key, val, node, live) {
      var app = this.app, S = FN.Save.data;
      var parts = key.split('.');
      if (parts.length === 2) {
        if (parts[0] === 'vol') { S.volume[parts[1]] = parseFloat(val); FN.Audio.setVol(parts[1], parseFloat(val)); }
        else S[parts[0]] = parts[1] === '_' ? val : val;
      } else {
        S[key] = (node.type === 'checkbox') ? val : (isNaN(parseFloat(val)) ? val : parseFloat(val));
      }
      if (key === 'scheme') app.onSchemeChange(val);
      if (key === 'fontScale') document.documentElement.style.setProperty('--fs', (val / 100));
      if (key === 'colorMode') app.onColorMode(val);
      FN.Save.save();
      if (live && node.nextElementSibling && node.nextElementSibling.classList.contains('val')) {
        node.nextElementSibling.textContent = Math.round(parseFloat(val) * (val <= 1 ? 100 : 1)) + (val <= 1 ? '%' : '');
      }
    },

    go: function (screen, params) {
      this.screen = screen; this.params = params || {};
      this.anims.length = 0;
      var fn = this['render_' + screen];
      if (!fn) return;
      this.el.innerHTML = fn.call(this, this.params);
      this.el.className = 'overlay scr-' + screen;
      this.el.style.display = 'flex';
      if (this['after_' + screen]) this['after_' + screen](this.params);
    },
    hide: function () { this.el.style.display = 'none'; this.el.innerHTML = ''; this.screen = null; },
    toast: function (msg) {
      var d = document.createElement('div');
      d.className = 'toast'; d.textContent = msg;
      document.getElementById('toastBox').appendChild(d);
      setTimeout(function () { d.classList.add('out'); }, 1800);
      setTimeout(function () { d.remove(); }, 2600);
    },
    tick: function (time) {
      for (var i = 0; i < this.anims.length; i++) this.anims[i](time);
    }
  };

  /* ---------------- 主菜单（FR1）---------------- */
  UI.render_title = function () {
    var s = FN.Save.data;
    return `
    <div class="title-wrap">
      <div class="logo">
        <div class="logo-main">FIGHT<span>NEXUS</span></div>
        <div class="logo-sub">${t('title.tag')}</div>
      </div>
      <div class="menu">
        <button class="btn big primary" data-act="goto" data-v="mode">${t('menu.versus')}</button>
        <button class="btn big" data-act="goto" data-v="training">${t('menu.training')}</button>
        <button class="btn big" data-act="goto" data-v="settings">${t('menu.settings')}</button>
        <button class="btn big" data-act="goto" data-v="about">${t('menu.about')}</button>
      </div>
      <div class="title-foot">
        <span>v1.0.0 · R1.0</span>
        <span class="fpsbtn" data-act="goto" data-v="settings">${s.fps ? 'FPS ON' : 'FPS'}</span>
      </div>
    </div>`;
  };

  /* ---------------- 模式选择（FR2）---------------- */
  UI.render_mode = function () {
    var d = this.app.params.difficulty || FN.Save.data.difficulty;
    var dif = ['casual', 'standard', 'expert'].map(function (k) {
      return `<button class="chip ${d === k ? 'on' : ''}" data-act="diff" data-v="${k}">${t('diff.' + k)}</button>`;
    }).join('');
    return `
    <div class="panel">
      <h2>${t('mode.title')}</h2>
      <div class="modes">
        <button class="mode-card primary" data-act="mode" data-v="ai">
          <span class="mc-t">${t('mode.vs_ai')}</span><span class="mc-d">AI 三档 Profile · 动态难度</span>
        </button>
        <button class="mode-card" data-act="mode" data-v="local">
          <span class="mc-t">${t('mode.local')}</span><span class="mc-d">同机两人 · 第二人按任意键加入</span>
        </button>
        <button class="mode-card" data-act="mode" data-v="training">
          <span class="mc-t">${t('mode.train')}</span><span class="mc-d">6 张练习卡 · 帧数据面板</span>
        </button>
        <button class="mode-card disabled" data-act="mode" data-v="online">
          <span class="mc-t">${t('mode.online')}</span><span class="mc-d">${t('mode.online.soon')} · Rollback R1.1</span>
        </button>
      </div>
      <div class="row"><label>${t('set.difficulty')}</label><div class="chips">${dif}</div></div>
      <div class="panel-foot"><button class="btn" data-act="goto" data-v="title">${t('sel.back')}</button></div>
    </div>`;
  };

  /* ---------------- 角色选择（FR3）---------------- */
  UI.render_charselect = function () {
    var p = this.app.params;
    var cards = FN.CHAR_ORDER.map(function (id, i) {
      var c = FN.CHARS[id];
      var nov = c.novice ? `<span class="tag novice">${t('sel.novice')}</span>` : '';
      var stars = '★'.repeat(c.stars) + '☆'.repeat(3 - c.stars);
      var keys = c.keywords.map(function (k) { return `<span class="kw">${k}</span>`; }).join('');
      var blocked = (p.p1 === id && p.p2) || (p.p2 === id && p.p1) ? 'blocked' : '';
      var cur1 = p.p1 === id ? 'c1' : '', cur2 = p.p2 === id ? 'c2' : '';
      return `
      <div class="char-card ${blocked} ${cur1} ${cur2}" data-act="pick" data-v="${id}">
        <canvas class="cc-portrait" width="220" height="230" data-char="${id}"></canvas>
        <div class="cc-body">
          <div class="cc-name">${c.cn} <em>${c.name}</em></div>
          <div class="cc-type">${c.type}</div>
          <div class="cc-kw">${keys}</div>
          <div class="cc-stars">${stars}</div>
        </div>
        ${nov}
        <div class="cc-cursors"><i class="cur1">P1</i><i class="cur2">P2</i></div>
      </div>`;
    }).join('');
    var joinHint = (p.mode === 'local' && !p.p2) ? `<div class="join-hint">${t('sel.p2join')}</div>` : '';
    var scheme = FN.Save.data.scheme;
    var preview = p.previewChar || p.p1 || 'kael';
    var sig = FN.CHARS[preview].signature;
    var km = FN.Save.data.keymaps.p1;
    return `
    <div class="panel wide">
      <h2>${t('sel.title')}</h2>
      <div class="chars">${cards}</div>
      ${joinHint}
      <div class="cs-foot">
        <div class="cs-preview">
          <canvas id="sigCanvas" width="220" height="230"></canvas>
          <div class="cs-prev-label">${FN.I18N.moveName(preview, sig)}
            <b>${FN.Input.hintFor(preview, sig, scheme, km)}</b></div>
        </div>
        <div class="cs-actions">
          <div class="scheme-line">${t('set.scheme')}：<b>${FN.SCHEMES[scheme].name}</b>
            <button class="btn sm" data-act="goto" data-v="settings">改</button></div>
          <div class="fair">${t('set.fair')}</div>
          <button class="btn primary big" data-act="confirm">${t('sel.confirm')}</button>
          <button class="btn" data-act="back">${t('sel.back')}</button>
        </div>
      </div>
    </div>`;
  };
  UI.after_charselect = function () {
    var self = this;
    var cards = this.el.querySelectorAll('.cc-portrait');
    cards.forEach(function (cv) {
      var id = cv.getAttribute('data-char');
      var ctx = cv.getContext('2d');
      self.anims.push(function (time) {
        ctx.clearRect(0, 0, cv.width, cv.height);
        var ph = (Math.sin(time / 900) + 1) / 2;
        FN.drawPortrait(ctx, id, cv.width, cv.height, time, null);
        ctx.globalAlpha = 0.18; ctx.fillStyle = '#00e5ff';
        ctx.fillRect(0, cv.height - 60 * ph, cv.width, 60 * ph); ctx.globalAlpha = 1;
      });
    });
    var sig = document.getElementById('sigCanvas');
    if (sig) {
      var sctx = sig.getContext('2d');
      var p = this.app.params;
      var id = p.previewChar || p.p1 || 'kael';
      var mv = FN.CHARS[id].signature;
      var move = FN.FRAMES[id][mv];
      var total = move.startup + move.active + move.recovery;
      this.anims.push(function (time) {
        var f = Math.floor(time / 45) % (total + 12);
        sctx.clearRect(0, 0, sig.width, sig.height);
        var ch = FN.CHARS[id];
        var fake = {
          char: ch, x: 0, y: 0, facing: 1, state: 'attack', move: move, mf: Math.min(f, total),
          vy: 0, airborne: false, crouching: !!move.crouch, blocking: false, idx: 0,
          flash: 0, hurtFlash: 0, downTimer: 0, vx: 0
        };
        var pose = FN.poseAt(move, fake.mf);
        sctx.save(); sctx.translate(sig.width / 2, sig.height * 0.94);
        var s = sig.height / 260; sctx.scale(s, s);
        FN.drawFighter(sctx, fake, time, { pose: pose, groundY: 0 });
        sctx.restore();
      });
    }
  };

  /* ---------------- 设置（FR8）---------------- */
  function row(label, ctrl, note) {
    return `<div class="row"><label>${label}</label><div class="ctrl">${ctrl}</div>${note ? `<div class="note">${note}</div>` : ''}</div>`;
  }
  function slider(set, val, min, max, step, fmt) {
    return `<input type="range" data-set="${set}" min="${min}" max="${max}" step="${step}" value="${val}">
      <span class="val">${fmt ? fmt(val) : Math.round(val * 100) + '%'}</span>`;
  }
  UI.render_settings = function () {
    var S = FN.Save.data;
    var vol = function (k) { return slider('vol.' + k, S.volume[k], 0, 1, 0.05); };
    var schemes = Object.keys(FN.SCHEMES).map(function (k) {
      var s = FN.SCHEMES[k];
      return `<label class="scheme-opt ${S.scheme === k ? 'on' : ''}">
        <input type="radio" name="sch" data-set="scheme" value="${k}" ${S.scheme === k ? 'checked' : ''}>
        <span class="so-t">${s.name}</span><span class="so-d">${s.desc}</span></label>`;
    }).join('');
    var keys = function (p) {
      return ['up', 'down', 'left', 'right', 'LP', 'HP', 'LK', 'HK', 'THROW', 'ASSIST'].map(function (k) {
        return `<button class="keybtn" data-act="rebind" data-v="${p}.${k}">${k}<b>${FN.Input.keyLabel(S.keymaps[p][k])}</b></button>`;
      }).join('');
    };
    return `
    <div class="panel wide scroll">
      <h2>${t('set.title')}</h2>
      <div class="settings">
        <div class="grp"><h3>${t('set.audio')}</h3>
          ${row(t('set.bgm'), vol('bgm'))}
          ${row(t('set.sfx'), vol('sfx'))}
          ${row(t('set.hitsfx'), `<select data-set="hitIntensity">
            <option value="soft" ${S.hitIntensity === 'soft' ? 'selected' : ''}>柔和</option>
            <option value="standard" ${S.hitIntensity === 'standard' ? 'selected' : ''}>标准</option>
            <option value="heavy" ${S.hitIntensity === 'heavy' ? 'selected' : ''}>重</option></select>`)}
          ${row(t('set.mute'), `<input type="checkbox" data-set="muted" ${S.muted ? 'checked' : ''}>`)}
        </div>
        <div class="grp"><h3>${t('set.display')}</h3>
          ${row(t('set.fps'), `<input type="checkbox" data-set="fps" ${S.fps ? 'checked' : ''}>`)}
          ${row(t('set.quality'), `<select data-set="quality">
            <option value="auto" ${S.quality === 'auto' ? 'selected' : ''}>自动</option>
            <option value="smooth" ${S.quality === 'smooth' ? 'selected' : ''}>流畅</option>
            <option value="high" ${S.quality === 'high' ? 'selected' : ''}>高清</option></select>`)}
          ${row(t('set.shake'), slider('shake', S.shake, 0, 100, 5, function (v) { return v + '%'; }))}
          ${row(t('set.flash'), `<input type="checkbox" data-set="flash" ${S.flash ? 'checked' : ''}>`, '光敏癫痫保护')}
        </div>
        <div class="grp"><h3>${t('set.control')}</h3>
          <div class="schemes">${schemes}</div>
          <div class="fair-box">${t('set.fair')}</div>
          ${row('P1 ' + t('set.keymap'), `<div class="keys">${keys('p1')}</div>`)}
          ${row('P2 ' + t('set.keymap'), `<div class="keys">${keys('p2')}</div>`)}
          <button class="btn sm" data-act="resetKeys">${t('reset')}</button>
        </div>
        <div class="grp"><h3>${t('set.battle')}</h3>
          ${row(t('set.difficulty'), `<select data-set="difficulty">
            <option value="casual" ${S.difficulty === 'casual' ? 'selected' : ''}>${t('diff.casual')}</option>
            <option value="standard" ${S.difficulty === 'standard' ? 'selected' : ''}>${t('diff.standard')}</option>
            <option value="expert" ${S.difficulty === 'expert' ? 'selected' : ''}>${t('diff.expert')}</option></select>`)}
          ${row(t('set.dynamic'), `<input type="checkbox" data-set="dynamic" ${S.dynamic ? 'checked' : ''}>`, '仅在 Round 之间调整，浮动 ≤ ±20%')}
          ${row(t('set.coach'), `<input type="checkbox" data-set="coach" ${S.coach ? 'checked' : ''}>`)}
          ${row(t('set.hitbox'), `<input type="checkbox" data-set="hitbox" ${S.hitbox ? 'checked' : ''}>`)}
        </div>
        <div class="grp"><h3>${t('set.a11y')}</h3>
          ${row(t('set.color'), `<select data-set="colorMode">
            <option value="standard" ${S.colorMode === 'standard' ? 'selected' : ''}>标准（红/白）</option>
            <option value="blueYellow" ${S.colorMode === 'blueYellow' ? 'selected' : ''}>蓝黄方案</option>
            <option value="highContrast" ${S.colorMode === 'highContrast' ? 'selected' : ''}>高对比</option></select>`)}
          ${row(t('set.font'), slider('fontScale', S.fontScale, 90, 130, 5, function (v) { return v + '%'; }))}
          ${row(t('set.sub'), `<input type="checkbox" data-set="subtitles" ${S.subtitles ? 'checked' : ''}>`)}
          ${row(t('set.keyhint'), `<input type="checkbox" data-set="keyHintAlways" ${S.keyHintAlways ? 'checked' : ''}>`)}
        </div>
        <div class="grp"><h3>${t('set.data')}</h3>
          ${row(t('set.lang'), `<select data-set="lang">
            <option value="zh" ${S.lang === 'zh' ? 'selected' : ''}>简体中文</option>
            <option value="en" ${S.lang === 'en' ? 'selected' : ''}>English</option></select>`)}
          <div class="privacy">R1.0 不收集任何个人身份信息。键位/设置/成就存于本地 localStorage，可一键清除。高光片段仅在用户主动点击分享时生成。</div>
          <button class="btn danger sm" data-act="wipe">${t('set.wipe')}</button>
        </div>
      </div>
      <div class="panel-foot"><button class="btn primary" data-act="back">${t('ok')}</button></div>
    </div>`;
  };
  UI.after_settings = function () {
    var self = this;
    this.el.querySelectorAll('select[data-set="lang"]').forEach(function (s) {
      s.addEventListener('change', function () { FN.I18N.setLang(s.value); FN.Save.set('lang', s.value); self.go('settings'); });
    });
  };

  /* ---------------- 关于 / 公平契约 / 成长（FR13）---------------- */
  function spark(arr, w, h, color) {
    if (!arr.length) return '<span class="muted">—</span>';
    var mx = Math.max.apply(null, arr.concat([1])), mn = Math.min.apply(null, arr.concat([0]));
    var pts = arr.map(function (v, i) {
      var x = (i / Math.max(1, arr.length - 1)) * w;
      var y = h - ((v - mn) / Math.max(0.0001, mx - mn)) * h;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }
  UI.render_about = function () {
    var st = FN.Save.stats;
    var achs = FN.ACHIEVEMENTS.map(function (a) {
      var got = !!st.achievements[a.id];
      return `<div class="ach ${got ? 'got' : ''}"><b>${a.name}</b><span>${a.desc}</span><i>${got ? '✓' : ''}</i></div>`;
    }).join('');
    var g = function (k, label, pct) {
      var v = FN.Growth.avg(k), tr = FN.Growth.trend(k);
      var arrow = tr > 0.02 ? '<u class="up">▲</u>' : (tr < -0.02 ? '<u class="dn">▼</u>' : '<u>—</u>');
      return `<div class="growth-row"><span>${label}</span>
        <b>${pct ? Math.round(v * 100) + '%' : v.toFixed(1)}</b>${arrow}
        ${spark(st.skill[k], 120, 28, '#00e5ff')}</div>`;
    };
    return `
    <div class="panel wide scroll">
      <h2>${t('menu.about')}</h2>
      <div class="about-grid">
        <div class="grp">
          <h3>FIGHT NEXUS · ${t('about.ver')} 1.0.0（R1.0）</h3>
          <p>轻量的正统格斗。三档操作范式共享同一套帧数据与伤害表，差异仅在输入方式。</p>
          <p class="muted">90 秒学会，一辈子练不完。</p>
        </div>
        <div class="grp">
          <h3>${t('about.fair')}</h3>
          <ol class="fair-list">
            <li>三档共享同一份帧数据与同一份伤害表，不存在任何隐藏加成。</li>
            <li>帧数据表完全公开，任何人都可以读表验证（设置 → 战斗 → Hitbox 可视化；训练模式帧数据面板）。</li>
            <li>Assist+ 不进入任何在线匹配，它只为一起玩得开心存在。</li>
            <li>不存在任何影响胜负的随机源，包括暴击、命中浮动、伤害抖动。</li>
            <li>每次数值调整都在版本说明中完整披露，并附带调整依据。</li>
          </ol>
        </div>
        <div class="grp">
          <h3>${t('about.growth')}</h3>
          <div class="growth">
            ${g('specialSuccess', t('growth.special'), true)}
            ${g('comboLen', t('growth.combo'), false)}
            ${g('blockRate', t('growth.block'), true)}
            ${g('techRate', t('growth.tech'), true)}
            ${g('punishRate', t('growth.punish'), true)}
          </div>
          <div class="stat-mini">对局 ${st.matches} · 胜 ${st.wins} · 最长连段 ${st.longestCombo} · 当前 HSI ${FN.Growth.hsi()}</div>
        </div>
        <div class="grp">
          <h3>${t('ach.title')}</h3>
          <div class="achs">${achs}</div>
        </div>
      </div>
      <div class="panel-foot"><button class="btn primary" data-act="back">${t('close')}</button></div>
    </div>`;
  };

  /* ---------------- 结算页（FR5：进步优先）---------------- */
  UI.render_result = function () {
    var r = this.app.resultData;
    if (!r) return '';
    var me = r.players[r.view], op = r.players[1 - r.view];
    var titleKey = r.winner === -2 ? 'res.title_draw' : (me.win ? 'res.title_win' : 'res.title_lose');
    var recs = r.records.map(function (x) {
      return `<div class="rec ${x.new ? 'new' : ''}"><b>${x.value}</b><span>${x.label}</span>${x.new ? `<i>${t('res.newrec')}</i>` : ''}</div>`;
    }).join('');
    var stats = [
      [t('stat.hits'), me.hits, op.hits], [t('stat.taken'), me.taken, op.taken],
      [t('stat.punish'), me.punish, op.punish], [t('stat.super'), me.supers, op.supers],
      [t('stat.combo'), me.maxCombo, op.maxCombo]
    ].map(function (s) {
      var mx = Math.max(1, s[1], s[2]);
      return `<div class="stat-row"><span>${s[0]}</span>
        <div class="bars"><i style="width:${(s[1] / mx * 100).toFixed(0)}%" class="b1"></i><i style="width:${(s[2] / mx * 100).toFixed(0)}%" class="b2"></i></div>
        <b>${s[1]}</b><em>${s[2]}</em></div>`;
    }).join('');
    var coach = r.coach ? `<div class="coach-tip"><b>${t('res.coach')}</b><span>${r.coach}</span></div>` : '';
    return `
    <div class="panel result wide">
      <div class="res-head ${me.win ? 'win' : 'lose'}">
        <div class="res-title">${t(titleKey)}</div>
        <div class="res-sub">${r.subtitle}</div>
      </div>
      <div class="res-grid">
        <div class="res-left">
          <div class="res-best"><canvas id="replayCanvas" width="440" height="248"></canvas>
            <div class="res-best-tag">${t('res.best')}</div></div>
          <div class="res-records">${recs}</div>
        </div>
        <div class="res-right">
          <h4>${t('res.stats')}</h4>
          <div class="stats">${stats}</div>
          ${coach}
          <div class="res-actions">
            <button class="btn primary big" data-act="rematch">${t('res.again')}</button>
            <button class="btn" data-act="share">${t('res.share')}</button>
            <button class="btn" data-act="goto" data-v="charselect">${t('res.resel')}</button>
            <button class="btn" data-act="goto" data-v="title">${t('res.menu')}</button>
          </div>
          <div class="res-opp">对手：${FN.CHARS[op.char].cn} · ${r.oppLabel} · 输入档位 ${FN.SCHEMES[op.scheme].name}</div>
        </div>
      </div>
    </div>`;
  };

  /* ---------------- 分享（FR11）---------------- */
  UI.render_share = function () {
    return `
    <div class="panel share">
      <h2>${t('share.title')}</h2>
      <div class="share-grid">
        <div class="share-card"><canvas id="shareCardCanvas" width="480" height="270"></canvas></div>
        <div class="share-actions">
          <p class="muted">片段由输入流重演生成（非录屏），不含任何用户标识。</p>
          <button class="btn primary" data-act="downloadClip">${t('share.download')}</button>
          <button class="btn" data-act="downloadCard">${t('share.card')}</button>
          <button class="btn" data-act="copyLink">${t('share.copy')}</button>
          <button class="btn" data-act="closeShare">${t('close')}</button>
          <div class="qr" id="qrBox"></div>
        </div>
      </div>
    </div>`;
  };

  /* ---------------- 训练面板（FR6，非模态）---------------- */
  UI.render_training = function () {
    var a = this.app;
    var tr = a.trainingOpts || {};
    var cards = FN.PRACTICE_CARDS.map(function (c) {
      var on = tr.cardId === c.id;
      return `<button class="pcard ${on ? 'on' : ''}" data-act="card" data-v="${c.id}">
        <b>${c.id} · ${c.name}</b><span>${c.task}</span><span class="cond">${c.cond}</span>
        <i>${c.ability}</i></button>`;
    }).join('');
    var aiModes = ['stand', 'block', 'counter', 'random'].map(function (m) {
      return `<button class="chip ${tr.aiMode === m ? 'on' : ''}" data-act="aiMode" data-v="${m}">${t('train.ai.' + m)}</button>`;
    }).join('');
    var prog = a.match && a.match.training && a.match.training.card ?
      `<div class="pc-prog">${a.match.training.card.name}：${a.match.training.card.cur || 0} / ${a.match.training.card.target}</div>` : '';
    var fd = a.match ? a.frameDataRows() : '';
    return `
    <div class="train-panel">
      <div class="tp-head">${t('train.title')}<span class="muted">${t('train.hint')}</span></div>
      <div class="tp-row"><label>${t('set.battle')}</label>
        <button class="btn sm" data-act="trainReset">${t('train.reset')}</button>
        <label class="ck"><input type="checkbox" data-act="trainOpt" data-v="infHp" ${tr.infHp ? 'checked' : ''}>${t('train.infhp')}</label>
        <label class="ck"><input type="checkbox" data-act="trainOpt" data-v="infMeter" ${tr.infMeter ? 'checked' : ''}>${t('train.infmeter')}</label>
        <label class="ck"><input type="checkbox" data-act="trainOpt" data-v="hitbox" ${tr.hitbox ? 'checked' : ''}>Hitbox</label>
      </div>
      <div class="tp-row"><label>${t('train.ai')}</label><div class="chips">${aiModes}</div></div>
      <div class="tp-cards">${cards}</div>
      ${prog}
      <div class="tp-frame"><b>${t('train.frame')}</b><div class="fd">${fd}</div></div>
      <div class="tp-foot"><button class="btn sm" data-act="goto" data-v="title">${t('res.menu')}</button></div>
    </div>`;
  };
  UI.after_training = function () {
    var self = this, app = this.app;
    this.el.querySelectorAll('input[data-act="trainOpt"]').forEach(function (n) {
      n.addEventListener('change', function () { app.setTrainingOpt(n.getAttribute('data-v'), n); });
    });
  };

  /* ---------------- 暂停（FR9）---------------- */
  UI.render_pause = function () {
    return `
    <div class="panel narrow">
      <h2>${t('pause.title')}</h2>
      <div class="menu">
        <button class="btn primary" data-act="resume">${t('pause.resume')}</button>
        <button class="btn" data-act="restart">${t('pause.restart')}</button>
        <button class="btn" data-act="surrender">${t('pause.surrender')}</button>
        <button class="btn danger" data-act="quit">${t('pause.quit')}</button>
      </div>
    </div>`;
  };

  /* ---------------- FTUE 提示层 ---------------- */
  UI.render_ftue = function () {
    var a = this.app, f = a.ftueState;
    if (!f) return '';
    var step = FN.FTUE[f.step - 1] || {};
    var skip = f.step >= 2 ? `<button class="ftue-skip" data-act="ftueSkip">${t('ftue.skip')}</button>` : '';
    return `
    <div class="ftue">
      <div class="ftue-key">${f.keyHint || ''}</div>
      <div class="ftue-txt">${step.text || ''}</div>
      <div class="ftue-dots">${FN.FTUE.map(function (s, i) { return `<i class="${i < f.step ? 'on' : ''}"></i>`; }).join('')}</div>
      ${skip}
    </div>`;
  };
})(window.FN);
