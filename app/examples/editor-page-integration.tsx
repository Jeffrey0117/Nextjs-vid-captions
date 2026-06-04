/**
 * EDITOR PAGE INTEGRATION PATCH
 * ==============================
 *
 * This file shows the exact changes needed to integrate async transcription
 * into app/editor/page.tsx
 *
 * Apply these changes to enable non-blocking Whisper processing with real-time progress.
 */

// ============================================================================
// STEP 1: Add imports at the top of app/editor/page.tsx
// ============================================================================

import { useTranscribeTask } from "../hooks/useTranscribeTask";

// ============================================================================
// STEP 2: Initialize the hook inside ProjectsPage component (after line 66)
// ============================================================================

export default function ProjectsPage() {
  // ... existing state declarations ...

  // ADD THIS: Initialize transcription hook
  const transcribeTask = useTranscribeTask({
    pollInterval: 2000,
    useLongPolling: false,

    onCompleted: (result) => {
      // Find the project that's being transcribed
      const project = projects.find((p) => p.status === "transcribing");
      if (!project) return;

      const parsedSegments = parseSrt(result.srtContent);

      // Update to translating status
      updateProject(project.id, {
        segments: parsedSegments.map((seg) => ({
          ...seg,
          translatedText: "",
        })),
        progress: 50,
      });

      // Continue with translation
      continueWithTranslation(project.id, parsedSegments);
    },

    onError: (error) => {
      const project = projects.find((p) => p.status === "transcribing");
      if (project) {
        updateProject(project.id, {
          status: "error",
          errorMessage: `Transcription failed: ${error}`,
        });
      }
    },

    onProgress: (progress, message) => {
      const project = projects.find((p) => p.status === "transcribing");
      if (project) {
        updateProject(project.id, {
          progress: Math.floor(progress / 2), // 0-50% for transcription
          message: message || "Transcribing...",
        });
      }
    },
  });

  // ... rest of component ...
}

// ============================================================================
// STEP 3: Create helper function for translation continuation
// ============================================================================

const continueWithTranslation = async (
  projectId: string,
  parsedSegments: any[]
) => {
  try {
    updateProject(projectId, { status: "translating", progress: 50 });

    const translateRes = await fetch("/api/translate", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: parsedSegments.map((s) => s.text),
        targetLang: "zh-TW",
      }),
    });

    if (!translateRes.ok) {
      const errorData = await translateRes
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Translation failed");
    }

    const { translations } = await translateRes.json();

    const segments = parsedSegments.map((seg, i) => ({
      ...seg,
      translatedText: translations[i]?.translatedText || seg.text,
    }));

    updateProject(projectId, {
      status: "ready",
      progress: 100,
      segments,
    });
  } catch (error: any) {
    console.error("Translation failed:", error);
    updateProject(projectId, {
      status: "error",
      errorMessage: `Translation failed: ${error.message}`,
    });
  }
};

// ============================================================================
// STEP 4: Replace autoProcessVideo function (around line 230-298)
// ============================================================================

// REPLACE THIS FUNCTION with the new async version:
const autoProcessVideo = async (projectId: string, videoFile: File) => {
  try {
    // Update status to transcribing
    updateProject(projectId, { status: "transcribing", progress: 0 });

    // Start async transcription (non-blocking)
    await transcribeTask.startTranscription(videoFile, "en");

    // The hook callbacks will handle the rest:
    // - onProgress updates project progress
    // - onCompleted triggers translation
    // - onError handles failures
  } catch (error: any) {
    console.error("Auto process failed:", error);
    updateProject(projectId, {
      status: "error",
      errorMessage: error.message || "Processing failed",
    });
  }
};

// ============================================================================
// STEP 5: Update Project interface to include message field (around line 24)
// ============================================================================

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  thumbnail?: string | null;

  // Video related
  videoFile?: File | null;
  videoUrl?: string | null;

  // Status tracking
  status:
    | "idle"
    | "uploading"
    | "transcribing"
    | "translating"
    | "ready"
    | "error";
  progress: number; // 0-100
  errorMessage?: string;
  message?: string; // ADD THIS: Real-time status message

  // Subtitle data
  segments?: Array<{
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    translatedText?: string;
  }>;
}

// ============================================================================
// STEP 6: Update ProjectCard to display real-time message (around line 806)
// ============================================================================

// In the ProjectCard component, add message display:
{
  ["uploading", "transcribing", "translating"].includes(project.status) && (
    <div className="mt-2">
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${project.progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-400">{project.progress}%</p>
        {/* ADD THIS: Display real-time message */}
        {project.message && (
          <p className="text-xs text-gray-400 italic">{project.message}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPLETE INTEGRATION SUMMARY
// ============================================================================

/**
 * What changed:
 * 1. Transcription is now async and non-blocking
 * 2. Progress updates in real-time (every 2 seconds)
 * 3. No more 60-second timeout errors
 * 4. Better UX with detailed progress messages
 * 5. Translation happens automatically after transcription
 *
 * Testing:
 * 1. Upload a 5-minute video
 * 2. Watch progress bar update in real-time
 * 3. See detailed messages like "Processing: 01:23"
 * 4. Task continues even if you navigate away
 * 5. Poll status endpoint manually:
 *    GET /api/transcribe/status?taskId=transcribe_xxx
 *
 * Benefits:
 * - Scalable for long videos (10+ minutes)
 * - Server doesn't block on long operations
 * - Better resource utilization
 * - Improved user experience
 */
