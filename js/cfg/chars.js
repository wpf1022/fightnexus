/* =============================================================
 * FightNexus · cfg_char.js  （§11.1 角色设计约束矩阵）
 * 首发 3 名角色 + 1 名预留（Mia 管线占位不出街，DL-05）
 * build：程序化骨骼比例（无美术资源下的角色体形真源）
 * ============================================================= */
window.FN = window.FN || {};
(function (FN) {
  'use strict';

  FN.CHARS = {
    kael: {
      id: 'kael', name: 'Kael', cn: '凯尔', type: '均衡 Balanced',
      novice: true, stars: 1,
      hp: 1000, defense: 1.00,           // 受伤修正
      speedF: 3.0, speedB: 2.4, airTime: 45,
      strengths: ['波升立回', '攻防均衡', '易学难精'],
      keywords: ['波动弹牵制', '升龙对空', '确反主力'],
      weakness: '缺乏突出的中距离牵制',
      moves: ['st_lp', 'st_hp', 'st_lk', 'st_hk', 'cr_lp', 'cr_hp', 'cr_lk', 'cr_hk', 'jp_lp', 'jp_hp', 'throw', 'fireball', 'dp', 'super'],
      signature: 'dp',
      superName: '连打冲击波', superInput: '236236+P',
      reversal: 'dp', reversalNote: '1~8f 无敌',
      build: { torso: 58, neck: 16, head: 21, uarm: 42, farm: 40, thigh: 50, shin: 48, shoulder: 19, hip: 14, bulk: 1.00, foot: 16 },
      pal: {
        skin: '#f0b48c', skinDark: '#c98a63', suit: '#2f4f8f', suit2: '#1b2c55',
        accent: '#ffd23f', trim: '#dbe6ff', hair: '#3a2a22', outline: '#0b0d14'
      },
      voice: { pitch: 1.0 }
    },
    rina: {
      id: 'rina', name: 'Rina', cn: '莉娜', type: 'Rushdown 突进压制',
      novice: false, stars: 2,
      hp: 950, defense: 1.10,
      speedF: 3.9, speedB: 3.2, airTime: 40,
      strengths: ['近身压制', '择多', '机动性最强'],
      keywords: ['突进撞击', '空中旋风脚', '百裂突'],
      weakness: '缺远程；被牵制难受',
      moves: ['st_lp', 'st_hp', 'st_lk', 'st_hk', 'cr_lp', 'cr_hp', 'cr_lk', 'cr_hk', 'jp_lp', 'jp_hp', 'throw', 'rush', 'airspin', 'super'],
      signature: 'rush',
      superName: '百裂突', superInput: '214214+P',
      reversal: 'airspin', reversalNote: '升空冲击 3~10f 无敌',
      build: { torso: 55, neck: 15, head: 20, uarm: 39, farm: 39, thigh: 48, shin: 47, shoulder: 17, hip: 13, bulk: 0.86, foot: 15 },
      pal: {
        skin: '#f6c9a4', skinDark: '#cf9570', suit: '#c2245e', suit2: '#7a0f36',
        accent: '#37f5d0', trim: '#ffe0ec', hair: '#ff5f9e', outline: '#12060c'
      },
      voice: { pitch: 1.25 }
    },
    goro: {
      id: 'goro', name: 'Goro', cn: '豪罗', type: 'Grappler 重型投技',
      novice: false, stars: 2,
      hp: 1150, defense: 0.90,
      speedF: 2.2, speedB: 1.8, airTime: 52,
      strengths: ['单发伤害最高', '投技威胁', '抗打'],
      keywords: ['指令投', '猛砸霸体', '天地投'],
      weakness: '起手慢，机动性差；进场难',
      moves: ['st_lp', 'st_hp', 'st_lk', 'st_hk', 'cr_lp', 'cr_hp', 'cr_lk', 'cr_hk', 'jp_lp', 'jp_hp', 'throw', 'cmdgrab', 'smash', 'super'],
      signature: 'cmdgrab',
      superName: '天地投', superInput: '360360+P',
      reversal: 'burst', reversalNote: '爆发反击 1~5f 无敌',
      build: { torso: 62, neck: 15, head: 23, uarm: 46, farm: 44, thigh: 50, shin: 46, shoulder: 24, hip: 17, bulk: 1.32, foot: 19 },
      pal: {
        skin: '#d99a6c', skinDark: '#a86f45', suit: '#4a4f3a', suit2: '#2a2e20',
        accent: '#ff9d2e', trim: '#e8e2c8', hair: '#1a1a1a', outline: '#0a0a08'
      },
      voice: { pitch: 0.72 }
    }
  };

  /* Mia：R1.0 保留资源管线位置但不出街（§11.1 注） */
  FN.CHARS_RESERVED = [{
    id: 'mia', name: 'Mia', cn: '米娅', type: 'Zoner 远程牵制',
    stars: 3, hp: 900, defense: 1.15, speedF: 2.7, speedB: 2.5, airTime: 46,
    keywords: ['飞行道具', '设置型陷阱', '全屏弹幕'], note: 'M2 里程碑后随平衡数据决定上线'
  }];

  FN.CHAR_ORDER = ['kael', 'rina', 'goro'];

  /* 舞台（§11.2） */
  FN.STAGE = {
    id: 'sunset_arcade', name: '黄昏街机厅', cn: 'Sunset Arcade',
    width: 2400, note: '静态三层视差；无交互物、无地形高低差、无边界杀'
  };
})(window.FN);
