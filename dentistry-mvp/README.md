# 🦷 牙科知识 AI 问答

基于 AI 语义判分的医学专业知识背诵工具——牙科领域 MVP。

## 快速开始

```bash
npm install
npm run dev        # 开发模式 → http://localhost:5173
npm run build      # 生产构建 → dist/index.html（单文件，双击即用）
```

## 功能

- 📚 **20 张牙科卡片**：覆盖解剖、病理、牙周、牙髓、外科、修复、正畸、预防、麻醉、影像 10 个子领域
- 🖥️ **本地关键词判分**（默认）：零延迟，完全离线，含中英文医学术语同义词库
- 🤖 **Gemini AI 判分**：语义级深度理解，需配置[免费 API Key](https://aistudio.google.com/apikey)
- 🔄 **智能降级**：AI 不可用时自动切换本地判分
- 📊 **完成统计**：平均分、通过率、每题得分
- 🌐 **已部署**：[Vercel](https://dist-ten-black-93.vercel.app)

## 技术栈

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · 纯静态前端

## 项目状态

v0.1.0 — 牙科 MVP。后续计划见[完整计划书](../医学知识背诵软件_完整项目计划书.docx)。
