/**
 * 策略 1 — 【标签】术语：定义 提取器
 *
 * 覆盖 4/10 医学文档（免疫2026、分生2025、遗传、核酸）
 *
 * 输入：
 *   【器官】免疫应答(immune response)：是机体识别"自己"与"非己"物质后...
 *   【分子】黏附分子(CAM)：介导细胞与细胞间或细胞与基质间相互接触...
 *
 * 输出：术语 → question，定义 → answer，天然分离零重合
 */

import type { ParsedCard, DentistryCategory, CardType } from '../../types'

// ============================================================
// 正则匹配
// ============================================================

/**
 * 匹配 【标签】术语(English) ： 定义内容
 * 使用 sticky 匹配，每次从上一个【或文本开头开始
 */
const TERM_DEF_RE = /【(.+?)】\s*(.+?)\s*[：:]\s*(.+?)(?=\n\s*【|$)/gs

/** 从术语中提取英文名（用于 keyword） */
const ENGLISH_IN_PAREN = /\(([a-zA-Z][^)]+)\)/

/** 从术语中提取中文名（括号前部分） */
const CHINESE_TERM = /^([^(（]+)/

// ============================================================
// 卡类型推断
// ============================================================

function inferCardType(term: string, definition: string): CardType {
  const combined = `${term} ${definition}`

  // 选择题信号
  const mcOptions = definition.match(/[A-E][\.、)]\s*.{2,30}?(?=\s*[A-E][\.、)]|$)/g)
  if (mcOptions && mcOptions.length >= 3) return 'multiple_choice'

  // 填空题信号
  if (/___|____|[（(]\s*[）)]/.test(definition)) return 'fill_blank'

  // 判断题信号
  if (/[对错]错|正确.*错误|判断/.test(combined)) return 'true_false'

  // 论述题 vs 简答题（按定义长度区分）
  if (definition.length > 400 || /机制|原理|阐述|论述|比较|异同/.test(term)) return 'essay'

  return 'short_answer'
}

// ============================================================
// 医学分类推断
// ============================================================

function classifyByCategory(categoryTag: string, term: string, definition: string): DentistryCategory {
  const text = `${categoryTag} ${term} ${definition}`.toLowerCase()

  // 用 categoryTag 直接匹配
  if (/牙|齿|dental|tooth|enamel|dentin|pulp|cement/i.test(categoryTag)) return 'dental_anatomy'
  if (/龋|caries|病理/i.test(categoryTag) || /龋|caries|白斑|leukoplakia/i.test(text)) return 'oral_pathology'
  if (/牙周|perio|gingiv/i.test(categoryTag)) return 'periodontics'
  if (/牙髓|根管|endo|pulp/.test(categoryTag)) return 'endodontics'
  if (/口腔|外科|surgery|拔牙|种植|麻醉/.test(categoryTag)) return 'oral_surgery'
  if (/修复|restor|crown|bridge|义齿/.test(categoryTag)) return 'restorative'
  if (/正畸|矫正|ortho/.test(categoryTag)) return 'orthodontics'
  if (/预防|氟|窝沟|sealant|fluoride/.test(categoryTag)) return 'preventive'
  if (/麻醉|anesth|lidocaine/.test(categoryTag)) return 'anesthesia'
  if (/影像|放射|radio/.test(categoryTag)) return 'radiology'

  // 用术语+定义全文匹配
  if (/龋|caries/i.test(text)) return 'oral_pathology'
  if (/牙周|牙[龈银]|gingivitis|periodontitis/i.test(text)) return 'periodontics'
  if (/根管|牙髓|pulp|endodont|rct/i.test(text)) return 'endodontics'
  if (/拔牙|智齿|种植|implant|麻醉|麻药/i.test(text)) return 'oral_surgery'
  if (/冠|桥|修复|restor|crown|bridge|义齿/i.test(text)) return 'restorative'
  if (/正畸|矫正|矫治|orthodont|错[颌𬌗]/i.test(text)) return 'orthodontics'
  if (/氟|窝沟|预防|sealant|fluoride/i.test(text)) return 'preventive'
  if (/麻|阻滞|麻醉|anesth|lidocaine/i.test(text)) return 'anesthesia'
  if (/X线|片|影像|radiograph/i.test(text)) return 'radiology'

  return 'dental_anatomy'
}

// ============================================================
// 关键词和关键点提取
// ============================================================

