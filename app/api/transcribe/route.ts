// app/api/transcribe/route.ts
// Async task-based Whisper transcription with real-time progress
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { taskQueue } from "@/app/lib/task-queue";
import { parseSrt } from "@/lib/parseSrt";
import { optimizeSubtitleTimings, subtitlesToSRT } from "@/lib/optimizeSubtitleTimings";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const model = (formData.get("model") as string) || "base";
    const language = (formData.get("language") as string) || "auto";
    const optimizeTimings = formData.get("optimizeTimings") === "true"; // 新增：是否优化时间轴

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate model parameter
    const validModels = ["tiny", "base", "small", "medium", "large"];
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model: ${model}. Must be one of: ${validModels.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate language parameter
    const validLanguages = ["auto", "zh", "en", "ja", "ko", "fr", "de", "es", "pt", "ru", "it", "nl", "pl", "tr"];
    if (!validLanguages.includes(language)) {
      return NextResponse.json(
        { error: `Invalid language: ${language}. Must be one of: ${validLanguages.join(", ")}` },
        { status: 400 }
      );
    }

    // Create temp directory
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save uploaded file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `video_${Date.now()}.${file.name.split(".").pop()}`;
    const filePath = path.join(tempDir, fileName);
    await fs.promises.writeFile(filePath, fileBuffer);

    // Generate task ID
    const taskId = `transcribe_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Submit task to queue (non-blocking)
    taskQueue.submitTask(taskId, {
      execute: async () => {
        return await executeWhisperTask(filePath, tempDir, fileName, model, language, taskId, optimizeTimings);
      },
    });

    // Return task ID immediately
    return NextResponse.json({
      taskId,
      status: "queued",
      message: "Transcription task queued",
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Execute Whisper transcription with progress tracking
 */
/**
 * Find the Python executable path (cached after first lookup)
 */
let cachedPythonPath: string | null = null;

function findPythonPath(): string {
  if (cachedPythonPath) return cachedPythonPath;

  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python313", "python.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "python.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe"),
    "python",
    "python3",
  ];

  for (const p of candidates) {
    try {
      if (p.includes(path.sep) && fs.existsSync(p)) {
        cachedPythonPath = p;
        return p;
      }
    } catch { /* skip */ }
  }

  // Fallback to bare command, let spawn resolve it
  cachedPythonPath = candidates[candidates.length - 2];
  return cachedPythonPath;
}

/**
 * Execute faster-whisper transcription with progress tracking
 */
async function executeWhisperTask(
  filePath: string,
  tempDir: string,
  fileName: string,
  model: string,
  language: string,
  taskId: string,
  optimizeTimings: boolean = false
): Promise<any> {
  return new Promise((resolve, reject) => {
    const srtFileName = `${path.basename(fileName, path.extname(fileName))}.srt`;
    const srtPath = path.join(tempDir, srtFileName);

    const pythonPath = findPythonPath();
    const scriptPath = path.join(process.cwd(), "scripts", "faster-whisper-srt.py");

    const whisperArgs = [
      scriptPath,
      filePath,
      "--model", model,
      "--language", language,
      "--output_dir", tempDir,
    ];

    console.log(`Starting faster-whisper: model=${model}, language=${language}`);
    console.log(`Command: ${pythonPath} ${whisperArgs.join(' ')}`);
    console.log(`Expected SRT: ${srtPath}`);

    const whisper = spawn(pythonPath, whisperArgs);

    let stderrData = "";

    whisper.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      stderrData += output;

      // Parse progress from faster-whisper output
      // Format: [MM:SS.mmm -->] text
      const progressMatch = output.match(/\[(\d{2}):(\d{2})\.(\d{3})\s*-->\]/);
      if (progressMatch) {
        const minutes = parseInt(progressMatch[1]);
        const seconds = parseInt(progressMatch[2]);
        const currentTime = minutes * 60 + seconds;

        const estimatedProgress = Math.min(95, (currentTime / 300) * 100);
        taskQueue.updateProgress(
          taskId,
          estimatedProgress,
          `Processing: ${minutes}:${progressMatch[2]}`
        );
      }
    });

    whisper.on("close", async (code) => {
      console.log(`faster-whisper exited with code ${code}`);

      if (code === 0) {
        if (fs.existsSync(srtPath)) {
          let srtContent = fs.readFileSync(srtPath, "utf-8");
          console.log(`SRT file found, length: ${srtContent.length}`);

          if (optimizeTimings) {
            try {
              console.log(`Optimizing subtitle timings...`);
              taskQueue.updateProgress(taskId, 96, "正在優化字幕時間軸...");

              const subtitles = parseSrt(srtContent);
              const optimizedSubtitles = await optimizeSubtitleTimings(subtitles, filePath, {
                silenceThreshold: -30,
                minSilenceDuration: 0.3,
                maxAdjustment: 0.5,
              });

              srtContent = subtitlesToSRT(optimizedSubtitles);
              taskQueue.updateProgress(taskId, 99, "優化完成");
            } catch (error) {
              console.error(`Subtitle optimization failed, using original:`, error);
            }
          }

          resolve({
            videoUrl: `/temp/${fileName}`,
            srtContent: srtContent,
            status: "completed",
          });
        } else {
          console.error(`SRT file NOT found at: ${srtPath}`);
          console.error(`stderr:`, stderrData);
          reject(new Error("SRT file not generated"));
        }
      } else {
        console.error("faster-whisper stderr:", stderrData);
        reject(new Error(`faster-whisper exited with code ${code}: ${stderrData.slice(-500)}`));
      }
    });

    whisper.on("error", (error) => {
      console.error("Spawn error:", error);
      if (error.message.includes('ENOENT')) {
        reject(new Error("Python 未找到。請確認 Python 已安裝並包含 faster-whisper 套件。"));
      } else {
        reject(error);
      }
    });
  });
}
