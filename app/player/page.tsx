"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  position?: { x: number; y: number };
  enableStroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  enableShadow?: boolean;
  shadowColor?: string;
  shadowOffset?: { x: number; y: number };
}

export default function PlayerPage() {
  const searchParams = useSearchParams();
  const videoUrl = searchParams.get('video');
  const subtitlesParam = searchParams.get('subtitles');
  
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (subtitlesParam) {
      try {
        const parsedSubtitles = JSON.parse(decodeURIComponent(subtitlesParam));
        setSubtitles(parsedSubtitles);
      } catch (error) {
        console.error('Failed to parse subtitles:', error);
      }
    }
  }, [subtitlesParam]);

  // 自動播放
  useEffect(() => {
    const timer = setTimeout(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) {
        video.muted = true;
        video.play().then(() => {
          setIsPlaying(true);
          console.log('Video started playing automatically');
        }).catch(console.error);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // 獲取當前應該顯示的字幕
  const currentSubtitle = subtitles.find(
    sub => currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  if (!videoUrl) {
    return <div>No video specified</div>;
  }

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: 'black',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 影片 */}
      <video
        src={videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted
        autoPlay
      />

      {/* 字幕疊加 */}
      {currentSubtitle && (
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `${currentSubtitle.fontSize || 24}px`,
            fontFamily: currentSubtitle.fontFamily || 'Arial, sans-serif',
            color: currentSubtitle.color || 'white',
            backgroundColor: currentSubtitle.backgroundColor || 'rgba(0,0,0,0.8)',
            padding: '8px 16px',
            borderRadius: '4px',
            textAlign: 'center',
            maxWidth: '80%',
            zIndex: 10,
            textShadow: (() => {
              const shadows: string[] = [];

              // Add stroke effect using multiple shadows
              if (currentSubtitle.enableStroke) {
                const strokeWidth = currentSubtitle.strokeWidth || 2;
                const steps = 16;

                for (let i = 0; i < steps; i++) {
                  const angle = (i * 2 * Math.PI) / steps;
                  const x = Math.cos(angle) * strokeWidth;
                  const y = Math.sin(angle) * strokeWidth;
                  shadows.push(`${x}px ${y}px 0 ${currentSubtitle.strokeColor || 'black'}`);
                }
              }

              // Add drop shadow
              if (currentSubtitle.enableShadow) {
                const shadowX = currentSubtitle.shadowOffset?.x || 2;
                const shadowY = currentSubtitle.shadowOffset?.y || 2;
                const shadowBlur = 4;
                shadows.push(`${shadowX}px ${shadowY}px ${shadowBlur}px ${currentSubtitle.shadowColor || 'rgba(0,0,0,0.8)'}`);
              }

              return shadows.length > 0 ? shadows.join(', ') : 'none';
            })(),
          }}
        >
          {currentSubtitle.text}
        </div>
      )}

      {/* 狀態指示器 */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        color: 'white',
        fontSize: '12px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '4px 8px',
        borderRadius: '4px'
      }}>
        {isPlaying ? '▶️ Playing' : '⏸️ Paused'} | Time: {currentTime.toFixed(1)}s
      </div>
    </div>
  );
}