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
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

// 簡化的測試渲染 - 創建一個明顯的紅色字幕
async function createTestSubtitleFrame(width: number, height: number, text: string): Promise<Buffer> {
  if (!canvasLib) {
    throw new Error('Canvas library not available');
  }

  const { createCanvas } = canvasLib;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 設置透明背景
  ctx.clearRect(0, 0, width, height);

  // 設置明顯的字體和顏色進行測試
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#FF0000'; // 鮮紅色
  ctx.strokeStyle = '#FFFFFF'; // 白色邊框
  ctx.lineWidth = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 在影片中央繪製文字
  const x = width / 2;
  const y = height / 2;

  // 先繪製白色邊框，再繪製紅色文字
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);

  console.log(`🎨 Created test frame: ${width}x${height}, text: "${text}"`);
  return canvas.toBuffer('image/png');
}

export async function POST(request: Request) {
  try {
    console.log("🧪 Starting Canvas debug test...");
    
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

    if ((!videoFile && !videoPath) || !subtitlesJson) {
      return NextResponse.json(
        { error: "Missing video or subtitles" },
        { status: 400 }
      );
    }

    const subtitles: SubtitleSegment[] = JSON.parse(subtitlesJson);
    console.log("📝 Subtitles to test:", subtitles.map(s => ({
      start: s.startTime,
      end: s.endTime,
      text: s.text.substring(0, 20) + '...'
    })));

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let finalVideoPath: string;

    if (videoPath) {
      finalVideoPath = path.join(tempDir, videoPath);
      if (!fs.existsSync(finalVideoPath)) {
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
    const videoFps = eval(videoStream.r_frame_rate);

    console.log(`📐 Video info: ${videoWidth}x${videoHeight}, duration: ${videoDuration}s, fps: ${videoFps}`);

    // 創建一個簡單的測試字幕圖片
    const framesDir = path.join(tempDir, `debug_frames_${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });

    console.log("🎨 Creating test subtitle frame...");
    
    // 創建一個明顯的測試字幕圖片
    const testText = subtitles[0]?.text || "TEST SUBTITLE";
    const testFrame = await createTestSubtitleFrame(videoWidth, videoHeight, testText);
    const testFramePath = path.join(framesDir, 'test_subtitle.png');
    await fs.promises.writeFile(testFramePath, testFrame);
    
    console.log("💾 Saved test frame to:", testFramePath);
    console.log("📏 Test frame size:", testFrame.length, "bytes");

    // 使用簡單的 FFmpeg overlay 命令測試
    const outputFileName = `debug_test_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("🔄 Testing FFmpeg overlay...");
    
    let ffmpegCommand: string;
    if (process.platform === 'win32') {
      const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
      const outputPathNormalized = outputPath.replace(/\\/g, '/');
      const testFramePathNormalized = testFramePath.replace(/\\/g, '/');
      
      // 簡單的靜態圖片疊加測試
      ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -i "${testFramePathNormalized}" -filter_complex "[1:v][0:v]overlay=0:0[v]" -map "[v]" -map 0:a? -c:v libx264 -c:a copy -t 10 "${outputPathNormalized}"`;
    } else {
      ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -i "${testFramePath}" -filter_complex "[1:v][0:v]overlay=0:0[v]" -map "[v]" -map 0:a? -c:v libx264 -c:a copy -t 10 "${outputPath}"`;
    }
    
    console.log("🎬 Debug FFmpeg command:", ffmpegCommand);
    
    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 20,
    });

    console.log("✅ FFmpeg debug test completed");
    console.log("FFmpeg stdout:", stdout);
    console.log("FFmpeg stderr:", stderr);

    if (!fs.existsSync(outputPath)) {
      console.log("❌ Debug output file not created");
      return NextResponse.json(
        { error: "Debug output file was not created" },
        { status: 500 }
      );
    }

    const outputBuffer = await fs.promises.readFile(outputPath);
    console.log("📤 Debug output file size:", outputBuffer.length, "bytes");

    // 清理
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.unlink(testFramePath);
      await fs.promises.rmdir(framesDir);
      await fs.promises.unlink(outputPath);
    } catch (cleanupError) {
      console.error("⚠️ Cleanup error:", cleanupError);
    }

    return new Response(outputBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="debug_test.mp4"`,
      },
    });

  } catch (error: any) {
    console.error("💥 Debug test error:", error);
    
    return NextResponse.json(
      { 
        error: "Debug test failed", 
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      },
      { status: 500 }
    );
  }
}