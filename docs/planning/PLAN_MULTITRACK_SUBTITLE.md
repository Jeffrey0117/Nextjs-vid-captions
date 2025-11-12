# 字幕多軌道系統規劃

## 1. 參考 OpenCut 架構

### OpenCut TimelineTrack 結構
```typescript
export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType; // 'media' | 'text' | 'audio'
  elements: TimelineElement[];
  muted?: boolean;
  isMain?: boolean;
}

export type TrackType = "media" | "text" | "audio";
```

### 軌道排序邏輯
- Text tracks 永遠在最上面
- Audio tracks 永遠在最下面  
- Main track 在中間 (media tracks 區域的底部)

## 2. 字幕多軌道需求

### 為什麼需要多軌道?
1. **多語言字幕** - 中文軌、英文軌、日文軌等
2. **字幕分層** - 主標題 + 註解/翻譯
3. **字幕備份** - 不同版本的字幕方便切換
4. **靜音/顯示控制** - 可單獨開關某個軌道
5. **樣式分離** - 不同軌道有不同預設樣式

### 字幕軌道類型
```typescript
export interface SubtitleTrack {
  id: string;
  name: string; // "中文字幕", "English Subtitles", etc.
  segments: SubtitleSegment[];
  muted: boolean; // 是否靜音 (不顯示)
  visible: boolean; // 是否在時間軸顯示
  locked: boolean; // 是否鎖定 (無法編輯)
  color: string; // 軌道顏色標記 (用於時間軸區分)
  defaultStyle?: Partial<SubtitleSegment['style']>; // 該軌道的預設樣式
}
```

## 3. subtitle-store 重構方案

### 當前結構 (單軌道)
```typescript
interface SubtitleStore {
  segments: SubtitleSegment[];
  selectedSegmentId: string | null;
}
```

### 新結構 (多軌道)
```typescript
interface SubtitleStore {
  tracks: SubtitleTrack[]; // 多軌道陣列
  selectedTrackId: string | null; // 選中的軌道
  selectedSegmentId: string | null; // 選中的字幕片段
  
  // 軌道管理
  addTrack: (name: string, defaultStyle?: Partial<SubtitleSegment['style']>) => void;
  deleteTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<SubtitleTrack>) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  
  // 字幕片段管理 (需指定軌道)
  addSegment: (trackId: string, segment: Omit<SubtitleSegment, 'id'>) => void;
  updateSegment: (trackId: string, segmentId: string, updates: Partial<SubtitleSegment>) => void;
  deleteSegment: (trackId: string, segmentId: string) => void;
  moveSegmentToTrack: (fromTrackId: string, toTrackId: string, segmentId: string) => void;
  
  // 選擇管理
  selectTrack: (trackId: string | null) => void;
  selectSegment: (segmentId: string | null) => void;
  
  // 匯入匯出
  importFromSrt: (srtContent: string, targetTrackId?: string) => void; // 可指定匯入到哪個軌道
  exportToSrt: (trackId?: string) => string; // 可匯出單一軌道或全部
  
  // 相容性方法 (向後相容單軌道模式)
  getAllSegments: () => SubtitleSegment[]; // 取得所有可見軌道的字幕
  getActiveTrack: () => SubtitleTrack | null; // 取得當前選中的軌道
}
```

### 向後相容策略
為了不破壞現有代碼,提供相容方法:
```typescript
// 如果只有一個軌道,行為與舊版相同
get segments(): SubtitleSegment[] {
  if (this.tracks.length === 1) {
    return this.tracks[0].segments;
  }
  // 多軌道時返回當前選中軌道的字幕
  return this.getActiveTrack()?.segments || [];
}
```

## 4. UI 調整 - 時間軸多軌道顯示

