/**
 * 存储健康检查工具
 *
 * 检测 IndexedDB 在当前浏览器/协议下是否可靠持久化。
 * 核心问题：file:// 协议下不同浏览器对 IndexedDB 的支持差异极大。
 *
 * - Chrome/Edge (file://): 可用但 origin 绑定到完整路径，移动文件夹则数据"丢失"
 * - Firefox (file://): 完全禁止 IndexedDB，数据仅存内存，关闭即丢
 * - Safari (file://): 严格限制，大概率不可用
 *
 * 检测策略：
 * 1. 检测协议和浏览器 → 静态判断风险等级
 * 2. 尝试 IndexedDB 读写 → 运行时验证
 * 3. 跨会话持久化标记 → 第二访问检测（核心）
 */

// ============================================================
// 类型
// ============================================================

export type StorageRiskLevel = 'safe' | 'warning' | 'critical'

export interface StorageHealth {
  /** 整体风险等级 */
  riskLevel: StorageRiskLevel
  /** 协议是否为 file:// */
  isFileProtocol: boolean
  /** 浏览器名称 */
  browser: string
  /** IndexedDB 是否可用（本次会话可读写） */
  indexedDBAvailable: boolean
  /** IndexedDB 是否能跨会话持久化 */
  indexedDBPersistent: boolean | null  // null = 首次访问，尚无法判断
  /** 问题描述（给用户看） */
  warnings: string[]
  /** 建议措施（给用户看） */
  suggestions: string[]
}

// ============================================================
// localStorage 持久化标记键
// ============================================================
const HEALTH_MARKER_KEY = 'dentistry-mvp-health-marker'
const HEALTH_MARKER_VERSION = 1

interface HealthMarker {
  version: number
  firstVisitAt: number   // 首次访问时间戳
  lastVisitAt: number    // 上次访问时间戳
  visitCount: number     // 访问次数
}

// ============================================================
// 浏览器检测
// ============================================================
function detectBrowser(): string {
  const ua = navigator.userAgent
  // Firefox 检测（在 Chrome 检测之前，因为 Firefox UA 也包含 "Chrome" 字样 —
  // 不，实际上 Firefox UA 不包含 Chrome）
  if (ua.includes('Firefox/')) return 'firefox'
  // Edge 检测（新版 Edge 基于 Chromium，UA 包含 "Edg/"）
  if (ua.includes('Edg/')) return 'edge'
  // Chrome 检测
  if (ua.includes('Chrome/')) return 'chrome'
  // Safari 检测（在 Chrome 之后，因为 Chrome UA 也包含 "Safari"）
  if (ua.includes('Safari/')) return 'safari'
  return 'unknown'
}

// ============================================================
// 协议检测
// ============================================================
function isFileProtocol(): boolean {
  return window.location.protocol === 'file:'
}

