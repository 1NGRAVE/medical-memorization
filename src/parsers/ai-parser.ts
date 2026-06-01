/**
 * AI 解析器 —— DeepSeek 智能题型识别，只提取论述题
 */

import type { ParsedCard, ParseSummary } from '../types'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

const PARSE_PROMPT = `你是一位医学教育内容分析专家。请分析以下从 .docx 文件中提取的牙科医学文本。

【原始文本】
{rawText}

【任务】
1. 区分文本中的"题目"和"非题目内容"：
   - 非题目内容：章节标题、导言、说明文字、学习目标等 → 归入 description
   - 题目内容：有明确问答形式的段落

2. 对每个题目判断题型：
   - "论述题"：简述、试述、说明、分析、比较、列举、概括类的主观问答题
   - "选择题"：有A/B/C/D选项的
   - "填空题"：有空格的
   - "判断题"：判断对错的
   - "名词解释"：解释名词的

3. 只输出"论述题"类型的题目。其他题型的题目一概不要。

4. 每个论述题生成完整信息：
   - question: 问题文本
   - reference_answer: 完整答案
   - key_points: 4-8个关键知识点
   - keywords: 5-8个核心关键词
   - difficulty: 1-5
   - category: 从下列选一个最匹配的

【分类选项】dental_anatomy(牙体解剖), oral_pathology(口腔病理), periodontics(牙周病学), endodontics(牙体牙髓), oral_surgery(口腔外科), restorative(修复学), orthodontics(正畸学), preventive(预防口腔医学), anesthesia(口腔麻醉), radiology(口腔影像)

【输出格式】严格返回以下JSON：
{
  "description": "从文档中提取的非题目文本，如章节说明等（不超过500字）",
  "total_found": 总题目数,
  "essay_questions": [
    {
      "question": "...",
      "reference_answer": "...",
      "key_points": ["...", "..."],
      "keywords": ["...", "..."],
      "difficulty": 3,
      "category": "restorative"
    }
  ],
  "filtered_types": ["选择题", "判断题"]
}`

export async function aiParseQAPairs(
  rawText: string,
  apiKey: string
): Promise<ParseSummary> {
  const prompt = PARSE_PROMPT.replace('{rawText}', rawText.slice(0, 10000))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

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
          { role: 'system', content: '你是一个精准的医学文档解析器。你只返回JSON，不返回其他内容。你只提取论述题类型的问答题。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
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
        keyPoints: Array.isArray(item.key_points || item.keyPoints) ? ((item.key_points || item.keyPoints) as string[]).slice(0, 10) : [],
        keywords: Array.isArray(item.keywords) ? (item.keywords as string[]).slice(0, 10) : [],
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
