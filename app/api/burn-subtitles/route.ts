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
    const videoPath = formData.get("videoPath") as string;
    const subtitlesJson = formData.get("subtitles") as string;
    const pinnedSubtitlesJson = formData.get("pinnedSubtitles") as string; // 新增：固定字幕
    const renderMethod = formData.get("renderMethod") as string || "ass"; // 新增：渲染方法選擇

    // 新增：支持双字幕轨道
    const primarySubtitlesJson = formData.get("primarySubtitles") as string; // 主字幕（原文）
    const secondarySubtitlesJson = formData.get("secondarySubtitles") as string; // 次字幕（翻译）

    if ((!videoFile && !videoPath) || !subtitlesJson) {
      return NextResponse.json(
        { error: "Missing video or subtitles" },
        { status: 400 }
      );
    }

    console.log("🎬 Using render method:", renderMethod);

    const subtitles = JSON.parse(subtitlesJson);
    const pinnedSubtitles = pinnedSubtitlesJson ? JSON.parse(pinnedSubtitlesJson) : [];

    // 解析双字幕轨道（如果提供）
    const primarySubtitles = primarySubtitlesJson ? JSON.parse(primarySubtitlesJson) : null;
    const secondarySubtitles = secondarySubtitlesJson ? JSON.parse(secondarySubtitlesJson) : null;

    // 日志输出
    if (primarySubtitles && secondarySubtitles) {
      console.log("📽️ Dual subtitle mode enabled");
      console.log("  Primary subtitles:", primarySubtitles.length, "segments");
      console.log("  Secondary subtitles:", secondarySubtitles.length, "segments");
    } else {
      console.log("📽️ Single subtitle mode");
      console.log("  Subtitles:", subtitles.length, "segments");
    }
    if (pinnedSubtitles.length > 0) {
      console.log("  Pinned subtitles:", pinnedSubtitles.length);
    }

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let finalVideoPath: string;

    if (videoPath) {
      // 使用已存在的影片檔案
      finalVideoPath = path.join(tempDir, videoPath);
      if (!fs.existsSync(finalVideoPath)) {
        return NextResponse.json(
          { error: "Video file not found" },
          { status: 404 }
        );
      }
    } else {
      // 保存新上傳的影片檔案
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      const videoFileName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;
      finalVideoPath = path.join(tempDir, videoFileName);
      await fs.promises.writeFile(finalVideoPath, videoBuffer);
    }

    // 偵測影片實際寬高
    let videoDimensions: { width: number; height: number } | undefined;
    try {
      const { stdout: probeStdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_streams "${finalVideoPath}"`
      );
      const streams = JSON.parse(probeStdout).streams;
      const videoStream = streams.find((s: any) => s.codec_type === 'video');
      if (videoStream?.width && videoStream?.height) {
        videoDimensions = { width: videoStream.width, height: videoStream.height };
        console.log(`📐 Video dimensions: ${videoDimensions.width}x${videoDimensions.height}`);
      }
    } catch (probeError) {
      console.warn('⚠️ ffprobe failed, using default 1920x1080:', probeError);
    }

    // 生成 ASS 字幕檔（包含固定字幕）
    // 如果提供了双字幕轨道，使用双轨道模式；否则使用传统单轨道模式
    const assContent = (primarySubtitles && secondarySubtitles)
      ? generateAssSubtitle(primarySubtitles, pinnedSubtitles, secondarySubtitles, videoDimensions)
      : generateAssSubtitle(subtitles, pinnedSubtitles, undefined, videoDimensions);
    const assFileName = `subtitle_${Date.now()}.ass`;
    const assPath = path.join(tempDir, assFileName);
    await fs.promises.writeFile(assPath, assContent, "utf-8");

    // 輸出檔案路徑
    const outputFileName = `output_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    try {
      // 使用 ASS 燒錄方法
      console.log("Starting FFmpeg ASS subtitle burn...");
      console.log("Video path:", finalVideoPath);
      console.log("ASS path:", assPath);
      console.log("Output path:", outputPath);
      
      // Windows 路徑處理: ASS filter 需要雙反斜線轉義
      let ffmpegCommand: string;
      
      if (process.platform === 'win32') {
        // Windows: 將反斜線轉換為正斜線,並在 ass filter 中使用雙反斜線轉義
        const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
        const outputPathNormalized = outputPath.replace(/\\/g, '/');
        // ASS filter 路徑需要四個反斜線(\\\\) 來表示一個實際的反斜線
        const assPathEscaped = assPath.replace(/\\/g, '\\\\\\\\').replace(/:/g, '\\\\:');
        
        // 基本參數配置 (移除可能導致錯誤的進階參數)
        // 只保留最基本的字幕燒錄功能
        ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -vf "ass=${assPathEscaped}" -c:v libx264 -c:a copy "${outputPathNormalized}"`;
      } else {
        // Unix/Linux/Mac: 直接使用原始路徑
        // 基本參數配置 (移除可能導致錯誤的進階參數)
        ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -vf "ass=${assPath}" -c:v libx264 -c:a copy "${outputPath}"`;
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
      return new Response(new Uint8Array(outputBuffer), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="subtitled_video.mp4"`,
          "Content-Length": outputBuffer.length.toString(),
        },
      });
    } catch (ffmpegError: any) {
      console.error("FFmpeg error:", ffmpegError);
      
      // 清理失敗的檔案
      try {
        // 只清理新上傳的影片檔案，不要清理已存在的檔案
        if (!videoPath && fs.existsSync(finalVideoPath)) await fs.promises.unlink(finalVideoPath);
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