// ============================================================
// IndexedDB 运行时测试
// ============================================================
async function testIndexedDBReadWrite(): Promise<boolean> {
  try {
    // 检查 API 是否存在
    if (!window.indexedDB) return false

    // 尝试打开测试数据库
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('__dentistry_health_test__', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('test', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('blocked'))
    })

    // 尝试写入
    const testData = { id: 'health', value: Date.now() }
    await new Promise<void>((resolve, reject) => {
      const txn = db.transaction('test', 'readwrite')
      txn.objectStore('test').put(testData)
      txn.oncomplete = () => resolve()
      txn.onerror = () => reject(txn.error)
      txn.onabort = () => reject(new Error('aborted'))
    })

    // 尝试读取
    const readBack = await new Promise<{ id: string; value: number } | undefined>((resolve, reject) => {
      const txn = db.transaction('test', 'readonly')
      const req = txn.objectStore('test').get('health')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    // 清理
    db.close()
    // 尝试删除测试数据库（异步，不等待结果）
    try { indexedDB.deleteDatabase('__dentistry_health_test__') } catch { /* */ }

    return readBack?.value === testData.value
  } catch {
    return false
  }
}

// ============================================================
// 跨会话持久化标记
// ============================================================

function readHealthMarker(): HealthMarker | null {
  try {
    const raw = localStorage.getItem(HEALTH_MARKER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.version !== HEALTH_MARKER_VERSION) return null
    return parsed as HealthMarker
  } catch {
    return null
  }
}

function writeHealthMarker(marker: HealthMarker): void {
  try {
    localStorage.setItem(HEALTH_MARKER_KEY, JSON.stringify(marker))
  } catch { /* 忽略 */ }
}

// ============================================================
// 主检测函数
// ============================================================
export async function checkStorageHealth(): Promise<StorageHealth> {
  const fileProto = isFileProtocol()
  const browser = detectBrowser()
  const warnings: string[] = []
  const suggestions: string[] = []

  // 测试 IndexedDB 运行时可用性
  const indexedDBAvailable = await testIndexedDBReadWrite()

  // ----------------------------
  // 静态风险判断：协议 + 浏览器
  // ----------------------------
  let riskLevel: StorageRiskLevel = 'safe'
  let indexedDBPersistent: boolean | null = null

  if (!fileProto) {
    // http(s):// 协议 — IndexedDB 可靠
    indexedDBPersistent = true
  } else if (!indexedDBAvailable) {
    // file:// + IndexedDB 不可用 → 最严重
    riskLevel = 'critical'
    indexedDBPersistent = false
  } else {
    // file:// + IndexedDB 可用 → 需要细分浏览器
    switch (browser) {
      case 'firefox':
        // Firefox 严格禁止 file:// IndexedDB 持久化
        riskLevel = 'critical'
        indexedDBPersistent = false
        break
      case 'safari':
        // Safari 对 file:// IndexedDB 限制严格
        riskLevel = 'critical'
        indexedDBPersistent = false
        break
      case 'chrome':
      case 'edge':
        // Chrome/Edge 支持 file:// IndexedDB，但路径绑定
        riskLevel = 'warning'
        // 通过跨会话标记判断是否真的能持久化
        indexedDBPersistent = null  // 首次访问未知
        break
      default:
        riskLevel = 'warning'
        indexedDBPersistent = null
    }
  }

  // ----------------------------
  // 跨会话持久化验证
  // ----------------------------
  const prevMarker = readHealthMarker()
  const now = Date.now()

  if (prevMarker) {
    // 不是首次访问 — 可以验证持久化
    if (riskLevel === 'warning') {
      // 对有风险的浏览器，检查上次的 IndexedDB 数据是否还在
      // 通过 Dexie 的数据库检查（是否存在 decks 表且有数据）
      const dataPersisted = await checkAppDataExists()
      if (dataPersisted) {
        indexedDBPersistent = true
        riskLevel = 'safe'  // 降级为安全 — 实际可用
      } else if (prevMarker.visitCount >= 1) {
        // 上次访问过但数据没了 → 确认数据丢失
        indexedDBPersistent = false
        riskLevel = 'critical'
      }
    }

    // 更新标记
    writeHealthMarker({
      ...prevMarker,
      lastVisitAt: now,
      visitCount: prevMarker.visitCount + 1,
    })
  } else {
    // 首次访问 — 写入标记
    writeHealthMarker({
      version: HEALTH_MARKER_VERSION,
      firstVisitAt: now,
      lastVisitAt: now,
      visitCount: 1,
    })
  }

  // ----------------------------
  // 生成用户提示
  // ----------------------------
  switch (riskLevel) {
    case 'critical':
      warnings.push('⚠️ 当前浏览器环境不支持题库数据持久化存储')
      warnings.push('关闭页面后，所有题库和学习进度将丢失！')
      if (indexedDBAvailable) {
        warnings.push('（数据在本次使用期间可用，但无法保存到下次打开）')
      }
      if (browser === 'firefox') {
        suggestions.push('请使用 Chrome 或 Edge 浏览器打开此文件')
        suggestions.push('Firefox 不支持本地文件的数据持久化')
      } else if (browser === 'safari') {
        suggestions.push('请使用 Chrome 或 Edge 浏览器打开此文件')
        suggestions.push('Safari 对本地文件的数据存储限制严格')
      } else {
        suggestions.push('请使用 Chrome 或 Edge 浏览器打开此文件')
      }
      suggestions.push('关闭前务必导出题库（.medq 文件）作为备份')
      break

    case 'warning':
      warnings.push('📁 当前以本地文件方式运行，数据与文件夹路径绑定')
      warnings.push('移动或重命名文件夹会导致已有题库"丢失"（数据仍在浏览器中，但关联到旧路径）')
      suggestions.push('将文件夹放到固定位置后使用，不要移动')
      suggestions.push('建议定期导出 .medq 文件作为备份')
      suggestions.push('推荐使用桌面版应用（Tauri），无需担心此问题')
      break

    case 'safe':
      // 一切正常，无需提示
      break
  }

  return {
    riskLevel,
    isFileProtocol: fileProto,
    browser,
    indexedDBAvailable,
    indexedDBPersistent,
    warnings,
    suggestions,
  }
}

/**
 * 检查应用数据是否存在于 IndexedDB 中
 * 通过 Dexie 的数据库实例检查
 */
async function checkAppDataExists(): Promise<boolean> {
  try {
    const { db } = await import('../db')
    const deckCount = await db.decks.count()
    // 如果有用户创建的题库（非内置题库），说明数据持久化了
    // 内置题库会在首次启动时自动创建，所以 deckCount > 2 说明用户有数据
    // 或者直接检查是否有任何 deck 存在
    return deckCount > 0
  } catch {
    return false
  }
}

/**
 * 检查是否为真正的首次使用（没有任何题库数据）
 * 用于判断是否需要显示初始化引导而非数据丢失警告
 */
export async function isFirstTimeUser(): Promise<boolean> {
  try {
    const { db } = await import('../db')
    const deckCount = await db.decks.count()
    return deckCount === 0
  } catch {
    return true
  }
}
