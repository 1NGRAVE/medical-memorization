/**
 * .medq (Medical Question Deck) 文件格式类型定义
 *
 * .medq 是一个 JSON 文件，用于题库的导入导出交换。
 * 卡片不包含内部数据库字段 (id, deckId, source)，导入时重新生成。
 */

import type { CardType, DentistryCategory } from './index'

/** .medq 文件中的单张卡片（无内部ID/来源/题库ID） */
export interface MedqCard {
  question: string
  referenceAnswer: string
  keyPoints: string[]
  keywords: string[]
  difficulty: number
  category: DentistryCategory
  cardType?: CardType
  options?: string[]
  correctOptionIndex?: number
  blankSegments?: string[]
}

/** .medq 文件顶层结构 */
export interface MedqFile {
  version: 1
  type: 'medical-question-deck'
  exportedAt: string  // ISO 8601
  deck: {
    name: string
    description: string
  }
  cards: MedqCard[]
}

/** 解析 .medq 文件的结果 */
export interface MedqParseResult {
  success: boolean
  data?: MedqFile
  error?: string
  /** 非致命警告（版本不匹配、部分卡片被过滤等） */
  warnings: string[]
}
