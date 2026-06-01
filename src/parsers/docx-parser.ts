/**
 * DOCX 正则解析器 —— 使用 mammoth.js 提取文本后用正则匹配 Q&A 对
 */

import mammoth from 'mammoth'
import type { ParsedCard, DentistryCategory } from '../types'

/** 从 .docx 文件提取纯文本 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

/** 简单分类推断 */
function guessCategory(text: string): DentistryCategory {
  const lower = text.toLowerCase()
  if (/龋|蛀牙|caries/.test(lower)) return 'oral_pathology'
  if (/牙周|牙龈|periodont|gingiv/.test(lower)) return 'periodontics'
  if (/根管|牙髓|pulp|endodont|rct/.test(lower)) return 'endodontics'
  if (/拔牙|智齿|种植|implant|麻醉|麻药/.test(lower)) return 'oral_surgery'
  if (/冠|桥|修复|restor|crown|bridge/.test(lower)) return 'restorative'
  if (/正畸|矫正|矫治|orthodont|错颌/.test(lower)) return 'orthodontics'
  if (/氟|窝沟|预防|sealant|fluoride/.test(lower)) return 'preventive'
  if (/麻|阻滞|麻醉|anesth|lidocaine/.test(lower)) return 'anesthesia'
  if (/X线|片|影像|radiograph/.test(lower)) return 'radiology'
  return 'dental_anatomy'
}

/** 从文本中提取关键词 */
function extractKeywords(text: string): string[] {
  const patterns = [
    /[a-zA-Z]{3,}/g,                          // 英文术语
    /[^\s,，。；;、\d]{2,4}(?:症|病|炎|术|药|质|骨|牙|齿|膜|管|体|菌|法|剂)/g, // 医学术语
  ]
  const words = new Set<string>()
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) matches.forEach(m => words.add(m.toLowerCase()))
  }
  return [...words].slice(0, 8)
}

/** 从答案中提取关键点（按标点拆分） */
function extractKeyPoints(answer: string): string[] {
  return answer
    .split(/[；;。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 4 && s.length < 60)
    .slice(0, 8)
}

/** 估计难度 */
function guessDifficulty(question: string, answer: string): number {
  const len = (question + answer).length
  if (len < 100) return 1
  if (len < 200) return 2
  if (len < 400) return 3
  if (len < 600) return 4
  return 5
}

// ============================================================
// 正则匹配模式
// ============================================================

/** 模式1：问/答标记 */
const PATTERN_QA = /问[：:]\s*(.+?)\s*答[：:]\s*([\s\S]+?)(?=\n\s*问[：:]|\n*$)/g

/** 模式2：编号 + 答案 */
const PATTERN_NUMBERED = /(\d+)[\.、)）]\s*(.{8,100}?)\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*\d+[\.、)）]|\n*$)/g

/** 模式3：括号标记【】 */
const PATTERN_BRACKET = /【问题[：:]?】\s*(.+?)\s*【答案[：:]?】\s*([\s\S]+?)(?=【问题|$)/g

/** 模式4：Q&A 英文格式 */
const PATTERN_QA_EN = /Q[：:]\s*(.+?)\s*A[：:]\s*([\s\S]+?)(?=\n\s*Q[：:]|\n*$)/gi

export function parseQAPairs(rawText: string): ParsedCard[] {
  const cards: ParsedCard[] = []

  // 尝试各种模式
  let match
  const usedPatterns: string[] = []

  // 模式1：中文问/答
  while ((match = PATTERN_QA.exec(rawText)) !== null) {
    cards.push(buildCard(cards.length, match[1].trim(), match[2].trim()))
  }
  if (cards.length > 0) return cards

  // 模式2：编号格式
  while ((match = PATTERN_NUMBERED.exec(rawText)) !== null) {
    cards.push(buildCard(cards.length, match[2].trim(), match[3].trim()))
  }
  if (cards.length > 0) return cards

  // 模式3：括号格式
  while ((match = PATTERN_BRACKET.exec(rawText)) !== null) {
    cards.push(buildCard(cards.length, match[1].trim(), match[2].trim()))
  }
  if (cards.length > 0) return cards

  // 模式4：英文 Q&A
  while ((match = PATTERN_QA_EN.exec(rawText)) !== null) {
    cards.push(buildCard(cards.length, match[1].trim(), match[2].trim()))
  }
  if (cards.length > 0) return cards

  // 兜底：按双换行拆分段落，每段生成一张总结卡片
  const paragraphs = rawText.split(/\n\s*\n+/).filter(p => p.trim().length > 20)
  if (paragraphs.length >= 2) {
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].trim()
      const firstLine = text.split(/\n/)[0].slice(0, 60)
      cards.push(buildCard(
        i,
        firstLine.length < text.length ? firstLine + '…' : firstLine,
        text
      ))
    }
    usedPatterns.push('段落拆分')
  }

  // 最终兜底：整篇文本作为一张卡片
  if (cards.length === 0) {
    const firstLine = rawText.split(/\n/)[0].slice(0, 80)
    cards.push(buildCard(0, firstLine, rawText))
    usedPatterns.push('全文兜底')
  }

  return cards
}

function buildCard(index: number, question: string, answer: string): ParsedCard {
  return {
    tempId: `q_${index}_${Date.now()}`,
    question: question.slice(0, 200),
    referenceAnswer: answer.slice(0, 2000),
    keyPoints: extractKeyPoints(answer),
    keywords: extractKeywords(question + ' ' + answer),
    difficulty: guessDifficulty(question, answer),
    category: guessCategory(question + ' ' + answer),
  }
}
