import { useState, useRef } from 'react'
import { parseMedqFile } from '../utils/medq'
import type { MedqCard, MedqParseResult } from '../types/medq'

interface Props {
  onImport: (deckName: string, description: string, cards: MedqCard[]) => Promise<void>
  onClose: () => void
}

type Phase = 'select' | 'preview' | 'importing'

export default function MedqImportModal({ onImport, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('select')
  const [parseResult, setParseResult] = useState<MedqParseResult | null>(null)
  const [deckName, setDeckName] = useState('')
  const [deckDesc, setDeckDesc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    setError(null)
    const result = await parseMedqFile(file)
    if (result.success && result.data) {
      setParseResult(result)
      setDeckName(result.data.deck.name)
      setDeckDesc(result.data.deck.description)
      setPhase('preview')
    } else {
      setError(result.error || '解析失败')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleImport = async () => {
    if (!parseResult?.data || phase !== 'preview') return
    setPhase('importing')
    try {
      await onImport(deckName.trim(), deckDesc.trim(), parseResult.data.cards)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败，请重试')
      setPhase('preview')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold text-gray-800">📦 导入题库文件</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* ── Phase: select ── */}
          {phase === 'select' && (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
              >
                <div className="text-4xl mb-3">📦</div>
                <p className="text-gray-600 font-medium">选择 .medq 题库文件</p>
                <p className="text-sm text-gray-400 mt-1">点击选择或拖拽文件到此处</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".medq,.json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                />
              </div>
            </>
          )}

          {/* ── Phase: preview ── */}
          {phase === 'preview' && parseResult?.data && (
            <>
              {parseResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm space-y-0.5">
                  {parseResult.warnings.map((w, i) => (
                    <p key={i}>&#9888; {w}</p>
                  ))}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-600">题库名称</label>
                <input
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">描述</label>
                <textarea
                  value={deckDesc}
                  onChange={e => setDeckDesc(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    共 {parseResult.data.cards.length} 张卡片
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {parseResult.data.cards.slice(0, 10).map((card, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-100 p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400 font-mono">#{i + 1}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_COLORS[card.cardType || 'short_answer']}`}>
                          {CARD_TYPE_NAMES[card.cardType || 'short_answer']}
                        </span>
                        <span className="text-yellow-500">{'★'.repeat(card.difficulty)}</span>
                      </div>
                      <p className="text-gray-700 truncate">{card.question}</p>
                    </div>
                  ))}
                  {parseResult.data.cards.length > 10 && (
                    <p className="text-center text-xs text-gray-400 pt-1">
                      ...还有 {parseResult.data.cards.length - 10} 张卡片未展示
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}
            </>
          )}

          {/* ── Phase: importing ── */}
          {phase === 'importing' && (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">正在创建题库并导入卡片...</p>
              <p className="text-sm text-gray-400 mt-1">请稍候</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'preview' && (
          <div className="flex gap-2 p-5 pt-0 border-t mt-2">
            <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={!deckName.trim()}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              确认导入
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const TYPE_COLORS: Record<string, string> = {
  essay: 'bg-purple-100 text-purple-700',
  short_answer: 'bg-blue-100 text-blue-700',
  multiple_choice: 'bg-amber-100 text-amber-700',
  fill_blank: 'bg-green-100 text-green-700',
  true_false: 'bg-rose-100 text-rose-700',
}

const CARD_TYPE_NAMES: Record<string, string> = {
  essay: '论述',
  short_answer: '简答',
  multiple_choice: '选择',
  fill_blank: '填空',
  true_false: '判断',
}
