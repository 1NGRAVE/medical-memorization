/**
 * 去重模块
 *
 * 基于文本标准化比对的卡片去重：
 *   1. 跨文档内部去重（同一文件解析出的重复卡片）
 *   2. 与已有题库去重（导入时检查是否已存在于 IndexedDB）
 */

import type { ParsedCard } from '../types'

// ============================================================
// 文本标准化
// ============================================================

/** 标准化文本用于比较 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, '')                                  // 去空白
    .replace(/[，。！？、；：""''（）\[\]【】《》〈〉]/g, '')        // 去中文标点
    .replace(/[,\.!\?;:\"'\(\)\[\]<>\/\\@#$%^&\*+=~`{|}]/g, '') // 去英文标点
    .trim()
}

// ============================================================
// 相似度判断
// ============================================================

/** 检查两张卡片是否重复 */
export function areCardsDuplicate(
  a: { question: string },
  b: { question: string }
): boolean {
  const normA = normalize(a.question)
  const normB = normalize(b.question)

  // 精确匹配
  if (normA === normB) return true

  // 一方包含另一方
  if (normA.length > 15 && normB.length > 15) {
    if (normA.includes(normB) || normB.includes(normA)) return true
  }

  return false
}

// ============================================================
// 去重函数
// ============================================================

/**
 * 从 ParsedCard 数组内部去重
 */
export function dedupWithinCards(cards: ParsedCard[]): ParsedCard[] {
  const seen = new Set<string>()
  const result: ParsedCard[] = []

  for (const card of cards) {
    const norm = normalize(card.question)
    if (seen.has(norm)) continue
    seen.add(norm)
    result.push(card)
  }

  return result
}

/** 去重结果 */
export interface DedupResult {
  unique: ParsedCard[]
  duplicates: { card: ParsedCard; duplicateOf: string }[]
}

/**
 * 将待导入卡片与已有卡片去重
 */
export function dedupAgainstExisting(
  incoming: ParsedCard[],
  existing: { question: string }[]
): DedupResult {
  const duplicates: DedupResult['duplicates'] = []
  const unique: ParsedCard[] = []

  for (const card of incoming) {
    const dup = existing.find(e => areCardsDuplicate(card, e))
    if (dup) {
      duplicates.push({ card, duplicateOf: dup.question.slice(0, 60) })
    } else {
      unique.push(card)
    }
  }

  // 内部去重
  const deDuped = dedupWithinCards(unique)

  return { unique: deDuped, duplicates }
}
