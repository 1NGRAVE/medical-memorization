import { useState, useRef } from 'react'
import { parseDocx } from '../parsers'
import type { ParsedCard, ParseSummary } from '../types'
import CardEditor from './CardEditor'

interface Props {
  deckName: string
  apiKey?: string
  onImport: (cards: ParsedCard[], description?: string) => Promise<void>
  onCancel: () => void
}

type Phase = 'upload' | 'parsing' | 'preview' | 'saving'

export default function ImportPanel({ deckName, apiKey, onImport, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [cards, setCards] = useState<ParsedCard[]>([])
  const [summary, setSummary] = useState<ParseSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setError('未能从文件中识别出任何题目。请确认文件包含问答格式的内容。')
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

  const updateCard = (index: number, updated: ParsedCard) => {
    setCards(prev => prev.map((c, i) => (i === index ? updated : c)))
  }

  const deleteCard = (index: number) => {
    setCards(prev => prev.filter((_, i) => i !== index))
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

      {/* Upload 阶段 */}
      {phase === 'upload' && (
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
            {apiKey ? '🤖 AI 智能解析' : '🔍 开始解析'}
          </button>
          {!apiKey && (
            <p className="text-xs text-amber-600 text-center bg-amber-50 rounded-lg p-2 mt-2">
              ⚠️ 未配置 DeepSeek API Key，将使用基础段落拆分（无法智能出题）。<br/>
              建议配置 API Key 获得 AI 智能出题：自动将知识点转化为论述题。
            </p>
          )}
          {apiKey && (
            <p className="text-xs text-green-600 text-center bg-green-50 rounded-lg p-2 mt-2">
              🤖 AI 智能出题模式：将自动识别知识点并转化为论述题
            </p>
          )}
        </div>
      )}

      {/* Parsing 阶段 */}
      {phase === 'parsing' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">
            {apiKey ? '🤖 AI 正在分析文档…' : '🔍 正在解析文档…'}
          </p>
          <p className="text-xs text-gray-400">这可能需要几秒到几十秒</p>
        </div>
      )}

      {/* Preview 阶段 */}
      {phase === 'preview' && (
        <div className="space-y-4">
          {/* 解析摘要 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                识别到 <strong>{summary?.totalFound || cards.length}</strong> 道题，
                导入 <strong className="text-green-600">{cards.length}</strong> 道论述题
              </span>
              {summary && summary.filteredTypes.length > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  已过滤：{summary.filteredTypes.join('、')}
                </span>
              )}
            </div>
            {summary?.description && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">📄 文档注释（非题目内容）</summary>
                <p className="mt-2 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{summary.description}</p>
              </details>
            )}
            {cards.length === 0 && summary && summary.totalFound > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm">
                ⚠️ 文档中未发现论述题。发现 {summary.totalFound} 道题均为 {summary.filteredTypes.join('、')} 等题型，已被过滤。当前版本仅支持论述题导入。
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {cards.map((card, i) => (
              <CardEditor
                key={card.tempId}
                card={card}
                index={i}
                onChange={(updated) => updateCard(i, updated)}
                onDelete={() => deleteCard(i)}
              />
            ))}
          </div>

          <button
            onClick={handleImport}
            disabled={cards.length === 0}
            className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl
                       hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            ✅ 确认导入 {cards.length} 张卡片
          </button>
        </div>
      )}

      {/* Saving 阶段 */}
      {phase === 'saving' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 font-medium">正在保存卡片…</p>
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
