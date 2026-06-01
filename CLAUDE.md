# 牙科 AI 问答 — 项目交接文档

## 项目概述

医学知识背诵软件（类似"百词斩"），核心差异化：AI 语义级判分。当前阶段聚焦牙科领域。

- **技术栈**: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Dexie.js (IndexedDB)
- **构建方式**: vite-plugin-singlefile → 单文件 `dist/index.html`，双击即用
- **部署**: 纯静态，零后端，用户自带 API Key
- **仓库**: https://github.com/1NGRAVE/medical-memorization

## 当前分支：`merge-features`

已合并三个 feature 分支，包含完整功能：

```
merge-features (17b6de2) ← 你在这里
├── 2442790 Merge feature/skip-question
├── 6416ed4 feat: 错题本功能
├── 57a3c0e feat: 用户自定义卡片管理（含 DOCX 导入、DeckManager）
├── a3fb9b9 feat: add skip button（⏭️ 跳过按钮）
└── a87d498 feat: AI 知识点→问题智能转换（基础）
```

远端: `origin/merge-features` 已推送。

## 三个已实现功能

### 1. 题库管理（feature/card-management）
- 题库 CRUD（创建/删除/切换），IndexedDB 持久化
- `.docx` 文件导入，AI 解析 + 正则兜底，智能识别论述题
- DeckManager 组件：查看/编辑/删除卡片，手动添加卡片
- "系统默认"题库（内置 20 张卡片）+ "📝 错题本"题库（自动创建）
- AppView 类型: `'decks' | 'import' | 'study' | 'complete' | 'manage'`

### 2. 跳过按钮（feature/skip-question）
- 答题前显示 `⏭️ 跳过` 按钮，点击直接跳到下一题
- 跳过不记录学习记录
- 仅在 `StudyCard.tsx` 中实现，改动集中在按钮区

### 3. 错题本（feature/error-notebook）
- 评分后显示 `📝 错题本` 按钮（玫瑰红色），点击将题目复制到错题本题库
- 已在错题本中显示 `✅ 已加入`（置灰）
- 错题本作为置顶题库（ID: `__errorbook__`），排序最优先
- DeckList 中错题本有特殊样式：玫瑰色边框、📝 图标、"错题"标签
- 去重逻辑：按 `question` 文本匹配，不重复添加

## 目录结构

```
dentistry-mvp/
├── src/
│   ├── App.tsx                    # 主应用（路由、状态、回调）
│   ├── types/index.ts             # 所有类型定义 + 常量（BUILTIN_DECK_ID, ERROR_DECK_ID）
│   ├── db/index.ts                # Dexie.js 数据库层（decks, userCards, studyRecords 三表）
│   ├── data/dentistry-cards.ts    # 内置 20 张卡片（硬编码，不在 IndexedDB）
│   ├── components/
│   │   ├── StudyCard.tsx          # 学习卡片（答题、评判、跳过、错题本按钮）
│   │   ├── DeckList.tsx           # 题库列表（含错题本特殊样式）
│   │   ├── DeckManager.tsx        # 卡片管理（查看/编辑/删除/添加卡片）
│   │   ├── CreateDeckModal.tsx    # 创建题库弹窗
│   │   ├── ImportPanel.tsx        # DOCX 导入面板
│   │   ├── ModelConfig.tsx        # AI 模型配置
│   │   └── CardEditor.tsx         # 卡片编辑器（未使用？）
│   ├── providers/
│   │   ├── deepseek-provider.ts   # DeepSeek API 适配器
│   │   ├── mock-provider.ts       # 本地 mock 判分
│   │   └── keyword-check.ts       # 关键词匹配判分
│   └── parsers/
│       ├── docx-parser.ts         # DOCX 解析
│       ├── ai-parser.ts           # AI 解析卡片
│       └── index.ts               # 解析入口
├── dist/index.html                # 单文件构建产物
├── package.json
└── vite.config.ts
```

## 关键常量

```typescript
// types/index.ts
BUILTIN_DECK_ID = '__builtin__'    // 系统默认题库
ERROR_DECK_ID  = '__errorbook__'   // 错题本题库
```

## 数据库表（Dexie.js v2）

| 表名 | 主键 | 索引 |
|------|------|------|
| `decks` | `id` | `source, createdAt` |
| `userCards` | `id` | `deckId, source, createdAt` |
| `studyRecords` | `++id` | `cardId, deckId, timestamp, [deckId+cardId]` |

## StudyCard.tsx Props（重要）

```typescript
interface Props {
  card: DentalCard
  provider: JudgeProvider
  cardIndex: number
  totalCards: number
  onJudged: (result: JudgeResult, studentAnswer: string) => void
  onNext: () => void
  onAddToErrorBook: (card: DentalCard) => void  // 错题本
  isInErrorBook: boolean                         // 错题本
}
```

按钮布局（评判前）：`[⏭️ 跳过] [📤 提交评判]`
按钮布局（评判后）：`[🔄 重做] [📝 错题本] [下一题 →]`

## 常用命令

```bash
cd "d:/Project/26.6.1medical memorization/dentistry-mvp"

# 开发
npm run dev              # 启动开发服务器 (localhost:5173)

# 构建
npm run build            # tsc -b && vite build → dist/index.html

# 类型检查
npx tsc --noEmit
```

## 远端分支（已推送）

| 分支 | 内容 |
|------|------|
| `origin/master` | v0.1.0 初始版本 |
| `origin/feature/card-management` | 题库管理 + DOCX 导入 |
| `origin/feature/skip-question` | 跳过按钮 |
| `origin/feature/error-notebook` | 错题本 |
| `origin/merge-features` | **三合一，当前工作分支** |

## 已知待完善

- 本地判分同义词库太小（20组）
- 只支持论述题导入，选择/填空/判断被过滤
- 未实现 SM-2 间隔重复算法
- 未实现四选一测验模式
- 未实现学习统计图表（Recharts）
- 错题本目前只能添加不能移除（需在 DeckManager 中管理）

## 注意

- 项目不在 git 仓库根目录，`.git` 在 `dentistry-mvp/` 内
- 所有 git 操作需在 `dentistry-mvp/` 目录下执行
- 开发服务器端口: 5173
- `src/data/dentistry-cards.ts` 可能在某些分支被删除（内置卡片逻辑迁移到 IndexedDB）
