/**
 * Mock Provider —— 使用纯本地关键词匹配，无需 API Key
 * 始终可用，作为默认提供者和离线兜底方案
 */

import type { JudgeProvider, JudgeResult, DentalCard } from '../types'
import { keywordCheck, keywordScore, keywordFeedback } from './keyword-check'

export const mockProvider: JudgeProvider = {
  id: 'mock',
  name: '本地关键词匹配（Mock）',
  requiresApiKey: false,
  requiresNetwork: false,

  async judge({ studentAnswer, card }: {
    studentAnswer: string
    card: DentalCard
  }): Promise<JudgeResult> {
    // 模拟一个简短的"AI思考"延迟，让体验更真实
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600))

    const trimmed = studentAnswer.trim()

    // 空答案直接判0分
    if (!trimmed || trimmed.length < 5) {
      return {
        score: 0,
        isPass: false,
        coverageRate: 0,
        feedback: '请至少写一些内容再提交评判。如果完全不记得，可以先复习标准答案再回来作答。',
        missedPoints: card.keyPoints,
        corrections: [],
        provider: 'mock',
      }
    }

    const kwResult = keywordCheck(trimmed, card.keywords)
    const score = keywordScore(kwResult)
    const feedback = keywordFeedback(kwResult, card.keyPoints)

    // 根据关键词匹配结果推断遗漏的知识点
    const missedPoints = card.keyPoints.filter(kp => {
      const lowerKP = kp.toLowerCase().replace(/\s+/g, '')
      return !kwResult.matched.some(m =>
        m.toLowerCase().replace(/\s+/g, '').includes(lowerKP.substring(0, 3)) ||
        lowerKP.includes(m.toLowerCase().replace(/\s+/g, '').substring(0, 3))
      )
    })

    return {
      score,
      isPass: score >= 3,
      coverageRate: kwResult.coverage,
      feedback,
      missedPoints,
      corrections: [],
      provider: 'mock',
    }
  },

  async testConnection(): Promise<boolean> {
    return true // Mock永远可用
  },
}
