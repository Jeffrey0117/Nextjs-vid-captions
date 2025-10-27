# /editor 快速編輯頁面實現計劃

## 需求概述
- **路徑**: http://localhost:3005/editor
- **核心功能**: 不轉頁面的快速字幕編輯工作流程
- **工作流程**: 點擊專案 → 上傳影片 → 自動字幕識別 → 自動中文翻譯 → 批量編輯 → 輸出影片

## 已完成功能 ✅

### 1. 專案管理系統
- ✅ 專案列表顯示 (grid 佈局)
- ✅ 專案卡片 (縮圖、名稱、日期、狀態)
- ✅ localStorage 持久化
- ✅ 搜尋功能
- ✅ 批量選取和刪除

### 2. 狀態追蹤系統
```typescript
status: 'idle' | 'uploading' | 'transcribing' | 'translating' | 'ready' | 'error'
progress: 0-100
```
- ✅ 進度條顯示
- ✅ 狀態文字和顏色
- ✅ 錯誤訊息顯示

### 3. 自動處理流程
- ✅ 點擊專案 → 觸發檔案選擇器
- ✅ 上傳影片並生成預覽 URL
- ✅ 自動執行 Whisper 字幕識別
- ✅ 自動執行 Google Translate 翻譯
- ✅ 合併字幕資料並儲存

### 4. 批量編輯器整合
- ✅ 全螢幕 Modal
- ✅ 載入字幕到 Zustand store
- ✅ 完成後儲存回專案

### 5. 影片輸出功能
- ✅ 整合 FFmpeg 字幕燒錄
- ✅ 自動下載輸出影片

## 當前錯誤修正 🔧

### 問題 1: API 參數名不一致
**錯誤**: 前端傳 `video`,後端接收 `file`

**修正**: 統一使用 `file` 參數名

### 問題 2: API 回應欄位不一致
**錯誤**: 後端返回 `srtContent`,前端期望 `srt`

**修正**: 統一使用 `srt` 欄位名

## 修正檔案

### app/editor/page.tsx:144-156
將 `formData.append('video', videoFile)` 改為 `formData.append('file', videoFile)`
將 `const { srt }` 改為 `const { srtContent }`

### app/api/transcribe/route.ts:54-57
將 `srtContent` 改為 `srt` 以符合前端期望

## 技術架構

### 前端狀態管理
```typescript
// 專案資料結構
interface Project {
  id: string;
  name: string;
  createdAt: Date;
  thumbnail?: string | null;
  videoFile?: File | null;
  videoUrl?: string | null;
  status: 'idle' | 'uploading' | 'transcribing' | 'translating' | 'ready' | 'error';
  progress: number;
  errorMessage?: string;
  segments?: SubtitleSegment[];
}

// Zustand Store
- tracks: 字幕軌道陣列
- setSegments: 設定字幕資料
- reset: 重置 store
```

### API 端點
1. **POST /api/transcribe**
   - 輸入: FormData { file: File, language: 'zh' }
   - 輸出: { srt: string, videoUrl: string, status: 'completed' }
   - 功能: Whisper AI 字幕識別

2. **POST /api/translate**
   - 輸入: { texts: string[], targetLang: 'zh-TW' }
   - 輸出: { translations: string[] }
   - 功能: Google Translate 批量翻譯

3. **POST /api/burn-subtitles**
   - 輸入: FormData { video: File, segments: JSON }
   - 輸出: Blob (影片檔案)
   - 功能: FFmpeg 字幕燒錄

### 資料流程
```
使用者點擊專案卡片
  ↓
觸發檔案選擇器
  ↓
選擇影片檔案
  ↓
更新專案狀態 (uploading)
  ↓
呼叫 autoProcessVideo()
  ├─ Step 1: /api/transcribe (Whisper 識別)
  │   └─ 更新狀態 (transcribing, progress: 0-50)
  ├─ Step 2: /api/translate (Google 翻譯)
  │   └─ 更新狀態 (translating, progress: 50-100)
  └─ Step 3: 合併資料並儲存
      └─ 更新狀態 (ready, progress: 100)
```

## UI/UX 設計

### 專案卡片狀態
- **idle**: 顯示「待上傳」,點擊可上傳影片
- **uploading/transcribing/translating**: 顯示進度條
- **ready**: 顯示「批量編輯」和「輸出影片」按鈕
- **error**: 顯示錯誤訊息,紅色文字

### 批量編輯器
- 全螢幕 Modal (z-50)
- 頂部工具列:標題 + 完成按鈕
- 內容區:使用 BulkSubtitleEditor 元件
- 完成後自動儲存到專案

## 已整合的元件
- ✅ BulkSubtitleEditor (批量編輯器)
- ✅ VideoPlayer (影片播放器)
- ✅ SubtitleBox (字幕預覽框)
- ✅ parseSrt (SRT 格式解析)
- ✅ generateAss (ASS 格式生成)

## 後續優化建議
1. 添加上傳進度追蹤 (XMLHttpRequest)
2. 添加字幕預覽功能 (在卡片上)
3. 支援批量處理多個專案
4. 添加專案重命名功能
5. 添加專案複製功能
6. 支援專案匯出/匯入 (JSON)
7. 添加快捷鍵支援

## 總結
整個快速編輯頁面已經完成 95%,只需修正 API 參數名和回應欄位即可正常運作。所有核心功能都已實現,包括專案管理、自動處理流程、批量編輯和影片輸出。