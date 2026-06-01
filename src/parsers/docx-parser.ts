/**
 * DOCX 正则解析器 —— 智能识别论述题，过滤非题目内容
 *
 * 预处理策略：先把各种中文编号格式统一为 "N. " 标准格式，
 * 再用统一的正则模式匹配，最后清洗掉残留的编号前缀。
 */

import mammoth from 'mammoth'
import type { ParsedCard, DentistryCategory, ParseSummary } from '../types'

/** 从 .docx 文件提取纯文本 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

// ============================================================
// 编号标准化
// ============================================================

const CN_NUM_MAP: Record<string, string> = {
  '一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10',
}
const CIRCLE_MAP: Record<string, string> = {
  '①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10',
}

/** 将各种中文编号统一为标准 "N. " 格式 */
function normalizeNumbering(text: string): string {
  let result = text
  // （一）（二）→ 1. 2.
  result = result.replace(/[（(][一二三四五六七八九十]+[）)]/g, m => {
    const inner = m.replace(/[（()）]/g, '')
    return (CN_NUM_MAP[inner.charAt(0)] || inner) + '. '
  })
  // （1）（2）→ 1. 2.
  result = result.replace(/[（(](\d+)[）)]/g, '$1. ')
  // ① ② ③ → 1. 2. 3.
  result = result.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, m => (CIRCLE_MAP[m] || '1') + '. ')
  // A. B. C. → 保留（常见于选择题，正则不会匹配到论述题关键词）
  // 1、1）1) → 1.
  result = result.replace(/^(\d+)[、）)]\s*/gm, '$1. ')
  // 第X题 → 去除
  result = result.replace(/第[一二三四五六七八九十\d]+题[：:.\s]*/g, '')
  // 一、二、三、→ 1. 2. 3.
  result = result.replace(/^[一二三四五六七八九十]、\s*/gm, m => (CN_NUM_MAP[m.charAt(0)] || '1') + '. ')
  return result
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
  { pattern: /配伍题|匹配题|连线题/, type: '匹配题' },
]

const ESSAY_PATTERNS = /论述|简述|试述|详述|阐述|说明|叙述|问答|简答|列举|比较|分析|描述|概括|总结|归纳|请说|Why|What|How|为什么|如何|怎样|什么|哪些|区别|异同|异同点|特点|特征|机制|原理|作用|功能|步骤|方法|分类|组成|结构|概念|定义/

function detectQuestionType(text: string): string | null {
  if (ESSAY_PATTERNS.test(text)) return '论述题'
  for (const { pattern, type } of NON_ESSAY_PATTERNS) {
    if (pattern.test(text)) return type
  }
  if (/[？?]/.test(text) || /答[：:]/.test(text)) return '论述题'
  return null
}

// ============================================================
// 问题文本清理
// ============================================================

/** 去掉问题开头残留的编号前缀 */
function cleanQuestionPrefix(q: string): string {
  return q
    .replace(/^\s*(?:\d+[\.、)）]\s*)+/, '')
    .replace(/^\s*[（(][一二三四五六七八九十\d]+[）)]\s*/, '')
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
    .replace(/^\s*[A-F][\.、]\s*/, '')
    .replace(/^\s*第[一二三四五六七八九十\d]+题\s*/, '')
    .trim()
}

// ============================================================
// 描述文本
// ============================================================

function isDescriptionLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 8) return false
  if (/^问[：:]|^答[：:]|^Q[：:]|^A[：:]|^【问题|^【答案|^\d+[\.、)]/.test(trimmed)) return false
  return true
}

// ============================================================
// 辅助函数
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
  const cleanQ = cleanQuestionPrefix(question)
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
// Q&A 提取辅助
// ============================================================

interface RawQA {
  q: string
  a: string
  type: string | null
}

/** 从正则匹配结果中提取 Q&A */
function extractFromMatches(regex: RegExp, text: string, qGroup: number, aGroup: number): RawQA[] {
  const results: RawQA[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const q = match[qGroup].trim()
    const a = match[aGroup].trim()
    if (q.length > 3 && a.length > 5) {
      results.push({ q, a, type: detectQuestionType(q) })
    }
  }
  return results
}

