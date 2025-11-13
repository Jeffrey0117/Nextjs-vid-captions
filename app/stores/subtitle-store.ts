import { create } from 'zustand';

export interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translatedText?: string;
  style: {
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline' | 'line-through';
    color: string;
    opacity: number;
    backgroundColor: string;
    position: 'top' | 'center' | 'bottom';
    enableShadow: boolean; // 陰影開關
    shadowColor: string;
    shadowOffsetX: number; // 陰影 X 偏移 (-50 to 50)
    shadowOffsetY: number; // 陰影 Y 偏移 (-50 to 50)
    shadowBlur: number; // 陰影模糊半徑 (0-50)
    enableStroke: boolean; // 描邊開關
    strokeColor: string; // 描邊顏色
    strokeWidth: number; // 描邊寬度 (0-10)
    positionX: number; // 水平位置百分比 (0-100, 50=中間)
    positionY: number; // 垂直位置百分比 (0-100)
    maxWidth: number; // 最大寬度 vw 單位 (10-100)
    scale: number; // 縮放比例 (0.5-3.0)
  };
}

// 字幕樣式模板
export interface StyleTemplate {
  id: string;
  name: string; // 模板名稱，如 "預設", "標題樣式", "對話樣式" 等
  style: SubtitleSegment['style'];
  isDefault: boolean; // 是否為預設模板
  createdAt: number; // 創建時間戳
}

// 固定字幕（貫穿整個影片的字幕）
export interface PinnedSubtitle {
  id: string;
  text: string;
  position: 'top' | 'bottom';
  enabled: boolean; // 是否启用
  style: {
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    color: string;
    opacity: number;
    backgroundColor: string; // 顶部固定字幕用
    enableShadow: boolean;
    shadowColor: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    enableStroke: boolean;
    strokeColor: string;
    strokeWidth: number;
    positionY: number; // 精确垂直位置（0-100）
  };
}

// 字幕軌道類型定義 (參考 OpenCut TimelineTrack)
export interface SubtitleTrack {
  id: string;
  name: string; // "中文字幕", "English Subtitles", etc.
  segments: SubtitleSegment[];
  muted: boolean; // 是否靜音 (不顯示)
  visible: boolean; // 是否在時間軸顯示
  locked: boolean; // 是否鎖定 (無法編輯)
  color: string; // 軌道顏色標記 (用於時間軸區分)
  height: number; // 軌道高度 (px)
  defaultStyle?: Partial<SubtitleSegment['style']>; // 該軌道的預設樣式
}

interface SubtitleStore {
  // 多軌道支援
  tracks: SubtitleTrack[];
  selectedTrackId: string | null;
  selectedSegmentId: string | null;

  // 樣式模板支援
  styleTemplates: StyleTemplate[];

  // 固定字幕支援
  pinnedSubtitles: PinnedSubtitle[];

  // 軌道管理
  addTrack: (name: string, defaultStyle?: Partial<SubtitleSegment['style']>) => void;
  deleteTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<SubtitleTrack>) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  selectTrack: (trackId: string | null) => void;
  
  // 字幕片段管理 (支援指定軌道)
  addSegment: (segment: Omit<SubtitleSegment, 'id'>, trackId?: string) => void;
  updateSegment: (id: string, updates: Partial<SubtitleSegment>) => void;
  deleteSegment: (id: string) => void;
  selectSegment: (id: string | null) => void;
  moveSegmentToTrack: (fromTrackId: string, toTrackId: string, segmentId: string) => void;
  splitSegment: (id: string, splitTime?: number) => void; // 切割字幕
  
  // 樣式模板管理
  saveStyleTemplate: (name: string, style: SubtitleSegment['style'], isDefault?: boolean) => void;
  applyStyleTemplate: (templateId: string, segmentId?: string, applyToAll?: boolean) => void;
  deleteStyleTemplate: (templateId: string) => void;
  updateStyleTemplate: (templateId: string, updates: Partial<StyleTemplate>) => void;
  getDefaultTemplate: () => StyleTemplate | null;
  setDefaultTemplate: (templateId: string) => void;

  // 固定字幕管理
  addPinnedSubtitle: (position: 'top' | 'bottom') => void;
  updatePinnedSubtitle: (id: string, updates: Partial<PinnedSubtitle>) => void;
  deletePinnedSubtitle: (id: string) => void;
  togglePinnedSubtitle: (id: string, enabled: boolean) => void;
  
  // 匯入 SRT (可指定軌道)
  importFromSrt: (srtContent: string, targetTrackId?: string) => void;
  
  // 匯出 SRT (可匯出單一軌道或全部)
  exportToSrt: (trackId?: string) => string;
  
  // 清空所有字幕
  clearAll: () => void;
  
  // 向後相容性方法 (getter)
  get segments(): SubtitleSegment[];
  getActiveTrack: () => SubtitleTrack | null;
  getAllSegments: () => SubtitleSegment[];
  
  // 批量載入專案字幕 (用於從 localStorage 載入)
  loadProjectSegments: (segments: SubtitleSegment[]) => void;

  // 批量載入固定字幕 (用於從 localStorage 載入)
  loadPinnedSubtitles: (pinnedSubtitles: PinnedSubtitle[]) => void;
}

