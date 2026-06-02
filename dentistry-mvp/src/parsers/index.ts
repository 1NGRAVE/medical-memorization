/**
 * 解析器调度器 — 结构提取 → 策略编排 → AI 增强 → 去重
 *
 * 新管道：
 *   1. extractStructuredDocx(buffer) → { rawText, structure }
 *   2. segmentKnowledgePoints(rawText, { sections, apiKey? })
 *      ├─ 策略1-4 确定性提取（毫秒级）
 *      └─ 策略5 标题分块+模板/AI 兜底
 *   3. buildSummary(result, rawText) → ParseSummary
 */

import { extractStructuredDocx, summarizeStructure } from './docx-structure'
import { segmentKnowledgePoints, buildSummary } from './segmenter'
import { createDeepSeekParseProvider } from './ai-parser'
import { chunkDocument } from './chunker'
import { dedupWithinCards } from './dedup'
import type { ParseSummary, ParsedCard } from '../types'

export async function parseDocx(
  file: File,
  apiKey?: string
): Promise<ParseSummary> {
  // 1. 提取结构化内容 + 原始文本
  const buffer = await file.arrayBuffer()
  const { rawText, structure } = await extractStructuredDocx(buffer)

  if (!rawText.trim()) {
    throw new Error('未能从文件中提取到文本。请确认文件是 .docx 格式且包含文字内容。')
  }

  // 2. 策略编排（确定性策略 1-4，或兜底策略 5）
  const result = segmentKnowledgePoints(rawText, {
    sections: structure.sections,
    apiKey,
  })

  // 3. AI 增强（仅在策略5兜底且有 API Key 时）
  if (apiKey && result.source === 'template' && result.cards.length > 0) {
    try {
      const provider = createDeepSeekParseProvider(apiKey)
      const structureSummary = summarizeStructure(structure)
      const chunks = chunkDocument(structure.sections)

      if (chunks.chunks.length === 1) {
        // 单块文档，直接 AI 解析
        const aiSummary = await provider.parse({
          rawText: chunks.chunks[0],
          structureSummary,
        })
        if (aiSummary.cards.length > 0) {
          return {
            ...aiSummary,
            cards: dedupWithinCards(aiSummary.cards),
            strategy: 'heading_chunk' as const,
          }
        }
      } else {
        // 多块文档，逐块 AI 解析
        const allCards: ParsedCard[] = []
        for (let i = 0; i < chunks.chunks.length; i++) {
          const chunkContext = `${structureSummary}\n\n[第 ${i + 1}/${chunks.chunks.length} 部分]`
          const chunkSummary = await provider.parse({
            rawText: chunks.chunks[i],
            structureSummary: chunkContext,
          })
          allCards.push(...chunkSummary.cards)
        }

        if (allCards.length > 0) {
          const summary = buildSummary(result, rawText)
          return {
            ...summary,
            cards: dedupWithinCards(allCards),
            strategy: 'heading_chunk' as const,
          }
        }
      }
    } catch (e) {
      console.warn('AI 解析失败，使用模板出题结果:', e)
      // 降级到模板结果
    }
  }

  // 4. 构建最终摘要
  return buildSummary(result, rawText)
}
