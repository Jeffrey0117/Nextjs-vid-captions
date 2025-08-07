export interface Subtitle {
  id: number;
  startTime: number | string; // Can be milliseconds or SRT time format
  endTime: number | string; // Can be milliseconds or SRT time format
  text: string;
}

export interface ProcessedVideo {
  videoUrl: string;
  subtitles: Subtitle[];
  status: "processing" | "completed" | "error";
  error?: string;
}
