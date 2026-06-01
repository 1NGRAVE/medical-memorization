// 核心类型定义

/** 牙科知识卡片 */
export interface DentalCard {
  id: string
  /** 问题 */
  question: string
  /** 标准答案 */
  referenceAnswer: string
  /** 关键知识点（AI 评判用）*/
  keyPoints: string[]
  /** 核心关键词（本地快速匹配用）*/
  keywords: string[]
  /** 难度 1-5 */
  difficulty: number
  /** 所属分类 */
  category: DentistryCategory
}

/** 牙科分类 */
export type DentistryCategory =
  | 'dental_anatomy'      // 牙体解剖
  | 'oral_pathology'      // 口腔病理
  | 'periodontics'        // 牙周病学
  | 'endodontics'         // 牙体牙髓
  | 'oral_surgery'        // 口腔外科
  | 'restorative'         // 修复学
  | 'orthodontics'        // 正畸学
  | 'preventive'          // 预防口腔医学
  | 'anesthesia'          // 口腔麻醉
  | 'radiology'           // 口腔影像

export const CATEGORY_LABELS: Record<DentistryCategory, string> = {
  dental_anatomy: '牙体解剖',
  oral_pathology: '口腔病理',
  periodontics: '牙周病学',
  endodontics: '牙体牙髓',
  oral_surgery: '口腔外科',
  restorative: '修复学',
  orthodontics: '正畸学',
  preventive: '预防口腔医学',
  anesthesia: '口腔麻醉',
  radiology: '口腔影像',
}

/** AI 评判结果 */
export interface JudgeResult {
  score: number          // 0-5
  isPass: boolean        // score >= 3
  coverageRate: number   // 0.0 - 1.0
  feedback: string
  missedPoints: string[]
  corrections: Correction[]
  provider: string       // 使用的评判方式
}

export interface Correction {
  studentSaid: string
  shouldBe: string
  note: string
}

/** AI Provider 统一接口 */
export interface JudgeProvider {
  id: string
  name: string
  requiresApiKey: boolean
  requiresNetwork: boolean

  judge(params: {
    studentAnswer: string
    card: DentalCard
  }): Promise<JudgeResult>

  testConnection(apiKey?: string): Promise<boolean>
}

/** 学习会话状态 */
export interface StudySession {
  currentCardIndex: number
  cards: DentalCard[]
  results: StudyResult[]
  isComplete: boolean
}

export interface StudyResult {
  cardId: string
  studentAnswer: string
  judgeResult: JudgeResult
  timestamp: number
}
