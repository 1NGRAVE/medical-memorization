/**
 * AI 解析器 —— DeepSeek 知识点→问题智能转换
 *
 * 核心逻辑：文档中的陈述性知识点不是现成的题目，
 * AI 将每个知识点段落转化为论述题，原文作为标准答案。
 */

import type { ParsedCard, ParseSummary } from '../types'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

const PARSE_PROMPT = `你是一位医学教育专家。请将以下医学教材文本中的**陈述性知识点**转化为论述题。

【原始文本】
{rawText}

【核心任务】
这些文本是**教材原文**，不是现成的题目。你需要：
1. 识别每个独立的知识点（一个概念、一种机制、一套方法、一组特征、一个定义等）
2. 将每个知识点的陈述部分改写为论述题，例如：
   - "XX由A和B组成"  → "请简述XX的组织结构。"
   - "XX是人体最硬的组织" → "请说明XX的硬度特点。"
   - "XX的作用机制包括…" → "请简述XX的作用机制。"
   - "XX适用于以下情况…" → "请列举XX的适应症。"
   - "XX与YY的区别是…" → "请比较XX与YY的区别。"
   - "XX可分为…几种类型" → "请简述XX的分类。"
3. 原文不动，作为标准答案（reference_answer）
4. 从原文中提取关键知识点和关键词

【好的问题应该是】
- 自然的中文提问方式，符合医学生考试风格
- 引导性提问，而非生硬的填空
- 例如："请简述牙釉质的组织结构及其成分特点。" 而非 "牙釉质的组织是什么？"

【重要规则】
- 每个独立知识点生成一道题，不要将多个无关知识点合并
- 非知识性文本（章标题、导言、目录、作者信息等）放入 description
- 文本太短（<20字）或没有实质内容的段落跳过
- 问题不超过 120 字，答案不超过 2000 字

【分类选项】dental_anatomy(牙体解剖), oral_pathology(口腔病理), periodontics(牙周病学), endodontics(牙体牙髓), oral_surgery(口腔外科), restorative(修复学), orthodontics(正畸学), preventive(预防口腔医学), anesthesia(口腔麻醉), radiology(口腔影像)

【输出格式】严格JSON，不要其他内容：
{
  "description": "文档中非知识性文本的汇总说明（如无则留空）",
  "total_found": 知识点总数,
  "essay_questions": [
    {
      "question": "转化后的问题",
      "reference_answer": "原文知识段落",
      "key_points": ["关键点1", "关键点2", "关键点3"],
      "keywords": ["术语1", "术语2", "术语3"],
      "difficulty": 3,
      "category": "oral_pathology"
    }
  ],
  "filtered_types": []
}`

export async function aiParseQAPairs(
  rawText: string,
  apiKey: string
): Promise<ParseSummary> {
  const prompt = PARSE_PROMPT.replace('{rawText}', rawText.slice(0, 15000))

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
          { role: 'system', content: '你是一个医学教育专家，擅长将教材知识点转化为考试题目。你只返回JSON，不返回其他内容。' },
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

    const questions = parsed.essay_questions || parsed.cards || []
    const cards: ParsedCard[] = (Array.isArray(questions) ? questions : []).map(
      (item: Record<string, unknown>, i: number) => ({
        tempId: `ai_${i}_${Date.now()}`,
        question: String(item.question || '').slice(0, 200),
        referenceAnswer: String(item.reference_answer || item.referenceAnswer || '').slice(0, 2000),
        keyPoints: Array.isArray(item.key_points || item.keyPoints)
          ? ((item.key_points || item.keyPoints) as string[]).slice(0, 10)
          : [],
        keywords: Array.isArray(item.keywords)
          ? (item.keywords as string[]).slice(0, 10)
          : [],
        difficulty: Math.min(5, Math.max(1, Number(item.difficulty) || 3)),
        category: String(item.category || 'dental_anatomy') as ParsedCard['category'],
      })
    )

    return {
      cards,
      description: String(parsed.description || '').slice(0, 500),
      totalFound: Number(parsed.total_found) || cards.length,
      essayCount: cards.length,
      filteredTypes: Array.isArray(parsed.filtered_types) ? parsed.filtered_types : [],
    }
  } finally {
    clearTimeout(timeout)
  }
}
