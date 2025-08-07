declare module '@/lib/types' {
  export interface Subtitle {
    id: number;
    startTime: number; // in milliseconds
    endTime: number;   // in milliseconds
    text: string;
  }

  export interface ProcessedVideo {
    videoUrl: string;
    subtitles: Subtitle[];
    status: 'processing' | 'completed' | 'error';
    error?: string;
  }
}
