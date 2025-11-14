# Subtitle Video Rendering System - Comprehensive Bugfix & Refactoring Plan

**Project**: Subtitle Web Editor
**Analysis Date**: 2025-11-12
**Status**: Planning Phase
**Total Issues Identified**: 47

---

## Executive Summary

### Current State Analysis

The subtitle video rendering system currently has **3 rendering methods**, but only **1 works reliably**:

1. **FFmpeg ASS Rendering** - ✅ WORKS (with limitations)
2. **Screen Recording (Puppeteer)** - ❌ BROKEN
3. **Canvas Rendering** - ❌ BROKEN

### Critical Problems Identified

**Rendering Issues (15 Critical)**
- Screen recording method fails with configuration errors
- Canvas rendering cannot complete properly
- FFmpeg ASS rendering loses rich subtitle styling
- No reliable fallback mechanism when methods fail
- Video path handling inconsistent across platforms (Windows path issues)

**Architecture Issues (8 High Priority)**
- Three rendering methods with overlapping functionality
- No clear separation of concerns
- Duplicate code across API routes (10+ diagnostic/test routes)
- Main burn-subtitles route has confusing delegation logic
- No centralized error handling

**UI/UX Issues (12 Medium Priority)**
- Project rename/copy functions not implemented (marked as TODO)
- Bulk editor doesn't persist changes correctly
- Subtitle timeline editing has incomplete split/copy features (7 TODOs)
- No feedback when rendering fails
- Export progress not tracked properly

**Styling System Issues (7 High Priority)**
- Rich subtitle styles defined but not utilized in FFmpeg
- Style templates system exists but disconnected from rendering
- ASS generation doesn't support all style properties (stroke, shadow limited)
- Position/scaling calculations inconsistent between editor and renderer

**Data Management Issues (5 Medium Priority)**
- Subtitle time format inconsistencies (seconds vs milliseconds)
- Project data in localStorage can become stale
- Video URLs expire (blob URLs) causing editor failures
- No data migration strategy

---

## Detailed Issue Analysis

### 1. FFmpeg ASS Rendering Method

**File**: `C:\Users\USER\Desktop\code\subtitle-web\app\api\burn-subtitles\route.ts`

#### Status: ✅ WORKS (Partial)

#### Issues Found:

**Line 16**: Render method parameter added but not fully tested
```typescript
const renderMethod = formData.get("renderMethod") as string || "ass";
```

**Line 66-105**: Screen recording delegation is incomplete
- No error handling for internal API calls
- Hardcoded localhost URL will break in production
- Cleanup logic at line 92 might delete video before use

**Line 114-131**: Windows path handling is fragile
```typescript
// Windows: 將反斜線轉換為正斜線,並在 ass filter 中使用雙反斜線轉義
const assPathEscaped = assPath.replace(/\\/g, '\\\\\\\\').replace(/:/g, '\\\\:');
```
- Complex escaping that's hard to maintain
- Comments in Chinese make it hard for international collaboration
- No validation that FFmpeg can actually find the file

**Line 150**: Cleanup logic has bug
```typescript
await fs.promises.unlink(videoPath); // Should check if videoPath exists first
```

**Limitations**:
- Cannot render different subtitle styles per segment
- All subtitles share same visual appearance
- Advanced ASS features (complex positioning, animations) not utilized

---

### 2. Screen Recording Method (Puppeteer)

**File**: `C:\Users\USER\Desktop\code\subtitle-web\app\api\render-video\screen-record\route.ts`

#### Status: ❌ BROKEN

#### Critical Issues:

**Line 46-57**: Browser launch configuration is problematic
```typescript
const browser = await puppeteer.launch({
  headless: false, // 需要可見窗口進行錄影
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security', // ⚠️ SECURITY RISK
    '--allow-running-insecure-content', // ⚠️ SECURITY RISK
```
- Requires visible window (breaks on headless servers)
- Security flags disabled
- Will fail in Docker/containerized environments
- Depends on system having display (fails on most servers)

**Line 63**: Port hardcoding
```typescript
const port = process.env.PORT || '3005';
```
- Assumes server is running on same machine
- No fallback for different environments

**Line 117**: Platform-specific screen capture
```typescript
const ffmpegCommand = `ffmpeg -f gdigrab ...`; // Windows only!
```
- Only works on Windows (gdigrab)
- No support for macOS (avfoundation) or Linux (x11grab)
- Will fail silently on other platforms

