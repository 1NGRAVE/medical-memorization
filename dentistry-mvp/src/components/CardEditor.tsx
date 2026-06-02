import { useState } from 'react'
import type { ParsedCard, DentistryCategory, CardType } from '../types'
import { CATEGORY_LABELS, CARD_TYPE_LABELS } from '../types'

interface Props {
  card: ParsedCard
  index: number
  onChange: (card: ParsedCard) => void
  onDelete: () => void
}

const CARD_TYPES: CardType[] = ['essay', 'short_answer', 'multiple_choice', 'fill_blank', 'true_false']

export default function CardEditor({ card, index, onChange, onDelete }: Props) {
  const cardType = card.cardType || 'short_answer'
  const [showTypeMenu, setShowTypeMenu] = useState(false)

  const updateCardType = (ct: CardType) => {
    setShowTypeMenu(false)
    onChange({ ...card, cardType: ct })
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">卡片 #{index + 1}</span>

          {/* 题型选择器 */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                cardType === 'essay' ? 'bg-purple-100 text-purple-700' :
                cardType === 'short_answer' ? 'bg-blue-100 text-blue-700' :
                cardType === 'multiple_choice' ? 'bg-amber-100 text-amber-700' :
                cardType === 'fill_blank' ? 'bg-green-100 text-green-700' :
                'bg-rose-100 text-rose-700'
              }`}
            >
              {CARD_TYPE_LABELS[cardType]}
            </button>
            {showTypeMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
                {CARD_TYPES.map(ct => (
                  <button
                    key={ct}
                    onClick={() => updateCardType(ct)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                      ct === cardType ? 'font-medium text-blue-600' : 'text-gray-600'
                    }`}
                  >
                    {CARD_TYPE_LABELS[ct]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm">删除</button>
      </div>

      {/* 问题 */}
      <div>
        <label className="text-xs text-gray-500">问题</label>
        <textarea
          value={card.question}
          onChange={e => onChange({ ...card, question: e.target.value })}
          rows={2}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 resize-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </div>

      {/* 答案 */}
      <div>
        <label className="text-xs text-gray-500">标准答案</label>
        <textarea
          value={card.referenceAnswer}
          onChange={e => onChange({ ...card, referenceAnswer: e.target.value })}
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 resize-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
        />
      </div>

      {/* 选择题专属：选项编辑器 */}
      {cardType === 'multiple_choice' && (
        <div>
          <label className="text-xs text-gray-500">
            选项（A/B/C/D/E）—
            <span className="text-amber-500">正确选项: </span>
            <select
              value={card.correctOptionIndex ?? 0}
              onChange={e => onChange({ ...card, correctOptionIndex: Number(e.target.value) })}
              className="text-xs border border-gray-200 rounded px-1"
            >
              {(card.options || ['A', 'B', 'C', 'D']).map((_, i) => (
                <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>
              ))}
            </select>
          </label>
          <div className="space-y-1 mt-1">
            {(card.options || ['A', 'B', 'C', 'D']).map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className={`text-xs font-bold w-5 ${i === (card.correctOptionIndex ?? 0) ? 'text-amber-600' : 'text-gray-400'}`}>
                  {String.fromCharCode(65 + i)}.
                </span>
                <input
                  value={opt}
                  onChange={e => {
                    const newOpts = [...(card.options || ['', '', '', ''])]
                    newOpts[i] = e.target.value
                    onChange({ ...card, options: newOpts })
                  }}
                  className="flex-1 border border-gray-200 rounded px-2 py-0.5 text-xs"
                  placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 填空题专属 */}
      {cardType === 'fill_blank' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
          💡 填空题：答案中使用 <code className="bg-green-100 px-1 rounded">___</code> 标记挖空位置。
        </div>
      )}

      {/* 判断题专属 */}
      {cardType === 'true_false' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">正确答案：</label>
          <button
            onClick={() => onChange({ ...card, question: card.question.replace(/[对错]$/, '') + '对' })}
            className={`text-xs px-3 py-1 rounded ${card.question.endsWith('对') ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          >✓ 对</button>
          <button
            onClick={() => onChange({ ...card, question: card.question.replace(/[对错]$/, '') + '错' })}
            className={`text-xs px-3 py-1 rounded ${card.question.endsWith('错') ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          >✗ 错</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">关键点（逗号分隔）</label>
          <input
            value={card.keyPoints.join(', ')}
            onChange={e => onChange({
              ...card,
              keyPoints: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
            })}
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">关键词（逗号分隔）</label>
          <input
            value={card.keywords.join(', ')}
            onChange={e => onChange({
              ...card,
              keywords: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
            })}
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">分类</label>
          <select
            value={card.category}
            onChange={e => onChange({ ...card, category: e.target.value as DentistryCategory })}
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">难度</label>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => onChange({ ...card, difficulty: n })}
                className={`text-lg ${n <= card.difficulty ? 'text-yellow-500' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
