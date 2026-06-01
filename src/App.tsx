import { useState, useMemo, useCallback } from 'react'
import { dentistryCards } from './data/dentistry-cards'
import { mockProvider } from './providers/mock-provider'
import { createGeminiProvider } from './providers/gemini-provider'
import StudyCard from './components/StudyCard'
import ModelConfig from './components/ModelConfig'
import type { ProviderType } from './components/ModelConfig'
import type { JudgeResult, StudyResult, JudgeProvider } from './types'
import { CATEGORY_LABELS } from './types'

// 从 localStorage 恢复设置
function loadSettings(): { providerType: ProviderType; apiKey: string } {
  try {
    const raw = localStorage.getItem('dentistry-mvp-settings')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { providerType: 'mock', apiKey: '' }
}

function saveSettings(providerType: ProviderType, apiKey: string) {
  localStorage.setItem('dentistry-mvp-settings', JSON.stringify({ providerType, apiKey }))
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [showConfig, setShowConfig] = useState(false)

  // 当前会话状态
  const [session, setSession] = useState(() => ({
    currentCardIndex: 0,
    cards: [...dentistryCards],
    results: [] as StudyResult[],
    isComplete: false,
  }))

  // 当前卡片
  const currentCard = session.cards[session.currentCardIndex] || null

  // 构建 Provider（Gemini 需要 API key）
  const provider: JudgeProvider = useMemo(() => {
    if (settings.providerType === 'gemini' && settings.apiKey) {
      return createGeminiProvider(settings.apiKey)
    }
    return mockProvider
  }, [settings.providerType, settings.apiKey])

  // 处理评判完成
  const handleJudged = useCallback((result: JudgeResult, studentAnswer: string) => {
    if (!currentCard) return
    setSession(prev => ({
      ...prev,
      results: [...prev.results, {
        cardId: currentCard.id,
        studentAnswer,
        judgeResult: result,
        timestamp: Date.now(),
      }],
    }))
  }, [currentCard])

  // 处理下一题
  const handleNext = useCallback(() => {
    setSession(prev => {
      const nextIndex = prev.currentCardIndex + 1
      if (nextIndex >= prev.cards.length) {
        return { ...prev, isComplete: true }
      }
      return { ...prev, currentCardIndex: nextIndex }
    })
  }, [])

  // 重新开始
  const handleRestart = useCallback(() => {
    setSession({
      currentCardIndex: 0,
      cards: [...dentistryCards],
      results: [],
      isComplete: false,
    })
  }, [])

  // 随机打乱
  const handleShuffle = useCallback(() => {
    const shuffled = [...dentistryCards].sort(() => Math.random() - 0.5)
    setSession({
      currentCardIndex: 0,
      cards: shuffled,
      results: [],
      isComplete: false,
    })
  }, [])

  // 切换 Provider
  const handleProviderChange = useCallback((type: ProviderType) => {
    setSettings(prev => {
      const next = { ...prev, providerType: type }
      saveSettings(type, next.apiKey)
      return next
    })
  }, [])

  // 切换 API Key
  const handleApiKeyChange = useCallback((key: string) => {
    setSettings(prev => {
      const next = { ...prev, apiKey: key }
      saveSettings(next.providerType, key)
      return next
    })
  }, [])

  // 测试连接
  const handleTestConnection = useCallback(async (): Promise<boolean> => {
    if (settings.providerType === 'gemini' && settings.apiKey) {
      const geminiProvider = createGeminiProvider(settings.apiKey)
      return geminiProvider.testConnection(settings.apiKey)
    }
    return true
  }, [settings.providerType, settings.apiKey])

  // 统计
  const avgScore = session.results.length > 0
    ? (session.results.reduce((s, r) => s + r.judgeResult.score, 0) / session.results.length).toFixed(1)
    : null
  const passRate = session.results.length > 0
    ? Math.round((session.results.filter(r => r.judgeResult.isPass).length / session.results.length) * 100)
    : null

  // 完成页面
  if (session.isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800">学习完成！</h1>
          <p className="text-gray-500">
            你已完成本轮全部 {session.cards.length} 张卡片的学习
          </p>

          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600">{session.results.length}</div>
              <div className="text-xs text-gray-500 mt-1">答题总数</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-600">{avgScore ?? '-'}</div>
              <div className="text-xs text-gray-500 mt-1">平均分</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-600">{passRate ?? '-'}%</div>
              <div className="text-xs text-gray-500 mt-1">通过率</div>
            </div>
          </div>

          {/* 答题详情 */}
          <div className="text-left space-y-2 max-h-60 overflow-y-auto">
            {session.results.map((r, i) => {
              const card = session.cards.find(c => c.id === r.cardId)
              return (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {card?.question.slice(0, 30)}…
                  </span>
                  <span className={`text-sm font-bold ml-2 ${
                    r.judgeResult.isPass ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {r.judgeResult.score}/5
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl
                         hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              重新开始（相同顺序）
            </button>
            <button
              onClick={handleShuffle}
              className="flex-1 py-3 bg-purple-600 text-white font-medium rounded-xl
                         hover:bg-purple-700 active:scale-[0.98] transition-all"
            >
              随机打乱再来一轮
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 主学习页面
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* 顶部导航 */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">🦷 牙科知识 AI 问答</h1>
            {currentCard && (
              <p className="text-xs text-gray-400">
                {CATEGORY_LABELS[currentCard.category]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShuffle}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg
                         hover:bg-gray-200 transition-all"
            >
              🔀 随机
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                showConfig
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ⚙️ 模型
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 配置面板 */}
        {showConfig && (
          <div className="mb-6">
            <ModelConfig
              providerType={settings.providerType}
              geminiApiKey={settings.apiKey}
              onProviderChange={handleProviderChange}
              onApiKeyChange={handleApiKeyChange}
              onTestConnection={handleTestConnection}
              onClose={() => setShowConfig(false)}
            />
          </div>
        )}

        {/* 实时统计条 */}
        {session.results.length > 0 && (
          <div className="flex gap-3 mb-6">
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">平均分</span>
              <span className="text-sm font-bold text-blue-600">{avgScore}</span>
            </div>
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">通过率</span>
              <span className="text-sm font-bold text-green-600">{passRate}%</span>
            </div>
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">当前模式</span>
              <span className="text-xs font-medium text-gray-700">
                {settings.providerType === 'mock' ? '本地' : 'Gemini'}
              </span>
            </div>
          </div>
        )}

        {/* 学习卡片 */}
        {currentCard && (
          <StudyCard
            key={`${currentCard.id}-${session.currentCardIndex}`}
            card={currentCard}
            provider={provider}
            cardIndex={session.currentCardIndex}
            totalCards={session.cards.length}
            onJudged={handleJudged}
            onNext={handleNext}
          />
        )}
      </main>

      {/* 底部说明 */}
      <footer className="text-center py-6 text-xs text-gray-400">
        牙科知识 AI 问答 MVP · 使用 {settings.providerType === 'mock' ? '本地关键词匹配' : 'Gemini AI'} 判分
      </footer>
    </div>
  )
}
