# VideoPlaybackControls 使用說明

## 概述

已增強的 [`VideoPlaybackControls`](app/components/VideoPlaybackControls.tsx:28) 元件,參考 OpenCut 的時間軸控制列設計,提供了專業的影片播放和編輯控制功能。

## 新增功能

### 1. 可編輯時間碼 (EditableTimecode)
- 點擊當前時間可直接編輯並跳轉
- 支援格式:`HH:MM:SS:FF` (小時:分鐘:秒:幀)
- 按 `Enter` 確認,`Escape` 取消
- 自動限制在影片時長範圍內

### 2. 剪輯工具 (Editing Tools)
可選開啟,提供以下按鈕:
- **Split (Scissors)** - 在當前時間點分割字幕片段
- **Split Keep Left (ArrowLeftToLine)** - 分割並保留左側
- **Split Keep Right (ArrowRightToLine)** - 分割並保留右側
- **Duplicate (Copy)** - 複製選中的片段
- **Delete (Trash2)** - 刪除選中的片段

### 3. 書籤功能 (Bookmarks)
可選開啟,支援:
- 在當前時間點新增/移除書籤
- 書籤高亮顯示(藍色填充)
- 便於快速標記重要時間點

## Props 介面

```typescript
interface VideoPlaybackControlsProps {
  // 播放狀態
  isPlaying: boolean;
  currentTime: number;      // 秒
  duration: number;         // 秒
  
  // 播放控制
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipToStart: () => void;
  
  // 剪輯控制 (可選)
  onSplit?: () => void;
  onSplitKeepLeft?: () => void;
  onSplitKeepRight?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  
  // 書籤控制 (可選)
  bookmarks?: number[];               // 書籤時間點陣列
  onToggleBookmark?: () => void;
  
  // 縮放控制
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  
  // 顯示設定
  fps?: number;                       // 預設 30
  className?: string;
  
  // 功能開關
  showEditingTools?: boolean;         // 顯示剪輯工具
  showBookmarks?: boolean;            // 顯示書籤功能
}
```

## 基本使用範例

### 1. 基本播放控制

```tsx
import VideoPlaybackControls from '@/app/components/VideoPlaybackControls';

function SimplePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const duration = 120; // 2分鐘

  return (
    <VideoPlaybackControls
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      onPlayPause={() => setIsPlaying(!isPlaying)}
      onSeek={setCurrentTime}
      onSkipToStart={() => setCurrentTime(0)}
      zoomLevel={zoomLevel}
      onZoomIn={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
      onZoomOut={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
      onZoomChange={setZoomLevel}
      fps={30}
    />
  );
}
```

### 2. 完整編輯功能

```tsx
import VideoPlaybackControls from '@/app/components/VideoPlaybackControls';
import { useSubtitleStore } from '@/app/stores/subtitle-store';

function AdvancedEditor() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  
  const { segments, selectedSegmentId, updateSegment, deleteSegment } = useSubtitleStore();
  const duration = 300; // 5分鐘

  // 分割當前字幕
  const handleSplit = () => {
    const selectedSegment = segments.find(s => s.id === selectedSegmentId);
    if (!selectedSegment) return;
    
    if (currentTime <= selectedSegment.startTime || currentTime >= selectedSegment.endTime) {
      alert('播放頭必須在選中字幕範圍內');
      return;
    }
    
    // 實作分割邏輯...
    console.log('Split at', currentTime);
  };

  // 分割保留左側
  const handleSplitKeepLeft = () => {
    const selectedSegment = segments.find(s => s.id === selectedSegmentId);
    if (!selectedSegment) return;
    
    updateSegment(selectedSegmentId!, {
      endTime: currentTime
    });
  };

  // 分割保留右側
  const handleSplitKeepRight = () => {
    const selectedSegment = segments.find(s => s.id === selectedSegmentId);
    if (!selectedSegment) return;
    
    updateSegment(selectedSegmentId!, {
      startTime: currentTime
    });
  };

  // 複製字幕
  const handleDuplicate = () => {
    console.log('Duplicate segment');
  };

  // 刪除字幕
  const handleDelete = () => {
    if (selectedSegmentId) {
      deleteSegment(selectedSegmentId);
    }
  };

  // 切換書籤
  const handleToggleBookmark = () => {
    const roundedTime = Math.floor(currentTime * 10) / 10;
    setBookmarks(prev => 
      prev.includes(roundedTime)
        ? prev.filter(t => t !== roundedTime)
        : [...prev, roundedTime]
    );
  };

  return (
    <VideoPlaybackControls
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      onPlayPause={() => setIsPlaying(!isPlaying)}
      onSeek={setCurrentTime}
      onSkipToStart={() => setCurrentTime(0)}
      
      // 剪輯功能
      onSplit={handleSplit}
      onSplitKeepLeft={handleSplitKeepLeft}
      onSplitKeepRight={handleSplitKeepRight}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      
      // 書籤功能
      bookmarks={bookmarks}
      onToggleBookmark={handleToggleBookmark}
      
      zoomLevel={zoomLevel}
      onZoomIn={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
      onZoomOut={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
      onZoomChange={setZoomLevel}
      fps={30}
      
      // 開啟進階功能
      showEditingTools={true}
      showBookmarks={true}
    />
  );
}
```

## 快捷鍵參考

控制列按鈕提供以下快捷鍵提示:
- `Space` - 播放/暫停
- `Home` / `Enter` - 跳到起點
- `Ctrl+S` - 分割片段
- `Ctrl+Q` - 分割保留左側
- `Ctrl+W` - 分割保留右側
- `Ctrl+D` - 複製片段
- `Delete` - 刪除片段
- `Ctrl + +` - 放大
- `Ctrl + -` - 縮小

## 視覺設計

控制列採用深色主題,與影片編輯器風格一致:
- 背景:`bg-zinc-900`
- 按鈕懸停:`hover:bg-zinc-800`
- 分隔線:`bg-zinc-700`
- 書籤高亮:`fill-blue-500 text-blue-500`

## 相關元件

- [`EditableTimecode`](app/components/EditableTimecode.tsx:1) - 可編輯時間碼元件
- [`formatTimeCode()`](lib/time.ts:15) - 時間格式化工具
- [`parseTimeCode()`](lib/time.ts:45) - 時間解析工具

## OpenCut 參考

本實作參考以下 OpenCut 檔案:
- [`timeline-toolbar.tsx`](OpenCut/apps/web/src/components/editor/timeline/timeline-toolbar.tsx:44) - 時間軸工具列
- [`editable-timecode.tsx`](OpenCut/apps/web/src/components/ui/editable-timecode.tsx:18) - 可編輯時間碼
- [`use-playback-controls.ts`](OpenCut/apps/web/src/hooks/use-playback-controls.ts:6) - 播放控制 Hook

## 注意事項

1. **剪輯功能** - 需要自行實作具體的分割、複製邏輯
2. **書籤儲存** - 書籤陣列需要由父元件管理狀態
3. **時間精度** - 書籤使用 0.1 秒精度 (避免浮點數比較問題)
4. **功能開關** - `showEditingTools` 和 `showBookmarks` 預設為 `false`