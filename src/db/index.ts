/**
 * IndexedDB 数据库层（Dexie.js）
 *
 * 三张表：
 * - decks: 题库元数据
 * - userCards: 用户导入/创建的卡片
 * - studyRecords: 学习记录
 *
 * 所有题库均由用户创建，无内置题库。
 */

import Dexie, { type Table } from 'dexie'
import type { Deck, StudyRecord } from '../types'
import type { DentalCard } from '../types'
import { BUILTIN_DECK_ID, ERROR_DECK_ID } from '../types'

// ============================================================
// 数据库 Schema
// ============================================================
class DentistryDB extends Dexie {
  decks!: Table<Deck, string>
  userCards!: Table<DentalCard & { createdAt: number }, string>
  studyRecords!: Table<StudyRecord, number>

  constructor() {
    super('DentistryMVP')

    // v1 初始版本（已废弃）
    this.version(1).stores({
      decks: 'id',
      userCards: 'id',
      studyRecords: '++id',
    })

    // v2：修正索引字段
    this.version(2).stores({
      decks: 'id, source, createdAt',
      userCards: 'id, deckId, source, createdAt',
      studyRecords: '++id, cardId, deckId, timestamp, [deckId+cardId]',
    })
  }
}

const db = new DentistryDB()

// ============================================================
// 题库 CRUD
// ============================================================

/** 获取所有题库 */
export async function getAllDecks(): Promise<Deck[]> {
  return db.decks.orderBy('createdAt').toArray()
}

