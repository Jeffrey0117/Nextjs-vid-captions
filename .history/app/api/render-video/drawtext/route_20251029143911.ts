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
  style: {
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
    color: string;
    opacity: number;
    backgroundColor: string;
    position: string;
    enableShadow: boolean;
    shadowColor: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    enableStroke: boolean;
    strokeColor: string;
    strokeWidth: number;
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

// 將 HEX 顏色轉換為 FFmpeg 顏色格式
function hexToFFmpegColor(hex: string): string {
  if (hex.startsWith('#')) hex = hex.slice(1);
  return `0x${hex}`;
}

// 生成高品質的 FFmpeg drawtext filter
function generateDrawTextFilters(subtitles: SubtitleSegment[], videoWidth: number, videoHeight: number): string {
  const filters: string[] = [];
  
  subtitles.forEach((segment, index) => {
    const { text, style } = segment;
    
    // 計算位置
    const x = Math.round((style.positionX / 100) * videoWidth);
    const y = Math.round((style.positionY / 100) * videoHeight);
    
    // 處理字體樣式
    let fontFile = '';
    if (style.fontFamily.toLowerCase().includes('arial')) {
      fontFile = process.platform === 'win32' ? 'C\\:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf';
    } else {
      fontFile = process.platform === 'win32' ? 'C\\:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Arial.ttf';
    }
    
    // 字體大小 (考慮縮放)
    const fontSize = Math.round(style.fontSize * style.scale);
    
    // 顏色處理
    const textColor = hexToFFmpegColor(style.color);
    const shadowColor = style.enableShadow ? hexToFFmpegColor(style.shadowColor) : textColor;
    
    // 處理文字內容，轉義特殊字符
    const escapedText = text
      .replace(/\\/g, '\\\\\\\\')  // 反斜線
      .replace(/'/g, "\\\\'")      // 單引號
      .replace(/"/g, '\\\\"')      // 雙引號
      .replace(/:/g, '\\\\:')      // 冒號
      .replace(/\n/g, '\\n');      // 換行
    
    // 構建 drawtext filter
    let drawTextFilter = `drawtext=fontfile='${fontFile}':text='${escapedText}':fontsize=${fontSize}:fontcolor=${textColor}:x=${x}:y=${y}:enable='between(t,${segment.startTime},${segment.endTime})'`;
    
    // 添加描邊效果
    if (style.enableStroke && style.strokeWidth > 0) {
      const strokeColor = hexToFFmpegColor(style.strokeColor);
      drawTextFilter += `:borderw=${style.strokeWidth}:bordercolor=${strokeColor}`;
    }
    
    // 添加陰影效果
    if (style.enableShadow) {
      drawTextFilter += `:shadowcolor=${shadowColor}:shadowx=${style.shadowOffsetX}:shadowy=${style.shadowOffsetY}`;
    }
    
    // 添加背景色
    if (style.backgroundColor !== 'transparent') {
      const bgColor = hexToFFmpegColor(style.backgroundColor);
      drawTextFilter += `:box=1:boxcolor=${bgColor}:boxborderw=10`;
    }
    
    // 文字對齊
    drawTextFilter += ':x=(w-text_w)/2:y=(h-text_h)/2'; // 居中對齊
    
    filters.push(drawTextFilter);
  });
  
  return filters.join(',');
}

export async function POST(request: Request) {
  try {
    console.log("🎨 Starting high-quality FFmpeg drawtext rendering...");
    
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
    console.log("📝 Processing", subtitles.length, "subtitle segments");
    console.log("📝 First subtitle sample:", {
      text: subtitles[0]?.text,
      start: subtitles[0]?.startTime,
      end: subtitles[0]?.endTime,
      style: subtitles[0]?.style
    });

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

    // 獲取影片資訊
    console.log("🔍 Getting video information...");
    const videoInfoCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${finalVideoPath}"`;
    const { stdout: videoInfoStdout } = await execAsync(videoInfoCommand);
    const videoInfo = JSON.parse(videoInfoStdout);
    
    const videoStream = videoInfo.streams.find((stream: any) => stream.codec_type === 'video');
    const videoWidth = videoStream.width;
    const videoHeight = videoStream.height;
    const videoDuration = parseFloat(videoInfo.format.duration);

    console.log(`📐 Video info: ${videoWidth}x${videoHeight}, duration: ${videoDuration}s`);

    // 生成 drawtext filters
    console.log("🎨 Generating drawtext filters...");
    const drawTextFilters = generateDrawTextFilters(subtitles, videoWidth, videoHeight);
    console.log("🎬 Generated filters preview:", drawTextFilters.substring(0, 200) + "...");

    // 輸出檔案路徑
    const outputFileName = `drawtext_rendered_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("🔄 Starting FFmpeg drawtext processing...");

    // 使用 drawtext filter 進行高品質渲染
    let ffmpegCommand: string;
    
    if (process.platform === 'win32') {
      const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
      const outputPathNormalized = outputPath.replace(/\\/g, '/');
      
      ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -vf "${drawTextFilters}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "${outputPathNormalized}"`;
    } else {
      ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -vf "${drawTextFilters}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "${outputPath}"`;
    }
    
    console.log("🎬 FFmpeg drawtext command:", ffmpegCommand);
    
    // 執行 FFmpeg
    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 20,
    });

    console.log("✅ FFmpeg drawtext rendering completed");
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
    console.log("📤 Drawtext rendered output file size:", outputBuffer.length, "bytes");

    // 清理臨時檔案
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.unlink(outputPath);
      console.log("🧹 Cleanup completed");
    } catch (cleanupError) {
      console.error("⚠️ Cleanup error:", cleanupError);
    }

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="drawtext_subtitled_video.mp4"`,
        "Content-Length": outputBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error("💥 Error in drawtext rendering:", error);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      { 
        error: "Drawtext rendering failed", 
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      },
      { status: 500 }
    );
  }
}