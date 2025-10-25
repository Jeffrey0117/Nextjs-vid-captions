"use client";

import {
  Play,
  Pause,
  SkipBack,
  ZoomIn,
  ZoomOut,
  Scissors,
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  Trash2,
  Bookmark
} from "lucide-react";
import { EditableTimecode } from "./EditableTimecode";

interface VideoPlaybackControlsProps {
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Playback controls
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipToStart: () => void;
  
  // Editing controls (optional)
  onSplit?: () => void;
  onSplitKeepLeft?: () => void;
  onSplitKeepRight?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  
  // Bookmark controls (optional)
  bookmarks?: number[];
  onToggleBookmark?: () => void;
  
  // Zoom controls
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  
  // Display settings
  fps?: number;
  className?: string;
  
  // Feature flags
  showEditingTools?: boolean;
  showBookmarks?: boolean;
}

export default function VideoPlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onSkipToStart,
  onSplit,
  onSplitKeepLeft,
  onSplitKeepRight,
  onDuplicate,
  onDelete,
  bookmarks = [],
  onToggleBookmark,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  fps = 30,
  className = "",
  showEditingTools = false,
  showBookmarks = false,
}: VideoPlaybackControlsProps) {
  const isBookmarked = bookmarks.includes(Math.floor(currentTime * 10) / 10);
  return (
    <div className={`flex items-center justify-between px-3 py-2 border-t bg-zinc-900 ${className}`}>
      {/* Left: Playback & Editing Controls */}
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

        {/* Time Display with Editable Timecode */}
        <div className="flex items-center gap-2 px-2">
          <EditableTimecode
            time={currentTime}
            duration={duration}
            format="HH:MM:SS:FF"
            fps={fps}
            onTimeChange={onSeek}
          />
          <span className="text-zinc-500 text-sm font-mono">/</span>
          <span className="text-zinc-400 text-sm font-mono">
            {new Date(duration * 1000).toISOString().substr(11, 8)}:
            {String(Math.floor((duration % 1) * fps)).padStart(2, '0')}
          </span>
        </div>
        
        {/* Editing Tools */}
        {showEditingTools && (
          <>
            <div className="w-px h-6 bg-zinc-700 mx-1" />
            
            <button
              onClick={onSplit}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
              title="分割片段 (Ctrl+S)"
            >
              <Scissors className="w-4 h-4 text-white" />
            </button>
            
            <button
              onClick={onSplitKeepLeft}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
              title="分割保留左側 (Ctrl+Q)"
            >
              <ArrowLeftToLine className="w-4 h-4 text-white" />
            </button>
            
            <button
              onClick={onSplitKeepRight}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
              title="分割保留右側 (Ctrl+W)"
            >
              <ArrowRightToLine className="w-4 h-4 text-white" />
            </button>
            
            <button
              onClick={onDuplicate}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
              title="複製片段 (Ctrl+D)"
            >
              <Copy className="w-4 h-4 text-white" />
            </button>
            
            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
              title="刪除片段 (Delete)"
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          </>
        )}
        
        {/* Bookmarks */}
        {showBookmarks && (
          <>
            <div className="w-px h-6 bg-zinc-700 mx-1" />
            
            <button
              onClick={onToggleBookmark}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors"
              title={isBookmarked ? "移除書籤" : "新增書籤"}
            >
              <Bookmark
                className={`w-4 h-4 ${isBookmarked ? 'fill-blue-500 text-blue-500' : 'text-white'}`}
              />
            </button>
          </>
        )}
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