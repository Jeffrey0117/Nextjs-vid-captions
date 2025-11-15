'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSubtitleStore, SubtitleSegment } from '../stores/subtitle-store';
import { Upload, FileText, Download, Languages, Trash2, Scissors, Film, Edit3, ArrowLeftToLine, ArrowRightToLine, SplitSquareHorizontal, Copy, Snowflake, Video, Music, Type, CaptionsIcon, Blend, Settings, Plus, ChevronDown, Check } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import SubtitlePropertiesPanel from '../components/SubtitlePropertiesPanel';
import PinnedSubtitlePanel from '../components/PinnedSubtitlePanel';
import BulkSubtitleEditor from '../components/BulkSubtitleEditor';
import SubtitlePlayhead from '../components/SubtitlePlayhead';
import TimelineAdjustDialog from '../components/TimelineAdjustDialog';
import { parseSrt } from '@/lib/parseSrt';
import { useToast } from '../hooks/useToast';
import { useSmartRecorder } from '../hooks/useSmartRecorder';
import { wrapTextByActualWidth, buildFontString, joinWrappedLines } from '../utils/text-wrapping';
import { DEFAULT_STYLE } from '../stores/subtitle-store';

// ==================== 调试日志工具 ====================
/**
 * 时间轴交互调试日志工具
 * 提供格式化、颜色标记的日志输出，便于追踪鼠标事件和拖拽行为
 */
class TimelineDebugLogger {
  private static enabled = true; // 设置为 false 可禁用所有日志

  // 格式化轨道信息
  private static formatTrack(trackId: string, trackName: string): string {
    return `轨道[${trackName || trackId.slice(0, 8)}]`;
  }

  // 格式化字幕信息
  private static formatSegment(segmentId: string, text: string): string {
    const shortId = segmentId.slice(0, 8);
    const shortText = text.length > 15 ? text.slice(0, 15) + '...' : text;
    return `字幕[${shortId}:"${shortText}"]`;
  }

  // 格式化位置信息
  private static formatPosition(x: number, y: number): string {
    return `(${Math.round(x)}, ${Math.round(y)})`;
  }

  // 格式化距离
  private static formatDistance(distance: number): string {
    return `${Math.round(distance)}px`;
  }

  // 鼠标按下事件
  static mouseDown(params: {
    trackId: string;
    trackName: string;
    segmentId: string;
    segmentText: string;
    dragType: 'left' | 'right' | 'move';
    position: { x: number; y: number };
    startTime: number;
    endTime: number;
  }) {
    if (!this.enabled) return;

    const emoji = params.dragType === 'left' ? '⬅️' : params.dragType === 'right' ? '➡️' : '🖱️';
    const action = params.dragType === 'left' ? '左边缘' : params.dragType === 'right' ? '右边缘' : '移动区';

    console.log(
      `%c${emoji} MouseDown | ${action}`,
      'color: #4CAF50; font-weight: bold;',
      '\n  ' + this.formatTrack(params.trackId, params.trackName),
      '\n  ' + this.formatSegment(params.segmentId, params.segmentText),
      '\n  位置:', this.formatPosition(params.position.x, params.position.y),
      '\n  时间:', `${params.startTime.toFixed(2)}s - ${params.endTime.toFixed(2)}s`
    );
  }

  // 鼠标移动事件
  static mouseMove(params: {
    segmentId: string;
    distance: number;
    distanceX: number;
    distanceY: number;
    hasMoved: boolean;
    dragType: 'left' | 'right' | 'move' | null;
    dragDirection: 'horizontal' | 'vertical' | null;
  }) {
    if (!this.enabled) return;

    // 只在关键时刻记录移动日志（避免刷屏）
    if (params.distance < 5 && !params.hasMoved) return;

    const emoji = '🔄';
    const status = params.hasMoved ? '拖拽中' : '等待确认';
    const direction = params.dragDirection
      ? (params.dragDirection === 'horizontal' ? '水平↔️' : '垂直↕️')
      : '未确定';

    console.log(
      `%c${emoji} MouseMove | ${status}`,
      'color: #2196F3; font-weight: bold;',
      '\n  距离:', this.formatDistance(params.distance),
      `(X:${Math.round(params.distanceX)}px, Y:${Math.round(params.distanceY)}px)`,
      '\n  方向:', direction,
      '\n  类型:', params.dragType || '未设置'
    );
  }

  // 鼠标释放事件
  static mouseUp(params: {
    segmentId: string | null;
    hasMoved: boolean;
    distance: number;
    action: 'click' | 'drag-horizontal' | 'drag-vertical' | 'none';
    targetTrackId?: string;
    targetTrackName?: string;
  }) {
    if (!this.enabled) return;

    let emoji = '✅';
    let actionText = '';
    let color = '#4CAF50';

    if (params.action === 'click') {
      emoji = '✅';
      actionText = '选中字幕';
      color = '#4CAF50';
    } else if (params.action === 'drag-horizontal') {
      emoji = '🔄';
      actionText = '调整时间';
      color = '#2196F3';
    } else if (params.action === 'drag-vertical') {
      emoji = '🔀';
      actionText = '切换轨道';
      color = '#FF9800';
    } else {
      emoji = '⭕';
      actionText = '无操作';
      color = '#9E9E9E';
    }

    const parts = [
      `%c${emoji} MouseUp   | ${actionText}`,
      `color: ${color}; font-weight: bold;`,
      `\n  距离: ${this.formatDistance(params.distance)}`,
      `\n  判定: ${params.hasMoved ? '拖拽' : '点击'}`
    ];

    if (params.targetTrackId && params.targetTrackName) {
      parts.push(`\n  目标: ${this.formatTrack(params.targetTrackId, params.targetTrackName)}`);
    }

    console.log(...parts);
  }

  // 点击事件
  static click(params: {
    trackId: string;
    trackName: string;
    segmentId: string;
    segmentText: string;
    startTime: number;
    wasAlreadySelected: boolean;
  }) {
    if (!this.enabled) return;

    const emoji = '🎯';
    const status = params.wasAlreadySelected ? '已选中' : '新选中';

    console.log(
      `%c${emoji} Click     | ${status}`,
      'color: #9C27B0; font-weight: bold;',
      '\n  ' + this.formatTrack(params.trackId, params.trackName),
      '\n  ' + this.formatSegment(params.segmentId, params.segmentText),
      '\n  时间:', `${params.startTime.toFixed(2)}s`
    );
  }

  // 方向确定事件
  static directionDetermined(params: {
    direction: 'horizontal' | 'vertical';
    deltaX: number;
    deltaY: number;
  }) {
    if (!this.enabled) return;

    const emoji = params.direction === 'horizontal' ? '↔️' : '↕️';
    const directionText = params.direction === 'horizontal' ? '水平拖拽' : '垂直拖拽';

    console.log(
      `%c${emoji} Direction | ${directionText}`,
      'color: #FF5722; font-weight: bold;',
      `\n  X偏移: ${Math.round(params.deltaX)}px`,
      `\n  Y偏移: ${Math.round(params.deltaY)}px`
    );
  }

  // 轨道切换事件
  static trackSwitch(params: {
    fromTrackId: string;
    fromTrackName: string;
    toTrackId: string;
    toTrackName: string;
  }) {
    if (!this.enabled) return;

    console.log(
      `%c🔀 TrackSwitch`,
      'color: #FF9800; font-weight: bold;',
      `\n  从: ${this.formatTrack(params.fromTrackId, params.fromTrackName)}`,
      `\n  到: ${this.formatTrack(params.toTrackId, params.toTrackName)}`
    );
  }

  // 打印测试场景表格
  static printTestScenarios() {
    console.log('\n');
    console.log('%c╔═══════════════════════════════════════════════════════════════╗', 'color: #00BCD4; font-weight: bold;');
    console.log('%c║               时间轴交互测试场景验证表                         ║', 'color: #00BCD4; font-weight: bold;');
    console.log('%c╠═══════════════════════════════════════════════════════════════╣', 'color: #00BCD4; font-weight: bold;');
    console.log('%c║ 场景 1: 单击第一轨道字幕 → 应该选中                           ║', 'color: #4CAF50;');
    console.log('%c║ 场景 2: 单击第二轨道字幕 → 应该选中                           ║', 'color: #4CAF50;');
    console.log('%c║ 场景 3: 水平拖拽字幕     → 应该调整时间                       ║', 'color: #2196F3;');
    console.log('%c║ 场景 4: 垂直拖拽字幕     → 应该切换轨道                       ║', 'color: #FF9800;');
    console.log('%c║ 场景 5: 快速点击         → 应该选中，不触发拖拽               ║', 'color: #9C27B0;');
    console.log('%c╠═══════════════════════════════════════════════════════════════╣', 'color: #00BCD4; font-weight: bold;');
    console.log('%c║ 判定标准:                                                     ║', 'color: #FFC107;');
    console.log('%c║ • 移动距离 < 5px  → 点击                                      ║', 'color: #FFC107;');
    console.log('%c║ • 移动距离 ≥ 5px  → 拖拽                                      ║', 'color: #FFC107;');
    console.log('%c║ • Y偏移 > 30px 且 Y > 2×X → 垂直拖拽                          ║', 'color: #FFC107;');
    console.log('%c║ • 其他情况        → 水平拖拽                                  ║', 'color: #FFC107;');
    console.log('%c╚═══════════════════════════════════════════════════════════════╝', 'color: #00BCD4; font-weight: bold;');
    console.log('\n');
  }

  // 启用/禁用日志
  static setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(`%c时间轴调试日志: ${enabled ? '已启用' : '已禁用'}`, `color: ${enabled ? '#4CAF50' : '#F44336'}; font-weight: bold;`);
  }
}

// 在开发环境自动打印测试场景
if (typeof window !== 'undefined') {
  setTimeout(() => {
    TimelineDebugLogger.printTestScenarios();
  }, 1000);
}

/**
 * 智能換行：根據實際渲染寬度進行精確換行
 * 使用通用的文本換行工具，確保與導出一致
 *
 * @param text 原始文本
 * @param maxWidth 最大寬度（像素）
 * @param fontSize 字體大小（像素）
 * @param fontFamily 字體族
 * @param fontWeight 字體粗細
 * @param fontStyle 字體樣式
 * @returns 換行後的文本（用 \n 分隔）
 */
function wrapSubtitleTextByWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string = 'Arial',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): string {
  if (!text || maxWidth <= 0) return text;

  // 構建字體字符串
  const font = buildFontString({
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
  });

  // 使用通用換行工具
  const lines = wrapTextByActualWidth(text, {
    maxWidth,
    font,
    allowForcedBreak: true,
  });

  // 轉換為換行符分隔的字符串
  return joinWrappedLines(lines);
}

/**
 * 舊版基於字符數的換行函數（已棄用，保留作為回退方案）
 * @deprecated 請使用 wrapSubtitleTextByWidth 進行精確的寬度測量換行
 */
