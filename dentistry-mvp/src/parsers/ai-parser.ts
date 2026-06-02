/**
 * AI 解析器 — DeepSeek 知识点→问题智能转换
 *
 * 实现 ParseProvider 接口，接收文档结构摘要辅助理解。
 * 更新 prompt 强制问题/答案分离（零重合）。
 * 大文档由 chunker.ts 负责分段，此模块处理单个 chunk。
 */

import type { ParsedCard, ParseSummary, CardType } from '../types'

// ============================================================
// ParseProvider 接口
// ============================================================

export interface ParseProvider {
  id: string
  name: string
  requiresApiKey: boolean
  parse(params: { rawText: string; structureSummary?: string }): Promise<ParseSummary>
  testConnection(apiKey: string): Promise<boolean>
}

// ============================================================
// DeepSeek ParseProvider 工厂
// ============================================================

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

const MULTI_TYPE_PARSE_PROMPT = `你是一位医学教育专家。请将以下医学教材文本中的陈述性知识点转化为考试题目。

【文档结构】
{structureSummary}

【原始文本】
{rawText}

【核心任务】
1. 识别每个独立的知识点（一个概念、一种机制、一套方法、一组特征等）
2. 将每个知识点的陈述部分改写为自然提问
3. 原文作为标准答案（reference_answer）

【关键规则 — 问题与答案必须分离】
- 问题必须是独立的提问句，不能包含答案中的陈述内容
- 例如"牙釉质是覆盖于牙冠表面的最外层硬组织" 应生成问题"请简述牙釉质的组织结构及特点。"而非"请简述：牙釉质是覆盖于..."
- 不要在问题中重复答案的关键内容
- 问题不超过120字，答案不超过2000字

【题型判断规则】
- 简单的事实知识（定义、组成、分类、功能等）→ card_type = "short_answer"
- 复杂机制、原理、异同比较 → card_type = "essay"
- 可枚举的明确选项（如分类有3-5种）→ card_type = "multiple_choice"，需生成 options 数组和 correct_option_index
- 关键术语可挖空 → card_type = "fill_blank"
- 可构造对/错陈述 → card_type = "true_false"

【分类】dental_anatomy(牙体解剖), oral_pathology(口腔病理), periodontics(牙周病学), endodontics(牙体牙髓), oral_surgery(口腔外科), restorative(修复学), orthodontics(正畸学), preventive(预防口腔医学), anesthesia(口腔麻醉), radiology(口腔影像)

【输出格式】严格JSON，不要其他内容：
{
  "description": "文档非知识内容的汇总（如无则留空）",
  "total_found": 知识点总数,
  "questions": [
    {
      "question": "转化后的问题",
      "reference_answer": "原文知识段落",
      "card_type": "short_answer",
      "key_points": ["关键点1", "关键点2", "关键点3"],
      "keywords": ["术语1", "术语2", "术语3"],
      "difficulty": 3,
      "category": "oral_pathology",
      "options": null,
      "correct_option_index": null
    }
  ]
}`

export function createDeepSeekParseProvider(apiKey: string): ParseProvider {
  return {
    id: 'deepseek-parse',
    name: 'DeepSeek 智能解析',
    requiresApiKey: true,

    async parse({ rawText, structureSummary }): Promise<ParseSummary> {
      const prompt = MULTI_TYPE_PARSE_PROMPT
        .replace('{structureSummary}', structureSummary || '(文档无结构信息)')
        .replace('{rawText}', rawText.slice(0, 15000))

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      try {
        const response = await fetch(DEEPSEEK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: '你是一个医学教育专家，擅长将教材知识点转化为考试题目。你只返回JSON，不返回其他内容。',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) throw new Error(`DeepSeek API 错误 (${response.status})`)

        const data = await response.json()
        const raw = data.choices?.[0]?.message?.content || '{}'

        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI 返回格式异常')
        const parsed = JSON.parse(jsonMatch[0])

        const questions = parsed.questions || parsed.essay_questions || parsed.cards || []
        const cards: ParsedCard[] = (Array.isArray(questions) ? questions : []).map(
          (item: Record<string, unknown>, i: number) => {
            const cardType = (item.card_type || item.cardType || 'short_answer') as CardType
            return {
              tempId: `ai_${i}_${Date.now()}`,
              question: String(item.question || '').slice(0, 200),
              referenceAnswer: String(
                item.reference_answer || item.referenceAnswer || ''
              ).slice(0, 2000),
              keyPoints: Array.isArray(item.key_points || item.keyPoints)
                ? ((item.key_points || item.keyPoints) as string[]).slice(0, 10)
                : [],
              keywords: Array.isArray(item.keywords)
                ? (item.keywords as string[]).slice(0, 10)
                : [],
              difficulty: Math.min(5, Math.max(1, Number(item.difficulty) || 3)),
              category: String(item.category || 'dental_anatomy') as ParsedCard['category'],
              cardType,
              options: Array.isArray(item.options) ? item.options as string[] : undefined,
              correctOptionIndex: typeof item.correct_option_index === 'number'
                ? item.correct_option_index
                : undefined,
            }
          }
        )

        // 题型统计
        const typeBreakdown: Partial<Record<CardType, number>> = {}
        for (const c of cards) {
          const ct = c.cardType || 'essay'
          typeBreakdown[ct] = (typeBreakdown[ct] || 0) + 1
        }

        return {
          cards,
          description: String(parsed.description || '').slice(0, 500),
          totalFound: Number(parsed.total_found) || cards.length,
          essayCount: typeBreakdown['essay'] || 0,
          filteredTypes: [],
          strategy: 'heading_chunk',
          typeBreakdown,
          duplicatesSkipped: 0,
        }
      } finally {
        clearTimeout(timeout)
      }
    },

    async testConnection(apiKey: string): Promise<boolean> {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(DEEPSEEK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 10,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        return response.ok
      } catch {
        return false
      }
    },
  }
}

// ============================================================
// 保持向后兼容的旧函数（deprecated，建议用 ParseProvider）
// ============================================================

/** @deprecated 使用 createDeepSeekParseProvider + provider.parse() 替代 */
export async function aiParseQAPairs(
  rawText: string,
  apiKey: string
): Promise<ParseSummary> {
  const provider = createDeepSeekParseProvider(apiKey)
  return provider.parse({ rawText })
}
