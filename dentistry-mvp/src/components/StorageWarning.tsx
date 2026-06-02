import { useState } from 'react'
import type { StorageHealth } from '../utils/db-health'

interface Props {
  health: StorageHealth
}

/**
 * 存储健康警告横幅
 *
 * 在应用顶部展示 IndexedDB 兼容性警告，
 * 用户可关闭（但风险仍然存在）。
 */
export default function StorageWarning({ health }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || health.riskLevel === 'safe') return null

  const isCritical = health.riskLevel === 'critical'

  return (
    <div
      className={`px-4 py-3 text-sm ${
        isCritical
          ? 'bg-red-50 border-b border-red-200 text-red-800'
          : 'bg-amber-50 border-b border-amber-200 text-amber-800'
      }`}
    >
      <div className="max-w-2xl mx-auto flex items-start gap-3">
        {/* 图标 */}
        <span className="text-lg mt-0.5 shrink-0">
          {isCritical ? '🚫' : '📁'}
        </span>

        {/* 内容 */}
        <div className="flex-1 min-w-0 space-y-1">
          {health.warnings.map((w, i) => (
            <p key={i} className="font-medium">{w}</p>
          ))}
          {health.suggestions.length > 0 && (
            <ul className="text-xs opacity-80 space-y-0.5 mt-1">
              {health.suggestions.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          )}
          {!isCritical && (
            <p className="text-xs mt-1 opacity-60">
              浏览器：{health.browser} · 协议：{health.isFileProtocol ? '本地文件' : '网页'}
            </p>
          )}
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={() => setDismissed(true)}
          className={`shrink-0 px-2 py-1 text-xs rounded-lg transition-colors ${
            isCritical
              ? 'text-red-600 hover:bg-red-100'
              : 'text-amber-600 hover:bg-amber-100'
          }`}
          title="关闭提示（风险仍在）"
        >
          知道了
        </button>
      </div>
    </div>
  )
}
