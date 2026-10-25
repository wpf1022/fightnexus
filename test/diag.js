/* AI 行为密度诊断：统计决策分支、距离分布、命中数 */
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

/* 打点：包装 decide，记录分支 */
const BRANCH = ['block', 'punish', 'antiair', 'guard', 'super', 'close', 'inrange', 'mid', 'far'];
function instrument(ai) {
  const orig = ai.decide.bind(ai);
  ai.count = {}; BRANCH.forEach(b => ai.count[b] = 0);
  ai.decide = function (M) {
    const me = M.fighters[this.idx], op = M.fighters[1 - this.idx];
    const seen = this.seen() || { x: op.x, state: 'idle', air: false };
    const dist = Math.abs(seen.x - me.x);
    const fr = me.frames;
    const rch = Math.max(fr.st_hk ? (fr.st_hk.hitbox.x + fr.st_hk.hitbox.w) : 0,
      fr.st_hp ? (fr.st_hp.hitbox.x + fr.st_hp.hitbox.w) : 0);
    if (dist < 92) ai.count.close++;
    else if (dist < rch * 0.98) ai.count.inrange++;
    else if (dist < 560) ai.count.mid++;
    else ai.count.far++;
    return orig(M);
  };
}

function run(profile, frames, seedA, seedB, chars) {
  const a1 = new FN.AIController(0, profile, { seed: seedA });
  const a2 = new FN.AIController(1, profile, { seed: seedB });
  instrument(a1); instrument(a2);
  const m = new FN.Match({
    mode: 'ai', chars: chars || ['kael', 'rina'], schemes: ['classic', 'classic'], aiProfile: profile,
    providers: [new FN.Input.AIProvider(a1), new FN.Input.AIProvider(a2)]
  });
  let idleFrames = 0, distSum = 0, n = 0, atkFrames = 0, blkFrames = 0;
  for (let i = 0; i < frames; i++) {
    m.step();
    const f0 = m.fighters[0], f1 = m.fighters[1];
    distSum += Math.abs(f0.x - f1.x); n++;
    if (f0.state === 'attack') atkFrames++;
    if (f0.blocking) blkFrames++;
    if (f0.state === 'idle' && f1.state === 'idle') idleFrames++;
    if (m.phase === 'matchend') break;
  }
  return { m, a1, a2, avgDist: distSum / n, idleRate: idleFrames / n, atkRate: atkFrames / n, blkRate: blkFrames / n };
}

['casual', 'standard', 'expert'].forEach(p => {
  const r = run(p, 4000, 11, 73, ['kael', 'goro']);
  const m = r.m;
  console.log(`\n[${p}] kael vs goro`);
  console.log(`  命中 ${m.stats[0].hits}/${m.stats[1].hits} | 连段 ${m.stats[0].maxCombo}/${m.stats[1].maxCombo}` +
    ` | 必杀 ${m.stats[0].specials}/${m.stats[1].specials} | 超必 ${m.stats[0].supers}/${m.stats[1].supers}` +
    ` | 投 ${m.stats[0].throws || 0}/${m.stats[1].throws || 0}`);
  console.log(`  平均距离 ${r.avgDist.toFixed(0)}px | 双方静置占比 ${(r.idleRate * 100).toFixed(0)}% | P0出招占比 ${(r.atkRate * 100).toFixed(0)}% | P0防御占比 ${(r.blkRate * 100).toFixed(0)}%`);
  console.log('  P0 距离分布', JSON.stringify(r.a1.count), '\n  P1 距离分布', JSON.stringify(r.a2.count));
  console.log('  HP', Math.round(m.fighters[0].hp), '/', Math.round(m.fighters[1].hp), '| wins', m.wins.join('-'), '| round', m.round);
});

/* 单人 vs 木人：检查主动进攻密度 */
console.log('\n--- 各档位 vs Dummy（应为主动压制）---');
['casual', 'standard', 'expert'].forEach(p => {
  const a1 = new FN.AIController(0, p, { seed: 5 });
  const a2 = new FN.AIController(1, 'dummy', { seed: 6 });
  const m = new FN.Match({
    mode: 'ai', chars: ['kael', 'goro'], schemes: ['classic', 'classic'], aiProfile: p,
    providers: [new FN.Input.AIProvider(a1), new FN.Input.AIProvider(a2)]
  });
  for (let i = 0; i < 3000; i++) { m.step(); if (m.phase === 'matchend') break; }
  console.log(`  ${p.padEnd(9)} 命中 ${String(m.stats[0].hits).padStart(3)} | 连段 ${m.stats[0].maxCombo} | 必杀 ${m.stats[0].specials} | 超必 ${m.stats[0].supers} | 对手HP ${Math.round(m.fighters[1].hp)}`);
});
