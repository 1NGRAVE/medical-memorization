import { useState, useRef } from 'react'
import { parseDocx } from '../parsers'
import type { ParsedCard, ParseSummary, CardType } from '../types'
import { CARD_TYPE_LABELS } from '../types'
import type { MedqCard, MedqParseResult } from '../types/medq'
import { parseMedqFile } from '../utils/medq'
import CardEditor from './CardEditor'

interface Props {
  deckName: string
  apiKey?: string
  onImport: (cards: ParsedCard[], description?: string) => Promise<void>
  onMedqImport?: (cards: MedqCard[]) => Promise<void>
  onCancel: () => void
}

type Phase = 'upload' | 'parsing' | 'preview' | 'saving'
type ImportMode = 'docx' | 'medq'

/** 题型颜色映射 */
const TYPE_COLORS: Record<CardType, string> = {
  essay: 'bg-purple-100 text-purple-700',
  short_answer: 'bg-blue-100 text-blue-700',
  multiple_choice: 'bg-amber-100 text-amber-700',
  fill_blank: 'bg-green-100 text-green-700',
  true_false: 'bg-rose-100 text-rose-700',
}

export default function ImportPanel({ deckName, apiKey, onImport, onMedqImport, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [cards, setCards] = useState<ParsedCard[]>([])
  const [summary, setSummary] = useState<ParseSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all')
  const [importMode, setImportMode] = useState<ImportMode>('docx')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Medq state ─────
  const [medqCards, setMedqCards] = useState<MedqCard[]>([])
  const [medqParseResult, setMedqParseResult] = useState<MedqParseResult | null>(null)
  const medqFileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && (f.name.endsWith('.docx') || f.name.endsWith('.doc'))) {
      setFile(f)
      setError(null)
    } else {
      setError('请选择 .docx 或 .doc 格式的文件')
    }
  }

  const handleParse = async () => {
    if (!file) return
    setPhase('parsing')
    setError(null)

    try {
      const result = await parseDocx(file, apiKey)
      if (result.cards.length === 0 && result.totalFound === 0) {
        setError('未能从文件中识别出任何题目。请确认文件包含知识内容。')
        setPhase('upload')
        return
      }
      setCards(result.cards)
      setSummary(result)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败')
      setPhase('upload')
    }
  }

  const handleImport = async () => {
    if (cards.length === 0) return
    setPhase('saving')
    try {
      await onImport(cards, summary?.description)
    } catch {
      setError('导入失败，请重试')
      setPhase('preview')
    }
  }

  // ─── Medq handlers ─────

  const handleMedqFile = async (f: File) => {
    setError(null)
    const result = await parseMedqFile(f)
    if (result.success && result.data) {
      setMedqCards(result.data.cards)
      setMedqParseResult(result)
      setPhase('preview')
    } else {
      setError(result.error || '解析失败')
    }
  }

  const handleMedqImport = async () => {
    if (medqCards.length === 0 || !onMedqImport) return
    setPhase('saving')
    try {
      await onMedqImport(medqCards)
    } catch {
      setError('导入失败，请重试')
      setPhase('preview')
    }
  }

  const switchMode = (mode: ImportMode) => {
    setImportMode(mode)
    setPhase('upload')
    setError(null)
    setFile(null)
    setCards([])
    setMedqCards([])
  }

  const updateCard = (index: number, updated: ParsedCard) => {
    setCards(prev => prev.map((c, i) => (i === index ? updated : c)))
  }

  const deleteCard = (index: number) => {
    setCards(prev => prev.filter((_, i) => i !== index))
  }

  // 题型筛选
  const filteredCards = typeFilter === 'all'
    ? cards
    : cards.filter(c => (c.cardType || 'short_answer') === typeFilter)

  // 题型统计
  const typeCounts: Partial<Record<CardType, number>> = {}
  for (const c of cards) {
    const ct = c.cardType || 'short_answer'
    typeCounts[ct] = (typeCounts[ct] || 0) + 1
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">📥 导入题库</h2>
          <p className="text-sm text-gray-500">目标题库：{deckName}</p>
        </div>
        {phase !== 'saving' && (
          <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">返回</button>
        )}
      </div>

      {/* 模式切换 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => switchMode('docx')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            importMode === 'docx' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
          }`}
        >📄 文档解析</button>
        {onMedqImport && (
          <button
            onClick={() => switchMode('medq')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              importMode === 'medq' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >📦 题库导入</button>
        )}
      </div>

      {/* ─── Docx Upload 阶段 ─── */}
      {importMode === 'docx' && phase === 'upload' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
          >
            <div className="text-4xl mb-2">{file ? '📄' : '📂'}</div>
            {file ? (
              <div className="text-sm text-gray-700">
                <p className="font-medium">{file.name}</p>
                <p className="text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <p className="font-medium">点击选择文件</p>
                <p className="text-gray-400 mt-1">支持 .docx / .doc 格式</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <button
            onClick={handleParse}
            disabled={!file}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl
                       hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {apiKey ? '🤖 AI 智能解析' : '🔍 智能解析'}
          </button>
          {!apiKey && (
            <p className="text-xs text-amber-600 text-center bg-amber-50 rounded-lg p-2 mt-2">
              ⚠️ 未配置 DeepSeek API Key，将使用智能模式匹配（支持多种文档格式）。<br/>
              配置 API Key 可获得 AI 增强的章节体文档解析。
            </p>
          )}
          {apiKey && (
            <p className="text-xs text-green-600 text-center bg-green-50 rounded-lg p-2 mt-2">
              🤖 AI 增强模式：智能匹配 + AI 兜底，支持全题型提取
            </p>
          )}
        </div>
      )}

      {/* Parsing 阶段 — docx only */}
      {importMode === 'docx' && phase === 'parsing' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">
            {apiKey ? '🤖 正在智能分析文档…' : '🔍 正在匹配文档格式…'}
          </p>
          <p className="text-xs text-gray-400">支持 【术语：定义】/ 提纲 / 问答 / 编号 / 章节 等格式</p>
        </div>
      )}

      {/* Docx Preview 阶段 */}
      {importMode === 'docx' && phase === 'preview' && (
        <div className="space-y-4">
          {/* 解析摘要 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-gray-600">
                识别到 <strong className="text-green-600">{cards.length}</strong> 道题
                {summary?.strategy && (
                  <span className="text-xs text-gray-400 ml-2">
                    (via {summary.strategy})
                  </span>
                )}
              </span>
            </div>

            {/* 题型统计 */}
            {Object.keys(typeCounts).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(typeCounts).map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(typeFilter === type ? 'all' : type as CardType)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all ${
                      TYPE_COLORS[type as CardType]
                    } ${typeFilter === type ? 'ring-2 ring-blue-400' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {CARD_TYPE_LABELS[type as CardType]} ×{count}
                  </button>
                ))}
                {typeFilter !== 'all' && (
                  <button
                    onClick={() => setTypeFilter('all')}
                    className="text-xs px-2 py-0.5 rounded-full text-gray-400 hover:text-gray-600"
                  >
                    ✕ 清除筛选
                  </button>
                )}
              </div>
            )}

            {/* 去重提示 */}
            {(summary?.duplicatesSkipped ?? 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm">
                ⚠️ 发现 {summary!.duplicatesSkipped} 张重复卡片（已在题库中），导入时将自动跳过。
              </div>
            )}

            {summary?.description && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">📄 文档注释（非题目内容）</summary>
                <p className="mt-2 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{summary.description}</p>
              </details>
            )}

            {cards.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm">
                ⚠️ 未能识别出题目。请确认文档包含知识内容。
              </div>
            )}
          </div>

          {/* 卡片列表（按筛选器） */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {filteredCards.map((card) => {
              const actualIndex = cards.indexOf(card)
              return (
                <CardEditor
                  key={card.tempId}
                  card={card}
                  index={actualIndex}
                  onChange={(updated) => updateCard(actualIndex, updated)}
                  onDelete={() => deleteCard(actualIndex)}
                />
              )
            })}
          </div>

          {/* 导入按钮 */}
          <button
            onClick={handleImport}
            disabled={cards.length === 0}
            className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl
                       hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            ✅ 确认导入 {cards.length} 张卡片
            {typeFilter !== 'all' && `（筛选后 ${filteredCards.length} 张）`}
          </button>
        </div>
      )}

      {/* Docx Saving 阶段 */}
      {importMode === 'docx' && phase === 'saving' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">正在保存卡片…</p>
        </div>
      )}

      {/* ─── Medq Upload 阶段 ─── */}
      {importMode === 'medq' && phase === 'upload' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-4">
          <div
            onClick={() => medqFileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation()
              const f = e.dataTransfer.files[0]
              if (f) handleMedqFile(f)
            }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer
                       hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
          >
            <div className="text-4xl mb-2">📦</div>
            <p className="text-gray-600 font-medium">选择 .medq 题库文件</p>
            <p className="text-sm text-gray-400 mt-1">支持 .medq / .json 格式</p>
            <input
              ref={medqFileRef}
              type="file"
              accept=".medq,.json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleMedqFile(f)
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Medq Preview 阶段 ─── */}
      {importMode === 'medq' && phase === 'preview' && medqParseResult?.data && (
        <div className="space-y-4">
          {/* 警告 */}
          {medqParseResult.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm space-y-0.5">
              {medqParseResult.warnings.map((w, i) => (
                <p key={i}>&#9888; {w}</p>
              ))}
            </div>
          )}

          {/* 统计摘要 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                题库名称：<strong className="text-gray-800">{medqParseResult.data.deck.name}</strong>
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              将导入到当前题库「{deckName}」· 共 <strong className="text-emerald-600">{medqCards.length}</strong> 张卡片
            </p>
          </div>

          {/* 卡片预览列表 */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {medqCards.map((card, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${TYPE_COLORS[card.cardType || 'short_answer']}`}>
                    {CARD_TYPE_LABELS[card.cardType || 'short_answer']}
                  </span>
                  <span className="text-xs text-yellow-500">{'★'.repeat(card.difficulty)}{'☆'.repeat(5 - card.difficulty)}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">{card.question}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{card.referenceAnswer.slice(0, 80)}</p>
              </div>
            ))}
          </div>

          {/* 导入按钮 */}
          <button
            onClick={handleMedqImport}
            disabled={medqCards.length === 0}
            className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl
                       hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            ✅ 确认导入 {medqCards.length} 张卡片到「{deckName}」
          </button>
        </div>
      )}

      {/* ─── Medq Saving 阶段 ─── */}
      {importMode === 'medq' && phase === 'saving' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">正在导入卡片…</p>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
