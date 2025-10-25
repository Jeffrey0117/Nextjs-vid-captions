# 🎬 OpenCut 字幕編輯器

> 專業的影片字幕編輯工具,整合 AI 語音識別與翻譯功能

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)

## ✨ 核心功能

### 🤖 AI 字幕識別
- **Whisper 整合**: 使用 OpenAI Whisper 進行語音轉字幕
- **高精度識別**: 支援中文語音識別
- **自動生成**: 一鍵生成標準 SRT 字幕檔

### 🌐 智慧翻譯
- **多語言支援**: 繁中、簡中、英文、日文、韓文
- **批量翻譯**: 一鍵翻譯所有字幕
- **即時預覽**: 原文與譯文並排顯示

### 🎨 專業編輯器
- **時間軸編輯**: 視覺化字幕時間軸,參考 OpenCut 設計
- **即時預覽**: 影片與字幕同步播放
- **可調面板**: 自由調整預覽與編輯區大小
- **字幕軌道**: 直觀的字幕片段顯示

## 🚀 快速開始

### 環境需求

- Node.js 18+
- npm / yarn / pnpm / bun
- (可選) Whisper CLI - 用於 AI 字幕識別

### 安裝 Whisper

```bash
pip install openai-whisper
```

### 專案安裝

```bash
# 克隆專案
git clone <your-repo-url>

# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

### 存取應用

開啟瀏覽器訪問:
- **主編輯器**: [http://localhost:3005/editor-pro](http://localhost:3005/editor-pro)
- **首頁**: [http://localhost:3005](http://localhost:3005)

## 📖 使用指南

### 工作流程 1: AI 自動識別

1. 📤 點擊「上傳影片」選擇影片檔
2. 🤖 點擊「Whisper 識別」進行 AI 字幕識別
3. ⏳ 等待處理完成 (依影片長度而定)
4. 🌐 選擇目標語言,點擊「翻譯全部」
5. 💾 點擊「下載 SRT」儲存字幕檔

### 工作流程 2: 匯入編輯

1. 📤 上傳影片檔案
2. 📄 點擊「匯入 SRT」選擇現有字幕檔
3. ✏️ 在時間軸上查看與編輯字幕
4. 🌐 (可選) 翻譯字幕
5. 💾 下載編輯後的 SRT

## 🎯 功能特色

### 專業時間軸
- ⏱️ **時間標尺**: 清晰的時間刻度顯示
- 🔴 **播放頭**: 紅色播放頭即時跟隨
- 🟦 **字幕片段**: 藍色區塊視覺化顯示
- 🖱️ **互動操作**: 點擊跳轉、Hover 顯示資訊

### 字幕管理
- 📝 **即時編輯**: 在列表中查看所有字幕
- 🎯 **快速定位**: 點擊字幕跳轉到對應時間
- ✨ **當前高亮**: 正在播放的字幕自動高亮
- 🔄 **雙語顯示**: 原文與譯文並排呈現

### 面板佈局
- 📐 **可調整**: 拖曳分隔線調整面板大小
- 👁️ **預覽區**: 左側影片預覽與時間軸
- 📋 **列表區**: 右側字幕列表
- 💾 **記憶設定**: 保持用戶偏好的佈局

## 🛠️ 技術棧

### 前端
- **框架**: Next.js 15 (App Router)
- **UI 庫**: React 19
- **語言**: TypeScript 5
- **樣式**: Tailwind CSS 4
- **狀態**: Zustand
- **圖示**: Lucide React
- **面板**: react-resizable-panels

### 後端 API
- **路由**: Next.js API Routes
- **AI**: Whisper CLI
- **翻譯**: Google Translate API

## 📁 專案結構

```
subtitle-web/
├── app/
│   ├── editor-pro/          # 專業編輯器頁面
│   │   └── page.tsx
│   ├── stores/              # Zustand 狀態管理
│   │   └── subtitle-store.ts
│   ├── api/
│   │   ├── transcribe/      # Whisper API
│   │   │   └── route.ts
│   │   └── translate/       # 翻譯 API
│   │       └── route.ts
├── lib/
│   ├── utils.ts            # 工具函數
│   └── types.ts            # TypeScript 類型
├── public/
│   └── temp/               # 臨時檔案
├── FEATURE.md              # 詳細功能說明
└── README.md
```

## 📝 API 端點

### POST `/api/transcribe`
Whisper 語音轉字幕

**請求**:
```typescript
FormData {
  file: File  // 影片檔案
}
```

**回應**:
```typescript
{
  videoUrl: string,
  srtContent: string,
  status: 'completed'
}
```

### POST `/api/translate`
單一字幕翻譯

**請求**:
```typescript
{
  text: string,
  targetLang: string,
  sourceLang: string
}
```

### PUT `/api/translate`
批量字幕翻譯

**請求**:
```typescript
{
  texts: string[],
  targetLang: string,
  sourceLang: string
}
```

## 🎨 介面預覽

### 主編輯器
- 深色主題設計
- 專業的時間軸介面
- 直觀的操作流程

### 色彩系統
- 🔴 播放頭與警告操作
- 🔵 字幕片段與主要操作
- 🟢 匯入與成功操作
- 🟡 翻譯與特殊功能
- 🟣 AI 識別功能

## 📚 詳細文檔

查看 [`FEATURE.md`](FEATURE.md) 了解:
- 完整功能列表
- 技術架構說明
- 與 OpenCut 的比較
- 核心檔案說明

## 🔧 開發指令

```bash
# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build

# 啟動生產伺服器
npm start

# 類型檢查
npm run type-check
```

## 🌟 核心特性

✅ 專業時間軸編輯器  
✅ Whisper AI 字幕識別  
✅ Google Translate 整合  
✅ SRT 匯入/匯出  
✅ 可調整面板佈局  
✅ 即時播放控制  
✅ 視覺化字幕軌道  
✅ 完整 TypeScript 支援  

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request!

---

**開發狀態**: ✅ 可用於生產環境  
**版本**: 1.0.0  
**最後更新**: 2025-10-25