function extractEnglishTerms(text: string): string[] {
  const terms: string[] = []
  const matches = text.matchAll(/[a-zA-Z][a-zA-Z\s-]{2,}(?:\s*\([^)]*\))?/g)
  for (const m of matches) {
    const t = m[0].trim()
    if (t.length > 2 && !/^(the|and|for|from|are|has|can|its|was|with|that|this|have|been)$/i.test(t)) {
      terms.push(t)
    }
  }
  return [...new Set(terms)].slice(0, 5)
}

function extractKeyPoints(definition: string): string[] {
  // 按分号、句号分割，取有实质内容的片段
  return definition
    .split(/[；;。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 80)
    .slice(0, 8)
}

// ============================================================
// 问题生成（术语 → 自然提问）
// ============================================================

function generateQuestion(term: string, _definition: string, cardType: CardType): string {
  // 提取纯中文术语（去括号英文）
  const cnMatch = term.match(CHINESE_TERM)
  const chineseTerm = cnMatch ? cnMatch[1].trim() : term.trim()
  const enMatch = term.match(ENGLISH_IN_PAREN)
  const englishTerm = enMatch ? enMatch[1].trim() : ''

  // 检查术语本身是否已是问句
  if (/[？?]$/.test(term)) return term.trim()
  if (/^(简述|试述|论述|阐述|请|列举|比较|说明|描述|概括|总结)/.test(term)) return term.trim()

  const displayTerm = englishTerm ? `${chineseTerm}（${englishTerm}）` : chineseTerm

  switch (cardType) {
    case 'essay':
      return `请阐述${displayTerm}。`
    case 'short_answer':
      return `什么是${displayTerm}？`
    case 'multiple_choice':
      return `关于${displayTerm}，以下哪项是正确的？`
    case 'true_false':
      return `判断：${displayTerm}`
    default:
      return `请解释${displayTerm}。`
  }
}

// ============================================================
// 难度推断
// ============================================================

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

export interface TermDefResult {
  cards: ParsedCard[]
  extractedCount: number
}

/**
 * 从文本中提取所有 【标签】术语：定义 对
 * 返回 ParsedCard 列表，term → question, definition → answer
 */
export function termDefExtract(rawText: string): TermDefResult {
  const cards: ParsedCard[] = []
  const seenTerms = new Set<string>()
  let match: RegExpExecArray | null

  // 重置正则状态
  TERM_DEF_RE.lastIndex = 0

  while ((match = TERM_DEF_RE.exec(rawText)) !== null) {
    const categoryTag = match[1].trim()
    let term = match[2].trim()
    let definition = match[3].trim()

    // 跳过过短内容
    if (term.length < 2 || definition.length < 5) continue

    // ---- 质量验证：过滤非术语内容 ----
    // 术语不应包含换行（多行文本说明不是术语）
    if (term.includes('\n')) continue
    // 术语不应包含句号（完整句子不是术语）
    if (/[。！？]/.test(term)) continue
    // 术语不应以"是"开头
    if (/^是/.test(term.trim())) continue
    // 术语不应超过 60 字
    if (term.length > 60) continue
    // 术语不应包含分隔线或特殊标记
    if (/^—+$/.test(term) || /^=+$/.test(term)) continue
    // 定义应该以解释性文字开头，而不是另一个【
    if (/^\s*【/.test(definition)) continue
    // 术语不应完全是标点或数字
    if (!/[一-鿿]/.test(term)) continue

    // 去重（同一术语只取第一次）
    const normalizedTerm = term.replace(/\s+/g, '').toLowerCase()
    if (seenTerms.has(normalizedTerm)) continue
    seenTerms.add(normalizedTerm)

    // 如果 term 末尾有冒号但没被正则捕获，修正
    term = term.replace(/[：:]\s*$/, '')

    // 推断属性
    const cardType = inferCardType(term, definition)
    const question = generateQuestion(term, definition, cardType)
    const category = classifyByCategory(categoryTag, term, definition)
    const keywords = [
      term.replace(/\([^)]*\)/g, '').trim(),
      ...extractEnglishTerms(term + ' ' + definition.slice(0, 100)),
    ].slice(0, 8)
    const keyPoints = extractKeyPoints(definition)
    const difficulty = guessDifficulty(term, definition)

    cards.push({
      tempId: `td_${cards.length}_${Date.now()}`,
      question,
      referenceAnswer: definition,
      keyPoints,
      keywords,
      difficulty,
      category,
      cardType,
    })
  }

  return { cards, extractedCount: cards.length }
}
