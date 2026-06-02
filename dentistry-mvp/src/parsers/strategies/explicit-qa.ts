/**
 * 策略 4 — 显式问答标记提取器（增强版）
 *
 * 覆盖 2/10 医学文档（口腔修复学-测试题库、多格式编号测试题库）
 *
 * 支持 8 组正则匹配：
 *   问：...答：...
 *   【问题】...【答案】...
 *   Q: ... A: ...
 *   问题：... 答案：...
 *   简答题：... (no explicit answer marker)
 *   论述题：...
 *   名词解释：...
 *   多选题：... + 答案：...
 *
 * 核心改进：不再过滤非论述题，而是标记 cardType 保留所有题型
 */

import type { ParsedCard, DentistryCategory, CardType } from '../../types'

// ============================================================
// 题型检测（增强版，返回结构化信息）
// ============================================================

interface TypeDetection {
  cardType: CardType
  options?: string[]
  correctOptionIndex?: number
  blankSegments?: string[]
}

function detectCardType(questionText: string, answerText: string): TypeDetection {
  const combined = `${questionText}\n${answerText}`

  // 多选题 / 单选题
  const mcPrefix = /^(多选题|单选题|选择题|单项选择题|多项选择题)[：:]/i
  if (mcPrefix.test(questionText)) {
    const options = extractOptions(combined)
    if (options.length >= 3) {
      const correctMatch = answerText.match(/答案[：:]\s*([A-E]+)/i)
      return {
        cardType: 'multiple_choice',
        options,
        correctOptionIndex: correctMatch ? 'ABCDE'.indexOf(correctMatch[1].toUpperCase()) : 0,
      }
    }
  }

  // 选项模式 A. ... B. ... C. ... D. ...
  const optionItems = questionText.match(/[A-E][\.、)]\s*.{2,50}?(?=\s*[A-E][\.、)]|$)/g)
  if (optionItems && optionItems.length >= 3) {
    const options = optionItems.map(o => o.replace(/^[A-E][\.、)]\s*/, '').trim())
    const correctMatch = answerText.match(/答案[：:]\s*([A-E]+)/i)
    return {
      cardType: 'multiple_choice',
      options,
      correctOptionIndex: correctMatch ? 'ABCDE'.indexOf(correctMatch[1].toUpperCase()) : 0,
    }
  }

  // 填空题
  const blanks = questionText.match(/_{2,}|（\s*）|\(\s*\)/g)
  if (blanks && blanks.length > 0) {
    const segments = questionText.split(/_{2,}|（\s*）|\(\s*\)/)
    return {
      cardType: 'fill_blank',
      blankSegments: segments.map(s => s.trim()).filter(Boolean),
    }
  }

  // 判断题
  if (/判断[：:]|是非题|对错题|[（(]\s*[√×]\s*[）)]/.test(combined)) {
    return { cardType: 'true_false' }
  }
  if (/正确.*错误|[对错]错/.test(questionText)) {
    return { cardType: 'true_false' }
  }

  // 名词解释 → short_answer
  if (/名词解释|名解|解释下列名词/.test(combined)) {
    return { cardType: 'short_answer' }
  }

  // 论述题/简答题判断
  if (/论述|试述|阐述|详述|比较|异同|区别/.test(questionText)) {
    return { cardType: 'essay' }
  }
  if (/简述|简答|说明|描述|概括|总结|列举/.test(questionText)) {
    return { cardType: 'short_answer' }
  }

  // 按答案长度判断
  if (answerText.length > 400) return { cardType: 'essay' }
  return { cardType: 'short_answer' }
}

/** 从文本中提取选择题选项 */
function extractOptions(text: string): string[] {
  const matches = text.match(/[A-E][\.、)]\s*(.+?)(?=\s*[A-E][\.、)]|$|\n答案)/g)
  return matches
    ? matches.map(m => m.replace(/^[A-E][\.、)]\s*/, '').trim().slice(0, 60))
    : []
}

// ============================================================
// 问答提取正则（8 组）
// ============================================================

interface QAPattern {
  name: string
  regex: RegExp
  qGroup: number
  aGroup: number
}

const QA_PATTERNS: QAPattern[] = [
  // 1. 问：... 答：... （标准中文格式）
  {
    name: '问/答',
    regex: /问[：:]\s*(.+?)\s*\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*问[：:]|\n*$)/g,
    qGroup: 1,
    aGroup: 2,
  },
  // 2. 【问题】...【答案】...
  {
    name: '【问题/答案】',
    regex: /【问题[：:]?】\s*(.+?)\s*【答案[：:]?】\s*([\s\S]+?)(?=【问题|$)/g,
    qGroup: 1,
    aGroup: 2,
  },
  // 3. Q: ... A: ... （英文格式）
  {
    name: 'Q/A',
    regex: /Q[：:]\s*(.+?)\s*\n\s*A[：:]\s*([\s\S]+?)(?=\n\s*Q[：:]|\n*$)/gi,
    qGroup: 1,
    aGroup: 2,
  },
  // 4. 问题：... 答案：...
  {
    name: '问题/答案',
    regex: /问题[：:]\s*(.+?)\s*\n\s*答案[：:]\s*([\s\S]+?)(?=\n\s*问题[：:]|\n*$)/g,
    qGroup: 1,
    aGroup: 2,
  },
  // 5. 简答题：... 论述题：...
  {
    name: '简答/论述题头',
    regex: /(?:简答题|论述题|问答题|名词解释)[：:]\s*(.+?)(?=\n\s*(?:简答题|论述题|问答题|名词解释)[：:]|$)/g,
    qGroup: 1,
    aGroup: -1, // no explicit answer
  },
  // 6. N. 题目\n答：答案 （编号+答案标记）
  {
    name: '编号+答',
    regex: /(?:^|\n)\s*(?:\d+[\.、)]\s*|[（(][一二三四五六七八九十\d]+[）)]\s*)(.+?)\s*\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*(?:\d+[\.、)]|[（(][一二三四五六七八九十\d]+[）)]|问[：:])|\n*$)/g,
    qGroup: 1,
    aGroup: 2,
  },
  // 7. 题目？\n（无答案标记但以多段落为答案）
  {
    name: '问句段落',
    regex: /(?:^|\n)([^问答\n]{5,120}?(?:[？?]))\s*\n\s*((?:.{10,200}(?:\n|$))+)/g,
    qGroup: 1,
    aGroup: 2,
  },
  // 8. 多选题：题目\nA. ... B. ... C. ... D. ...\n答案：X
  {
    name: '选择题块',
    regex: /(?:多选题|单选题|选择题|单项选择题|多项选择题)[：:]\s*(.+?)\s*\n\s*((?:[A-E][\.、)]\s*.+\s*)+)\s*(?:答案[：:]\s*([A-E]+))?/gi,
    qGroup: 1,
    aGroup: 2,
  },
]