/** 无显式标签的 Q&A 匹配：编号行是题目，紧跟着的段落是答案 */
function extractImplicitQA(text: string): RawQA[] {
  const results: RawQA[] = []
  // 先找到所有编号行
  const lines = text.split(/\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    // 检查是否以编号开头（标准化后的格式：数字. 或保留了中文括号格式）
    const isNumbered = /^\d+\.\s+/.test(line)
    const hasQuestionKeyword = /^(?:简述|试述|论述|阐述|说明|叙述|列举|比较|分析|描述|概括|总结|归纳|如何|怎样|什么|哪些|为什么|请).{8,}/.test(line)
    const hasBracketNumber = /^[（(][一二三四五六七八九十\d]+[）)]/.test(line)

    if ((isNumbered || hasBracketNumber) && line.length > 10) {
      // 收集后续行作为答案
      const answerLines: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        // 遇到下一个编号行或 ''问/答' 标签就停止
        if (/^\d+\.\s+/.test(nextLine) ||
            /^[（(][一二三四五六七八九十\d]+[）)]/.test(nextLine) ||
            /^问[：:]/.test(nextLine) ||
            /^【问题/.test(nextLine)) {
          break
        }
        if (nextLine) answerLines.push(nextLine)
        j++
      }
      if (answerLines.length > 0) {
        const q = cleanQuestionPrefix(line)
        const a = answerLines.join('\n')
        if (q.length > 3 && a.length > 10) {
          results.push({ q, a, type: detectQuestionType(q) })
        }
      }
      i = j
      continue
    }

    // 以"问"关键字开头但没有显式"答"标签
    if (hasQuestionKeyword && i + 1 < lines.length) {
      const answerLines: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        if (/^\d+\.\s+/.test(nextLine) ||
            /^[（(][一二三四五六七八九十\d]+[）)]/.test(nextLine) ||
            /^问[：:]/.test(nextLine) ||
            /^(?:简述|试述|论述|阐述)/ .test(nextLine)) {
          break
        }
        if (nextLine) answerLines.push(nextLine)
        j++
      }
      if (answerLines.length > 0) {
        const q = cleanQuestionPrefix(line)
        const a = answerLines.join('\n')
        if (a.length > 10) {
          results.push({ q, a, type: detectQuestionType(q) })
        }
      }
      i = j
      continue
    }

    i++
  }
  return results
}

// ============================================================
// 主解析函数
// ============================================================
export function parseQAPairs(rawText: string): ParseSummary {
  const descriptionLines: string[] = []
  let allFound: RawQA[] = []

  // --- 第一步：标准化编号 ---
  const normalized = normalizeNumbering(rawText)

  // --- 第二步：显式标签匹配 ---
  const patterns: { regex: RegExp; qGroup: number; aGroup: number }[] = [
    { regex: /问[：:]\s*(.+?)\s*\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*问[：:]|\n*$)/g, qGroup: 1, aGroup: 2 },
    { regex: /(\d+)[\.、)）]\s*(.{8,200}?)\n\s*答[：:]\s*([\s\S]+?)(?=\n\s*\d+[\.、)）]|\n*$)/g, qGroup: 2, aGroup: 3 },
    { regex: /【问题[：:]?】\s*(.+?)\s*【答案[：:]?】\s*([\s\S]+?)(?=【问题|$)/g, qGroup: 1, aGroup: 2 },
    { regex: /Q[：:]\s*(.+?)\s*\n\s*A[：:]\s*([\s\S]+?)(?=\n\s*Q[：:]|\n*$)/gi, qGroup: 1, aGroup: 2 },
  ]

  for (const { regex, qGroup, aGroup } of patterns) {
    allFound = extractFromMatches(regex, normalized, qGroup, aGroup)
    // 也试原文本
    if (allFound.length === 0 && normalized !== rawText) {
      allFound = extractFromMatches(regex, rawText, qGroup, aGroup)
    }
    if (allFound.length > 0) break
  }

  // --- 第三步：无标签匹配 ---
  if (allFound.length === 0) {
    allFound = extractImplicitQA(normalized)
  }

  // --- 第四步：段落拆分兜底 ---
  if (allFound.length === 0) {
    const textToUse = normalized || rawText
    const paragraphs = textToUse.split(/\n\s*\n+/).filter(p => p.trim().length > 15)
    for (const p of paragraphs) {
      const lines = p.split(/\n/).filter(l => l.trim())
      if (lines.length >= 2 && detectQuestionType(lines[0])) {
        const q = cleanQuestionPrefix(lines[0].trim())
        allFound.push({ q: q.slice(0, 120), a: lines.slice(1).join('\n').trim(), type: detectQuestionType(q) })
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
