/* =============================================================
 * FightNexus · skeleton.js
 * 程序化骨骼动画：无美术资源下的角色表现层
 * 姿态 = 关节角度（度）；招式 = 关键帧姿态序列；表现层与逻辑层严格分离
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';
  var U = FN.U;

  var DEF = { px: 0, py: 0, rot: 0, lean: 0, head: 0, sL: -32, eL: -72, sR: 28, eR: 78, hL: -12, kL: 16, hR: 14, kR: -15, sq: 1 };

  function P(o) { var r = {}; for (var k in DEF) r[k] = DEF[k]; for (var j in o) r[j] = o[j]; return r; }

  var POSES = {
    idle: P({ lean: 5, head: -2, sL: -34, eL: -74, sR: 30, eR: 80, hL: -13, kL: 17, hR: 15, kR: -16 }),
    walkF: P({ lean: 10, sL: -28, eL: -66, sR: 34, eR: 74, hL: -22, kL: 26, hR: 26, kR: -22 }),
    walkB: P({ lean: -3, sL: -40, eL: -80, sR: 24, eR: 86, hL: -6, kL: 12, hR: 4, kR: -8 }),
    crouch: P({ py: -32, lean: 14, sL: -26, eL: -84, sR: 36, eR: 76, hL: -50, kL: 95, hR: 45, kR: -90 }),
    crouchB: P({ py: -32, lean: 8, sL: -18, eL: -100, sR: 46, eR: 96, hL: -50, kL: 95, hR: 45, kR: -90 }),
    jump: P({ py: 4, lean: 2, sL: -52, eL: -48, sR: 42, eR: 60, hL: -34, kL: 62, hR: 22, kR: -48 }),
    jumpFall: P({ py: 0, lean: -2, sL: -40, eL: -40, sR: 36, eR: 52, hL: -20, kL: 40, hR: 34, kR: -30 }),
    jumpTuck: P({ py: 12, lean: 14, sL: -60, eL: -70, sR: 50, eR: 80, hL: -55, kL: 96, hR: 50, kR: -84 }),
    land: P({ py: -16, lean: 16, sL: -20, eL: -70, sR: 40, eR: 70, hL: -34, kL: 60, hR: 34, kR: -56 }),
    blockHigh: P({ lean: -8, sL: 62, eL: 92, sR: 54, eR: 100, hL: -18, kL: 24, hR: 16, kR: -20 }),
    blockLow: P({ py: -28, lean: -4, sL: 50, eL: 88, sR: 44, eR: 96, hL: -50, kL: 95, hR: 45, kR: -90 }),
    hurt: P({ lean: -16, head: -12, sL: -58, eL: -26, sR: -40, eR: -20, hL: -22, kL: 30, hR: 20, kR: -26 }),
    hurtAir: P({ py: 8, lean: -24, sL: -70, eL: -30, sR: -52, eR: -24, hL: -40, kL: 40, hR: 30, kR: -20 }),
    downed: P({ py: -78, rot: -74, lean: 0, sL: -80, eL: -20, sR: 60, eR: 30, hL: -70, kL: 40, hR: 30, kR: -30 }),
    wakeup: P({ py: -46, lean: 20, sL: -30, eL: -80, sR: 44, eR: 84, hL: -52, kL: 92, hR: 40, kR: -80 }),
    win: P({ lean: -6, sL: -110, eL: -30, sR: 40, eR: 60, hL: -14, kL: 18, hR: 16, kR: -18 }),
    intro: P({ lean: 6, sL: -30, eL: -78, sR: 34, eR: 84, hL: -14, kL: 18, hR: 16, kR: -18 }),

    jabWind: P({ lean: 2, sL: -34, eL: -76, sR: 34, eR: 92, hL: -13, kL: 17, hR: 15, kR: -16 }),
    jabHit: P({ lean: 12, sL: -30, eL: -60, sR: 92, eR: 4, hL: -16, kL: 20, hR: 20, kR: -18 }),
    crouchJabWind: P({ py: -28, lean: 10, sL: -28, eL: -82, sR: 40, eR: 90, hL: -50, kL: 95, hR: 45, kR: -90 }),
    crouchJabHit: P({ py: -28, lean: 16, sL: -24, eL: -60, sR: 88, eR: 6, hL: -50, kL: 95, hR: 45, kR: -90 }),
    heavyWind: P({ lean: -14, sL: -22, eL: -60, sR: -44, eR: 112, hL: -20, kL: 26, hR: 8, kR: -10 }),
    heavyHit: P({ lean: 18, sL: 44, eL: 40, sR: 96, eR: -2, hL: -22, kL: 28, hR: 26, kR: -24 }),
    kickWind: P({ lean: -6, sL: -46, eL: -50, sR: 30, eR: 70, hL: -14, kL: 20, hR: -30, kR: 54 }),
    kickHit: P({ lean: -10, sL: 62, eL: 46, sR: 20, eR: 66, hL: -18, kL: 24, hR: 84, kR: -6 }),
    lowKickHit: P({ py: -22, lean: 8, sL: -26, eL: -80, sR: 36, eR: 80, hL: -46, kL: 88, hR: 86, kR: -4 }),
    sweepWind: P({ py: -34, lean: 16, sL: -20, eL: -90, sR: 44, eR: 86, hL: -52, kL: 98, hR: 20, kR: 30 }),
    sweepHit: P({ py: -44, lean: 24, sL: 60, eL: 30, sR: -30, eR: -20, hL: -40, kL: 70, hR: 96, kR: -3 }),
    antiAirWind: P({ py: -30, lean: 12, sL: -24, eL: -86, sR: 30, eR: 104, hL: -48, kL: 92, hR: 44, kR: -88 }),
    antiAirHit: P({ py: -12, lean: -14, sL: -20, eL: -40, sR: -78, eR: -8, hL: -30, kL: 60, hR: 30, kR: -50 }),
    jumpAtkWind: P({ py: 4, lean: 4, sL: -46, eL: -56, sR: 30, eR: 92, hL: -34, kL: 62, hR: 22, kR: -48 }),
    jumpAtkWindH: P({ py: 4, lean: -6, sL: -50, eL: -50, sR: -30, eR: 110, hL: -34, kL: 62, hR: 22, kR: -48 }),
    jumpAtkHit: P({ py: 2, lean: 16, sL: -30, eL: -40, sR: 74, eR: 8, hL: -40, kL: 66, hR: 30, kR: -46 }),
    projWind: P({ py: -10, lean: -8, sL: 40, eL: 96, sR: 34, eR: 100, hL: -30, kL: 40, hR: 30, kR: -30 }),
    projHit: P({ py: -6, lean: 16, sL: 96, eL: 2, sR: 90, eR: 4, hL: -24, kL: 34, hR: 28, kR: -28 }),
    dpWind: P({ py: -26, lean: 16, sL: -30, eL: -90, sR: 24, eR: 108, hL: -50, kL: 96, hR: 44, kR: -88 }),
    dpHit: P({ py: 6, lean: -16, sL: -40, eL: -30, sR: -96, eR: -6, hL: -26, kL: 36, hR: 40, kR: -40 }),
    dpFall: P({ py: 10, lean: 12, sL: -50, eL: -40, sR: 40, eR: 60, hL: -40, kL: 60, hR: 30, kR: -40 }),
    superWind: P({ py: -20, lean: -18, sL: -70, eL: -60, sR: -60, eR: -70, hL: -44, kL: 86, hR: 40, kR: -80 }),
    superHit: P({ py: -4, lean: 10, sL: 100, eL: 0, sR: 92, eR: 2, hL: -26, kL: 36, hR: 30, kR: -28 }),
    superRush: P({ lean: 26, sL: -40, eL: -30, sR: 98, eR: -4, hL: -34, kL: 44, hR: 40, kR: -40 }),
    throwPose: P({ lean: 8, sL: 84, eL: 12, sR: 80, eR: 14, hL: -18, kL: 24, hR: 20, kR: -22 }),
    throwPoseExt: P({ lean: 20, sL: 96, eL: 2, sR: 94, eR: 4, hL: -26, kL: 32, hR: 28, kR: -30 }),
    grabWind: P({ py: -16, lean: -10, sL: -100, eL: -40, sR: -92, eR: -46, hL: -40, kL: 70, hR: 38, kR: -60 }),
    grabHit: P({ py: -8, lean: 14, sL: 90, eL: 10, sR: 86, eR: 12, hL: -30, kL: 48, hR: 30, kR: -40 }),
    grabSlam: P({ py: -40, lean: 34, sL: 120, eL: 10, sR: 116, eR: 12, hL: -50, kL: 90, hR: 46, kR: -86 }),
    smashWind: P({ py: -14, lean: -12, sL: -128, eL: -24, sR: -120, eR: -26, hL: -34, kL: 56, hR: 36, kR: -50 }),
    smashHit: P({ py: -30, lean: 30, sL: 78, eL: 4, sR: 74, eR: 6, hL: -48, kL: 92, hR: 44, kR: -88 }),
    burstWind: P({ py: -18, lean: -14, sL: -60, eL: -80, sR: -54, eR: -84, hL: -40, kL: 70, hR: 38, kR: -60 }),
    burstHit: P({ lean: 16, sL: 92, eL: 6, sR: 88, eR: 8, hL: -26, kL: 38, hR: 30, kR: -30 }),
    rushWind: P({ py: -12, lean: -12, sL: -40, eL: -70, sR: -36, eR: -80, hL: -34, kL: 56, hR: 36, kR: -52 }),
    rushHit: P({ lean: 28, sL: -44, eL: -20, sR: 98, eR: -2, hL: -36, kL: 50, hR: 44, kR: -44 }),
    spin: P({ py: 6, lean: 0, sL: -90, eL: -10, sR: 90, eR: 10, hL: -70, kL: 20, hR: 70, kR: -20 })
  };

  function lerpPose(a, b, t) {
    var o = {};
    for (var k in DEF) o[k] = a[k] + (b[k] - a[k]) * t;
    return o;
  }

  /* 招式关键帧 → 当前姿态 */
  FN.poseAt = function (move, mf) {
    var keys = move.anim || [[0, 'idle']];
    if (mf <= keys[0][0]) return POSES[keys[0][1]] || POSES.idle;
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (mf >= a[0] && mf <= b[0]) {
        var t = (b[0] === a[0]) ? 1 : (mf - a[0]) / (b[0] - a[0]);
        t = U.ease(U.clamp(t, 0, 1));
        return lerpPose(POSES[a[1]] || POSES.idle, POSES[b[1]] || POSES.idle, t);
      }
    }
    return POSES[keys[keys.length - 1][1]] || POSES.idle;
  };

  FN.poseFor = function (f, timeMs) {
    var mv = f.move;
    if (f.state === 'attack' && mv) return FN.poseAt(mv, f.mf);
    var ph = Math.sin(timeMs / 420 + f.idx * 1.7);
    var base;
    if (f.downTimer > 0 || f.state === 'downed') base = POSES.downed;
    else if (f.state === 'wakeup') base = POSES.wakeup;
    else if (f.state === 'blockstun') base = f.crouching ? POSES.blockLow : POSES.blockHigh;
    else if (f.state === 'guardcrush') base = POSES.hurt;
    else if (f.state === 'hitstun') base = (f.y > 0 || f.airborne) ? POSES.hurtAir : POSES.hurt;
    else if (f.state === 'thrown') base = POSES.hurtAir;
    else if (f.y > 0 || f.airborne) base = f.vy > 0 ? POSES.jump : POSES.jumpFall;
    else if (f.state === 'crouch' || f.crouching) base = f.blocking ? POSES.blockLow : POSES.crouch;
    else if (f.blocking) base = POSES.blockHigh;
    else if (f.state === 'walk') base = (f.vx * f.facing > 0) ? POSES.walkF : POSES.walkB;
    else base = POSES.idle;
    if (base === POSES.idle || base === POSES.crouch) {
      base = lerpPose(base, base, 0);
      base.py += ph * 2.2; base.lean += ph * 1.6;
    }
    return base;
  };

  /* ---------- 骨架解算 ---------- */
  FN.joints = function (char, pose, facing) {
    var b = char.build, k = 1 + (b.bulk - 1) * 0.45;
    var hipY = 92 * k + pose.py;
    var pelvis = { x: pose.px, y: hipY };
    var lr = pose.lean * Math.PI / 180;
    var dir = { x: Math.sin(lr), y: Math.cos(lr) };
    var per = { x: Math.cos(lr), y: -Math.sin(lr) };
    var neck = { x: pelvis.x + dir.x * b.torso, y: pelvis.y + dir.y * b.torso };
    var head = { x: neck.x + dir.x * (b.neck + b.head), y: neck.y + dir.y * (b.neck + b.head) };
    var shF = { x: neck.x + per.x * b.shoulder * 0.9, y: neck.y + per.y * b.shoulder * 0.9 };
    var shB = { x: neck.x - per.x * b.shoulder * 0.9, y: neck.y - per.y * b.shoulder * 0.9 };
    var hipF = { x: pelvis.x + per.x * b.hip, y: pelvis.y + per.y * b.hip };
    var hipB = { x: pelvis.x - per.x * b.hip, y: pelvis.y - per.y * b.hip };
    function arm(sh, a1, a2) {
      var r1 = a1 * Math.PI / 180, r2 = (a1 + a2) * Math.PI / 180;
      var el = { x: sh.x + Math.sin(r1) * b.uarm, y: sh.y - Math.cos(r1) * b.uarm };
      var hd = { x: el.x + Math.sin(r2) * b.farm, y: el.y - Math.cos(r2) * b.farm };
      return { sh: sh, el: el, hd: hd };
    }
    function leg(hp, a1, a2) {
      var r1 = a1 * Math.PI / 180, r2 = (a1 + a2) * Math.PI / 180;
      var kn = { x: hp.x + Math.sin(r1) * b.thigh, y: hp.y - Math.cos(r1) * b.thigh };
      var ft = { x: kn.x + Math.sin(r2) * b.shin, y: kn.y - Math.cos(r2) * b.shin };
      return { hp: hp, kn: kn, ft: ft };
    }
    return {
      pelvis: pelvis, neck: neck, head: head,
      front: arm(shF, pose.sR, pose.eR), back: arm(shB, pose.sL, pose.eL),
      legF: leg(hipF, pose.hR, pose.kR), legB: leg(hipB, pose.hL, pose.kL),
      rot: pose.rot * Math.PI / 180, foot: b.foot
    };
  };

  /* ---------- 绘制 ---------- */
  function limb(ctx, a, b, w, color, outline) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineWidth = w + 5; ctx.strokeStyle = outline; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  }

  FN.drawFighter = function (ctx, f, t, opts) {
    opts = opts || {};
    var char = f.char, pal = char.pal, b = char.build;
    var pose = opts.pose || FN.poseFor(f, t);
    var J = FN.joints(char, pose, f.facing);
    var scale = opts.scale || 1;
    var flash = f.flash > 0 || (f.hurtFlash > 0 && Math.floor(t / 40) % 2 === 0);

    ctx.save();
    ctx.translate(f.x, opts.groundY);
    ctx.translate(0, -f.y);
    ctx.scale(f.facing * scale, -scale);
    if (J.rot) { ctx.translate(J.pelvis.x, J.pelvis.y); ctx.rotate(J.rot); ctx.translate(-J.pelvis.x, -J.pelvis.y); }

    var O = pal.outline, bulk = b.bulk;
    var suit = flash ? '#ffffff' : pal.suit, suit2 = flash ? '#ffffff' : pal.suit2;
    var skin = flash ? '#ffffff' : pal.skin, skinD = flash ? '#dddddd' : pal.skinDark;

    // 后侧肢体
    limb(ctx, J.legB.hp, J.legB.kn, 20 * bulk, suit2, O);
    limb(ctx, J.legB.kn, J.legB.ft, 16 * bulk, suit2, O);
    limb(ctx, J.back.sh, J.back.el, 17 * bulk, skinD, O);
    limb(ctx, J.back.el, J.back.hd, 15 * bulk, pal.trim, O);
    // 躯干
    limb(ctx, J.pelvis, J.neck, 40 * bulk, suit, O);
    // 头
    ctx.beginPath();
    ctx.arc(J.head.x, J.head.y, b.head * 1.02, 0, Math.PI * 2);
    ctx.fillStyle = skin; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = O; ctx.stroke();
    // 头发
    ctx.beginPath();
    ctx.arc(J.head.x, J.head.y - 2, b.head * 1.02, Math.PI * 0.15, Math.PI * 1.05);
    ctx.lineWidth = 11; ctx.strokeStyle = flash ? '#ffffff' : pal.hair; ctx.stroke();
    // 前腿
    limb(ctx, J.legF.hp, J.legF.kn, 21 * bulk, suit, O);
    limb(ctx, J.legF.kn, J.legF.ft, 17 * bulk, suit, O);
    // 鞋
    limb(ctx, J.legF.ft, { x: J.legF.ft.x + J.foot * 0.7, y: J.legF.ft.y - 3 }, 14 * bulk, pal.accent, O);
    limb(ctx, J.legB.ft, { x: J.legB.ft.x + J.foot * 0.5, y: J.legB.ft.y - 3 }, 13 * bulk, pal.accent, O);
    // 前臂
    limb(ctx, J.front.sh, J.front.el, 18 * bulk, skin, O);
    limb(ctx, J.front.el, J.front.hd, 16 * bulk, pal.trim, O);
    // 拳
    ctx.beginPath(); ctx.arc(J.front.hd.x, J.front.hd.y, 11 * bulk, 0, Math.PI * 2);
    ctx.fillStyle = flash ? '#ffffff' : pal.accent; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = O; ctx.stroke();
    ctx.beginPath(); ctx.arc(J.back.hd.x, J.back.hd.y, 10 * bulk, 0, Math.PI * 2);
    ctx.fillStyle = flash ? '#ffffff' : pal.accent; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = O; ctx.stroke();
    // 腰带
    limb(ctx, { x: J.pelvis.x - 16 * bulk, y: J.pelvis.y }, { x: J.pelvis.x + 16 * bulk, y: J.pelvis.y }, 12 * bulk, pal.accent, O);
    ctx.restore();

    // 影子
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.ellipse(f.x, opts.groundY + 4, 46 * bulk * (1 - Math.min(0.5, f.y / 400)), 11 * bulk, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
  };

  /* 选人页立绘：静态姿态 + 光效 */
  FN.drawPortrait = function (ctx, charId, w, h, t, poseName) {
    var char = FN.CHARS[charId];
    var f = { char: char, x: 0, y: 0, facing: 1, state: 'idle', move: null, mf: 0, vy: 0, airborne: false, crouching: false, blocking: false, idx: 0, flash: 0, hurtFlash: 0, downTimer: 0, vx: 0 };
    var pose = POSES[poseName || 'idle'];
    if (!poseName) { pose = lerpPose(POSES.idle, POSES.walkF, (Math.sin(t / 700) + 1) / 2); }
    ctx.save();
    ctx.translate(w / 2, h * 0.94);
    var s = h / 260;
    ctx.save(); ctx.scale(s, s);
    FN.drawFighter(ctx, f, t, { pose: pose, groundY: 0, scale: 1 });
    ctx.restore();
    ctx.restore();
  };

  FN.POSES = POSES;
})(window.FN);