// ============================================================
// 辅助函数
// ============================================================

function classifyText(text: string): DentistryCategory {
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
  return answer
    .split(/[；;。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 80)
    .slice(0, 8)
}

function guessDifficulty(q: string, a: string): number {
  const len = (q + a).length
  if (len < 100) return 1
  if (len < 300) return 2
  if (len < 600) return 3
  if (len < 1000) return 4
  return 5
}

function cleanQuestionText(q: string): string {
  return q
    .replace(/^\s*(?:\d+[\.、)）]\s*)+/, '')
    .replace(/^[（(][一二三四五六七八九十\d]+[）)]\s*/, '')
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
    .replace(/^[一二三四五六七八九十]+[、．]\s*/, '')
    .replace(/^第[一二三四五六七八九十\d]+题\s*/, '')
    .trim()
}

// ============================================================
// 主提取函数
// ============================================================

export interface ExplicitQAResult {
  cards: ParsedCard[]
  extractedCount: number
}

export function explicitQAExtract(rawText: string): ExplicitQAResult {
  const cards: ParsedCard[] = []
  const seenQuestions = new Set<string>()

  // 先尝试特殊的选择题模式（第8组）
  const mcPattern = QA_PATTERNS[7]
  let mcMatch: RegExpExecArray | null
  mcPattern.regex.lastIndex = 0
  while ((mcMatch = mcPattern.regex.exec(rawText)) !== null) {
    const question = mcMatch[1].trim()
    const optionsText = mcMatch[2].trim()
    const correctAnswer = mcMatch[3]?.trim()

    if (question.length > 3 && optionsText.length > 10) {
      const options = extractOptions(optionsText)
      const normalizedQ = question.replace(/\s+/g, '').toLowerCase()
      if (!seenQuestions.has(normalizedQ) && options.length >= 2) {
        seenQuestions.add(normalizedQ)
        cards.push({
          tempId: `eq_${cards.length}_${Date.now()}`,
          question: question.slice(0, 200),
          referenceAnswer: optionsText.slice(0, 500),
          keyPoints: options.slice(0, 8),
          keywords: extractKeywords(question),
          difficulty: 2,
          category: classifyText(question + ' ' + optionsText),
          cardType: 'multiple_choice',
          options,
          correctOptionIndex: correctAnswer ? 'ABCDE'.indexOf(correctAnswer.toUpperCase()) : 0,
        })
      }
    }
  }

  // 遍历 7 组问答正则（第8组已单独处理）
  for (let p = 0; p < QA_PATTERNS.length - 1; p++) {
    const pattern = QA_PATTERNS[p]
    const { regex, qGroup, aGroup } = pattern
    regex.lastIndex = 0

    const items: { q: string; a: string; type: TypeDetection }[] = []
    let m: RegExpExecArray | null

    while ((m = regex.exec(rawText)) !== null) {
      const qText = m[qGroup].trim()
      let aText = aGroup > 0 ? (m[aGroup] || '').trim() : ''

      if (qText.length < 3) continue

      // For patterns without explicit answer markers (like 5, 7)
      // the "answer" is the question itself — use it as definition
      if (aGroup < 0 || !aText) {
        aText = qText
      } else if (aText.length < 5) {
        continue
      }

      items.push({
        q: qText,
        a: aText,
        type: detectCardType(qText, aText),
      })
    }

    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const { q, a, type } = items[i]
        const normalizedQ = q.replace(/\s+/g, '').toLowerCase()
        if (seenQuestions.has(normalizedQ)) continue
        seenQuestions.add(normalizedQ)

        const cleanQ = cleanQuestionText(q)

        cards.push({
          tempId: `eq_${cards.length}_${Date.now()}`,
          question: cleanQ.slice(0, 200),
          referenceAnswer: a.slice(0, 2000),
          keyPoints: extractKeyPoints(a),
          keywords: extractKeywords(q + ' ' + a.slice(0, 100)),
          difficulty: guessDifficulty(q, a),
          category: classifyText(q + ' ' + a),
          cardType: type.cardType,
          options: type.options,
          correctOptionIndex: type.correctOptionIndex,
          blankSegments: type.blankSegments,
        })
      }
      break // 第一组命中即返回
    }
  }

  return { cards, extractedCount: cards.length }
}
