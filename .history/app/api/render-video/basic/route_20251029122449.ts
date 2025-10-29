import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
  style?: any; // 暫時不處理樣式，先確保基本功能
}

export async function POST(request: Request) {
  try {
    console.log("🎬 Starting subtitle rendering...");
    
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const videoPath = formData.get("videoPath") as string;
    const subtitlesJson = formData.get("subtitles") as string;
    
    console.log("📊 Form data received:", {
      hasVideoFile: !!videoFile,
      videoPath: videoPath,
      subtitlesExists: !!subtitlesJson
    });

    if ((!videoFile && !videoPath) || !subtitlesJson) {
      return NextResponse.json(
        { error: "Missing video or subtitles" },
        { status: 400 }
      );
    }

    const subtitles: SubtitleSegment[] = JSON.parse(subtitlesJson);
    console.log("📝 Parsed", subtitles.length, "subtitle segments");

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let finalVideoPath: string;

    if (videoPath) {
      finalVideoPath = path.join(tempDir, videoPath);
      console.log("📁 Using existing video:", finalVideoPath);
      
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

    // 創建 SRT 字幕文件
    const srtContent = subtitles.map((seg, index) => {
      const startTime = formatSrtTime(seg.startTime);
      const endTime = formatSrtTime(seg.endTime);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    }).join('\n');

    const srtFileName = `subtitle_${Date.now()}.srt`;
    const srtPath = path.join(tempDir, srtFileName);
    await fs.promises.writeFile(srtPath, srtContent, "utf-8");
    console.log("📝 Created SRT file:", srtPath);
    console.log("📝 SRT preview:", srtContent.substring(0, 200) + "...");

    // 輸出檔案路徑
    const outputFileName = `rendered_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("🔄 Starting FFmpeg processing...");

    // 使用 subtitles filter 而不是 ass filter
    let ffmpegCommand: string;
    
    if (process.platform === 'win32') {
      const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
      const outputPathNormalized = outputPath.replace(/\\/g, '/');
      const srtPathNormalized = srtPath.replace(/\\/g, '/');
      
      // Windows: 使用 subtitles filter，路徑需要轉義
      const srtPathEscaped = srtPathNormalized.replace(/:/g, '\\:');
      ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -vf "subtitles=${srtPathEscaped}" -c:v libx264 -c:a copy "${outputPathNormalized}"`;
    } else {
      ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -vf "subtitles=${srtPath}" -c:v libx264 -c:a copy "${outputPath}"`;
    }
    
    console.log("🎬 FFmpeg command:", ffmpegCommand);
    
    // 執行 FFmpeg
    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    console.log("✅ FFmpeg completed");
    if (stdout) console.log("FFmpeg stdout:", stdout.substring(0, 500));
    if (stderr) console.log("FFmpeg stderr:", stderr.substring(0, 500));

    // 檢查輸出文件是否存在
    if (!fs.existsSync(outputPath)) {
      console.log("❌ Output file not created");
      return NextResponse.json(
        { error: "Output file was not created by FFmpeg" },
        { status: 500 }
      );
    }

    const outputBuffer = await fs.promises.readFile(outputPath);
    console.log("📤 Output file size:", outputBuffer.length, "bytes");

    // 清理臨時檔案
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.unlink(srtPath);
      await fs.promises.unlink(outputPath);
      console.log("🧹 Cleanup completed");
    } catch (cleanupError) {
      console.error("⚠️ Cleanup error:", cleanupError);
    }

    return new Response(outputBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="subtitled_video.mp4"`,
        "Content-Length": outputBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error("💥 Error in subtitle rendering:", error);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      { 
        error: "Subtitle rendering failed", 
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