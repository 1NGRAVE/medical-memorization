/**
 * 关键词硬约束检查 —— 始终在本地运行，0延迟，0成本
 * 通过检查学生答案中是否覆盖了标准答案的核心关键词来判断
 */

export interface KeywordCheckResult {
  pass: boolean      // 全部命中 → 直接通过
  fail: boolean      // 几乎全未命中 → 直接失败
  coverage: number   // 命中率 0.0-1.0
  matched: string[]
  missed: string[]
}

/**
 * 医学同义词映射表（牙科领域）
 * 支持中英文对照和同义表达
 */
const SYNONYMS: Record<string, string[]> = {
  '牙釉质': ['enamel', '釉质', '牙釉'],
  '牙本质': ['dentin', 'dentine', '本质'],
  '牙髓': ['pulp', '牙髓组织', '牙神经'],
  '龋病': ['龋齿', '蛀牙', '虫牙', 'caries', '龋'],
  '牙周炎': ['periodontitis', '牙周病', '牙周炎症'],
  '根管治疗': ['RCT', 'root canal', '根管治疗术', '抽神经'],
  '智齿': ['wisdom tooth', '第三磨牙', '智慧齿'],
  '利多卡因': ['lidocaine', '赛罗卡因'],
  '窝沟封闭': ['sealant', '窝沟封闭剂', 'pit and fissure sealant'],
  '氟化物': ['fluoride', '氟', '氟离子'],
  '全冠': ['crown', '牙冠', '全冠修复'],
  '错𬌗': ['错颌', 'malocclusion', '错颌畸形', '牙颌畸形'],
  '附着丧失': ['attachment loss', '附着水平丧失', 'AL'],
  '白斑': ['leukoplakia', '白色斑块', '口腔白斑'],
  '牙髓炎': ['pulpitis', '牙髓炎症', '牙神经发炎'],
  '牙龈炎': ['gingivitis', '牙龈炎症', '牙龈发炎'],
  '正畸': ['orthodontics', '矫正', '矫治', '箍牙', '戴牙套'],
  '固定桥': ['bridge', '固定义齿', '牙桥'],
  '种植': ['implant', '种植牙', '种植体'],
}

function getSynonyms(word: string): string[] {
  const exact = SYNONYMS[word] || []
  // 也检查小写/去空格版本
  const lower = SYNONYMS[word.toLowerCase()] || []
  return [...new Set([word, ...exact, ...lower])]
}

/**
 * 对学生答案进行关键词覆盖检查
 */
export function keywordCheck(
  studentAnswer: string,
  keywords: string[]
): KeywordCheckResult {
  const lower = studentAnswer.toLowerCase().replace(/\s+/g, '')
  const matched: string[] = []
  const missed: string[] = []

  for (const kw of keywords) {
    const synonyms = getSynonyms(kw)
    const found = synonyms.some(s =>
      lower.includes(s.toLowerCase().replace(/\s+/g, ''))
    )
    if (found) {
      matched.push(kw)
    } else {
      missed.push(kw)
    }
  }

  const coverage = keywords.length > 0
    ? matched.length / keywords.length
    : 0

  return {
    pass: coverage >= 0.9,       // ≥90%命中 → 直接通过
    fail: coverage <= 0.15,       // ≤15%命中 → 直接失败
    coverage: Math.round(coverage * 100) / 100,
    matched,
    missed,
  }
}

/**
 * 基于关键词覆盖率的简单评分
 */
export function keywordScore(result: KeywordCheckResult): number {
  if (result.pass) return 5
  if (result.fail) return 1
  if (result.coverage >= 0.7) return 4
  if (result.coverage >= 0.5) return 3
  if (result.coverage >= 0.3) return 2
  return 1
}

/**
 * 生成基于关键词检查的反馈文本
 */
export function keywordFeedback(result: KeywordCheckResult, _keyPoints: string[]): string {
  if (result.pass) {
    return '非常好！你的回答涵盖了所有核心知识点，与标准答案高度一致。'
  }
  if (result.fail) {
    return `你的回答遗漏了大部分核心概念。建议仔细复习后重新作答。缺失的关键词：${result.missed.join('、')}。`
  }
  if (result.coverage >= 0.7) {
    return `不错！你覆盖了大部分关键点。还需要补充：${result.missed.join('、')}。`
  }
  return `还需加强。你命中的关键词：${result.matched.length > 0 ? result.matched.join('、') : '无'}。遗漏的：${result.missed.join('、')}。建议重新复习相关内容。`
}
