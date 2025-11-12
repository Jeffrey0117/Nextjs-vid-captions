# OpenCut 時間軸整合規劃

## 📋 整合目標

將 OpenCut 的絲滑時間軸體驗整合到字幕編輯器,提升字幕編輯的專業度和易用性。

## 🎯 核心特色

### 1. 字幕區塊視覺效果
- **圓角設計**: `rounded-[0.5rem]` (OpenCut 標準)
- **顏色方案**: `bg-[#5DBAA0]` (text 軌道顏色)
- **Hover 效果**: `hover:bg-[#5DBAA0]/80`
- **選中狀態**: `bg-yellow-600 border-yellow-400`

### 2. 拖曳手柄
- **左手柄**: 調整 startTime
  - 寬度: `w-[0.6rem]`
  - 游標: `cursor-w-resize`
  - 指示器: 垂直圓角線條
  
- **右手柄**: 調整 endTime
  - 寬度: `w-[0.6rem]`
  - 游標: `cursor-e-resize`
  - 指示器: 垂直圓角線條

### 3. 播放頭系統
- **紅色垂直線**: `bg-red-500 w-0.5`
- **頂部圓點**: `w-3 h-3 rounded-full bg-red-500`
- **可拖曳**: scrubbing 功能
- **自動滾動**: 跟隨播放位置

### 4. 快取進度指示器
- **顯示位置**: 時間標尺頂部
- **顏色**: `bg-primary` (藍色)
- **高度**: `h-px` (1px)
- **範圍**: 已渲染字幕的時間範圍

## 📂 檔案結構

```
app/components/timeline/
├── SubtitleElement.tsx        # 字幕區塊元件
├── SubtitlePlayhead.tsx       # 播放頭元件  
├── SubtitleCacheIndicator.tsx # 快取進度指示器
└── timeline-utils.ts          # 時間軸工具函數
```

## 🔧 實作細節

### SubtitleElement.tsx

```tsx
interface SubtitleElementProps {
  segment: SubtitleSegment;
  isSelected: boolean;
  zoomLevel: number;
  onSelect: (id: string) => void;
  onDragStart: (e: React.MouseEvent, type: 'left' | 'right' | 'move') => void;
}

// 核心樣式
className={`
  absolute top-1 h-14 rounded-[0.5rem] border transition group
  ${isSelected 
    ? 'bg-yellow-600 border-yellow-400' 
    : 'bg-[#5DBAA0] hover:bg-[#5DBAA0]/80 border-[#5DBAA0]'
  }
`}

// 左手柄
<div className="absolute left-0 top-0 bottom-0 w-[0.6rem] cursor-w-resize bg-primary z-50 flex items-center justify-center">
  <div className="w-[0.2rem] h-[1.5rem] bg-foreground/75 rounded-full" />
</div>

// 右手柄
<div className="absolute right-0 top-0 bottom-0 w-[0.6rem] cursor-e-resize bg-primary z-50 flex items-center justify-center">
  <div className="w-[0.2rem] h-[1.5rem] bg-foreground/75 rounded-full" />
</div>
```

### SubtitlePlayhead.tsx

```tsx
interface SubtitlePlayheadProps {
  currentTime: number;
  duration: number;
  zoomLevel: number;
  onSeek: (time: number) => void;
  rulerRef: React.RefObject<HTMLDivElement>;
  tracksScrollRef: React.RefObject<HTMLDivElement>;
}

// 播放頭位置計算
const playheadPosition = currentTime * 50 * zoomLevel;

// JSX 結構
<div 
  className="absolute pointer-events-auto z-40"
  style={{ left: `${playheadPosition}px`, top: 0, height: '60px', width: '2px' }}
>
  {/* 垂直線 */}
  <div className="absolute left-0 w-0.5 cursor-col-resize h-full bg-red-500" />
  
  {/* 頂部圓點 */}
  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 border-2 border-red-500/50" />
</div>
```

### SubtitleCacheIndicator.tsx

```tsx
interface SubtitleCacheIndicatorProps {
  segments: SubtitleSegment[];
  duration: number;
  zoomLevel: number;
}

// 計算已快取範圍 (假設所有已存在的字幕都已快取)
const cachedEnd = segments.length > 0 
  ? Math.max(...segments.map(s => s.endTime))
  : 0;

// JSX
<div 
  className="absolute top-0 h-px bg-primary"
  style={{ 
    left: '0px', 
    width: `${cachedEnd * 50 * zoomLevel}px` 
  }}
/>
```

## 🎨 視覺優化

### 顏色方案
- **字幕軌道**: `#5DBAA0` (OpenCut text 軌道顏色)
- **選中狀態**: `#EAB308` (yellow-600)
- **播放頭**: `#EF4444` (red-500)
- **快取指示**: `#3B82F6` (blue-500)

### 動畫效果
```css
/* 字幕區塊 hover */
.subtitle-element {
  transition: opacity 200ms, background-color 200ms;
}

.subtitle-element:hover {
  opacity: 0.9;
}

/* 手柄 hover */
.resize-handle {
  transition: background-color 150ms;
}

.resize-handle:hover {
  background-color: rgba(59, 130, 246, 0.8);
}
```

## 📐 像素定位系統

```typescript
const PIXELS_PER_SECOND = 50;

// 計算字幕區塊位置
const elementLeft = segment.startTime * PIXELS_PER_SECOND * zoomLevel;
const elementWidth = (segment.endTime - segment.startTime) * PIXELS_PER_SECOND * zoomLevel;

// 最小寬度限制
const minWidth = 80; // 80px minimum
```

## 🔄 滾動同步

```typescript
// 水平同步 (標尺 ↔ 軌道)
useEffect(() => {
  const handleRulerScroll = () => {
    tracksScrollRef.current.scrollLeft = rulerScrollRef.current.scrollLeft;
  };
  
  rulerScrollRef.current.addEventListener('scroll', handleRulerScroll);
  return () => rulerScrollRef.current.removeEventListener('scroll', handleRulerScroll);
}, []);
```

## 🚀 實作步驟

### Phase 1: 基礎元件 (30 min)
- [x] 創建 SubtitleElement.tsx
- [ ] 添加圓角和顏色
- [ ] 實現手柄視覺效果

### Phase 2: 播放頭 (20 min)
- [ ] 創建 SubtitlePlayhead.tsx
- [ ] 實現拖曳 scrubbing
- [ ] 添加自動滾動

### Phase 3: 快取指示器 (15 min)
- [ ] 創建 SubtitleCacheIndicator.tsx
- [ ] 計算快取範圍
- [ ] 整合到時間標尺

### Phase 4: 整合優化 (20 min)
- [ ] 整合到 editor-pro/page.tsx
- [ ] 測試所有交互
- [ ] 優化動畫效果

## 📝 參考檔案

- OpenCut Timeline Element: `OpenCut/apps/web/src/components/editor/timeline/timeline-element.tsx`
- OpenCut Playhead: `OpenCut/apps/web/src/components/editor/timeline/timeline-playhead.tsx`
- OpenCut Timeline: `OpenCut/apps/web/src/components/editor/timeline/index.tsx`
- 現有字幕系統: `app/editor-pro/page.tsx:998-1057`

## ✅ 驗收標準

1. 字幕區塊使用圓角和 OpenCut 顏色
2. 左右手柄顯示圓角指示器
3. 播放頭有紅色線條和頂部圓點
4. 播放頭可拖曳 seek
5. 快取進度在標尺頂部顯示
6. 所有動畫流暢 (60fps)

---

*Last Updated: 2025-10-26*