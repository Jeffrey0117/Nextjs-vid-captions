'use client';

import { useEffect, useRef, useState } from 'react';

interface SubtitlePlayheadProps {
  /** 當前播放時間 (秒) */
  currentTime: number;
  /** 時間軸縮放級別 (像素/秒) */
  pixelsPerSecond: number;
  /** 時間軸容器 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 當拖曳播放頭時的回調 */
  onSeek: (time: number) => void;
  /** 影片總長度 (秒) */
  duration: number;
  /** 時間軸總容器 ref (用於計算完整高度) */
  timelineRef?: React.RefObject<HTMLDivElement | null>;
}

export default function SubtitlePlayhead({
  currentTime,
  pixelsPerSecond,
  containerRef,
  onSeek,
  duration,
  timelineRef,
}: SubtitlePlayheadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState(400);

  // 計算播放頭的 X 位置 (像素)
  const playheadX = currentTime * pixelsPerSecond;

  // 追蹤時間軸容器高度變化 (OpenCut 標準: 播放頭延伸整個時間軸)
  useEffect(() => {
    const timelineContainer = timelineRef?.current;
    if (!timelineContainer) return;

    const updateHeight = () => {
      setTimelineHeight(timelineContainer.offsetHeight);
    };

    // 設定初始高度
    updateHeight();

    // 監聽容器尺寸變化
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(timelineContainer);

    return () => resizeObserver.disconnect();
  }, [timelineRef]);

  // 追蹤滾動位置 (OpenCut 風格: 讓播放頭鎖定在畫面內)
  useEffect(() => {
    const tracksViewport = containerRef.current;
    if (!tracksViewport) return;

    const handleScroll = () => {
      setScrollLeft(tracksViewport.scrollLeft);
    };

    // 設定初始滾動位置
    setScrollLeft(tracksViewport.scrollLeft);

    tracksViewport.addEventListener('scroll', handleScroll);
    return () => tracksViewport.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  // 處理拖曳開始
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // 處理拖曳中和結束
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      
      // 計算相對於時間軸內容的 X 位置 (考慮滾動偏移)
      const x = e.clientX - rect.left + scrollLeft;
      
      // 轉換為時間 (秒)
      let newTime = x / pixelsPerSecond;
      
      // 限制在 0 ~ duration 範圍內
      newTime = Math.max(0, Math.min(newTime, duration));
      
      onSeek(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerRef, pixelsPerSecond, onSeek, duration]);

  // 自動滾動跟隨播放頭
  useEffect(() => {
    if (!containerRef.current || isDragging) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    
    // 如果播放頭超出可視範圍右側,自動滾動
    if (playheadX > scrollLeft + containerWidth - 100) {
      container.scrollLeft = playheadX - containerWidth + 100;
    }
    
    // 如果播放頭超出可視範圍左側,自動滾動
    if (playheadX < scrollLeft + 100) {
      container.scrollLeft = Math.max(0, playheadX - 100);
    }
  }, [currentTime, playheadX, containerRef, isDragging]);

  // OpenCut 標準: 播放頭延伸整個時間軸高度 (標尺 + 所有軌道)
  const totalHeight = timelineHeight - 4; // 留 4px 呼吸空間

  return (
    <>
      {/* 寬點擊區域 - 透明背景,左右各延伸 8px,確保好點擊 */}
      <div
        ref={playheadRef}
        className="absolute cursor-col-resize z-40"
        style={{
          left: `${playheadX - 8}px`, // 左邊延伸 8px
          top: 0,
          height: `${totalHeight}px`,
          width: '16px', // 總寬度 16px (左右各 8px)
        }}
        onMouseDown={handleMouseDown}
      />
      
      {/* 垂直紅線 - 純視覺效果,不接收點擊 (pointer-events-none) */}
      <div
        className={`absolute pointer-events-none z-40 ${
          isDragging ? 'bg-red-600 w-1' : 'bg-red-500 w-0.5'
        }`}
        style={{
          left: `${playheadX}px`,
          top: 0,
          height: `${totalHeight}px`,
        }}
      />
      
      {/* 頂部圓點 - 獨立可點擊 */}
      <div
        className={`absolute w-3 h-3 rounded-full border-2 transition-colors cursor-col-resize z-40 ${
          isDragging
            ? 'bg-red-600 border-red-400'
            : 'bg-red-500 border-red-300'
        }`}
        style={{
          left: `${playheadX - 6}px`, // 6px = 3px (圓點半徑) + 3px (微調)
          top: '4px',
        }}
        onMouseDown={handleMouseDown}
      />
      
      {/* 拖曳時顯示當前時間 */}
      {isDragging && (
        <div
          className="absolute bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50"
          style={{
            left: `${playheadX}px`,
            top: '20px',
            transform: 'translateX(-50%)',
          }}
        >
          {formatTime(currentTime)}
        </div>
      )}
    </>
  );
}

// 格式化時間 (HH:MM:SS)
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}