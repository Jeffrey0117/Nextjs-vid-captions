# 字幕編輯器改進文檔

> 改進日期：2025-11-12
> 版本：v2.0
> 參考實現：OpenCut

## 📋 改進總覽

本次改進全面提升了字幕編輯器的用戶體驗，增加了創建、刪除、精確時間調整等核心功能，並優化了視覺設計和鍵盤快捷鍵支持。

### 改進統計
- ✅ 新增功能：5 項
- ✅ UI 優化：3 項
- ✅ 鍵盤快捷鍵：5 個
- ✅ 修改文件：2 個

---

## 🎯 核心改進

### 1. 時間軸字幕塊 UI 優化

#### 視覺設計改進
**修改文件**：`app/editor-pro/page.tsx` (行 2127-2131)

**改進前**：
- 選中狀態：黃色背景 (`bg-yellow-600`)
- 未選中：青綠色 (`#5DBAA0`)
- 邊框：1px 單色

**改進後**：
- 選中狀態：藍色邊框 (`border-blue-500`) + 陰影效果
- 保持青綠色背景 (`#5DBAA0`)
- 邊框：2px 加粗
- 平滑過渡動畫 (`transition-all duration-200`)

```typescript
// 新的樣式設計
className={`absolute top-1 h-14 rounded-[0.5rem] border-2 transition-all duration-200 group ${
  isSelected
    ? 'bg-[#5DBAA0] border-blue-500 shadow-lg shadow-blue-500/30'
    : 'bg-[#5DBAA0] hover:bg-[#4da890] border-[#5DBAA0] hover:border-[#4da890]'
}`}
```

#### 刪除按鈕
**位置**：字幕塊右側（選中時顯示）
**功能**：快速刪除當前字幕

```typescript
{isSelected && (
  <button
    className="ml-2 w-5 h-5 flex items-center justify-center rounded bg-red-500/80 hover:bg-red-600 transition-colors"
    onClick={(e) => {
      e.stopPropagation();
      if (confirm('確定要刪除這條字幕嗎？')) {
        deleteSegment(segment.id);
      }
    }}
    title="刪除字幕"
  >
    <Trash2 size={12} className="text-white" />
  </button>
)}
```

#### 完整文本提示
**改進**：添加 `title` 屬性顯示完整字幕文本

```typescript
<span className="text-[0.65rem] text-white truncate flex-1" title={segment.text}>
  {segment.text}
</span>
```

---

### 2. 創建字幕功能

#### 工具列按鈕
**位置**：頂部工具列，"匯入 SRT" 按鈕後
**修改文件**：`app/editor-pro/page.tsx` (行 1244-1252)

```typescript
<button
  onClick={handleAddSubtitle}
  disabled={!videoFile || duration === 0}
  className="flex items-center gap-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
  title="在當前時間創建新字幕 (Ctrl+N)"
>
  <Plus size={12} />
  新增字幕
</button>
```

#### 創建邏輯
**函數**：`handleAddSubtitle()` (行 827-873)

**功能特性**：
1. 自動確保軌道存在（如無軌道則創建）
2. 在當前播放時間創建字幕
3. 默認時長：2秒
4. 默認文本："新字幕"
5. 自動選中新創建的字幕
6. 使用預設樣式（Noto Sans SC, 32px）

```typescript
const handleAddSubtitle = () => {
  // 確保有軌道
  if (tracks.length === 0) {
    addTrack('字幕軌道 1');
  }

  const trackId = tracks[0]?.id || selectedTrackId;
  const startTime = currentTime;
  const endTime = currentTime + 2; // 默認2秒

  // 創建新字幕
  const newSegment = addSegment({
    startTime,
    endTime,
    text: '新字幕',
    style: { /* 完整樣式配置 */ }
  }, trackId);

  // 選中新創建的字幕
  if (newSegment) {
    setSelectedSegmentId(newSegment.id);
    selectSegment(newSegment.id);
    toast.success('已創建新字幕');
  }
};
```

---

### 3. 鍵盤快捷鍵系統

**修改文件**：`app/editor-pro/page.tsx` (行 518-567)

#### 完整快捷鍵列表

