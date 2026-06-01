/**
 * 策略 2 — 术语/定义交替行提取器
 *
 * 覆盖 3/10 医学文档（生理v1.5、口腔生物学、神经生物复习）
 *
 * 输入：
 *   突触
 *   是神经元之间紧密接触并进行信息传递的部位。根据传递方式可分为...
 *
 *   反射
 *   机体在受到内外环境刺激时，通过中枢神经系统发生的一种规律应答活动...
 *
 * 启发式：短行（2-30字，无句号）→ 术语
 *         后续长行 → 定义
 *         空行 → 分隔符
 */

import type { ParsedCard, DentistryCategory, CardType } from '../../types'

// ============================================================
// 文本预处理
// ============================================================

/** 判断文本行是否看起来像术语 */
function isTermLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 2 || trimmed.length > 40) return false
  // 术语行特征：无句号、无分号、不以"是"开头
  if (/[。；，；]/.test(trimmed)) return false
  if (/^是/.test(trimmed)) return false
  // 不是纯数字或页码引用
  if (/^[pP]\d/.test(trimmed)) return false
  if (/^\d+$/.test(trimmed)) return false
  // 不是章节标题
  if (/^第[一二三四五六七八九十\d]+[章节]/.test(trimmed)) return false
  if (/^[一二三四五六七八九十]+[、．]/.test(trimmed)) return false
  return true
}

/** 判断是否像定义行（长行或有"是"开头） */
function isDefinitionStart(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 5) return false
  // 定义通常较长或包含句号
  if (trimmed.length > 40) return true
  if (/^是/.test(trimmed)) return true
  if (/[。！？]/.test(trimmed)) return true
  return false
}

/** 判断行是否看起来像子标题或 section marker */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  if (/^[（(][一二三四五六七八九十]+[）)]/.test(trimmed)) return true
  if (/^[一二三四五六七八九十]+[、．]/.test(trimmed)) return true
  if (/^第[一二三四五六七八九十\d]+[章节]/.test(trimmed)) return true
  if (/^[（(]\d+[）)]/.test(trimmed)) return true
  return false
}

// ============================================================
// 分类与题型推断
// ============================================================

function classifyContent(text: string): DentistryCategory {
  const lower = text.toLowerCase()
  if (/龋|蛀牙|caries/.test(lower)) return 'oral_pathology'
  if (/牙周|牙龈|periodont|gingiv/.test(lower)) return 'periodontics'
  if (/根管|牙髓|pulp|endodont|rct/.test(lower)) return 'endodontics'
  if (/拔牙|智齿|种植|implant|麻醉|麻药/.test(lower)) return 'oral_surgery'
  if (/冠|桥|修复|restor|crown|bridge|义齿/.test(lower)) return 'restorative'
  if (/正畸|矫正|矫治|orthodont|错[颌𬌗]/.test(lower)) return 'orthodontics'
  if (/氟|窝沟|预防|sealant|fluoride/.test(lower)) return 'preventive'
  if (/麻[药醉]|阻滞|anesth|lidocaine/.test(lower)) return 'anesthesia'
  if (/X线|片|影像|radiograph/.test(lower)) return 'radiology'
  return 'dental_anatomy'
}

function inferCardType(term: string, definition: string): CardType {
  const combined = term + definition
  if (definition.length > 400 || /机制|原理|阐述|论述|比较|异同/.test(combined)) return 'essay'
  return 'short_answer'
}

function generateQuestion(term: string, _definition: string, cardType: CardType): string {
  // 术语本身可能是问句
  if (/[？?]$/.test(term)) return term
  if (/^(简述|试述|论述|阐述|请|列举|比较|说明|描述)/.test(term)) return term

  if (cardType === 'essay') return `请阐述${term}。`
  return `什么是${term}？`
}

// ============================================================
// 关键词和关键点
// ============================================================

function extractKeywords(text: string): string[] {
  const words = new Set<string>()
  // 英文术语
  const enMatches = text.matchAll(/[a-zA-Z][a-zA-Z\s-]{2,}/g)
  for (const m of enMatches) {
    const w = m[0].trim()
    if (w.length > 2 && !/^(the|and|for|from|are|has|can|its|was|with|that|this|have|been)$/i.test(w)) {
      words.add(w)
    }
  }
  // 中文术语（2-4字医学词）
  const cnMatches = text.matchAll(/[^\s,，。；;、\d]{2,4}(?:症|病|炎|术|药|质|骨|牙|齿|膜|管|体|菌|法|剂|冠|桥|学|脉|经|胞|受|体|酶|子|白|素)/g)
  for (const m of cnMatches) words.add(m[0])

  return [...words].slice(0, 8)
}

