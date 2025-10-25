'use client';

import { useState, useRef, useEffect } from 'react';
import { useSubtitleStore } from '../stores/subtitle-store';
import { Upload, FileText, Download, Languages, Trash2, Scissors, Film, Edit3 } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import SubtitlePropertiesPanel from '../components/SubtitlePropertiesPanel';
import BulkSubtitleEditor from '../components/BulkSubtitleEditor';
import VideoPlaybackControls from '../components/VideoPlaybackControls';
import SubtitlePlayhead from '../components/SubtitlePlayhead';
import TimelineTabBar from '../components/TimelineTabBar';

export default function EditorProPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [targetLang, setTargetLang] = useState('zh-TW');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPositionX, setDragStartPositionX] = useState(50);
  const [dragStartPositionY, setDragStartPositionY] = useState(0);
  const [applyToAll, setApplyToAll] = useState(false);
  const [timelineDragState, setTimelineDragState] = useState<{
    isDragging: boolean;
    dragType: 'left' | 'right' | 'move' | null;
    segmentId: string | null;
    startMouseX: number;
    startTime: { start: number; end: number };
    clickOffsetTime: number;
  }>({
    isDragging: false,
    dragType: null,
    segmentId: null,
    startMouseX: 0,
    startTime: { start: 0, end: 0 },
    clickOffsetTime: 0,
  });
  const [resizeDragType, setResizeDragType] = useState<'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right' | null>(null);
  const [resizeDragStart, setResizeDragStart] = useState({ x: 0, y: 0, scale: 1, maxWidth: 80 });
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [videoDisplaySize, setVideoDisplaySize] = useState({ width: 1920, height: 1080 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null); // 整個時間軸容器 (用於計算播放頭高度)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);
  const trackLabelsScrollRef = useRef<HTMLDivElement | null>(null);
  const isUpdatingScrollRef = useRef(false);

  const { segments, importFromSrt, exportToSrt, clearAll, updateSegment, selectSegment } = useSubtitleStore();

  // 取得當前播放的字幕
  const currentSubtitle = segments.find(
    seg => currentTime >= seg.startTime && currentTime <= seg.endTime
  );

  // 自動選中當前播放的字幕
  useEffect(() => {
    if (currentSubtitle && currentSubtitle.id !== selectedSegmentId) {
      setSelectedSegmentId(currentSubtitle.id);
      selectSegment(currentSubtitle.id);
    }
  }, [currentSubtitle, selectedSegmentId, selectSegment]);

  // 清理 URL
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // 更新播放時間和影片顯示尺寸
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // 更新影片實際渲染尺寸
      updateVideoDisplaySize();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleResize = () => updateVideoDisplaySize();

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    // 監聽 resize 來更新顯示尺寸
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(video);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      resizeObserver.disconnect();
    };
  }, [videoUrl]);

  // 更新影片實際顯示尺寸
  const updateVideoDisplaySize = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // 獲取影片實際渲染尺寸 (考慮 object-fit: contain)
    const videoRect = video.getBoundingClientRect();
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = videoRect.width / videoRect.height;
    
    let displayWidth, displayHeight;
    if (containerAspect > videoAspect) {
      // 容器更寬,影片高度填滿
      displayHeight = videoRect.height;
      displayWidth = displayHeight * videoAspect;
    } else {
      // 容器更高,影片寬度填滿
      displayWidth = videoRect.width;
      displayHeight = displayWidth / videoAspect;
    }
    
    setVideoDisplaySize({ width: displayWidth, height: displayHeight });
  };

  // 滾動同步 - 標尺和軌道內容水平同步
  useEffect(() => {
    // 使用 DOM 查詢來獲取元素
    const rulerScroll = document.getElementById('ruler-scroll');
    const tracksScroll = document.getElementById('tracks-scroll');
    const trackLabelsScroll = document.getElementById('track-labels-scroll');

    if (!rulerScroll || !tracksScroll) return;

    // 保存引用以便清理
    rulerScrollRef.current = rulerScroll as HTMLDivElement;
    tracksScrollRef.current = tracksScroll as HTMLDivElement;
    trackLabelsScrollRef.current = trackLabelsScroll as HTMLDivElement | null;

    // 水平滾動同步處理器
    const handleRulerScroll = () => {
      if (isUpdatingScrollRef.current) return;
      isUpdatingScrollRef.current = true;
      tracksScroll.scrollLeft = rulerScroll.scrollLeft;
      isUpdatingScrollRef.current = false;
    };

    const handleTracksScroll = () => {
      if (isUpdatingScrollRef.current) return;
      isUpdatingScrollRef.current = true;
      rulerScroll.scrollLeft = tracksScroll.scrollLeft;
      isUpdatingScrollRef.current = false;
    };

    // 垂直滾動同步處理器 (如果有多個軌道)
    let handleTrackLabelsScroll: (() => void) | null = null;
    let handleTracksVerticalScroll: (() => void) | null = null;

    if (trackLabelsScroll) {
      handleTrackLabelsScroll = () => {
        if (isUpdatingScrollRef.current) return;
        isUpdatingScrollRef.current = true;
        tracksScroll.scrollTop = trackLabelsScroll.scrollTop;
        isUpdatingScrollRef.current = false;
      };

      handleTracksVerticalScroll = () => {
        if (isUpdatingScrollRef.current) return;
        isUpdatingScrollRef.current = true;
        trackLabelsScroll.scrollTop = tracksScroll.scrollTop;
        isUpdatingScrollRef.current = false;
      };

      trackLabelsScroll.addEventListener('scroll', handleTrackLabelsScroll);
      tracksScroll.addEventListener('scroll', handleTracksVerticalScroll);
    }

    rulerScroll.addEventListener('scroll', handleRulerScroll);
    tracksScroll.addEventListener('scroll', handleTracksScroll);

    return () => {
      rulerScroll.removeEventListener('scroll', handleRulerScroll);
      tracksScroll.removeEventListener('scroll', handleTracksScroll);
      if (trackLabelsScroll && handleTrackLabelsScroll && handleTracksVerticalScroll) {
        trackLabelsScroll.removeEventListener('scroll', handleTrackLabelsScroll);
        tracksScroll.removeEventListener('scroll', handleTracksVerticalScroll);
      }
    };
  }, [duration, segments.length]); // 當 duration 或 segments 變化時重新綁定

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const handleSrtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const content = await file.text();
      importFromSrt(content);
    }
  };

  const handleWhisperTranscribe = async () => {
    if (!videoFile) {
      alert('請先上傳影片');
      return;
    }

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', videoFile);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.srtContent) {
        importFromSrt(data.srtContent);
        alert('字幕識別完成!');
      } else {
        alert('字幕識別失敗,請檢查 Whisper 是否已安裝');
      }
    } catch (error) {
      console.error('轉錄失敗:', error);
      alert('轉錄失敗,請確認 Whisper 已正確安裝');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranslateAll = async () => {
    if (segments.length === 0) return;

    setIsTranslating(true);
    try {
      const texts = segments.map(seg => seg.text);

      const response = await fetch('/api/translate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts,
          targetLang,
          sourceLang: 'auto',
        }),
      });

      const data = await response.json();

      if (data.success) {
        data.translations.forEach((translation: any, index: number) => {
          if (translation.success) {
            updateSegment(segments[index].id, {
              translatedText: translation.translatedText,
            });
          }
        });
        alert('翻譯完成!');
      }
    } catch (error) {
      console.error('翻譯失敗:', error);
      alert('翻譯失敗,請稍後再試');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownloadSrt = () => {
    const srtContent = exportToSrt();
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportVideo = async () => {
    if (!videoFile || segments.length === 0) {
      alert('請先上傳影片並添加字幕');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('subtitles', JSON.stringify(segments));

      // 模擬進度
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/burn-subtitles', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setExportProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '輸出失敗');
      }

      // 下載影片
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subtitled_video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('影片輸出完成!');
    } catch (error: any) {
      console.error('輸出失敗:', error);
      alert(`輸出失敗: ${error.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSkipToStart = () => {
    seekTo(0);
  };

  const handleToggleBookmark = () => {
    const roundedTime = Math.floor(currentTime * 10) / 10;
    setBookmarks(prev =>
      prev.includes(roundedTime)
        ? prev.filter(t => t !== roundedTime)
        : [...prev, roundedTime]
    );
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    
    // 獲取點擊位置相對於時間軸容器的座標
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // 獲取滾動容器的 scrollLeft
    const tracksScroll = tracksScrollRef.current;
    const scrollLeft = tracksScroll ? tracksScroll.scrollLeft : 0;
    
    // 計算實際的時間位置 (考慮滾動偏移)
    const pixelsPerSecond = 50 * zoomLevel;
    const newTime = Math.max(0, Math.min(duration, (clickX + scrollLeft) / pixelsPerSecond));
    
    seekTo(newTime);
  };

  const handleSegmentClick = (segmentId: string, startTime: number) => {
    setSelectedSegmentId(segmentId);
    selectSegment(segmentId);
    seekTo(startTime);
  };

  const handleSubtitleDragStart = (e: React.MouseEvent) => {
    if (!currentSubtitle) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
    setDragStartPositionX(currentSubtitle.style.positionX);
    setDragStartPositionY(currentSubtitle.style.positionY);
  };

  const handleSubtitleDrag = (e: React.MouseEvent) => {
    if (!isDragging || !currentSubtitle) return;
    
    const previewContainer = e.currentTarget.parentElement?.parentElement;
    if (!previewContainer) return;
    
    const rect = previewContainer.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    const percentChangeX = (deltaX / rect.width) * 100;
    const percentChangeY = (deltaY / rect.height) * 100;
    
    // 允許超出範圍 (-50 到 150),讓字幕可以移動到影片外
    const newPositionX = Math.max(-50, Math.min(150, dragStartPositionX + percentChangeX));
    const newPositionY = Math.max(-50, Math.min(150, dragStartPositionY + percentChangeY));
    
    if (applyToAll) {
      // 套用到所有字幕
      segments.forEach(seg => {
        updateSegment(seg.id, {
          style: {
            ...seg.style,
            positionX: Math.round(newPositionX),
            positionY: Math.round(newPositionY)
          },
        });
      });
    } else {
      // 只更新當前字幕
      updateSegment(currentSubtitle.id, {
        style: {
          ...currentSubtitle.style,
          positionX: Math.round(newPositionX),
          positionY: Math.round(newPositionY)
        },
      });
    }
  };

  const handleSubtitleDragEnd = () => {
    setIsDragging(false);
  };

  // 字幕縮放拖曳處理
  const handleResizeDragStart = (e: React.MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right') => {
    if (!currentSubtitle) return;
    e.stopPropagation();
    setResizeDragType(corner);
    setResizeDragStart({
      x: e.clientX,
      y: e.clientY,
      scale: currentSubtitle.style.scale,
      maxWidth: currentSubtitle.style.maxWidth,
    });
  };

  const handleResizeDrag = (e: React.MouseEvent) => {
    if (!resizeDragType || !currentSubtitle) return;

    const deltaX = e.clientX - resizeDragStart.x;
    const deltaY = e.clientY - resizeDragStart.y;
    
    // 左右拖曳調整最大寬度 (允許文字框拉寬)
    if (resizeDragType === 'left' || resizeDragType === 'right') {
      const previewContainer = e.currentTarget.parentElement?.parentElement;
      if (!previewContainer) return;
      
      const rect = previewContainer.getBoundingClientRect();
      // 根據拖曳方向調整寬度變化計算
      const direction = resizeDragType === 'right' ? 1 : -1;
      const widthChange = (deltaX * direction / rect.width) * 100;
      // 允許調整範圍 10-100 vw
      const newMaxWidth = Math.max(10, Math.min(100, resizeDragStart.maxWidth + widthChange));
      
      if (applyToAll) {
        segments.forEach(seg => {
          updateSegment(seg.id, {
            style: { ...seg.style, maxWidth: Math.round(newMaxWidth) },
          });
        });
      } else {
        updateSegment(currentSubtitle.id, {
          style: { ...currentSubtitle.style, maxWidth: Math.round(newMaxWidth) },
        });
      }
    } else {
      // 四角拖曳調整縮放
      const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const direction = (deltaX + deltaY) > 0 ? 1 : -1;
      const scaleChange = (direction * delta) / 200;
      
      const newScale = Math.max(0.5, Math.min(3.0, resizeDragStart.scale + scaleChange));

      if (applyToAll) {
        segments.forEach(seg => {
          updateSegment(seg.id, {
            style: { ...seg.style, scale: newScale },
          });
        });
      } else {
        updateSegment(currentSubtitle.id, {
          style: { ...currentSubtitle.style, scale: newScale },
        });
      }
    }
  };

  const handleResizeDragEnd = () => {
    setResizeDragType(null);
  };

  // 時間軸字幕區塊拖曳處理 - OpenCut 風格 (document-level listeners)
  const handleTimelineDragStart = (
    e: React.MouseEvent,
    segmentId: string,
    dragType: 'left' | 'right' | 'move'
  ) => {
    e.stopPropagation();
    const segment = segments.find(s => s.id === segmentId);
    if (!segment || !timelineRef.current) return;

    // 計算 click offset (關鍵: 讓拖曳時元素不會跳動)
    let clickOffsetTime = 0;
    if (dragType === 'move') {
      const elementRect = (e.target as HTMLElement).getBoundingClientRect();
      const clickOffsetX = e.clientX - elementRect.left;
      const pixelsPerSecond = 50 * zoomLevel;
      clickOffsetTime = clickOffsetX / pixelsPerSecond;
    }

    setTimelineDragState({
      isDragging: true,
      dragType,
      segmentId,
      startMouseX: e.clientX,
      startTime: { start: segment.startTime, end: segment.endTime },
      clickOffsetTime,
    });
  };

  const handleTimelineDragEnd = () => {
    setTimelineDragState({
      isDragging: false,
      dragType: null,
      segmentId: null,
      startMouseX: 0,
      startTime: { start: 0, end: 0 },
      clickOffsetTime: 0,
    });
  };

  // Document-level mouse listeners (OpenCut 核心機制)
  useEffect(() => {
    if (!timelineDragState.isDragging || !timelineRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const pixelsPerSecond = 50 * zoomLevel;
      const deltaX = e.clientX - timelineDragState.startMouseX;
      const deltaTime = deltaX / pixelsPerSecond;

      const segment = segments.find(s => s.id === timelineDragState.segmentId);
      if (!segment) return;

      // Frame snapping (對齊到 30fps 影格)
      const fps = 30;
      const snapTimeToFrame = (time: number) => {
        return Math.round(time * fps) / fps;
      };

      if (timelineDragState.dragType === 'left') {
        // 拖曳左邊緣,調整 startTime
        let newStartTime = snapTimeToFrame(Math.max(0, timelineDragState.startTime.start + deltaTime));
        if (newStartTime < segment.endTime) {
          updateSegment(timelineDragState.segmentId!, { startTime: newStartTime });
        }
      } else if (timelineDragState.dragType === 'right') {
        // 拖曳右邊緣,調整 endTime
        let newEndTime = snapTimeToFrame(Math.min(duration, timelineDragState.startTime.end + deltaTime));
        if (newEndTime > segment.startTime) {
          updateSegment(timelineDragState.segmentId!, { endTime: newEndTime });
        }
      } else if (timelineDragState.dragType === 'move') {
        // 整體移動 (使用 clickOffsetTime 避免跳動)
        const timelineRect = timelineRef.current.getBoundingClientRect();
        const tracksScroll = tracksScrollRef.current;
        const scrollLeft = tracksScroll ? tracksScroll.scrollLeft : 0;
        
        const mouseX = e.clientX - timelineRect.left + scrollLeft;
        const mouseTime = mouseX / pixelsPerSecond;
        const adjustedTime = Math.max(0, mouseTime - timelineDragState.clickOffsetTime);
        const snappedTime = snapTimeToFrame(adjustedTime);

        const segmentDuration = timelineDragState.startTime.end - timelineDragState.startTime.start;
        let newStartTime = snappedTime;
        let newEndTime = snappedTime + segmentDuration;

        // 確保不超出範圍
        if (newStartTime < 0) {
          newStartTime = 0;
          newEndTime = segmentDuration;
        } else if (newEndTime > duration) {
          newEndTime = duration;
          newStartTime = duration - segmentDuration;
        }

        updateSegment(timelineDragState.segmentId!, {
          startTime: newStartTime,
          endTime: newEndTime,
        });
      }
    };

    const handleMouseUp = () => {
      handleTimelineDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [timelineDragState, segments, duration, zoomLevel, updateSegment]);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* 頂部工具列 */}
      <header className="h-10 border-b border-gray-800 flex items-center px-3 gap-1.5 bg-gray-900">
        <h1 className="text-sm font-bold mr-2">OpenCut 字幕編輯器</h1>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition text-xs"
        >
          <Upload size={12} />
          上傳影片
        </button>

        <button
          onClick={() => srtInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition text-xs"
        >
          <FileText size={12} />
          匯入 SRT
        </button>

        <button
          onClick={handleWhisperTranscribe}
          disabled={!videoFile || isTranscribing}
          className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Scissors size={12} />
          {isTranscribing ? 'AI 識別中...' : 'Whisper 識別'}
        </button>

        <div className="h-5 w-px bg-gray-700 mx-1" />

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
        >
          <option value="zh-TW">繁體中文</option>
          <option value="zh-CN">簡體中文</option>
          <option value="en">英文</option>
          <option value="ja">日文</option>
          <option value="ko">韓文</option>
        </select>

        <button
          onClick={handleTranslateAll}
          disabled={segments.length === 0 || isTranslating}
          className="flex items-center gap-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Languages size={12} />
          {isTranslating ? '翻譯中...' : '翻譯全部'}
        </button>

        <button
          onClick={handleDownloadSrt}
          disabled={segments.length === 0}
          className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={12} />
          下載 SRT
        </button>

        <div className="h-5 w-px bg-gray-700 mx-1" />

        <button
          onClick={() => setShowBulkEditor(true)}
          disabled={segments.length === 0}
          className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Edit3 size={12} />
          批量編輯
        </button>

        <button
          onClick={handleExportVideo}
          disabled={!videoFile || segments.length === 0 || isExporting}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Film size={12} />
          {isExporting ? `輸出中 ${exportProgress}%` : '輸出影片'}
        </button>

        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 rounded transition text-xs ml-auto"
        >
          <Trash2 size={12} />
          清空
        </button>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />
      <input
        ref={srtInputRef}
        type="file"
        accept=".srt"
        onChange={handleSrtUpload}
        className="hidden"
      />

      {/* 主要工作區 */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* 左側: 預覽面板 */}
          <Panel defaultSize={70} minSize={50}>
            <PanelGroup direction="vertical">
              {/* 影片預覽面板 */}
              <Panel defaultSize={70} minSize={30}>
                <div className="h-full flex flex-col bg-gray-900">
                  {/* 影片預覽區 */}
                  <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
                {!videoUrl ? (
                  <div className="text-center">
                    <Upload size={64} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-xl text-gray-500 mb-4">尚未上傳影片</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                    >
                      點擊上傳影片
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain"
                    />
                    
                    {/* 字幕疊加層 */}
                    {currentSubtitle && (
                      <div
                        className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
                      >
                        <div
                          className="absolute"
                          style={{
                            top: `${currentSubtitle.style.positionY}%`,
                            left: `${currentSubtitle.style.positionX}%`,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                          }}
                          onMouseMove={(e) => {
                            handleSubtitleDrag(e);
                            handleResizeDrag(e);
                          }}
                          onMouseUp={() => {
                            handleSubtitleDragEnd();
                            handleResizeDragEnd();
                          }}
                          onMouseLeave={() => {
                            handleSubtitleDragEnd();
                            handleResizeDragEnd();
                          }}
                        >
                          {/* 可拖曳縮放的容器 */}
                          <div
                            className="relative inline-block"
                            style={{
                              maxWidth: `${currentSubtitle.style.maxWidth}vw`,
                              pointerEvents: 'auto',
                            }}
                          >
                            {/* 字幕內容 */}
                            <div
                              className="rounded"
                              style={{
                                backgroundColor: currentSubtitle.style.backgroundColor,
                                opacity: currentSubtitle.style.opacity,
                                transform: `scale(${currentSubtitle.style.scale})`,
                                transformOrigin: 'center',
                                cursor: isDragging ? 'grabbing' : 'grab',
                                wordWrap: 'break-word',
                                whiteSpace: 'pre-wrap',
                                // padding 和 borderRadius 也需要相對縮放
                                padding: `${(8 / 1080) * videoDisplaySize.height}px ${(16 / 1080) * videoDisplaySize.height}px`,
                                borderRadius: `${(4 / 1080) * videoDisplaySize.height}px`,
                              }}
                              onMouseDown={handleSubtitleDragStart}
                            >
                              <p
                                className="text-center"
                                style={{
                                  // 字幕大小 = (fontSize * scale / 1080) * 實際影片高度
                                  // 包含 scale 的效果,確保與 ASS 輸出完全一致
                                  fontSize: `${(currentSubtitle.style.fontSize * currentSubtitle.style.scale / 1080) * videoDisplaySize.height}px`,
                                  fontFamily: currentSubtitle.style.fontFamily,
                                  fontWeight: currentSubtitle.style.fontWeight,
                                  fontStyle: currentSubtitle.style.fontStyle,
                                  textDecoration: currentSubtitle.style.textDecoration,
                                  color: currentSubtitle.style.color,
                                  textShadow: currentSubtitle.style.enableShadow
                                    ? `${(currentSubtitle.style.shadowOffsetX / 1080) * videoDisplaySize.height}px ${(currentSubtitle.style.shadowOffsetY / 1080) * videoDisplaySize.height}px ${(currentSubtitle.style.shadowBlur / 1080) * videoDisplaySize.height}px ${currentSubtitle.style.shadowColor}`
                                    : 'none',
                                }}
                              >
                                {currentSubtitle.translatedText || currentSubtitle.text}
                              </p>
                            </div>

                            {/* 邊框和手柄容器 - 不受 scale 影響 */}
                            <div className="absolute inset-0 pointer-events-none">
                              {/* 虛線邊框 */}
                              <div className="absolute inset-0 border-2 border-dashed border-white/40" />

                              {/* 四個角的縮放手柄 - 固定大小 */}
                              <div
                                className="absolute -top-2 -left-2 w-4 h-4 bg-white rounded-full cursor-nwse-resize z-20 pointer-events-auto hover:scale-125 transition-transform"
                                onMouseDown={(e) => handleResizeDragStart(e, 'tl')}
                              />
                              <div
                                className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full cursor-nesw-resize z-20 pointer-events-auto hover:scale-125 transition-transform"
                                onMouseDown={(e) => handleResizeDragStart(e, 'tr')}
                              />
                              <div
                                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white rounded-full cursor-nesw-resize z-20 pointer-events-auto hover:scale-125 transition-transform"
                                onMouseDown={(e) => handleResizeDragStart(e, 'bl')}
                              />
                              <div
                                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full cursor-nwse-resize z-20 pointer-events-auto hover:scale-125 transition-transform"
                                onMouseDown={(e) => handleResizeDragStart(e, 'br')}
                              />

                              {/* 左右兩側的寬度調整手柄 - 固定大小 */}
                              <div
                                className="absolute top-1/2 -left-2 w-4 h-10 bg-blue-500 rounded cursor-ew-resize z-20 pointer-events-auto hover:bg-blue-400 transition-colors"
                                style={{ transform: 'translateY(-50%)' }}
                                onMouseDown={(e) => handleResizeDragStart(e, 'left')}
                              />
                              <div
                                className="absolute top-1/2 -right-2 w-4 h-10 bg-blue-500 rounded cursor-ew-resize z-20 pointer-events-auto hover:bg-blue-400 transition-colors"
                                style={{ transform: 'translateY(-50%)' }}
                                onMouseDown={(e) => handleResizeDragStart(e, 'right')}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
                </div>
              </Panel>

              {/* 垂直調整手柄 */}
              <PanelResizeHandle className="h-1 bg-gray-800 hover:bg-blue-600 transition cursor-row-resize" />
  
              {/* 時間軸面板 */}
              <Panel defaultSize={30} minSize={15} maxSize={50}>
                <div className="h-full flex flex-col bg-gray-900">
                  {/* 播放控制列 */}
                  <VideoPlaybackControls
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    onPlayPause={togglePlayPause}
                    onSeek={seekTo}
                    onSkipToStart={handleSkipToStart}
                    bookmarks={bookmarks}
                    onToggleBookmark={handleToggleBookmark}
                    zoomLevel={zoomLevel}
                    onZoomIn={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
                    onZoomOut={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
                    onZoomChange={setZoomLevel}
                    fps={30}
                    showBookmarks={true}
                  />
  
                  {/* 時間軸容器 - 採用 OpenCut 的三欄佈局 + 左側工具列 */}
                  <div
                    ref={timelineContainerRef}
                    className="flex-1 flex overflow-hidden relative"
                  >
                    {/* 左側垂直工具列 - OpenCut 風格 */}
                    <TimelineTabBar />
                    
                    {/* 時間軸內容區 */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 時間標尺區 */}
                    <div className="flex bg-gray-900 sticky top-0 z-10 border-b border-gray-800">
                      {/* 左側空白區 (對應軌道標籤寬度) */}
                      <div className="w-20 shrink-0 bg-gray-900 border-r border-gray-800 flex items-center justify-between px-2 py-1">
                        <span className="text-xs font-medium text-gray-600 opacity-0">.</span>
                      </div>
                      
                      {/* 時間標尺 */}
                      <div
                        className="flex-1 relative overflow-hidden h-8"
                        data-ruler-area="true"
                      >
                        <div className="overflow-auto scrollbar-thin w-full" id="ruler-scroll">
                          <div
                            className="relative h-8 select-none cursor-default"
                            style={{
                              width: `${Math.max(duration * 50 * zoomLevel, 1500)}px`,
                            }}
                            onClick={handleTimelineClick}
                          >
                            {/* 時間標記 */}
                            {duration > 0 && (() => {
                              const pixelsPerSecond = 50 * zoomLevel;
                              const getTimeInterval = (zoom: number) => {
                                const pps = 50 * zoom;
                                if (pps >= 200) return 0.1;
                                if (pps >= 100) return 0.5;
                                if (pps >= 50) return 1;
                                if (pps >= 25) return 2;
                                if (pps >= 12) return 5;
                                if (pps >= 6) return 10;
                                return 30;
                              };
                              
                              const interval = getTimeInterval(zoomLevel);
                              const markerCount = Math.ceil(duration / interval) + 1;
                              
                              return Array.from({ length: markerCount }, (_, i) => {
                                const time = i * interval;
                                if (time > duration) return null;
                                
                                return (
                                  <div
                                    key={i}
                                    className="absolute top-0 h-3 border-l border-gray-600"
                                    style={{ left: `${time * pixelsPerSecond}px` }}
                                  >
                                    <span className="absolute top-0.5 left-1 text-[0.55rem] text-gray-400 font-medium">
                                      {Math.floor(time)}s
                                    </span>
                                  </div>
                                );
                              }).filter(Boolean);
                            })()}
                            
                            {/* 書籤標記 */}
                            {bookmarks.map((bookmarkTime, i) => (
                              <div
                                key={`bookmark-${i}`}
                                className="absolute top-0 h-8 w-0.5 bg-blue-500 cursor-pointer"
                                style={{
                                  left: `${bookmarkTime * 50 * zoomLevel}px`,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seekTo(bookmarkTime);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 軌道區域 */}
                    <div className="flex-1 flex overflow-hidden">
                      {/* 軌道標籤 */}
                      <div
                        className="w-20 shrink-0 border-r border-gray-800 overflow-y-auto z-100 bg-gray-900"
                        data-track-labels="true"
                      >
                        <div className="overflow-auto scrollbar-thin w-full h-full" id="track-labels-scroll">
                          <div className="flex flex-col gap-1">
                            {/* 字幕軌道標籤 */}
                            <div
                              className="flex items-center px-2 group"
                              style={{ height: '60px' }}
                            >
                              <div className="flex items-center justify-end flex-1 min-w-0 gap-1">
                                <span className="text-[0.65rem] text-gray-400">字幕</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 軌道內容 */}
                      <div className="flex-1 relative overflow-hidden">
                        <div className="overflow-auto scrollbar-thin w-full h-full" id="tracks-scroll">
                          <div
                            ref={timelineRef}
                            className="relative flex-1"
                            style={{
                              height: '60px',
                              width: `${Math.max(duration * 50 * zoomLevel, 1500)}px`,
                            }}
                            onClick={handleTimelineClick}
                          >
                            {/* SubtitlePlayhead 元件 - OpenCut 風格播放頭 (延伸到底部) */}
                            {duration > 0 && (
                              <SubtitlePlayhead
                                currentTime={currentTime}
                                pixelsPerSecond={50 * zoomLevel}
                                containerRef={tracksScrollRef}
                                onSeek={seekTo}
                                duration={duration}
                                timelineRef={timelineContainerRef}
                              />
                            )}
                            
                            {/* 字幕軌道 */}
                            <div className="absolute left-0 right-0 top-0" style={{ height: '60px' }}>
                              <div className="w-full h-full hover:bg-gray-800/20">
                                <div className="h-full relative track-elements-container min-w-full">
                                  {/* 字幕片段 */}
                                  {segments.map((segment) => {
                                    const left = segment.startTime * 50 * zoomLevel;
                                    const width = (segment.endTime - segment.startTime) * 50 * zoomLevel;
                                    const isSelected = selectedSegmentId === segment.id;
                                    
                                    return (
                                      <div
                                        key={segment.id}
                                        className={`absolute top-1 h-14 rounded-[0.5rem] border transition group ${
                                          isSelected
                                            ? 'bg-yellow-600 border-yellow-400'
                                            : 'bg-[#5DBAA0] hover:bg-[#5DBAA0]/80 border-[#5DBAA0]'
                                        }`}
                                        style={{
                                          left: `${left}px`,
                                          width: `${Math.max(width, 80)}px`,
                                        }}
                                      >
                                        {/* 左邊緣拖曳手柄 - OpenCut 風格 */}
                                        <div
                                          className="absolute left-0 top-0 bottom-0 w-[0.6rem] cursor-w-resize bg-primary z-50 flex items-center justify-center hover:bg-primary/80 transition"
                                          onMouseDown={(e) => handleTimelineDragStart(e, segment.id, 'left')}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isSelected && (
                                            <div className="w-[0.2rem] h-[1.5rem] bg-foreground/75 rounded-full" />
                                          )}
                                        </div>
                                        
                                        {/* 中間區域:點擊選中,拖曳移動 */}
                                        <div
                                          className="h-full flex items-center justify-center p-0.5 cursor-move"
                                          onMouseDown={(e) => handleTimelineDragStart(e, segment.id, 'move')}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSegmentClick(segment.id, segment.startTime);
                                          }}
                                        >
                                          <span className="text-[0.65rem] text-white truncate">
                                            {segment.text}
                                          </span>
                                        </div>
                                        
                                        {/* 右邊緣拖曳手柄 - OpenCut 風格 */}
                                        <div
                                          className="absolute right-0 top-0 bottom-0 w-[0.6rem] cursor-e-resize bg-primary z-50 flex items-center justify-center hover:bg-primary/80 transition"
                                          onMouseDown={(e) => handleTimelineDragStart(e, segment.id, 'right')}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isSelected && (
                                            <div className="w-[0.2rem] h-[1.5rem] bg-foreground/75 rounded-full" />
                                          )}
                                        </div>
                                        
                                        {/* 時間提示 */}
                                        <div className="absolute -top-5 left-0 bg-gray-800 text-[0.65rem] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                          {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div> {/* 結束時間軸內容區 */}
                  </div> {/* 結束時間軸容器 */}
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-600 transition" />

          {/* 右側: 字幕屬性編輯面板 */}
          <Panel defaultSize={30} minSize={25}>
            <div className="h-full flex flex-col bg-gray-900">
              <div className="h-9 border-b border-gray-800 flex items-center px-3">
                <h2 className="text-sm font-semibold">
                  字幕屬性
                </h2>
              </div>

              <SubtitlePropertiesPanel
                selectedSegmentId={selectedSegmentId}
                applyToAll={applyToAll}
                setApplyToAll={setApplyToAll}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* 批量編輯彈窗 */}
      <BulkSubtitleEditor
        isOpen={showBulkEditor}
        onClose={() => setShowBulkEditor(false)}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}