import { useState, useEffect } from 'react'

export type ProviderType = 'mock' | 'gemini'

interface Props {
  providerType: ProviderType
  geminiApiKey: string
  onProviderChange: (provider: ProviderType) => void
  onApiKeyChange: (key: string) => void
  onTestConnection: () => Promise<boolean>
  onClose: () => void
}

export default function ModelConfig({
  providerType,
  geminiApiKey,
  onProviderChange,
  onApiKeyChange,
  onTestConnection,
  onClose,
}: Props) {
  const [keyInput, setKeyInput] = useState(geminiApiKey)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)

  useEffect(() => {
    setKeyInput(geminiApiKey)
  }, [geminiApiKey])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    // 先保存 key
    onApiKeyChange(keyInput.trim())
    // 稍等一下让状态更新
    await new Promise(r => setTimeout(r, 100))
    const ok = await onTestConnection()
    setTestResult(ok ? 'success' : 'fail')
    setTesting(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">⚙️ AI 模型配置</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ✕
        </button>
      </div>

      {/* Provider 选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">选择判分模型</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onProviderChange('mock')}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              providerType === 'mock'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-sm font-medium text-gray-800">🖥️ 本地匹配</div>
            <div className="text-xs text-gray-400 mt-0.5">免费 · 离线 · 关键词判定</div>
          </button>
          <button
            onClick={() => onProviderChange('gemini')}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              providerType === 'gemini'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-sm font-medium text-gray-800">🤖 Gemini AI</div>
            <div className="text-xs text-gray-400 mt-0.5">免费额度 · 语义理解 · 需联网</div>
          </button>
        </div>
      </div>

      {/* Gemini API Key */}
      {providerType === 'gemini' && (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Gemini API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="输入你的 Gemini API Key"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              onClick={handleTest}
              disabled={!keyInput.trim() || testing}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg
                         hover:bg-gray-200 disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {testing ? '测试中…' : '🔍 测试连接'}
            </button>
          </div>
          {testResult === 'success' && (
            <p className="text-xs text-green-600 mt-1">✅ 连接成功！Gemini API 可用</p>
          )}
          {testResult === 'fail' && (
            <p className="text-xs text-red-500 mt-1">
              ❌ 连接失败。请检查 API Key 是否正确，以及网络是否可访问 Google 服务。
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            获取免费 API Key：
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline ml-1"
            >
              aistudio.google.com/apikey
            </a>
          </p>
        </div>
      )}

      {/* 当前状态 */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
        <p>当前模式：<span className="font-medium text-gray-700">{providerType === 'mock' ? '本地关键词匹配' : 'Gemini 2.5 Flash'}</span></p>
        <p>是否需要网络：{providerType === 'mock' ? '否（离线可用）' : '是'}</p>
        <p>是否需要 API Key：{providerType === 'mock' ? '否' : '是（免费注册）'}</p>
      </div>
    </div>
  )
}
