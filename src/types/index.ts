// 核心类型定义

/** 牙科知识卡片 */
export interface DentalCard {
  id: string
  question: string
  referenceAnswer: string
  keyPoints: string[]
  keywords: string[]
  difficulty: number
  category: DentistryCategory
  /** 卡片来源 */
  source?: 'builtin' | 'user'
  /** 所属题库 ID */
  deckId?: string
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

// ============================================================
// 题库系统（新增）
// ============================================================

/** 题库 */
export interface Deck {
  id: string
  name: string
  description: string
  cardCount: number
  source: 'builtin' | 'user'
  createdAt: number
  updatedAt: number
}

/** 题库统计 */
export interface DeckStats {
  totalCards: number
  studiedCards: number
  avgScore: number
  passRate: number
  lastStudied: number | null
}

/** 学习记录（持久化） */
export interface StudyRecord {
  id?: number
  cardId: string
  deckId: string
  studentAnswer: string
  score: number
  isPass: boolean
  coverageRate: number
  feedback: string
  missedPoints: string[]
  timestamp: number
}

/** 解析后的待导入卡片 */
export interface ParsedCard {
  tempId: string
  question: string
  referenceAnswer: string
  keyPoints: string[]
  keywords: string[]
  difficulty: number
  category: DentistryCategory
}

/** 解析结果摘要 */
export interface ParseSummary {
  cards: ParsedCard[]
  description: string           // 提取的描述/注释文本
  totalFound: number            // 总共发现的题目数
  essayCount: number            // 论述题数量
  filteredTypes: string[]       // 被过滤的题型（如["选择题", "判断题"]）
}

/** 应用视图 */
export type AppView = 'decks' | 'import' | 'study' | 'complete' | 'manage'

/** 内置题库 ID */
export const BUILTIN_DECK_ID = '__builtin__'

/** 错题本题库 ID */
export const ERROR_DECK_ID = '__errorbook__'
