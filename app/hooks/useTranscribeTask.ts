// app/hooks/useTranscribeTask.ts
// Custom hook for async transcription with real-time progress polling

import { useState, useEffect, useCallback, useRef } from "react";

export interface TranscribeTaskStatus {
  taskId: string;
  status: "queued" | "processing" | "completed" | "error";
  progress: number;
  result?: {
    videoUrl: string;
    srtContent: string;
    status: string;
  };
  error?: string;
  message?: string;
}

export interface UseTranscribeTaskOptions {
  pollInterval?: number; // Polling interval in ms (default: 2000)
  useLongPolling?: boolean; // Use long polling instead of regular polling
  onCompleted?: (result: any) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number, message?: string) => void;
}

export function useTranscribeTask(options: UseTranscribeTaskOptions = {}) {
  const {
    pollInterval = 2000,
    useLongPolling = false,
    onCompleted,
    onError,
    onProgress,
  } = options;

  const [taskStatus, setTaskStatus] = useState<TranscribeTaskStatus | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);

  /**
   * Start transcription task
   */
  const startTranscription = useCallback(
    async (file: File, language: string = "en", optimizeTimings: boolean = false) => {
      try {
        setIsLoading(true);
        setTaskStatus(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("language", language);
        formData.append("optimizeTimings", optimizeTimings.toString());

        // Submit task
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to submit transcription task");
        }

        const data = await response.json();
        const taskId = data.taskId;

        currentTaskIdRef.current = taskId;
        setTaskStatus({
          taskId,
          status: "queued",
          progress: 0,
          message: data.message || "Task queued",
        });

        // Start polling
        startPolling(taskId);
      } catch (error: any) {
        console.error("Error starting transcription:", error);
        setIsLoading(false);
        setTaskStatus({
          taskId: "",
          status: "error",
          progress: 0,
          error: error.message,
          message: "Failed to start transcription",
        });
        onError?.(error.message);
      }
    },
    [onError]
  );

  /**
   * Poll task status
   */
  const pollStatus = useCallback(
    async (taskId: string) => {
      try {
        const url = useLongPolling
          ? `/api/transcribe/status?taskId=${taskId}&longPoll=true`
          : `/api/transcribe/status?taskId=${taskId}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch task status");
        }

        const status: TranscribeTaskStatus = await response.json();

        // Update status
        setTaskStatus(status);

        // Call progress callback
        if (status.progress !== undefined) {
          onProgress?.(status.progress, status.message);
        }

        // Check if completed
        if (status.status === "completed") {
          setIsLoading(false);
          stopPolling();
          onCompleted?.(status.result);
        } else if (status.status === "error") {
          setIsLoading(false);
          stopPolling();
          onError?.(status.error || "Unknown error");
        } else {
          // Continue polling for queued/processing status
          if (!useLongPolling && currentTaskIdRef.current === taskId) {
            pollTimerRef.current = setTimeout(() => {
              pollStatus(taskId);
            }, pollInterval);
          } else if (useLongPolling && currentTaskIdRef.current === taskId) {
            // Long polling: immediately poll again
            pollStatus(taskId);
          }
        }
      } catch (error: any) {
        console.error("Error polling task status:", error);

        // Retry on network error (don't stop polling)
        if (currentTaskIdRef.current === taskId) {
          pollTimerRef.current = setTimeout(() => {
            pollStatus(taskId);
          }, pollInterval);
        }
      }
    },
    [pollInterval, useLongPolling, onCompleted, onError, onProgress]
  );

  /**
   * Start polling
   */
  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling(); // Clear existing timer
      setIsLoading(true);
      pollStatus(taskId);
    },
    [pollStatus]
  );

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  /**
   * Cancel task
   */
  const cancelTask = useCallback(() => {
    stopPolling();
    currentTaskIdRef.current = null;
    setIsLoading(false);
    setTaskStatus(null);
  }, [stopPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startTranscription,
    cancelTask,
    taskStatus,
    isLoading,
    progress: taskStatus?.progress || 0,
    status: taskStatus?.status || null,
    result: taskStatus?.result || null,
    error: taskStatus?.error || null,
    message: taskStatus?.message || null,
  };
}
