import { Subtitle } from '@/lib/types';

export interface SubtitleBoxProps {
  subtitle: Subtitle | null;
}

export interface VideoPlayerProps {
  videoUrl: string;
  subtitles: Subtitle[];
  currentSubtitle: Subtitle | null;
  onTimeUpdate: (currentTime: number) => void;
  onVideoEnd: () => void;
}
