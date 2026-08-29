// 物伤减伤计算（纯函数）
// 公式暂按「各项直接相加」实现，拿到抖音 SG看板 真实公式后只需修改 calcTotalDR 与下方待确认常量

import toughnessTable from '@/data/toughness-table.json'

export interface ToughnessRow {
  level: number
  /** 体质增加点 */
  constitution: number
  /** 降低破甲和反击忽略护甲效果（%） */
  armorIgnore: number
  /** 提升基础生命上限（%） */
  healthCap: number
  /** 减少受到的怪物伤害（%） */
  monsterDR: number
}

const TOUGHNESS_ROWS = (toughnessTable as any).rows as ToughnessRow[]

/** 按韧性等级查表（0~50），0 或越界返回 null */
export function toughnessInfo(level: number): ToughnessRow | null {
  return TOUGHNESS_ROWS.find(r => r.level === level) ?? null
}

export interface DRInputs {
  // ── 模块1 基础属性 ──
  /** F1 面板 4 条绿色禁卫属性 */
  jinwei1: number
  jinwei2: number
  jinwei3: number
  jinwei4: number
  /** 韧性 0~50 */
  toughness: number
  /** 专注 - 翅膀 */
  focusWing: number
  /** 专注 - 符咒 */
  focusCharm: number
  // ── 模块2 装备 ──
  /** 头部强化等级带来的物防加成 */
  helmStrengthen: number
  /** 四象套装减伤（相同四象两件装备数值相加后填入） */
  fourElephantShield: number
  /** 头部物防 */
  helmDef: number
  /** 上装物防 */
  armorDef: number
  /** 下装物防 */
  pantsDef: number
  // ── 模块3 灵魄（物伤减免） ──
  spiritHelm: number
  spiritMask: number
  spiritPants: number
  spiritFeet: number
  spiritWing: number
  spiritCharm: number
  // ── 模块4 其他 & BUFF ──
  aoyi: number
  beastTome: number
  tianshu: number
  yulingLevel: number
  /** 结拜等级 1~10 */
  jiebaiLevel: number
  /** XS 盾（仙术士护盾）有无 */
  xsShield: boolean
  /** 钙化 有无 */
  gaohua: boolean
  /** YX 盾（阴阳士护盾）数值 */
  yxShield: number
}

// ── 待确认常量（参考抖音 SG看板，后续替换为真实数值） ──
/** 结拜各等级减伤数值（占位：每级 +5） */
export const JIEBAI_DR_BY_LEVEL: Record<number, number> = {
  1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40, 9: 45, 10: 50,
}
/** XS 盾减伤数值（占位） */
export const XS_SHIELD_DR = 20
/** 钙化减伤数值 */
export const GAOHUA_DR = 8

export const DEFAULT_DR_INPUTS: DRInputs = {
  jinwei1: 0, jinwei2: 0, jinwei3: 0, jinwei4: 0,
  toughness: 0, focusWing: 0, focusCharm: 0,
  helmStrengthen: 0, fourElephantShield: 0, helmDef: 0, armorDef: 0, pantsDef: 0,
  spiritHelm: 0, spiritMask: 0, spiritPants: 0, spiritFeet: 0, spiritWing: 0, spiritCharm: 0,
  aoyi: 0, beastTome: 0, tianshu: 0, yulingLevel: 0,
  jiebaiLevel: 10, xsShield: false, gaohua: false, yxShield: 0,
}

/** 总减伤 = 各模块减伤值之和（占位公式） */
export function calcTotalDR(i: DRInputs): number {
  // 韧性：查表取「减少受到的怪物伤害」百分比作为减伤值（等级 0 或越界为 0）
  const toughnessDR = toughnessInfo(i.toughness)?.monsterDR ?? 0
  return (
    // 基础属性
    i.jinwei1 + i.jinwei2 + i.jinwei3 + i.jinwei4 +
    toughnessDR +
    i.focusWing + i.focusCharm +
    // 装备
    i.helmStrengthen + i.fourElephantShield + i.helmDef + i.armorDef + i.pantsDef +
    // 灵魄
    i.spiritHelm + i.spiritMask + i.spiritPants + i.spiritFeet + i.spiritWing + i.spiritCharm +
    // 其他 & BUFF
    i.aoyi + i.beastTome + i.tianshu + i.yulingLevel +
    (JIEBAI_DR_BY_LEVEL[i.jiebaiLevel] ?? 0) +
    (i.xsShield ? XS_SHIELD_DR : 0) +
    (i.gaohua ? GAOHUA_DR : 0) +
    i.yxShield
  )
}
