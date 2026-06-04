import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    console.log("🚀 Starting render-video diagnostic...");

    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const videoPath = formData.get("videoPath") as string;
    const subtitlesJson = formData.get("subtitles") as string;

    console.log("📝 Request data:", {
      hasVideoFile: !!videoFile,
      videoPath,
      subtitlesLength: subtitlesJson ? JSON.parse(subtitlesJson).length : 0
    });

    if ((!videoFile && !videoPath) || !subtitlesJson) {
      console.log("❌ Missing required data");
      return NextResponse.json(
        { error: "Missing video or subtitles" },
        { status: 400 }
      );
    }

    // 測試 FFmpeg 是否可用
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      console.log("✅ FFmpeg is available:", stdout.split('\n')[0]);
    } catch (ffmpegError) {
      console.log("❌ FFmpeg not available:", ffmpegError);
      return NextResponse.json(
        { error: "FFmpeg not found", details: "Please install FFmpeg" },
        { status: 500 }
      );
    }

    const subtitles = JSON.parse(subtitlesJson);
    console.log("📊 Subtitles parsed:", subtitles.length, "segments");

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("📁 Created temp directory");
    }

    let finalVideoPath: string;

    if (videoPath) {
      finalVideoPath = path.join(tempDir, videoPath);
      console.log("🎥 Using existing video path:", finalVideoPath);
      
      if (!fs.existsSync(finalVideoPath)) {
        console.log("❌ Video file not found:", finalVideoPath);
        return NextResponse.json(
          { error: "Video file not found", path: finalVideoPath },
          { status: 404 }
        );
      }
    } else {
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      const videoFileName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;
      finalVideoPath = path.join(tempDir, videoFileName);
      await fs.promises.writeFile(finalVideoPath, videoBuffer);
      console.log("💾 Saved new video file:", finalVideoPath);
    }

    // 創建簡單的 SRT 字幕用於測試
    const srtContent = subtitles.map((seg: any, index: number) => {
      const startTime = formatSrtTime(seg.startTime);
      const endTime = formatSrtTime(seg.endTime);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    }).join('\n');

    const srtFileName = `test_subtitle_${Date.now()}.srt`;
    const srtPath = path.join(tempDir, srtFileName);
    await fs.promises.writeFile(srtPath, srtContent, "utf-8");
    console.log("📝 Created SRT file:", srtPath);

    // 輸出檔案路徑
    const outputFileName = `test_output_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("🔄 Starting FFmpeg processing...");

    // 使用最簡單的 FFmpeg 命令進行測試
    let ffmpegCommand: string;
    
    if (process.platform === 'win32') {
      const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
      const outputPathNormalized = outputPath.replace(/\\/g, '/');
      const srtPathNormalized = srtPath.replace(/\\/g, '/');
      
      ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -vf "subtitles=${srtPathNormalized}" -c:v libx264 -c:a copy "${outputPathNormalized}"`;
    } else {
      ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -vf "subtitles=${srtPath}" -c:v libx264 -c:a copy "${outputPath}"`;
    }
    
    console.log("🎬 FFmpeg command:", ffmpegCommand);
    
    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    console.log("✅ FFmpeg completed successfully");
    if (stdout) console.log("FFmpeg stdout:", stdout.slice(0, 200));
    if (stderr) console.log("FFmpeg stderr:", stderr.slice(0, 200));

    // 檢查輸出文件是否存在
    if (!fs.existsSync(outputPath)) {
      console.log("❌ Output file not created");
      return NextResponse.json(
        { error: "Output file not created" },
        { status: 500 }
      );
    }

    const outputBuffer = await fs.promises.readFile(outputPath);
    console.log("📁 Output file size:", outputBuffer.length, "bytes");

    // 清理臨時檔案
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.unlink(srtPath);
      await fs.promises.unlink(outputPath);
      console.log("🧹 Cleanup completed");
    } catch (cleanupError) {
      console.error("⚠️ Cleanup error:", cleanupError);
    }

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="test_rendered_video.mp4"`,
      },
    });

  } catch (error: any) {
    console.error("💥 Error in diagnostic render:", error);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      { 
        error: "Diagnostic render failed", 
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      },
      { status: 500 }
    );
  }
}

// 格式化時間為 SRT 格式
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}