function wrapSubtitleText(text: string, maxCharsPerLine: number = 20): string {
  if (!text) return text;

  const paragraphs = text.split('\n');
  const wrappedLines: string[] = [];

  paragraphs.forEach(paragraph => {
    if (paragraph.length <= maxCharsPerLine) {
      wrappedLines.push(paragraph);
      return;
    }

    let currentLine = '';
    const chars = paragraph.split('');
    const breakPoints = ['。', '！', '？', '、', '，', ',', ' '];

    for (let i = 0; i < chars.length; i++) {
      const testLine = currentLine + chars[i];

      if (testLine.length > maxCharsPerLine && currentLine.length > 0) {
        let breakIndex = -1;

        for (const breakChar of breakPoints) {
          breakIndex = currentLine.lastIndexOf(breakChar);
          if (breakIndex > 0) break;
        }

        if (breakIndex > 0) {
          wrappedLines.push(currentLine.substring(0, breakIndex + 1));
          currentLine = currentLine.substring(breakIndex + 1).trim() + chars[i];
        } else {
          wrappedLines.push(currentLine);
          currentLine = chars[i];
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.length > 0) {
      wrappedLines.push(currentLine);
    }
  });

  return wrappedLines.join('\n');
}

export default function EditorProPage() {
  const toast = useToast();
  const { record, cancel, isRecording, progress: recordProgress, status: recordStatus, recordingMethod, isWebCodecsSupported } = useSmartRecorder();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [renderMethod, setRenderMethod] = useState<'ffmpeg' | 'canvas' | 'drawtext'>('drawtext');
  const [targetLang, setTargetLang] = useState('zh-TW');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPositionX, setDragStartPositionX] = useState(50);
  const [dragStartPositionY, setDragStartPositionY] = useState(0);
  const [draggingSubtitleId, setDraggingSubtitleId] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(true);
  const [timelineDragState, setTimelineDragState] = useState<{
    isDragging: boolean;
    dragType: 'left' | 'right' | 'move' | null;
    segmentId: string | null;
    startMouseX: number;
    startMouseY: number;
    startTime: { start: number; end: number };
    clickOffsetTime: number;
    sourceTrackId: string | null;
    targetTrackId: string | null;
    dragDirection: 'horizontal' | 'vertical' | null;
  }>({
    isDragging: false,
    dragType: null,
    segmentId: null,
    startMouseX: 0,
    startMouseY: 0,
    startTime: { start: 0, end: 0 },
    clickOffsetTime: 0,
    sourceTrackId: null,
    targetTrackId: null,
    dragDirection: null,
  });
  const [resizeDragType, setResizeDragType] = useState<'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right' | null>(null);
  const [resizeDragStart, setResizeDragStart] = useState({ x: 0, y: 0, scale: 1, maxWidth: 80 });
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [videoDisplaySize, setVideoDisplaySize] = useState({ width: 1920, height: 1080 });
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'sounds' | 'text' | 'captions' | 'filters' | 'settings'>('text');
  const [editMode, setEditMode] = useState<'normal' | 'pinned'>('normal');
  const [showTimelineAdjust, setShowTimelineAdjust] = useState(false);
  const [adjustingSegmentId, setAdjustingSegmentId] = useState<string | null>(null);

  // 時間軸點擊/拖動檢測狀態
  const [isClickAction, setIsClickAction] = useState(true);
  const [mouseDownPosition, setMouseDownPosition] = useState<{x: number, y: number} | null>(null);

  // 拖動閾值：移動超過5px視為拖動
  const DRAG_THRESHOLD = 5;

  // 右鍵菜單狀態
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    segmentId: string | null;
    trackId: string | null;
  }>({
    show: false,
    x: 0,
    y: 0,
    segmentId: null,
    trackId: null,
  });

  // 添加字幕下拉菜单状态
  const [showAddSubtitleMenu, setShowAddSubtitleMenu] = useState(false);
  const addSubtitleMenuRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null); // 預覽容器，用於錄製
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
    pinnedSubtitles,
    importFromSrt,
    exportToSrt,
    clearAll,
    updateSegment,
    selectSegment,
    addSegment,
    deleteSegment,
    addTrack,
    deleteTrack,
    updateTrack,
    selectTrack,
    getAllSegments,
    loadProjectSegments,
    loadPinnedSubtitles,
    moveSegmentToTrack
  } = useSubtitleStore();

  // 取得當前播放的字幕 - 支持多轨道
  const currentSubtitles = useMemo(() => {
    const result: { [trackId: string]: SubtitleSegment } = {};

    tracks.forEach(track => {
      if (!track.visible || track.muted) return;

      const found = track.segments.find(
        seg => currentTime >= seg.startTime && currentTime <= seg.endTime
      );

      if (found) {
        result[track.id] = found;
      }
    });

    return result;
  }, [currentTime, tracks]);

  // 向后兼容：获取第一条轨道的当前字幕
  const currentSubtitle = useMemo(() => {
    const track0 = tracks[0];
    if (!track0) return undefined;
    return currentSubtitles[track0.id];
  }, [currentSubtitles, tracks]);

  // 查找当前选中字幕所属的轨道和索引
  const currentTrackInfo = useMemo(() => {
    if (!selectedSegmentId) return { track: null, segmentIndex: -1 };

    for (const track of tracks) {
      const segmentIndex = track.segments.findIndex(seg => seg.id === selectedSegmentId);
      if (segmentIndex !== -1) {
        return { track, segmentIndex };
      }
    }

    return { track: null, segmentIndex: -1 };
  }, [selectedSegmentId, tracks]);

  // 自動選中當前播放的字幕
  useEffect(() => {
    if (currentSubtitle && currentSubtitle.id !== selectedSegmentId) {
      setSelectedSegmentId(currentSubtitle.id);
      selectSegment(currentSubtitle.id);
    }
  }, [currentSubtitle, selectedSegmentId, selectSegment]);

  // 載入 URL 參數中的專案資料
  useEffect(() => {
    const loadProjectFromUrl = async () => {
      // 檢查 URL 參數
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get('projectId');
      
      if (!projectId) {
        console.log('⚠️ URL 沒有 projectId 參數');
        return;
      }
      
      console.log('🔍 正在載入專案 ID:', projectId);
      
      // 從 localStorage 載入專案資料
      const savedProjects = localStorage.getItem('subtitle-projects');
      if (!savedProjects) {
        console.error('❌ localStorage 中沒有專案資料');
        // 🧪 如果沒有 localStorage 資料，直接用測試資料
        console.log('🧪 使用測試資料代替');
        const testSegments: SubtitleSegment[] = [
          {
            id: '1',
            startTime: 0,
            endTime: 0.84,
            text: "It's crazy.",
            translatedText: "太瘋狂了。",
            style: { ...DEFAULT_STYLE }
          },
          {
            id: '2',
            startTime: 0.84,
            endTime: 3.08,
            text: "I'm just gonna top this water off real quick.",
            translatedText: "我只是要快速加點水。",
            style: { ...DEFAULT_STYLE }
          },
          {
            id: '3',
            startTime: 3.08,
            endTime: 3.92,
            text: "No problem.",
            translatedText: "沒問題。",
            style: { ...DEFAULT_STYLE }
          }
        ];

        setVideoUrl('/temp/video_1761584936803.mp4');
        loadProjectSegments(testSegments);
        console.log('✅ 測試字幕載入完成');
        return;
      }
      
      const projects = JSON.parse(savedProjects);
      console.log('🔍 localStorage 共有', projects.length, '個專案');
      console.log('🔍 所有專案 ID:', projects.map((p: any) => p.id));
      console.log('🔍 尋找專案 ID:', projectId);
      
      const project = projects.find((p: any) => p.id === projectId);
      
      // 如果找不到專案，嘗試使用最新的專案
      if (!project && projects.length > 0) {
        console.log('🔄 找不到指定專案，使用最新專案');
        const latestProject = projects[projects.length - 1];
        console.log('🔍 使用專案:', latestProject.id, latestProject.name);
        
        if (latestProject.segments && latestProject.segments.length > 0) {
          if (latestProject.videoUrl) {
            setVideoUrl(latestProject.videoUrl);
          }
          
          const processedSegments = latestProject.segments.map((seg: any, index: number) => ({
            ...seg, // 保留所有原始屬性，包括 style
            id: String(seg.id || index + 1),
            startTime: typeof seg.startTime === 'number' ? seg.startTime : 0,
            endTime: typeof seg.endTime === 'number' ? seg.endTime : 1,
            text: seg.text || '',
            translatedText: seg.translatedText || seg.text || ''
          }));
          
          loadProjectSegments(processedSegments);

          // 載入固定字幕（記錄是否為新專案）
          const hasCustomPinnedSubtitles = latestProject.pinnedSubtitles && latestProject.pinnedSubtitles.length > 0;
          if (hasCustomPinnedSubtitles) {
            loadPinnedSubtitles(latestProject.pinnedSubtitles);
          } else {
            console.log('⚠️ 最新專案沒有固定字幕，視為新專案');
          }

          // 自動生成並套用 AI 標題
          setTimeout(async () => {
            const state = useSubtitleStore.getState();
            const topPinned = state.pinnedSubtitles.find(p => p.position === 'top');
            if (topPinned && processedSegments.length > 0) {
              // 新專案（沒有保存固定字幕）或標題是預設值時，自動生成
              const shouldGenerate = !hasCustomPinnedSubtitles ||
                                     topPinned.text === '影片標題' ||
                                     topPinned.text === '新標題';

              if (shouldGenerate) {
                console.log('🎬 自動生成 AI 標題並隨機背景色...', {
                  isNewProject: !hasCustomPinnedSubtitles,
                  currentTitle: topPinned.text
                });

                // 隨機選擇背景色（保持透明度 0.8）
                const colors = [
                  'rgba(37, 99, 235, 0.8)',   // 藍色
                  'rgba(220, 38, 38, 0.8)',   // 紅色
                  'rgba(234, 179, 8, 0.8)',   // 黃色
                  'rgba(22, 163, 74, 0.8)',   // 綠色
                  'rgba(147, 51, 234, 0.8)',  // 紫色
                  'rgba(236, 72, 153, 0.8)',  // 粉色
                ];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];

                // 立即套用隨機背景色
                state.updatePinnedSubtitle(topPinned.id, {
                  style: { ...topPinned.style, backgroundColor: randomColor }
                });
                console.log('🎨 隨機背景色已套用:', randomColor);

                try {
                  const response = await fetch('/api/generate-title', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subtitles: processedSegments }),
                  });

                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.titles) {
                      // 儲存所有 3 個標題並套用 viral 標題
                      const titleToApply = data.titles.viral || data.titles.funny || data.titles.mystery;
                      state.updatePinnedSubtitle(topPinned.id, {
                        text: titleToApply,
                        generatedTitles: {
                          viral: data.titles.viral,
                          funny: data.titles.funny,
                          mystery: data.titles.mystery,
                        }
                      });
                      console.log('✨ AI 標題已自動套用:', titleToApply);
                      console.log('📋 3 個標題已儲存:', data.titles);
                      toast.success(`AI 標題已生成：${titleToApply}`);
                    }
                  }
                } catch (error) {
                  console.error('❌ 自動生成標題失敗:', error);
                }
              } else {
                console.log('⏭️ 標題已自訂，跳過自動生成');
              }
            }
          }, 100);

          console.log('✅ 使用最新專案的字幕載入完成');
          return;
        }
      }
      
      if (!project) {
        console.error('❌ 專案不存在:', projectId);
        console.log('💡 可用的專案列表:', projects.map((p: any) => ({ id: p.id, name: p.name })));
        toast.error(`找不到專案 ${projectId},請返回 /editor 重新選擇專案`);
        // 自動跳轉回編輯器頁面
        window.location.href = '/editor';
        return;
      }
      
      console.log('✅ 找到專案:', project.name);
      console.log('🔍 專案資料:', {
        id: project.id,
        name: project.name,
        status: project.status,
        hasVideoUrl: !!project.videoUrl,
        videoUrlType: project.videoUrl?.substring(0, 10),
        segmentsCount: project.segments?.length || 0,
      });
      
      // 載入影片 - 支援 Data URL 和普通 URL
      if (project.videoUrl) {
        if (project.videoUrl.startsWith('data:')) {
          // Data URL (Base64 編碼的影片)
          setVideoUrl(project.videoUrl);
          console.log('✅ 載入影片 (Data URL), 長度:', project.videoUrl.length);
        } else if (project.videoUrl.startsWith('blob:')) {
          console.warn('⚠️ Blob URL 已失效,請返回 /editor 重新上傳影片');
          toast.error('影片連結已失效,請返回 /editor 重新上傳影片');
        } else {
          // 普通 URL
          setVideoUrl(project.videoUrl);
          console.log('✅ 載入影片 URL:', project.videoUrl);
        }
      } else {
        console.error('❌ 專案沒有影片資料');
        toast.error('專案沒有影片資料,請返回 /editor 重新上傳影片');
      }
      
      // 載入字幕
      if (project.segments && project.segments.length > 0) {
        console.log('✅ 載入專案 segments:', project.segments.length);
        console.log('🔍 第一條字幕:', project.segments[0]);
        console.log('🔍 前3條字幕時間:', project.segments.slice(0, 3).map((s: any) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          text: s.text,
          translatedText: s.translatedText
        })));
        
        // 確保字幕資料格式正確（完整保留所有屬性包括 style）
        const processedSegments = project.segments.map((seg: any, index: number) => {
          let startTime = 0;
          let endTime = 1;

          // 處理時間格式 - 需要將毫秒轉換為秒數
          if (typeof seg.startTime === 'number') {
            // 如果時間大於 100，假設是毫秒，需要轉換為秒
            startTime = seg.startTime > 100 ? seg.startTime / 1000 : seg.startTime;
          } else if (typeof seg.startTime === 'string') {
            const parsed = parseFloat(seg.startTime) || 0;
            startTime = parsed > 100 ? parsed / 1000 : parsed;
          }
          
          if (typeof seg.endTime === 'number') {
            // 如果時間大於 100，假設是毫秒，需要轉換為秒
            endTime = seg.endTime > 100 ? seg.endTime / 1000 : seg.endTime;
          } else if (typeof seg.endTime === 'string') {
            const parsed = parseFloat(seg.endTime) || startTime + 1;
            endTime = parsed > 100 ? parsed / 1000 : parsed;
          }
          
          console.log(`字幕 ${index + 1}:`, {
            原始startTime: seg.startTime,
            原始endTime: seg.endTime,
            處理後startTime: startTime,
            處理後endTime: endTime,
            text: seg.text,
            translatedText: seg.translatedText
          });
          
          // 完整保留所有屬性，包括 style
          return {
            ...seg, // 保留原始 segment 的所有屬性（包括 style）
            id: String(seg.id || index + 1),
            startTime,
            endTime,
            text: seg.text || '',
            translatedText: seg.translatedText || seg.text || '',
            // 確保 style 存在（如果原始資料沒有 style，loadProjectSegments 會使用預設值）
          };
        });
        
        loadProjectSegments(processedSegments);

        // 載入固定字幕（記錄是否為新專案）
        const hasCustomPinnedSubtitles = project.pinnedSubtitles && project.pinnedSubtitles.length > 0;
        if (hasCustomPinnedSubtitles) {
          console.log('🔍 準備載入固定字幕:', project.pinnedSubtitles.length, '個');
          loadPinnedSubtitles(project.pinnedSubtitles);
        } else {
          console.log('⚠️ 專案沒有固定字幕，視為新專案');
        }

        // 確認載入成功並自動生成標題
        setTimeout(async () => {
          const state = useSubtitleStore.getState();
          // Store loaded successfully

          // 自動生成並套用 AI 標題
          const topPinned = state.pinnedSubtitles.find(p => p.position === 'top');
          if (topPinned && processedSegments.length > 0) {
            // 新專案（沒有保存固定字幕）或標題是預設值時，自動生成
            const shouldGenerate = !hasCustomPinnedSubtitles ||
                                   topPinned.text === '影片標題' ||
                                   topPinned.text === '新標題';

            if (shouldGenerate) {
              console.log('🎬 自動生成 AI 標題並隨機背景色...', {
                isNewProject: !hasCustomPinnedSubtitles,
                currentTitle: topPinned.text
              });

              // 隨機選擇背景色（保持透明度 0.8）
              const colors = [
                'rgba(37, 99, 235, 0.8)',   // 藍色
                'rgba(220, 38, 38, 0.8)',   // 紅色
                'rgba(234, 179, 8, 0.8)',   // 黃色
                'rgba(22, 163, 74, 0.8)',   // 綠色
                'rgba(147, 51, 234, 0.8)',  // 紫色
                'rgba(236, 72, 153, 0.8)',  // 粉色
              ];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];

              // 立即套用隨機背景色
              state.updatePinnedSubtitle(topPinned.id, {
                style: { ...topPinned.style, backgroundColor: randomColor }
              });
              console.log('🎨 隨機背景色已套用:', randomColor);

              try {
                const response = await fetch('/api/generate-title', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subtitles: processedSegments }),
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.titles) {
                    // 儲存所有 3 個標題並套用 viral 標題
                    const titleToApply = data.titles.viral || data.titles.funny || data.titles.mystery;
                    state.updatePinnedSubtitle(topPinned.id, {
                      text: titleToApply,
                      generatedTitles: {
                        viral: data.titles.viral,
                        funny: data.titles.funny,
                        mystery: data.titles.mystery,
                      }
                    });
                    console.log('✨ AI 標題已自動套用:', titleToApply);
                    console.log('📋 3 個標題已儲存:', data.titles);
                    toast.success(`AI 標題已生成：${titleToApply}`);
                  }
                }
              } catch (error) {
                console.error('❌ 自動生成標題失敗:', error);
                // 失敗時不顯示錯誤，靜默處理
              }
            } else {
              console.log('⏭️ 標題已自訂，跳過自動生成');
            }
          }
        }, 100);
      } else {
        console.warn('⚠️ 專案沒有字幕資料');
      }
    };
    
    loadProjectFromUrl();
  }, []); // 只在組件掛載時執行一次

  // 自動保存機制：當字幕或固定字幕變化時，自動保存到 localStorage
  useEffect(() => {
    // 避免初次載入時觸發保存
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');

    if (!projectId || tracks.length === 0 || tracks[0]?.segments.length === 0) {
      return;
    }

    // 使用 setTimeout 實現防抖，避免頻繁保存
    const autoSaveTimeout = setTimeout(() => {
      const savedProjects = localStorage.getItem('subtitle-projects');
      if (!savedProjects) return;

      const projects = JSON.parse(savedProjects);
      const projectIndex = projects.findIndex((p: any) => p.id === projectId);

      if (projectIndex === -1) return;

      // 獲取完整的字幕資料（包含所有樣式屬性）
      const allSegments = tracks[0].segments;

      // 更新專案的字幕資料和固定字幕
      projects[projectIndex] = {
        ...projects[projectIndex],
        segments: allSegments,
        pinnedSubtitles: pinnedSubtitles,
        updatedAt: new Date().toISOString(),
      };

      // 保存回 localStorage
      localStorage.setItem('subtitle-projects', JSON.stringify(projects));
      console.log('💾 自動保存完成:', {
        projectId,
        segmentsCount: allSegments.length,
        pinnedSubtitlesCount: pinnedSubtitles.length,
        firstSegmentStyle: allSegments[0]?.style ? {
          fontSize: allSegments[0].style.fontSize,
          positionY: allSegments[0].style.positionY,
          color: allSegments[0].style.color
        } : null,
        time: new Date().toLocaleTimeString()
      });
    }, 1000); // 1秒防抖延遲

    return () => clearTimeout(autoSaveTimeout);
  }, [tracks, pinnedSubtitles]); // 監聽整個 tracks 和固定字幕的變化

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

  // 鍵盤快捷鍵支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在輸入框中，忽略快捷鍵
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + N: 新增字幕
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (videoFile && duration > 0) {
          handleAddSubtitle();
        }
      }

      // Delete/Backspace: 刪除選中的字幕
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSegmentId) {
        e.preventDefault();
        console.log('⌨️ 键盘删除快捷键被触发');
        console.log('selectedSegmentId:', selectedSegmentId);

        // 從第一個軌道獲取字幕（修復 segments 為空的問題）
        const allSegments = tracks[0]?.segments || [];
        const segment = allSegments.find(s => s.id === selectedSegmentId);
        console.log('要删除的字幕:', segment);

        if (segment && confirm(`確定要刪除字幕「${segment.text}」嗎？`)) {
          console.log('✅ 确认删除，调用 deleteSegment');
          deleteSegment(selectedSegmentId);
          setSelectedSegmentId(null);
          toast.success('字幕已刪除');
        }
      }

      // Space: 播放/暫停
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }

      // Arrow Left: 後退5秒
      if (e.key === 'ArrowLeft' && videoRef.current) {
        e.preventDefault();
        seekTo(Math.max(0, currentTime - 5));
      }

      // Arrow Right: 前進5秒
      if (e.key === 'ArrowRight' && videoRef.current) {
        e.preventDefault();
        seekTo(Math.min(duration, currentTime + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSegmentId, segments, videoFile, duration, currentTime]);

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
      toast.warning('請先上傳影片');
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
        
        toast.success('字幕識別完成!');
      } else {
        toast.error('字幕識別失敗,請檢查 Whisper 是否已安裝');
      }
    } catch (error) {
      console.error('轉錄失敗:', error);
      toast.error('轉錄失敗,請確認 Whisper 已正確安裝');
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
        
        toast.success('翻譯完成!');
      } else {
        throw new Error(data.error || '翻譯失敗');
      }
    } catch (error) {
      console.error('翻譯失敗:', error);
      toast.error(`翻譯失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
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
    if ((!videoFile && !videoUrl) || actualSegments.length === 0) {
      toast.warning('請先上傳影片並添加字幕');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const formData = new FormData();
      
      // 優先使用伺服器路徑，避免重新上傳影片
      if (videoUrl && videoUrl.startsWith('/temp/')) {
        // 伺服器路徑，直接傳遞檔案名稱
        const fileName = videoUrl.replace('/temp/', '');
        formData.append('videoPath', fileName);
      } else if (videoFile) {
        // 使用檔案物件
        formData.append('video', videoFile);
      } else if (videoUrl) {
        // 從其他 URL 獲取影片數據
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error('無法獲取影片文件');
        }
        const blob = await response.blob();
        const file = new File([blob], 'video.mp4', { type: blob.type || 'video/mp4' });
        formData.append('video', file);
      }
      
      formData.append('subtitles', JSON.stringify(actualSegments));
      formData.append('pinnedSubtitles', JSON.stringify(pinnedSubtitles));
      formData.append('renderMethod', renderMethod);

      // 模擬進度
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // 根據選擇的渲染方式調用不同的 API
      let apiEndpoint: string;
      if (renderMethod === 'canvas') {
        apiEndpoint = '/api/render-video/canvas'; // 使用 Canvas 高品質渲染
      } else if (renderMethod === 'drawtext') {
        apiEndpoint = '/api/render-video/drawtext'; // 使用 FFmpeg DrawText 高品質渲染
      } else {
        apiEndpoint = '/api/burn-subtitles'; // 傳統 FFmpeg ASS 燒錄
      }
      
      console.log('🎬 Using API endpoint:', apiEndpoint);
      console.log('📊 Form data contents:', {
        hasVideoFile: !!videoFile,
        videoPath: videoUrl?.startsWith('/temp/') ? videoUrl.replace('/temp/', '') : null,
        segmentsCount: actualSegments.length
      });
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setExportProgress(100);

      if (!response.ok) {
        const error = await response.json();
        console.error('🚨 Server response error:', error);
        console.error('Response status:', response.status);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        throw new Error(`${error.error || '輸出失敗'}: ${error.details || ''}`);
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

      toast.success('影片輸出完成!', 5000);
    } catch (error: any) {
      console.error('輸出失敗:', error);
      toast.error(`輸出失敗: ${error.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleRecordPreview = async () => {
    if (!videoRef.current || !previewContainerRef.current || !videoUrl) {
      toast.warning('請先上傳影片');
      return;
    }

    const actualSegments = tracks[0]?.segments || [];
    if (actualSegments.length === 0) {
      toast.warning('請先添加字幕');
      return;
    }

    try {
      toast.info('開始錄製預覽畫面...');

      // 獲取videoPath（從videoUrl或上傳的檔案）
      let videoPath = '';
      if (videoUrl && videoUrl.startsWith('/temp/')) {
        videoPath = videoUrl.replace('/temp/', '');
      } else if (videoFile) {
        // 需要先上傳
        const uploadFormData = new FormData();
        uploadFormData.append('video', videoFile);
        const uploadRes = await fetch('/api/upload-video', {
          method: 'POST',
          body: uploadFormData,
        });
        const uploadData = await uploadRes.json();
        videoPath = uploadData.filePath;
      }

      await record(
        videoRef.current,
        previewContainerRef.current,
        actualSegments,
        pinnedSubtitles.filter(p => p.enabled),
        videoDisplaySize,
        videoPath,
        {
          fps: 30,
          qualityLevel: 'high', // 启用高画质模式（2x超采样 + 优化编码 + WebCodecs GPU加速）
          onProgress: (progress) => {
            console.log(`錄製進度: ${(progress * 100).toFixed(1)}%`);
          },
          onComplete: () => {
            toast.success('錄製完成！');
          },
          onError: (error) => {
            toast.error(`錄製失敗: ${error.message}`);
          },
        }
      );
    } catch (error: any) {
      console.error('錄製失敗:', error);
      toast.error(`錄製失敗: ${error.message}`);
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
    if (!videoRef.current) {
      console.warn('⚠️ Video ref 不存在');
      return;
    }

    // 確保時間在有效範圍內
    const clampedTime = Math.max(0, Math.min(time, duration));

    console.log('🎬 跳轉到:', clampedTime.toFixed(3), 's');

    // 更新視頻時間
    videoRef.current.currentTime = clampedTime;

    // 立即更新狀態（不等待 timeupdate 事件）
    setCurrentTime(clampedTime);
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
    // 基本驗證
    if (!timelineRef.current || duration === 0) return;

    // 如果是拖動操作，忽略點擊事件
    if (timelineDragState.isDragging) {
      console.log('🚫 拖動中，忽略點擊事件');
      return;
    }

    // 阻止事件冒泡（避免重複觸發）
    e.stopPropagation();

    // 獲取點擊位置相對於時間軸容器的座標
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // 獲取滾動容器的 scrollLeft
    const tracksScroll = tracksScrollRef.current;
    const scrollLeft = tracksScroll ? tracksScroll.scrollLeft : 0;

    // 計算實際的時間位置（考慮滾動偏移和縮放）
    const pixelsPerSecond = 100 * zoomLevel;
    const absoluteClickX = clickX + scrollLeft;
    let newTime = absoluteClickX / pixelsPerSecond;

    // 對齊到幀（30fps）
    const fps = 30;
    newTime = Math.round(newTime * fps) / fps;

    // 邊界限制
    newTime = Math.max(0, Math.min(duration, newTime));

    console.log('🎯 時間軸點擊跳轉:', {
      clickX,
      scrollLeft,
      absoluteClickX,
      pixelsPerSecond,
      newTime,
      zoomLevel
    });

    // 執行跳轉
    seekTo(newTime);
  };

  const handleSegmentClick = (segmentId: string, startTime: number) => {
    console.log('📌 handleSegmentClick 被调用', {
      segmentId,
      startTime,
      previousSelectedId: selectedSegmentId
    });
    setSelectedSegmentId(segmentId);
    selectSegment(segmentId);
    seekTo(startTime);
  };

  // 處理右鍵菜單
  const handleContextMenu = (e: React.MouseEvent, segmentId: string, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // 計算菜單位置，確保不超出視口
    const menuWidth = 200;
    const menuHeight = 300; // 預估菜單高度
    const x = Math.min(e.clientX, window.innerWidth - menuWidth);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight);

    setContextMenu({
      show: true,
      x,
      y,
      segmentId,
      trackId,
    });
  };

  // 關閉右鍵菜單
  const closeContextMenu = () => {
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      segmentId: null,
      trackId: null,
    });
  };

  // 處理移動字幕到其他軌道
  const handleMoveToTrack = (toTrackId: string) => {
    if (contextMenu.segmentId && contextMenu.trackId) {
      moveSegmentToTrack(contextMenu.trackId, toTrackId, contextMenu.segmentId);
      toast.success('字幕已移動到新軌道');
    }
    closeContextMenu();
  };

  // 處理刪除字幕
  const handleDeleteFromMenu = () => {
    if (contextMenu.segmentId) {
      deleteSegment(contextMenu.segmentId);
      toast.success('字幕已刪除');
    }
    closeContextMenu();
  };

  // 處理複製字幕
  const handleDuplicateSegment = () => {
    if (!contextMenu.segmentId || !contextMenu.trackId) return;

    const track = tracks.find(t => t.id === contextMenu.trackId);
    const segment = track?.segments.find(s => s.id === contextMenu.segmentId);

    if (segment) {
      // 創建副本，時間稍微偏移
      addSegment({
        startTime: segment.startTime + 0.5,
        endTime: segment.endTime + 0.5,
        text: segment.text,
        style: { ...segment.style },
      }, contextMenu.trackId);
      toast.success('字幕已複製');
    }
    closeContextMenu();
  };

  // 點擊外部關閉菜單
  useEffect(() => {
    if (contextMenu.show) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.show]);

  // 點擊外部關閉添加字幕菜單
  useEffect(() => {
    if (showAddSubtitleMenu) {
      const handleClickOutside = (e: MouseEvent) => {
        if (addSubtitleMenuRef.current && !addSubtitleMenuRef.current.contains(e.target as Node)) {
          setShowAddSubtitleMenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddSubtitleMenu]);

  // 新增字幕（可指定轨道）
  const handleAddSubtitle = (targetTrackId?: string) => {
    // 確保有軌道
    if (tracks.length === 0) {
      addTrack('字幕軌道 1');
    }

    // 如果指定了轨道ID，使用指定的；否则使用当前选中的轨道
    const trackId = targetTrackId || selectedTrackId || tracks[0]?.id;

    // 获取目标轨道信息
    const targetTrack = tracks.find(t => t.id === trackId);
    const trackName = targetTrack?.name || '轨道 1';

    // 检查轨道是否被锁定
    if (targetTrack?.locked) {
      toast.error(`無法添加：${trackName} 已被鎖定`);
      return;
    }

    const startTime = currentTime;
    const endTime = currentTime + 2; // 默認2秒

    // 創建新字幕（addSegment 返回 void，所以我们需要在添加后查找新创建的字幕）
    addSegment({
      startTime,
      endTime,
      text: '新字幕',
      style: {
        fontSize: 32,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'normal' as const,
        fontStyle: 'normal' as const,
        textDecoration: 'none' as const,
        color: '#FFFFFF',
        opacity: 1,
        backgroundColor: 'transparent',
        position: 'bottom' as const,
        positionX: 50,
        positionY: 75,
        maxWidth: 80,
        scale: 1,
        enableStroke: true,
        strokeColor: '#000000',
        strokeWidth: 2,
        enableShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 0,
      }
    }, trackId);

    // 选中新创建的字幕（通过时间找到刚创建的字幕）
    // 使用 setTimeout 确保状态已更新
    setTimeout(() => {
      const targetTrackObj = tracks.find(t => t.id === trackId);
      const newSegment = targetTrackObj?.segments.find(
        s => Math.abs(s.startTime - startTime) < 0.01 && s.text === '新字幕'
      );

      if (newSegment) {
        setSelectedSegmentId(newSegment.id);
        selectSegment(newSegment.id);
      }

      // 如果添加到非当前选中的轨道，自动切换选中该轨道
      if (targetTrackId && targetTrackId !== selectedTrackId) {
        selectTrack(targetTrackId);
      }

      toast.success(`已在 ${trackName} 創建新字幕`);
    }, 10);
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

  // 記錄鼠標按下位置，用於區分點擊和拖拽
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);

  /**
   * 根據鼠標 Y 軸位置判斷點擊的軌道
   * 修復問題: 確保點擊第二軌道時不會誤判為第一軌道
   *
   * @param mouseY - 鼠標的 clientY 座標
   * @returns 點擊位置對應的軌道 ID，如果無法確定則返回 null
   */
  const getTrackFromMouseY = (mouseY: number): string | null => {
    if (!timelineRef.current || !tracksScrollRef.current) {
      console.warn('⚠️ getTrackFromMouseY: timelineRef 或 tracksScrollRef 不可用');
      return null;
    }

    // 獲取軌道容器的位置信息
    const tracksContainer = tracksScrollRef.current;
    const tracksRect = tracksContainer.getBoundingClientRect();

    // 計算相對於軌道容器頂部的 Y 座標
    const relativeY = mouseY - tracksRect.top;

    // 考慮滾動偏移
    const scrollTop = tracksContainer.scrollTop;
    const adjustedY = relativeY + scrollTop;

    // 遍歷所有軌道，找到包含該 Y 座標的軌道
    let accumulatedHeight = 0;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackHeight = track.height || 60;

      // 檢查點擊位置是否在當前軌道範圍內
      if (adjustedY >= accumulatedHeight && adjustedY < accumulatedHeight + trackHeight) {
        return track.id;
      }

      accumulatedHeight += trackHeight;
    }

    console.warn('⚠️ getTrackFromMouseY: 未找到匹配的軌道', {
      adjustedY,
      totalHeight: accumulatedHeight,
      tracksCount: tracks.length
    });

    // 如果沒有找到匹配的軌道，返回 null
    // 這可能發生在點擊軌道間隙或軌道區域之外時
    return null;
  };

  // 時間軸字幕區塊拖曳處理 - OpenCut 風格 (document-level listeners)
  const handleTimelineDragStart = (
    e: React.MouseEvent,
    segmentId: string,
    dragType: 'left' | 'right' | 'move',
    trackId: string
  ) => {
    e.stopPropagation();
    const segment = segments.find(s => s.id === segmentId);
    if (!segment || !timelineRef.current) return;

    // 【修復】使用鼠標 Y 軸位置驗證拖曳開始時的軌道
    // 確保拖曳操作從正確的軌道開始
    const detectedTrackId = getTrackFromMouseY(e.clientY);
    const finalTrackId = detectedTrackId || trackId;

    // 如果檢測到的軌道與預期不符，記錄警告
    if (detectedTrackId && detectedTrackId !== trackId) {
      console.warn('⚠️ 拖曳起始軌道不匹配！使用 Y 軸檢測結果', {
        expectedTrackId: trackId,
        detectedTrackId,
        mouseY: e.clientY,
        dragType
      });
    }

    // 获取轨道名称
    const track = tracks.find(t => t.id === finalTrackId);
    const trackName = track?.name || '未知轨道';

    // 使用调试日志工具
    TimelineDebugLogger.mouseDown({
      trackId: finalTrackId,
      trackName,
      segmentId,
      segmentText: segment.text,
      dragType,
      position: { x: e.clientX, y: e.clientY },
      startTime: segment.startTime,
      endTime: segment.endTime,
    });

    // 記錄鼠標按下位置
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false);

    // 計算 click offset (關鍵: 讓拖曳時元素不會跳動)
    let clickOffsetTime = 0;
    if (dragType === 'move') {
      const elementRect = (e.target as HTMLElement).getBoundingClientRect();
      const clickOffsetX = e.clientX - elementRect.left;
      const pixelsPerSecond = 100 * zoomLevel;
      clickOffsetTime = clickOffsetX / pixelsPerSecond;
      console.log('📐 移動模式 clickOffset:', clickOffsetTime);
    }

    setTimelineDragState({
      isDragging: true,
      dragType,
      segmentId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTime: { start: segment.startTime, end: segment.endTime },
      clickOffsetTime,
      sourceTrackId: finalTrackId,  // 【修復】使用驗證後的軌道 ID
      targetTrackId: finalTrackId,  // 【修復】使用驗證後的軌道 ID
      dragDirection: null,
    });
  };

  const handleTimelineDragEnd = () => {
    setTimelineDragState({
      isDragging: false,
      dragType: null,
      segmentId: null,
      startMouseX: 0,
      startMouseY: 0,
      startTime: { start: 0, end: 0 },
      clickOffsetTime: 0,
      sourceTrackId: null,
      targetTrackId: null,
      dragDirection: null,
    });
    // 延迟重置拖拽检测状态（确保 onClick 能读取到正确的 hasMoved 值）
    setTimeout(() => {
      setMouseDownPos(null);
      setHasMoved(false);
    }, 10);
  };

  // Document-level mouse listeners (OpenCut 核心機制)
  useEffect(() => {
    if (!timelineDragState.isDragging || !timelineRef.current) return;

    console.log('👂 設置拖拽監聽器:', timelineDragState.dragType);

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;

      const deltaX = e.clientX - timelineDragState.startMouseX;
      const deltaY = e.clientY - timelineDragState.startMouseY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 檢測是否真的移動了（超過5px視為拖拽）
      if (mouseDownPos && !hasMoved) {
        const moved = Math.abs(e.clientX - mouseDownPos.x) > 5 || Math.abs(e.clientY - mouseDownPos.y) > 5;
        if (moved) {
          setHasMoved(true);

          // 记录首次移动超过阈值
          TimelineDebugLogger.mouseMove({
            segmentId: timelineDragState.segmentId || '',
            distance,
            distanceX: deltaX,
            distanceY: deltaY,
            hasMoved: true,
            dragType: timelineDragState.dragType,
            dragDirection: timelineDragState.dragDirection,
          });
        }
      }

      const pixelsPerSecond = 100 * zoomLevel;
      const deltaTime = deltaX / pixelsPerSecond;

      const segment = segments.find(s => s.id === timelineDragState.segmentId);
      if (!segment) return;

      // Frame snapping (對齊到 30fps 影格)
      const fps = 30;
      const snapTimeToFrame = (time: number) => {
        return Math.round(time * fps) / fps;
      };

      // 只在 'move' 模式下檢測拖拽方向
      if (timelineDragState.dragType === 'move') {
        // 檢測拖拽方向（只在首次確定方向時）
        if (!timelineDragState.dragDirection && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 30)) {
          const newDirection = Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX) * 2
            ? 'vertical'
            : 'horizontal';

          // 记录方向确定
          TimelineDebugLogger.directionDetermined({
            direction: newDirection,
            deltaX,
            deltaY,
          });

          setTimelineDragState(prev => ({
            ...prev,
            dragDirection: newDirection,
          }));
        }

        // 垂直拖拽：切換軌道
        if (timelineDragState.dragDirection === 'vertical') {
          // 計算當前鼠標所在的軌道
          const tracksContainer = timelineRef.current.parentElement;
          if (!tracksContainer) return;

          const tracksRect = tracksContainer.getBoundingClientRect();
          const relativeY = e.clientY - tracksRect.top;

          // 計算軌道索引（考慮滾動）
          const scrollTop = tracksScrollRef.current?.scrollTop || 0;
          const adjustedY = relativeY + scrollTop;

          // 找到目標軌道
          let targetTrackIndex = -1;
          let accumulatedHeight = 0;

          for (let i = 0; i < tracks.length; i++) {
            const trackHeight = tracks[i].height || 60;
            if (adjustedY >= accumulatedHeight && adjustedY < accumulatedHeight + trackHeight) {
              targetTrackIndex = i;
              break;
            }
            accumulatedHeight += trackHeight;
          }

          if (targetTrackIndex >= 0 && targetTrackIndex < tracks.length) {
            const targetTrack = tracks[targetTrackIndex];

            // 更新目標軌道
            if (timelineDragState.targetTrackId !== targetTrack.id) {
              const sourceTrack = tracks.find(t => t.id === timelineDragState.sourceTrackId);

              // 记录轨道切换
              TimelineDebugLogger.trackSwitch({
                fromTrackId: timelineDragState.sourceTrackId || '',
                fromTrackName: sourceTrack?.name || '未知',
                toTrackId: targetTrack.id,
                toTrackName: targetTrack.name,
              });

              setTimelineDragState(prev => ({
                ...prev,
                targetTrackId: targetTrack.id,
              }));
            }
          }

          // 垂直拖拽時不更新時間
          return;
        }
      }

      // 水平拖拽：調整時間
      if (timelineDragState.dragType === 'left') {
        // 拖曳左邊緣,調整 startTime
        let newStartTime = snapTimeToFrame(Math.max(0, timelineDragState.startTime.start + deltaTime));
        if (newStartTime < segment.endTime) {
          console.log('⬅️ 更新左邊緣:', { oldStart: segment.startTime, newStart: newStartTime });
          updateSegment(timelineDragState.segmentId!, { startTime: newStartTime });
        }
      } else if (timelineDragState.dragType === 'right') {
        // 拖曳右邊緣,調整 endTime
        let newEndTime = snapTimeToFrame(Math.min(duration, timelineDragState.startTime.end + deltaTime));
        if (newEndTime > segment.startTime) {
          console.log('➡️ 更新右邊緣:', { oldEnd: segment.endTime, newEnd: newEndTime });
          updateSegment(timelineDragState.segmentId!, { endTime: newEndTime });
        }
      } else if (timelineDragState.dragType === 'move' && timelineDragState.dragDirection === 'horizontal') {
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

        console.log('🔄 更新整體位置:', {
          oldStart: segment.startTime,
          oldEnd: segment.endTime,
          newStart: newStartTime,
          newEnd: newEndTime
        });

        updateSegment(timelineDragState.segmentId!, {
          startTime: newStartTime,
          endTime: newEndTime,
        });
      }
    };

    const handleMouseUp = () => {
      // 计算移动距离
      const deltaX = mouseDownPos ? (window.event as MouseEvent).clientX - mouseDownPos.x : 0;
      const deltaY = mouseDownPos ? (window.event as MouseEvent).clientY - mouseDownPos.y : 0;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 确定动作类型
      let action: 'click' | 'drag-horizontal' | 'drag-vertical' | 'none' = 'none';
      if (!hasMoved) {
        action = 'click';
      } else if (timelineDragState.dragDirection === 'vertical') {
        action = 'drag-vertical';
      } else if (timelineDragState.dragDirection === 'horizontal' || timelineDragState.dragType !== 'move') {
        action = 'drag-horizontal';
      }

      // 获取目标轨道信息
      const targetTrack = tracks.find(t => t.id === timelineDragState.targetTrackId);

      // 记录 MouseUp 事件
      TimelineDebugLogger.mouseUp({
        segmentId: timelineDragState.segmentId,
        hasMoved,
        distance,
        action,
        targetTrackId: timelineDragState.targetTrackId || undefined,
        targetTrackName: targetTrack?.name || undefined,
      });

      // 如果是垂直拖拽且切換了軌道，執行軌道切換
      if (
        timelineDragState.dragDirection === 'vertical' &&
        timelineDragState.sourceTrackId &&
        timelineDragState.targetTrackId &&
        timelineDragState.sourceTrackId !== timelineDragState.targetTrackId &&
        timelineDragState.segmentId
      ) {
        moveSegmentToTrack(
          timelineDragState.sourceTrackId,
          timelineDragState.targetTrackId,
          timelineDragState.segmentId
        );
      }

      handleTimelineDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [timelineDragState, segments, duration, zoomLevel, updateSegment, mouseDownPos, hasMoved, tracks, moveSegmentToTrack]);

  return (
    <>
      <toast.ToastContainer />
      <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* 頂部工具列 */}
      <header className="h-10 border-b border-gray-800 flex items-center px-3 gap-1.5 bg-gray-900">
        <h1 className="text-sm font-bold mr-2">OpenCut 字幕編輯器</h1>
        
        <button
          onClick={() => window.location.href = '/editor'}
          className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition text-xs"
          title="回到專案頁面"
        >
          <ArrowLeftToLine size={12} />
          回到專案
        </button>

        <div className="h-5 w-px bg-gray-700 mx-1" />
        
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

        {/* 新增字幕按钮组（带下拉菜单） */}
        <div className="relative" ref={addSubtitleMenuRef}>
          <div className="flex items-center">
            {/* 主按钮 - 快速添加到当前选中轨道 */}
            <button
              onClick={() => handleAddSubtitle()}
              disabled={!videoUrl || duration === 0}
              className="flex items-center gap-1 pl-2 pr-1.5 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-l transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title={`在當前時間創建新字幕 (Ctrl+N)\n將添加到: ${tracks.find(t => t.id === selectedTrackId)?.name || tracks[0]?.name || '轨道 1'}`}
            >
              <Plus size={12} />
              新增字幕
            </button>

            {/* 下拉箭头按钮 - 选择目标轨道 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddSubtitleMenu(!showAddSubtitleMenu);
              }}
              disabled={!videoUrl || duration === 0}
              className="px-1 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-r border-l border-cyan-700 transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="選擇目標軌道"
            >
              <ChevronDown size={10} />
            </button>
          </div>

          {/* 下拉菜单 */}
          {showAddSubtitleMenu && tracks.length > 0 && (
            <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-gray-800 border border-gray-700 rounded shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-[0.65rem] text-gray-400 font-medium border-b border-gray-700">
                選擇目標軌道
              </div>
              {tracks.map((track, index) => {
                const isSelected = track.id === selectedTrackId;
                const isVisible = track.visible !== false;
                const isLocked = track.locked;
                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      if (!isLocked) {
                        handleAddSubtitle(track.id);
                        setShowAddSubtitleMenu(false);
                      }
                    }}
                    disabled={isLocked}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition ${
                      isLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-700 cursor-pointer'
                    } ${isSelected && !isLocked ? 'bg-gray-700/50' : ''}`}
                    title={isLocked ? `${track.name} 已被鎖定，無法添加字幕` : ''}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`${isSelected && !isLocked ? 'text-cyan-400' : isLocked ? 'text-gray-500' : 'text-gray-300'}`}>
                        {track.name || `軌道 ${index + 1}`}
                      </span>
                      {!isVisible && (
                        <span className="text-[0.6rem] text-gray-500">(隱藏)</span>
                      )}
                      {isLocked && (
                        <span className="text-[0.6rem] text-yellow-500">(鎖定)</span>
                      )}
                    </div>
                    {isSelected && !isLocked && <Check size={12} className="text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

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

        {/* 渲染方式選擇器 */}
        <div className="flex items-center gap-1">
          <select
            value={renderMethod}
            onChange={(e) => setRenderMethod(e.target.value as 'ffmpeg' | 'canvas' | 'drawtext')}
            className="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            disabled={isExporting}
            title={
              renderMethod === 'drawtext' ?
                '使用 FFmpeg DrawText 渲染，支援固定字幕、描邊和陰影，與瀏覽器預覽一致' :
                '基本 FFmpeg ASS 渲染，速度較快但效果有限'
            }
          >
            {/* <option value="canvas">🎨 Canvas 渲染 (高質量)</option> */}
            <option value="drawtext">✏️ DrawText 渲染 (高質量)</option>
            <option value="ffmpeg">⚡ FFmpeg 渲染 (快速)</option>
          </select>
        </div>

        <button
          onClick={handleExportVideo}
          disabled={(!videoFile && !videoUrl) || (tracks.length > 0 && tracks[0]?.segments.length === 0) || isExporting || isRecording}
          className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Film size={12} />
          {isExporting ? `輸出中 ${exportProgress}%` : '輸出影片'}
        </button>

        {/* 錄製預覽按鈕 */}
        <button
          onClick={isRecording ? cancel : handleRecordPreview}
          disabled={(!videoFile && !videoUrl) || (tracks.length > 0 && tracks[0]?.segments.length === 0) || isExporting}
          className={`flex items-center gap-1 px-2 py-1 ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} rounded transition text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
          title="直接錄製預覽畫面，保證100%一致"
        >
          <Video size={12} />
          {isRecording ? `錄製中 ${Math.round(recordProgress * 100)}%` : '🎬 錄製預覽'}
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
              <Panel defaultSize={60} minSize={30}>
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
                          <div className="flex flex-col gap-1 p-1 h-auto w-full relative">
                            <div data-radix-aspect-ratio-wrapper="" style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
                              <div
                                className="bg-panel-accent relative overflow-hidden rounded-md cursor-pointer hover:bg-panel-accent/80 transition-colors"
                                style={{ position: 'absolute', inset: '0px' }}
                                onClick={() => handleAddSubtitle()}
                                title="點擊新增字幕"
                              >
                                <div className="flex items-center justify-center w-full h-full bg-panel-accent rounded">
                                  <span className="text-xs select-none">Default text</span>
                                </div>
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
            <div ref={previewContainerRef} className="h-full flex items-center justify-center bg-black overflow-hidden relative">
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
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      style={{
                        pointerEvents: showTimelineAdjust ? 'none' : 'auto'
                      }}
                    />

                    {/* 彈窗鎖定遮罩 */}
                    {showTimelineAdjust && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-600">
                          <p className="text-white text-sm">🔒 時間軸調整中...</p>
                        </div>
                      </div>
                    )}

                    {/* 字幕疊加層 - 支持多轨道 */}
                    {Object.entries(currentSubtitles).map(([trackId, subtitle]) => {
                      const track = tracks.find(t => t.id === trackId);
                      if (!track || !track.visible || track.muted) return null;

                      // 只有选中的字幕才显示拖拽手柄
                      const isCurrentSubtitleSelected = selectedSegmentId === subtitle.id;

                      return (
                        <div
                          key={trackId}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none group/subtitle"
                          style={{
                            zIndex: isCurrentSubtitleSelected ? 50 : 10
                          }}
                        >
                          <div
                            className="absolute pointer-events-auto"
                            style={{
                              top: `${subtitle.style.positionY}%`,
                              left: `${subtitle.style.positionX}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            {/* 可拖曳縮放的容器 */}
                            <div
                              className="relative inline-block"
                              style={{
                                maxWidth: `${subtitle.style.maxWidth}vw`,
                                pointerEvents: 'auto',
                              }}
                            >
                              {/* 悬停提示 - 显示轨道名称 */}
                              {!isCurrentSubtitleSelected && (
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover/subtitle:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-gray-700">
                                  {track.name} - 点击编辑
                                </div>
                              )}

                              {/* 字幕內容 */}
                              <div
                                className="rounded relative transition-all duration-200"
                                style={{
                                  backgroundColor: subtitle.style.backgroundColor,
                                  opacity: subtitle.style.opacity,
                                  transform: `scale(${subtitle.style.scale})`,
                                  transformOrigin: 'center',
                                  cursor: isDragging ? 'grabbing' : (isCurrentSubtitleSelected ? 'grab' : 'pointer'),
                                  wordWrap: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  padding: `${(8 / 1080) * videoDisplaySize.height}px ${(16 / 1080) * videoDisplaySize.height}px`,
                                  borderRadius: `${(4 / 1080) * videoDisplaySize.height}px`,
                                  // 添加彩色边框
                                  outline: isCurrentSubtitleSelected
                                    ? `3px solid ${track.color}`
                                    : '2px solid transparent',
                                  outlineOffset: '4px',
                                  boxShadow: isCurrentSubtitleSelected
                                    ? `0 0 20px ${track.color}80, 0 0 40px ${track.color}40`
                                    : 'none',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('🎯 点击视频预览区字幕', {
                                    trackId,
                                    segmentId: subtitle.id,
                                    text: subtitle.text,
                                    isAlreadySelected: isCurrentSubtitleSelected
                                  });
                                  if (!isCurrentSubtitleSelected) {
                                    handleSegmentClick(subtitle.id, subtitle.startTime);
                                    selectTrack(trackId);
                                  }
                                }}
                                onMouseDown={isCurrentSubtitleSelected ? handleSubtitleDragStart : undefined}
                              >
                                <p
                                  className="text-center"
                                  style={{
                                    fontSize: `${(subtitle.style.fontSize * subtitle.style.scale / 1080) * videoDisplaySize.height}px`,
                                    fontFamily: subtitle.style.fontFamily,
                                    fontWeight: subtitle.style.fontWeight,
                                    fontStyle: subtitle.style.fontStyle,
                                    textDecoration: subtitle.style.textDecoration,
                                    color: subtitle.style.color,
                                    whiteSpace: 'pre-wrap',
                                    textShadow: (() => {
                                      const shadows: string[] = [];

                                      if (subtitle.style.enableStroke) {
                                        const strokeWidth = (subtitle.style.strokeWidth / 1080) * videoDisplaySize.height;
                                        const steps = 16;

                                        for (let i = 0; i < steps; i++) {
                                          const angle = (i * 2 * Math.PI) / steps;
                                          const x = Math.cos(angle) * strokeWidth;
                                          const y = Math.sin(angle) * strokeWidth;
                                          shadows.push(`${x}px ${y}px 0 ${subtitle.style.strokeColor}`);
                                        }
                                      }

                                      if (subtitle.style.enableShadow) {
                                        const shadowX = (subtitle.style.shadowOffsetX / 1080) * videoDisplaySize.height;
                                        const shadowY = (subtitle.style.shadowOffsetY / 1080) * videoDisplaySize.height;
                                        const shadowBlur = (subtitle.style.shadowBlur / 1080) * videoDisplaySize.height;
                                        shadows.push(`${shadowX}px ${shadowY}px ${shadowBlur}px ${subtitle.style.shadowColor}`);
                                      }

                                      return shadows.length > 0 ? shadows.join(', ') : 'none';
                                    })(),
                                  }}
                                >
                                  {(() => {
                                    const containerWidthPx = (subtitle.style.maxWidth / 100) * videoDisplaySize.width;
                                    const paddingPx = (16 / 1080) * videoDisplaySize.height * 2;
                                    const actualMaxWidth = containerWidthPx - paddingPx;
                                    const actualFontSize = (subtitle.style.fontSize * subtitle.style.scale / 1080) * videoDisplaySize.height;

                                    return wrapSubtitleTextByWidth(
                                      subtitle.translatedText || subtitle.text,
                                      actualMaxWidth,
                                      actualFontSize,
                                      subtitle.style.fontFamily,
                                      subtitle.style.fontWeight,
                                      subtitle.style.fontStyle
                                    );
                                  })()}
                                </p>
                              </div>

                              {/* 邊框和手柄容器 - 只在选中时显示 */}
                              {isCurrentSubtitleSelected && (
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
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* 固定字幕渲染 */}
                    {pinnedSubtitles.filter(p => p.enabled).map(pinned => (
                      <div
                        key={pinned.id}
                        className="absolute left-1/2 pointer-events-none"
                        style={{
                          top: `${pinned.style.positionY}%`,
                          transform: 'translate(-50%, -50%)',
                          width: '90%',
                        }}
                      >
                        <div
                          className="rounded px-4 py-2"
                          style={{
                            backgroundColor: pinned.style.backgroundColor,
                            textAlign: 'center',
                          }}
                        >
                          <p
                            style={{
                              fontSize: `${(pinned.style.fontSize / 1080) * videoDisplaySize.height}px`,
                              fontFamily: pinned.style.fontFamily,
                              fontWeight: pinned.style.fontWeight,
                              fontStyle: pinned.style.fontStyle,
                              color: pinned.style.color,
                              whiteSpace: 'pre-wrap',
                              textShadow: (() => {
                                const shadows: string[] = [];

                                if (pinned.style.enableStroke) {
                                  const strokeWidth = (pinned.style.strokeWidth / 1080) * videoDisplaySize.height;
                                  const steps = 16;
                                  for (let i = 0; i < steps; i++) {
                                    const angle = (i * 2 * Math.PI) / steps;
                                    const x = Math.cos(angle) * strokeWidth;
                                    const y = Math.sin(angle) * strokeWidth;
                                    shadows.push(`${x}px ${y}px 0 ${pinned.style.strokeColor}`);
                                  }
                                }

                                if (pinned.style.enableShadow) {
                                  const shadowX = (pinned.style.shadowOffsetX / 1080) * videoDisplaySize.height;
                                  const shadowY = (pinned.style.shadowOffsetY / 1080) * videoDisplaySize.height;
                                  const shadowBlur = (pinned.style.shadowBlur / 1080) * videoDisplaySize.height;
                                  shadows.push(`${shadowX}px ${shadowY}px ${shadowBlur}px ${pinned.style.shadowColor}`);
                                }

                                return shadows.length > 0 ? shadows.join(', ') : 'none';
                              })(),
                            }}
                          >
                            {(() => {
                              // 計算固定字幕的實際最大寬度
                              // width: '90%' 表示父容器的 90%
                              const containerWidthPx = window.innerWidth * 0.9;
                              // 減去 padding（左右各 16px，對應 px-4）
                              const paddingPx = 16 * 2;
                              const actualMaxWidth = containerWidthPx - paddingPx;

                              // 計算實際字體大小
                              const actualFontSize = (pinned.style.fontSize / 1080) * videoDisplaySize.height;

                              // 使用基於寬度的智能換行
                              return wrapSubtitleTextByWidth(
                                pinned.text,
                                actualMaxWidth,
                                actualFontSize,
                                pinned.style.fontFamily,
                                pinned.style.fontWeight,
                                pinned.style.fontStyle
                              );
                            })()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
                  </Panel>
                </PanelGroup>
              </Panel>

              {/* 垂直調整手柄 */}
              <PanelResizeHandle className="h-1 bg-gray-800 hover:bg-blue-600 transition cursor-row-resize" />

              {/* 底部: 時間軸面板 (只延伸到媒體+預覽區域) */}
              <Panel defaultSize={40} minSize={15} maxSize={50}>
                <div className="h-full flex flex-col bg-gray-900">
                  {/* OpenCut TimelineToolbar - 播放控制 + 編輯工具 + 縮放控制 */}
                  <div className="flex items-center justify-between px-2 py-1 border-b bg-zinc-900 h-8">
                    {/* 左側: 播放控制 + 編輯工具 */}
                    <div className="flex items-center gap-2">
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
                          console.log('🗑️ 删除按钮被点击');
                          console.log('selectedSegmentId:', selectedSegmentId);

                          if (!selectedSegmentId) {
                            console.log('❌ 没有选中的字幕');
                            return;
                          }

                          // 从所有轨道中查找要删除的字幕
                          let segmentToDelete = null;
                          for (const track of tracks) {
                            const segment = track.segments.find(s => s.id === selectedSegmentId);
                            if (segment) {
                              segmentToDelete = segment;
                              break;
                            }
                          }

                          console.log('要删除的字幕:', segmentToDelete);

                          if (segmentToDelete && window.confirm(`確定要刪除字幕「${segmentToDelete.text}」嗎?`)) {
                            console.log('✅ 确认删除，调用 deleteSegment');
                            deleteSegment(selectedSegmentId);
                            setSelectedSegmentId(null);
                            toast.success('字幕已刪除');
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

                      {/* 状态指示器 - 显示当前编辑信息 */}
                      {selectedSegmentId && currentTrackInfo.track && (
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-800/50 rounded border border-gray-700 cursor-pointer hover:bg-gray-800/70 transition-colors"
                          onClick={() => {
                            if (selectedSegmentId) {
                              const segment = currentTrackInfo.track?.segments.find(s => s.id === selectedSegmentId);
                              if (segment) {
                                seekTo(segment.startTime);
                              }
                            }
                          }}
                          title="点击跳转到当前字幕\n双击定位到时间轴"
                        >
                          {/* 轨道颜色指示器 */}
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: currentTrackInfo.track.color,
                              boxShadow: `0 0 8px ${currentTrackInfo.track.color}80`
                            }}
                          />
                          <span className="text-[0.65rem] text-gray-300 font-medium">
                            正在编辑:
                          </span>
                          <span className="text-[0.65rem] text-white font-semibold">
                            {currentTrackInfo.track.name}
                          </span>
                          <span className="text-[0.65rem] text-gray-500">-</span>
                          <span className="text-[0.65rem] text-blue-400 font-mono">
                            #{currentTrackInfo.segmentIndex + 1}
                          </span>
                          <span className="text-[0.6rem] text-gray-500">
                            / {currentTrackInfo.track.segments.length}
                          </span>
                        </div>
                      )}
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
                            className="relative h-8 select-none cursor-pointer"
                            style={{
                              width: `${Math.max(duration * 100 * zoomLevel, 1500)}px`,
                            }}
                            onMouseDown={(e) => {
                              setMouseDownPosition({ x: e.clientX, y: e.clientY });
                              setIsClickAction(true);
                            }}
                            onMouseMove={(e) => {
                              if (mouseDownPosition) {
                                const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
                                const deltaY = Math.abs(e.clientY - mouseDownPosition.y);
                                if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                                  setIsClickAction(false);
                                }
                              }
                            }}
                            onMouseUp={(e) => {
                              if (isClickAction && mouseDownPosition) {
                                handleTimelineClick(e);
                              }
                              setMouseDownPosition(null);
                              setIsClickAction(true);
                            }}
                            onClick={(e) => {
                              // 使用 onMouseUp 處理，這裡阻止默認行為
                              e.preventDefault();
                            }}
                          >
                            {/* 時間標記 */}
                            {duration > 0 && (() => {
                              const pixelsPerSecond = 100 * zoomLevel;
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
                                  left: `${bookmarkTime * 100 * zoomLevel}px`,
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
                            {/* 渲染所有轨道标签 */}
                            {tracks.map((track, index) => {
                              // 检查当前选中的字幕是否属于这个轨道
                              const hasSelectedSubtitle = selectedSegmentId && track.segments.some(seg => seg.id === selectedSegmentId);
                              const selectedSegmentIndex = hasSelectedSubtitle
                                ? track.segments.findIndex(seg => seg.id === selectedSegmentId)
                                : -1;

                              return (
                                <div
                                  key={track.id}
                                  className={`flex flex-col px-2 py-1 group cursor-pointer border-l-4 transition-all ${
                                    hasSelectedSubtitle
                                      ? 'bg-gray-800/70 border-opacity-100'
                                      : selectedTrackId === track.id
                                        ? 'border-blue-500 bg-gray-800/50 border-opacity-60'
                                        : 'border-transparent hover:bg-gray-800/30'
                                  }`}
                                  style={{
                                    height: `${track.height}px`,
                                    borderLeftColor: hasSelectedSubtitle ? track.color : (selectedTrackId === track.id ? '#3b82f6' : 'transparent'),
                                  }}
                                  onClick={() => selectTrack(track.id)}
                                  title={`点击选择轨道: ${track.name}\n共 ${track.segments.length} 个字幕${hasSelectedSubtitle ? `\n当前编辑: #${selectedSegmentIndex + 1}` : ''}`}
                                >
                                  <div className="flex items-center justify-between flex-1 min-w-0 gap-1">
                                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                      <span className="text-[0.65rem] text-gray-300 truncate font-medium" title={track.name}>
                                        {track.name}
                                      </span>
                                      {/* 统计信息 */}
                                      <div className="flex items-center gap-1 text-[0.55rem]">
                                        <span className="text-gray-500">
                                          {track.segments.length} 个
                                        </span>
                                        {hasSelectedSubtitle && (
                                          <span className="text-white bg-gray-700 px-1 rounded font-medium">
                                            #{selectedSegmentIndex + 1}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                      {/* 显示/隐藏按钮 */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateTrack(track.id, { visible: !track.visible });
                                        }}
                                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-700"
                                        title={track.visible ? '隐藏轨道' : '显示轨道'}
                                      >
                                        {track.visible ? (
                                          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                          </svg>
                                        ) : (
                                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                            <line x1="2" x2="22" y1="2" y2="22" />
                                          </svg>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* 添加新轨道按钮 */}
                            <div
                              className="flex items-center px-2 cursor-pointer hover:bg-gray-800/30 transition"
                              style={{ height: '40px' }}
                              onClick={() => {
                                const trackCount = tracks.length;
                                addTrack(`字幕轨道 ${trackCount + 1}`);
                                toast.success(`已添加轨道 ${trackCount + 1}`);
                              }}
                              title="添加新轨道"
                            >
                              <div className="flex items-center justify-center flex-1 gap-1">
                                <Plus className="w-3 h-3 text-gray-500" />
                                <span className="text-[0.65rem] text-gray-500">添加轨道</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 軌道內容 */}
                      <div className="flex-1 relative overflow-hidden">
                        <div
                          className="overflow-auto scrollbar-thin w-full h-full cursor-pointer"
                          id="tracks-scroll"
                          onMouseDown={(e) => {
                            // 檢查是否點擊在字幕段落上
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-segment-id]')) {
                              return;
                            }
                            setMouseDownPosition({ x: e.clientX, y: e.clientY });
                            setIsClickAction(true);
                          }}
                          onMouseMove={(e) => {
                            if (mouseDownPosition) {
                              const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
                              const deltaY = Math.abs(e.clientY - mouseDownPosition.y);
                              if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                                setIsClickAction(false);
                              }
                            }
                          }}
                          onMouseUp={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-segment-id]')) {
                              setMouseDownPosition(null);
                              setIsClickAction(true);
                              return;
                            }

                            if (isClickAction && mouseDownPosition) {
                              // 使用 tracks-scroll 作為參考容器
                              const container = tracksScrollRef.current;
                              if (container) {
                                const rect = container.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const scrollLeft = container.scrollLeft;

                                const pixelsPerSecond = 100 * zoomLevel;
                                const absoluteClickX = clickX + scrollLeft;
                                let newTime = absoluteClickX / pixelsPerSecond;

                                // 對齊到幀（30fps）
                                const fps = 30;
                                newTime = Math.round(newTime * fps) / fps;

                                // 邊界限制
                                newTime = Math.max(0, Math.min(duration, newTime));

                                console.log('🎯 軌道容器點擊跳轉:', {
                                  clickX,
                                  scrollLeft,
                                  absoluteClickX,
                                  pixelsPerSecond,
                                  newTime,
                                  zoomLevel
                                });

                                seekTo(newTime);
                              }
                            }
                            setMouseDownPosition(null);
                            setIsClickAction(true);
                          }}
                        >
                          <div
                            ref={timelineRef}
                            className="relative flex-1 cursor-pointer flex flex-col gap-1"
                            style={{
                              height: `${tracks.reduce((sum, track) => sum + track.height, 0) + (tracks.length + 1) * 40}px`,
                              width: `${Math.max(duration * 100 * zoomLevel, 1500)}px`,
                            }}
                            onMouseDown={(e) => {
                              // 檢查是否點擊在字幕段落上
                              const target = e.target as HTMLElement;
                              if (target.closest('[data-segment-id]')) {
                                // 點擊在字幕上，由字幕處理
                                return;
                              }
                              setMouseDownPosition({ x: e.clientX, y: e.clientY });
                              setIsClickAction(true);
                            }}
                            onMouseMove={(e) => {
                              if (mouseDownPosition) {
                                const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
                                const deltaY = Math.abs(e.clientY - mouseDownPosition.y);
                                if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                                  setIsClickAction(false);
                                }
                              }
                            }}
                            onMouseUp={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('[data-segment-id]')) {
                                // 點擊在字幕上，由字幕處理
                                setMouseDownPosition(null);
                                setIsClickAction(true);
                                return;
                              }

                              if (isClickAction && mouseDownPosition) {
                                handleTimelineClick(e);
                              }
                              setMouseDownPosition(null);
                              setIsClickAction(true);
                            }}
                          >
                            {/* SubtitlePlayhead 元件 - OpenCut 風格播放頭 (延伸到底部) */}
                            {duration > 0 && (
                              <SubtitlePlayhead
                                currentTime={currentTime}
                                pixelsPerSecond={100 * zoomLevel}
                                containerRef={tracksScrollRef}
                                onSeek={seekTo}
                                duration={duration}
                                timelineRef={timelineContentRef}
                              />
                            )}

                            {/* 渲染所有轨道 */}
                            {tracks.map((track, trackIndex) => (
                              <div
                                key={track.id}
                                className={`relative ${track.visible ? '' : 'opacity-30'}`}
                                style={{ height: `${track.height}px` }}
                              >
                                <div
                                  className={`w-full h-full hover:bg-gray-800/20 relative transition-all ${
                                    selectedTrackId === track.id ? 'bg-gray-800/10' : ''
                                  } ${
                                    timelineDragState.dragDirection === 'vertical' &&
                                    timelineDragState.targetTrackId === track.id
                                      ? 'bg-blue-500/20 border-2 border-dashed border-blue-400'
                                      : ''
                                  }`}
                                  onClick={() => selectTrack(track.id)}
                                >
                                  {/* 字幕片段 */}
                                  {track.segments.map((segment, segmentIndex) => {
                                      const left = segment.startTime * 100 * zoomLevel;
                                      const width = (segment.endTime - segment.startTime) * 100 * zoomLevel;
                                      const isSelected = selectedSegmentId === segment.id;

                                      // 计算轨道颜色的亮色版本（用于选中状态）
                                      const getBrighterColor = (hexColor: string) => {
                                        // 将 hex 转换为 rgb
                                        const r = parseInt(hexColor.slice(1, 3), 16);
                                        const g = parseInt(hexColor.slice(3, 5), 16);
                                        const b = parseInt(hexColor.slice(5, 7), 16);

                                        // 增加亮度（混合白色）
                                        const factor = 0.4;
                                        const newR = Math.min(255, r + (255 - r) * factor);
                                        const newG = Math.min(255, g + (255 - g) * factor);
                                        const newB = Math.min(255, b + (255 - b) * factor);

                                        return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
                                      };

                                      return (
                                        <div
                                          key={segment.id}
                                          data-segment-id={segment.id}
                                          className={`absolute top-4 h-8 rounded transition-all duration-200 group ${
                                            isSelected
                                              ? 'border-opacity-100'
                                              : 'hover:border-opacity-80 border-opacity-60'
                                          }`}
                                          style={{
                                            left: `${left}px`,
                                            width: `${Math.max(width, 80)}px`,
                                            backgroundColor: track.color,
                                            borderColor: isSelected ? getBrighterColor(track.color) : track.color,
                                            borderWidth: isSelected ? '3px' : '2px',
                                            borderStyle: 'solid',
                                            boxShadow: isSelected
                                              ? `0 0 20px ${track.color}80, 0 0 40px ${track.color}40, inset 0 0 10px ${track.color}30`
                                              : 'none',
                                            animation: isSelected ? 'pulse-subtle 2s ease-in-out infinite' : 'none',
                                          }}
                                        >
                                          {/* 序号标记 - 左上角显示 */}
                                          {isSelected && (
                                            <div className="absolute -top-4 left-0 bg-gray-900 text-white text-[0.6rem] px-1.5 py-0.5 rounded font-medium border border-gray-700 whitespace-nowrap z-10">
                                              #{segmentIndex + 1}
                                            </div>
                                          )}

                                          {/* 左邊緣拖曳手柄 - OpenCut 風格 */}
                                          <div
                                            className="absolute left-0 top-0 bottom-0 w-[0.6rem] cursor-w-resize bg-primary z-50 flex items-center justify-center hover:bg-primary/80 transition"
                                            onMouseDown={(e) => handleTimelineDragStart(e, segment.id, 'left', track.id)}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {isSelected && (
                                              <div className="w-[0.2rem] h-[1.5rem] bg-foreground/75 rounded-full" />
                                            )}
                                          </div>

                                          {/* 中間區域:點擊選中,拖曳移動,雙擊打開調整面板,右鍵菜單 */}
                                          <div
                                            className={`h-full flex items-center px-2 ${
                                              timelineDragState.dragDirection === 'vertical' && timelineDragState.segmentId === segment.id
                                                ? 'cursor-grabbing opacity-50'
                                                : 'cursor-move'
                                            }`}
                                            onMouseDown={(e) => handleTimelineDragStart(e, segment.id, 'move', track.id)}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              // 只有沒有拖拽才觸發點擊
                                              if (!hasMoved) {
                                                // 【修復】使用鼠標 Y 軸位置驗證點擊的軌道
                                                // 這確保即使在複雜情況下也能正確識別軌道
                                                const detectedTrackId = getTrackFromMouseY(e.clientY);
                                                const finalTrackId = detectedTrackId || track.id;

                                                // 使用调试日志工具
                                                TimelineDebugLogger.click({
                                                  trackId: finalTrackId,
                                                  trackName: tracks.find(t => t.id === finalTrackId)?.name || track.name,
                                                  segmentId: segment.id,
                                                  segmentText: segment.text,
                                                  startTime: segment.startTime,
                                                  wasAlreadySelected: selectedSegmentId === segment.id,
                                                });

                                                handleSegmentClick(segment.id, segment.startTime);
                                                selectTrack(finalTrackId);
                                              }
                                            }}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              // 只有沒有拖拽才觸發雙擊
                                              if (!hasMoved) {
                                                // 【修復】雙擊時也使用 Y 軸位置驗證軌道
                                                const detectedTrackId = getTrackFromMouseY(e.clientY);
                                                const finalTrackId = detectedTrackId || track.id;

                                                // 確保選中正確的軌道
                                                selectTrack(finalTrackId);
                                                setAdjustingSegmentId(segment.id);
                                                setShowTimelineAdjust(true);
                                              }
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, segment.id, track.id)}
                                          >
                                            <span className="text-[0.65rem] text-white truncate flex-1" title={segment.text}>
                                              {segment.text}
                                            </span>
                                          </div>

                                          {/* 右邊緣拖曳手柄 - OpenCut 風格 */}
                                          <div
                                            className="absolute right-0 top-0 bottom-0 w-[0.6rem] cursor-e-resize bg-primary z-50 flex items-center justify-center hover:bg-primary/80 transition"
                                            onMouseDown={(e) => handleTimelineDragStart(e, segment.id, 'right', track.id)}
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
                            ))}
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

         {/* 右側: 字幕屬性編輯面板 */}
         <Panel defaultSize={30} minSize={25}>
           <div className="h-full flex flex-col bg-gray-900">
             <div className="h-9 border-b border-gray-800 flex items-center px-3 justify-between">
               <h2 className="text-sm font-semibold">
                 {editMode === 'normal' ? '字幕屬性' : '固定字幕'}
               </h2>
               <div className="flex gap-1">
                 <button
                   onClick={() => setEditMode('normal')}
                   className={`px-3 py-1 text-xs rounded transition ${
                     editMode === 'normal'
                       ? 'bg-blue-600 text-white'
                       : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                   }`}
                 >
                   普通字幕
                 </button>
                 <button
                   onClick={() => setEditMode('pinned')}
                   className={`px-3 py-1 text-xs rounded transition ${
                     editMode === 'pinned'
                       ? 'bg-blue-600 text-white'
                       : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                   }`}
                 >
                   固定字幕
                 </button>
               </div>
             </div>

             {editMode === 'normal' ? (
               <SubtitlePropertiesPanel
                 selectedSegmentId={selectedSegmentId}
                 applyToAll={applyToAll}
                 setApplyToAll={setApplyToAll}
                 currentTrack={currentTrackInfo.track}
                 segmentIndex={currentTrackInfo.segmentIndex}
                 onDelete={() => {
                   setSelectedSegmentId(null);
                   toast.success('字幕已刪除');
                 }}
               />
             ) : (
               <PinnedSubtitlePanel />
             )}
           </div>
         </Panel>
       </PanelGroup>
     </div>

      {/* 批量編輯彈窗 */}
      <BulkSubtitleEditor
        isOpen={showBulkEditor}
        onClose={() => setShowBulkEditor(false)}
        videoUrl={videoUrl || undefined}
      />

      {/* 時間軸精確調整彈窗 */}
      {showTimelineAdjust && adjustingSegmentId && (() => {
        console.log('🔍 彈窗渲染檢查:', {
          showTimelineAdjust,
          adjustingSegmentId,
          segmentsCount: segments.length,
          tracksCount: tracks.length,
          allSegments: tracks.flatMap(t => t.segments).length
        });

        // 從所有軌道中查找字幕
        const allSegments = tracks.flatMap(t => t.segments);
        const adjustingSegment = allSegments.find(s => s.id === adjustingSegmentId);

        if (!adjustingSegment) {
          console.error('❌ 找不到字幕片段:', adjustingSegmentId);
          return null;
        }

        console.log('✅ 找到字幕，渲染彈窗:', adjustingSegment.text);

        // 暫停主視頻並設置標記
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }

        return (
          <TimelineAdjustDialog
            segment={adjustingSegment}
            videoDuration={duration}
            currentTime={currentTime}
            videoUrl={videoUrl}
            mainVideoRef={videoRef}
            onClose={() => {
              console.log('🚪 關閉彈窗');
              setShowTimelineAdjust(false);
              setAdjustingSegmentId(null);
            }}
            onConfirm={(startTime, endTime) => {
              console.log('✅ 確認更新時間:', { startTime, endTime });
              updateSegment(adjustingSegmentId, { startTime, endTime });
              toast.success('字幕時間已更新！');
            }}
            onDelete={() => {
              console.log('🗑️ 刪除字幕:', adjustingSegmentId);
              setShowTimelineAdjust(false);
              setAdjustingSegmentId(null);
              setSelectedSegmentId(null);
              toast.success('字幕已刪除');
            }}
          />
        );
      })()}

      {/* 右鍵菜單 */}
      {contextMenu.show && (
        <div
          className="fixed z-[9999] bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 移動到軌道選項 */}
          <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold">移動到軌道</div>
          {tracks.map((track) => (
            <button
              key={track.id}
              className="w-full px-4 py-2 text-sm text-left hover:bg-gray-700 flex items-center justify-between transition"
              onClick={() => handleMoveToTrack(track.id)}
            >
              <span className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: track.color }}
                />
                {track.name}
              </span>
              {contextMenu.trackId === track.id && (
                <span className="text-blue-500">✓</span>
              )}
            </button>
          ))}

          {/* 分隔線 */}
          <div className="my-1 border-t border-gray-700" />

          {/* 複製字幕 */}
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-gray-700 flex items-center gap-2 transition"
            onClick={handleDuplicateSegment}
          >
            <Copy className="w-4 h-4" />
            複製字幕
          </button>

          {/* 刪除字幕 */}
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-red-900/30 text-red-400 flex items-center gap-2 transition"
            onClick={handleDeleteFromMenu}
          >
            <Trash2 className="w-4 h-4" />
            刪除字幕
          </button>
        </div>
      )}
    </div>
    </>
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