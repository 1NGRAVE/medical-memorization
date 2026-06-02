/**
 * 策略 3 — 编号式问答提取器
 *
 * 覆盖 2/10 医学文档（药理往年题、免疫大题）
 *
 * 输入：
 *   1、阿司匹林和氯丙嗪的降温作用的异同【2】⭐⭐
 *   【异】（机制）氯丙嗪通过抑制下丘脑体温调节中枢...
 *   【同】对发热和正常体温升高都具有解热作用。
 *
 *   2、肾上腺素的临床应用【4】⭐⭐⭐⭐
 *   【临床应用】
 *   (1)心搏骤停...
 *
 * 支持多种编号格式：1、1. 1) （一） ① 第4题 五、 A.
 */

import type { ParsedCard, DentistryCategory, CardType } from '../../types'

// ============================================================
// 编号检测
// ============================================================

interface NumberingMatch {
  index: number
  questionText: string
}

/** 所有支持的编号正则 */
const NUMBERING_PATTERNS: RegExp[] = [
  /^(\d+)[、.，)]\s*(?=\S)/,                          // 1、 1. 1) 1,
  /^[（(]([一二三四五六七八九十]+)[）)]\s*(?=\S)/,       // （一）（二）
  /^[（(](\d+)[）)]\s*(?=\S)/,                        // (1) （1）
  /^第[一二三四五六七八九十\d]+题\s*/,
  /^[（(]?[①②③④⑤⑥⑦⑧⑨⑩][）)]?\s*/,
  /^[一二三四五六七八九十]+[、．]\s*/,
  /^([A-E])[.、)]\s*(?=[^A-E])/,                     // A. B、 (only when followed by non-A-E)
  /^\d+\s*[.、]?\s*[问：]/,                           // "1. 问：" variant
]

/** 检测一行是否以编号开头 */
function detectNumbering(line: string): NumberingMatch | null {
  const trimmed = line.trim()
  for (const pattern of NUMBERING_PATTERNS) {
    const m = trimmed.match(pattern)
    if (m) {
      const questionText = trimmed.slice(m[0].length).trim()
      // 移除末尾的难度/频率标记如【2】⭐⭐
      const cleanQuestion = questionText.replace(/[【\[]\d+[】\]].*$/, '').trim()
      if (cleanQuestion.length > 5) {
        return { index: 0, questionText: cleanQuestion }
      }
    }
  }
  return null
}

// ============================================================
// 卡片构建辅助
// ============================================================

function classifyContent(text: string): DentistryCategory {
  const lower = text.toLowerCase()
  if (/龋|蛀牙|caries/.test(lower)) return 'oral_pathology'
  if (/牙周|牙龈|periodont|gingiv/.test(lower)) return 'periodontics'
  if (/根管|牙髓|pulp|endodont|rct/.test(lower)) return 'endodontics'
  if (/拔牙|智齿|种植|implant|麻醉/.test(lower)) return 'oral_surgery'
  if (/冠|桥|修复|restor|crown|bridge|义齿/.test(lower)) return 'restorative'
  if (/正畸|矫正|矫治|orthodont|错[颌𬌗]/.test(lower)) return 'orthodontics'
  if (/氟|窝沟|预防|sealant|fluoride/.test(lower)) return 'preventive'
  if (/麻[药醉]|阻滞|anesth|lidocaine/.test(lower)) return 'anesthesia'
  if (/X线|片|影像|radiograph/.test(lower)) return 'radiology'
  return 'dental_anatomy'
}

function inferCardType(question: string, answer: string): CardType {
  if (/论述|简述|试述|阐述|比较|异同/.test(question)) return 'essay'
  if (answer.length > 400) return 'essay'
  return 'short_answer'
}

function extractKeywords(text: string): string[] {
  const words = new Set<string>()
  const enMatches = text.matchAll(/[a-zA-Z][a-zA-Z\s-]{2,}/g)
  for (const m of enMatches) {
    const w = m[0].trim()
    if (w.length > 2 && !/^(the|and|for|from|are|has|can|its|was|with|that|this|have|been)$/i.test(w)) {
      words.add(w)
    }
  }
  const cnMatches = text.matchAll(/[^\s,，。；;、\d]{2,4}(?:症|病|炎|术|药|质|骨|牙|齿|膜|管|体|菌|法|剂|冠|桥|学|素|体|酶|子|白|脉)/g)
  for (const m of cnMatches) words.add(m[0])
  return [...words].slice(0, 8)
}

function extractKeyPoints(answer: string): string[] {
  // 尝试按 【】 或 (数字) 分段
  const sections = answer.match(/【.+?】[^【]*/g)
  if (sections && sections.length >= 2) {
    return sections.map(s => s.trim().slice(0, 80)).slice(0, 8)
  }
  return answer
    .split(/[；;。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 80)
    .slice(0, 8)
}

function guessDifficulty(question: string, answer: string): number {
  const len = (question + answer).length
  if (len < 100) return 1
  if (len < 300) return 2
  if (len < 600) return 3
  if (len < 1000) return 4
  return 5
}

// ============================================================
// 答案边界检测
// ============================================================

/** 判断一行是否暗示新题目开始 */
function isNewQuestionStart(line: string): boolean {
  const trimmed = line.trim()
  // 检测编号
  for (const pattern of NUMBERING_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }
  // 检测 section header
  if (/^[（(][一二三四五六七八九十]+[）)]/.test(trimmed)) return true
  if (/^第[一二三四五六七八九十\d]+[章节]/.test(trimmed)) return true
  return false
}

// ============================================================
// 主提取函数
// ============================================================

export interface NumberedQAResult {
  cards: ParsedCard[]
  extractedCount: number
}

/**
 * 从文本中提取编号式问答对
 */
export function numberedQAExtract(rawText: string): NumberedQAResult {
  const lines = rawText.split('\n')
  const cards: ParsedCard[] = []
  const seenQuestions = new Set<string>()

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }

    const numMatch = detectNumbering(line)
    if (!numMatch) { i++; continue }

    // 找到问题文本，开始收集答案
    const questionText = numMatch.questionText
    const answerLines: string[] = []

    // 收集后续行直到遇到新编号或空行+新编号
    i++
    while (i < lines.length) {
      const nextLine = lines[i].trim()

      // 空行后检查是否是下一个题
      if (!nextLine) {
        i++
        // 看空行后是否有新题目
        if (i < lines.length && isNewQuestionStart(lines[i])) {
          break
        }
        continue
      }

      // 显式的问：不在此策略（属于策略4）
      if (/^问[：:]/.test(nextLine)) break

      // 新编号 → 下一个题
      if (isNewQuestionStart(nextLine)) break

      answerLines.push(nextLine)
      i++
    }

    const answer = answerLines.join('\n').trim()

    // 验证：问题和答案都有效
    if (questionText.length > 5 && answer.length > 10) {
      const normalizedQ = questionText.replace(/\s+/g, '').toLowerCase()
      if (!seenQuestions.has(normalizedQ)) {
        seenQuestions.add(normalizedQ)

        const cardType = inferCardType(questionText, answer)
        const category = classifyContent(questionText + ' ' + answer)
        const keywords = extractKeywords(questionText + ' ' + answer)
        const keyPoints = extractKeyPoints(answer)
        const difficulty = guessDifficulty(questionText, answer)

        cards.push({
          tempId: `nq_${cards.length}_${Date.now()}`,
          question: questionText.slice(0, 200),
          referenceAnswer: answer.slice(0, 2000),
          keyPoints,
          keywords,
          difficulty,
          category,
          cardType,
        })
      }
    }
  }

  return { cards, extractedCount: cards.length }
}
