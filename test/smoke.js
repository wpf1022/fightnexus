/* 无头逻辑冒烟测试：确定性战斗内核 */
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

function run(chars, schemes, profile, frames, seedA, seedB) {
  const a1 = new FN.AIController(0, profile, { seed: seedA });
  const a2 = new FN.AIController(1, profile, { seed: seedB });
  const m = new FN.Match({
    mode: 'ai', chars, schemes, aiProfile: profile,
    providers: [new FN.Input.AIProvider(a1), new FN.Input.AIProvider(a2)]
  });
  let err = null, maxCombo = 0;
  for (let i = 0; i < frames; i++) {
    try { m.step(); } catch (e) { err = e; console.log('ERR@frame', i, e.stack.split('\n').slice(0, 4).join('\n')); break; }
    maxCombo = Math.max(maxCombo, m.stats[0].maxCombo, m.stats[1].maxCombo);
    if (m.phase === 'matchend') break;
  }
  return { m, err, maxCombo };
}

console.log('--- 平衡性自检 (BT) ---');
console.log(FN.runBalanceTests().length ? FN.runBalanceTests() : '通过：11 条硬约束无违反');

let fails = 0;
[['kael', 'rina'], ['rina', 'goro'], ['goro', 'kael']].forEach(([a, b], i) => {
  const r = run([a, b], ['classic', 'modern'], ['casual', 'standard', 'expert'][i % 3], 4000, 11 + i, 73 + i * 9);
  const m = r.m;
  console.log(`对局 ${a} vs ${b} [${['casual', 'standard', 'expert'][i % 3]}]`,
    '| err:', r.err ? 'YES' : 'none',
    '| phase:', m.phase,
    '| wins:', m.wins.join('-'),
    '| round:', m.round,
    '| 连段:', m.stats[0].maxCombo + '/' + m.stats[1].maxCombo,
    '| 命中:', m.stats[0].hits + '/' + m.stats[1].hits,
    '| 确反:', m.stats[0].punish + '/' + m.stats[1].punish,
    '| 必杀:', m.stats[0].specials + '/' + m.stats[1].specials,
    '| 超必:', m.stats[0].supers + '/' + m.stats[1].supers,
    '| 拆投:', m.stats[0].techs + '/' + m.stats[1].techs,
    '| HP:', Math.round(m.fighters[0].hp) + '/' + Math.round(m.fighters[1].hp));
  if (r.err) fails++;
  // 基本健全性
  if (m.stats[0].hits + m.stats[1].hits < 2) { console.log('  !! 命中数过少，AI 可能卡死'); fails++; }
});

console.log('\n--- 确定性校验（同输入两次运行状态哈希一致）---');
function hash(m) {
  return JSON.stringify(m.fighters.map(f => f.serialize()));
}
const r1 = run(['kael', 'rina'], ['classic', 'classic'], 'standard', 1200, 555, 555);
const r2 = run(['kael', 'rina'], ['classic', 'classic'], 'standard', 1200, 555, 555);
console.log('确定性：', hash(r1.m) === hash(r2.m) ? 'PASS（完全相同）' : 'FAIL');
if (hash(r1.m) !== hash(r2.m)) fails++;

console.log('\n--- 帧数据摘要（Kael）---');
const k = FN.FRAMES.kael;
Object.keys(k).forEach(key => {
  const mv = k[key];
  console.log(` ${key.padEnd(9)} ${String(mv.damage).padStart(4)}dmg  ${mv.startup}/${mv.active}/${mv.recovery}` +
    `  命中${mv.hit_advantage >= 0 ? '+' + mv.hit_advantage : mv.hit_advantage} 防御${mv.block_advantage >= 0 ? '+' + mv.block_advantage : mv.block_advantage}`);
});

console.log('\n--- 高光快照 / 重演结构 ---');
const r3 = run(['kael', 'goro'], ['modern', 'modern'], 'casual', 4000, 909, 313);
const hl = r3.m.highlights[0];
console.log('高光片段：', hl ? `keyFrame=${hl.keyFrame} start=${hl.startFrame} end=${hl.endFrame} inputs=${hl.inputs.length} snapshot=${!!hl.snapshot}` : '无');
if (hl && hl.snapshot) {
  const m2 = new FN.Match({ mode: 'replay', chars: hl.chars, schemes: hl.schemes, providers: [null, null] });
  m2.restore(hl.snapshot);
  console.log('快照恢复：', 'frame=' + m2.frame, 'hp=' + Math.round(m2.fighters[0].hp) + '/' + Math.round(m2.fighters[1].hp));
}

console.log('\n--- 高光截取 ---');
console.log(fails === 0 ? '全部冒烟用例通过 ✅' : `失败 ${fails} 项 ❌`);
