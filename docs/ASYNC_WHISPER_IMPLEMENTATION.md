# Async Whisper Implementation Guide

## Overview

This document describes the implementation of async Whisper transcription with real-time progress updates. This solution addresses the 60-second timeout limitation in Next.js API routes and provides better UX for long video processing.

## Architecture

### Components

1. **Task Queue System** (`app/lib/task-queue.ts`)
   - Centralized task management using EventEmitter
   - Supports queued, processing, completed, and error states
   - Real-time progress tracking with percentage and messages
   - Auto-cleanup of old tasks (1 hour retention)
   - Concurrent task limiting (max 3 tasks)

2. **Transcribe API** (`app/api/transcribe/route.ts`)
   - Returns taskId immediately (non-blocking)
   - Uses `spawn` instead of `exec` for real-time output
   - Parses Whisper progress from stderr
   - Supports multiple models: tiny, base, small, medium, large
   - Supports multiple languages: auto, zh, en, ja, ko, fr, de, es, pt, ru, it, nl, pl, tr

3. **Status Polling API** (`app/api/transcribe/status/route.ts`)
   - GET endpoint for task status queries
   - Supports both regular polling and long polling
   - Returns task progress, status, result, and error

4. **React Hook** (`app/hooks/useTranscribeTask.ts`)
   - Custom hook for managing async transcription
   - Automatic polling with configurable interval
   - Callbacks for completion, error, and progress
   - Task cancellation support

## Request/Response Flow

```
┌─────────┐                ┌──────────┐                ┌────────────┐
│ Client  │                │ API      │                │ Task Queue │
└────┬────┘                └─────┬────┘                └──────┬─────┘
     │                           │                            │
     │ POST /api/transcribe      │                            │
     ├──────────────────────────>│                            │
     │ (file, model, language)   │                            │
     │                           │ submitTask(taskId)         │
     │                           ├───────────────────────────>│
     │                           │                            │
     │ { taskId, status }        │                            │
     │<──────────────────────────┤                            │
     │ (immediate return)        │                            │
     │                           │                            │
     │                           │                   ┌────────┴────────┐
     │                           │                   │ Execute Whisper │
     │                           │                   │ spawn process   │
     │                           │                   └────────┬────────┘
     │                           │                            │
     │ GET /api/transcribe/status?taskId=xxx                  │
     ├──────────────────────────────────────────────────────> │
     │                           │                            │
     │ { status, progress, message }                          │
     │<───────────────────────────────────────────────────────┤
     │ (poll every 2s)           │                            │
     │                           │                            │
     │ GET /api/transcribe/status?taskId=xxx                  │
     ├──────────────────────────────────────────────────────> │
     │                           │                            │
     │ { status: "completed", result }                        │
     │<───────────────────────────────────────────────────────┤
     │                           │                            │
```

## API Documentation

### POST /api/transcribe

Submit a new transcription task.

**Request:**
```typescript
FormData {
  file: File;         // Video file
  model?: string;     // "tiny" | "base" | "small" | "medium" | "large" (default: "base")
  language?: string;  // "auto" | "zh" | "en" | ... (default: "auto")
}
```

**Response:**
```typescript
{
  taskId: string;     // Unique task identifier
  status: "queued";   // Initial status
  message: string;    // Human-readable message
}
```

### GET /api/transcribe/status

Query task status and progress.

**Request:**
```
GET /api/transcribe/status?taskId={taskId}&longPoll={boolean}
```

**Query Parameters:**
- `taskId` (required): Task identifier from POST response
- `longPoll` (optional): Use long polling (waits up to 30s for updates)

**Response:**
```typescript
{
  taskId: string;
  status: "queued" | "processing" | "completed" | "error";
  progress: number;   // 0-100
  message?: string;   // Human-readable status
  result?: {          // Only present when status = "completed"
    videoUrl: string;
    srtContent: string;
    status: "completed";
  };
  error?: string;     // Only present when status = "error"
  createdAt: Date;
  updatedAt: Date;
}
```

## Frontend Integration

### Basic Usage

```typescript
import { useTranscribeTask } from "@/app/hooks/useTranscribeTask";

function MyComponent() {
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
    pollInterval: 2000,
    onCompleted: (result) => {
      console.log("Transcription completed:", result);
    },
    onError: (error) => {
      console.error("Transcription failed:", error);
    },
    onProgress: (progress, message) => {
      console.log(`Progress: ${progress}% - ${message}`);
    },
  });

  const handleUpload = async (file: File) => {
    await startTranscription(file, "en");
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {isLoading && (
        <div>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <p>{message}</p>
          <button onClick={cancelTask}>Cancel</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {result && <div>Video: {result.videoUrl}</div>}
    </div>
  );
}
```

### Advanced: Integration with Editor Page

See `app/examples/editor-page-integration.tsx` for a complete example of integrating async transcription into the editor workflow.

