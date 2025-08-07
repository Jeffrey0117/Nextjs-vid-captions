"use client";

import { Subtitle } from "@/lib/types";
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

export default function SubtitleBox({ subtitle }: SubtitleBoxProps) {
  console.log("🎬 SubtitleBox component is being rendered!");
  console.log("🎬 Subtitle prop:", subtitle);

  if (!subtitle) {
    console.log("❌ No subtitle provided, returning null");
    return null;
  }

  // Debug: 檢查實際傳入的數據
  console.log("✅ SubtitleBox received:", subtitle);

  const startTime = formatTimeSimple(subtitle.startTime);
  const endTime = formatTimeSimple(subtitle.endTime);

  console.log("⏰ Formatted times:", { startTime, endTime });

  return (
    <div className="absolute bottom-4 left-0 right-0">
      <div className="bg-black bg-opacity-70 text-white text-center py-2 px-4 mx-auto max-w-3xl rounded">
        <div className="flex justify-between items-center text-sm text-gray-300 mb-1">
          <span className="text-xs bg-gray-800 px-2 py-1 rounded">
            {startTime} - {endTime}
          </span>
        </div>
        <p className="text-lg md:text-xl font-medium">{subtitle.text}</p>
      </div>
    </div>
  );
}