### 參考 OpenCut 佈局
```
┌─────────────┬────────────────────────────────────────┐
│ 播放工具列  │                                        │
├─────────────┴────────────────────────────────────────┤
│ 標尺        │ 0s    5s    10s    15s    20s         │
├─────────────┼────────────────────────────────────────┤
│ 字幕軌 1    │ [字幕1]  [字幕2]      [字幕3]         │ 60px
├─────────────┼────────────────────────────────────────┤
│ 字幕軌 2    │      [English]    [Subtitle]          │ 60px
├─────────────┼────────────────────────────────────────┤
│ 字幕軌 3    │ [日本語]              [テキスト]      │ 60px
└─────────────┴────────────────────────────────────────┘
        ↑                     ↑
   軌道標籤區            軌道內容區
   (w-20, 固定寬度)      (flex-1, 可滾動)
```

### 播放頭貫穿實現
```typescript
// SubtitlePlayhead.tsx 
const timelineContainerHeight = timelineRef?.current?.offsetHeight || 400;
const totalHeight = timelineContainerHeight - 4;

<div
  className="absolute left-0 w-0.5 cursor-col-resize h-full bg-foreground"
  style={{
    height: `${totalHeight}px`, // 貫穿所有軌道
    top: 0,
  }}
/>
```

### 軌道標籤區調整
```tsx
<div className="w-20 shrink-0 border-r border-gray-800">
  {tracks.map((track, index) => (
    <div
      key={track.id}
      className="flex items-center px-2 group"
      style={{ height: '60px' }}
    >
      {/* 軌道名稱 */}
      <span className="text-[0.65rem] text-gray-400 truncate">{track.name}</span>
      
      {/* 軌道控制按鈕 */}
      <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100">
        {/* 靜音按鈕 */}
        <button onClick={() => toggleTrackMute(track.id)}>
          {track.muted ? '🔇' : '🔊'}
        </button>
        
        {/* 刪除按鈕 */}
        <button onClick={() => deleteTrack(track.id)}>🗑️</button>
      </div>
    </div>
  ))}
  
  {/* 新增軌道按鈕 */}
  <button
    onClick={handleAddTrack}
    className="w-full h-8 border-t border-gray-700 text-xs text-gray-500 hover:text-white"
  >
    + 新增軌道
  </button>
</div>
```

### 可調整分隔線 (Resizable Track Heights)
參考 OpenCut 的可調整軌道高度功能:
```tsx
{tracks.map((track, index) => (
  <>
    <div
      className="relative"
      style={{ height: `${track.height || 60}px` }}
    >
      {/* 軌道內容 */}
    </div>
    
    {/* 可調整分隔線 */}
    {index < tracks.length - 1 && (
      <div
        className="absolute left-0 w-full h-1 cursor-row-resize bg-border hover:bg-primary transition"
        onMouseDown={(e) => handleResizeTrackStart(e, track.id)}
      />
    )}
  </>
))}
```

## 5. 功能實現優先順序

### Phase 1: 基礎多軌道 (必須)
- [x] SubtitleTrack 類型定義
- [ ] subtitle-store 重構 (tracks 陣列)
- [ ] 向後相容性方法 (getAllSegments, segments getter)
- [ ] 時間軸 UI 多軌道渲染
- [ ] 播放頭貫穿所有軌道
- [ ] 新增/刪除軌道功能

### Phase 2: 軌道管理 (重要)
- [ ] 軌道靜音/顯示切換
- [ ] 軌道鎖定功能
- [ ] 軌道重新排序 (拖曳)
- [ ] 軌道重命名
- [ ] 軌道顏色標記

### Phase 3: 進階功能 (可選)
- [ ] 字幕跨軌道移動
- [ ] 軌道高度調整 (cursor-row-resize)
- [ ] 軌道摺疊/展開
- [ ] 軌道預設樣式設定
- [ ] 多軌道匯出 (ASS 多語言支援)

### Phase 4: 優化 (未來)
- [ ] 軌道複製
- [ ] 軌道合併
- [ ] 軌道同步 (時間碼對齊)
- [ ] 軌道範本系統

## 6. SRT 匯入匯出調整

### 單一軌道模式 (向後相容)
```typescript
// 匯入時自動創建第一個軌道
importFromSrt(srtContent) {
  if (tracks.length === 0) {
    addTrack("字幕軌道 1");
  }
  // 匯入到第一個軌道
  importSegmentsToTrack(srtContent, tracks[0].id);
}
```

