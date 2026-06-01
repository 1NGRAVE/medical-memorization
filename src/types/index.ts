// 核心类型定义

// ============================================================
// 题型系统
// ============================================================

/** 卡片题型 */
export type CardType = 'essay' | 'short_answer' | 'multiple_choice' | 'fill_blank' | 'true_false'

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  essay: '论述题',
  short_answer: '简答题',
  multiple_choice: '选择题',
  fill_blank: '填空题',
  true_false: '判断题',
}

/** 解析策略标识 */
export type ParseStrategy = 'term_def' | 'outline' | 'numbered_qa' | 'explicit_qa' | 'heading_chunk'

// ============================================================
// 文档结构类型
// ============================================================

/** 文档节点 */
export interface DocNode {
  type: 'heading' | 'paragraph' | 'list'
  level?: number
  text: string
  listItems?: string[]
}

/** 文档章节 */
export interface DocSection {
  heading?: { text: string; level: number }
  nodes: DocNode[]
}

/** 文档结构 */
export interface DocumentStructure {
  title?: string
  sections: DocSection[]
}

// ============================================================
// 核心卡片类型
// ============================================================

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
  /** 题型（默认 essay） */
  cardType?: CardType
  /** 选择题选项 */
  options?: string[]
  /** 选择题正确答案索引 */
  correctOptionIndex?: number
  /** 填空题分段 */
  blankSegments?: string[]
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
  /** 题型（默认 essay） */
  cardType?: CardType
  /** 选择题选项 */
  options?: string[]
  /** 选择题正确答案索引 */
  correctOptionIndex?: number
  /** 填空题分段 */
  blankSegments?: string[]
}

/** 解析结果摘要 */
export interface ParseSummary {
  cards: ParsedCard[]
  description: string           // 提取的描述/注释文本
  totalFound: number            // 总共发现的题目数
  essayCount: number            // 论述题数量
  filteredTypes: string[]       // 被过滤的题型（如["选择题", "判断题"]）
  /** 实际使用的解析策略 */
  strategy?: ParseStrategy
  /** 题型分类统计（如 { essay: 5, short_answer: 12, multiple_choice: 3 }） */
  typeBreakdown?: Partial<Record<CardType, number>>
  /** 去重跳过数 */
  duplicatesSkipped?: number
}

/** 应用视图 */
export type AppView = 'decks' | 'import' | 'study' | 'complete' | 'manage'

/** 内置题库 ID */
export const BUILTIN_DECK_ID = '__builtin__'

/** 错题本题库 ID */
export const ERROR_DECK_ID = '__errorbook__'
