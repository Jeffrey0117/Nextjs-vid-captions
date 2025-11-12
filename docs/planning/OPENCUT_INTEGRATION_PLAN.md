# OpenCut Timeline 整合規劃

## 目標
將 OpenCut 的專業時間軸控制面板整合到現有的字幕編輯器中

## 當前狀態分析

### 我們已有的功能
✅ 字幕軌道顯示與編輯
✅ 時間標尺
✅ 播放頭顯示
✅ 字幕片段拖曳(左右邊緣調整時間、整體移動)
✅ 點擊時間軸跳轉播放位置
✅ 自動選中當前播放字幕

### OpenCut 時間軸面板已有的功能
🎯 播放/暫停按鈕
🎯 時間顯示(當前時間/總時長)
🎯 時間軸縮放控制(zoom in/out)
🎯 多軌道顯示(影片軌、音訊軌、字幕軌)
🎯 波形顯示
🎯 關鍵幀標記
🎯 剪輯片段操作

## 整合計劃

### Phase 1: 複製 OpenCut Timeline 組件結構
1. **探索並複製核心組件**
   - 📁 `Timeline.tsx` - 主時間軸容器
   - 📁 `TimelineControls.tsx` - 播放控制列
   - 📁 `TimelineRuler.tsx` - 時間標尺
   - 📁 `TimelineTrack.tsx` - 軌道容器
   - 📁 `TimelineClip.tsx` - 片段組件
   - 📁 `Playhead.tsx` - 播放頭

2. **複製相關 hooks 和工具**
   - `useTimelineZoom.ts` - 縮放控制
   - `usePlayback.ts` - 播放控制
   - `timelineUtils.ts` - 時間軸計算工具

### Phase 2: 適配現有功能

#### 2.1 保留我們的功能
- ✅ 字幕即時渲染(影片上疊加)
- ✅ 字幕拖曳調整位置
- ✅ 字幕縮放功能
- ✅ 時間軸字幕拖曳調整時間
- ✅ Whisper 識別
- ✅ Google Translate 批量翻譯
- ✅ 批量編輯彈窗
- ✅ 屬性面板(完整樣式控制)
- ✅ SRT 匯入/匯出
- ✅ 影片輸出(FFmpeg 燒錄)

#### 2.2 從 OpenCut 整合
- 🎯 專業的播放控制 UI
- 🎯 時間軸縮放功能(zoom slider)
- 🎯 更精確的時間顯示格式
- 🎯 多軌道佈局(預留擴展性)

### Phase 3: UI 重構