### 多軌道模式
```typescript
// 允許選擇匯入到哪個軌道
importFromSrt(srtContent, targetTrackId?) {
  const trackId = targetTrackId || selectedTrackId || tracks[0]?.id;
  if (!trackId) {
    addTrack("字幕軌道 1");
    trackId = tracks[0].id;
  }
  importSegmentsToTrack(srtContent, trackId);
}

// 匯出單一軌道或全部軌道
exportToSrt(trackId?) {
  if (trackId) {
    return exportTrackToSrt(trackId);
  }
  // 匯出全部可見軌道 (多檔案或合併)
  return tracks
    .filter(t => t.visible)
    .map(t => exportTrackToSrt(t.id))
    .join('\n\n');
}
```

## 7. ASS 多語言輸出支援

ASS 格式支援多語言字幕 (不同 Style):
```ass
[V4+ Styles]
Style: Chinese,Arial,32,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1
Style: English,Arial,28,&H00FFFF00,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,8,10,10,10,1
Style: Japanese,MS Gothic,30,&H00FF00FF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Dialogue: 0,0:00:00.00,0:00:05.00,Chinese,,0,0,0,,這是中文字幕
Dialogue: 0,0:00:00.00,0:00:05.00,English,,0,0,0,,This is English subtitle
Dialogue: 0,0:00:00.00,0:00:05.00,Japanese,,0,0,0,,これは日本語字幕です
```

## 8. 技術挑戰和解決方案

### 挑戰 1: 字幕重疊顯示
**問題**: 多軌道字幕同時顯示時可能重疊

**解決方案**:
1. 每個軌道的 positionY 預設值不同 (中文 90%, 英文 85%, 日文 80%)
2. 提供「自動排列」功能,避免重疊
3. 允許手動調整每個字幕的 z-index

### 挑戰 2: 效能問題
**問題**: 多軌道 + 大量字幕可能導致卡頓

**解決方案**:
1. 虛擬化渲染 (只渲染可見區域的字幕)
2. 使用 React.memo 優化字幕區塊元件
3. 節流時間軸滾動事件

### 挑戰 3: 播放頭同步
**問題**: 播放頭需要貫穿所有軌道,高度動態計算

**解決方案**:
```typescript
// 使用 ResizeObserver 監聽軌道容器高度變化
useEffect(() => {
  const observer = new ResizeObserver(() => {
    const totalHeight = timelineContentRef.current?.offsetHeight || 400;
    setPlayheadHeight(totalHeight - 4);
  });
  
  if (timelineContentRef.current) {
    observer.observe(timelineContentRef.current);
  }
  
  return () => observer.disconnect();
}, []);
```

## 9. 實現時間表

### Week 1: 核心架構
- Day 1-2: subtitle-store 重構 (多軌道支援)
- Day 3-4: 時間軸 UI 多軌道渲染
- Day 5: 播放頭貫穿 + 測試

### Week 2: 軌道管理
- Day 1-2: 新增/刪除/重命名軌道
- Day 3-4: 靜音/顯示/鎖定功能
- Day 5: 軌道拖曳排序

### Week 3: 進階功能
- Day 1-2: 字幕跨軌道移動
- Day 3-4: 軌道高度調整
- Day 5: ASS 多語言輸出

## 10. 測試計畫

### 單元測試
- [ ] SubtitleTrack CRUD 操作
- [ ] 軌道排序邏輯
- [ ] 向後相容性測試

### 整合測試
- [ ] 多軌道 SRT 匯入匯出
- [ ] ASS 多語言輸出正確性
- [ ] 播放頭同步測試

### E2E 測試
- [ ] 新增 3 個軌道,每個軌道 10 個字幕
- [ ] 跨軌道拖曳字幕
- [ ] 軌道靜音/顯示切換
- [ ] 多軌道影片輸出

---

**參考資源**:
- OpenCut Timeline: `OpenCut/apps/web/src/components/editor/timeline/`
- OpenCut Types: `OpenCut/apps/web/src/types/timeline.ts`
- OpenCut Playhead: `OpenCut/apps/web/src/components/editor/timeline/timeline-playhead.tsx`