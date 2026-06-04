# Quick Start: Async Whisper Transcription

## 5-Minute Setup Guide

This guide will get you up and running with async Whisper transcription in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Whisper CLI installed (`pip install openai-whisper`)
- Next.js project running

## Step 1: Test the Implementation (1 minute)

### Option A: Interactive HTML Test Page

1. Start your Next.js dev server:
   ```bash
   npm run dev
   ```

2. Open in browser:
   ```
   http://localhost:3000/test-async-transcribe.html
   ```

3. Upload a short video (< 1 minute) and watch the progress bar update in real-time!

### Option B: Command Line Test

```bash
# Make script executable (on Linux/Mac)
chmod +x scripts/test-async-transcribe.sh

# Run test (requires jq: brew install jq or apt install jq)
./scripts/test-async-transcribe.sh path/to/test-video.mp4
```

## Step 2: Verify Installation (1 minute)

Check that all files are in place:

```bash
# Core system
ls app/lib/task-queue.ts                         # Task queue
ls app/api/transcribe/route.ts                   # Async API
ls app/api/transcribe/status/route.ts            # Status endpoint
ls app/hooks/useTranscribeTask.ts                # React hook

# Documentation
ls docs/ASYNC_WHISPER_IMPLEMENTATION.md          # Full guide
ls docs/ASYNC_WHISPER_ARCHITECTURE.md            # Architecture
ls IMPLEMENTATION_SUMMARY.md                     # Summary

# Examples
ls app/examples/async-transcription-example.tsx  # Basic example
ls app/examples/editor-page-integration.tsx      # Integration guide
```

All files should exist. If any are missing, check the implementation summary.

## Step 3: Integrate into Your Page (3 minutes)

### Example: Simple Upload Page

```typescript
// pages/upload.tsx
import { useTranscribeTask } from "@/app/hooks/useTranscribeTask";
import { parseSrt } from "@/lib/parseSrt";

export default function UploadPage() {
  const [segments, setSegments] = useState([]);

  const {
    startTranscription,
    isLoading,
    progress,
    status,
    message,
    error,
  } = useTranscribeTask({
    pollInterval: 2000,
    onCompleted: (result) => {
      const parsed = parseSrt(result.srtContent);
      setSegments(parsed);
      alert("Transcription completed!");
    },
    onError: (error) => {
      alert(`Error: ${error}`);
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await startTranscription(file, "en");
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Video</h1>

      <input
        type="file"
        accept="video/*"
        onChange={handleUpload}
        disabled={isLoading}
        className="mb-4"
      />

      {isLoading && (
        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span>Status: {status}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {segments.length > 0 && (
        <div className="mt-4">
          <h2 className="font-bold mb-2">Subtitles ({segments.length})</h2>
          <div className="space-y-2">
            {segments.map((seg) => (
              <div key={seg.id} className="p-2 bg-gray-100 rounded">
                <p className="text-sm">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Done! Your page now supports async transcription with real-time progress.

## Step 4: Test with Long Video (Optional)

Upload a 5-minute video to verify there are no timeout issues:

```bash
# Using the test page
http://localhost:3000/test-async-transcribe.html

# Or using curl
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@long-video.mp4" \
  -F "model=base" \
  -F "language=en"

# Copy the taskId from response, then poll:
curl http://localhost:3000/api/transcribe/status?taskId=transcribe_xxx
```

You should see:
- Progress updates every 2 seconds
- No timeout errors
- Completion after processing

## Common Issues

### Issue: "Whisper command not found"

**Solution:**
```bash
# Install Whisper
pip install openai-whisper

# Verify installation
whisper --help
```

### Issue: Progress stuck at 0%

**Solution:** Check server logs for Whisper output. Enable debug logging in `app/api/transcribe/route.ts`:

```typescript
whisper.stderr.on("data", (data) => {
  console.log("Whisper output:", data.toString());
  // ... rest of code
});
```

### Issue: Task not found

**Solution:** Ensure you're using the correct taskId from the POST response. Check that polling starts immediately after task submission.

## API Quick Reference

### Submit Task

```bash
POST /api/transcribe
Content-Type: multipart/form-data

file: <video>
model: "tiny" | "base" | "small" | "medium" | "large"
language: "auto" | "en" | "zh" | "ja" | ...

Response:
{
  "taskId": "transcribe_xxx",
  "status": "queued",
  "message": "Transcription task queued"
}
```

### Poll Status

```bash
GET /api/transcribe/status?taskId=transcribe_xxx

Response:
{
  "taskId": "transcribe_xxx",
  "status": "processing",
  "progress": 45,
  "message": "Processing: 01:23",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Status Values

- `queued`: Task waiting to start
- `processing`: Whisper running
- `completed`: Task finished (has `result` field)
- `error`: Task failed (has `error` field)

## Hook Options

```typescript
const { ... } = useTranscribeTask({
  pollInterval: 2000,        // Poll every 2 seconds
  useLongPolling: false,     // Use long polling (waits up to 30s)
  onCompleted: (result) => { /* handle result */ },
  onError: (error) => { /* handle error */ },
  onProgress: (progress, message) => { /* update UI */ },
});
```

## Performance Tips

1. **Use appropriate Whisper model:**
   - `tiny`: Fastest, least accurate
   - `base`: Recommended balance
   - `small`: Better accuracy
   - `medium`/`large`: Best accuracy, slowest

2. **Adjust polling interval:**
   - 2000ms: Good balance
   - 1000ms: More responsive
   - 5000ms: Lower server load

3. **Concurrent tasks:**
   - Default: 3 concurrent tasks
   - Adjust in `app/lib/task-queue.ts`:
     ```typescript
     private maxConcurrentTasks = 5; // Increase if you have more CPU
     ```

## Next Steps

1. **Read Full Documentation:**
   - `docs/ASYNC_WHISPER_IMPLEMENTATION.md` - Complete guide
   - `docs/ASYNC_WHISPER_ARCHITECTURE.md` - System architecture

2. **Integration Examples:**
   - `app/examples/async-transcription-example.tsx` - Basic example
   - `app/examples/editor-page-integration.tsx` - Editor integration

3. **Extend the System:**
   - Add WebSocket support for real-time updates
   - Store tasks in database for persistence
   - Add user authentication and task ownership
   - Implement batch processing

## Support

If you encounter issues:

1. Check the test page works: `http://localhost:3000/test-async-transcribe.html`
2. Review server logs for errors
3. Verify Whisper is installed: `whisper --help`
4. Check documentation: `docs/ASYNC_WHISPER_IMPLEMENTATION.md`

## Summary

You now have:
- ✅ Non-blocking Whisper transcription
- ✅ Real-time progress updates
- ✅ No timeout issues for long videos
- ✅ Clean React hook API
- ✅ Production-ready implementation

Enjoy building with async Whisper! 🎉