#### 3.1 佈局調整
```
┌─────────────────────────────────────────────────────┐
│ 頂部工具列 (保持現有)                                  │
├─────────────────────────┬───────────────────────────┤
│                         │                           │
│  影片預覽區              │  屬性面板                   │
│  (含字幕即時渲染)         │  (保持現有完整功能)          │
│                         │                           │
├─────────────────────────┴───────────────────────────┤
│ OpenCut Timeline Panel                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [播放] [暫停] 00:00 / 03:45  [-] [+] Zoom       │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 時間標尺 (0s, 1s, 2s, ...)                      │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🎬 影片軌                                        │ │
│ │ 🎵 音訊軌                                        │ │
│ │ 💬 字幕軌 (保留現有拖曳功能)                      │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 3.2 組件映射

| OpenCut 組件 | 我們的實現 | 整合方式 |
|-------------|----------|---------|
| TimelineControls | 播放控制列 (新增) | **採用 OpenCut** |
| TimelineRuler | 時間標尺 | **替換為 OpenCut** |
| TimelineTrack (subtitle) | 字幕軌道 | **保留我們的拖曳功能,套用 OpenCut 樣式** |
| Playhead | 播放頭 | **替換為 OpenCut** |
| Zoom Controls | 無 | **新增 OpenCut 功能** |

### Phase 4: 狀態管理整合

#### 4.1 保留 Zustand Store
```typescript
// app/stores/subtitle-store.ts (保持現有)
- segments (字幕片段)
- selectedSegmentId
- 完整樣式屬性
- CRUD 操作
```

#### 4.2 新增 Timeline Store
```typescript
// app/stores/timeline-store.ts (新增)
- zoom: number (縮放比例)
- currentTime: number
- duration: number
- isPlaying: boolean
- tracks: Track[] (多軌道,預留擴展)
```

### Phase 5: 功能對照表

| 功能分類 | 當前實現 | OpenCut 實現 | 整合決策 |
|---------|---------|-------------|---------|
| **播放控制** |
| 播放/暫停 | 簡單按鈕 | 專業 UI + 快捷鍵 | ✅ 採用 OpenCut |
| 時間顯示 | formatTime() | HH:MM:SS.mmm | ✅ 採用 OpenCut |
| 進度條 | 簡單滑桿 | 精確時間軸 | ✅ 採用 OpenCut |
| **時間軸** |
| 時間標尺 | 手動計算 | 動態刻度 | ✅ 採用 OpenCut |
| 縮放控制 | 無 | Zoom slider | ✅ 新增 OpenCut |
| 播放頭 | 紅線 | 專業設計 | ✅ 採用 OpenCut |
| **字幕軌道** |
| 片段顯示 | 藍色區塊 | 更精美 | ✅ 套用 OpenCut 樣式 |
| 拖曳調整 | 左右邊緣拖曳 | 同樣功能 | ✅ 保留我們的邏輯 |
| 點擊選中 | ✓ | ✓ | ✅ 保留 |
| **字幕編輯** |
| 即時渲染 | ✓ | ✗ | ✅ 保留我們的 |
| 位置拖曳 | ✓ | ✗ | ✅ 保留我們的 |
| 縮放功能 | ✓ | ✗ | ✅ 保留我們的 |
| 屬性面板 | 完整 | 無字幕專用 | ✅ 保留我們的 |
| 批量編輯 | ✓ | ✗ | ✅ 保留我們的 |

## 實作步驟

### Step 1: 探索 OpenCut 代碼
```bash
# 找到 Timeline 相關組件
src/components/Timeline/
  ├── Timeline.tsx
  ├── TimelineControls.tsx
  ├── TimelineRuler.tsx
  ├── TimelineTrack.tsx
  └── hooks/
      ├── useTimelineZoom.ts
      └── usePlayback.ts
```

### Step 2: 創建新組件
```bash
app/components/timeline/
  ├── TimelinePanel.tsx          # 主時間軸面板
  ├── TimelineControls.tsx       # 播放控制 (從 OpenCut)
  ├── TimelineRuler.tsx          # 時間標尺 (從 OpenCut)
  ├── SubtitleTrack.tsx          # 字幕軌道 (混合)
  └── utils/
      └── timelineCalculations.ts
```

### Step 3: 替換現有時間軸
- 在 `editor-pro/page.tsx` 中替換底部的時間軸區域
- 保留所有現有功能,只改變 UI 呈現

### Step 4: 測試與優化
- ✓ 播放控制是否正常
- ✓ 字幕拖曳功能是否保留
- ✓ 縮放功能是否流暢
- ✓ 所有快捷鍵是否工作

## 預期成果

整合後將擁有:
1. ✅ OpenCut 專業級時間軸 UI
2. ✅ 保留所有字幕編輯功能
3. ✅ 更好的縮放和導航體驗
4. ✅ 為未來多軌道編輯預留擴展性

## 注意事項

1. **不要破壞現有功能**:所有字幕編輯、翻譯、輸出功能都要保留
2. **漸進式整合**:先整合 UI,再逐步添加高級功能
3. **保持簡潔**:不需要 OpenCut 的全部功能(如影片剪輯),只要時間軸部分
4. **測試充分**:每個步驟都要確保不影響現有功能

## 下一步行動

選擇以下方式之一開始:

### 方案 A: 完整整合 (推薦)
1. 複製 OpenCut Timeline 所有相關組件
2. 創建 `app/components/timeline/` 目錄
3. 逐步替換現有時間軸實現
4. 保留所有字幕功能

### 方案 B: 樣式整合 (快速)
1. 只參考 OpenCut 的 CSS 樣式
2. 手動重建播放控制 UI
3. 保持現有邏輯不變

### 方案 C: 混合整合 (平衡)
1. 採用 OpenCut 的播放控制組件
2. 採用 OpenCut 的縮放邏輯
3. 保留我們的字幕軌道實現
4. 統一樣式風格

---

**建議**: 先從方案 C 開始,逐步向方案 A 靠攏