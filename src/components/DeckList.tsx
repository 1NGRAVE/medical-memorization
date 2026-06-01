import type { Deck, DeckStats } from '../types'
import { BUILTIN_DECK_ID, ERROR_DECK_ID } from '../types'

interface DeckDisplay extends Deck {
  stats?: DeckStats
}

interface Props {
  decks: DeckDisplay[]
  onSelectDeck: (deckId: string) => void
  onManageDeck: (deckId: string) => void
  onCreateDeck: () => void
  onDeleteDeck: (deckId: string) => void
}

export default function DeckList({ decks, onSelectDeck, onManageDeck, onCreateDeck, onDeleteDeck }: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">📚 题库列表</h2>
          <p className="text-sm text-gray-500">{decks.length} 个题库</p>
        </div>
        <button
          onClick={onCreateDeck}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl
                     hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          + 新建题库
        </button>
      </div>

      <div className="space-y-3">
        {decks.map(deck => (
          <div
            key={deck.id}
            onClick={() => onSelectDeck(deck.id)}
            className={`bg-white rounded-2xl shadow-sm border p-5 transition-all cursor-pointer ${
              deck.id === ERROR_DECK_ID
                ? 'border-rose-200 bg-rose-50/30 hover:shadow-md hover:border-rose-300'
                : 'border-gray-100 hover:shadow-md hover:border-blue-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">
                    {deck.id === ERROR_DECK_ID ? '📝' : deck.source === 'builtin' ? '🦷' : '📁'} {deck.name}
                  </h3>
                  {deck.id === ERROR_DECK_ID ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs rounded-full">错题</span>
                  ) : deck.source === 'builtin' && deck.id === BUILTIN_DECK_ID ? (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">内置</span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-500 mt-1">{deck.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onManageDeck(deck.id)
                  }}
                  className="text-gray-400 hover:text-blue-500 text-sm px-2 py-1 transition-colors"
                >
                  管理
                </button>
                {deck.source === 'user' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`确定删除题库"${deck.name}"？\n其中的所有卡片和学习记录也会被删除。`)) {
                        onDeleteDeck(deck.id)
                      }
                    }}
                    className="text-gray-300 hover:text-red-500 text-sm px-2 py-1 transition-colors"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>

            {/* 统计 */}
            {deck.stats && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-50">
                <div className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{deck.cardCount}</span> 张卡片
                </div>
                {deck.stats.studiedCards > 0 ? (
                  <>
                    <div className="text-xs text-gray-500">
                      已学 <span className="font-medium text-blue-600">{deck.stats.studiedCards}</span> 张
                    </div>
                    <div className="text-xs text-gray-500">
                      均分 <span className="font-medium text-green-600">{deck.stats.avgScore}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      通过率 <span className="font-medium text-purple-600">{deck.stats.passRate}%</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">尚未开始学习</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {decks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>还没有题库，点击上方按钮创建第一个</p>
        </div>
      )}
    </div>
  )
}
