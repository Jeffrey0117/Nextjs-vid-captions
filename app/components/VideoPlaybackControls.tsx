"use client";

import { Play, Pause, SkipBack, ZoomIn, ZoomOut } from "lucide-react";
import { formatTimeCode } from "@/lib/time";

interface VideoPlaybackControlsProps {
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Playback controls
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipToStart: () => void;
  
  // Zoom controls
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  
  // Display settings
  fps?: number;
  className?: string;
}

export default function VideoPlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onSkipToStart,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  fps = 30,
  className = "",
}: VideoPlaybackControlsProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 border-t bg-zinc-900 ${className}`}>
      {/* Left: Playback Controls */}
      <div className="flex items-center gap-1">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
          title={isPlaying ? "暫停 (Space)" : "播放 (Space)"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white" />
          )}
        </button>
        
        {/* Skip to Start */}
        <button
          onClick={onSkipToStart}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
          title="跳到起點 (Home)"
        >
          <SkipBack className="w-4 h-4 text-white" />
        </button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Time Display */}
        <div className="flex items-center gap-2 px-2 font-mono text-sm">
          <span className="text-white">
            {formatTimeCode(currentTime, "HH:MM:SS:FF", fps)}
          </span>
          <span className="text-zinc-500">/</span>
          <span className="text-zinc-400">
            {formatTimeCode(duration, "HH:MM:SS:FF", fps)}
          </span>
        </div>
      </div>

      {/* Right: Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          disabled={zoomLevel <= 0.25}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="縮小 (Ctrl + -)"
        >
          <ZoomOut className="w-4 h-4 text-white" />
        </button>

        {/* Zoom Slider */}
        <input
          type="range"
          min="0.25"
          max="4"
          step="0.25"
          value={zoomLevel}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
          title={`縮放: ${zoomLevel.toFixed(2)}x`}
        />

        <button
          onClick={onZoomIn}
          disabled={zoomLevel >= 4}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="放大 (Ctrl + +)"
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </button>

        {/* Zoom Level Display */}
        <span className="text-xs text-zinc-400 font-mono w-12 text-center">
          {(zoomLevel * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}