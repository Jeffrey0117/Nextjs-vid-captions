"use client";

import { useState, useRef, useEffect } from "react";
import { Subtitle, DEFAULT_STYLE } from "@/lib/types";
import { SubtitleBoxProps } from "./types";

// Helper function to format time from SRT format or milliseconds to MM:SS format
const formatTimeSimple = (time: number | string): string => {
  // If it's already a string (SRT format like "00:00:02,300"), parse it
  if (typeof time === "string") {
    // SRT format: HH:MM:SS,mmm
    const timeParts = time.split(":");
    if (timeParts.length === 3) {
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      const secondsParts = timeParts[2].split(",");
      const seconds = parseInt(secondsParts[0]);

      const totalMinutes = hours * 60 + minutes;
      return `${totalMinutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return time; // Return as-is if format is unexpected
  }

  // If it's a number (milliseconds), use original logic
  const totalSeconds = Math.floor(time / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

interface ExtendedSubtitleBoxProps extends SubtitleBoxProps {
  onPositionChange?: (x: number, y: number) => void;
  isDraggable?: boolean;
}

export default function SubtitleBox({
  subtitle,
  onPositionChange,
  isDraggable = false
}: ExtendedSubtitleBoxProps) {
  // ⚠️ 所有 Hooks 必須在條件判斷之前呼叫
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !onPositionChange) return;

    // 取得影片容器的尺寸
    const videoContainer = containerRef.current?.parentElement;
    if (!videoContainer) return;

    const rect = videoContainer.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // 限制在 0-100 範圍內
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    onPositionChange(clampedX, clampedY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 監聽全域滑鼠事件
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => handleMouseMove(e);
    const handleUp = () => handleMouseUp();

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  // ✅ 條件判斷移到所有 Hooks 之後
  if (!subtitle) {
    return null;
  }

  const startTime = formatTimeSimple(subtitle.startTime);
  const endTime = formatTimeSimple(subtitle.endTime);

  // 使用字幕的樣式,或使用預設樣式
  const style = subtitle.style || DEFAULT_STYLE;
  const { fontSize, color, position } = style;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable || !onPositionChange) return;
    setIsDragging(true);
    e.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className={`absolute ${isDraggable ? 'cursor-move' : 'pointer-events-none'}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`bg-black bg-opacity-70 text-center py-2 px-4 rounded ${
          isDragging ? 'ring-2 ring-blue-500' : ''
        }`}
        style={{
          color: color,
          fontSize: `${fontSize}px`,
        }}
      >
        <div className="flex justify-center items-center text-xs text-gray-300 mb-1">
          <span className="bg-gray-800 bg-opacity-50 px-2 py-1 rounded">
            {startTime} - {endTime}
          </span>
        </div>
        <p className="font-medium whitespace-pre-wrap">{subtitle.text}</p>
      </div>
      {isDraggable && (
        <div className="text-center mt-1 text-xs text-white bg-blue-600 bg-opacity-80 px-2 py-1 rounded">
          拖曳調整位置
        </div>
      )}
    </div>
  );
}
