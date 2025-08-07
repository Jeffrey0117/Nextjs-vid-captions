"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Subtitle } from "@/lib/types";

// Import the shared SubtitleBoxProps type
import { SubtitleBoxProps } from "./types";

// Dynamically import SubtitleBox with no SSR
const SubtitleBox = dynamic<SubtitleBoxProps>(() => import("./SubtitleBox"), {
  ssr: false,
  loading: () => null,
});

interface VideoPlayerProps {
  videoUrl: string;
  subtitles: Subtitle[];
  currentSubtitle: Subtitle | null;
  onTimeUpdate: (currentTime: number) => void;
  onVideoEnd: () => void;
}

export default function VideoPlayer({
  videoUrl,
  subtitles,
  currentSubtitle,
  onTimeUpdate,
  onVideoEnd,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to true after component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime * 1000); // Convert to milliseconds
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", onVideoEnd);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", onVideoEnd);
    };
  }, [onTimeUpdate, onVideoEnd, isMounted]);

  const togglePlay = () => {
    if (!isMounted) return;

    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          console.error("Error playing video:", error);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Only render video element on client side
  if (!isMounted) {
    return (
      <div className="relative w-full max-w-4xl mx-auto aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p>Loading video player...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onClick={togglePlay}
          controls
        />
        <SubtitleBox subtitle={currentSubtitle} />
      </div>
      <div className="mt-4 flex justify-center">
        <button
          onClick={togglePlay}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}