## Whisper Progress Parsing

The implementation parses progress from Whisper's stderr output. Whisper outputs timestamps as it processes:

```
[00:01.000 --> 00:05.000]  Processing...
[00:05.000 --> 00:10.000]  Processing...
[00:10.000 --> 00:15.000]  Processing...
```

The parser extracts the timestamp and estimates progress based on the current position:

```typescript
const progressMatch = output.match(/\[(\d{2}):(\d{2})\.(\d{3})\s*-->/);
if (progressMatch) {
  const minutes = parseInt(progressMatch[1]);
  const seconds = parseInt(progressMatch[2]);
  const currentTime = minutes * 60 + seconds;

  // Estimate progress (cap at 95% until completion)
  const estimatedProgress = Math.min(95, (currentTime / 300) * 100);
  taskQueue.updateProgress(taskId, estimatedProgress, `Processing: ${minutes}:${seconds}`);
}
```

**Note:** This is a rough estimate. For more accurate progress, you would need to know the actual video duration upfront.

## Performance Considerations

### Concurrency Limits

The task queue limits concurrent Whisper processes to 3 by default. This prevents server overload:

```typescript
private maxConcurrentTasks = 3;
```

Adjust this based on your server's CPU and memory resources.

### Polling Strategy

**Regular Polling (default):**
- Polls every 2 seconds
- Lower server load
- Slightly delayed updates

**Long Polling:**
- Waits up to 30 seconds for updates
- More real-time
- Higher server resource usage

```typescript
const { ... } = useTranscribeTask({
  pollInterval: 2000,       // Regular polling interval
  useLongPolling: false,    // Set to true for long polling
});
```

### Task Cleanup

Old tasks are automatically cleaned up after 1 hour:

```typescript
// Runs every 10 minutes
setInterval(() => {
  taskQueue.cleanup();
}, 10 * 60 * 1000);
```

## Testing

### 1. Test with Short Video (< 1 minute)

```bash
# Upload a short test video
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@test-short.mp4" \
  -F "model=base" \
  -F "language=en"

# Response: { "taskId": "transcribe_xxx", "status": "queued" }

# Poll status
curl http://localhost:3000/api/transcribe/status?taskId=transcribe_xxx
```

### 2. Test with Long Video (5+ minutes)

```bash
# Upload a long video (should not timeout)
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@test-long.mp4" \
  -F "model=base" \
  -F "language=en"

# Poll repeatedly to see progress updates
watch -n 2 'curl http://localhost:3000/api/transcribe/status?taskId=transcribe_xxx'
```

### 3. Test Progress Parsing

Monitor the server logs to see real-time progress updates:

```bash
npm run dev

# In another terminal, upload a video
# Watch the server logs for progress messages:
# "Progress: 10% - Processing: 00:30"
# "Progress: 20% - Processing: 01:00"
```

### 4. Test Error Handling

```bash
# Upload an invalid file
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@invalid.txt" \
  -F "model=base"

# Should return error status in polling response
```

## Troubleshooting

### Issue: Progress stuck at 0%

**Cause:** Whisper output format changed or not being captured.

**Solution:** Check Whisper stderr parsing regex in `executeWhisperTask()`. Enable verbose logging:

```typescript
whisper.stderr.on("data", (data: Buffer) => {
  const output = data.toString();
  console.log("Whisper output:", output); // Debug log
  // ... rest of parsing logic
});
```

### Issue: Task not found

**Cause:** Task expired (older than 1 hour) or invalid taskId.

**Solution:** Check taskId format and ensure polling starts immediately after submission.

### Issue: Slow progress updates

**Cause:** Polling interval too high.

**Solution:** Reduce `pollInterval` in the hook:

```typescript
const { ... } = useTranscribeTask({
  pollInterval: 1000, // Poll every 1 second
});
```

### Issue: Server memory leak

**Cause:** Tasks not being cleaned up.

**Solution:** Verify cleanup is running:

```typescript
// In task-queue.ts
console.log("Cleanup started, tasks count:", this.tasks.size);
```

## Future Improvements

1. **Video Duration Detection**
   - Detect video duration upfront for accurate progress estimation
   - Use ffprobe to get duration before transcription

2. **WebSocket Support**
   - Replace polling with WebSocket for true real-time updates
   - Requires additional infrastructure (Socket.io or native WebSocket)

3. **Queue Visualization**
   - Show queue position for queued tasks
   - Display estimated wait time

4. **Background Persistence**
   - Store task state in database for server restarts
   - Resume tasks after deployment

5. **Batch Processing**
   - Support multiple file uploads
   - Process videos in parallel up to concurrency limit

6. **Progress Caching**
   - Cache progress in Redis for better scalability
   - Support horizontal scaling across multiple servers

## References

- [Whisper CLI Documentation](https://github.com/openai/whisper)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [EventEmitter](https://nodejs.org/api/events.html)

## License

MIT
