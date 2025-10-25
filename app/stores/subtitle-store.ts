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
    positionY: number; // 垂直位置百分比 (0-100)
    scale: number; // 縮放比例 (0.5-3.0)
  };
}

interface SubtitleStore {
  // 字幕片段列表
  segments: SubtitleSegment[];
  
  // 選中的字幕片段
  selectedSegmentId: string | null;
  
  // 動作
  addSegment: (segment: Omit<SubtitleSegment, 'id'>) => void;
  updateSegment: (id: string, updates: Partial<SubtitleSegment>) => void;
  deleteSegment: (id: string) => void;
  selectSegment: (id: string | null) => void;
  
  // 匯入 SRT
  importFromSrt: (srtContent: string) => void;
  
  // 匯出 SRT
  exportToSrt: () => string;
  
  // 清空所有字幕
  clearAll: () => void;
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
  segments: [],
  selectedSegmentId: null,

  addSegment: (segment) => {
    const newSegment: SubtitleSegment = {
      ...segment,
      id: generateId(),
      style: segment.style || {
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
        positionY: 90,
        scale: 1.0,
      },
    };
    set((state) => ({
      segments: [...state.segments, newSegment].sort((a, b) => a.startTime - b.startTime),
    }));
  },

  updateSegment: (id, updates) => {
    set((state) => ({
      segments: state.segments.map((seg) =>
        seg.id === id ? { ...seg, ...updates } : seg
      ),
    }));
  },

  deleteSegment: (id) => {
    set((state) => ({
      segments: state.segments.filter((seg) => seg.id !== id),
      selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
    }));
  },

  selectSegment: (id) => {
    set({ selectedSegmentId: id });
  },

  importFromSrt: (srtContent) => {
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
              positionY: 90,
              scale: 1.0,
            },
          });
        }
      }
      
      i++;
    }
    
    set({ segments: segments.sort((a, b) => a.startTime - b.startTime) });
  },

  exportToSrt: () => {
    const { segments } = get();
    return segments
      .map((seg, index) => {
        return `${index + 1}\n${formatSrtTime(seg.startTime)} --> ${formatSrtTime(seg.endTime)}\n${seg.translatedText || seg.text}\n`;
      })
      .join('\n');
  },

  clearAll: () => {
    set({ segments: [], selectedSegmentId: null });
  },
}));