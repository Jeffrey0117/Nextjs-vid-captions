export interface SubtitleStyle {
  fontSize: number;        // 字體大小 (px), 預設 24
  color: string;           // 文字顏色 (hex), 預設 #FFFFFF
  position: {              // 位置 (百分比)
    x: number;             // 0-100, 預設 50 (水平置中)
    y: number;             // 0-100, 預設 85 (底部)
  };
}

export interface Subtitle {
  id: number;
  startTime: number | string; // Can be milliseconds or SRT time format
  endTime: number | string; // Can be milliseconds or SRT time format
  text: string;
  style?: SubtitleStyle;   // 新增: 樣式設定 (選填)
}

export interface ProcessedVideo {
  videoUrl: string;
  subtitles: Subtitle[];
  status: "processing" | "completed" | "error";
  error?: string;
}

// 預設樣式
export const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 24,
  color: '#FFFFFF',
  position: { x: 50, y: 85 }
};
