'use client';

import { useEffect, useRef, useState } from 'react';

interface SubtitlePlayheadProps {
  /** 當前播放時間 (秒) */
  currentTime: number;
  /** 時間軸縮放級別 (像素/秒) */
  pixelsPerSecond: number;
  /** 時間軸容器 ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 當拖曳播放頭時的回調 */
  onSeek: (time: number) => void;
  /** 影片總長度 (秒) */
  duration: number;
}

export default function SubtitlePlayhead({
  currentTime,
  pixelsPerSecond,
  containerRef,
  onSeek,
  duration,
}: SubtitlePlayheadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);

  // 計算播放頭的 X 位置 (像素)
  const playheadX = currentTime * pixelsPerSecond;

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

  return (
    <div
      ref={playheadRef}
      className="absolute pointer-events-auto z-40"
      style={{
        left: `${playheadX}px`,
        top: 0,
        height: '100%',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 垂直紅線 */}
      <div 
        className={`absolute left-0 w-0.5 h-full cursor-col-resize transition-colors ${
          isDragging ? 'bg-red-500' : 'bg-foreground'
        }`}
      />
      
      {/* 頂部圓點 */}
      <div 
        className={`absolute top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-colors ${
          isDragging 
            ? 'bg-red-500 border-red-300' 
            : 'bg-foreground border-foreground/50'
        }`}
      />
      
      {/* 拖曳時顯示當前時間 */}
      {isDragging && (
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          {formatTime(currentTime)}
        </div>
      )}
    </div>
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