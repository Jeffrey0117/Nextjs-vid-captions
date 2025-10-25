// Time-related utility functions for subtitle editor
// Based on OpenCut's time.ts with subtitle-specific adaptations

export type TimeCode = "MM:SS" | "HH:MM:SS" | "HH:MM:SS:CS" | "HH:MM:SS:FF";

export const DEFAULT_FPS = 30;

/**
 * Format time in seconds to various timecode formats
 * @param timeInSeconds - Time in seconds (can be decimal)
 * @param format - Desired output format
 * @param fps - Frames per second (default: 30)
 * @returns Formatted timecode string
 */
export const formatTimeCode = (
  timeInSeconds: number,
  format: TimeCode = "HH:MM:SS:CS",
  fps = DEFAULT_FPS
): string => {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const centiseconds = Math.floor((timeInSeconds % 1) * 100);
  const frames = Math.floor((timeInSeconds % 1) * fps);

  switch (format) {
    case "MM:SS":
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS:CS":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${centiseconds.toString().padStart(2, "0")}`;
    case "HH:MM:SS:FF":
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  }
};

/**
 * Parse timecode string back to seconds
 * @param timeCode - Timecode string to parse
 * @param format - Format of the input timecode
 * @param fps - Frames per second (default: 30)
 * @returns Time in seconds, or null if invalid
 */
export const parseTimeCode = (
  timeCode: string,
  format: TimeCode = "HH:MM:SS:CS",
  fps = DEFAULT_FPS
): number | null => {
  if (!timeCode || typeof timeCode !== "string") return null;

  // Remove any extra whitespace
  const cleanTimeCode = timeCode.trim();

  try {
    switch (format) {
      case "MM:SS": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 2) return null;
        const [minutes, seconds] = parts.map((part) => parseInt(part, 10));
        if (isNaN(minutes) || isNaN(seconds)) return null;
        if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
        return minutes * 60 + seconds;
      }

      case "HH:MM:SS": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 3) return null;
        const [hours, minutes, seconds] = parts.map((part) =>
          parseInt(part, 10)
        );
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          minutes >= 60 ||
          seconds >= 60
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds;
      }

      case "HH:MM:SS:CS": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 4) return null;
        const [hours, minutes, seconds, centiseconds] = parts.map((part) =>
          parseInt(part, 10)
        );
        if (
          isNaN(hours) ||
          isNaN(minutes) ||
          isNaN(seconds) ||
          isNaN(centiseconds)
        )
          return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          centiseconds < 0 ||
          minutes >= 60 ||
          seconds >= 60 ||
          centiseconds >= 100
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
      }

      case "HH:MM:SS:FF": {
        const parts = cleanTimeCode.split(":");
        if (parts.length !== 4) return null;
        const [hours, minutes, seconds, frames] = parts.map((part) =>
          parseInt(part, 10)
        );
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(frames))
          return null;
        if (
          hours < 0 ||
          minutes < 0 ||
          seconds < 0 ||
          frames < 0 ||
          minutes >= 60 ||
          seconds >= 60 ||
          frames >= fps
        )
          return null;
        return hours * 3600 + minutes * 60 + seconds + frames / fps;
      }
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Guess the timecode format from a string
 * @param timeCode - Timecode string to analyze
 * @returns Detected format, or null if invalid
 */
export const guessTimeCodeFormat = (timeCode: string): TimeCode | null => {
  if (!timeCode || typeof timeCode !== "string") return null;

  const numbers = timeCode.split(":");

  if (!numbers.every((n) => !isNaN(Number(n)))) return null;

  if (numbers.length === 2) return "MM:SS";
  if (numbers.length === 3) return "HH:MM:SS";
  if (numbers.length === 4) return "HH:MM:SS:FF";

  return null;
};

/**
 * Convert time to frame number
 * @param time - Time in seconds
 * @param fps - Frames per second
 * @returns Frame number
 */
export function timeToFrame(time: number, fps: number): number {
  return Math.round(time * fps);
}

/**
 * Convert frame number to time
 * @param frame - Frame number
 * @param fps - Frames per second
 * @returns Time in seconds
 */
export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

/**
 * Snap time to nearest frame boundary
 * @param time - Time in seconds
 * @param fps - Frames per second
 * @returns Frame-snapped time
 */
export function snapTimeToFrame(time: number, fps: number): number {
  if (fps <= 0) return time; // Fallback for invalid FPS
  const frame = timeToFrame(time, fps);
  return frameToTime(frame, fps);
}

/**
 * Get duration of a single frame
 * @param fps - Frames per second
 * @returns Duration in seconds
 */
export function getFrameDuration(fps: number): number {
  return 1 / fps;
}

/**
 * Format milliseconds to readable time
 * @param ms - Milliseconds
 * @returns Formatted string (e.g., "1.5s")
 */
export function formatMilliseconds(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Clamp time within duration bounds
 * @param time - Time to clamp
 * @param duration - Maximum duration
 * @returns Clamped time
 */
export function clampTime(time: number, duration: number): number {
  return Math.max(0, Math.min(duration, time));
}