/**
 * Gemini Provider —— 使用 Google Gemini API（有免费额度）
 * 用户需自行在 https://aistudio.google.com/apikey 获取 API Key
 */

import type { JudgeProvider, JudgeResult, DentalCard } from '../types'
import { keywordCheck } from './keyword-check'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function buildJudgePrompt(card: DentalCard, studentAnswer: string): string {
  return `你是一位牙科医学教授，正在考核学生的专业知识。请评判以下学生的回答。

【问题】
${card.question}

【标准答案】
${card.referenceAnswer}

【核心知识点】（学生应涵盖的内容）
${card.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}

【学生回答】
${studentAnswer}

【评判要求】
1. 语义优先：只要含义正确，不要求措辞一致。学生用自己的话表达正确即可得分。
2. 关键点覆盖：逐一检查学生是否覆盖了上述核心知识点，按覆盖比例给分。
   - 覆盖≥90% → 5分（完美）
   - 覆盖70-89% → 4分（很好）
   - 覆盖50-69% → 3分（及格）
   - 覆盖30-49% → 2分（不足）
   - 覆盖<30% → 1分（差）
   - 完全无关或空白 → 0分
3. 致命错误零容忍：概念混淆（如把"牙釉质"说成"牙本质"）要明确指出并扣分。
4. 鼓励性反馈：先肯定正确部分，再指出遗漏和错误。

【输出格式】严格返回以下JSON（不要其他内容）：
{
  "score": 整数0-5,
  "is_pass": true或false(≥3分为true),
  "coverage_rate": 0.0到1.0之间的小数,
  "feedback": "2-4句话的评语，先肯定再指出不足",
  "missed_points": ["遗漏的关键知识点1", "遗漏的关键知识点2"],
  "corrections": [
    {
      "student_said": "学生原文中的错误表述",
      "should_be": "正确表述",
      "note": "简短解释"
    }
  ]
}`
}

export function createGeminiProvider(apiKey: string): JudgeProvider {
  return {
    id: 'gemini',
    name: 'Gemini 2.5 Flash（Google 免费额度）',
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
          score: 0,
          isPass: false,
          coverageRate: 0,
          feedback: '请至少写一些内容再提交评判。',
          missedPoints: card.keyPoints,
          corrections: [],
          provider: 'gemini',
        }
      }

      // 第一关：关键词预检（本地执行）
      const kwResult = keywordCheck(trimmed, card.keywords)
      if (kwResult.pass) {
        return {
          score: 5,
          isPass: true,
          coverageRate: 1.0,
          feedback: '完美！你的回答涵盖了所有关键知识点。',
          missedPoints: [],
          corrections: [],
          provider: 'gemini (关键词预检通过)',
        }
      }

      // 第二关：调用 Gemini API 深度评判
      const prompt = buildJudgePrompt(card, trimmed)

      try {
        const response = await fetch(
          `${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }],
              }],
              generationConfig: {
                temperature: 0.1,  // 低温度，确保评判一致性
                maxOutputTokens: 1024,
              },
            }),
          }
        )

        if (!response.ok) {
          const errorData = await response.text()
          console.error('Gemini API error:', response.status, errorData)
          throw new Error(`Gemini API 返回错误 (${response.status}): ${errorData}`)
        }

        const data = await response.json()
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // 从 Gemini 返回的文本中提取 JSON
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('Gemini 返回格式异常，未找到有效的 JSON')
        }

        const parsed = JSON.parse(jsonMatch[0])

        return {
          score: Math.min(5, Math.max(0, parsed.score ?? 3)),
          isPass: parsed.is_pass ?? (parsed.score >= 3),
          coverageRate: parsed.coverage_rate ?? kwResult.coverage,
          feedback: parsed.feedback || '评判完成，请查看详细结果。',
          missedPoints: parsed.missed_points || [],
          corrections: (parsed.corrections || []).map((c: Record<string, string>) => ({
            studentSaid: c.student_said || '',
            shouldBe: c.should_be || '',
            note: c.note || '',
          })),
          provider: 'gemini',
        }
      } catch (error) {
        // Gemini 调用失败时降级到关键词匹配
        console.warn('Gemini API 调用失败，降级到本地关键词评判:', error)
        const score = kwResult.coverage >= 0.7 ? 4
          : kwResult.coverage >= 0.5 ? 3
          : kwResult.coverage >= 0.3 ? 2
          : 1

        return {
          score,
          isPass: score >= 3,
          coverageRate: kwResult.coverage,
          feedback: `（AI 服务暂时不可用，以下为本地评估结果）关键词覆盖率 ${Math.round(kwResult.coverage * 100)}%。${kwResult.missed.length > 0 ? `遗漏：${kwResult.missed.join('、')}` : ''}`,
          missedPoints: kwResult.missed.length > 0 ? kwResult.missed : [],
          corrections: [],
          provider: 'gemini (降级到本地)',
        }
      }
    },

    async testConnection(apiKey?: string): Promise<boolean> {
      if (!apiKey) return false
      try {
        const response = await fetch(
          `${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: '请回复"连接成功"（只回复这三个字，不要其他内容）' }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
        )
        return response.ok
      } catch {
        return false
      }
    },
  }
}
