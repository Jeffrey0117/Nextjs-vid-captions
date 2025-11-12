import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 動態導入 canvas 以避免編譯時錯誤
let canvasLib: any = null;
try {
  canvasLib = require('canvas');
} catch (error) {
  console.warn('Canvas library not available, falling back to alternative method');
}

interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
  translatedText?: string;
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
    enableStroke?: boolean;
    strokeColor?: string;
    strokeWidth?: number;
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

// 渲染字幕到 Canvas 並生成 PNG
async function renderSubtitleToCanvas(
  segment: SubtitleSegment, 
  width: number, 
  height: number
): Promise<Buffer> {
  if (!canvasLib) {
    throw new Error('Canvas library not available');
  }

  const { createCanvas } = canvasLib;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 設置透明背景
  ctx.clearRect(0, 0, width, height);

  const { text, translatedText, style } = segment;
  // 優先使用翻譯文本，如果沒有則使用原文
  const displayText = translatedText || text;
  
  // 設置字體
  const fontWeight = style.fontWeight === 'bold' ? 'bold' : 'normal';
  const fontStyle = style.fontStyle === 'italic' ? 'italic' : 'normal';
  ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  
  // 設置文字顏色和透明度
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.opacity;
  
  // 計算文字位置
  const x = (style.positionX / 100) * width;
  const y = (style.positionY / 100) * height;
  
  // 設置文字對齊
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 處理陰影
  if (style.enableShadow) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowOffsetX = style.shadowOffsetX;
    ctx.shadowOffsetY = style.shadowOffsetY;
    ctx.shadowBlur = style.shadowBlur;
  }
  
  // 處理背景色
  if (style.backgroundColor !== 'transparent') {
    const textMetrics = ctx.measureText(displayText);
    const padding = 16;
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(
      x - textMetrics.width / 2 - padding,
      y - style.fontSize / 2 - padding / 2,
      textMetrics.width + padding * 2,
      style.fontSize + padding
    );
    ctx.fillStyle = style.color; // 重設文字顏色
  }
  
  // 繪製文字
  const lines = displayText.split('\n');
  const lineHeight = style.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2;

  // Draw stroke first (behind the text)
  if (style.enableStroke && style.strokeWidth && style.strokeWidth > 0) {
    ctx.strokeStyle = style.strokeColor || '#000000';
    ctx.lineWidth = style.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    lines.forEach((line, index) => {
      ctx.strokeText(line, x, startY + (index + 0.5) * lineHeight);
    });
  }

  // Draw fill text (on top of stroke)
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + (index + 0.5) * lineHeight);
  });

  return canvas.toBuffer('image/png');
}

// 為每一秒生成字幕幀
async function generateSubtitleFrames(
  subtitles: SubtitleSegment[],
  width: number,
  height: number,
  duration: number,
  fps: number,
  outputDir: string
): Promise<number> {
  const totalFrames = Math.ceil(duration * fps);
  let framesGenerated = 0;

  // Frame caching mechanism to avoid re-rendering identical subtitles
  const frameCache = new Map<string, Buffer>();
  let cacheHits = 0;

  for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
    const currentTime = frameNumber / fps;

    // 找到當前時間應該顯示的字幕
    const activeSubtitle = subtitles.find(sub =>
      currentTime >= sub.startTime && currentTime <= sub.endTime
    );

    const framePath = path.join(outputDir, `frame_${frameNumber.toString().padStart(8, '0')}.png`);

    if (activeSubtitle) {
      try {
        // Generate cache key based on subtitle content and style
        const cacheKey = JSON.stringify({
          text: activeSubtitle.translatedText || activeSubtitle.text,
          style: activeSubtitle.style
        });

        let frameBuffer: Buffer;

        // Check cache first
        if (frameCache.has(cacheKey)) {
          frameBuffer = frameCache.get(cacheKey)!;
          cacheHits++;
        } else {
          // Render new frame and cache it
          frameBuffer = await renderSubtitleToCanvas(activeSubtitle, width, height);
          frameCache.set(cacheKey, frameBuffer);
        }

        await fs.promises.writeFile(framePath, frameBuffer);
        framesGenerated++;
      } catch (error) {
        console.error(`Error rendering frame ${frameNumber}:`, error);
        // 創建空的透明幀
        const transparentPng = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8l6wAAAABJRU5ErkJggg==',
          'base64'
        );
        await fs.promises.writeFile(framePath, transparentPng);
      }
    } else {
      // 創建空的透明幀
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8l6wAAAABJRU5ErkJggg==',
        'base64'
      );
      await fs.promises.writeFile(framePath, transparentPng);
    }
    
    // 進度報告
    if (frameNumber % Math.ceil(totalFrames / 20) === 0) {
      console.log(`Canvas rendering progress: ${Math.round((frameNumber / totalFrames) * 100)}%`);
    }
  }

  // Log cache performance statistics
  console.log(`📊 Frame cache performance: ${cacheHits} cache hits out of ${framesGenerated} frames (${Math.round((cacheHits / Math.max(framesGenerated, 1)) * 100)}% cache efficiency)`);

  return framesGenerated;
}

