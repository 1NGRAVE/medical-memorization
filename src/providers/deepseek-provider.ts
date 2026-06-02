/**
 * DeepSeek Provider —— 中国 AI（国内直连，无需 VPN）
 * API 文档：https://platform.deepseek.com/api-docs
 * 价格：¥1/百万输入token，¥2/百万输出token（极低）
 *
 * 支持联网搜索增强判分：开启后通过百度搜索获取最新医学资料，
 * 再结合搜索结果进行更准确的评判。百度搜索国内可用，无需额外 API Key。
 */

import type { JudgeProvider, JudgeResult, DentalCard } from '../types'
import { keywordCheck } from './keyword-check'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

/** 联网搜索：使用百度搜索（国内可用，无需 API Key） */
async function webSearch(query: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(
      `https://www.baidu.com/s?wd=${encodeURIComponent(query + ' 医学')}&rn=5`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    )
    clearTimeout(timeout)

    if (!response.ok) return ''

    const html = await response.text()

    // 解析百度搜索结果摘要
    const abstracts: string[] = []

    // 尝试多种百度搜索结果摘要的 class 模式（兼容不同版本）
    const patterns = [
      /<span class="content-right_[^"]*">([\s\S]*?)<\/span>/g,
      /<div class="c-abstract"[^>]*>([\s\S]*?)<\/div>/g,
      /<span class="c-abstract"[^>]*>([\s\S]*?)<\/span>/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        if (text.length > 20) {
          abstracts.push(text)
        }
      }
      if (abstracts.length >= 3) break // 一种模式够用则停止
    }

    if (abstracts.length === 0) return ''

    return abstracts
      .slice(0, 5)
      .map((content, i) => `[参考${i + 1}] ${content}`)
      .join('\n\n')
  } catch {
    return '' // 搜索失败，静默降级——不影响核心判分流程
  }
}

function buildJudgePrompt(
  card: DentalCard,
  studentAnswer: string,
  searchContext: string
): string {
  const searchSection = searchContext
    ? `\n\n【联网搜索参考资料】（用于辅助验证事实准确性）\n${searchContext}\n`
    : ''

  return `你是一位牙科医学教授，正在考核学生的专业知识。请严格评判以下学生的回答。

【问题】
${card.question}

【标准答案】
${card.referenceAnswer}

【核心知识点】（学生应涵盖的内容）
${card.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}
${searchSection}
【学生回答】
${studentAnswer}

【评判要求】
1. 语义优先：只要含义正确，不要求措辞一致。学生用自己的话正确表达即可得分。
2. 同义词宽容：医学同义词、别名、英文缩写都应认可。
   例："牙釉质" = "enamel" = "釉质"；"牙髓炎" = "牙神经发炎" = "pulpitis"
3. 关键点覆盖：逐一检查学生是否覆盖了核心知识点，按覆盖比例给分。
   - 覆盖≥90% → 5分（完美）
   - 覆盖70-89% → 4分（很好）
   - 覆盖50-69% → 3分（及格）
   - 覆盖30-49% → 2分（不足）
   - 覆盖<30% → 1分（差）
   - 空答案或完全无关 → 0分
4. 致命错误零容忍：概念混淆要明确指出并扣分。
5. 鼓励性反馈：先肯定正确部分，再指出遗漏和错误。

【输出格式】严格返回以下JSON（不要其他内容）：
{
  "score": 整数0-5,
  "is_pass": true或false(≥3分为true),
  "coverage_rate": 0.0到1.0之间的小数,
  "feedback": "2-4句评语，先肯定再指出不足。如果有联网参考资料帮助了判断，简要说明",
  "missed_points": ["遗漏的知识点"],
  "corrections": [
    {
      "student_said": "学生的错误表述",
      "should_be": "正确表述",
      "note": "解释"
    }
  ]
}`
}

export function createDeepSeekProvider(
  apiKey: string,
  enableSearch = false
): JudgeProvider {
  return {
    id: 'deepseek',
    name: 'DeepSeek V3（国内AI · 极低价）',
    requiresApiKey: true,
    requiresNetwork: true,

    async judge({ studentAnswer, card }: {
      studentAnswer: string
      card: DentalCard
    }): Promise<JudgeResult> {
      const trimmed = studentAnswer.trim()

      // 空答案快速返回
      if (!trimmed || trimmed.length < 5) {
        return {
          score: 0, isPass: false, coverageRate: 0,
          feedback: '请至少写一些内容再提交评判。',
          missedPoints: card.keyPoints, corrections: [],
          provider: 'deepseek',
        }
      }

      // 第一关：关键词预检（本地执行，零成本）
      const kwResult = keywordCheck(trimmed, card.keywords)
      if (kwResult.pass) {
        return {
          score: 5, isPass: true, coverageRate: 1.0,
          feedback: '完美！你的回答涵盖了所有关键知识点，与标准答案高度一致。',
          missedPoints: [], corrections: [],
          provider: 'deepseek (关键词预检通过)',
        }
      }

      // 联网搜索（可选）
      let searchContext = ''
      if (enableSearch) {
        const searchQuery = card.question.slice(0, 50) + ' ' +
          card.keyPoints.slice(0, 3).join(' ')
        searchContext = await webSearch(searchQuery)
      }

      // 第二关：DeepSeek API
      const prompt = buildJudgePrompt(card, trimmed, searchContext)

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)

        const response = await fetch(DEEPSEEK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一位严谨的牙科医学教授。你只返回JSON，不返回任何其他内容。' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
          const errText = await response.text()
          console.error('DeepSeek API error:', response.status, errText)
          throw new Error(`DeepSeek API 错误 (${response.status})`)
        }

        const data = await response.json()
        const rawText = data.choices?.[0]?.message?.content || ''

        // 解析 JSON
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('DeepSeek 返回格式异常')
        }

        const parsed = JSON.parse(jsonMatch[0])

        return {
          score: Math.min(5, Math.max(0, parsed.score ?? 3)),
          isPass: parsed.is_pass ?? (parsed.score >= 3),
          coverageRate: parsed.coverage_rate ?? kwResult.coverage,
          feedback: parsed.feedback || '评判完成。',
          missedPoints: parsed.missed_points || [],
          corrections: (parsed.corrections || []).map((c: Record<string, string>) => ({
            studentSaid: c.student_said || '',
            shouldBe: c.should_be || '',
            note: c.note || '',
          })),
          provider: enableSearch && searchContext
            ? 'deepseek (联网搜索增强)'
            : 'deepseek',
        }
      } catch (error) {
        // 降级到本地关键词匹配
        console.warn('DeepSeek API 失败，降级到本地判分:', error)
        const score = kwResult.coverage >= 0.7 ? 4
          : kwResult.coverage >= 0.5 ? 3
          : kwResult.coverage >= 0.3 ? 2
          : 1

        return {
          score, isPass: score >= 3,
          coverageRate: kwResult.coverage,
          feedback: `（DeepSeek API 暂时不可用，以下为本地评估）关键词覆盖率 ${Math.round(kwResult.coverage * 100)}%。${kwResult.missed.length > 0 ? `遗漏：${kwResult.missed.join('、')}` : ''}`,
          missedPoints: kwResult.missed,
          corrections: [],
          provider: 'deepseek (降级到本地)',
        }
      }
    },

    async testConnection(apiKey?: string): Promise<boolean> {
      if (!apiKey) return false
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const response = await fetch(DEEPSEEK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: '请回复"连接成功"四个字' }],
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
