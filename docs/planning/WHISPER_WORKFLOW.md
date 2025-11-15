# Whisper Optimization Workflow

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Uploads Video                                           │
│    - Click on project card                                      │
│    - Select video file (< 100MB)                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      v
┌─────────────────────────────────────────────────────────────────┐
│ 2. System Analyzes Video                                        │
│    - Extract video duration                                     │
│    - Calculate recommended model                                │
│    - Estimate processing time                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      v
┌─────────────────────────────────────────────────────────────────┐
│ 3. Settings Dialog Appears                                      │
│    ┌───────────────────────────────────────────────────────┐   │
│    │ ⚙️  Whisper Settings                                   │   │
│    │                                                         │   │
│    │ Model Selection:                                        │   │
│    │ ⚡ ( ) Tiny Mode - 3-10x faster [RECOMMENDED]         │   │
│    │   (●) Base Mode - Balanced                             │   │
│    │   ( ) Small Mode - Higher quality                      │   │
│    │   ( ) Medium Mode - Professional                       │   │
│    │                                                         │   │
│    │ Language:                                               │   │
│    │ [Auto-detect ▼]                                        │   │
│    │                                                         │   │
│    │ Estimated Time: ~30 seconds                            │   │
│    │                                                         │   │
│    │ [Cancel]  [Start Processing]                           │   │
│    └───────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      v
┌─────────────────────────────────────────────────────────────────┐
│ 4. Processing Begins                                            │
│    Status: Uploading... (0%)                                    │
│    Status: Transcribing... (50%)                                │
│    Status: Translating... (75%)                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      v
┌─────────────────────────────────────────────────────────────────┐
│ 5. Completed                                                    │
│    Status: Ready                                                │
│    - Batch Edit button available                               │
│    - Advanced Edit button available                            │
│    - Export Video button available                             │
└─────────────────────────────────────────────────────────────────┘
```

## Recommendation Logic Flow

```
Video Duration Analysis
         |
         v
┌────────────────────┐
│ duration < 2 min?  │───YES───> Recommend: TINY
└────────┬───────────┘
         │ NO
         v
┌────────────────────┐
│ duration < 10 min? │───YES───> Recommend: BASE
└────────┬───────────┘
         │ NO
         v
    Recommend: BASE
    (avoid long waits)
```

## Processing Speed Comparison

```
Video Duration: 5 minutes

┌─────────┬─────────────┬──────────────┬──────────────┐
│ Model   │ Speed       │ Process Time │ Accuracy     │
├─────────┼─────────────┼──────────────┼──────────────┤
│ Tiny    │ ████████    │ ~30 sec      │ 85-90% ⚡    │
│ Base    │ ██          │ ~2.5 min     │ 90-95% ✓     │
│ Small   │ █           │ ~5 min       │ 95-97% ✓✓    │
│ Medium  │ ▌           │ ~10 min      │ 97-99% ✓✓✓   │
└─────────┴─────────────┴──────────────┴──────────────┘

Legend:
⚡ = Fast & Good
✓ = Recommended
✓✓ = Professional
✓✓✓ = Maximum Quality
```

## Language Detection Flow

```
Language Parameter
         |
         v
┌────────────────────┐
│ language = 'auto'? │
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
   YES       NO
    │         │
    │         └──> Pass --language {code} to Whisper
    │
    └──> Omit language parameter
         (Whisper auto-detects)

Supported Languages:
- auto (default)
- zh (Chinese)
- en (English)
- ja (Japanese)
- ko (Korean)
- fr (French)
- de (German)
- es (Spanish)
- pt (Portuguese)
- ru (Russian)
- it (Italian)
- nl (Dutch)
- pl (Polish)
- tr (Turkish)
```

## Data Flow Architecture

```
┌──────────────┐
│   Frontend   │
│ (editor page)│
└──────┬───────┘
       │ POST /api/transcribe
       │ FormData:
       │  - file: File
       │  - model: 'tiny'|'base'|'small'|'medium'
       │  - language: 'auto'|'zh'|'en'|...
       v
┌──────────────┐
│  API Route   │
│   (route.ts) │
│              │
│ 1. Validate  │
│ 2. Save file │
│ 3. Queue task│
└──────┬───────┘
       │
       v
┌──────────────┐
│  Task Queue  │
│              │
│ Execute:     │
│ whisper      │
│  --model X   │
│  --language Y│
└──────┬───────┘
       │
       v
┌──────────────┐
│   Whisper    │
│   Process    │
│              │
│ Output:      │
│ .srt file    │
└──────┬───────┘
       │
       v