export async function POST(request: Request) {
  try {
    console.log("🎨 Starting Canvas-based subtitle rendering...");
    
    if (!canvasLib) {
      return NextResponse.json(
        { error: "Canvas library not available. Please install node-canvas." },
        { status: 500 }
      );
    }
    
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

    // 獲取影片資訊
    console.log("🔍 Getting video information...");
    const videoInfoCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${finalVideoPath}"`;
    const { stdout: videoInfoStdout } = await execAsync(videoInfoCommand);
    const videoInfo = JSON.parse(videoInfoStdout);
    
    const videoStream = videoInfo.streams.find((stream: any) => stream.codec_type === 'video');
    const videoWidth = videoStream.width;
    const videoHeight = videoStream.height;
    const videoDuration = parseFloat(videoInfo.format.duration);
    // Safe parsing of frame rate fraction (e.g., "30/1" -> 30)
    const [num, denom] = videoStream.r_frame_rate.split('/').map(Number);
    const videoFps = denom ? num / denom : 30;

    console.log(`📐 Video info: ${videoWidth}x${videoHeight}, duration: ${videoDuration}s, fps: ${videoFps}`);

    // 創建字幕幀目錄
    const framesDir = path.join(tempDir, `canvas_frames_${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });
    console.log("📁 Created frames directory:", framesDir);

    // 輸出檔案路徑
    const outputFileName = `canvas_rendered_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    let outputBuffer: Buffer | null = null;

    try {
      // 使用 Canvas 生成字幕幀
      console.log("🎨 Starting Canvas subtitle frame generation...");
      const framesGenerated = await generateSubtitleFrames(
        subtitles,
        videoWidth,
        videoHeight,
        videoDuration,
        videoFps,
        framesDir
      );

      console.log(`✅ Generated ${framesGenerated} subtitle frames`);

      console.log("🔄 Starting FFmpeg video composition...");

      // 使用 FFmpeg 將 Canvas 渲染的字幕幀疊加到影片上
      let ffmpegCommand: string;

      if (process.platform === 'win32') {
        const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
        const outputPathNormalized = outputPath.replace(/\\/g, '/');
        const framesDirNormalized = framesDir.replace(/\\/g, '/');

        ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -framerate ${videoFps} -i "${framesDirNormalized}/frame_%08d.png" -filter_complex "[1:v][0:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 0:a? -c:v libx264 -preset medium -crf 18 -c:a copy -r ${videoFps} -shortest "${outputPathNormalized}"`;
      } else {
        ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -framerate ${videoFps} -i "${framesDir}/frame_%08d.png" -filter_complex "[1:v][0:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 0:a? -c:v libx264 -preset medium -crf 18 -c:a copy -r ${videoFps} -shortest "${outputPath}"`;
      }

      console.log("🎬 FFmpeg composition command:", ffmpegCommand);

      // 執行 FFmpeg
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
      });

      console.log("✅ FFmpeg composition completed");
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

      outputBuffer = await fs.promises.readFile(outputPath);
      console.log("📤 Canvas rendered output file size:", outputBuffer.length, "bytes");

    } finally {
      // Cleanup happens regardless of success or failure
      console.log("🧹 Starting cleanup...");
      try {
        // Clean up uploaded video file if it was temporary
        if (!videoPath && fs.existsSync(finalVideoPath)) {
          await fs.promises.unlink(finalVideoPath);
          console.log("  ✓ Removed temporary video file");
        }

        // Clean up frames directory
        if (fs.existsSync(framesDir)) {
          await fs.promises.rm(framesDir, { recursive: true, force: true });
          console.log("  ✓ Removed frames directory");
        }

        // Clean up output file
        if (fs.existsSync(outputPath)) {
          await fs.promises.unlink(outputPath);
          console.log("  ✓ Removed output file");
        }

        console.log("🧹 Cleanup completed successfully");
      } catch (cleanupError) {
        console.error("⚠️ Cleanup error (non-critical):", cleanupError);
      }
    }

    // If we got here, everything succeeded and outputBuffer should be set
    if (!outputBuffer) {
      return NextResponse.json(
        { error: "Output buffer not available" },
        { status: 500 }
      );
    }

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="canvas_subtitled_video.mp4"`,
        "Content-Length": outputBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error("💥 Error in Canvas subtitle rendering:", error);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      { 
        error: "Canvas subtitle rendering failed", 
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      },
      { status: 500 }
    );
  }
}