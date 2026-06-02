/**
 * DOCX 正则解析器 — 基础兜底（向后兼容层）
 *
 * 保留 extractTextFromDocx 供外部使用。
 * parseQAPairs 委托给新的 5 种策略编排器，不再在此文件中实现具体逻辑。
 */

import mammoth from 'mammoth'
import type { ParseSummary } from '../types'
import { segmentKnowledgePoints, buildSummary } from './segmenter'

// ============================================================
// 文本提取（保持原有 API）
// ============================================================

/** 从 .docx 提取纯文本（无结构保留，仅用于兜底场景） */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

// ============================================================
// 旧 parseQAPairs 重定向到新策略系统
// ============================================================

/**
 * 正则兜底解析
 * @deprecated 推荐使用 parsers/index.ts 中的 parseDocx（自动编排新策略）
 */
export function parseQAPairs(rawText: string): ParseSummary {
  const result = segmentKnowledgePoints(rawText)
  return buildSummary(result, rawText)
}
