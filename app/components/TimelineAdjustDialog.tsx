'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { SubtitleSegment } from '../stores/subtitle-store';

interface TimelineAdjustDialogProps {
  segment: SubtitleSegment;
  videoDuration: number;
  currentTime: number;
  videoUrl: string | null;
  mainVideoRef?: React.RefObject<HTMLVideoElement>; // 主頁面的視頻ref
  onClose: () => void;
  onConfirm: (startTime: number, endTime: number) => void;
}

export default function TimelineAdjustDialog({
  segment,
  videoDuration,
  currentTime: initialCurrentTime,
  videoUrl,
  mainVideoRef,
  onClose,
  onConfirm,
}: TimelineAdjustDialogProps) {
  const [tempStartTime, setTempStartTime] = useState(segment.startTime);
  const [tempEndTime, setTempEndTime] = useState(segment.endTime);
  const [zoomLevel, setZoomLevel] = useState(2); // 彈窗時間軸預設放大2倍
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'left' | 'right' | 'move' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState({ start: 0, end: 0 });
  const [clickOffsetTime, setClickOffsetTime] = useState(0);

  // 視頻播放狀態
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialCurrentTime);

  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const pixelsPerSecond = 100 * zoomLevel; // 基準100px/秒，可縮放
  const MIN_DURATION = 0.1; // 最小持續時間0.1秒

  // 格式化時間顯示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  // 對齊到幀（30fps）
  const snapToFrame = (time: number): number => {
    const fps = 30;
    return Math.round(time * fps) / fps;
  };

  // 計算字幕條位置和寬度
  const segmentLeft = tempStartTime * pixelsPerSecond;
  const segmentWidth = Math.max((tempEndTime - tempStartTime) * pixelsPerSecond, 80);
  const timelineWidth = videoDuration * pixelsPerSecond;

  // 處理拖拽開始
  const handleDragStart = (e: React.MouseEvent, type: 'left' | 'right' | 'move') => {
    e.stopPropagation(); // 阻止冒泡到時間軸點擊
    e.preventDefault(); // 阻止默認行為
    setIsDragging(true);
    setDragType(type);
    setDragStartX(e.clientX);
    setDragStartTime({ start: tempStartTime, end: tempEndTime });

    // 計算點擊偏移（用於移動模式）
    if (type === 'move' && timelineRef.current) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const clickOffsetX = e.clientX - rect.left;
      setClickOffsetTime(clickOffsetX / pixelsPerSecond);
    } else {
      setClickOffsetTime(0);
    }

    console.log('🎯 彈窗拖拽開始:', { type, startTime: tempStartTime, endTime: tempEndTime });
  };

  // Document-level 拖拽監聽
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / pixelsPerSecond;

      if (dragType === 'left') {
        // 拖動左邊緣
        let newStartTime = snapToFrame(Math.max(0, dragStartTime.start + deltaTime));
        // 確保不超過結束時間
        if (tempEndTime - newStartTime < MIN_DURATION) {
          newStartTime = tempEndTime - MIN_DURATION;
        }
        setTempStartTime(newStartTime);
      } else if (dragType === 'right') {
        // 拖動右邊緣
        let newEndTime = snapToFrame(Math.min(videoDuration, dragStartTime.end + deltaTime));
        // 確保不小於開始時間
        if (newEndTime - tempStartTime < MIN_DURATION) {
          newEndTime = tempStartTime + MIN_DURATION;
        }
        setTempEndTime(newEndTime);
      } else if (dragType === 'move') {
        // 整體移動
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollLeft = containerRef.current.scrollLeft;
        const mouseX = e.clientX - containerRect.left + scrollLeft;
        const mouseTime = mouseX / pixelsPerSecond;
        const adjustedTime = Math.max(0, mouseTime - clickOffsetTime);
        const snappedTime = snapToFrame(adjustedTime);

        const duration = dragStartTime.end - dragStartTime.start;
        let newStartTime = snappedTime;
        let newEndTime = snappedTime + duration;

        // 邊界檢查
        if (newStartTime < 0) {
          newStartTime = 0;
          newEndTime = duration;
        } else if (newEndTime > videoDuration) {
          newEndTime = videoDuration;
          newStartTime = videoDuration - duration;
        }

        setTempStartTime(newStartTime);
        setTempEndTime(newEndTime);
      }
    };

    const handleMouseUp = () => {
      console.log('✋ 彈窗拖拽結束');
      setIsDragging(false);
      setDragType(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragType, dragStartX, dragStartTime, tempStartTime, tempEndTime, pixelsPerSecond, videoDuration, clickOffsetTime]);

  // 微調功能
  const adjustTime = (delta: number, target: 'start' | 'end') => {
    if (target === 'start') {
      const newStartTime = snapToFrame(Math.max(0, Math.min(tempStartTime + delta, tempEndTime - MIN_DURATION)));
      setTempStartTime(newStartTime);
    } else {
      const newEndTime = snapToFrame(Math.max(tempStartTime + MIN_DURATION, Math.min(tempEndTime + delta, videoDuration)));
      setTempEndTime(newEndTime);
    }
  };

  // 視頻播放控制
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const jumpToStart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = tempStartTime;
    setCurrentTime(tempStartTime);
  };

  const jumpToEnd = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = tempEndTime;
    setCurrentTime(tempEndTime);
  };

  // 監聽視頻時間更新和初始化
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const mainVideo = mainVideoRef?.current;
    if (!video || !container) return;

    // 暫停主視頻並完全禁用
    let mainVideoWasPlaying = false;
    if (mainVideo && !mainVideo.paused) {
      mainVideoWasPlaying = true;
      mainVideo.pause();
      console.log('⏸️ 暫停主視頻');
    }

    // 阻止主視頻響應任何事件
    const blockMainVideoEvents = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('🚫 阻止主視頻事件');
      return false;
    };

    if (mainVideo) {
      mainVideo.style.pointerEvents = 'none';
      mainVideo.addEventListener('play', blockMainVideoEvents, true);
      mainVideo.addEventListener('pause', blockMainVideoEvents, true);
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    // 空白鍵控制播放/暫停 - 捕獲階段攔截
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        togglePlayPause();
        console.log('⌨️ 彈窗空白鍵切換播放');
      }
    };

    // 全局阻止空白鍵默認行為
    const blockGlobalSpace = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // 使用捕獲階段攔截，優先級最高
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', blockGlobalSpace, true);

    // 設置初始時間為字幕開始時間
    video.currentTime = tempStartTime;
    setCurrentTime(tempStartTime);

    // 自動滾動讓字幕居中顯示
    setTimeout(() => {
      const segmentCenter = segmentLeft + segmentWidth / 2;
      const containerWidth = container.clientWidth;
      const scrollTo = segmentCenter - containerWidth / 2;
      container.scrollLeft = Math.max(0, scrollTo);
      console.log('📍 自動跳到字幕位置:', tempStartTime);
    }, 100);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', blockGlobalSpace, true);

      // 恢復主視頻
      if (mainVideo) {
        mainVideo.style.pointerEvents = '';
        mainVideo.removeEventListener('play', blockMainVideoEvents, true);
        mainVideo.removeEventListener('pause', blockMainVideoEvents, true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [togglePlayPause]);

  // 同步到播放頭
  const syncToPlayhead = () => {
    const duration = tempEndTime - tempStartTime;
    setTempStartTime(currentTime);
    setTempEndTime(Math.min(currentTime + duration, videoDuration));
  };

  // 生成時間刻度
  const generateTicks = () => {
    const ticks = [];
    const tickInterval = zoomLevel >= 2 ? 1 : 5; // 縮放級別高時顯示每秒，否則每5秒

    for (let i = 0; i <= Math.ceil(videoDuration); i += tickInterval) {
      const left = i * pixelsPerSecond;
      ticks.push(
        <div key={i} className="absolute flex flex-col items-center" style={{ left: `${left}px` }}>
          <div className="h-2 w-px bg-gray-400" />
          <span className="text-[0.65rem] text-gray-400 mt-0.5">{formatTime(i).substring(0, 5)}</span>
        </div>
      );
    }
    return ticks;
  };

  // 點擊時間軸跳轉視頻並播放
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !videoRef.current) return;
    if (isDragging) return; // 拖拽時不觸發

    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const clickTime = Math.max(0, Math.min(clickX / pixelsPerSecond, videoDuration));

    videoRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);

    // 自動播放
    videoRef.current.play();
    setIsPlaying(true);

    console.log('⏱️ 點擊時間軸跳轉並播放:', clickTime);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-lg shadow-2xl w-[85vw] max-w-6xl max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題欄 */}
        <div className="h-12 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">精確調整字幕時間</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* 內容區 - 左右布局 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左側：視頻播放器 */}
          {videoUrl && (
            <div className="w-[45%] bg-black flex items-center justify-center p-4">
              <video
                ref={videoRef}
                src={videoUrl}
                className="max-w-full max-h-full object-contain"
                onClick={togglePlayPause}
              />
            </div>
          )}

          {/* 右側：控制和時間軸 */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* 播放控制 */}
            <div className="flex items-center justify-between bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition"
                title={isPlaying ? '暫停' : '播放'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={jumpToStart}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition"
                title="跳到字幕開始"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={jumpToEnd}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition"
                title="跳到字幕結束"
              >
                <SkipForward size={18} />
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">當前時間</p>
              <p className="text-lg font-mono text-[#5DBAA0]">{formatTime(currentTime)}</p>
            </div>
          </div>

          {/* 字幕文字顯示 */}
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">字幕內容：</p>
            <p className="text-white">{segment.text}</p>
          </div>

          {/* 時間軸區域 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">時間軸（拖動調整）：</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
                  className="p-1.5 hover:bg-gray-700 rounded transition"
                  title="縮小"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel(Math.min(5, zoomLevel + 0.5))}
                  className="p-1.5 hover:bg-gray-700 rounded transition"
                  title="放大"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>

            {/* 時間軸容器 */}
            <div
              ref={containerRef}
              className="bg-gray-800 rounded border border-gray-700 overflow-x-auto h-20"
              style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
              onClick={handleTimelineClick}
            >
              <div
                ref={timelineRef}
                className="relative h-full"
                style={{ width: `${timelineWidth}px`, minWidth: '100%' }}
              >
                {/* 時間刻度 */}
                <div className="absolute top-2 left-0 right-0 h-6">
                  {generateTicks()}
                </div>

                {/* 播放頭指示器 */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                  style={{ left: `${currentTime * pixelsPerSecond}px` }}
                >
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                </div>

                {/* 字幕條 */}
                <div
                  className="absolute top-8 h-10 bg-[#5DBAA0] rounded border-2 border-blue-500 shadow-lg group cursor-move"
                  style={{
                    left: `${segmentLeft}px`,
                    width: `${segmentWidth}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 左邊緣拖拽手柄 */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-4 cursor-w-resize bg-blue-600 hover:bg-blue-500 transition z-20 flex items-center justify-center"
                    onMouseDown={(e) => handleDragStart(e, 'left')}
                  >
                    <div className="w-1 h-6 bg-white/90 rounded-full" />
                  </div>

                  {/* 中間區域 */}
                  <div
                    className="h-full flex items-center justify-center px-5 cursor-move"
                    onMouseDown={(e) => handleDragStart(e, 'move')}
                  >
                    <span className="text-xs text-white font-medium truncate">
                      {segment.text}
                    </span>
                  </div>

                  {/* 右邊緣拖拽手柄 */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-4 cursor-e-resize bg-blue-600 hover:bg-blue-500 transition z-20 flex items-center justify-center"
                    onMouseDown={(e) => handleDragStart(e, 'right')}
                  >
                    <div className="w-1 h-6 bg-white/90 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 時間資訊 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded p-3 border border-gray-700 text-center">
              <p className="text-xs text-gray-400 mb-1">開始時間</p>
              <p className="text-lg font-mono text-[#5DBAA0]">{formatTime(tempStartTime)}</p>
            </div>
            <div className="bg-gray-800 rounded p-3 border border-gray-700 text-center">
              <p className="text-xs text-gray-400 mb-1">結束時間</p>
              <p className="text-lg font-mono text-[#5DBAA0]">{formatTime(tempEndTime)}</p>
            </div>
            <div className="bg-gray-800 rounded p-3 border border-gray-700 text-center">
              <p className="text-xs text-gray-400 mb-1">持續時間</p>
              <p className="text-lg font-mono text-white">{(tempEndTime - tempStartTime).toFixed(2)}秒</p>
            </div>
          </div>

          {/* 使用提示 */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded p-3">
            <p className="text-xs text-blue-300">
              💡 <strong>使用方法：</strong>播放視頻找到正確位置，然後拖動時間軸上的字幕條調整開始/結束時間<br/>
              ⌨️ <strong>快捷鍵：</strong>空白鍵 = 播放/暫停
            </p>
          </div>
          </div> {/* 右側內容結束 */}
        </div> {/* 左右布局結束 */}

        {/* 底部按鈕 */}
        <div className="h-16 border-t border-gray-700 flex items-center justify-end gap-3 px-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            取消
          </button>
          <button
            onClick={() => {
              console.log('✅ 確認調整:', { startTime: tempStartTime, endTime: tempEndTime });
              onConfirm(tempStartTime, tempEndTime);
              onClose();
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition font-medium"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