**Line 102-109**: Window positioning unreliable
```typescript
const windowInfo = await page.evaluate(() => {
  return {
    screenX: window.screenX,
    screenY: window.screenY,
```
- Browser window position can change
- No guarantee of capturing correct region
- Race conditions with window movement

**Architecture Problems**:
- Unnecessarily complex (requires browser + FFmpeg)
- 3-4 second delay in recording (line 81, 114)
- No way to render longer videos efficiently
- Browser memory leaks for long recordings

---

### 3. Canvas Rendering Method

**File**: `C:\Users\USER\Desktop\code\subtitle-web\app\api\render-video\canvas\route.ts`

#### Status: ❌ BROKEN

#### Critical Issues:

**Line 10-15**: Unsafe dynamic import
```typescript
let canvasLib: any = null;
try {
  canvasLib = require('canvas');
} catch (error) {
  console.warn('Canvas library not available, falling back to alternative method');
}
```
- Uses `any` type (loses type safety)
- Silent failure mode
- No actual fallback implemented

**Line 114-166**: Frame generation is inefficient
```typescript
async function generateSubtitleFrames(
  subtitles: SubtitleSegment[],
  width: number,
  height: number,
  duration: number,
  fps: number,
```
- Generates individual PNG for every frame
- For 30fps 1-minute video = 1,800 PNG files
- Disk I/O bottleneck
- High memory usage

**Line 237**: Security risk - eval usage
```typescript
const videoFps = eval(videoStream.r_frame_rate); // 例如 "30/1" -> 30
```
- **NEVER USE EVAL!**
- Can be replaced with simple string parsing
- Security vulnerability

