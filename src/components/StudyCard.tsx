import { useState } from 'react'
import type { DentalCard, JudgeResult as JR, JudgeProvider } from '../types'

interface Props {
  card: DentalCard
  provider: JudgeProvider
  cardIndex: number
  totalCards: number
  onJudged: (result: JR, studentAnswer: string) => void
  onNext: () => void
}

export default function StudyCard({
  card, provider, cardIndex, totalCards, onJudged, onNext,
}: Props) {
  const [answer, setAnswer] = useState('')
  const [judging, setJudging] = useState(false)
  const [result, setResult] = useState<JR | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!answer.trim() || judging) return
    setJudging(true)
    setError(null)
    setResult(null)

    try {
      const res = await provider.judge({ studentAnswer: answer, card })
      setResult(res)
      onJudged(res, answer)
    } catch (e) {
      setError(e instanceof Error ? e.message : '评判失败，请重试')
    } finally {
      setJudging(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleRedo = () => {
    setAnswer('')
    setResult(null)
    setError(null)
  }

  const handleNext = () => {
    setAnswer('')
    setResult(null)
    setError(null)
    onNext()
  }

  // 分数对应的颜色和描述
  const scoreInfo = result
    ? [
        { color: 'bg-red-500', text: '需要加强', emoji: '😟' },
        { color: 'bg-orange-500', text: '还需努力', emoji: '📚' },
        { color: 'bg-yellow-500', text: '及格了', emoji: '👍' },
        { color: 'bg-lime-500', text: '不错', emoji: '😊' },
        { color: 'bg-green-500', text: '很好', emoji: '🌟' },
        { color: 'bg-emerald-500', text: '完美', emoji: '🎉' },
      ][result.score] || { color: 'bg-gray-400', text: '未知', emoji: '❓' }
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${((cardIndex) / totalCards) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-500 font-medium">
          {cardIndex + 1} / {totalCards}
        </span>
      </div>

      {/* 题目卡片 */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
        {/* 分类标签 */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
            🦷 牙科题库
          </span>
          <span className="px-3 py-1 bg-gray-50 text-gray-500 text-xs rounded-full">
            难度 {'⭐'.repeat(card.difficulty)}
          </span>
        </div>

        {/* 题目 */}
        <h2 className="text-lg font-semibold text-gray-800 leading-relaxed">
          {card.question}
        </h2>

        {/* 提示（可折叠）*/}
        <details className="group">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 transition-colors select-none">
            💡 点击查看答题提示
          </summary>
          <p className="mt-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
            请从以下方面考虑作答：{card.keyPoints.slice(0, 3).join('；')}
            {card.keyPoints.length > 3 ? `等 ${card.keyPoints.length} 个关键点` : ''}。
            尽量使用专业术语，但用自己的话表达完全正确也可以得分。
          </p>
        </details>

        {/* 输入区 */}
        <div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在此输入你的答案…（支持Ctrl+Enter提交）"
            rows={5}
            disabled={judging}
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-700
                       placeholder-gray-350 focus:ring-2 focus:ring-blue-400 focus:border-transparent
                       resize-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">
            Ctrl + Enter 提交
          </p>
        </div>

        {/* 按钮区 */}
        <div className="flex gap-3">
          {!result ? (
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || judging}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl
                         hover:bg-blue-700 active:scale-[0.98] transition-all
                         disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {judging ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  正在评判中…
                </span>
              ) : (
                '📤 提交评判'
              )}
            </button>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                onClick={handleRedo}
                className="py-3 px-4 bg-amber-500 text-white font-medium rounded-xl
                           hover:bg-amber-600 active:scale-[0.98] transition-all"
              >
                🔄 重做
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl
                           hover:bg-emerald-700 active:scale-[0.98] transition-all"
              >
                {cardIndex + 1 >= totalCards ? '🏁 完成学习' : '下一题 →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* 评判结果 */}
      {result && scoreInfo && <JudgeResultDisplay result={result} scoreInfo={scoreInfo} />}
    </div>
  )
}

/** 评判结果展示子组件 */
function JudgeResultDisplay({
  result, scoreInfo,
}: {
  result: JR
  scoreInfo: { color: string; text: string; emoji: string }
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4 animate-in">
      {/* 分数头部 */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 ${scoreInfo.color} rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
          {result.score}/5
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-800">
            {scoreInfo.emoji} {scoreInfo.text}
          </p>
          <p className="text-xs text-gray-400">
            判分方式：{result.provider} · 覆盖率：{Math.round(result.coverageRate * 100)}%
          </p>
        </div>
      </div>

      {/* AI 评语 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm text-blue-900 leading-relaxed">{result.feedback}</p>
      </div>

      {/* 遗漏的知识点 */}
      {result.missedPoints.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-orange-600 mb-2">
            📝 遗漏的知识点（{result.missedPoints.length}个）
          </h4>
          <ul className="space-y-1">
            {result.missedPoints.map((point, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 错误纠正 */}
      {result.corrections.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-600 mb-2">
            🔧 概念纠正
          </h4>
          {result.corrections.map((c, i) => (
            <div key={i} className="bg-red-50 border border-red-100 rounded-lg p-3 mb-2">
              <p className="text-sm">
                <span className="line-through text-red-400">{c.studentSaid}</span>
                {' → '}
                <span className="text-green-700 font-medium">{c.shouldBe}</span>
              </p>
              {c.note && (
                <p className="text-xs text-gray-500 mt-1">{c.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
