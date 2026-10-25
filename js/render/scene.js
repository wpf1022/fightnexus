/* =============================================================
 * FightNexus · scene.js
 * 舞台（黄昏街机厅）· 相机 · 打击感 FX · HUD · Hitbox 可视化
 * §5.2 M1：顿帧 + 震屏 + 白闪 + 伤害数字 + 音效，五种反馈 8 帧内同时发生
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var C = FN.CFG, U = FN.U;
  var VW = C.VIEW_W, VH = C.VIEW_H;

  /* ---------------- FX 系统 ---------------- */
  var FX = FN.FX = {
    parts: [], texts: [], rings: [],
    shake: 0, shakeMag: 0, flash: 0, flashColor: '#fff',
    freeze: 0, zoomPulse: 0, speedlines: 0,
    reset: function () { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.shake = 0; this.flash = 0; this.freeze = 0; },
    spark: function (x, y, type, dir) {
      var n = type === 'super' ? 34 : (type === 'heavy' || type === 'special' ? 22 : 14);
      var cols = type === 'super' ? ['#fff', '#ffd23f', '#ff8a3d', '#ff2fb3'] :
        (type === 'special' ? ['#fff', '#8ef1ff', '#37c8ff'] : ['#fff', '#ffe9a8', '#ffb03d']);
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i / n) + Math.random() * 0.7;
        var sp = (2.2 + Math.random() * 6.5) * (type === 'light' ? 0.7 : 1.15);
        this.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp * (dir || 1) + (dir || 1) * 1.6,
          vy: Math.sin(a) * sp - 1.2, life: 14 + Math.random() * 12, max: 26,
          w: 3 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], g: 0.16, t: 'spark'
        });
      }
      this.rings.push({ x: x, y: y, r: 6, life: type === 'super' ? 22 : 12, max: type === 'super' ? 22 : 12, c: type === 'super' ? '#ffd23f' : '#fff', w: type === 'super' ? 6 : 3 });
      if (type !== 'light') this.speedlines = Math.max(this.speedlines, 12);
    },
    dust: function (x, y, n, dir) {
      for (var i = 0; i < (n || 8); i++) {
        this.parts.push({
          x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 8,
          vx: (Math.random() - 0.5) * 3 + (dir || 0), vy: -Math.random() * 1.6,
          life: 20 + Math.random() * 14, max: 34, w: 6 + Math.random() * 10,
          c: 'rgba(255,220,180,0.5)', g: -0.02, t: 'dust'
        });
      }
    },
    text: function (x, y, str, color, size, rise) {
      this.texts.push({ x: x, y: y, s: str, c: color || '#fff', size: size || 34, life: 46, max: 46, vy: rise == null ? -1.5 : rise, pop: 0 });
    },
    shakeBy: function (mag) { this.shakeMag = Math.max(this.shakeMag, mag); this.shake = Math.max(this.shake, 10); },
    flashBy: function (frames, color) { this.flash = Math.max(this.flash, frames); this.flashColor = color || '#ffffff'; },
    update: function () {
      var i;
      for (i = this.parts.length - 1; i >= 0; i--) {
        var p = this.parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.93; p.life--;
        if (p.life <= 0) this.parts.splice(i, 1);
      }
      for (i = this.texts.length - 1; i >= 0; i--) {
        var t = this.texts[i];
        t.y += t.vy; t.vy *= 0.94; t.life--; t.pop = Math.min(1, t.pop + 0.18);
        if (t.life <= 0) this.texts.splice(i, 1);
      }
      for (i = this.rings.length - 1; i >= 0; i--) {
        var r = this.rings[i]; r.r += (r.t === 'super' ? 16 : 11); r.life--;
        if (r.life <= 0) this.rings.splice(i, 1);
      }
      if (this.shake > 0) { this.shake--; this.shakeMag *= 0.86; if (this.shake <= 0) this.shakeMag = 0; }
      if (this.flash > 0) this.flash--;
      if (this.speedlines > 0) this.speedlines--;
      if (this.zoomPulse > 0) this.zoomPulse--;
    },
    draw: function (ctx, cam) {
      var i, p;
      ctx.save();
      ctx.translate(VW / 2, VH / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        var a = U.clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.c;
        if (p.t === 'dust') { ctx.beginPath(); ctx.arc(p.x, p.y, p.w * (2 - a), 0, Math.PI * 2); ctx.fill(); }
        else {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.w * 2.2, p.w * 0.9, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      for (i = 0; i < this.rings.length; i++) {
        var r = this.rings[i], ra = r.life / r.max;
        ctx.globalAlpha = ra; ctx.strokeStyle = r.c; ctx.lineWidth = r.w * ra;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < this.texts.length; i++) {
        var t = this.texts[i], ta = U.clamp(t.life / t.max, 0, 1);
        var sc = 0.6 + (1 - ta) * 0.1 + t.pop * 0.5;
        ctx.save();
        ctx.translate(t.x, t.y); ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, ta * 1.6);
        ctx.font = '900 ' + t.size + 'px "Arial Black", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(t.s, 0, 0);
        ctx.fillStyle = t.c; ctx.fillText(t.s, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  };

  /* ---------------- 舞台（预渲染）---------------- */
  var Stage = FN.Stage = { far: null, mid: null, ready: false };

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  Stage.build = function () {
    var rnd = U.det(20261024);
    /* 远景：城市剪影 */
    var fw = 1700, fh = 420;
    var f = mk(fw, fh), fc = f.getContext('2d');
    fc.clearRect(0, 0, fw, fh);
    for (var i = 0; i < 46; i++) {
      var bx = i * 38 + rnd() * 12, bw = 26 + rnd() * 34, bh = 90 + rnd() * 210;
      fc.fillStyle = i % 3 === 0 ? '#241a3f' : '#1b1330';
      fc.fillRect(bx, fh - bh, bw, bh);
      for (var w = 0; w < 14; w++) {
        if (rnd() < 0.45) continue;
        fc.fillStyle = rnd() < 0.5 ? 'rgba(255,180,80,0.55)' : 'rgba(120,220,255,0.4)';
        fc.fillRect(bx + 4 + (w % 4) * 7, fh - bh + 10 + Math.floor(w / 4) * 14, 4, 6);
      }
    }
    this.far = f;

    /* 中景：街机厅 */
    var mw = 2600, mh = 470;
    var m = mk(mw, mh), mc = m.getContext('2d');
    var g = mc.createLinearGradient(0, 0, 0, mh);
    g.addColorStop(0, '#4a1f52'); g.addColorStop(0.55, '#88285a'); g.addColorStop(1, '#c94a3c');
    mc.fillStyle = g; mc.fillRect(0, 0, mw, mh);
    // 霓虹招牌
    var signs = ['FIGHT NEXUS', 'ARCADE', 'ROUND 1', 'CREDIT 99', 'NEXUS', 'VS'];
    for (var s = 0; s < 16; s++) {
      var sx = 80 + s * 158 + rnd() * 40, sy = 60 + rnd() * 150;
      var sw = 90 + rnd() * 70, sh = 26 + rnd() * 22;
      var col = ['#ff2fb3', '#00e5ff', '#ffd23f', '#8cff4d'][(rnd() * 4) | 0];
      mc.globalAlpha = 0.85;
      mc.strokeStyle = col; mc.lineWidth = 3;
      mc.strokeRect(sx, sy, sw, sh);
      mc.fillStyle = col; mc.globalAlpha = 0.16; mc.fillRect(sx, sy, sw, sh);
      mc.globalAlpha = 0.95;
      mc.font = '700 15px system-ui, sans-serif'; mc.fillStyle = col; mc.textAlign = 'center';
      mc.fillText(signs[(rnd() * signs.length) | 0], sx + sw / 2, sy + sh * 0.68);
      mc.globalAlpha = 1;
    }
    // 街机机台剪影
    for (var c2 = 0; c2 < 30; c2++) {
      var cx = 40 + c2 * 88 + rnd() * 20, cy = mh - 150 - rnd() * 30;
      mc.fillStyle = '#150d24';
      mc.fillRect(cx, cy, 62, 150);
      mc.fillStyle = 'rgba(0,229,255,0.5)'; mc.fillRect(cx + 10, cy + 14, 42, 26);
      mc.fillStyle = 'rgba(255,47,179,0.35)'; mc.fillRect(cx + 8, cy + 50, 46, 12);
    }
    // 顶部灯带
    for (var l = 0; l < 60; l++) {
      var lx = l * 44 + 20;
      mc.fillStyle = 'rgba(255,220,140,0.85)';
      mc.beginPath(); mc.arc(lx, 18, 6, 0, Math.PI * 2); mc.fill();
      mc.globalAlpha = 0.18; mc.fillStyle = '#ffd23f';
      mc.beginPath(); mc.arc(lx, 18, 20, 0, Math.PI * 2); mc.fill(); mc.globalAlpha = 1;
    }
    this.mid = m;
    this.ready = true;
  };

  Stage.draw = function (ctx, cam) {
    /* 天空 */
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#1a0f38'); g.addColorStop(0.42, '#5b1f5e');
    g.addColorStop(0.72, '#e8573f'); g.addColorStop(0.92, '#ffb35c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    /* 太阳 */
    var sunX = VW * 0.5 - cam.x * 0.06, sunY = 330;
    var sg = ctx.createLinearGradient(0, sunY - 120, 0, sunY + 120);
    sg.addColorStop(0, '#fff3b0'); sg.addColorStop(1, '#ff7a3c');
    ctx.save(); ctx.beginPath(); ctx.arc(sunX, sunY, 116, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.globalAlpha = 0.32; ctx.fillStyle = '#5b1f5e';
    for (var b = 0; b < 7; b++) ctx.fillRect(sunX - 130, sunY - 40 + b * 24, 260, 9);
    ctx.restore();
    /* 云 */
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff9a6b';
    for (var i = 0; i < 6; i++) {
      var cx = ((i * 420 - cam.x * 0.12) % (VW + 600)) - 200;
      ctx.beginPath(); ctx.ellipse(cx, 120 + (i % 3) * 46, 150, 15, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* 远景 */
    var fx = -cam.x * 0.28 - 40, fy = VH - 470 - 40;
    ctx.drawImage(this.far, 0, 0, this.far.width, this.far.height, fx, fy, this.far.width, this.far.height);
    /* 中景 */
    var mx = -cam.x * 0.62 - 60, my = VH - 470 - 26;
    ctx.drawImage(this.mid, 0, 0, this.mid.width, this.mid.height, mx, my, this.mid.width, this.mid.height);
  };

  /* 地面 */
  function drawFloor(ctx, cam) {
    var gy = C.GROUND_Y;
    var g = ctx.createLinearGradient(0, gy - 10, 0, VH);
    g.addColorStop(0, '#3a2340'); g.addColorStop(0.25, '#241530'); g.addColorStop(1, '#120a1c');
    ctx.fillStyle = g;
    ctx.fillRect(-2000, gy, C.STAGE_W + 4000, VH - gy + 200);
    ctx.strokeStyle = 'rgba(255,140,60,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2000, gy); ctx.lineTo(C.STAGE_W + 2000, gy); ctx.stroke();
    // 透视网格
    ctx.strokeStyle = 'rgba(255,90,140,0.16)'; ctx.lineWidth = 2;
    for (var i = -20; i < 90; i++) {
      var x = i * 60;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + (x - VW / 2) * 0.5, VH + 60); ctx.stroke();
    }
    for (var j = 1; j < 6; j++) {
      var yy = gy + j * j * 7;
      ctx.beginPath(); ctx.moveTo(-2000, yy); ctx.lineTo(C.STAGE_W + 2000, yy); ctx.stroke();
    }
    // 霓虹倒影
    ctx.globalAlpha = 0.16;
    for (var s = 0; s < 10; s++) {
      var sx = ((s * 260 - cam.x * 0.62) % 2600) - 130;
      ctx.fillStyle = s % 2 ? '#00e5ff' : '#ff2fb3';
      ctx.fillRect(sx, gy + 6, 120, 120);
    }
    ctx.globalAlpha = 1;
    // 舞台边界
    ctx.fillStyle = 'rgba(255,210,63,0.5)';
    ctx.fillRect(-6, gy - 6, 6, 130); ctx.fillRect(C.STAGE_W, gy - 6, 6, 130);
  }

  /* ---------------- 相机 ---------------- */
  function camera(match) {
    var f = match.fighters;
    var mid = (f[0].x + f[1].x) / 2;
    var spread = Math.abs(f[0].x - f[1].x) + Math.abs(f[0].y - f[1].y) * 0.6;
    var zoom = U.clamp(1.16 - (spread - 260) / 2600, 0.92, 1.18);
    if (FX.zoomPulse > 0) zoom *= 1.12;
    var half = VW / 2 / zoom;
    var cx = U.clamp(mid, half, C.STAGE_W - half);
    var cy = C.GROUND_Y - (VH * 0.5 - 100) / zoom + 120;
    var sh = FX.shake > 0 ? FX.shakeMag : 0;
    return {
      x: cx + (Math.random() - 0.5) * sh, y: cy + (Math.random() - 0.5) * sh * 0.6,
      zoom: zoom
    };
  }
  FN.camera = camera;

  /* ---------------- 主绘制 ---------------- */
  var PALETTE = {
    standard: { p1: '#3ba7ff', p2: '#ff4d5e', hp: '#ff3b4e', hpBack: '#f4f4f8', meter: '#ffd23f' },
    blueYellow: { p1: '#ffd23f', p2: '#2f7fff', hp: '#2f7fff', hpBack: '#f4f4f8', meter: '#ffd23f' },
    highContrast: { p1: '#ffffff', p2: '#ffdd00', hp: '#ffdd00', hpBack: '#101010', meter: '#ffffff' }
  };

  FN.drawWorld = function (ctx, match, opts) {
    var cam = camera(match);
    opts = opts || {};
    ctx.save();
    Stage.draw(ctx, cam);
    ctx.translate(VW / 2, VH / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
    drawFloor(ctx, cam);
    if (FX.speedlines > 0) drawSpeedLines(ctx, cam);
    var f = match.fighters;
    var order = f[0].y > f[1].y ? [1, 0] : [0, 1];
    for (var i = 0; i < 2; i++) {
      var ff = f[order[i]];
      FN.drawFighter(ctx, ff, opts.t || 0, { groundY: C.GROUND_Y });
    }
    drawProjectiles(ctx, match);
    FX.draw(ctx, cam);
    if (opts.hitbox) drawHitboxes(ctx, match);
    ctx.restore();
    ctx.save();
    // 全屏闪白 / 闪色
    if (FX.flash > 0) {
      ctx.globalAlpha = U.clamp(FX.flash / 6, 0, 0.85);
      ctx.fillStyle = FX.flashColor; ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
    drawVignette(ctx);
    ctx.restore();
    return cam;
  };

  function drawSpeedLines(ctx, cam) {
    ctx.save();
    ctx.globalAlpha = 0.34; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    for (var i = 0; i < 22; i++) {
      var y = (i * 61 + (cam.x % 61)) % VH;
      var len = 90 + (i % 5) * 70;
      ctx.beginPath();
      ctx.moveTo(cam.x - VW / 2 + (i % 3) * 200, y);
      ctx.lineTo(cam.x - VW / 2 + (i % 3) * 200 + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVignette(ctx) {
    var g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  function drawProjectiles(ctx, match) {
    var f = match.fighters;
    for (var i = 0; i < match.projectiles.length; i++) {
      var p = match.projectiles[i];
      var pal = f[p.owner].char.pal;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var grad = ctx.createRadialGradient(p.x, C.GROUND_Y + p.y, 4, p.x, C.GROUND_Y + p.y, Math.max(p.w, p.h));
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.4, pal.accent); grad.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, C.GROUND_Y + p.y, p.w * 1.1, p.h * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(p.x, C.GROUND_Y + p.y, p.w * 0.7, p.h * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawHitboxes(ctx, match) {
    var f = match.fighters, i;
    for (i = 0; i < 2; i++) {
      var d = f[i];
      var hb = d.hurtbox();
      ctx.strokeStyle = '#3cff8e'; ctx.lineWidth = 2;
      ctx.strokeRect(hb.x0, C.GROUND_Y - hb.y0 - hb.h, hb.w, hb.h);
      ctx.strokeStyle = 'rgba(60,160,255,0.8)';
      ctx.strokeRect(d.x - C.PUSHBOX_W / 2, C.GROUND_Y - 170, C.PUSHBOX_W, 170);
      var boxes = d.isActive() ? d.hitboxes() : null;
      if (boxes) {
        ctx.fillStyle = 'rgba(255,60,80,0.35)'; ctx.strokeStyle = '#ff3c50'; ctx.lineWidth = 2;
        for (var b = 0; b < boxes.length; b++) {
          ctx.fillRect(boxes[b].x0, C.GROUND_Y - boxes[b].y0 - boxes[b].h, boxes[b].w, boxes[b].h);
          ctx.strokeRect(boxes[b].x0, C.GROUND_Y - boxes[b].y0 - boxes[b].h, boxes[b].w, boxes[b].h);
        }
      }
    }
    for (i = 0; i < match.projectiles.length; i++) {
      var p = match.projectiles[i];
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      ctx.strokeRect(p.x - p.w / 2, C.GROUND_Y - p.y - p.h, p.w, p.h);
    }
  }

  /* ---------------- HUD（§FR4）---------------- */
  FN.drawHUD = function (ctx, match, opts) {
    opts = opts || {};
    var pal = PALETTE[opts.colorMode || 'standard'] || PALETTE.standard;
    var f = match.fighters;
    var i, s = (opts.hudScale || 100) / 100;
    ctx.save();
    ctx.textBaseline = 'middle';

    /* 血条 */
    function bar(idx, x, y, w, h, flip) {
      var p = f[idx];
      var maxw = w;
      ctx.fillStyle = 'rgba(8,8,14,0.72)';
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.fillStyle = pal.hpBack;
      ctx.fillRect(x, y, w, h);
      var hpR = U.clamp(p.hp / p.maxHp, 0, 1);
      var shownR = U.clamp(p.hpShown / p.maxHp, 0, 1);
      // 暂留高亮（最近一次伤害）
      if (shownR > hpR) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(flip ? x + w * (1 - shownR) : x, y, w * (shownR - hpR), h);
      }
      ctx.fillStyle = pal.hp;
      ctx.fillRect(flip ? x + w * (1 - hpR) : x, y, w * hpR, h);
      // 分段刻度
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      for (var k = 1; k < 8; k++) {
        var px = x + w * k / 8;
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
      }
      // 名字
      ctx.font = '800 ' + Math.round(20 * s) + 'px system-ui, sans-serif';
      ctx.fillStyle = idx === 0 ? pal.p1 : pal.p2;
      ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillText(p.char.cn || p.char.name, flip ? x + w : x, y - 16);
      ctx.textAlign = 'left';
    }
    bar(0, 40, 46, 430, 26, false);
    bar(1, VW - 40 - 430, 46, 430, 26, true);

    /* 超必杀槽 */
    function meter(idx, x, y, w, h, flip) {
      var p = f[idx], seg = w / 3;
      ctx.fillStyle = 'rgba(8,8,14,0.7)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      for (var k = 0; k < 3; k++) {
        var sx = x + k * seg + 2, sw = seg - 4;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(sx, y, sw, h);
        var fill = U.clamp((p.meter - k * 100) / 100, 0, 1) * sw;
        if (fill > 0) {
          ctx.fillStyle = pal.meter;
          ctx.fillRect(flip ? sx + sw - fill : sx, y, fill, h);
        }
      }
      if (p.meter >= 100) {
        var pulse = 0.5 + 0.5 * Math.sin((opts.t || 0) / 200);
        ctx.globalAlpha = 0.35 + pulse * 0.5;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
        ctx.globalAlpha = 1;
        if (opts.subtitles !== false) {
          ctx.font = '800 ' + Math.round(13 * s) + 'px system-ui, sans-serif';
          ctx.fillStyle = '#fff'; ctx.textAlign = flip ? 'right' : 'left';
          ctx.fillText('SUPER READY  ' + FN.Input.hintFor(p.charId, 'super', p.scheme, opts.keys ? opts.keys[idx] : {}),
            flip ? x + w : x, y + h + 14);
        }
      }
    }
    meter(0, 40, 82, 300, 12, false);
    meter(1, VW - 40 - 300, 82, 300, 12, true);

    /* Round 标识 */
    for (i = 0; i < 2; i++) {
      var px0 = i === 0 ? 40 : VW - 40 - 16;
      for (var r = 0; r < C.ROUNDS_TO_WIN; r++) {
        var cx = i === 0 ? px0 + r * 22 : px0 - r * 22;
        ctx.beginPath(); ctx.arc(cx + 8, 112, 7, 0, Math.PI * 2);
        ctx.fillStyle = match.wins[i] > r ? (i === 0 ? pal.p1 : pal.p2) : 'rgba(255,255,255,0.22)';
        ctx.fill();
      }
    }

    /* 计时器 */
    var secs = Math.ceil(match.timer / C.FPS);
    ctx.font = '900 ' + Math.round(44 * s) + 'px "Arial Black", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = secs <= 10 ? '#ff5a5a' : '#fff';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(('0' + Math.max(0, secs)).slice(-2), VW / 2, 62);
    ctx.fillText(('0' + Math.max(0, secs)).slice(-2), VW / 2, 62);

    /* 连段计数 */
    for (i = 0; i < 2; i++) {
      var p2 = f[i];
      if (p2.comboCount >= 2) {
        var cx2 = i === 0 ? 150 : VW - 150;
        var cy2 = 190;
        var sc = 1 + Math.min(0.7, p2.comboCount * 0.07);
        ctx.save();
        ctx.translate(cx2, cy2); ctx.scale(sc, sc);
        ctx.font = '900 42px "Arial Black", system-ui, sans-serif';
        ctx.textAlign = i === 0 ? 'left' : 'right';
        ctx.lineWidth = 7; ctx.strokeStyle = '#000';
        ctx.strokeText(p2.comboCount + ' HITS', 0, 0);
        ctx.fillStyle = '#ffd23f'; ctx.fillText(p2.comboCount + ' HITS', 0, 0);
        ctx.font = '800 18px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeText(p2.comboDamage + ' DMG', 0, 30); ctx.fillText(p2.comboDamage + ' DMG', 0, 30);
        ctx.restore();
      }
    }
    ctx.restore();
  };

  /* 大字公告 */
  FN.drawBanner = function (ctx, text, sub, t, color) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var sc = 1 + Math.max(0, (18 - t)) * 0.05;
    ctx.translate(VW / 2, VH * 0.36); ctx.scale(sc, sc);
    ctx.font = '900 96px "Arial Black", system-ui, sans-serif';
    ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(text, 0, 0);
    var g = ctx.createLinearGradient(0, -50, 0, 50);
    g.addColorStop(0, '#fff'); g.addColorStop(1, color || '#ffd23f');
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    if (sub) {
      ctx.font = '800 26px system-ui, sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(sub, 0, 62);
    }
    ctx.restore();
  };

  FN.PALETTE = PALETTE;
})(window.FN);
