/**
 * 解析器调度器 —— AI 优先，失败降级正则
 */

import { extractTextFromDocx, parseQAPairs } from './docx-parser'
import { aiParseQAPairs } from './ai-parser'
import type { ParsedCard } from '../types'

export async function parseDocx(
  file: File,
  apiKey?: string
): Promise<{ cards: ParsedCard[]; usedAI: boolean }> {
  const buffer = await file.arrayBuffer()
  const rawText = await extractTextFromDocx(buffer)

  if (!rawText.trim()) {
    throw new Error('未能从文件中提取到文本。请确认文件是 .docx 格式且包含文字内容。')
  }

  // 有 API Key 时优先用 AI
  if (apiKey) {
    try {
      const cards = await aiParseQAPairs(rawText, apiKey)
      if (cards.length > 0) {
        return { cards, usedAI: true }
      }
    } catch (e) {
      console.warn('AI 解析失败，降级到正则解析:', e)
    }
  }

  // 正则兜底
  const cards = parseQAPairs(rawText)
  return { cards, usedAI: false }
}
