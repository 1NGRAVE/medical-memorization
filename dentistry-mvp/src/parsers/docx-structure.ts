/**
 * 文档结构提取 — 使用 mammoth HTML 模式保留标题/列表/段落结构
 *
 * 替代原来的 extractRawText() 纯文本方式，保留文档的信息架构，
 * 为标题分块、知识点分割提供结构化输入。
 */

import mammoth from 'mammoth'
import type { DocSection, DocumentStructure } from '../types'

// ============================================================
// 主入口
// ============================================================

/** 从 .docx 提取结构化内容和原始文本 */
export async function extractStructuredDocx(
  buffer: ArrayBuffer
): Promise<{ html: string; rawText: string; structure: DocumentStructure }> {
  // 1. 结构化 HTML（保留 H1-H6、P、UL/OL/LI、TABLE）
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer })
  const html = htmlResult.value

  // 2. 原始纯文本（兜底）
  const textResult = await mammoth.extractRawText({ arrayBuffer: buffer })
  const rawText = textResult.value

  // 3. 解析 HTML → 文档结构树
  const structure = parseHtmlToStructure(html)

  return { html, rawText, structure }
}

// ============================================================
// HTML → DocSection[] 解析
// ============================================================

function parseHtmlToStructure(html: string): DocumentStructure {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  const sections: DocSection[] = []
  let currentSection: DocSection = { nodes: [] }
  const titleEl = body.querySelector('h1')
  const title = titleEl?.textContent?.trim() || undefined

  // Collect all top-level elements in body
  // mammoth outputs: h1-h6 for headings, p for paragraphs, ul/ol for lists, table for tables
  const elements = Array.from(body.children)

  for (const el of elements) {
    const tag = el.tagName.toLowerCase()

    // Heading → new section
    if (/^h[1-6]$/.test(tag)) {
      if (currentSection.heading || currentSection.nodes.length > 0) {
        sections.push(currentSection)
      }
      currentSection = {
        heading: {
          text: (el.textContent || '').trim(),
          level: parseInt(tag[1]),
        },
        nodes: [],
      }
      continue
    }

    // Paragraph
    if (tag === 'p') {
      const text = (el.textContent || '').trim()
      const strongText = [...el.querySelectorAll('strong, b')]
        .map(s => (s.textContent || '').trim())
        .filter(Boolean)
      // If it has bold text, include it as emphasis hint
      const finalText = strongText.length > 0
        ? `【强调：${strongText.join('、')}】${text}`
        : text
      if (finalText.length > 0) {
        currentSection.nodes.push({ type: 'paragraph', text: finalText })
      }
      continue
    }

    // Unordered / Ordered list
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll('li'))
        .map(li => (li.textContent || '').trim())
        .filter(t => t.length > 0)
      if (items.length > 0) {
        currentSection.nodes.push({
          type: 'list',
          text: items.join('\n'),
          listItems: items,
        })
      }
      continue
    }

    // Table → flatten to text paragraphs
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'))
        .map(tr =>
          Array.from(tr.querySelectorAll('td, th'))
            .map(cell => (cell.textContent || '').trim())
            .filter(Boolean)
            .join(' | ')
        )
        .filter(r => r.length > 0)
      if (rows.length > 0) {
        currentSection.nodes.push({ type: 'paragraph', text: rows.join('\n') })
      }
      continue
    }
  }

  // Push the last section
  if (currentSection.heading || currentSection.nodes.length > 0) {
    sections.push(currentSection)
  }

  return { title, sections }
}

// ============================================================
// 结构摘要（供 AI prompt 使用）
// ============================================================

/** 生成文档结构的可读摘要，用于 AI 上下文 */
export function summarizeStructure(structure: DocumentStructure): string {
  const lines: string[] = []
  if (structure.title) {
    lines.push(`# ${structure.title}`)
  }
  for (const s of structure.sections) {
    if (s.heading) {
      const prefix = '#'.repeat(Math.min(s.heading.level, 4))
      lines.push(`${prefix} ${s.heading.text}`)
    }
    for (const n of s.nodes) {
      if (n.type === 'paragraph') {
        const preview = n.text.length > 80 ? n.text.slice(0, 80) + '...' : n.text
        lines.push(`  📄 ${preview}`)
      } else if (n.type === 'list') {
        lines.push(`  📋 [${n.listItems?.length || 0} 项列表]`)
      }
    }
  }
  return lines.join('\n')
}
