/**
 * 策略 5 — 模板匹配智能出题 + 标题上下文
 *
 * 仅当前 4 个确定性格策略都未命中时使用。
 * 用 12 组知识类型模板将陈述性段落转化为自然提问。
 * {subject} 从文档标题层级链中提取。
 *
 * 核心原则：问题 ≠ 答案（零重合）
 */

import type { ParsedCard, DocSection, DentistryCategory, CardType } from '../types'

// ============================================================
// 12 组出题模板
// ============================================================

interface QuestionTemplate {
  /** 人类可读标签 */
  label: string
  /** 触发模式 — 文本中匹配到时使用 */
  patterns: RegExp[]
  /** 生成的问题模板，{subject} 会被替换 */
  questionTemplates: string[]
  /** 对应题型 */
  cardType: CardType
}

const TEMPLATES: QuestionTemplate[] = [
  {
    label: '组成/结构',
    patterns: [/由(.+?)[组构]成/, /包括(.+?)(?:等|组成|构成)/, /含有(.+?)(?:等|成分)/, /包[括含]/],
    questionTemplates: ['请简述{subject}的组成结构。', '{subject}由哪些部分构成？'],
    cardType: 'short_answer',
  },
  {
    label: '功能/作用',
    patterns: [/(?:功能|作用).*?[包是括含]/, /具有(.+?)(?:功能|作用)/, /(?:功能|作用)是/],
    questionTemplates: ['请简述{subject}的功能。', '{subject}有哪些重要作用？'],
    cardType: 'short_answer',
  },
  {
    label: '分类/类型',
    patterns: [/分[为成].+?类/, /可[分划]为/, /类型(?:包括|有)/, /种[类型]/],
    questionTemplates: ['请简述{subject}的分类。', '{subject}可分为哪几类？'],
    cardType: 'short_answer',
  },
  {
    label: '定义/概念',
    patterns: [/(?:是指|指的是|定义为|概念)/, /所谓.*?[是即]/],
    questionTemplates: ['什么是{subject}？', '请给出{subject}的定义。'],
    cardType: 'short_answer',
  },
  {
    label: '机制/原理',
    patterns: [/(?:机制|原理|过程).*?[是包]/, /(?:发生|产生).*?机制/, /(?:作用|工作)原理/],
    questionTemplates: ['请阐述{subject}的机制。', '请说明{subject}的作用原理。'],
    cardType: 'essay',
  },
  {
    label: '临床特征',
    patterns: [/(?:临床|病理).*?特[点征]/, /(?:表现|症状).*?包括/, /(?:体征|征象)/],
    questionTemplates: ['请描述{subject}的临床特征。', '{subject}有哪些临床表现？'],
    cardType: 'short_answer',
  },
  {
    label: '治疗方法',
    patterns: [/(?:治疗|处理).*?方[法案]/, /(?:治疗|处理)原[则]/, /(?:方法|手段)包括/],
    questionTemplates: ['请简述{subject}的治疗方法。', '{subject}的处理原则是什么？'],
    cardType: 'short_answer',
  },
  {
    label: '适应症',
    patterns: [/适应[证症]/, /禁忌[证症]/, /(?:适用|用于)/],
    questionTemplates: ['请列举{subject}的适应症。', '哪些情况适用{subject}？'],
    cardType: 'short_answer',
  },
  {
    label: '区别/比较',
    patterns: [/区[别分]/, /异同/, /不同于/, /(?:相比|比较)/],
    questionTemplates: ['请比较{subject}的区别。', '请说明{subject}的异同点。'],
    cardType: 'essay',
  },
  {
    label: '特点/特征',
    patterns: [/特[点征].*?[是有包]/, /(?:性质|属性|特征)/],
    questionTemplates: ['请简述{subject}的特点。', '{subject}有哪些重要特征？'],
    cardType: 'short_answer',
  },
  {
    label: '步骤/流程',
    patterns: [/步[骤]/, /操作.*?流程/, /首先.*?[然后其后]/, /流程/],
    questionTemplates: ['请简述{subject}的操作步骤。', '请描述{subject}的工作流程。'],
    cardType: 'short_answer',
  },
  {
    label: '病因',
    patterns: [/(?:病因|原因|因素).*?包括/, /(?:引起|导致|造成)/],
    questionTemplates: ['请简述{subject}的病因。', '哪些因素可导致{subject}？'],
    cardType: 'short_answer',
  },
]

// ============================================================
// Subject 提取（从标题层级链）
// ============================================================

