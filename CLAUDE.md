# Subtitle Web (OpenCut 字幕編輯器)

Browser-based video subtitle editor: AI transcription (Whisper) + DeepL/Grok translation + styled subtitle burn-in / video rendering.

## Stack
- Next.js 15.4 (App Router) + React 19 + TypeScript 5 (strict)
- Tailwind CSS 4 (`@tailwindcss/postcss`), Radix UI, lucide-react, framer-motion, sonner (toasts)
- Zustand for state (`app/stores/subtitle-store.ts`)
- react-resizable-panels (editor layout), react-colorful (color picker)
- Server-side rendering pipeline: `ffmpeg` (via `child_process`), `canvas`, `mp4-muxer`, `puppeteer`
- Whisper transcription via Python CLI (`whisper` / `scripts/faster-whisper-srt.py`) spawned from API routes
- Translation: `deepl-node` (primary), Grok API, Google Translate (fallback)
- Dev server runs on port **3005** with `--turbopack`

## Directory structure
```
app/
  page.tsx              ← simple player/upload home
  editor/page.tsx       ← basic editor
  editor-pro/page.tsx   ← main professional editor (primary UI, /editor-pro)
  player/page.tsx       ← playback view
  components/           ← editor UI (BulkSubtitleEditor, SubtitleBox, VideoPlayer,
                          timeline, properties panel, etc.) + types.ts
  hooks/                ← recorders (usePreviewRecorder, useWebCodecsRecorder,
                          useSmartRecorder), useTranscribeTask, useToast
  stores/subtitle-store.ts  ← Zustand: SubtitleSegment, StyleTemplate, PinnedSubtitle
  lib/task-queue.ts     ← in-memory async task queue (EventEmitter, max 3 concurrent)
  utils/                ← parallel-upload-manager, performance-monitor, text-wrapping
  types/                ← color-management, video-quality, video-quality-pro
  api/
    transcribe/         ← Whisper (async task-based) + status polling
    translate/, deepl-translate/, grok-translate/, generate-title/  ← translation/AI
    render-video/, render-video-v2/  ← server-side ffmpeg ASS-subtitle burn-in (many variants)
    record-preview/     ← PNG frame sequence → ffmpeg mux (batch/finalize/merge-audio/cleanup)
    burn-subtitles/, upload-video/
lib/                    ← parseSrt, generateAss, optimizeSubtitleTimings, split-utils, time, types
public/
  temp/                 ← scratch dir for uploaded videos / generated files (.gitkeep)
  workers/canvas-renderer.worker.js  ← client-side canvas rendering worker
scripts/                ← faster-whisper-srt.py, test scripts
docs/                   ← extensive design/optimization docs (recording, whisper, deepl, wrapping)
```

## Key concepts
- **Two render paths**: (1) client records canvas preview into PNG frames / WebCodecs, then server muxes via ffmpeg (`record-preview`); (2) server burns ASS subtitles directly with ffmpeg (`render-video`). The `record-preview` path is favored for 100% preview-accurate output.
- **Async transcription**: `/api/transcribe` POST enqueues into `task-queue`, returns taskId; client polls `/api/transcribe/status`. Tasks track progress 0–100 with EventEmitter.
- **Subtitle model**: `SubtitleSegment` carries rich per-segment `style` (font, color, opacity, shadow, stroke, position X/Y %, maxWidth vw, scale). Style templates and full-video "pinned" subtitles supported.
- **Server tooling depends on external binaries**: requires `ffmpeg` on PATH and Python `whisper` installed; API routes `spawn`/`exec` them and write to `public/temp`.
- **bodySizeLimit 100MB** set in `next.config.ts` for large video uploads.
- **Path alias**: `@/*` → project root (e.g. `@/lib/parseSrt`, `@/app/lib/task-queue`).
- Main UI entry is **`/editor-pro`**, not the root page.

## Commands
```bash
npm run dev      # next dev --turbopack -p 3005
npm run build    # next build
npm start        # next start (production)
npm run lint     # next lint
```
External prerequisites: `pip install openai-whisper` and `ffmpeg` on PATH.

## Notes
- `.history/` holds editor file-history snapshots (noise — ignore when searching).
- Many root-level `*.md` and `docs/*.md` are implementation reports/plans, not authoritative docs.
- No test setup is present in `package.json`.
