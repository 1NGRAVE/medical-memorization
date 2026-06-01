/**
 * DOCX 正则解析器 —— 智能识别论述题，过滤非题目内容
 */

import mammoth from 'mammoth'
import type { ParsedCard, DentistryCategory, ParseSummary } from '../types'

/** 从 .docx 文件提取纯文本 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

// ============================================================
// 题型检测
// ============================================================

/** 非论述题的标志词 */
const NON_ESSAY_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /[A-E][\.、)]\s*.{1,50}\n[A-E][\.、)]\s*.{1,50}/, type: '选择题' },
  { pattern: /单选题|多选题|单项选择题|多项选择题/, type: '选择题' },
  { pattern: /A[\.、)].*B[\.、)].*C[\.、)].*D[\.、)]/, type: '选择题' },
  { pattern: /填空题|[（(]\s*[）)]|___|____/, type: '填空题' },
  { pattern: /判断题|是非题|对错题|√|×|正确.*错误/, type: '判断题' },
  { pattern: /名词解释|解释下列名词/, type: '名词解释' },
  { pattern: /配伍题|匹配题|连线题/, type: '匹配题' },
  { pattern: /病例分析|案例分析题/, type: '病例分析' },  // 病例分析也属于论述
]

/** 论述题的标志词 */
const ESSAY_PATTERNS = /论述|简述|试述|详述|阐述|说明|叙述|问答|简答|列举|比较|分析|描述|概括|总结|归纳|请说|Why|What|How|为什么|如何|怎样|什么|哪些|区别|异同|异同点|特点|特征|机制|原理|作用|功能|步骤|方法|分类|组成|结构|概念|定义/

function detectQuestionType(text: string): string | null {
  // 先检查是否是论述题
  if (ESSAY_PATTERNS.test(text)) return '论述题'

  // 再检查其他题型
  for (const { pattern, type } of NON_ESSAY_PATTERNS) {
    if (pattern.test(text)) return type
  }

  // 有问号或"答"字的默认视为论述题
  if (/[？?]/ .test(text) || /答[：:]/.test(text)) return '论述题'

  return null  // 无法识别
}

// ============================================================
// 描述文本提取
// ============================================================

function isDescriptionLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // 明显是题目格式的跳过
  if (/^问[：:]|^答[：:]|^Q[：:]|^A[：:]|^【问题|^【答案|^\d+[\.、)]/.test(trimmed)) return false
  // 太短的不是描述
  if (trimmed.length < 8) return false
  return true
}

// ============================================================
// 核心解析
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
  return {
    tempId: `q_${index}_${Date.now()}`,
    question: question.slice(0, 200),
    referenceAnswer: answer.slice(0, 2000),
    keyPoints: extractKeyPoints(answer),
    keywords: extractKeywords(question + ' ' + answer),
    difficulty: guessDifficulty(question, answer),
    category: classifyText(question + ' ' + answer) as DentistryCategory,
  }
}

// ============================================================
// 主解析函数
// ============================================================
export function parseQAPairs(rawText: string): ParseSummary {
  const descriptionLines: string[] = []
  const allFound: { q: string; a: string; type: string | null }[] = []

  // --- 尝试各种正则匹配 ---
  const patterns = [
    { regex: /问[：:]\s*(.+?)\s*\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*问[：:]|\n*$)/g, name: '中文问/答' },
    { regex: /(\d+)[\.、)）]\s*(.{10,100}?)\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*\d+[\.、)）]|\n*$)/g, name: '编号+答' },
    { regex: /【问题[：:]?】\s*(.+?)\s*【答案[：:]?】\s*([\s\S]+?)(?=【问题|$)/g, name: '【】格式' },
    { regex: /Q[：:]\s*(.+?)\s*\n\s*A[：:]\s*([\s\S]+?)(?=\n\s*Q[：:]|\n*$)/gi, name: '英文Q/A' },
  ]

  for (const { regex } of patterns) {
    let match
    while ((match = regex.exec(rawText)) !== null) {
      const q = (match[2] || match[1]).trim()
      const a = (match[3] || match[2]).trim()
      allFound.push({ q, a, type: detectQuestionType(q) })
    }
    if (allFound.length > 0) break
  }

  // --- 无匹配时用段落拆分 ---
  if (allFound.length === 0) {
    const paragraphs = rawText.split(/\n\s*\n+/).filter(p => p.trim().length > 15)
    for (const p of paragraphs) {
      const lines = p.split(/\n/).filter(l => l.trim())
      if (lines.length >= 2 && detectQuestionType(lines[0])) {
        allFound.push({ q: lines[0].trim().slice(0, 120), a: lines.slice(1).join('\n').trim(), type: detectQuestionType(lines[0]) })
      } else if (isDescriptionLine(p)) {
        descriptionLines.push(p.trim().slice(0, 200))
      }
    }
  }

  // --- 提取描述文本 ---
  if (descriptionLines.length === 0) {
    const paragraphs = rawText.split(/\n\s*\n+/).filter(p => p.trim().length > 15)
    for (const p of paragraphs) {
      if (!allFound.some(f => p.includes(f.q) || p.includes(f.a.slice(0, 30)))) {
        if (isDescriptionLine(p)) descriptionLines.push(p.trim().slice(0, 200))
      }
    }
  }

  // --- 过滤：只保留论述题 ---
  const essayCards = allFound
    .filter(f => f.type === '论述题')
    .map((f, i) => buildCard(i, f.q, f.a))

  const filteredTypes = [...new Set(
    allFound.filter(f => f.type && f.type !== '论述题').map(f => f.type!)
  )]

  const description = descriptionLines.slice(0, 5).join('\n')

  return {
    cards: essayCards,
    description,
    totalFound: allFound.length,
    essayCount: essayCards.length,
    filteredTypes,
  }
}
