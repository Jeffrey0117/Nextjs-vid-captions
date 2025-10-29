import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
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
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

// 生成字幕渲染的 HTML 模板
function generateSubtitleHTML(segment: SubtitleSegment, videoWidth: number, videoHeight: number): string {
  const { text, style } = segment;
  
  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subtitle Render</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                width: ${videoWidth}px;
                height: ${videoHeight}px;
                background: transparent;
                font-family: ${style.fontFamily};
                overflow: hidden;
            }
            
            .subtitle {
                position: absolute;
                left: ${style.positionX}%;
                top: ${style.positionY}%;
                transform: translate(-50%, -50%) scale(${style.scale});
                font-size: ${style.fontSize}px;
                font-weight: ${style.fontWeight};
                font-style: ${style.fontStyle};
                text-decoration: ${style.textDecoration};
                color: ${style.color};
                opacity: ${style.opacity};
                background-color: ${style.backgroundColor};
                max-width: ${style.maxWidth}vw;
                text-align: center;
                white-space: pre-wrap;
                word-wrap: break-word;
                padding: 8px 16px;
                border-radius: 4px;
                ${style.enableShadow ? `
                    text-shadow: ${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor};
                ` : ''}
                z-index: 1000;
            }
        </style>
    </head>
    <body>
        <div class="subtitle">${text.replace(/\n/g, '<br>')}</div>
    </body>
    </html>
  `;
}

export async function POST(request: Request) {
  let browser: puppeteer.Browser | null = null;
  
  try {
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
          { error: "Video file not found" },
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
    const videoInfoCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${finalVideoPath}"`;
    const { stdout: videoInfoStdout } = await execAsync(videoInfoCommand);
    const videoInfo = JSON.parse(videoInfoStdout);
    
    const videoStream = videoInfo.streams.find((stream: any) => stream.codec_type === 'video');
    const videoWidth = videoStream.width;
    const videoHeight = videoStream.height;
    const videoDuration = parseFloat(videoInfo.format.duration);
    const videoFps = eval(videoStream.r_frame_rate); // 例如 "30/1" -> 30

    console.log(`Video info: ${videoWidth}x${videoHeight}, duration: ${videoDuration}s, fps: ${videoFps}`);

    // 啟動 Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: videoWidth,
      height: videoHeight,
      deviceScaleFactor: 1
    });

    // 創建字幕幀目錄
    const framesDir = path.join(tempDir, `frames_${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });

    // 計算每一幀需要的字幕
    const totalFrames = Math.ceil(videoDuration * videoFps);
    console.log(`Total frames to process: ${totalFrames}`);

    // 批量生成字幕幀
    for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
      const currentTime = frameNumber / videoFps;
      
      // 找到當前時間應該顯示的字幕
      const activeSubtitle = subtitles.find(sub => 
        currentTime >= sub.startTime && currentTime <= sub.endTime
      );

      if (activeSubtitle) {
        // 生成包含字幕的 HTML
        const html = generateSubtitleHTML(activeSubtitle, videoWidth, videoHeight);
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // 截圖保存字幕層
        const screenshotPath = path.join(framesDir, `subtitle_${frameNumber.toString().padStart(6, '0')}.png`);
        await page.screenshot({
          path: screenshotPath,
          type: 'png',
          omitBackground: true // 透明背景
        });
      } else {
        // 創建空的透明圖片
        const emptyImagePath = path.join(framesDir, `subtitle_${frameNumber.toString().padStart(6, '0')}.png`);
        
        // 使用 ImageMagick 或直接創建空的 PNG (此處使用簡單的透明 PNG)
        const transparentPng = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8l6wAAAABJRU5ErkJggg==',
          'base64'
        );
        await fs.promises.writeFile(emptyImagePath, transparentPng);
      }

      // 進度報告
      if (frameNumber % Math.ceil(totalFrames / 10) === 0) {
        console.log(`Progress: ${Math.round((frameNumber / totalFrames) * 100)}%`);
      }
    }

    await browser.close();
    browser = null;

    // 使用 FFmpeg 將字幕層疊加到影片上
    const outputFileName = `rendered_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    // FFmpeg 命令：將字幕圖片序列疊加到影片上
    const ffmpegCommand = process.platform === 'win32'
      ? `ffmpeg -i "${finalVideoPath.replace(/\\/g, '/')}" -framerate ${videoFps} -i "${framesDir.replace(/\\/g, '/')}/subtitle_%06d.png" -filter_complex "[1:v][0:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 0:a? -c:v libx264 -c:a copy -r ${videoFps} -shortest "${outputPath.replace(/\\/g, '/')}"`
      : `ffmpeg -i "${finalVideoPath}" -framerate ${videoFps} -i "${framesDir}/subtitle_%06d.png" -filter_complex "[1:v][0:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 0:a? -c:v libx264 -c:a copy -r ${videoFps} -shortest "${outputPath}"`;

    console.log("FFmpeg overlay command:", ffmpegCommand);

    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });

    if (stdout) console.log("FFmpeg stdout:", stdout);
    if (stderr) console.log("FFmpeg stderr:", stderr);

    // 讀取輸出影片
    const outputBuffer = await fs.promises.readFile(outputPath);

    // 清理臨時檔案
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.rmdir(framesDir, { recursive: true });
      await fs.promises.unlink(outputPath);
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    return new Response(outputBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="rendered_video.mp4"`,
      },
    });

  } catch (error: any) {
    console.error("Error in video rendering:", error);
    
    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      { error: "Video rendering failed", details: error.message },
      { status: 500 }
    );
  }
}