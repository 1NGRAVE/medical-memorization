import type { ParsedCard, DentistryCategory } from '../types'
import { CATEGORY_LABELS } from '../types'

interface Props {
  card: ParsedCard
  index: number
  onChange: (card: ParsedCard) => void
  onDelete: () => void
}

export default function CardEditor({ card, index, onChange, onDelete }: Props) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">卡片 #{index + 1}</span>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm">删除</button>
      </div>

      <div>
        <label className="text-xs text-gray-500">问题</label>
        <textarea
          value={card.question}
          onChange={e => onChange({ ...card, question: e.target.value })}
          rows={2}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500">标准答案</label>
        <textarea
          value={card.referenceAnswer}
          onChange={e => onChange({ ...card, referenceAnswer: e.target.value })}
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 resize-none"
        />
      </div>

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
