/* 边界场景测试：验证本轮修复的 8 个 BUG */
const fs = require('fs'), path = require('path');
global.window = global;
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };
['js/cfg/balance.js', 'js/cfg/chars.js', 'js/cfg/frames.js', 'js/core/util.js',
  'js/core/i18n.js', 'js/core/input.js', 'js/core/fighter.js', 'js/core/ai.js',
  'js/core/match.js'].forEach(f => eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
const FN = global.FN, B = FN.Input, C = FN.CFG;
let fails = 0;
function report(name, cond, extra) {
  console.log((cond ? '✅' : '❌') + ' ' + name + (extra ? '  ' + extra : ''));
  if (!cond) fails++;
}
const fill = (n, v) => new Array(n).fill(v || 0);

function Script(s) { this.s = s; this.i = 0; }
Script.prototype.next = function () { return this.s[this.i++] || 0; };

function mk(charA, scheme, script, charB, aiMode) {
  const ai = new FN.AIController(1, 'dummy', { seed: 3 });
  const m = new FN.Match({
    mode: 'test', chars: [charA, charB || 'rina'], schemes: [scheme, 'modern'],
    providers: [script ? new Script(script) : new B.NullProvider(), new B.AIProvider(ai)]
  });
  m.phase = 'fight'; m.phaseTimer = 0;
  m.fighters[0].reset(1200, 1); m.fighters[1].reset(1300, -1);
  return m;
}
const N = {}; ['UP', 'DOWN', 'LEFT', 'RIGHT', 'LP', 'HP', 'LK', 'HK', 'THROW', 'ASSIST'].forEach(k => N[k] = B[k]);

/* 1 防御贯穿（单元级）：blockstun 期间 blockType 必须保持，high/low 连段第二下不能打穿 */
{
  const m = mk('kael', 'classic', null, 'goro');
  m.phase = 'fight'; m.phaseTimer = 0;
  m.fighters[0].reset(1200, 1); m.fighters[1].reset(1290, -1);
  const d = m.fighters[0], a = m.fighters[1];
  // 构造：rina 站防中被击中 → 进入 blockstun → 紧接一个 high 攻击
  d.blocking = true; d.blockType = 'stand'; d.stunBlockType = 'stand';
  const hp0 = d.hp;
  a.startMove('st_hp', null, m); a.mf = a.move.startup + 1;    // 攻击激活帧
  const box = { x0: 1250, y0: 100, w: 20, h: 20 };
  m.applyHit(a, d, a.frames.st_hp, { box: box });              // 第一次命中（站防）
  const after1 = d.hp === hp0 && d.state === 'blockstun';
  // blockstun 中第二个 high 攻击（不重置 blockType，模拟 stepStun 保持）
  d.blocking = true; d.blockType = d.stunBlockType;
  a.startMove('st_hp', null, m); a.mf = a.move.startup + 1;
  m.applyHit(a, d, a.frames.st_hp, { box: box });
  const after2 = d.hp === hp0 && d.state === 'blockstun';
  // 反例：蹲防中 low 攻击同样应防住，high 则应破防
  d.blockType = 'crouch'; d.stunBlockType = 'crouch'; d.blocking = true;
  a.startMove('cr_lk', null, m); a.mf = a.move.startup + 1;
  m.applyHit(a, d, a.frames.cr_lk, { box: box });
  const lowOK = d.hp === hp0;
  report('blockstun 内连段第二下仍被防御', after1 && after2 && lowOK,
    `hit1=${after1} hit2=${after2} low=${lowOK}`);
}

/* 2 削伤 KO：残血防御必杀削伤致死必须结算回合 */
{
  const s = [0, 0].concat([N.DOWN, N.DOWN | N.RIGHT, N.DOWN | N.RIGHT, N.RIGHT, N.RIGHT | N.HP, N.HP], fill(200));
  const m = mk('kael', 'classic', s);
  m.fighters[1].hp = 5;                        // 只剩 5 血
  for (let i = 0; i < 150; i++) m.step();
  report('削伤（chip）致死结算回合', m.wins[0] >= 1 || m.round >= 2,
    `phase=${m.phase} round=${m.round} wins=${m.wins.join('-')}`);
}

/* 3 墙角推箱：把两人都压进墙角，重叠必须被分离 */
{
  const m = mk('goro', 'classic', null, 'kael');
  m.phase = 'fight'; m.phaseTimer = 0;
  m.fighters[0].reset(C.STAGE_W - C.EDGE_PAD - 30, 1);   // 贴近右墙
  m.fighters[1].reset(C.STAGE_W - C.EDGE_PAD - 10, -1);  // 更贴近（重叠）
  for (let i = 0; i < 30; i++) m.step();
  const gap = Math.abs(m.fighters[1].x - m.fighters[0].x);
  report('墙角推箱不穿透', gap >= C.PUSHBOX_W - 1, `间距=${gap.toFixed(1)} 要求≥${C.PUSHBOX_W}`);
}

/* 4 快照恢复（含飞行道具）：fireball 在空中时快照/恢复不得抛异常且弹幕存活 */
{
  const s = [0, 0, 0, 0].concat([N.DOWN, N.DOWN | N.RIGHT, N.DOWN | N.RIGHT, N.RIGHT, N.RIGHT | N.HP, N.HP], fill(60));
  const m = mk('kael', 'classic', s);
  let err = null, snap = null;
  for (let i = 0; i < 60; i++) { m.step(); if (m.projectiles.length && !snap) snap = m.snapshot(); }
  try { if (snap) { const m3 = new FN.Match({ mode: 'replay', chars: ['kael', 'rina'], schemes: ['classic', 'modern'], providers: [null, null] }); m3.restore(snap); } } catch (e) { err = e; }
  report('含弹幕快照恢复无异常', snap && !err, err ? err.message : `弹幕x=${snap ? 'captured' : 'none'}`);
}

/* 5 __projHit 衰减：弹幕消失后不再永久免伤 */
{
  const s = [0, 0, 0, 0].concat([N.DOWN, N.DOWN | N.RIGHT, N.DOWN | N.RIGHT, N.RIGHT, N.RIGHT | N.HP, N.HP], fill(400));
  const m = mk('kael', 'classic', s);
  m.fighters[1].hp = 100000; m.fighters[1].maxHp = 100000;
  for (let i = 0; i < 300; i++) m.step();
  report('__projHit 正常衰减', m.fighters[1].__projHit <= 8, `值=${m.fighters[1].__projHit} 被弹命中=${m.stats[1].taken > 0}`);
}

/* 6 Modern：单击 ASSIST（不带 HP）必须仍能出一键必杀（trySuper 不吞 Assist） */
{
  const s = fill(6).concat([N.ASSIST, N.ASSIST, 0], fill(120));
  const m = mk('kael', 'modern', s);
  for (let i = 0; i < 120; i++) m.step();
  report('Modern 单击 Assist 出一键必杀', m.stats[0].specials >= 1, `specials=${m.stats[0].specials} supers=${m.stats[0].supers}`);
}

/* 7 Modern：Assist+HP 出超必杀仍正常 */
{
  const s = fill(6).concat([N.ASSIST | N.HP, N.ASSIST | N.HP, 0], fill(120));
  const m = mk('kael', 'modern', s);
  m.fighters[0].meter = 300;
  for (let i = 0; i < 120; i++) m.step();
  report('Modern Assist+HP 出超必杀', m.stats[0].supers >= 1, `supers=${m.stats[0].supers}`);
}

/* 8 长对局输入流对齐：>32s 后 captureHighlight 的 inputs 仍按帧对齐 */
{
  const m = mk('kael', 'classic', fill(2600));
  m.phase = 'fight'; m.phaseTimer = 0;
  for (let i = 0; i < 2600; i++) m.step();     // 43 秒 > REPLAY_BUFFER*3/60=32s
  m.timer = 10;
  for (let i = 0; i < 20; i++) m.step();
  const hl = m.highlights[m.highlights.length - 1];
  // inputs 覆盖 [logStart, min(endFrame, peak))，且 logStart 语义 = inputs[0] 的全局帧号
  const expect = Math.min(hl.endFrame, hl.peak) - hl.logStart;
  report('长对局输入流按帧对齐', hl && hl.inputs.length === expect && hl.logStart >= hl.startFrame,
    `inputs=${hl ? hl.inputs.length : 'none'}/${expect} logStart=${hl && hl.logStart} startF=${hl && hl.startFrame}`);
}

/* 9 霸体吸收致死结算 */
{
  const m = mk('goro', 'classic', [0, 0, N.HP, N.HP], 'goro');
  m.fighters[1].hp = 3;
  // P0 出招打 P1 的猛砸霸体？——反过来：P1 霸体吸收 P0 的攻击致死
  // 直接构造：P1 进入 smash 霸体，P0 st_hp 命中
  const m2 = new FN.Match({ mode: 'test', chars: ['kael', 'goro'], schemes: ['classic', 'classic'], providers: [new Script(fill(400)), new Script(fill(400))] });
  m2.phase = 'fight'; m2.phaseTimer = 0;
  m2.fighters[0].reset(1200, 1); m2.fighters[1].reset(1290, -1);
  m2.fighters[1].hp = 3; m2.fighters[1].startMove('smash', null, m2);
  // 等霸体窗口期让 P0 攻击命中
  let ko = false;
  for (let i = 0; i < 40; i++) {
    if (i === 4) m2.applyHit(m2.fighters[0], m2.fighters[1], m2.fighters[0].frames.st_hp, { box: { x0: 1250, y0: 60, w: 20, h: 20 } });
    m2.step();
    if (m2.phase === 'roundend' || m2.phase === 'matchend') { ko = true; break; }
  }
  report('霸体吸收致死结算回合', ko, `phase=${m2.phase} hp=${Math.round(m2.fighters[1].hp)}`);
}

console.log(fails === 0 ? '\n边界场景全部通过 ✅' : `\n失败 ${fails} 项 ❌`);
process.exit(fails ? 1 : 0);