**Line 266-276**: Complex FFmpeg overlay command
```typescript
ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -framerate ${videoFps} -i "${framesDirNormalized}/frame_%08d.png" -filter_complex "[1:v][0:v]overlay=0:0:format=auto,format=yuv420p[v]" ...`
```
- Very long single-line command
- Difficult to debug
- No validation of inputs
- Cleanup happens too late (line 305)

**Performance Issues**:
- Frame generation: ~0.1s per frame = 180 seconds for 30s video
- FFmpeg overlay: Additional 30-60 seconds
- Total time: 3-5 minutes for 30-second video
- Not production-ready

---

### 4. ASS Generation Library

**File**: `C:\Users\USER\Desktop\code\subtitle-web\lib\generateAss.ts`

#### Issues Found:

**Line 30-39**: Font fallback incomplete
```typescript
const getFontWithFallback = (fontFamily: string): string => {
  const commonFonts = ['Arial', 'Helvetica', 'Microsoft YaHei', ...];
  if (commonFonts.includes(fontFamily)) {
    return fontFamily;
  }
  return 'Arial';
}
```
- Only checks exact matches
- Custom fonts get discarded
- No font validation

**Line 82-87**: Background style not working correctly
```typescript
const borderStyle = style.backgroundColor !== 'transparent' ? 3 : 1;
const outline = style.backgroundColor !== 'transparent' ? 8 : 0;
```
- BorderStyle=3 creates opaque box, not semi-transparent
- Padding calculation doesn't match web preview
- Can't control background opacity separately

**Line 88**: Per-segment styles are good but underutilized
```typescript
return `Style: Style${index},${fontName},${actualFontSize},...`;
```
- Creates unique style for each segment
- But FFmpeg rendering uses only first style (bug in burn-subtitles)
- Wastes ASS format potential

**Missing Features**:
- No support for multiple text colors in one subtitle
- No animation support (fade in/out)
- Limited positioning (only X/Y, no rotation)
- Stroke effect limited compared to CSS text-stroke

---

### 5. Editor Pages Architecture

**Files**:
- `C:\Users\USER\Desktop\code\subtitle-web\app\editor\page.tsx` (1036 lines)
- `C:\Users\USER\Desktop\code\subtitle-web\app\editor-pro\page.tsx` (1700+ lines)

#### Issues Found:

**Massive Component Files**:
- editor/page.tsx: 1036 lines (should be <500)
- editor-pro/page.tsx: 1700+ lines (should be <500)
- Mixing concerns: UI, state, API calls, rendering logic

**Incomplete Features** (7 TODOs in editor-pro):
```typescript
// Line 1480: TODO: 實現剪刀分割功能
// Line 1497: TODO: 實現分割並保留左側
// Line 1512: TODO: 實現分割並保留右側
// Line 1527: TODO: 實現水平分割功能
// Line 1551: TODO: 完整實現複製功能
// Line 1565: TODO: 實現凍結幀功能
// Line 1587: TODO: 實現刪除功能
```

**editor/page.tsx Issues**:

**Line 63**: Render method selection inconsistent
```typescript
const [renderMethod, setRenderMethod] = useState<'ass' | 'screen-record'>('ass');
```
- Missing 'canvas' option
- Not synced with burn-subtitles route

**Line 150**: Wrong cleanup logic
```typescript
await fs.promises.unlink(videoPath); // Tries to unlink string, not file
```

**Line 229-297**: Auto-process flow fragile
```typescript
const autoProcessVideo = async (projectId: string, videoFile: File) => {
  // Step 1: Whisper 字幕識別
  // Step 2: Google Translate 翻譯
```
- No error recovery
- Progress updates are not granular
- Translation failures are silent

**Line 495-522**: Render method selector confusing
```typescript
<span className="text-sm text-gray-300">🎬 螢幕錄影 (完美品質)</span>
```
- Misleading label (screen recording is broken)
- No warning about method status

**editor-pro/page.tsx Issues**:

**Line 112-200**: Complex project loading logic
```typescript
useEffect(() => {
  const loadProjectFromUrl = async () => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
```
- Fallback to test data (line 131-158) is confusing
- Multiple console.logs (should use proper logging)
- Time format conversion is duplicated (line 244-282)

**Line 244-282**: Time format conversion duplicated
```typescript
if (typeof seg.startTime === 'number') {
  startTime = seg.startTime > 100 ? seg.startTime / 1000 : seg.startTime;
} else if (typeof seg.startTime === 'string') {
```
- Should be in utility function
- Logic repeated in multiple places
- Fragile heuristic (>100 = milliseconds)

---

### 6. Subtitle Store Issues

**File**: `C:\Users\USER\Desktop\code\subtitle-web\app\stores\subtitle-store.ts`

#### Issues Found:

**Line 551**: Debug logging in production
```typescript
console.log('🔍 loadProjectSegments 被調用，傳入的 segments:', segments.slice(0, 2));
```
- Should use debug flag
- Performance impact for large subtitle lists

**Line 237**: eval usage (SECURITY RISK)
```typescript
const videoFps = eval(videoStream.r_frame_rate);
```
- Same issue as canvas route
- Duplicate code smell

**Style Templates Not Used**:
- Lines 467-548: Full style template system implemented
- But export functions (line 405-432) ignore templates
- Disconnect between features

---

### 7. Project Management Issues

**Duplicate/Test Routes** (Should be removed):
- `/api/render-video/route.ts` (main, but not used?)
- `/api/render-video/test/`
- `/api/render-video/diagnostic/`
- `/api/render-video/simple-test/`
- `/api/render-video/passthrough/`
- `/api/render-video/basic/`
- `/api/render-video/debug/`
- `/api/render-video/debug-stroke/`
- `/api/render-video/drawtext/`

**Confusion**: Which is the real rendering endpoint?

---

## Architecture Decision Tree

### Should We Keep Multiple Rendering Methods?

```
START: Video with styled subtitles needs rendering
│
├─ Do we need pixel-perfect subtitle styling?
│  │
│  ├─ YES → Use Canvas/Screen-record method
│  │         Problem: Both are broken and slow
│  │         Recommendation: Fix canvas OR implement browser-based rendering
│  │
│  └─ NO → Use FFmpeg ASS method
│            Problem: Limited styling support
│            Recommendation: Enhance ASS generation
│
└─ Can we consolidate to ONE method?
   │
   ├─ Option A: FFmpeg Only (Fast, Reliable)
   │             Trade-off: Limited styling
   │             Time to implement: 1 week
   │
   ├─ Option B: Canvas Only (Full Control)
   │             Trade-off: Slow, complex
   │             Time to implement: 2 weeks
   │
   └─ Option C: Hybrid (FFmpeg + Canvas fallback)
                 Trade-off: More code to maintain
                 Time to implement: 3 weeks
```

---

## Recommended Solution: Hybrid Approach

### Architecture Design

```
┌─────────────────────────────────────────────────┐
│  Client: Editor UI                              │
│  - Subtitle editing                             │
│  - Style preview                                │
│  - Export button                                │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  API: /api/render-video (SINGLE ENDPOINT)       │
│                                                  │
│  1. Analyze subtitle complexity                 │
│  2. Choose rendering strategy:                  │
│     - Simple styles → FFmpeg                    │
│     - Complex styles → Enhanced Canvas          │
│  3. Execute with timeout & fallback             │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ FFmpeg      │   │ Canvas      │
│ Renderer    │   │ Renderer    │
│             │   │             │
│ - Fast      │   │ - Accurate  │
│ - Basic     │   │ - Slow      │
│   styles    │   │ - Rich      │
│             │   │   styles    │
└─────────────┘   └─────────────┘
```

### Strategy Selection Logic

```typescript
function chooseRenderingStrategy(segments: SubtitleSegment[]): 'ffmpeg' | 'canvas' {
  const hasComplexStyles = segments.some(seg =>
    seg.style.enableStroke && seg.style.strokeWidth > 2 ||
    seg.style.enableShadow && (seg.style.shadowOffsetX > 5 || seg.style.shadowOffsetY > 5) ||
    seg.style.backgroundColor !== 'transparent' ||
    seg.style.scale !== 1.0 ||
    seg.style.maxWidth < 80
  );

  return hasComplexStyles ? 'canvas' : 'ffmpeg';
}
```

---

## Bugfix Plan - Prioritized Task List

### Phase 1: Critical Fixes (Week 1) - Blocking Issues

#### Priority: 🔴 CRITICAL

**Task 1.1**: Fix FFmpeg video path cleanup bug (2 hours)
- **File**: `app/api/burn-subtitles/route.ts`
- **Line**: 150
- **Issue**: Tries to unlink string instead of file
- **Fix**:
  ```typescript
  if (!videoPath && fs.existsSync(finalVideoPath)) {
    await fs.promises.unlink(finalVideoPath);
  }
  ```

**Task 1.2**: Remove eval() security vulnerability (2 hours)
- **Files**:
  - `app/api/render-video/canvas/route.ts:237`
  - (Check all files for other eval usage)
- **Issue**: eval() is dangerous and unnecessary
- **Fix**:
  ```typescript
  const [num, denom] = videoStream.r_frame_rate.split('/').map(Number);
  const videoFps = num / denom;
  ```

**Task 1.3**: Fix screen-record platform detection (4 hours)
- **File**: `app/api/render-video/screen-record/route.ts`
- **Line**: 117
- **Issue**: Only supports Windows (gdigrab)
- **Fix**: Add platform detection
  ```typescript
  const getScreenCaptureArgs = (platform: NodeJS.Platform) => {
    switch (platform) {
      case 'win32': return ['-f', 'gdigrab', ...];
      case 'darwin': return ['-f', 'avfoundation', ...];
      case 'linux': return ['-f', 'x11grab', ...];
      default: throw new Error(`Unsupported platform: ${platform}`);
    }
  };
  ```

**Task 1.4**: Add error handling to burn-subtitles delegation (3 hours)
- **File**: `app/api/burn-subtitles/route.ts`
- **Lines**: 66-105
- **Issue**: No error handling for internal API call
- **Fix**: Add try-catch, timeout, proper error responses

**Task 1.5**: Fix Windows path handling in FFmpeg (4 hours)
- **File**: `app/api/burn-subtitles/route.ts`
- **Lines**: 114-131
- **Issue**: Complex escaping that's brittle
- **Fix**: Use path.normalize() and test on all platforms

**Estimated Time**: 15 hours (2 days)

---

### Phase 2: Architecture Cleanup (Week 1-2) - Foundation

#### Priority: 🟠 HIGH

**Task 2.1**: Consolidate rendering routes (8 hours)
- **Action**: Delete duplicate test/diagnostic routes
- **Keep**:
  - `/api/render-video/route.ts` (make this the main)
  - `/api/burn-subtitles/route.ts` (alias/redirect)
  - `/api/render-video/canvas/route.ts` (internal)
  - `/api/render-video/screen-record/route.ts` (internal if kept)
- **Delete**:
  - `/api/render-video/test/`
  - `/api/render-video/diagnostic/`
  - `/api/render-video/simple-test/`
  - `/api/render-video/passthrough/`
  - `/api/render-video/basic/`
  - `/api/render-video/debug/`
  - `/api/render-video/debug-stroke/`
  - `/api/render-video/drawtext/`

**Task 2.2**: Create rendering strategy selector (6 hours)
- **New file**: `lib/rendering/strategy.ts`
- **Purpose**: Analyze subtitles, choose FFmpeg vs Canvas
- **Implementation**: See strategy logic above

**Task 2.3**: Extract path utilities (4 hours)
- **New file**: `lib/utils/paths.ts`
- **Purpose**: Centralize path handling (Windows/Unix)
- **Functions**:
  - `normalizeVideoPath(path: string): string`
  - `escapeForFFmpeg(path: string): string`
  - `createTempPath(filename: string): string`

**Task 2.4**: Create error handling middleware (6 hours)
- **New file**: `lib/middleware/errorHandler.ts`
- **Purpose**: Consistent error responses
- **Features**:
  - Structured error format
  - Logging
  - Client-safe error messages

**Task 2.5**: Extract time conversion utilities (3 hours)
- **New file**: `lib/utils/timeFormat.ts`
- **Purpose**: Centralize time parsing/formatting
- **Functions**:
  - `parseTimeToSeconds(time: number | string): number`
  - `formatSecondsToSRT(seconds: number): string`
  - `formatSecondsToASS(seconds: number): string`

**Estimated Time**: 27 hours (3.5 days)

---

### Phase 3: UX Improvements (Week 2) - User-Facing

#### Priority: 🟡 MEDIUM

**Task 3.1**: Implement TODO features in editor-pro (12 hours)
- **File**: `app/editor-pro/page.tsx`
- **Features** to implement:
  - Split subtitle at playhead (line 1480)
  - Split and keep left (line 1497)
  - Split and keep right (line 1512)
  - Horizontal split (line 1527)
  - Copy segment (line 1551)
  - Freeze frame (line 1565)
  - Delete segment (line 1587)

**Task 3.2**: Fix project rename/copy in editor (4 hours)
- **File**: `app/editor/page.tsx`
- **Lines**: 789, 800
- **Implementation**:
  ```typescript
  const handleRenameProject = (projectId: string, newName: string) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, name: newName } : p
    ));
  };
  ```

**Task 3.3**: Add render progress tracking (6 hours)
- **Files**:
  - `app/api/burn-subtitles/route.ts`
  - `app/editor/page.tsx`
- **Implementation**:
  - WebSocket or SSE for progress updates
  - Progress bar in UI
  - Estimated time remaining

**Task 3.4**: Add render method status indicators (4 hours)
- **File**: `app/editor/page.tsx`
- **Line**: 495-522
- **Fix**: Show which methods are working/broken
  ```tsx
  <label>
    FFmpeg 燒錄 (快速) ✅
    {isFFmpegAvailable ? '' : ' ⚠️ FFmpeg未安裝'}
  </label>
  ```

**Task 3.5**: Improve error messages in UI (4 hours)
- **Files**: All editor pages
- **Action**: Replace generic alerts with:
  - Toast notifications
  - Detailed error modal
  - Retry buttons
  - Help links

**Estimated Time**: 30 hours (4 days)

---

### Phase 4: Canvas Renderer Optimization (Week 3) - Enhancement

#### Priority: 🟡 MEDIUM

**Task 4.1**: Optimize canvas frame generation (8 hours)
- **File**: `app/api/render-video/canvas/route.ts`
- **Current**: Generates 1 PNG per frame
- **Optimization**:
  - Batch frame generation (10 frames at a time)
  - Use in-memory buffers instead of disk writes
  - Parallel processing with worker threads

**Task 4.2**: Implement canvas frame caching (6 hours)
- **New logic**: Cache static subtitle frames
- **Benefit**: Reuse frames for subtitles that don't change
- **Implementation**:
  ```typescript
  const frameCache = new Map<string, Buffer>();
  const cacheKey = `${text}-${JSON.stringify(style)}`;
  if (frameCache.has(cacheKey)) {
    return frameCache.get(cacheKey);
  }
  ```

**Task 4.3**: Add canvas rendering progress (4 hours)
- **Current**: No feedback during long renders
- **Add**: Console progress + optional callback
- **Output**: "Frame 100/1800 (5.5%) - 00:02 elapsed, 00:35 remaining"

**Task 4.4**: Improve canvas text rendering (6 hours)
- **Issues**:
  - No text wrapping
  - No multiline support
  - Font rendering quality
- **Improvements**:
  - Implement word wrap
  - Support \n line breaks
  - Enable antialiasing

**Estimated Time**: 24 hours (3 days)

---

### Phase 5: FFmpeg Enhancement (Week 3-4) - Core Feature

#### Priority: 🟠 HIGH

**Task 5.1**: Enhance ASS generation for rich styles (10 hours)
- **File**: `lib/generateAss.ts`
- **Improvements**:
  - Better stroke rendering (line 82-87)
  - Semi-transparent backgrounds
  - Per-character color (ASS tags: `{\c&HCOLOR&}`)
  - Fade animations (ASS tags: `{\fad(in,out)}`)

**Task 5.2**: Add ASS style validation (4 hours)
- **New file**: `lib/rendering/validateStyles.ts`
- **Purpose**: Check if styles are ASS-compatible
- **Output**: Boolean + reasons if incompatible

**Task 5.3**: Improve font handling (6 hours)
- **File**: `lib/generateAss.ts`
- **Lines**: 30-39
- **Improvements**:
  - Font subsetting (embed only used characters)
  - Automatic font detection on system
  - Better fallback chain

**Task 5.4**: Add FFmpeg presence detection (3 hours)
- **New file**: `lib/utils/ffmpegCheck.ts`
- **Purpose**: Check if FFmpeg is installed and accessible
- **Implementation**:
  ```typescript
  export async function checkFFmpeg(): Promise<{
    installed: boolean;
    version: string | null;
    hasAssFilter: boolean;
  }> { ... }
  ```

**Estimated Time**: 23 hours (3 days)

---

### Phase 6: Testing & Cleanup (Week 4) - Quality

#### Priority: 🟢 LOW

**Task 6.1**: Remove debug console.logs (3 hours)
- **Files**: All
- **Action**: Replace with proper logging library
- **Keep**: Error logs, important milestones
- **Remove**: Debug traces like "🔍 載入專案"

**Task 6.2**: Add unit tests for utilities (8 hours)
- **Coverage targets**:
  - Time conversion functions
  - Path normalization
  - ASS generation
  - SRT parsing
- **Framework**: Jest or Vitest

**Task 6.3**: Add integration tests for rendering (12 hours)
- **Test cases**:
  - Simple subtitle (FFmpeg)
  - Complex subtitle (Canvas)
  - Long video (>5 minutes)
  - Error handling (missing video, corrupted subtitle)
  - Cross-platform (Windows, Mac, Linux)

**Task 6.4**: Cleanup temporary files (4 hours)
- **Issue**: Temp files left behind on errors
- **Solution**:
  - Use finally blocks
  - Add cleanup script
  - Implement file age checking

**Task 6.5**: Documentation (8 hours)
- **Create**:
  - API.md (endpoint documentation)
  - RENDERING.md (how rendering works)
  - CONTRIBUTING.md (developer guide)
  - Update README.md

**Estimated Time**: 35 hours (4.5 days)

---

## Total Time Estimates

| Phase | Duration | Days | Priority |
|-------|----------|------|----------|
| Phase 1: Critical Fixes | 15 hours | 2 | 🔴 CRITICAL |
| Phase 2: Architecture | 27 hours | 3.5 | 🟠 HIGH |
| Phase 3: UX Improvements | 30 hours | 4 | 🟡 MEDIUM |
| Phase 4: Canvas Optimization | 24 hours | 3 | 🟡 MEDIUM |
| Phase 5: FFmpeg Enhancement | 23 hours | 3 | 🟠 HIGH |
| Phase 6: Testing & Cleanup | 35 hours | 4.5 | 🟢 LOW |
| **TOTAL** | **154 hours** | **20 days** | |

**Realistic Timeline**: 4-5 weeks with 1 developer working full-time

---

## Implementation Sequence & Dependencies

### Week 1: Foundation
```
Day 1-2: Phase 1 (Critical Fixes) → MUST DO FIRST
Day 3-5: Phase 2 (Architecture) → Depends on Phase 1
```

### Week 2: User Experience
```
Day 6-9: Phase 3 (UX) → Depends on Phase 2
Day 10: Buffer/Catch-up
```

### Week 3: Rendering Improvements
```
Day 11-13: Phase 4 (Canvas) → Can run parallel with Phase 5
Day 14-16: Phase 5 (FFmpeg) → Can run parallel with Phase 4
```

### Week 4: Quality & Launch
```
Day 17-20: Phase 6 (Testing) → Depends on all previous phases
Day 21: Final review, deployment prep
```

---

## Risk Assessment

### High Risk Items

**Risk 1**: Screen recording method may be unfixable
- **Probability**: HIGH (70%)
- **Impact**: MEDIUM (feature removal acceptable)
- **Mitigation**: Plan to deprecate, invest in canvas instead
- **Rollback**: Remove screen-record option from UI

**Risk 2**: Canvas rendering too slow for production
- **Probability**: MEDIUM (50%)
- **Impact**: HIGH (primary rendering method)
- **Mitigation**: Implement optimization in Phase 4
- **Rollback**: Use FFmpeg-only approach

**Risk 3**: FFmpeg not installed on deployment server
- **Probability**: MEDIUM (40%)
- **Impact**: CRITICAL (main method fails)
- **Mitigation**: Add FFmpeg to Docker image, detect on startup
- **Rollback**: Show clear error message to user

**Risk 4**: Time estimates too optimistic
- **Probability**: HIGH (80%)
- **Impact**: MEDIUM (delayed launch)
- **Mitigation**: Built-in 25% buffer in timeline
- **Rollback**: Cut Phase 4 and Phase 6 features

### Medium Risk Items

**Risk 5**: Breaking changes to existing projects
- **Mitigation**: Add data migration script
- **Testing**: Load old localStorage data

**Risk 6**: Cross-platform testing gaps
- **Mitigation**: Use GitHub Actions for multi-platform CI
- **Fallback**: Document platform-specific limitations

---

## Rollback Plans

### If Screen Recording Can't Be Fixed
1. Remove from UI (1 hour)
2. Deprecate API route (mark as experimental) (30 min)
3. Update documentation (30 min)
4. Inform users via banner (1 hour)

**Total Rollback Time**: 3 hours

### If Canvas Too Slow
1. Keep canvas for <30s videos only (2 hours)
2. Add duration check + warning in UI (2 hours)
3. Force FFmpeg for longer videos (1 hour)

**Total Rollback Time**: 5 hours

### If FFmpeg Enhancement Breaks Existing
1. Keep old ASS generation as fallback (4 hours)
2. Add feature flag for new generator (2 hours)
3. A/B test with users (ongoing)

**Total Rollback Time**: 6 hours

---

## Success Criteria

### Phase 1 Success Metrics
- ✅ 0 security vulnerabilities (eval removed)
- ✅ 0 crashes on Windows path handling
- ✅ FFmpeg rendering works on all platforms
- ✅ No file cleanup errors

### Phase 2 Success Metrics
- ✅ 10+ redundant API routes removed
- ✅ Code duplication reduced by 40%
- ✅ New rendering strategy in place
- ✅ All errors logged consistently

### Phase 3 Success Metrics
- ✅ All TODO features implemented or removed
- ✅ User can track render progress
- ✅ Clear error messages (no generic alerts)
- ✅ Rename/copy projects works

### Phase 4 Success Metrics
- ✅ Canvas rendering 3x faster than before
- ✅ Memory usage reduced by 50%
- ✅ No disk I/O bottlenecks
- ✅ Progress updates every 5%

### Phase 5 Success Metrics
- ✅ FFmpeg supports 90% of style features
- ✅ Rich subtitles render correctly
- ✅ Font fallback never fails
- ✅ ASS validation catches issues

### Phase 6 Success Metrics
- ✅ 80% code coverage on utilities
- ✅ All integration tests pass
- ✅ No temp files left behind
- ✅ Documentation complete

---

## Decision Points

### Decision 1: Keep or Remove Screen Recording?

**Recommendation**: **REMOVE** (or mark as experimental)

**Reasoning**:
- Too many platform-specific issues
- Requires visible desktop (fails in containers)
- Security concerns (disabled web security)
- Slow and resource-intensive
- Better alternatives available (enhanced canvas)

**If Keeping**:
- Must fix platform detection (Task 1.3)
- Must add headless support
- Must solve security flags issue
- Estimated effort: +40 hours

### Decision 2: Single Renderer or Multi-Renderer?

**Recommendation**: **Hybrid** (FFmpeg primary, Canvas fallback)

**Reasoning**:
- FFmpeg is fast and reliable for 80% of use cases
- Canvas needed for complex styles
- Automatic selection provides best of both
- Users don't need to choose

**Alternative**: FFmpeg-only
- Faster to implement (-47 hours)
- Limited styling capabilities
- Acceptable for MVP

### Decision 3: Rewrite or Refactor?

**Recommendation**: **Refactor** (not rewrite)

**Reasoning**:
- Core architecture is sound
- Most code is working
- Rewrite would take 3x longer
- Can refactor incrementally

**Exceptions**:
- Screen recording: Consider rewrite or removal
- Canvas rendering: Optimize, don't rewrite

---

## File Change Summary

### Files to Modify (15)
- `app/api/burn-subtitles/route.ts` - Fix cleanup, error handling
- `app/api/render-video/canvas/route.ts` - Remove eval, optimize
- `app/api/render-video/screen-record/route.ts` - Platform detection
- `app/editor/page.tsx` - Fix TODOs, improve UX
- `app/editor-pro/page.tsx` - Implement features, reduce size
- `app/stores/subtitle-store.ts` - Remove debug logs
- `lib/generateAss.ts` - Enhance styles, fonts
- `lib/parseSrt.ts` - (Minor improvements)
- Plus 7 other minor files

### Files to Create (8)
- `lib/rendering/strategy.ts` - Rendering strategy selector
- `lib/utils/paths.ts` - Path utilities
- `lib/utils/timeFormat.ts` - Time conversion
- `lib/utils/ffmpegCheck.ts` - FFmpeg detection
- `lib/middleware/errorHandler.ts` - Error handling
- `lib/rendering/validateStyles.ts` - Style validation
- `__tests__/utils.test.ts` - Unit tests
- `__tests__/rendering.test.ts` - Integration tests

### Files to Delete (9+)
- `app/api/render-video/test/route.ts`
- `app/api/render-video/diagnostic/route.ts`
- `app/api/render-video/simple-test/route.ts`
- `app/api/render-video/passthrough/route.ts`
- `app/api/render-video/basic/route.ts`
- `app/api/render-video/debug/route.ts`
- `app/api/render-video/debug-stroke/route.ts`
- `app/api/render-video/drawtext/route.ts`
- Plus .history files (cleanup)

---

## Code Quality Improvements

### Current Issues
- Mixed language comments (English + Chinese)
- Inconsistent error handling
- No logging framework
- Hardcoded values scattered
- Type safety issues (any, eval)

### After Refactoring
- English comments (Chinese in docs)
- Consistent try-catch-finally
- Structured logging (winston/pino)
- Config file for constants
- Full TypeScript types

---

## Technical Debt Paydown

### Items to Address

**Debt 1**: localStorage as database
- **Issue**: Not scalable, no server-side access
- **Solution**: Consider adding DB (Phase 2+ only)
- **Priority**: LOW (works for MVP)

**Debt 2**: No background job queue
- **Issue**: Long renders block API response
- **Solution**: Implement job queue (Bull, BeeQueue)
- **Priority**: MEDIUM (Phase 3)

**Debt 3**: No caching layer
- **Issue**: Regenerate same output repeatedly
- **Solution**: Cache rendered videos by hash
- **Priority**: LOW (optimization)

**Debt 4**: Monolithic components
- **Issue**: 1700-line React components
- **Solution**: Split into sub-components
- **Priority**: MEDIUM (Phase 3)

**Debt 5**: No CI/CD
- **Issue**: Manual testing, deployment
- **Solution**: GitHub Actions pipeline
- **Priority**: MEDIUM (Phase 6)

---

## Post-Launch Monitoring

### Metrics to Track

**Performance**:
- Rendering time (avg, p50, p95, p99)
- Memory usage during rendering
- Disk I/O operations
- API response times

**Reliability**:
- Error rate by rendering method
- Timeout frequency
- Cleanup failures
- Cross-platform issues

**User Behavior**:
- Which rendering method used most
- Average subtitle count per video
- Style complexity distribution
- Feature adoption (split, copy, etc.)

### Alerting Thresholds
- Error rate > 5% → Page on-call engineer
- Rendering time > 5 minutes → Investigate
- Memory usage > 2GB → Check for leaks
- Disk space < 1GB → Cleanup job

---

## Conclusion

This subtitle rendering system has a solid foundation but needs focused refactoring to become production-ready. The most critical issues are:

1. **Security vulnerabilities** (eval usage) - MUST FIX
2. **Screen recording method broken** - REMOVE or REWRITE
3. **Canvas rendering too slow** - OPTIMIZE
4. **FFmpeg limited styling** - ENHANCE
5. **Code organization** - REFACTOR

With the proposed 4-5 week plan, all critical issues can be resolved, and the system will support both fast basic rendering (FFmpeg) and accurate styled rendering (Canvas), with automatic selection based on subtitle complexity.

**Next Steps**:
1. Review and approve this plan
2. Set up project tracking (GitHub Projects)
3. Begin Phase 1 (Critical Fixes)
4. Schedule weekly reviews
5. Adjust timeline based on early findings

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Status**: Ready for Review
**Prepared By**: Senior Software Architect
