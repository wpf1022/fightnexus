/* 卡死扫描：大量随机对局，检测异常 / 停滞帧 / phase 卡死 */
const fs = require('fs'), path = require('path');
global.window = global;
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };
const root = path.join(__dirname, '..');
['js/cfg/balance.js', 'js/cfg/chars.js', 'js/cfg/frames.js', 'js/core/util.js',
  'js/core/i18n.js', 'js/core/input.js', 'js/core/fighter.js', 'js/core/ai.js',
  'js/core/match.js'].forEach(f => {
    eval(fs.readFileSync(path.join(root, f), 'utf8'));
  });
const FN = global.FN;

/* 伪随机（可复现） */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const CHARS = ['kael', 'rina', 'goro'];
const PROFILES = ['casual', 'standard', 'expert'];
let problems = 0;

for (let trial = 0; trial < 60; trial++) {
  const rng = mulberry32(1000 + trial * 7);
  const cA = CHARS[Math.floor(rng() * 3)], cB = CHARS[Math.floor(rng() * 3)];
  const prof = PROFILES[Math.floor(rng() * 3)];
  const a1 = new FN.AIController(0, prof, { seed: Math.floor(rng() * 1e6) });
  const a2 = new FN.AIController(1, prof, { seed: Math.floor(rng() * 1e6) });
  const m = new FN.Match({
    mode: 'ai', chars: [cA, cB], schemes: ['classic', 'classic'], aiProfile: prof,
    providers: [new FN.Input.AIProvider(a1), new FN.Input.AIProvider(a2)]
  });
  let err = null, stall = 0, maxStall = 0, stallAt = -1, lastHash = '', frames = 5400;
  for (let i = 0; i < frames; i++) {
    try { m.step(); } catch (e) { err = e; break; }
    const h = JSON.stringify(m.fighters.map(f => [f.state, Math.round(f.x), Math.round(f.y), f.mf, Math.round(f.hp), m.timer]));
    if (h === lastHash) { stall++; if (stall > maxStall) { maxStall = stall; stallAt = i; } }
    else stall = 0;
    lastHash = h;
    if (m.phase === 'matchend') break;
  }
  if (err) {
    problems++;
    console.log(`[${trial}] ${cA} vs ${cB} [${prof}] 异常 @frame:`, err.message);
    console.log(err.stack.split('\n').slice(1, 4).join('\n'));
  } else if (maxStall >= 180) {   // 3 秒完全无变化 = 玩家眼中的「卡住」
    problems++;
    console.log(`[${trial}] ${cA} vs ${cB} [${prof}] 停滞 ${maxStall} 帧（${(maxStall / 60).toFixed(1)}s）@frame ${stallAt}` +
      ` | phase=${m.phase} timer=${m.timer} hp=${Math.round(m.fighters[0].hp)}/${Math.round(m.fighters[1].hp)}` +
      ` | states=${m.fighters.map(f => f.state + ':' + f.mf + ':stun' + f.stun).join(' | ')}`);
  }
}
console.log(problems === 0 ? '\n60 局扫描：无异常、无 ≥3s 停滞 ✅' : `\n发现 ${problems} 个疑似卡死问题 ❌`);