// 簡單的 ID 生成器
const generateId = () => Math.random().toString(36).substr(2, 9);

// 解析 SRT 時間格式
const parseSrtTime = (timeStr: string): number => {
  const [time, ms] = timeStr.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000;
};

// 格式化時間為 SRT 格式
const formatSrtTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

// 預設樣式常數
const DEFAULT_STYLE: SubtitleSegment['style'] = {
  fontSize: 32,
  fontFamily: 'Noto Sans SC',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#FFFFFF',
  opacity: 1,
  backgroundColor: 'transparent',
  position: 'bottom',
  enableShadow: true,
  shadowColor: '#000000',
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  shadowBlur: 8,
  enableStroke: true,
  strokeColor: '#000000',
  strokeWidth: 2,
  positionX: 50,
  positionY: 90,
  maxWidth: 80,
  scale: 1.0,
};

export const useSubtitleStore = create<SubtitleStore>((set, get) => ({
  // 多軌道狀態初始化
  tracks: [],
  selectedTrackId: null,
  selectedSegmentId: null,

  // 固定字幕初始化
  pinnedSubtitles: [
    {
      id: 'pinned-top',
      text: '影片標題',
      position: 'top',
      enabled: true, // 預設開啟
      style: {
        fontSize: 28,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#FFFFFF',
        opacity: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
        enableStroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        positionY: 10, // 頂部 10%
      },
    },
    {
      id: 'pinned-bottom',
      text: '@your_watermark',
      position: 'bottom',
      enabled: true, // 預設開啟
      style: {
        fontSize: 24,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#FFFFFF',
        opacity: 0.6, // 浮水印半透明
        backgroundColor: 'transparent',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
        enableStroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        positionY: 95, // 底部 95%
      },
    },
  ],

  // 樣式模板初始化 - 包含預設模板
  styleTemplates: [
    {
      id: 'default',
      name: '預設樣式',
      style: DEFAULT_STYLE,
      isDefault: true,
      createdAt: Date.now(),
    },
    {
      id: 'netflix',
      name: 'Netflix 風格',
      style: {
        fontSize: 32,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#FFFFFF',
        opacity: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        position: 'bottom',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
        enableStroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
      },
      isDefault: false,
      createdAt: Date.now(),
    },
    {
      id: 'youtube',
      name: 'YouTube 風格',
      style: {
        fontSize: 32,
        fontFamily: 'Roboto',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#FFFFFF',
        opacity: 1,
        backgroundColor: 'rgba(8,8,8,0.75)',
        position: 'bottom',
        enableShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 0,
        enableStroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
      },
      isDefault: false,
      createdAt: Date.now(),
    },
    {
      id: 'bold-stroke',
      name: '粗體描邊',
      style: {
        fontSize: 36,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#FFFFFF',
        opacity: 1,
        backgroundColor: 'transparent',
        position: 'bottom',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        shadowBlur: 6,
        enableStroke: true,
        strokeColor: '#000000',
        strokeWidth: 4,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
      },
      isDefault: false,
      createdAt: Date.now(),
    },
    {
      id: 'elegant-serif',
      name: '優雅襯線',
      style: {
        fontSize: 34,
        fontFamily: 'Noto Serif SC',
        fontWeight: 'normal',
        fontStyle: 'italic',
        textDecoration: 'none',
        color: '#F5F5DC',
        opacity: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        position: 'bottom',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 5,
        enableStroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
      },
      isDefault: false,
      createdAt: Date.now(),
    },
    {
      id: 'neon-glow',
      name: '霓虹發光',
      style: {
        fontSize: 38,
        fontFamily: 'Orbitron',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#00FFFF',
        opacity: 1,
        backgroundColor: 'transparent',
        position: 'bottom',
        enableShadow: true,
        shadowColor: '#00FFFF',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowBlur: 20,
        enableStroke: true,
        strokeColor: '#00FFFF',
        strokeWidth: 2,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
      },
      isDefault: false,
      createdAt: Date.now(),
    },
    {
      id: 'comic-style',
      name: '漫畫風格',
      style: {
        fontSize: 40,
        fontFamily: 'Bangers',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#FFFF00',
        opacity: 1,
        backgroundColor: 'transparent',
        position: 'bottom',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        shadowBlur: 0,
        enableStroke: true,
        strokeColor: '#000000',
        strokeWidth: 5,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
      },
      isDefault: false,
      createdAt: Date.now(),
    },
  ],

  // 軌道管理方法
  addTrack: (name, defaultStyle) => {
    const newTrack: SubtitleTrack = {
      id: generateId(),
      name,
      segments: [],
      muted: false,
      visible: true,
      locked: false,
      color: '#5DBAA0', // OpenCut 預設綠色
      height: 60, // 預設軌道高度
      defaultStyle,
    };
    
    set((state) => ({
      tracks: [...state.tracks, newTrack],
      // 如果是第一個軌道,自動選中
      selectedTrackId: state.tracks.length === 0 ? newTrack.id : state.selectedTrackId,
    }));
  },

  deleteTrack: (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter(t => t.id !== trackId),
      selectedTrackId: state.selectedTrackId === trackId ?
        (state.tracks.length > 1 ? state.tracks[0].id : null) :
        state.selectedTrackId,
      selectedSegmentId: null, // 清空選中的字幕
    }));
  },

  updateTrack: (trackId, updates) => {
    set((state) => ({
      tracks: state.tracks.map(t =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    }));
  },

  reorderTracks: (fromIndex, toIndex) => {
    set((state) => {
      const newTracks = [...state.tracks];
      const [removed] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, removed);
      return { tracks: newTracks };
    });
  },

  selectTrack: (trackId) => {
    set({ selectedTrackId: trackId });
  },

  // 字幕片段管理 (支援多軌道)
  addSegment: (segment, trackId) => {
    const state = get();
    
    // 決定目標軌道
    let targetTrackId = trackId || state.selectedTrackId || state.tracks[0]?.id;
    
    // 如果沒有軌道,自動創建第一個
    if (!targetTrackId) {
      const newTrack: SubtitleTrack = {
        id: generateId(),
        name: '字幕軌道 1',
        segments: [],
        muted: false,
        visible: true,
        locked: false,
        color: '#5DBAA0',
        height: 60,
      };
      set({ tracks: [newTrack], selectedTrackId: newTrack.id });
      targetTrackId = newTrack.id;
    }
    
    // 獲取軌道的預設樣式
    const track = state.tracks.find(t => t.id === targetTrackId);
    const defaultStyle = track?.defaultStyle || {};
    
    const newSegment: SubtitleSegment = {
      ...segment,
      id: generateId(),
      style: {
        ...DEFAULT_STYLE, // 基礎預設樣式
        ...defaultStyle, // 應用軌道預設樣式
        ...segment.style, // 應用傳入的樣式
      },
    };
    
    set((state) => ({
      tracks: state.tracks.map(t =>
        t.id === targetTrackId
          ? { ...t, segments: [...t.segments, newSegment].sort((a, b) => a.startTime - b.startTime) }
          : t
      ),
    }));
  },

  updateSegment: (id, updates) => {
    set((state) => ({
      tracks: state.tracks.map(track => ({
        ...track,
        segments: track.segments.map(seg =>
          seg.id === id ? { ...seg, ...updates } : seg
        ),
      })),
    }));
  },

  deleteSegment: (id) => {
    set((state) => ({
      tracks: state.tracks.map(track => ({
        ...track,
        segments: track.segments.filter(seg => seg.id !== id),
      })),
      selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
    }));
  },

  selectSegment: (id) => {
    set({ selectedSegmentId: id });
  },

  moveSegmentToTrack: (fromTrackId, toTrackId, segmentId) => {
    set((state) => {
      const fromTrack = state.tracks.find(t => t.id === fromTrackId);
      const segment = fromTrack?.segments.find(s => s.id === segmentId);

      if (!segment) return state;

      return {
        tracks: state.tracks.map(track => {
          if (track.id === fromTrackId) {
            return { ...track, segments: track.segments.filter(s => s.id !== segmentId) };
          } else if (track.id === toTrackId) {
            return { ...track, segments: [...track.segments, segment].sort((a, b) => a.startTime - b.startTime) };
          }
          return track;
        }),
      };
    });
  },

  // 切割字幕
  splitSegment: (id, splitTime) => {
    set((state) => {
      const track = state.tracks.find(t => t.segments.some(s => s.id === id));
      if (!track) return state;

      const segment = track.segments.find(s => s.id === id);
      if (!segment) return state;

      // 如果提供了切割時間點，按時間切割
      if (splitTime !== undefined) {
        // 確保切割點在字幕時間範圍內
        if (splitTime <= segment.startTime || splitTime >= segment.endTime) {
          return state;
        }

        // 計算切割比例
        const totalDuration = segment.endTime - segment.startTime;
        const firstDuration = splitTime - segment.startTime;
        const ratio = firstDuration / totalDuration;

        // 按比例分割文字
        const textLength = segment.text.length;
        const splitIndex = Math.round(textLength * ratio);

        const firstText = segment.text.substring(0, splitIndex).trim();
        const secondText = segment.text.substring(splitIndex).trim();

        // 翻译文本也要分割
        const firstTranslatedText = segment.translatedText
          ? segment.translatedText.substring(0, Math.round(segment.translatedText.length * ratio)).trim()
          : '';
        const secondTranslatedText = segment.translatedText
          ? segment.translatedText.substring(Math.round(segment.translatedText.length * ratio)).trim()
          : '';

        // 创建两个新字幕
        const firstSegment: SubtitleSegment = {
          ...segment,
          id: generateId(),
          endTime: splitTime,
          text: firstText,
          translatedText: firstTranslatedText || firstText,
        };

        const secondSegment: SubtitleSegment = {
          ...segment,
          id: generateId(),
          startTime: splitTime,
          text: secondText,
          translatedText: secondTranslatedText || secondText,
        };

        // 替换原字幕
        return {
          tracks: state.tracks.map(t =>
            t.id === track.id
              ? {
                  ...t,
                  segments: t.segments
                    .filter(s => s.id !== id)
                    .concat([firstSegment, secondSegment])
                    .sort((a, b) => a.startTime - b.startTime),
                }
              : t
          ),
          selectedSegmentId: firstSegment.id,
        };
      }
      // 否则按标点符号自动分句
      else {
        // 優先分割翻譯文字，如果沒有才分割原文
        const textToSplit = segment.translatedText || segment.text;
        const isTranslated = !!segment.translatedText;

        console.log('🔪 開始自動分句');
        console.log('📝 要分割的文字:', textToSplit);
        console.log('🌐 是否為翻譯:', isTranslated ? '是（中文）' : '否（原文）');

        const text = textToSplit;

        // 步驟1: 按所有標點符號分割，保留標點
        const parts: string[] = [];
        let currentPart = '';

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          currentPart += char;

          // 遇到標點符號就切分
          if (/[，,。！？.!?；;]/.test(char)) {
            parts.push(currentPart);
            currentPart = '';
          }
        }

        // 添加剩餘部分
        if (currentPart.trim()) {
          parts.push(currentPart);
        }

        console.log('📝 切分後的部分:', parts);

        // 如果沒有標點，智能分割（按長度或空格）
        if (parts.length <= 1) {
          console.log('⚠️ 沒有標點符號，改用智能分割');

          const MIN_WORDS = 5; // 最少單詞數（英文）或字數（中文）
          const isEnglish = /^[a-zA-Z\s']+/.test(text);

          if (isEnglish) {
            // 英文：按空格分詞
            const words = text.split(/\s+/);
            console.log(`📝 英文句子，共 ${words.length} 個單詞`);

            if (words.length <= MIN_WORDS * 2) {
              console.log('⚠️ 單詞太少，不切割');
              return state;
            }

            // 每 MIN_WORDS 個詞為一組
            const midPoint = Math.floor(words.length / 2);
            const firstHalf = words.slice(0, midPoint).join(' ');
            const secondHalf = words.slice(midPoint).join(' ');

            parts.length = 0;
            parts.push(firstHalf, secondHalf);
            console.log('✂️ 英文分割結果:', parts);
          } else {
            // 中文：按長度平分
            const midPoint = Math.floor(text.length / 2);

            if (text.length <= MIN_WORDS * 2) {
              console.log('⚠️ 字數太少，不切割');
              return state;
            }

            const firstHalf = text.substring(0, midPoint);
            const secondHalf = text.substring(midPoint);

            parts.length = 0;
            parts.push(firstHalf, secondHalf);
            console.log('✂️ 中文分割結果:', parts);
          }
        }

        // 步驟2: 智能分組
        const sentences: string[] = [];
        let currentSentence = '';
        const MAX_LENGTH = 25; // 每句最大字數

        for (const part of parts) {
          const trimmedPart = part.trim();
          if (!trimmedPart) continue;

          // 檢查是否是強結束符（句號、問號、感嘆號）
          const hasStrongEnder = /[。！？.!?]$/.test(trimmedPart);
          const combinedLength = currentSentence.length + trimmedPart.length;

          if (currentSentence === '') {
            // 第一句，直接添加
            currentSentence = trimmedPart;
          } else if (hasStrongEnder || combinedLength > MAX_LENGTH) {
            // 遇到強標點或超過長度限制，分句
            if (!hasStrongEnder && combinedLength <= MAX_LENGTH) {
              // 雖然超過長度但可以合併
              currentSentence += trimmedPart;
            } else {
              // 保存當前句子
              sentences.push(currentSentence);
              currentSentence = trimmedPart;
            }
          } else {
            // 繼續累積（逗號等弱標點）
            currentSentence += trimmedPart;
          }

          // 如果遇到強標點，立即結束這句
          if (hasStrongEnder && currentSentence === trimmedPart) {
            sentences.push(currentSentence);
            currentSentence = '';
          }
        }

        // 添加最後一句
        if (currentSentence.trim()) {
          sentences.push(currentSentence.trim());
        }

        console.log('✂️ 分句結果:', sentences);

        // 如果只有一句，不切割
        if (sentences.length <= 1) {
          console.log('⚠️ 只有一句，不切割');
          return state;
        }

        // 步驟3: 計算每句的時間（根據字數加權分配）
        const totalDuration = segment.endTime - segment.startTime;
        const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);

        // 步驟4: 創建新字幕
        let currentStartTime = segment.startTime;
        const newSegments: SubtitleSegment[] = sentences.map((sentenceText, index) => {
          const charRatio = sentenceText.length / totalChars;
          const segDuration = totalDuration * charRatio;
          const startTime = currentStartTime;
          const endTime = currentStartTime + segDuration;
          currentStartTime = endTime;

          // 根據是否為翻譯文本，決定如何填充
          let newText: string;
          let newTranslatedText: string;

          if (isTranslated) {
            // 分割的是翻譯文本，保留原文不動
            newText = segment.text; // 原文保持不變
            newTranslatedText = sentenceText; // 分割後的翻譯文本
          } else {
            // 分割的是原文
            newText = sentenceText;
            newTranslatedText = sentenceText;
          }

          return {
            ...segment,
            id: generateId(),
            startTime,
            endTime,
            text: newText,
            translatedText: newTranslatedText,
          };
        });

        console.log(`✅ 成功分割成 ${newSegments.length} 句`);

        // 替換原字幕
        return {
          tracks: state.tracks.map(t =>
            t.id === track.id
              ? {
                  ...t,
                  segments: t.segments
                    .filter(s => s.id !== id)
                    .concat(newSegments)
                    .sort((a, b) => a.startTime - b.startTime),
                }
              : t
          ),
          selectedSegmentId: newSegments[0].id,
        };
      }
    });
  },

  // 匯入 SRT (支援指定軌道)
  importFromSrt: (srtContent, targetTrackId) => {
    const lines = srtContent.trim().split('\n');
    const segments: SubtitleSegment[] = [];
    
    let i = 0;
    while (i < lines.length) {
      // 跳過序號行
      if (lines[i].trim().match(/^\d+$/)) {
        i++;
      }
      
      // 解析時間行
      const timeLine = lines[i]?.trim();
      if (timeLine && timeLine.includes('-->')) {
        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
        const startTime = parseSrtTime(startStr);
        const endTime = parseSrtTime(endStr);
        
        i++;
        
        // 收集文字行
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        
        if (textLines.length > 0) {
          segments.push({
            id: generateId(),
            startTime,
            endTime,
            text: textLines.join('\n'),
            style: {
              fontSize: 32,
              fontFamily: 'Arial',
              fontWeight: 'normal',
              fontStyle: 'normal',
              textDecoration: 'none',
              color: '#FFFFFF',
              opacity: 1,
              backgroundColor: 'transparent',
              position: 'bottom',
              enableShadow: true,
              shadowColor: '#000000',
              shadowOffsetX: 4,
              shadowOffsetY: 4,
              shadowBlur: 8,
              enableStroke: false,
              strokeColor: '#000000',
              strokeWidth: 2,
              positionX: 50,
              positionY: 90,
              maxWidth: 80,
              scale: 1.0,
            },
          });
        }
      }
      
      i++;
    }
    
    // 決定匯入到哪個軌道
    const state = get();
    let trackId = targetTrackId || state.selectedTrackId || state.tracks[0]?.id;
    
    // 如果沒有軌道,自動創建第一個
    if (!trackId) {
      const newTrack: SubtitleTrack = {
        id: generateId(),
        name: '字幕軌道 1',
        segments: [],
        muted: false,
        visible: true,
        locked: false,
        color: '#5DBAA0',
        height: 60,
      };
      set({ tracks: [newTrack], selectedTrackId: newTrack.id });
      trackId = newTrack.id;
    }
    
    // 匯入字幕到指定軌道,並確保該軌道被選中
    set((state) => ({
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? { ...t, segments: segments.sort((a, b) => a.startTime - b.startTime) }
          : t
      ),
      selectedTrackId: trackId, // 確保選中該軌道
    }));
  },

  // 匯出 SRT (支援單一軌道或全部)
  exportToSrt: (trackId) => {
    const state = get();
    
    if (trackId) {
      // 匯出單一軌道
      const track = state.tracks.find(t => t.id === trackId);
      if (!track) return '';
      
      return track.segments
        .map((seg, index) => {
          return `${index + 1}\n${formatSrtTime(seg.startTime)} --> ${formatSrtTime(seg.endTime)}\n${seg.translatedText || seg.text}\n`;
        })
        .join('\n');
    } else {
      // 匯出全部可見軌道 (合併所有字幕並排序)
      const allSegments = state.tracks
        .filter(t => t.visible)
        .flatMap(t => t.segments)
        .sort((a, b) => a.startTime - b.startTime);
      
      return allSegments
        .map((seg, index) => {
          return `${index + 1}\n${formatSrtTime(seg.startTime)} --> ${formatSrtTime(seg.endTime)}\n${seg.translatedText || seg.text}\n`;
        })
        .join('\n');
    }
  },

  clearAll: () => {
    set({ tracks: [], selectedTrackId: null, selectedSegmentId: null });
  },

  // 向後相容性 getter
  get segments(): SubtitleSegment[] {
    const state = get();
    
    // 如果只有一個軌道,返回該軌道的字幕 (向後相容)
    if (state.tracks.length === 1) {
      return state.tracks[0].segments;
    }
    
    // 多軌道時返回當前選中軌道的字幕
    const activeTrack = state.tracks.find(t => t.id === state.selectedTrackId);
    return activeTrack?.segments || [];
  },

  getActiveTrack: () => {
    const state = get();
    return state.tracks.find(t => t.id === state.selectedTrackId) || state.tracks[0] || null;
  },

  getAllSegments: () => {
    const state = get();
    // 返回所有可見軌道的字幕
    return state.tracks
      .filter(t => t.visible && !t.muted)
      .flatMap(t => t.segments)
      .sort((a, b) => a.startTime - b.startTime);
  },
  
  // 樣式模板管理方法
  saveStyleTemplate: (name, style, isDefault = false) => {
    set((state) => {
      // 只保存样式属性，排除大小和位置
      const styleWithoutSizeAndPosition = {
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textDecoration: style.textDecoration,
        color: style.color,
        opacity: style.opacity,
        backgroundColor: style.backgroundColor,
        position: style.position,
        enableShadow: style.enableShadow,
        shadowColor: style.shadowColor,
        shadowOffsetX: style.shadowOffsetX,
        shadowOffsetY: style.shadowOffsetY,
        shadowBlur: style.shadowBlur,
        enableStroke: style.enableStroke,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        // 使用默认值填充必需的属性（不会被应用）
        fontSize: 32,
        scale: 1,
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
      };

      const newTemplate: StyleTemplate = {
        id: generateId(),
        name,
        style: styleWithoutSizeAndPosition as SubtitleSegment['style'],
        isDefault,
        createdAt: Date.now(),
      };
      
      // 如果設定為預設，取消其他模板的預設狀態
      const updatedTemplates = isDefault
        ? state.styleTemplates.map(t => ({ ...t, isDefault: false }))
        : state.styleTemplates;
      
      const newTemplates = [...updatedTemplates, newTemplate];
      
      // 持久化到 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('subtitle-style-templates', JSON.stringify(newTemplates));
      }
      
      return {
        styleTemplates: newTemplates,
      };
    });
  },

  applyStyleTemplate: (templateId, segmentId, applyToAll = false) => {
    const state = get();
    const template = state.styleTemplates.find(t => t.id === templateId);
    if (!template) return;

    const segments = state.tracks.length > 0 ? state.tracks[0].segments : [];

    // 只应用样式属性，排除大小和位置相关属性
    const getStyleWithoutSizeAndPosition = (currentStyle: SubtitleSegment['style']) => ({
      ...currentStyle,
      // 只覆盖样式属性，保留原有的大小和位置
      fontFamily: template.style.fontFamily,
      fontWeight: template.style.fontWeight,
      fontStyle: template.style.fontStyle,
      textDecoration: template.style.textDecoration,
      color: template.style.color,
      opacity: template.style.opacity,
      backgroundColor: template.style.backgroundColor,
      position: template.style.position,
      enableShadow: template.style.enableShadow,
      shadowColor: template.style.shadowColor,
      shadowOffsetX: template.style.shadowOffsetX,
      shadowOffsetY: template.style.shadowOffsetY,
      shadowBlur: template.style.shadowBlur,
      enableStroke: template.style.enableStroke,
      strokeColor: template.style.strokeColor,
      strokeWidth: template.style.strokeWidth,
      // 保留原有的大小和位置属性
      // fontSize, scale, positionX, positionY, maxWidth 不变
    });

    if (applyToAll) {
      // 套用到所有字幕
      segments.forEach(seg => {
        state.updateSegment(seg.id, {
          style: getStyleWithoutSizeAndPosition(seg.style),
        });
      });
    } else if (segmentId) {
      // 套用到指定字幕
      const seg = segments.find(s => s.id === segmentId);
      if (seg) {
        state.updateSegment(segmentId, {
          style: getStyleWithoutSizeAndPosition(seg.style),
        });
      }
    } else if (state.selectedSegmentId) {
      // 套用到當前選中的字幕
      const seg = segments.find(s => s.id === state.selectedSegmentId);
      if (seg) {
        state.updateSegment(state.selectedSegmentId, {
          style: getStyleWithoutSizeAndPosition(seg.style),
        });
      }
    }
  },

  deleteStyleTemplate: (templateId) => {
    set((state) => ({
      styleTemplates: state.styleTemplates.filter(t => t.id !== templateId),
    }));
  },

  updateStyleTemplate: (templateId, updates) => {
    set((state) => ({
      styleTemplates: state.styleTemplates.map(t =>
        t.id === templateId ? { ...t, ...updates } : t
      ),
    }));
  },

  getDefaultTemplate: () => {
    const state = get();
    return state.styleTemplates.find(t => t.isDefault) || null;
  },

  setDefaultTemplate: (templateId) => {
    set((state) => ({
      styleTemplates: state.styleTemplates.map(t => ({
        ...t,
        isDefault: t.id === templateId,
      })),
    }));
  },
  
  // 批量載入專案字幕
  loadProjectSegments: (segments) => {
    console.log('🔍 loadProjectSegments 被調用，傳入的 segments:', segments.slice(0, 2));
    
    const state = get();
    
    // 決定目標軌道 (優先使用第一個軌道)
    let targetTrackId = state.tracks[0]?.id;
    
    // 如果沒有軌道,自動創建第一個
    if (!targetTrackId) {
      const newTrack: SubtitleTrack = {
        id: generateId(),
        name: '字幕軌道 1',
        segments: [],
        muted: false,
        visible: true,
        locked: false,
        color: '#5DBAA0',
        height: 60,
      };
      set({ tracks: [newTrack], selectedTrackId: newTrack.id });
      targetTrackId = newTrack.id;
    }
    
    // 確保每個 segment 都有完整的 style 屬性和正確的 id 格式
    const normalizedSegments = segments.map((seg: any, index: number) => {
      
      return {
        ...seg,
        id: String(seg.id || index + 1), // 確保 id 是字符串格式
        style: { ...DEFAULT_STYLE, ...(seg.style || {}) }, // 合併樣式
      };
    });
    
    console.log('🔍 標準化後的 segments:', normalizedSegments.slice(0, 2));
    
    // 清空現有字幕並載入新字幕到第一個軌道
    set((state) => ({
      tracks: state.tracks.map(t =>
        t.id === targetTrackId
          ? { ...t, segments: normalizedSegments.sort((a, b) => a.startTime - b.startTime) }
          : t
      ),
      selectedTrackId: targetTrackId, // 確保選中該軌道
    }));
    
    console.log('✅ 字幕載入完成');
  },

  // 固定字幕管理方法
  addPinnedSubtitle: (position) => {
    const newPinned: PinnedSubtitle = {
      id: `pinned-${position}-${Date.now()}`,
      text: position === 'top' ? '新標題' : '新浮水印',
      position,
      enabled: true,
      style: {
        fontSize: position === 'top' ? 28 : 24,
        fontFamily: 'Noto Sans SC',
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#FFFFFF',
        opacity: position === 'top' ? 1 : 0.6,
        backgroundColor: position === 'top' ? 'rgba(0,0,0,0.8)' : 'transparent',
        enableShadow: true,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
        enableStroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        positionY: position === 'top' ? 10 : 95,
      },
    };
    set((state) => ({
      pinnedSubtitles: [...state.pinnedSubtitles, newPinned],
    }));
  },

  updatePinnedSubtitle: (id, updates) => {
    set((state) => ({
      pinnedSubtitles: state.pinnedSubtitles.map((pinned) =>
        pinned.id === id ? { ...pinned, ...updates } : pinned
      ),
    }));
  },

  togglePinnedSubtitle: (id, enabled) => {
    get().updatePinnedSubtitle(id, { enabled });
  },

  deletePinnedSubtitle: (id) => {
    set((state) => ({
      pinnedSubtitles: state.pinnedSubtitles.filter((p) => p.id !== id),
    }));
  },

  // 批量載入固定字幕
  loadPinnedSubtitles: (loadedPinnedSubtitles) => {
    console.log('🔍 載入固定字幕:', loadedPinnedSubtitles);

    if (!loadedPinnedSubtitles || loadedPinnedSubtitles.length === 0) {
      console.log('⚠️ 沒有固定字幕資料，保持預設值');
      return;
    }

    set({ pinnedSubtitles: loadedPinnedSubtitles });
    console.log('✅ 固定字幕載入完成');
  },
}));