┌──────────────┐
│  Frontend    │
│  (displays)  │
│              │
│ - Segments   │
│ - Timeline   │
└──────────────┘
```

## Model Selection Decision Tree

```
Start: User uploads video
         |
         v
    Get duration
         |
         v
┌────────────────────────────────┐
│ Is this for quick draft/test? │
└────────┬───────────────────────┘
         │
    ┌────┴────┐
    │         │
   YES       NO
    │         │
    │         v
    │    ┌────────────────────────┐
    │    │ Need maximum accuracy? │
    │    └────────┬───────────────┘
    │             │
    │        ┌────┴────┐
    │        │         │
    │       YES       NO
    │        │         │
    │        │         v
    v        v    Use BASE
Use TINY  Use SMALL/MEDIUM

Results:
- TINY: Fast iteration, testing
- BASE: General purpose (default)
- SMALL: Professional quality
- MEDIUM: Maximum accuracy
```

## Time Estimation Formula

```
Estimated Time = Video Duration × Processing Ratio

Processing Ratios:
- Tiny:   0.1  (10% of video duration)
- Base:   0.5  (50% of video duration)
- Small:  1.0  (100% of video duration)
- Medium: 2.0  (200% of video duration)

Example (5 minute video):
- Tiny:   5 × 0.1 = 0.5 min (30 sec)
- Base:   5 × 0.5 = 2.5 min
- Small:  5 × 1.0 = 5 min
- Medium: 5 × 2.0 = 10 min

Note: Actual time varies by:
- CPU/GPU speed
- Video complexity
- Audio quality
- System load
```

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                      Editor Page                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   State Management                     │  │
│  │  - projects[]                                          │  │
│  │  - selectedWhisperModel                                │  │
│  │  - selectedWhisperLanguage                             │  │
│  │  - recommendedModel                                    │  │
│  │  - estimatedTime                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────┼─────────────────────────────┐  │
│  │                         v                             │  │
│  │              Helper Functions                         │  │
│  │  - getRecommendedModel(duration)                      │  │
│  │  - calculateEstimatedTime(duration, model)            │  │
│  │  - getVideoDuration(file)                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────┼─────────────────────────────┐  │
│  │                         v                             │  │
│  │              Event Handlers                           │  │
│  │  - handleVideoUpload()                                │  │
│  │  - handleVideoSelected()                              │  │
│  │  - confirmWhisperSettings()                           │  │
│  │  - processVideoWithSettings()                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌─────────────────────────┼─────────────────────────────┐  │
│  │                         v                             │  │
│  │                   UI Components                       │  │
│  │  - Whisper Settings Dialog                            │  │
│  │  - Model Selection Radio Buttons                      │  │
│  │  - Language Dropdown                                  │  │
│  │  - Time Estimation Display                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌──────────────┐
│   Request    │
└──────┬───────┘
       │
       v
┌──────────────┐
│  Validation  │
└──────┬───────┘
       │
       ├─> Invalid model ──> 400 Error: "Invalid model"
       │
       ├─> Invalid language ──> 400 Error: "Invalid language"
       │
       ├─> File too large ──> Alert: "File too large"
       │
       ├─> No file ──> 400 Error: "No file provided"
       │
       v
┌──────────────┐
│   Process    │
└──────┬───────┘
       │
       ├─> Upload fails ──> Status: 'error'
       │                   └─> Alert user
       │
       ├─> Whisper fails ──> Status: 'error'
       │                    └─> Show error message
       │
       v
    Success
     └─> Status: 'ready'
```

## State Transitions

```
Project Status States:

idle ──upload──> uploading ──done──> transcribing
                     │                     │
                     │                     v
                     v              translating
                  error <──fail───────┤
                     │                v
                     │             ready
                     v                │
                 (alert)          (success)
```

## Best Practices Applied

1. **Type Safety**: All parameters strongly typed
2. **Validation**: Both frontend and backend validation
3. **Error Handling**: Comprehensive error messages
4. **User Feedback**: Real-time progress updates
5. **Smart Defaults**: Intelligent recommendations
6. **Accessibility**: Keyboard navigation, ARIA labels
7. **Performance**: Non-blocking async operations
8. **Documentation**: Inline comments and external docs

## Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                    System Integration                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (React)                                        │
│    └─> State Management (useState, useEffect)           │
│        └─> API Calls (fetch)                            │
│            └─> Backend API (Next.js Route)              │
│                └─> Task Queue                           │
│                    └─> Whisper CLI                      │
│                        └─> SRT File                     │
│                            └─> Translation API          │
│                                └─> Final Output         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```
