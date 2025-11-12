# OpenCut 字幕編輯器 - 功能說明

## 🎯 核心功能

### 1. 影片處理
- ✅ 支援多種影片格式上傳
- ✅ 即時影片預覽
- ✅ 播放/暫停控制
- ✅ 時間軸拖曳跳轉

### 2. AI 字幕識別 (Whisper)
- ✅ **本地 Whisper CLI 整合**
- ✅ 自動語音轉字幕
- ✅ 支援中文識別
- ✅ 生成標準 SRT 格式
- 📍 API 位置: [`/app/api/transcribe/route.ts`](app/api/transcribe/route.ts:1)

**使用方式:**
1. 點擊「上傳影片」按鈕選擇影片檔
2. 點擊「Whisper 識別」按鈕
3. 等待 AI 處理完成
4. 字幕自動匯入到編輯器

**技術細節:**
```bash
whisper "${filePath}" --model base --output_format srt --output_dir "${tempDir}" --language zh
```

### 3. 字幕翻譯
- ✅ **Google Translate 免費 API 整合**
- ✅ 批量翻譯所有字幕
- ✅ 支援多國語言
  - 繁體中文 (zh-TW)
  - 簡體中文 (zh-CN)
  - 英文 (en)
  - 日文 (ja)
  - 韓文 (ko)
- 📍 API 位置: [`/app/api/translate/route.ts`](app/api/translate/route.ts:1)

**使用方式:**
1. 選擇目標語言
2. 點擊「翻譯全部」按鈕
3. 翻譯結果會顯示在原文下方

### 4. 專業時間軸編輯器

#### 4.1 視覺化時間軸
- ✅ 專業的時間軸介面 (參考 OpenCut 設計)
- ✅ 時間標尺顯示
- ✅ 紅色播放頭即時跟隨
- ✅ 字幕片段視覺化顯示

#### 4.2 字幕軌道
- ✅ 字幕片段以色塊顯示在時間軸上
- ✅ 藍色色塊代表字幕片段
- ✅ Hover 顯示時間資訊
- ✅ 點擊片段跳轉到對應時間
- ✅ 視覺化字幕長度

#### 4.3 互動功能
- ✅ 點擊時間軸跳轉播放位置
- ✅ 即時播放頭位置顯示
- ✅ 當前播放字幕高亮顯示

### 5. 可調整面板佈局
- ✅ **react-resizable-panels 整合**
- ✅ 左右面板可拖曳調整大小
- ✅ 預設 70/30 比例
- ✅ 最小尺寸限制

**面板配置:**
- 左側 (70%): 影片預覽 + 播放控制 + 時間軸
- 右側 (30%): 字幕列表

### 6. 字幕管理

#### 6.1 SRT 匯入/匯出
- ✅ 標準 SRT 格式支援
- ✅ 自動解析時間戳
- ✅ 匯出包含翻譯內容
- 📍 Store 位置: [`/app/stores/subtitle-store.ts`](app/stores/subtitle-store.ts:1)

#### 6.2 字幕列表
- ✅ 即時顯示所有字幕片段
- ✅ 顯示序號、時間、原文、譯文
- ✅ 當前播放字幕高亮
- ✅ 點擊跳轉到對應時間

### 7. Zustand 狀態管理
- ✅ 字幕片段 CRUD 操作
- ✅ 選中狀態管理
- ✅ SRT 解析/生成
- ✅ 翻譯文字儲存

## 🎨 UI/UX 特色

### 專業深色主題
- 主背景: `bg-gray-950`
- 次要背景: `bg-gray-900`
- 邊框: `border-gray-800`
- 文字: `text-white`

### 視覺化元素
- 🔴 紅色播放頭 + 圓形指示器
- 🔵 藍色字幕片段
- 🟡 黃色翻譯按鈕
- 🟢 綠色匯入按鈕
- 🔴 紅色清空按鈕

### 互動反饋
- ✅ Hover 效果
- ✅ 當前字幕高亮 (`bg-blue-900`)
- ✅ 按鈕載入狀態
- ✅ 禁用狀態視覺回饋

## 📋 完整工作流程