| 快捷鍵 | 功能 | 說明 |
|--------|------|------|
| `Ctrl/Cmd + N` | 新增字幕 | 在當前播放時間創建新字幕 |
| `Delete` / `Backspace` | 刪除字幕 | 刪除當前選中的字幕（需確認） |
| `Space` | 播放/暫停 | 切換視頻播放狀態 |
| `←` | 後退 5 秒 | 快速後退 |
| `→` | 前進 5 秒 | 快速前進 |

#### 智能過濾
- 在輸入框（`input`/`textarea`）中不觸發快捷鍵
- 在可編輯元素中不觸發快捷鍵

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 如果正在輸入框中，忽略快捷鍵
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // 快捷鍵邏輯...
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedSegmentId, segments, videoFile, duration, currentTime]);
```

---

### 4. 時間碼輸入框

**修改文件**：`app/components/SubtitlePropertiesPanel.tsx` (行 120-174)

#### 功能設計

**佈局**：
```
┌──────────────┬──────────────┐
│  開始時間     │  結束時間     │
│  [數字輸入]   │  [數字輸入]   │
│  HH:MM:SS.mmm│  HH:MM:SS.mmm│
└──────────────┴──────────────┘
  持續時間: 2.50 秒
```

**開始時間輸入框**：
```typescript
<input
  type="number"
  step="0.1"
  min="0"
  value={selectedSegment.startTime.toFixed(2)}
  onChange={(e) => {
    const newStart = parseFloat(e.target.value);
    if (!isNaN(newStart) && newStart >= 0 && newStart < selectedSegment.endTime) {
      updateSegment(selectedSegment.id, { startTime: newStart });
    }
  }}
  className="w-full px-2 py-1 text-sm bg-gray-800/50 border border-gray-700 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
/>
<div className="text-xs text-gray-500 mt-1">
  {formatTimeCode(selectedSegment.startTime)}
</div>
```

**結束時間輸入框**：
- 最小值：`開始時間 + 0.1 秒`
- 驗證：必須大於開始時間

**時間格式化函數**：
```typescript
function formatTimeCode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
```

**示例輸出**：
- `1.5秒` → `00:00:01.500`
- `65.234秒` → `00:01:05.234`
- `3661.5秒` → `01:01:01.500`

---

## 📊 OpenCut 參考借鑒

### 設計原則

1. **顏色系統**
   - 字幕軌道：青綠色 `#5DBAA0` ✓
   - 選中狀態：藍色邊框 `#3b82f6` ✓
   - 手柄顏色：Primary 色系 ✓

2. **拖動手柄設計**
   - 熱區寬度：0.6rem (易於點擊) ✓
   - 視覺指示：0.2rem (選中時顯示) ✓
   - 游標提示：`cursor-w-resize` / `cursor-e-resize` ✓

3. **幀對齊機制**
   - 30 fps 對齊 ✓
   - 防止半幀問題 ✓

4. **事件處理**
   - Document-level 監聽（拖動時） ✓
   - 點擊與拖動區分（5px 閾值） ✓

---

## 🎨 視覺設計規範

### 顏色方案

```css
/* 字幕塊 */
--subtitle-bg: #5DBAA0;              /* 青綠色 */
--subtitle-hover: #4da890;           /* 深青綠 */
--subtitle-selected-border: #3b82f6; /* 藍色 */
--subtitle-shadow: rgba(59, 130, 246, 0.3);

/* 按鈕 */
--btn-create: #0891b2;    /* cyan-600 */
--btn-delete: #ef4444;    /* red-500 */
--btn-primary: #2563eb;   /* blue-600 */
```

### 間距規範

```css
/* 字幕塊 */
height: 56px;           /* h-14 */
border-radius: 0.5rem;
border-width: 2px;
padding: 0.5rem 0.125rem;

/* 拖動手柄 */
width: 0.6rem;          /* 熱區 */
indicator: 0.2rem;      /* 視覺指示 */
height: 1.5rem;         /* 指示器高度 */
```

---

## 🔧 技術實現細節

### Store Actions 使用

```typescript
// 從 useSubtitleStore 解構
const {
  addSegment,      // 新增：創建字幕
  deleteSegment,   // 新增：刪除字幕
  updateSegment,   // 已有：更新字幕
  selectSegment,   // 已有：選中字幕
  // ...
} = useSubtitleStore();
```

### 狀態管理優化

