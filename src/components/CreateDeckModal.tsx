import { useState } from 'react'

interface Props {
  onCreate: (name: string, description: string) => Promise<void>
  onClose: () => void
}

export default function CreateDeckModal({ onCreate, onClose }: Props) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      await onCreate(name.trim(), desc.trim())
      onClose()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in">
        <h3 className="text-lg font-semibold text-gray-800">📚 新建题库</h3>
        <div>
          <label className="text-sm font-medium text-gray-600">题库名称 *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="如：口腔解剖学"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1
                       focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600">描述（可选）</label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="简单描述这个题库的内容…"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200">
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium
                       hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? '创建中…' : '创建题库'}
          </button>
        </div>
      </div>
    </div>
  )
}