/** 创建用户题库 */
export async function createDeck(name: string, description: string): Promise<Deck> {
  const deck: Deck = {
    id: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    cardCount: 0,
    source: 'user',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.decks.put(deck)
  return deck
}

/** 删除题库及其所有卡片和学习记录 */
export async function deleteDeck(deckId: string): Promise<void> {
  await db.decks.delete(deckId)
  await db.userCards.where('deckId').equals(deckId).delete()
  await db.studyRecords.where('deckId').equals(deckId).delete()
}

/** 更新题库名称/描述 */
export async function updateDeckMeta(
  deckId: string,
  fields: { name?: string; description?: string }
): Promise<void> {
  const deck = await db.decks.get(deckId)
  if (!deck) return
  await db.decks.update(deckId, {
    ...fields,
    updatedAt: Date.now(),
  })
}

// ============================================================
// 卡片 CRUD
// ============================================================

/** 获取题库的所有卡片 */
export async function getCardsByDeck(deckId: string): Promise<DentalCard[]> {
  return db.userCards.where('deckId').equals(deckId).toArray()
}

/** 批量导入卡片到题库，支持去重 */
export async function addCardsToDeck(
  deckId: string,
  cards: DentalCard[],
  options?: { skipDuplicates?: boolean }
): Promise<{ added: number; skipped: number }> {
  let toAdd = cards
  let skipped = 0

  if (options?.skipDuplicates) {
    const existing = await db.userCards.where('deckId').equals(deckId).toArray()
    const existingQuestions = new Set(
      existing.map(c => c.question.replace(/\s+/g, '').toLowerCase())
    )
    const unique: DentalCard[] = []
    for (const card of cards) {
      const normalized = card.question.replace(/\s+/g, '').toLowerCase()
      if (existingQuestions.has(normalized)) {
        skipped++
      } else {
        existingQuestions.add(normalized)
        unique.push(card)
      }
    }
    toAdd = unique
  }

  const now = Date.now()
  const cardsWithMeta = toAdd.map(c => ({
    ...c,
    deckId,
    source: 'user' as const,
    createdAt: now,
  }))
  await db.userCards.bulkPut(cardsWithMeta)

  // 更新题库卡片数量
  const count = await db.userCards.where('deckId').equals(deckId).count()
  await db.decks.update(deckId, { cardCount: count, updatedAt: now })

  return { added: toAdd.length, skipped }
}

/** 删除单张卡片 */
export async function removeCardFromDeck(cardId: string): Promise<void> {
  const card = await db.userCards.get(cardId)
  await db.userCards.delete(cardId)
  if (card) {
    const count = await db.userCards.where('deckId').equals(card.deckId!).count()
    await db.decks.update(card.deckId!, { cardCount: count, updatedAt: Date.now() })
  }
}

/** 更新单张卡片 */
export async function updateCard(
  cardId: string,
  fields: Partial<DentalCard>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.userCards.update(cardId, fields as any)
}

// ============================================================
// 学习记录
// ============================================================

/** 保存学习记录 */
export async function saveStudyRecord(record: StudyRecord): Promise<void> {
  await db.studyRecords.put(record)
}

/** 获取题库的所有学习记录 */
export async function getStudyRecordsByDeck(deckId: string): Promise<StudyRecord[]> {
  return db.studyRecords.where('deckId').equals(deckId).toArray()
}

/** 获取题库学习统计 */
export async function getDeckStats(deckId: string): Promise<{
  totalCards: number
  studiedCards: number
  avgScore: number
  passRate: number
  lastStudied: number | null
}> {
  const records = await db.studyRecords
    .where('deckId')
    .equals(deckId)
    .toArray()

  // 按 cardId 去重，取最新记录
  const latestByCard = new Map<string, StudyRecord>()
  for (const r of records) {
    const existing = latestByCard.get(r.cardId)
    if (!existing || r.timestamp > existing.timestamp) {
      latestByCard.set(r.cardId, r)
    }
  }

  const latest = [...latestByCard.values()]
  const totalCards = (await db.decks.get(deckId))?.cardCount || 0
  const studiedCards = latest.length
  const avgScore = studiedCards > 0
    ? Math.round((latest.reduce((s, r) => s + r.score, 0) / studiedCards) * 10) / 10
    : 0
  const passRate = studiedCards > 0
    ? Math.round((latest.filter(r => r.isPass).length / studiedCards) * 100)
    : 0
  const lastStudied = studiedCards > 0
    ? Math.max(...latest.map(r => r.timestamp))
    : null

  return { totalCards, studiedCards, avgScore, passRate, lastStudied }
}

/** 清除题库的学习进度 */
export async function clearStudyRecords(deckId: string): Promise<void> {
  await db.studyRecords.where('deckId').equals(deckId).delete()
}

/** 首次启动时创建"错题本"题库（如果不存在） */
export async function seedErrorBookDeck(): Promise<void> {
  const exists = await db.decks.get(ERROR_DECK_ID)
  if (!exists) {
    await db.decks.put({
      id: ERROR_DECK_ID,
      name: '📝 错题本',
      description: '你在学习中标记的错题汇总，方便针对性复习',
      cardCount: 0,
      source: 'builtin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }
}

/** 将卡片加入错题本（如果已存在则忽略） */
export async function addCardToErrorBook(card: DentalCard): Promise<void> {
  const existing = await db.userCards
    .where('deckId').equals(ERROR_DECK_ID)
    .and(c => c.question === card.question)
    .first()
  if (existing) return
  const now = Date.now()
  await db.userCards.put({
    ...card,
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deckId: ERROR_DECK_ID,
    source: 'user',
    createdAt: now,
  })
  const count = await db.userCards.where('deckId').equals(ERROR_DECK_ID).count()
  await db.decks.update(ERROR_DECK_ID, { cardCount: count, updatedAt: now })
}

export { db }

/** 首次启动时创建"系统默认"题库（如果不存在） */
export async function seedBuiltinDeck(): Promise<void> {
  const exists = await db.decks.get(BUILTIN_DECK_ID)
  if (!exists) {
    await db.decks.put({
      id: BUILTIN_DECK_ID,
      name: '系统默认',
      description: '牙科知识 AI 问答内置题库（20 张卡片）',
      cardCount: 20,
      source: 'builtin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }
}
