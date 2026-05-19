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

    // Build Whisper command arguments
    const whisperArgs = [
      filePath,
      "--model",
      model,
      "--output_format",
      "srt",
      "--output_dir",
      tempDir,
      "--verbose",
      "True",
      "--word_timestamps",
      "True",
      // 优化 VAD 和时间戳精度
      "--condition_on_previous_text",
      "True",
      "--initial_prompt",
      "", // 空提示以提高准确性
    ];

    // Add language parameter (skip for 'auto' to let Whisper auto-detect)
    if (language !== "auto") {
      whisperArgs.push("--language", language);
    }

    console.log(`Starting Whisper: model=${model}, language=${language}`);
    console.log(`Whisper command: whisper ${whisperArgs.join(' ')}`);
    console.log(`Input file: ${filePath}`);
    console.log(`Output directory: ${tempDir}`);
    console.log(`Expected SRT: ${srtPath}`);

    // Use spawn instead of exec for real-time output
    const whisper = spawn("whisper", whisperArgs);

    let stderrData = "";

    // Parse Whisper progress from stderr
    whisper.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      stderrData += output;

      // Parse progress from Whisper output
      // Example: "[00:01.000 --> 00:05.000]  Processing..."
      const progressMatch = output.match(/\[(\d{2}):(\d{2})\.(\d{3})\s*-->/);
      if (progressMatch) {
        const minutes = parseInt(progressMatch[1]);
        const seconds = parseInt(progressMatch[2]);
        const currentTime = minutes * 60 + seconds;

        // Estimate progress (assume ~5 min video = 100%)
        // This is a rough estimate, adjust based on actual video duration
        const estimatedProgress = Math.min(95, (currentTime / 300) * 100);
        taskQueue.updateProgress(
          taskId,
          estimatedProgress,
          `Processing: ${minutes}:${progressMatch[2]}`
        );
      }
    });

    whisper.on("close", async (code) => {
      console.log(`Whisper process exited with code ${code}`);
      console.log(`Expected SRT path: ${srtPath}`);

      if (code === 0) {
        // Success - check for SRT file
        console.log(`Checking if SRT file exists at: ${srtPath}`);

        // List all files in temp directory for debugging
        const filesInTemp = fs.readdirSync(tempDir);
        console.log(`Files in temp directory:`, filesInTemp);

        if (fs.existsSync(srtPath)) {
          let srtContent = fs.readFileSync(srtPath, "utf-8");
          console.log(`✅ SRT file found, length: ${srtContent.length}`);

          // 如果启用了时间轴优化
          if (optimizeTimings) {
            try {
              console.log(`🔧 开始优化字幕时间轴...`);
              taskQueue.updateProgress(taskId, 96, "正在优化字幕时间轴...");

              // 解析 SRT
              const subtitles = parseSrt(srtContent);
              console.log(`📝 解析了 ${subtitles.length} 个字幕`);

              // 优化时间轴
              const optimizedSubtitles = await optimizeSubtitleTimings(subtitles, filePath, {
                silenceThreshold: -30,
                minSilenceDuration: 0.3,
                maxAdjustment: 0.5,
              });

              // 转换回 SRT
              srtContent = subtitlesToSRT(optimizedSubtitles);
              console.log(`✅ 字幕时间轴优化完成`);

              taskQueue.updateProgress(taskId, 99, "优化完成");
            } catch (error) {
              console.error(`⚠️ 字幕优化失败，使用原始字幕:`, error);
              // 优化失败时继续使用原始字幕
            }
          }

          resolve({
            videoUrl: `/temp/${fileName}`,
            srtContent: srtContent,
            status: "completed",
          });
        } else {
          console.error(`❌ SRT file NOT found at expected path: ${srtPath}`);
          console.error(`Whisper stderr output:`, stderrData);
          reject(new Error("SRT file not generated"));
        }
      } else {
        // Error
        console.error("Whisper stderr:", stderrData);
        reject(new Error(`Whisper exited with code ${code}`));
      }
    });

    whisper.on("error", (error) => {
      console.error("Whisper spawn error:", error);
      if (error.message.includes('ENOENT')) {
        reject(new Error("Whisper 未安裝。請執行: pip install openai-whisper"));
      } else {
        reject(error);
      }
    });
  });
}
