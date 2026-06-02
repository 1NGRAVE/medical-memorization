import { useState, useEffect, useCallback } from 'react'
import type { DentalCard, DentistryCategory, CardType } from '../types'
import { CATEGORY_LABELS, CARD_TYPE_LABELS } from '../types'

const TYPE_COLORS: Record<CardType, string> = {
  essay: 'bg-purple-100 text-purple-700',
  short_answer: 'bg-blue-100 text-blue-700',
  multiple_choice: 'bg-amber-100 text-amber-700',
  fill_blank: 'bg-green-100 text-green-700',
  true_false: 'bg-rose-100 text-rose-700',
}
import {
  getCardsByDeck, addCardsToDeck, removeCardFromDeck, updateCard,
} from '../db'

interface Props {
  deckId: string
  deckName: string
  onStartStudy: () => void
  onImport: () => void
  onBack: () => void
}

function blankCard(deckId: string): DentalCard {
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    question: '',
    referenceAnswer: '',
    keyPoints: [],
    keywords: [],
    difficulty: 3,
    category: 'dental_anatomy',
    deckId,
    source: 'user',
  }
}

export default function DeckManager({ deckId, deckName, onStartStudy, onImport, onBack }: Props) {
  const [cards, setCards] = useState<DentalCard[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newCard, setNewCard] = useState<DentalCard>(blankCard(deckId))
  const [editDraft, setEditDraft] = useState<DentalCard | null>(null)

  const loadCards = useCallback(async () => {
    setLoading(true)
    const loaded = await getCardsByDeck(deckId)
    setCards(loaded)
    setLoading(false)
  }, [deckId])

  useEffect(() => { loadCards() }, [loadCards])

  const handleDelete = async (cardId: string) => {
    if (!confirm('确定删除这张卡片？')) return
    await removeCardFromDeck(cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
    if (editingId === cardId) {
      setEditingId(null)
      setEditDraft(null)
    }
  }

  const startEdit = (card: DentalCard) => {
    setEditingId(card.id)
    setEditDraft({ ...card })
    setAddingNew(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
  }

  const saveEdit = async () => {
    if (!editDraft) return
    await updateCard(editDraft.id, {
      question: editDraft.question,
      referenceAnswer: editDraft.referenceAnswer,
      keyPoints: editDraft.keyPoints,
      keywords: editDraft.keywords,
      difficulty: editDraft.difficulty,
      category: editDraft.category,
    })
    setCards(prev => prev.map(c => c.id === editDraft.id ? { ...editDraft } : c))
    setEditingId(null)
    setEditDraft(null)
  }

  const startAdd = () => {
    setAddingNew(true)
    setNewCard(blankCard(deckId))
    setEditingId(null)
    setEditDraft(null)
  }

  const cancelAdd = () => {
    setAddingNew(false)
  }

  const saveNew = async () => {
    if (!newCard.question.trim() || !newCard.referenceAnswer.trim()) return
    const card: DentalCard = {
      ...newCard,
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      deckId,
      source: 'user',
    }
    await addCardsToDeck(deckId, [card])
    setCards(prev => [...prev, card])
    setAddingNew(false)
    setNewCard(blankCard(deckId))
  }

  const renderForm = (
    card: DentalCard,
    onChange: (c: DentalCard) => void,
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string,
  ) => (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border-2 border-blue-200">
      <div>
        <label className="text-xs text-gray-500 font-medium">问题</label>
        <textarea
          value={card.question}
          onChange={e => onChange({ ...card, question: e.target.value })}
          rows={2}
          placeholder="输入问题，如：请简述牙釉质的组织结构…"
          className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium">标准答案</label>
        <textarea
          value={card.referenceAnswer}
          onChange={e => onChange({ ...card, referenceAnswer: e.target.value })}
          rows={3}
          placeholder="输入标准答案…"
          className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">关键点（逗号分隔）</label>
          <input
            value={card.keyPoints.join(', ')}
            onChange={e => onChange({ ...card, keyPoints: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) })}
            placeholder="如：釉柱, 柱间质, 羟基磷灰石"
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">关键词（逗号分隔）</label>
          <input
            value={card.keywords.join(', ')}
            onChange={e => onChange({ ...card, keywords: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) })}
            placeholder="如：牙釉质, enamel"
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 font-medium">分类</label>
          <select
            value={card.category}
            onChange={e => onChange({ ...card, category: e.target.value as DentistryCategory })}
            className="w-full border border-gray-200 rounded-lg p-2 text-sm mt-1 focus:border-blue-400"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">难度</label>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => onChange({ ...card, difficulty: n })}
                className={`text-lg transition-colors ${n <= card.difficulty ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-300'}`}
              >★</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">{saveLabel}</button>
        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-300 transition-colors">取消</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">📋 管理卡片</h2>
          <p className="text-sm text-gray-500">题库：{deckName} · {cards.length} 张卡片</p>
        </div>
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← 返回</button>
      </div>

      <div className="flex gap-3">
        <button onClick={startAdd} disabled={addingNew}
          className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all">
          + 添加卡片
        </button>
        <button onClick={onImport}
          className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-all">
          📥 导入文件
        </button>
        {cards.length > 0 && (
          <button onClick={onStartStudy}
            className="flex-1 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-all">
            ▶ 开始学习
          </button>
        )}
      </div>

      {addingNew && renderForm(newCard, setNewCard, saveNew, cancelAdd, '✓ 保存新卡片')}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-3">加载卡片中…</p>
        </div>
      ) : cards.length === 0 && !addingNew ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 mb-4">该题库还没有卡片</p>
          <div className="flex gap-3 justify-center">
            <button onClick={startAdd} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">+ 手动添加</button>
            <button onClick={onImport} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">📥 导入文件</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card, i) => (
            <div key={card.id}>
              {editingId === card.id && editDraft ? (
                renderForm(editDraft, setEditDraft, saveEdit, cancelEdit, '✓ 保存修改')
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">{CATEGORY_LABELS[card.category]}</span>
                        {card.cardType && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${TYPE_COLORS[card.cardType]}`}>
                            {CARD_TYPE_LABELS[card.cardType]}
                          </span>
                        )}
                        <span className="text-xs text-yellow-500">{'★'.repeat(card.difficulty)}{'☆'.repeat(5 - card.difficulty)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{card.question}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{card.referenceAnswer.slice(0, 80)}…</p>
                      {card.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {card.keywords.slice(0, 5).map(kw => (
                            <span key={kw} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button onClick={() => startEdit(card)} className="px-2 py-1 text-xs text-blue-500 hover:bg-blue-50 rounded transition-colors">编辑</button>
                      <button onClick={() => handleDelete(card.id)} className="px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded transition-colors">删除</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
