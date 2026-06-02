/**
 * .medq 文件导入导出工具函数
 */
import type { Deck, DentalCard, DentistryCategory, CardType } from '../types'
import type { MedqFile, MedqCard, MedqParseResult } from '../types/medq'

const DENTISTRY_CATEGORIES = new Set<string>([
  'dental_anatomy', 'oral_pathology', 'periodontics', 'endodontics',
  'oral_surgery', 'restorative', 'orthodontics', 'preventive', 'anesthesia', 'radiology',
])

const CARD_TYPES = new Set<string>([
  'essay', 'short_answer', 'multiple_choice', 'fill_blank', 'true_false',
])

// ─── 导出 ───────────────────────────────────────────

/** 从 Deck + DentalCard[] 构建 .medq 文件对象 */
export function buildMedqFile(
  deck: Pick<Deck, 'name' | 'description'>,
  cards: DentalCard[],
): MedqFile {
  return {
    version: 1,
    type: 'medical-question-deck',
    exportedAt: new Date().toISOString(),
    deck: {
      name: deck.name,
      description: deck.description,
    },
    cards: cards.map(c => ({
      question: c.question,
      referenceAnswer: c.referenceAnswer,
      keyPoints: c.keyPoints ?? [],
      keywords: c.keywords ?? [],
      difficulty: c.difficulty ?? 3,
      category: c.category,
      cardType: c.cardType ?? 'short_answer',
      options: c.options,
      correctOptionIndex: c.correctOptionIndex,
      blankSegments: c.blankSegments,
    })),
  }
}

/** 触发浏览器下载 .medq 文件 */
export function downloadMedqFile(data: MedqFile, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 200)
}

// ─── 导入 ───────────────────────────────────────────

/** 读取并解析用户选择的 .medq / .json 文件 */
export function parseMedqFile(file: File): Promise<MedqParseResult> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string)
        resolve(validateMedqFile(raw))
      } catch {
        resolve({ success: false, error: '文件格式错误，无法解析 JSON。请确认选择的是 .medq 题库文件。', warnings: [] })
      }
    }
    reader.onerror = () => {
      resolve({ success: false, error: '文件读取失败，请重试。', warnings: [] })
    }
    reader.readAsText(file)
  })
}

/** 校验原始 JSON 是否符合 .medq 格式 */
export function validateMedqFile(raw: unknown): MedqParseResult {
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object') {
    return { success: false, error: '文件内容为空或格式不正确。', warnings }
  }
  const obj = raw as Record<string, unknown>

  // 检查 type 字段
  if (obj.type !== 'medical-question-deck') {
    return {
      success: false,
      error: `文件类型不匹配 (type=${String(obj.type ?? '无')})，仅支持 medical-question-deck。`,
      warnings,
    }
  }

  // 版本检查（软失败）
  if (obj.version !== 1) {
    warnings.push(`文件版本 (${String(obj.version)}) 不匹配，将尝试兼容导入。`)
  }

  // 检查 deck
  const deck = obj.deck as Record<string, unknown> | undefined
  if (!deck || typeof deck.name !== 'string' || !deck.name.trim()) {
    return { success: false, error: '题库名称 (deck.name) 缺失。', warnings }
  }

  // 检查 cards
  if (!Array.isArray(obj.cards)) {
    return { success: false, error: 'cards 字段缺失或不是数组。', warnings }
  }

  if (obj.cards.length === 0) {
    warnings.push('题库中没有卡片。')
  }

  // 逐卡校验，过滤无效卡片
  const validCards: MedqCard[] = []
  let filteredCount = 0

  for (let i = 0; i < obj.cards.length; i++) {
    const c = obj.cards[i] as Record<string, unknown> | null
    if (!c || typeof c !== 'object') {
      filteredCount++
      continue
    }

    const question = typeof c.question === 'string' ? c.question.trim() : ''
    const referenceAnswer = typeof c.referenceAnswer === 'string' ? c.referenceAnswer.trim() : ''

    if (!question || !referenceAnswer) {
      filteredCount++
      continue
    }

    // 校验并修正 category
    let category: DentistryCategory = 'dental_anatomy'
    if (typeof c.category === 'string' && DENTISTRY_CATEGORIES.has(c.category)) {
      category = c.category as DentistryCategory
    } else if (typeof c.category === 'string' && c.category) {
      warnings.push(`卡片 #${i + 1} 分类 "${c.category}" 无效，已重置为 dental_anatomy。`)
    }

    // 校验并修正 difficulty
    let difficulty = 3
    if (typeof c.difficulty === 'number') {
      difficulty = Math.max(1, Math.min(5, Math.round(c.difficulty)))
    }

    // 校验并修正 cardType
    let cardType: CardType | undefined
    if (typeof c.cardType === 'string' && CARD_TYPES.has(c.cardType)) {
      cardType = c.cardType as CardType
    }

    const card: MedqCard = {
      question,
      referenceAnswer,
      keyPoints: Array.isArray(c.keyPoints)
        ? c.keyPoints.filter((k: unknown): k is string => typeof k === 'string')
        : [],
      keywords: Array.isArray(c.keywords)
        ? c.keywords.filter((k: unknown): k is string => typeof k === 'string')
        : [],
      difficulty,
      category,
      cardType,
      options: Array.isArray(c.options)
        ? c.options.filter((o: unknown): o is string => typeof o === 'string')
        : undefined,
      correctOptionIndex: typeof c.correctOptionIndex === 'number' ? c.correctOptionIndex : undefined,
      blankSegments: Array.isArray(c.blankSegments)
        ? c.blankSegments.filter((s: unknown): s is string => typeof s === 'string')
        : undefined,
    }
    validCards.push(card)
  }

  if (filteredCount > 0) {
    warnings.push(`${filteredCount} 张卡片因缺少问题或答案被跳过。`)
  }

  if (validCards.length === 0 && obj.cards.length > 0) {
    return { success: false, error: '所有卡片均无效（缺少 question 或 referenceAnswer）。', warnings }
  }

  const data: MedqFile = {
    version: 1,
    type: 'medical-question-deck',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    deck: {
      name: deck.name.trim(),
      description: typeof deck.description === 'string' ? deck.description : '',
    },
    cards: validCards,
  }

  return { success: true, data, warnings }
}
