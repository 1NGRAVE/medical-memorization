/**
 * DOCX 正则解析器 —— 基础段落拆分（无 AI 时的兜底方案）
 *
 * 正则无法做到"知识→问题"的智能转换，仅做段落级拆分。
 * 推荐使用 AI 解析器获得更好的出题效果。
 */

import mammoth from 'mammoth'
import type { ParsedCard, DentistryCategory, ParseSummary } from '../types'

export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

// ============================================================
// 题型检测
// ============================================================

const NON_ESSAY_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /[A-E][\.、)]\s*.{1,50}\n[A-E][\.、)]\s*.{1,50}/, type: '选择题' },
  { pattern: /单选题|多选题|单项选择题|多项选择题/, type: '选择题' },
  { pattern: /A[\.、)].*B[\.、)].*C[\.、)].*D[\.、)]/, type: '选择题' },
  { pattern: /填空题|[（(]\s*[）)]|___|____/, type: '填空题' },
  { pattern: /判断题|是非题|对错题|√|×|正确.*错误/, type: '判断题' },
  { pattern: /名词解释|解释下列名词/, type: '名词解释' },
]

const ESSAY_PATTERNS = /论述|简述|试述|详述|阐述|说明|叙述|问答|简答|列举|比较|分析|描述|概括|总结|归纳|请说|Why|What|How|为什么|如何|怎样|什么|哪些|区别|异同|特点|特征|机制|原理|作用|功能|步骤|方法|分类|组成|结构|概念|定义/

function detectQuestionType(text: string): string | null {
  if (ESSAY_PATTERNS.test(text)) return '论述题'
  for (const { pattern, type } of NON_ESSAY_PATTERNS) {
    if (pattern.test(text)) return type
  }
  if (/[？?]/.test(text) || /答[：:]/.test(text)) return '论述题'
  return null
}

// ============================================================
// 辅助
// ============================================================

function classifyText(text: string): string {
  const lower = text.toLowerCase()
  if (/龋|蛀牙|caries/.test(lower)) return 'oral_pathology'
  if (/牙周|牙龈|periodont|gingiv/.test(lower)) return 'periodontics'
  if (/根管|牙髓|pulp|endodont|rct/.test(lower)) return 'endodontics'
  if (/拔牙|智齿|种植|implant|麻醉|麻药/.test(lower)) return 'oral_surgery'
  if (/冠|桥|修复|restor|crown|bridge|义齿|全口/.test(lower)) return 'restorative'
  if (/正畸|矫正|矫治|orthodont|错颌/.test(lower)) return 'orthodontics'
  if (/氟|窝沟|预防|sealant|fluoride/.test(lower)) return 'preventive'
  if (/麻|阻滞|麻醉|anesth|lidocaine/.test(lower)) return 'anesthesia'
  if (/X线|片|影像|radiograph/.test(lower)) return 'radiology'
  return 'dental_anatomy'
}

function extractKeywords(text: string): string[] {
  const patterns = [/[a-zA-Z]{3,}/g, /[^\s,，。；;、\d]{2,4}(?:症|病|炎|术|药|质|骨|牙|齿|膜|管|体|菌|法|剂|冠|桥)/g]
  const words = new Set<string>()
  for (const p of patterns) {
    const m = text.match(p); if (m) m.forEach(w => words.add(w.toLowerCase()))
  }
  return [...words].slice(0, 8)
}

function extractKeyPoints(answer: string): string[] {
  return answer.split(/[；;。\n]+/).map(s => s.trim()).filter(s => s.length > 4 && s.length < 60).slice(0, 8)
}

function guessDifficulty(q: string, a: string): number {
  const len = (q + a).length
  if (len < 100) return 1; if (len < 200) return 2; if (len < 400) return 3; if (len < 600) return 4; return 5
}

function buildCard(index: number, question: string, answer: string): ParsedCard {
  const cleanQ = question.replace(/^\s*(?:\d+[\.、)）]\s*)+/, '').trim()
  return {
    tempId: `q_${index}_${Date.now()}`,
    question: cleanQ.slice(0, 200),
    referenceAnswer: answer.slice(0, 2000),
    keyPoints: extractKeyPoints(answer),
    keywords: extractKeywords(cleanQ + ' ' + answer),
    difficulty: guessDifficulty(cleanQ, answer),
    category: classifyText(cleanQ + ' ' + answer) as DentistryCategory,
  }
}

// ============================================================
// 主解析
// ============================================================
export function parseQAPairs(rawText: string): ParseSummary {
  // 尝试显式问答标签
  const qaRegexes = [
    { regex: /问[：:]\s*(.+?)\s*\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*问[：:]|\n*$)/g, q: 1, a: 2 },
    { regex: /【问题[：:]?】\s*(.+?)\s*【答案[：:]?】\s*([\s\S]+?)(?=【问题|$)/g, q: 1, a: 2 },
    { regex: /Q[：:]\s*(.+?)\s*\n\s*A[：:]\s*([\s\S]+?)(?=\n\s*Q[：:]|\n*$)/gi, q: 1, a: 2 },
  ]

  for (const { regex, q, a } of qaRegexes) {
    const items: { q: string; a: string; type: string | null }[] = []
    let m
    while ((m = regex.exec(rawText)) !== null) {
      const qText = m[q].trim()
      const aText = m[a].trim()
      if (qText.length > 3 && aText.length > 5) {
        items.push({ q: qText, a: aText, type: detectQuestionType(qText) })
      }
    }
    if (items.length > 0) {
      const essay = items.filter(f => f.type === '论述题')
      return {
        cards: essay.map((f, i) => buildCard(i, f.q, f.a)),
        description: '',
        totalFound: items.length,
        essayCount: essay.length,
        filteredTypes: [...new Set(items.filter(f => f.type && f.type !== '论述题').map(f => f.type!))],
      }
    }
  }

  // 兜底：段落拆分（正则无法智能出题）
  const paragraphs = rawText.split(/\n\s*\n+/).filter(p => {
    const t = p.trim()
    return t.length > 25 && !/^第[一二三四五六七八九十\d]+章/.test(t)
  })

  const cards = paragraphs.slice(0, 30).map((p, i) => {
    const lines = p.split(/\n/).filter(l => l.trim())
    const first = lines[0].replace(/^\s*(?:\d+[\.、)）]\s*)+/, '').trim()
    const topic = first.length >= 10 ? `请简述：${first.slice(0, 60)}` : '请简述以下知识点'
    return buildCard(i, topic, lines.join('\n').trim())
  })

  return {
    cards,
    description: '',
    totalFound: paragraphs.length,
    essayCount: cards.length,
    filteredTypes: [],
  }
}
