/**
 * 知识点分割编排器
 *
 * 按优先级依次尝试 5 种策略，首次命中即返回。
 * 若前 4 种确定性策略都未命中，使用策略 5（标题分块+模板出题 / AI 增强）。
 *
 * 策略优先级：
 *   1. term-def     (【】术语：定义，覆盖 4/10)
 *   2. outline      (术语/定义交替，覆盖 3/10)
 *   3. numbered-qa  (编号式问答，覆盖 2/10)
 *   4. explicit-qa  (显式问答标记，覆盖 2/10)
 *   5. heading-chunk (标题分块+模板出题，兜底)
 */

import type { ParsedCard, DocSection, ParseSummary, CardType } from '../types'
import { termDefExtract } from './strategies/term-def'
import { outlineExtract } from './strategies/outline'
import { numberedQAExtract } from './strategies/numbered-qa'
import { explicitQAExtract } from './strategies/explicit-qa'
import { headingChunkExtract } from './question-gen'
import { dedupWithinCards } from './dedup'

// ============================================================
// 编排入口
// ============================================================

export interface SegmentOptions {
  /** 文档结构（来自 docx-structure.ts） */
  sections?: DocSection[]
  /** AI 解析器的 API Key（可选） */
  apiKey?: string
}

export interface SegmentResult {
  cards: ParsedCard[]
  strategy: string
  source: 'deterministic' | 'template' | 'ai'
}

/**
 * 主策略编排器
 * 按优先级尝试各策略，返回最佳结果
 */
export function segmentKnowledgePoints(
  rawText: string,
  options: SegmentOptions = {}
): SegmentResult {
  // ---- 运行所有确定性策略，取最佳结果（最多卡片数）----

  const r1 = termDefExtract(rawText)
  const r2 = outlineExtract(rawText)
  const r3 = numberedQAExtract(rawText)
  const r4 = explicitQAExtract(rawText)

  // 找到卡片数最多的策略
  const candidates: { result: { cards: ParsedCard[] }; strategy: string }[] = [
    { result: r1, strategy: 'term_def' },
    { result: r2, strategy: 'outline' },
    { result: r3, strategy: 'numbered_qa' },
    { result: r4, strategy: 'explicit_qa' },
  ]

  let bestCards = 0
  let bestStrategy = ''

  for (const c of candidates) {
    if (c.result.cards.length > bestCards) {
      bestCards = c.result.cards.length
      bestStrategy = c.strategy
    }
  }

  // 确定性策略命中（>=2 张卡片）
  if (bestCards >= 2) {
    const winner = candidates.find(c => c.strategy === bestStrategy)!
    return {
      cards: dedupWithinCards(winner.result.cards),
      strategy: bestStrategy,
      source: 'deterministic',
    }
  }

  // ---- 策略 5：标题分块 + 模板出题（兜底）----
  if (options.sections && options.sections.length > 0) {
    const r5 = headingChunkExtract(options.sections)
    return {
      cards: dedupWithinCards(r5.cards),
      strategy: 'heading_chunk',
      source: 'template',
    }
  }

  // ---- 终极兜底：无结构时按段落分割 ----
  const paragraphs = rawText
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 25 && !/^第[一二三四五六七八九十\d]+章/.test(p))
    .slice(0, 30)

  const cards: ParsedCard[] = paragraphs.map((p, i) => {
    const firstLine = p.split(/\n/)[0].replace(/^\s*(?:\d+[\.、)）]\s*)+/, '').trim()
    const subject = firstLine.length >= 5 ? firstLine.slice(0, 40) : '下列知识点'
    return {
      tempId: `fb_${i}_${Date.now()}`,
      question: `请简述${subject}。`,
      referenceAnswer: p.slice(0, 2000),
      keyPoints: p.split(/[；;。]+/).map(s => s.trim()).filter(s => s.length > 4 && s.length < 60).slice(0, 8),
      keywords: [],
      difficulty: Math.min(5, Math.ceil(p.length / 200)),
      category: 'dental_anatomy' as const,
      cardType: 'essay' as const,
    }
  })

  return {
    cards: dedupWithinCards(cards),
    strategy: 'heading_chunk',
    source: 'template',
  }
}

// ============================================================
// 构建 ParseSummary
// ============================================================

export function buildSummary(result: SegmentResult, rawText: string): ParseSummary {
  const typeBreakdown: Partial<Record<CardType, number>> = {}
  for (const card of result.cards) {
    const ct = card.cardType || 'essay'
    typeBreakdown[ct] = (typeBreakdown[ct] || 0) + 1
  }

  // 从原始文本中提取非知识性内容作为 description
  const descMatch = rawText.match(/^(.{20,300}?)(?:[（(][一二三四五六七八九十]+[）)]|【|第[一二三四五六七八九十\d]+章)/)
  const description = descMatch ? descMatch[1].trim() : ''

  return {
    cards: result.cards,
    description,
    totalFound: result.cards.length,
    essayCount: typeBreakdown['essay'] || 0,
    filteredTypes: [],
    strategy: result.strategy as ParseSummary['strategy'],
    typeBreakdown,
    duplicatesSkipped: 0,
  }
}
