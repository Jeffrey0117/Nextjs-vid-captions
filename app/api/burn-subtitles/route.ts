import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { generateAssSubtitle } from "@/lib/generateAss";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const subtitlesJson = formData.get("subtitles") as string;

    if (!videoFile || !subtitlesJson) {
      return NextResponse.json(
        { error: "Missing video or subtitles" },
        { status: 400 }
      );
    }

    const subtitles = JSON.parse(subtitlesJson);

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 保存影片檔案
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const videoFileName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;
    const videoPath = path.join(tempDir, videoFileName);
    await fs.promises.writeFile(videoPath, videoBuffer);

    // 生成 ASS 字幕檔
    const assContent = generateAssSubtitle(subtitles);
    const assFileName = `subtitle_${Date.now()}.ass`;
    const assPath = path.join(tempDir, assFileName);
    await fs.promises.writeFile(assPath, assContent, "utf-8");

    // 輸出檔案路徑
    const outputFileName = `output_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    try {
      // 執行 FFmpeg 命令燒錄字幕
      console.log("Starting FFmpeg subtitle burn...");
      console.log("Video path:", videoPath);
      console.log("ASS path:", assPath);
      console.log("Output path:", outputPath);
      
      // Windows 路徑處理: ASS filter 需要雙反斜線轉義
      let ffmpegCommand: string;
      
      if (process.platform === 'win32') {
        // Windows: 將反斜線轉換為正斜線,並在 ass filter 中使用雙反斜線轉義
        const videoPathNormalized = videoPath.replace(/\\/g, '/');
        const outputPathNormalized = outputPath.replace(/\\/g, '/');
        // ASS filter 路徑需要四個反斜線(\\\\) 來表示一個實際的反斜線
        const assPathEscaped = assPath.replace(/\\/g, '\\\\\\\\').replace(/:/g, '\\\\:');
        
        ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -vf "ass=${assPathEscaped}" -c:v libx264 -preset medium -crf 23 -c:a copy "${outputPathNormalized}"`;
      } else {
        // Unix/Linux/Mac: 直接使用原始路徑
        ffmpegCommand = `ffmpeg -i "${videoPath}" -vf "ass=${assPath}" -c:v libx264 -preset medium -crf 23 -c:a copy "${outputPath}"`;
      }
      
      console.log("FFmpeg command:", ffmpegCommand);
      
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      if (stdout) {
        console.log("FFmpeg stdout:", stdout);
      }
      if (stderr) {
        console.log("FFmpeg stderr:", stderr);
      }

      // 讀取輸出影片
      const outputBuffer = await fs.promises.readFile(outputPath);

      // 清理臨時檔案
      try {
        await fs.promises.unlink(videoPath);
        await fs.promises.unlink(assPath);
        await fs.promises.unlink(outputPath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      // 回傳影片檔案
      return new Response(outputBuffer, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="subtitled_video.mp4"`,
        },
      });
    } catch (ffmpegError: any) {
      console.error("FFmpeg error:", ffmpegError);
      
      // 清理失敗的檔案
      try {
        if (fs.existsSync(videoPath)) await fs.promises.unlink(videoPath);
        if (fs.existsSync(assPath)) await fs.promises.unlink(assPath);
        if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      return NextResponse.json(
        { 
          error: "FFmpeg processing failed. Please ensure FFmpeg is installed.",
          details: ffmpegError.message 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}