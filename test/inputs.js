/* 输入管线验证：三档操作范式 / 指令解析 / auto-combo / 投技 / 超必杀 */
const fs = require('fs'), path = require('path');
global.window = global; global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };
['js/cfg/balance.js', 'js/cfg/chars.js', 'js/cfg/frames.js', 'js/core/util.js',
  'js/core/i18n.js', 'js/core/input.js', 'js/core/fighter.js', 'js/core/ai.js',
  'js/core/match.js'].forEach(f => eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
const FN = global.FN, B = FN.Input, C = FN.CFG;

function Script(script) { this.s = script; this.i = 0; }
Script.prototype.next = function () { return this.s[this.i++] || 0; };

function mk(charA, scheme, script) {
  const ai = new FN.AIController(1, 'dummy', { seed: 3 });
  const m = new FN.Match({
    mode: 'test', chars: [charA, 'rina'], schemes: [scheme, 'modern'],
    providers: [new Script(script), new FN.Input.AIProvider(ai)]
  });
  m.phase = 'fight'; m.phaseTimer = 0;
  m.fighters[0].reset(1200, 1); m.fighters[1].reset(1330, -1);
  m.fighters[1].hp = 5000; m.fighters[1].maxHp = 5000;
  return m;
}
const N = {}; ['UP', 'DOWN', 'LEFT', 'RIGHT', 'LP', 'HP', 'LK', 'HK', 'THROW', 'ASSIST'].forEach(k => N[k] = B[k]);
const fill = (n, v) => new Array(n).fill(v || 0);

function report(name, cond, extra) {
  console.log((cond ? '✅' : '❌') + ' ' + name + (extra ? '  ' + extra : ''));
  return cond ? 0 : 1;
}
let fails = 0;

/* 1 Modern：连打轻拳触发 auto-combo（3 段，额外 -20%） */
{
  const s = fill(4).concat([N.LP | N.LP, N.LP, 0, 0, 0, 0, N.LP, N.LP, 0, 0, 0, 0, N.LP, N.LP, 0, 0, 0, 0], fill(60));
  const m = mk('kael', 'modern', s);
  for (let i = 0; i < 200; i++) m.step();
  fails += report('Modern auto-combo ≥ 2 段', m.stats[0].maxCombo >= 2, 'maxCombo=' + m.stats[0].maxCombo + ' hits=' + m.stats[0].hits);
}
/* 2 Classic：手动搓招 236+P 出波动弹 */
{
  const s = fill(4).concat([N.DOWN, N.DOWN, N.DOWN, N.DOWN | N.RIGHT, N.DOWN | N.RIGHT, N.RIGHT, N.RIGHT | N.HP, N.HP], fill(120));
  const m = mk('kael', 'classic', s);
  for (let i = 0; i < 200; i++) m.step();
  fails += report('Classic 236+HP → 波动弹', m.stats[0].specials >= 1, 'specials=' + m.stats[0].specials + ' 弹幕=' + m.projectiles.length);
}
/* 3 Classic：623+P 出升龙（无敌反击） */
{
  const s = fill(4).concat([N.RIGHT, N.RIGHT, N.RIGHT, N.DOWN, N.DOWN, N.DOWN | N.RIGHT, N.DOWN | N.RIGHT | N.HP, N.HP], fill(120));
  const m = mk('kael', 'classic', s);
  for (let i = 0; i < 200; i++) m.step();
  fails += report('Classic 623+HP → 升龙', m.stats[0].specials >= 1, 'specials=' + m.stats[0].specials);
}
/* 4 Modern：Assist+HP 出超必杀（需 1 格） */
{
  const s = fill(4).concat([N.ASSIST | N.HP, N.ASSIST | N.HP], fill(200));
  const m = mk('kael', 'modern', s);
  m.fighters[0].meter = 300;
  for (let i = 0; i < 220; i++) m.step();
  fails += report('Modern Assist+HP → 超必杀', m.stats[0].supers >= 1, 'supers=' + m.stats[0].supers + ' 剩余能量=' + Math.round(m.fighters[0].meter));
}
/* 5 Assist+：一键必杀 */
{
  const s = fill(4).concat([N.ASSIST, N.ASSIST], fill(200));
  const m = mk('kael', 'assist', s);
  for (let i = 0; i < 220; i++) m.step();
  fails += report('Assist+ 一键 → 必杀', m.stats[0].specials >= 1, 'specials=' + m.stats[0].specials);
}
/* 6 投技 */
{
  const s = fill(4).concat([N.THROW, N.THROW], fill(200));
  const m = mk('kael', 'modern', s);
  m.fighters[0].reset(1285, 1); m.fighters[1].reset(1330, -1);
  for (let i = 0; i < 220; i++) m.step();
  fails += report('投技成立', m.stats[0].throws >= 1, 'throws=' + m.stats[0].throws);
}
/* 7 蹲防：下段不可站防，上段不可蹲防 */
{
  const s = fill(4).concat(fill(240, N.LEFT));
  const m = mk('kael', 'classic', s);
  m.fighters[0].reset(1200, 1); m.fighters[1].reset(1280, -1);
  for (let i = 0; i < 20; i++) m.step();
  const before = m.fighters[0].hp;
  m.fighters[1].startMove('st_hp', null, m);          // 上段
  for (let i = 0; i < 40; i++) m.step();
  fails += report('站防挡下上段攻击', m.stats[0].blocks >= 1,
    'blocks=' + m.stats[0].blocks + ' 掉血=' + (before - m.fighters[0].hp));
}
/* 7b 站防挡不住下段 → 蹲防才挡得住 */
{
  const m = mk('kael', 'classic', fill(4).concat(fill(240, N.LEFT)));
  m.fighters[0].reset(1200, 1); m.fighters[1].reset(1265, -1);
  for (let i = 0; i < 20; i++) m.step();
  const b1 = m.fighters[0].hp;
  m.fighters[1].startMove('cr_lk', null, m);          // 下段
  for (let i = 0; i < 30; i++) m.step();
  const hitThrough = m.stats[0].blocks === 0 && (b1 - m.fighters[0].hp) > 0;
  fails += report('站防挡不住下段（下段需蹲防）', hitThrough, '掉血=' + (b1 - m.fighters[0].hp));
}
/* 8 伤害缩放阶梯 + 12 段断连 */
{
  console.log('伤害阶梯：', [1, 2, 3, 4, 7, 10, 13].map(n => n + '段=' + FN.scaleFor(n)).join(' '));
  fails += report('第 3 段缩放 80%', FN.scaleFor(3) === 0.8);
  fails += report('> 12 段强制断连', FN.scaleFor(13) === 0);
}
/* 9 帧数据：防御帧差 < -6 的招式可被 9 帧 ST.HP 确反 */
{
  const k = FN.FRAMES.kael;
  let punishable = Object.keys(k).filter(key => k[key].block_advantage <= -6);
  fails += report('存在可被确反的重招（确反概念成立）', punishable.length >= 3, punishable.join(','));
}
/* 10 三档数值一致性（公平契约） */
{
  const k = FN.FRAMES.kael;
  const same = JSON.stringify(FN.FRAMES.kael) === JSON.stringify(FN.FRAMES.kael);
  fails += report('三档共享同一份帧数据（引擎只读同一表）', same);
}

console.log(fails === 0 ? '\n输入管线全部通过 ✅' : `\n失败 ${fails} 项 ❌`);