/**
 * 从文档结构中提取当前 section 的上下文链
 * 如 "牙体组织 > 牙釉质 > 组织结构"
 */
export function extractSubjectChain(
  sections: DocSection[],
  currentIndex: number
): string {
  const parts: string[] = []

  // 从父级标题收集
  for (let i = 0; i <= currentIndex; i++) {
    if (sections[i]?.heading) {
      const text = sections[i].heading!.text
      // 去除章节编号前缀
      const clean = text.replace(/^第[一二三四五六七八九十\d]+[章节]/, '').trim()
      if (clean.length > 1) parts.push(clean)
    }
  }

  return parts.join(' > ')
}

// ============================================================
// 段落分块
// ============================================================

/**
 * 将章节内容拆分为独立知识点块
 * 策略：按段落拆分，合并过短段落
 */
export function chunkSectionNodes(section: DocSection): string[] {
  const chunks: string[] = []
  let current = ''

  for (const node of section.nodes) {
    const text = node.text.trim()
    if (!text) continue

    // 列表项各自独立
    if (node.type === 'list' && node.listItems) {
      if (current.length > 30) {
        chunks.push(current.trim())
        current = ''
      }
      for (const item of node.listItems) {
        if (item.length > 10) chunks.push(item)
      }
      continue
    }

    // 短段落合并
    if (current.length < 80 && text.length < 80) {
      current += (current ? '\n' : '') + text
    } else {
      if (current.length > 30) chunks.push(current.trim())
      current = text
    }
  }

  if (current.length > 30) chunks.push(current.trim())

  return chunks.filter(c => c.length > 25)
}

// ============================================================
// 模板匹配与问题生成
// ============================================================

/**
 * 对知识段落生成最佳匹配的问题
 * 返回 { question, cardType }
 */
function generateQuestion(
  knowledgeText: string,
  subject: string
): { question: string; cardType: CardType } {
  // 对每个模板组打分
  let bestMatch: QuestionTemplate | null = null
  let bestScore = 0

  for (const tmpl of TEMPLATES) {
    let score = 0
    for (const pattern of tmpl.patterns) {
      const matches = knowledgeText.match(pattern)
      if (matches) score += matches.length
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = tmpl
    }
  }

  // 有匹配 → 使用模板
  if (bestMatch && bestScore > 0) {
    const qTemplate = bestMatch.questionTemplates[0]
    const question = qTemplate.replace('{subject}', subject)
    return { question, cardType: bestMatch.cardType }
  }

  // 无匹配 → 看文本长度决定
  if (knowledgeText.length > 400) {
    return {
      question: `请简述${subject ? `关于${subject}的` : ''}下列知识点。`,
      cardType: 'essay',
    }
  }

  return {
    question: `什么是${subject || '下列概念'}？`,
    cardType: 'short_answer',
  }
}

// ============================================================
// 辅助函数
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

function extractKeyPoints(text: string): string[] {
  return text
    .split(/[；;。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 80)
    .slice(0, 8)
}

function guessDifficulty(text: string): number {
  const len = text.length
  if (len < 100) return 1
  if (len < 300) return 2
  if (len < 600) return 3
  if (len < 1000) return 4
  return 5
}

// ============================================================
// 主入口：标题分块 + 模板出题
// ============================================================

export interface HeadingChunkResult {
  cards: ParsedCard[]
  extractedCount: number
}

/**
 * 从文档结构的每个 section 中提取知识块，用模板生成问题
 */
export function headingChunkExtract(sections: DocSection[]): HeadingChunkResult {
  const cards: ParsedCard[] = []
  const seenAnswers = new Set<string>()

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const subject = extractSubjectChain(sections, i)
    const chunks = chunkSectionNodes(section)

    for (const chunk of chunks) {
      const normalized = chunk.replace(/\s+/g, '').slice(0, 80).toLowerCase()
      if (seenAnswers.has(normalized)) continue
      seenAnswers.add(normalized)

      const { question, cardType } = generateQuestion(chunk, subject)
      const category = classifyContent(chunk)
      const keywords = extractKeywords(chunk)
      const keyPoints = extractKeyPoints(chunk)
      const difficulty = guessDifficulty(chunk)

      cards.push({
        tempId: `hc_${cards.length}_${Date.now()}`,
        question,
        referenceAnswer: chunk.slice(0, 2000),
        keyPoints,
        keywords,
        difficulty,
        category,
        cardType,
      })
    }
  }

  return { cards, extractedCount: cards.length }
}
