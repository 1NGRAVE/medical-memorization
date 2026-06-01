/**
 * AI 解析器 —— 使用 DeepSeek API 智能提取 Q&A 对
 */

import type { ParsedCard } from '../types'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

const PARSE_PROMPT = `你是一位医学教育内容整理专家。请将以下从 .docx 文件中提取的牙科医学文本，解析为结构化的问答题卡片。

【原始文本】
{rawText}

【任务】
1. 识别文本中的所有问答题对。常见格式：问/答、Q/A、编号列表、【问题】/【答案】
2. 对于每一对问答：
   - question: 保留原始问题文本
   - reference_answer: 保留完整答案文本
   - key_points: 提取 4-8 个关键知识点（简短中文短语）
   - keywords: 提取 4-8 个核心关键词（单个专业术语）
   - difficulty: 评估难度 1-5（1=基础，5=很难）
   - category: 选择最合适的分类

【分类选项】dental_anatomy(牙体解剖), oral_pathology(口腔病理), periodontics(牙周病学), endodontics(牙体牙髓), oral_surgery(口腔外科), restorative(修复学), orthodontics(正畸学), preventive(预防口腔医学), anesthesia(口腔麻醉), radiology(口腔影像)

【输出格式】严格返回 JSON 数组：
[
  {
    "question": "...",
    "reference_answer": "...",
    "key_points": ["...", "..."],
    "keywords": ["...", "..."],
    "difficulty": 3,
    "category": "oral_pathology"
  }
]

如果文本中无明显问答结构，按段落拆分，每段生成一个总结性卡片。`

export async function aiParseQAPairs(
  rawText: string,
  apiKey: string
): Promise<ParsedCard[]> {
  const prompt = PARSE_PROMPT.replace('{rawText}', rawText.slice(0, 8000))

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
          { role: 'system', content: '你只返回JSON数组，不返回任何其他内容。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误 (${response.status})`)
    }

    const data = await response.json()
    const rawOutput = data.choices?.[0]?.message?.content || '[]'

    // 提取 JSON 数组
    const arrMatch = rawOutput.match(/\[[\s\S]*\]/)
    if (!arrMatch) throw new Error('AI 返回格式异常，未找到 JSON 数组')

    const items = JSON.parse(arrMatch[0])

    return (items as Array<Record<string, unknown>>).map((item, i) => ({
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
    }))
  } finally {
    clearTimeout(timeout)
  }
}