```typescript
// 新增狀態
const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

// 鍵盤快捷鍵依賴
useEffect(() => {
  // ...
}, [selectedSegmentId, segments, videoFile, duration, currentTime]);
```

---

## 🧪 測試清單

### 功能測試

- [x] 點擊"新增字幕"按鈕創建字幕
- [x] 使用 `Ctrl+N` 創建字幕
- [x] 點擊刪除按鈕刪除字幕
- [x] 使用 `Delete` 鍵刪除字幕
- [x] 修改開始時間輸入框
- [x] 修改結束時間輸入框
- [x] 時間碼格式正確顯示
- [x] 選中狀態視覺反饋
- [x] 鍵盤快捷鍵不干擾輸入框

### 邊界測試

- [x] 沒有視頻時按鈕禁用
- [x] 結束時間必須大於開始時間
- [x] 刪除最後一條字幕
- [x] 連續創建多條字幕
- [x] 在輸入框中按快捷鍵不觸發

---

## 📈 性能影響

### 編譯結果
```
✓ Compiled in 955ms
✓ No errors
✓ Hot reload working
```

### 代碼變更
- 新增代碼：約 200 行
- 修改文件：2 個
- 新增依賴：0 個

---

## 🚀 未來改進建議

### 高優先級 (P0)
1. ~~添加創建字幕功能~~ ✅
2. ~~添加快速刪除功能~~ ✅
3. ~~添加時間碼輸入框~~ ✅

### 中優先級 (P1)
4. 添加時間軸縮放控制滑杆
5. 多軌道 UI 實現
6. 字幕衝突檢測與警告

### 低優先級 (P2)
7. 撤銷/重做功能 (Ctrl+Z / Ctrl+Y)
8. 字幕預覽模式
9. 批量時間偏移調整

---

## 📝 變更日誌

### v2.0 (2025-11-12)

**新增功能**：
- ✨ 新增字幕創建按鈕（工具列 + 快捷鍵）
- ✨ 新增快速刪除按鈕（時間軸 + 快捷鍵）
- ✨ 新增時間碼輸入框（屬性面板）
- ✨ 新增完整鍵盤快捷鍵系統
- ✨ 新增完整文本 tooltip

**UI 優化**：
- 🎨 優化選中狀態視覺設計（藍色邊框 + 陰影）
- 🎨 優化 hover 狀態過渡動畫
- 🎨 統一顏色方案（參考 OpenCut）

**技術改進**：
- 🔧 添加 formatTimeCode 工具函數
- 🔧 優化鍵盤事件處理（智能過濾輸入框）
- 🔧 完善 Store actions 解構

---

## 👨‍💻 開發者注意事項

### 新增的依賴項

```typescript
// page.tsx
import { Plus } from 'lucide-react';  // 新增圖標

// Store actions
const { addSegment, deleteSegment } = useSubtitleStore();  // 新增解構
```

### 修改的文件路徑

1. `app/editor-pro/page.tsx`
   - 行 5: 新增 Plus 圖標導入
   - 行 87-88: 新增 Store actions 解構
   - 行 518-567: 新增鍵盤快捷鍵 useEffect
   - 行 827-873: 新增 handleAddSubtitle 函數
   - 行 1244-1252: 新增創建按鈕
   - 行 2127-2131: 優化字幕塊樣式
   - 行 2157-2176: 優化中間區域（刪除按鈕 + tooltip）

2. `app/components/SubtitlePropertiesPanel.tsx`
   - 行 9-16: 新增 formatTimeCode 函數
   - 行 120-174: 新增時間碼區域

---

## 🎯 總結

本次改進成功實現了：

1. **完整的字幕創建流程** - 工具列按鈕 + 快捷鍵
2. **便捷的刪除功能** - 視覺化按鈕 + 鍵盤快捷鍵
3. **精確的時間調整** - 數字輸入 + 時間碼顯示
4. **專業的鍵盤快捷鍵** - 5 個常用操作
5. **優化的視覺設計** - 參考 OpenCut 最佳實踐

用戶現在可以高效地創建、編輯、刪除字幕，體驗接近專業視頻編輯軟件！

---

**文檔版本**: v2.0
**最後更新**: 2025-11-12
**維護者**: Claude Code

🤖 Generated with [Claude Code](https://claude.com/claude-code)
