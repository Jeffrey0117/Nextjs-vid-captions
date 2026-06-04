/**
 * Example: How to use async transcription with progress tracking
 *
 * This example shows how to integrate the new async Whisper transcription
 * into your existing page components.
 */

import { useTranscribeTask } from "../hooks/useTranscribeTask";
import { useState } from "react";
import { parseSrt } from "@/lib/parseSrt";

export function AsyncTranscriptionExample() {
  const [segments, setSegments] = useState<any[]>([]);

  // Initialize the transcription hook
  const {
    startTranscription,
    cancelTask,
    isLoading,
    progress,
    status,
    result,
    error,
    message,
  } = useTranscribeTask({
    pollInterval: 2000, // Poll every 2 seconds
    useLongPolling: false, // Use regular polling (set to true for long polling)

    onCompleted: (result) => {
      console.log("Transcription completed!", result);
      // Parse SRT content
      const parsedSegments = parseSrt(result.srtContent);
      setSegments(parsedSegments);
    },

    onError: (error) => {
      console.error("Transcription failed:", error);
      alert(`Transcription failed: ${error}`);
    },

    onProgress: (progress, message) => {
      console.log(`Progress: ${progress}% - ${message}`);
    },
  });

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    // Start transcription (non-blocking)
    await startTranscription(file, "en"); // "en" for English, "zh" for Chinese
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Async Transcription Example</h2>

      {/* File upload */}
      <input
        type="file"
        accept="video/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        disabled={isLoading}
        className="mb-4"
      />

      {/* Progress display */}
      {isLoading && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Status: {status || "initializing"}
            </span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {message && (
            <p className="text-xs text-gray-500 mt-1">{message}</p>
          )}
          <button
            onClick={cancelTask}
            className="mt-2 px-3 py-1 text-sm bg-red-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded">
          <p className="font-medium">Transcription completed!</p>
          <p className="text-sm">Video URL: {result.videoUrl}</p>
          <p className="text-sm">Segments: {segments.length}</p>
        </div>
      )}

      {/* Subtitle list */}
      {segments.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Subtitles:</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {segments.map((seg) => (
              <div key={seg.id} className="p-2 bg-gray-100 rounded">
                <p className="text-xs text-gray-500">
                  {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                </p>
                <p className="text-sm">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * INTEGRATION GUIDE
 * =================
 *
 * 1. Replace the old synchronous transcription code:
 *
 * OLD CODE (editor/page.tsx line 233-250):
 * ```typescript
 * const transcribeRes = await fetch('/api/transcribe', {
 *   method: 'POST',
 *   body: formData,
 * });
 * const { srtContent } = await transcribeRes.json();
 * ```
 *
 * NEW CODE:
 * ```typescript
 * // Initialize hook at component level
 * const { startTranscription, progress, status, result } = useTranscribeTask({
 *   onCompleted: (result) => {
 *     const parsedSegments = parseSrt(result.srtContent);
 *     updateProject(projectId, { segments: parsedSegments, status: 'ready' });
 *   },
 *   onProgress: (progress) => {
 *     updateProject(projectId, { progress, status: 'transcribing' });
 *   },
 *   onError: (error) => {
 *     updateProject(projectId, { status: 'error', errorMessage: error });
 *   }
 * });
 *
 * // In your upload handler
 * await startTranscription(videoFile, 'en');
 * ```
 *
 * 2. Update Project interface to track transcription task:
 * ```typescript
 * interface Project {
 *   // ... existing fields
 *   transcriptionTaskId?: string;
 * }
 * ```
 *
 * 3. Display progress in the UI:
 * ```tsx
 * {project.status === 'transcribing' && (
 *   <div className="w-full bg-gray-700 rounded-full h-1.5">
 *     <div
 *       className="bg-blue-600 h-1.5 rounded-full"
 *       style={{ width: `${project.progress}%` }}
 *     />
 *   </div>
 * )}
 * ```
 *
 * BENEFITS:
 * - No more 60-second timeout errors
 * - Real-time progress feedback
 * - Better UX with cancellable tasks
 * - Scalable for long videos (5+ minutes)
 */