function extractKeyPoints(definition: string): string[] {
  return definition
    .split(/[；;。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 80)
    .slice(0, 8)
}

function guessDifficulty(term: string, definition: string): number {
  const len = (term + definition).length
  if (len < 80) return 1
  if (len < 200) return 2
  if (len < 500) return 3
  if (len < 800) return 4
  return 5
}

// ============================================================
// 主提取函数
// ============================================================

export interface OutlineResult {
  cards: ParsedCard[]
  extractedCount: number
}

/**
 * 从文本中提取 术语→定义 对
 * 按空行分块，每块的第一行是术语，后续行是定义
 */
export function outlineExtract(rawText: string): OutlineResult {
  const cards: ParsedCard[] = []
  const seenTerms = new Set<string>()

  // 方法 A：按空行分隔成块
  const blocks = rawText.split(/\n\s*\n+/)

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length < 2) continue

    // 跳过 section header 开头的块
    if (isSectionHeader(lines[0])) {
      // 如果只有 header，跳过；如果 header 后有术语，尝试提取
      if (lines.length >= 3 && isTermLine(lines[1]) && isDefinitionStart(lines.slice(2).join('\n'))) {
        // shift off the header
        lines.shift()
      } else {
        continue
      }
    }

    while (lines.length >= 2) {
      const term = lines[0]
      // 收集定义行（直到遇到疑似新术语行或子标题行）
      const defLines: string[] = []
      let i = 1
      for (; i < lines.length; i++) {
        if (isTermLine(lines[i]) && !isDefinitionStart(lines[i])) break
        if (isSectionHeader(lines[i])) break
        defLines.push(lines[i])
      }
      const definition = defLines.join('\n').trim()

      // 验证：术语和定义都有效
      if (isTermLine(term) && definition.length > 8) {
        const normalizedTerm = term.replace(/\s+/g, '').toLowerCase()
        if (!seenTerms.has(normalizedTerm)) {
          seenTerms.add(normalizedTerm)

          const cardType = inferCardType(term, definition)
          const question = generateQuestion(term, definition, cardType)
          const category = classifyContent(term + ' ' + definition)
          const keywords = [term, ...extractKeywords(definition)].slice(0, 8)
          const keyPoints = extractKeyPoints(definition)
          const difficulty = guessDifficulty(term, definition)

          cards.push({
            tempId: `ol_${cards.length}_${Date.now()}`,
            question,
            referenceAnswer: definition,
            keyPoints,
            keywords,
            difficulty,
            category,
            cardType,
          })
        }
      }

      // 移动到下一个术语行
      lines.splice(0, i)
      // 如果第一行不是术语，跳过它
      while (lines.length > 0 && !isTermLine(lines[0]) && !isSectionHeader(lines[0])) {
        lines.shift()
      }
      if (isSectionHeader(lines[0]) || !isTermLine(lines[0])) {
        if (lines.length > 0) lines.shift() // 跳过 section header
        continue
      }
    }
  }

  // 方法 B：如果空行分块效果不好（<5 张卡片），改用逐行遍历
  if (cards.length < 5) {
    const lineCards = extractLineByLine(rawText, seenTerms)
    if (lineCards.length > cards.length) {
      return { cards: lineCards, extractedCount: lineCards.length }
    }
  }

  return { cards, extractedCount: cards.length }
}

/** 逐行遍历提取术语/定义对（不依赖空行分隔） */
function extractLineByLine(rawText: string, existingSeen: Set<string>): ParsedCard[] {
  const lines = rawText.split('\n').map(l => l.trim())
  const cards: ParsedCard[] = []
  const seen = new Set(existingSeen)
  let i = 0

  while (i < lines.length) {
    // 跳过空行和 section header
    if (!lines[i] || isSectionHeader(lines[i])) {
      i++
      continue
    }

    // 检查当前行是否是术语行
    if (isTermLine(lines[i])) {
      const term = lines[i]
      const defLines: string[] = []
      i++

      // 收集后续定义行
      while (i < lines.length) {
        const l = lines[i]
        if (!l) { i++; continue }
        // 遇到新术语行或 section header 则停止
        if (isTermLine(l) || isSectionHeader(l)) break
        defLines.push(l)
        i++
      }

      const definition = defLines.join('\n').trim()
      if (definition.length >= 8 && !seen.has(term)) {
        seen.add(term)
        const cardType = inferCardType(term, definition)
        const question = generateQuestion(term, definition, cardType)
        const category = classifyContent(term + ' ' + definition)
        const keywords = [term, ...extractKeywords(definition)].slice(0, 8)
        const keyPoints = extractKeyPoints(definition)
        const difficulty = guessDifficulty(term, definition)

        cards.push({
          tempId: `ol_${cards.length}_${Date.now()}`,
          question,
          referenceAnswer: definition,
          keyPoints,
          keywords,
          difficulty,
          category,
          cardType,
        })
      }
    } else {
      i++
    }
  }

  return cards
}
