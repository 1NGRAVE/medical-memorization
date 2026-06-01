import { useState, useEffect } from 'react'

export type ProviderType = 'mock' | 'deepseek' | 'gemini'

interface Props {
  providerType: ProviderType
  apiKeys: Record<string, string>
  enableSearch: boolean
  onProviderChange: (provider: ProviderType) => void
  onApiKeyChange: (provider: string, key: string) => void
  onSearchToggle: (enabled: boolean) => void
  onTestConnection: () => Promise<boolean>
  onClose: () => void
}

export default function ModelConfig({
  providerType,
  apiKeys,
  enableSearch,
  onProviderChange,
  onApiKeyChange,
  onSearchToggle,
  onTestConnection,
  onClose,
}: Props) {
  const [keyInput, setKeyInput] = useState(apiKeys[providerType] || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)

  useEffect(() => {
    setKeyInput(apiKeys[providerType] || '')
    setTestResult(null)
  }, [providerType, apiKeys])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    onApiKeyChange(providerType, keyInput.trim())
    await new Promise(r => setTimeout(r, 200))
    const ok = await onTestConnection()
    setTestResult(ok ? 'success' : 'fail')
    setTesting(false)
  }

  const providerInfo: Record<ProviderType, { icon: string; name: string; desc: string; keyLabel: string; keyUrl: string; keyUrlText: string }> = {
    mock: {
      icon: '🖥️', name: '本地匹配', desc: '免费 · 离线 · 关键词',
      keyLabel: '', keyUrl: '', keyUrlText: '',
    },
    deepseek: {
      icon: '🇨🇳', name: 'DeepSeek', desc: '国内直连 · ¥1/百万token',
      keyLabel: 'DeepSeek API Key',
      keyUrl: 'https://platform.deepseek.com/api_keys',
      keyUrlText: 'platform.deepseek.com → API Keys',
    },
    gemini: {
      icon: '🤖', name: 'Gemini', desc: '免费额度 · 需翻墙',
      keyLabel: 'Gemini API Key',
      keyUrl: 'https://aistudio.google.com/apikey',
      keyUrlText: 'aistudio.google.com/apikey',
    },
  }

  const info = providerInfo[providerType]

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">⚙️ AI 模型配置</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>

      {/* Provider 选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-2">选择判分模型</label>
        <div className="grid grid-cols-3 gap-2">
          {(['mock', 'deepseek', 'gemini'] as ProviderType[]).map(type => {
            const p = providerInfo[type]
            return (
              <button
                key={type}
                onClick={() => onProviderChange(type)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  providerType === type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium text-gray-800">{p.icon} {p.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* API Key（非 mock 模式） */}
      {providerType !== 'mock' && (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">{info.keyLabel}</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onBlur={() => onApiKeyChange(providerType, keyInput.trim())}
              placeholder={`输入你的 ${info.keyLabel}`}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
                         focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              onClick={handleTest}
              disabled={!keyInput.trim() || testing}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg
                         hover:bg-gray-200 disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {testing ? '测试中…' : '🔍 测试'}
            </button>
          </div>
          {testResult === 'success' && (
            <p className="text-xs text-green-600 mt-1">✅ 连接成功！</p>
          )}
          {testResult === 'fail' && (
            <p className="text-xs text-red-500 mt-1">❌ 连接失败，请检查 API Key 和网络。</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            获取 Key：<a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{info.keyUrlText}</a>
          </p>
        </div>
      )}

      {/* 联网搜索开关（仅 DeepSeek） */}
      {providerType === 'deepseek' && (
        <div className="flex items-center justify-between bg-amber-50 rounded-xl p-4">
          <div>
            <div className="text-sm font-medium text-gray-800">🌐 联网搜索增强</div>
            <div className="text-xs text-gray-500 mt-0.5">判分前搜索最新医学资料辅助验证（约+2秒）</div>
          </div>
          <button
            onClick={() => onSearchToggle(!enableSearch)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              enableSearch ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              enableSearch ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      )}

      {/* 当前状态 */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
        <p>当前模式：<span className="font-medium text-gray-700">{info.name}</span></p>
        <p>网络需求：{providerType === 'mock' ? '否（离线可用）' : '是'}</p>
        <p>API Key：{providerType === 'mock' ? '不需要' : (apiKeys[providerType] ? '已配置 ✅' : '未配置 ⚠️')}</p>
        {providerType === 'deepseek' && (
          <p>联网搜索：{enableSearch ? '已开启 🌐' : '已关闭'}</p>
        )}
      </div>
    </div>
  )
}
