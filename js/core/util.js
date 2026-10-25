/* =============================================================
 * FightNexus · util.js
 * 数学工具 / 存档 / 成长数据（FR13）/ 埋点
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  var U = FN.U = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    ease: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    easeOut: function (t) { return 1 - Math.pow(1 - t, 3); },
    approach: function (v, t, s) { return v < t ? Math.min(t, v + s) : Math.max(t, v - s); },
    r2: function (v) { return Math.round(v * 100) / 100; },
    // 确定性：战斗结算链路禁止随机。以下仅供表现层（粒子/星空）使用。
    det: function (seed) { var s = seed | 0; return function () { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; }
  };

  /* ---------------- 存档 ---------------- */
  var KEY = 'fightnexus_save_v1';
  var DEFAULT = {
    lang: 'zh',
    scheme: 'modern',              // §FR7 默认档位 Modern（实验 E2）
    volume: { bgm: 0.45, sfx: 0.8, ui: 0.6 },
    hitIntensity: 'standard',      // 柔和 · 标准 · 重
    shake: 70, flash: true, fps: false, quality: 'auto',
    fontScale: 100, hudScale: 100,
    colorMode: 'standard',         // 无障碍：色觉模式
    subtitles: true, keyHintAlways: false,
    coach: true, dynamic: true, hitbox: false,
    difficulty: 'standard',
    keymaps: JSON.parse(JSON.stringify(FN.DEFAULT_KEYS)),
    ftueDone: false,
    seen: {}
  };

  var DEFAULT_STATS = {
    matches: 0, wins: 0, losses: 0, draws: 0,
    streak: 0, bestStreak: 0,
    longestCombo: 0, totalDamage: 0,
    labSessions: 0,
    achievements: {},
    history: [],        // 最近 60 局：{ts,c,w,char,opp,scheme,combo,punish,tech,block,sp,win}
    skill: {            // 近 30 局趋势（FR13）
      specialSuccess: [], comboLen: [], blockRate: [], techRate: [], punishRate: []
    },
    totals: { punish: 0, tech: 0, superKO: 0, shares: 0, hits: 0, taken: 0, blocks: 0, specials: 0, specialTries: 0 }
  };

  function deepMerge(base, patch) {
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var p in patch) {
      if (patch[p] && typeof patch[p] === 'object' && !Array.isArray(patch[p]) && base[p] && typeof base[p] === 'object') {
        out[p] = deepMerge(base[p], patch[p]);
      } else out[p] = patch[p];
    }
    return out;
  }

  var Save = FN.Save = {
    data: null, stats: null,
    load: function () {
      if (this.data) return this.data;
      var s = null, st = null;
      try {
        s = JSON.parse(localStorage.getItem(KEY) || 'null');
        st = JSON.parse(localStorage.getItem(KEY + '_stats') || 'null');
      } catch (e) { s = null; st = null; }
      this.data = deepMerge(DEFAULT, s || {});
      this.stats = deepMerge(DEFAULT_STATS, st || {});
      return this.data;
    },
    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        localStorage.setItem(KEY + '_stats', JSON.stringify(this.stats));
      } catch (e) { }
    },
    set: function (k, v) { this.load(); this.data[k] = v; this.save(); },
    wipe: function () {
      try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_stats'); } catch (e) { }
      this.data = null; this.stats = null; this.load();
    }
  };

  /* ---------------- 成长可见化（FR13）---------------- */
  FN.Growth = {
    recordMatch: function (m) {
      Save.load();
      var st = Save.stats;
      st.matches++;
      var rec = {
        ts: Date.now(), w: m.win, c: m.myChar, opp: m.oppChar,
        scheme: m.scheme, combo: m.maxCombo, punish: m.punishes, tech: m.techs,
        block: m.blockRate, sp: m.specialRate, dmg: m.damage
      };
      st.history.push(rec);
      if (st.history.length > 60) st.history.shift();
      if (m.win) { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); }
      else if (m.win === false) { st.losses++; st.streak = 0; }
      else st.draws++;
      st.longestCombo = Math.max(st.longestCombo, m.maxCombo || 0);
      st.totalDamage += m.damage || 0;
      var push = function (arr, v) { arr.push(Math.round(v * 100) / 100); if (arr.length > 30) arr.shift(); };
      push(st.skill.specialSuccess, m.specialRate || 0);
      push(st.skill.comboLen, m.maxCombo || 0);
      push(st.skill.blockRate, m.blockRate || 0);
      push(st.skill.techRate, m.techRate || 0);
      push(st.skill.punishRate, m.punishRate || 0);
      Save.save();
    },
    unlock: function (id) {
      Save.load();
      if (Save.stats.achievements[id]) return false;
      Save.stats.achievements[id] = Date.now();
      Save.save();
      return true;
    },
    has: function (id) { Save.load(); return !!Save.stats.achievements[id]; },
    trend: function (key) {
      Save.load();
      var a = Save.stats.skill[key] || [];
      if (a.length < 4) return 0;
      var n = Math.min(5, Math.floor(a.length / 2));
      var p1 = a.slice(-n).reduce(function (x, y) { return x + y; }, 0) / n;
      var p2 = a.slice(-2 * n, -n).reduce(function (x, y) { return x + y; }, 0) / n;
      return p1 - p2;
    },
    avg: function (key) {
      Save.load();
      var a = Save.stats.skill[key] || [];
      if (!a.length) return 0;
      return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    },
    /* §6.4 HSI 隐性评分 */
    hsi: function () {
      Save.load();
      var s = Save.stats, h = s.history.slice(-20);
      if (h.length < 3) return 40;
      var wr = h.filter(function (x) { return x.w; }).length / h.length;
      var combo = U.clamp(s.longestCombo / 10, 0, 1);
      var pun = U.clamp(GrowthAvg('punishRate') / 0.6, 0, 1);
      var blk = U.clamp(GrowthAvg('blockRate') / 0.7, 0, 1);
      var v = wr * 40 + combo * 20 + pun * 20 + blk * 20;
      return Math.round(U.clamp(v, 0, 100));
    }
  };
  function GrowthAvg(k) { return FN.Growth.avg(k); }

  /* ---------------- 埋点（§13.1 Event Schema V2）---------------- */
  FN.Track = {
    queue: [],
    emit: function (name, props) {
      var e = { event: name, ts: Date.now(), props: props || {} };
      this.queue.push(e);
      if (this.queue.length > 300) this.queue.shift();
      if (window.__FN_DEBUG) console.log('[track]', name, props);
    },
    dump: function () { return this.queue.slice(); }
  };
})(window.FN);
