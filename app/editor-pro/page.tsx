'use client';

import { useState, useRef, useEffect } from 'react';
import { useSubtitleStore } from '../stores/subtitle-store';
import { Upload, FileText, Download, Languages, Trash2, Scissors, Film, Edit3, ArrowLeftToLine, ArrowRightToLine, SplitSquareHorizontal, Copy, Snowflake, Video, Music, Type, CaptionsIcon, Blend, Settings } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import SubtitlePropertiesPanel from '../components/SubtitlePropertiesPanel';
import BulkSubtitleEditor from '../components/BulkSubtitleEditor';
import SubtitlePlayhead from '../components/SubtitlePlayhead';

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
  const [draggingSubtitleId, setDraggingSubtitleId] = useState<string | null>(null);
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
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'sounds' | 'text' | 'captions' | 'filters' | 'settings'>('text');

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null); // 整個時間軸容器 (用於計算播放頭高度)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);
  const trackLabelsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null); // 標尺+軌道區的父容器 (不包含 Toolbar)
  const isUpdatingScrollRef = useRef(false);

  const {
    tracks,
    selectedTrackId,
    segments,
    importFromSrt,
    exportToSrt,
    clearAll,
    updateSegment,
    selectSegment,
    addTrack,
    deleteTrack,
    selectTrack,
    getAllSegments
  } = useSubtitleStore();

  // 取得當前播放的字幕 (從所有可見軌道中尋找)
  const allVisibleSegments = getAllSegments();
  const currentSubtitle = allVisibleSegments.find(
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
  }, [duration, tracks]); // 當 duration 或 tracks 變化時重新綁定 (tracks 是真正的 reactive state)

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
        console.log('🔍 API 回傳的 SRT 內容:', data.srtContent.substring(0, 500));
        importFromSrt(data.srtContent);
        
        // Debug: 檢查 store 狀態
        setTimeout(() => {
          const state = useSubtitleStore.getState();
          console.log('🔍 Store 狀態 - tracks:', state.tracks);
          console.log('🔍 Store 狀態 - selectedTrackId:', state.selectedTrackId);
          console.log('🔍 Store 狀態 - segments:', state.tracks[0]?.segments);
        }, 100);
        
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
    const currentSegments = tracks[0]?.segments || [];
    if (currentSegments.length === 0) return;

    setIsTranslating(true);
    try {
      const texts = currentSegments.map(seg => seg.text);

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
        console.log('🔍 翻譯結果:', data.translations);
        data.translations.forEach((translation: any, index: number) => {
          if (translation.success) {
            updateSegment(currentSegments[index].id, {
              translatedText: translation.translatedText,
            });
          }
        });
        
        // Debug: 檢查更新後的 store 狀態
        setTimeout(() => {
          const state = useSubtitleStore.getState();
          console.log('🔍 翻譯後 Store 狀態:', state.tracks[0]?.segments);
        }, 100);
        
        alert('翻譯完成!');
      } else {
        throw new Error(data.error || '翻譯失敗');
      }
    } catch (error) {
      console.error('翻譯失敗:', error);
      alert(`翻譯失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
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
    // 從 tracks 獲取實際的 segments (reactive state)
    const actualSegments = tracks[0]?.segments || [];
    if (!videoFile || actualSegments.length === 0) {
      alert('請先上傳影片並添加字幕');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('subtitles', JSON.stringify(actualSegments));

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
    setDraggingSubtitleId(currentSubtitle.id); // 記錄拖曳的字幕 ID
  };


  const handleSubtitleDragEnd = () => {
    setIsDragging(false);
    setDraggingSubtitleId(null);
  };

  // Document-level 字幕拖曳監聽 (確保滑鼠移出字幕時仍可拖曳)
  useEffect(() => {
    if (!isDragging || !draggingSubtitleId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const previewContainer = document.querySelector('video')?.parentElement;
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
        const allSegments = tracks[0]?.segments || [];
        allSegments.forEach(seg => {
          updateSegment(seg.id, {
            style: {
              ...seg.style,
              positionX: Math.round(newPositionX),
              positionY: Math.round(newPositionY)
            },
          });
        });
      } else {
        // 只更新拖曳開始時的那個字幕 (使用固定的 draggingSubtitleId)
        const draggingSegment = tracks[0]?.segments.find(s => s.id === draggingSubtitleId);
        if (draggingSegment) {
          updateSegment(draggingSubtitleId, {
            style: {
              ...draggingSegment.style,
              positionX: Math.round(newPositionX),
              positionY: Math.round(newPositionY)
            },
          });
        }
      }
    };

    const handleMouseUp = () => {
      handleSubtitleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, draggingSubtitleId, dragStartX, dragStartY, dragStartPositionX, dragStartPositionY, applyToAll, tracks, updateSegment]);

  // Document-level 字幕縮放拖曳監聽
  useEffect(() => {
    if (!resizeDragType || !draggingSubtitleId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeDragStart.x;
      const deltaY = e.clientY - resizeDragStart.y;
      
      // 左右拖曳調整最大寬度 (允許文字框拉寬)
      if (resizeDragType === 'left' || resizeDragType === 'right') {
        const previewContainer = document.querySelector('video')?.parentElement;
        if (!previewContainer) return;
        
        const rect = previewContainer.getBoundingClientRect();
        // 根據拖曳方向調整寬度變化計算
        const direction = resizeDragType === 'right' ? 1 : -1;
        const widthChange = (deltaX * direction / rect.width) * 100;
        // 允許調整範圍 10-100 vw
        const newMaxWidth = Math.max(10, Math.min(100, resizeDragStart.maxWidth + widthChange));
        
        if (applyToAll) {
          const allSegments = tracks[0]?.segments || [];
          allSegments.forEach(seg => {
            updateSegment(seg.id, {
              style: { ...seg.style, maxWidth: Math.round(newMaxWidth) },
            });
          });
        } else {
          const draggingSegment = tracks[0]?.segments.find(s => s.id === draggingSubtitleId);
          if (draggingSegment) {
            updateSegment(draggingSubtitleId, {
              style: { ...draggingSegment.style, maxWidth: Math.round(newMaxWidth) },
            });
          }
        }
      } else {
        // 四角拖曳調整縮放
        const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const direction = (deltaX + deltaY) > 0 ? 1 : -1;
        const scaleChange = (direction * delta) / 200;
        
        const newScale = Math.max(0.5, Math.min(3.0, resizeDragStart.scale + scaleChange));

        if (applyToAll) {
          const allSegments = tracks[0]?.segments || [];
          allSegments.forEach(seg => {
            updateSegment(seg.id, {
              style: { ...seg.style, scale: newScale },
            });
          });
        } else {
          const draggingSegment = tracks[0]?.segments.find(s => s.id === draggingSubtitleId);
          if (draggingSegment) {
            updateSegment(draggingSubtitleId, {
              style: { ...draggingSegment.style, scale: newScale },
            });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setResizeDragType(null);
      setDraggingSubtitleId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeDragType, draggingSubtitleId, resizeDragStart, applyToAll, tracks, updateSegment]);

  // 字幕縮放拖曳處理
  const handleResizeDragStart = (e: React.MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right') => {
    if (!currentSubtitle) return;
    e.stopPropagation();
    setResizeDragType(corner);
    setDraggingSubtitleId(currentSubtitle.id); // 記錄拖曳的字幕 ID
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
          disabled={tracks.length === 0 || tracks.every(t => t.segments.length === 0) || isTranslating}
          className="flex items-center gap-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Languages size={12} />
          {isTranslating ? '翻譯中...' : '翻譯全部'}
        </button>

        <button
          onClick={handleDownloadSrt}
          disabled={tracks.length === 0 || tracks.every(t => t.segments.length === 0)}
          className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={12} />
          下載 SRT
        </button>

        <div className="h-5 w-px bg-gray-700 mx-1" />

        <button
          onClick={() => setShowBulkEditor(true)}
          disabled={tracks.length === 0 || tracks.every(t => t.segments.length === 0)}
          className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Edit3 size={12} />
          批量編輯
        </button>

        <button
          onClick={handleExportVideo}
          disabled={!videoFile || (tracks.length > 0 && tracks[0]?.segments.length === 0) || isExporting}
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
          {/* 左側區域: 媒體面板 + 預覽 (帶時間軸) */}
          <Panel defaultSize={70} minSize={40}>
            <PanelGroup direction="vertical">
              {/* 上方: 媒體面板 + 預覽 */}
              <Panel defaultSize={70} minSize={30}>
                <PanelGroup direction="horizontal">
                  {/* 最左側: OpenCut 風格媒體面板 */}
                  <Panel defaultSize={20} minSize={15} maxSize={40}>
            <div className="h-full flex bg-panel rounded-sm">
              {/* TabBar - 左側垂直工具列 (簡化版 - 不顯示滾動條) */}
              <div className="flex relative">
                <div className="h-full px-4 flex flex-col justify-start items-center gap-5 overflow-hidden relative w-full py-4">
                  {/* Media - 影片 */}
                  <div
                    className={`flex z-[100] flex-col gap-0.5 items-center cursor-pointer ${
                      activeMediaTab === 'media' ? 'text-primary !opacity-100' : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveMediaTab('media')}
                    title="影片"
                  >
                    <Video className="size-[1.1rem] opacity-100 hover:opacity-75" />
                  </div>

                  {/* Sounds - 音樂 */}
                  <div
                    className={`flex z-[100] flex-col gap-0.5 items-center cursor-pointer ${
                      activeMediaTab === 'sounds' ? 'text-primary !opacity-100' : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveMediaTab('sounds')}
                    title="音樂"
                  >
                    <Music className="size-[1.1rem] opacity-100 hover:opacity-75" />
                  </div>

                  {/* Text - 文字 (預設啟用) */}
                  <div
                    className={`flex z-[100] flex-col gap-0.5 items-center cursor-pointer ${
                      activeMediaTab === 'text' ? 'text-primary !opacity-100' : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveMediaTab('text')}
                    title="文字"
                  >
                    <Type className="size-[1.1rem] opacity-100 hover:opacity-75" />
                  </div>

                  {/* Captions - 字幕 */}
                  <div
                    className={`flex z-[100] flex-col gap-0.5 items-center cursor-pointer ${
                      activeMediaTab === 'captions' ? 'text-primary !opacity-100' : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveMediaTab('captions')}
                    title="字幕"
                  >
                    <CaptionsIcon className="size-[1.1rem] opacity-100 hover:opacity-75" />
                  </div>

                  {/* Settings - 設定 */}
                  <div
                    className={`flex z-[100] flex-col gap-0.5 items-center cursor-pointer ${
                      activeMediaTab === 'settings' ? 'text-primary !opacity-100' : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveMediaTab('settings')}
                    title="設定"
                  >
                    <Settings className="size-[1.1rem] opacity-100 hover:opacity-75" />
                  </div>
                </div>
              </div>

              {/* 垂直分隔線 */}
              <div data-orientation="vertical" role="none" className="shrink-0 bg-border h-full w-px" />

              {/* 右側內容面板 */}
              <div className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="overflow-auto scrollbar-thin flex-1">
                    <div className="p-5">
                      {/* 預設文字樣板 */}
                      {activeMediaTab === 'text' && (
                        <div className="relative group w-28 h-28">
                          <div className="flex flex-col gap-1 p-1 h-auto w-full relative cursor-default">
                            <div data-radix-aspect-ratio-wrapper="" style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
                              <div className="bg-panel-accent relative overflow-hidden rounded-md" draggable="true" style={{ position: 'absolute', inset: '0px' }}>
                                <div className="flex items-center justify-center w-full h-full bg-panel-accent rounded">
                                  <span className="text-xs select-none">Default text</span>
                                </div>
                                <button className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm absolute bottom-2 right-2 size-5 bg-background hover:bg-panel text-foreground opacity-0 group-hover:opacity-100">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus size-4">
                                    <path d="M5 12h14" />
                                    <path d="M12 5v14" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {activeMediaTab !== 'text' && (
                        <div className="p-4 text-muted-foreground text-sm">
                          {activeMediaTab.charAt(0).toUpperCase() + activeMediaTab.slice(1)} 功能開發中...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-600 transition" />

                  <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-600 transition" />

                  {/* 中間: 預覽面板 */}
                  <Panel defaultSize={80} minSize={60}>
            <div className="h-full flex items-center justify-center bg-black overflow-hidden relative">
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
                          className="absolute pointer-events-auto"
                          style={{
                            top: `${currentSubtitle.style.positionY}%`,
                            left: `${currentSubtitle.style.positionX}%`,
                            transform: 'translate(-50%, -50%)',
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
                  </Panel>
                </PanelGroup>
              </Panel>

              {/* 垂直調整手柄 */}
              <PanelResizeHandle className="h-1 bg-gray-800 hover:bg-blue-600 transition cursor-row-resize" />

              {/* 底部: 時間軸面板 (只延伸到媒體+預覽區域) */}
              <Panel defaultSize={30} minSize={15} maxSize={50}>
                <div className="h-full flex flex-col bg-gray-900">
                  {/* OpenCut TimelineToolbar - 播放控制 + 編輯工具 + 縮放控制 */}
                  <div className="flex items-center justify-between px-2 py-1 border-b bg-zinc-900 h-8">
                    {/* 左側: 播放控制 + 編輯工具 */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={togglePlayPause}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title={isPlaying ? "暫停 (Space)" : "播放 (Space)"}
                      >
                        {isPlaying ? (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      
                      <button
                        onClick={handleSkipToStart}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title="跳到起點 (Home)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <polygon points="19 20 9 12 19 4 19 20" />
                          <line x1="5" x2="5" y1="19" y2="5" />
                        </svg>
                      </button>

                      <div className="w-px h-5 bg-zinc-700 mx-0.5" />

                      {/* 時間顯示 */}
                      <div className="flex items-center gap-1 px-1">
                        <span className="text-zinc-300 text-xs font-mono">
                          {formatTime(currentTime)}
                        </span>
                        <span className="text-zinc-500 text-xs font-mono">/</span>
                        <span className="text-zinc-400 text-xs font-mono">
                          {formatTime(duration)}
                        </span>
                      </div>

                      <div className="w-px h-5 bg-zinc-700 mx-0.5" />

                      {/* 編輯工具按鈕組 - OpenCut 風格 */}
                      <button
                        onClick={() => {
                          // TODO: 實現剪刀分割功能
                          console.log('Split at playhead:', currentTime);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title="在播放頭位置分割 (Ctrl+S)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="6" cy="6" r="3" />
                          <path d="M8.12 8.12 12 12" />
                          <path d="M20 4 8.12 15.88" />
                          <circle cx="6" cy="18" r="3" />
                          <path d="M14.8 14.8 20 20" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          // TODO: 實現分割並保留左側
                          console.log('Split and keep left');
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title="分割並保留左側 (Ctrl+Q)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M3 19V5" />
                          <path d="m13 6-6 6 6 6" />
                          <path d="M7 12h14" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          // TODO: 實現分割並保留右側
                          console.log('Split and keep right');
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title="分割並保留右側 (Ctrl+W)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M17 12H3" />
                          <path d="m11 18 6-6-6-6" />
                          <path d="M21 5v14" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          // TODO: 實現水平分割功能
                          console.log('Separate audio/split horizontal');
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title="水平分割 (Ctrl+D)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3" />
                          <path d="M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3" />
                          <line x1="12" x2="12" y1="4" y2="20" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          if (!selectedSegmentId) return;
                          const segment = segments.find(s => s.id === selectedSegmentId);
                          if (!segment) return;
                          
                          // 複製選中的字幕 (簡單實現: 在後面添加一個相同的)
                          const newStartTime = segment.endTime + 0.1;
                          const duration = segment.endTime - segment.startTime;
                          
                          console.log('Duplicate segment:', segment.id);
                          // TODO: 完整實現複製功能
                        }}
                        disabled={!selectedSegmentId}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="複製字幕 (Ctrl+D)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          // TODO: 實現凍結幀功能
                          console.log('Freeze frame');
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title="凍結幀 (F)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <line x1="2" x2="22" y1="12" y2="12" />
                          <line x1="12" x2="12" y1="2" y2="22" />
                          <path d="m20 16-4-4 4-4" />
                          <path d="m4 8 4 4-4 4" />
                          <path d="m16 4-4 4-4-4" />
                          <path d="m8 20 4-4 4 4" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          if (!selectedSegmentId) return;
                          // 刪除選中的字幕
                          const segmentToDelete = segments.find(s => s.id === selectedSegmentId);
                          if (segmentToDelete && window.confirm(`確定要刪除字幕「${segmentToDelete.text}」嗎?`)) {
                            // TODO: 實現刪除功能 (需要在 subtitle-store 添加 deleteSegment 方法)
                            console.log('Delete segment:', selectedSegmentId);
                          }
                        }}
                        disabled={!selectedSegmentId}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="刪除字幕 (Delete)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" x2="10" y1="11" y2="17" />
                          <line x1="14" x2="14" y1="11" y2="17" />
                        </svg>
                      </button>

                      <div className="w-px h-5 bg-zinc-700 mx-0.5" />

                      {/* 書籤按鈕 */}
                      <button
                        onClick={handleToggleBookmark}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
                        title={bookmarks.includes(Math.floor(currentTime * 10) / 10) ? "移除書籤" : "新增書籤"}
                      >
                        <svg
                          className={`w-3 h-3 ${bookmarks.includes(Math.floor(currentTime * 10) / 10) ? 'fill-blue-500 text-blue-500' : 'text-white'}`}
                          fill={bookmarks.includes(Math.floor(currentTime * 10) / 10) ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                        </svg>
                      </button>
                    </div>

                    {/* 右側: 縮放控制 */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setZoomLevel(Math.max(0.25, zoomLevel - 0.25))}
                        disabled={zoomLevel <= 0.25}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="縮小 (Ctrl + -)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                          <line x1="8" x2="14" y1="11" y2="11" />
                        </svg>
                      </button>

                      <input
                        type="range"
                        min="0.25"
                        max="4"
                        step="0.25"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                        title={`縮放: ${zoomLevel.toFixed(2)}x`}
                      />

                      <button
                        onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
                        disabled={zoomLevel >= 4}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="放大 (Ctrl + +)"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                          <line x1="11" x2="11" y1="8" y2="14" />
                          <line x1="8" x2="14" y1="11" y2="11" />
                        </svg>
                      </button>

                      <span className="text-[0.65rem] text-zinc-400 font-mono w-10 text-center">
                        {(zoomLevel * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
  
                  {/* 時間軸容器 - OpenCut 標準佈局 (無左側工具列) */}
                  <div
                    ref={timelineContainerRef}
                    className="flex-1 flex flex-col overflow-hidden relative"
                  >
                    {/* 標尺+軌道內容區 - 播放頭高度計算用 */}
                    <div ref={timelineContentRef} className="flex-1 flex flex-col overflow-hidden relative">
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
                                timelineRef={timelineContentRef}
                              />
                            )}
                            
                            {/* 字幕軌道 - 整個區域填滿並可點擊 */}
                            <div
                              className="absolute left-0 right-0 top-0 bottom-0"
                              onClick={handleTimelineClick}
                            >
                              <div
                                className="w-full h-full hover:bg-gray-800/20 relative"
                                onClick={handleTimelineClick}
                              >
                                {/* 字幕片段 */}
                                {tracks.length > 0 && tracks[0].segments.map((segment) => {
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
                    </div> {/* 結束標尺+軌道內容區 */}
                  </div> {/* 結束時間軸容器 */}
                </div>
              </Panel>
           </PanelGroup>
         </Panel>

         <PanelResizeHandle className="w-1 bg-gray-800 hover:bg-blue-600 transition" />

         {/* 右側: 字幕屬性編輯面板 (獨立垂直區域) */}
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