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
    positionX: number; // 水平位置百分比 (0-100, 50=中間)
    positionY: number; // 垂直位置百分比 (0-100)
    maxWidth: number; // 最大寬度 vw 單位 (10-100)
    scale: number; // 縮放比例 (0.5-3.0)
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

export const useSubtitleStore = create<SubtitleStore>((set, get) => ({
  // 多軌道狀態初始化
  tracks: [],
  selectedTrackId: null,
  selectedSegmentId: null,

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
        positionX: 50,
        positionY: 90,
        maxWidth: 80,
        scale: 1.0,
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
    
    // 匯入字幕到指定軌道
    set((state) => ({
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? { ...t, segments: segments.sort((a, b) => a.startTime - b.startTime) }
          : t
      ),
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
}));