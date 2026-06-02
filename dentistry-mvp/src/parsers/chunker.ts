/**
 * 大文档分块器
 *
 * 对超过 AI 上下文窗口的文档按 section 边界切分。
 * 估算中英文混合文本的 token 数，确保每块 ≤ 12000 tokens。
 */

import type { DocSection } from '../types'

/** 每块最大 token 数（保留 prompt + response 空间） */
const MAX_CHUNK_TOKENS = 12000
const PROMPT_OVERHEAD = 3000

// ============================================================
// Token 估算
// ============================================================

/**
 * 估算中英文混合文本的 token 数
 * 经验值：中文 ~0.6 token/字，英文词 ~1.3 token/词
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length
  const japaneseChars = (text.match(/[぀-ゟ゠-ヿ]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  // 剩余字符（标点、数字、空格等）按 0.3 token/char 估算
  const other = text.length - chineseChars - japaneseChars - englishWords * 3

  return Math.ceil(
    chineseChars * 0.6 +
    japaneseChars * 0.8 +
    englishWords * 1.3 +
    Math.max(0, other) * 0.3
  )
}

// ============================================================
// Section 文本构建
// ============================================================

function sectionToText(section: DocSection): string {
  const parts: string[] = []
  if (section.heading) {
    const prefix = '#'.repeat(Math.min(section.heading.level, 4))
    parts.push(`${prefix} ${section.heading.text}`)
  }
  for (const node of section.nodes) {
    parts.push(node.text)
  }
  return parts.join('\n\n')
}

// ============================================================
// 分块
// ============================================================

export interface ChunkResult {
  chunks: string[]
  estimatedCalls: number
}

/**
 * 将文档按 section 边界分块，确保每块不超过 token 限制
 */
export function chunkDocument(sections: DocSection[]): ChunkResult {
  const totalText = sections.map(sectionToText).join('\n\n')
  const totalTokens = estimateTokens(totalText)

  // 小文档不需要分块
  if (totalTokens <= MAX_CHUNK_TOKENS) {
    return { chunks: [totalText], estimatedCalls: 1 }
  }

  const chunks: string[] = []
  let currentChunk = ''
  let currentTokens = PROMPT_OVERHEAD

  for (const section of sections) {
    const sectionText = sectionToText(section)
    const sectionTokens = estimateTokens(sectionText)

    if (currentTokens + sectionTokens > MAX_CHUNK_TOKENS) {
      if (currentChunk) chunks.push(currentChunk)
      currentChunk = sectionText
      currentTokens = PROMPT_OVERHEAD + sectionTokens
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + sectionText
      currentTokens += sectionTokens
    }
  }

  if (currentChunk) chunks.push(currentChunk)

  return { chunks, estimatedCalls: chunks.length }
}