### 方式 1: 使用 Whisper AI 識別

```
1. 上傳影片
   ↓
2. 點擊「Whisper 識別」
   ↓
3. AI 自動識別字幕
   ↓
4. 選擇目標語言
   ↓
5. 點擊「翻譯全部」
   ↓
6. 下載 SRT 檔案
```

### 方式 2: 匯入現有字幕

```
1. 上傳影片
   ↓
2. 匯入 SRT 檔案
   ↓
3. 在時間軸上檢視/編輯
   ↓
4. (可選) 翻譯字幕
   ↓
5. 下載編輯後的 SRT
```

## 🚀 技術架構

### 前端技術棧
- **Next.js 15**: React 框架
- **React 19**: UI 函式庫
- **TypeScript**: 類型安全
- **Tailwind CSS 4**: 樣式系統
- **Zustand**: 狀態管理
- **Lucide React**: 圖示庫
- **react-resizable-panels**: 可調整面板

### 後端 API
- **Whisper CLI**: 語音轉字幕
- **Google Translate API**: 翻譯服務
- **Next.js API Routes**: API 端點

### 專案結構

```
subtitle-web/
├── app/
│   ├── editor-pro/           # 主編輯器頁面
│   │   └── page.tsx          # 專業編輯器介面
│   ├── stores/               # Zustand 狀態管理
│   │   └── subtitle-store.ts # 字幕 Store
│   ├── api/
│   │   ├── transcribe/       # Whisper API
│   │   │   └── route.ts
│   │   └── translate/        # 翻譯 API
│   │       └── route.ts
├── lib/
│   ├── utils.ts              # 工具函數
│   └── types.ts              # TypeScript 類型
└── public/
    └── temp/                 # 臨時檔案目錄
```

## 📝 核心檔案說明

### [`app/editor-pro/page.tsx`](app/editor-pro/page.tsx:1)
專業編輯器主介面,整合所有功能:
- 影片播放器
- 時間軸編輯器
- 字幕列表
- 工具列按鈕

### [`app/stores/subtitle-store.ts`](app/stores/subtitle-store.ts:1)
字幕狀態管理:
- `SubtitleSegment` 介面定義
- SRT 匯入/匯出邏輯
- CRUD 操作
- 時間格式轉換

### [`app/api/transcribe/route.ts`](app/api/transcribe/route.ts:1)
Whisper 語音轉字幕 API:
- 接收影片檔案
- 呼叫本地 Whisper CLI
- 回傳 SRT 內容

### [`app/api/translate/route.ts`](app/api/translate/route.ts:1)
Google Translate API:
- POST: 單一翻譯
- PUT: 批量翻譯
- 支援多語言

## 🎯 與 OpenCut 的差異

### 保留的專業特性
✅ Timeline 時間軸概念
✅ Preview Panel 預覽面板
✅ 可調整面板佈局
✅ 專業深色主題

### 簡化的部分
- 移除複雜的影片編輯功能
- 專注於字幕編輯
- 簡化的狀態管理
- 移除資料庫依賴

### 新增的功能
✅ Whisper AI 字幕識別
✅ Google Translate 整合
✅ SRT 匯入/匯出
✅ 即時翻譯預覽

## 🔧 系統需求

### 必要環境
- Node.js 18+
- npm 或 bun
- Whisper CLI (可選,用於 AI 識別)

### Whisper 安裝
```bash
pip install openai-whisper
```

### 專案安裝
```bash
npm install
npm run dev
```

## 🌐 存取方式

開發伺服器: `http://localhost:3005/editor-pro`

## 🎉 完成功能總覽

- ✅ 專業時間軸編輯器介面
- ✅ Whisper AI 字幕識別整合
- ✅ Google Translate 翻譯功能
- ✅ SRT 匯入/匯出
- ✅ 可調整面板佈局
- ✅ 即時播放控制
- ✅ 視覺化字幕軌道
- ✅ 字幕列表管理
- ✅ 完整的 TypeScript 支援

---

**版本**: 1.0.0  
**最後更新**: 2025-10-25  
**開發狀態**: ✅ 可用於生產環境