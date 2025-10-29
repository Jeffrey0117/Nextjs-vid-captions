import { NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
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

// 生成包含字幕的完整 HTML 頁面
function generateVideoWithSubtitlesHTML(
  videoUrl: string,
  subtitles: SubtitleSegment[],
  videoWidth: number,
  videoHeight: number
): string {
  const subtitleElements = subtitles.map((segment, index) => {
    const { text, style, startTime, endTime } = segment;
    
    return `
      <div 
        class="subtitle subtitle-${index}" 
        data-start="${startTime}" 
        data-end="${endTime}"
        style="
          position: absolute;
          left: ${style.positionX}%;
          top: ${style.positionY}%;
          transform: translate(-50%, -50%) scale(${style.scale});
          font-size: ${style.fontSize}px;
          font-family: ${style.fontFamily};
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
          z-index: 1000;
          display: none;
          ${style.enableShadow ? `
            text-shadow: ${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor};
          ` : ''}
        "
      >${text.replace(/\n/g, '<br>')}</div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video with Subtitles</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                width: ${videoWidth}px;
                height: ${videoHeight}px;
                background: black;
                overflow: hidden;
                position: relative;
            }
            
            .video-container {
                position: relative;
                width: 100%;
                height: 100%;
            }
            
            video {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            
            .subtitle {
                pointer-events: none;
            }
        </style>
    </head>
    <body>
        <div class="video-container">
            <video id="mainVideo" muted>
                <source src="${videoUrl}" type="video/mp4">
            </video>
            ${subtitleElements}
        </div>
        
        <script>
            const video = document.getElementById('mainVideo');
            const subtitles = document.querySelectorAll('.subtitle');
            
            // 字幕時間同步
            video.addEventListener('timeupdate', () => {
                const currentTime = video.currentTime;
                
                subtitles.forEach(subtitle => {
                    const start = parseFloat(subtitle.dataset.start);
                    const end = parseFloat(subtitle.dataset.end);
                    
                    if (currentTime >= start && currentTime <= end) {
                        subtitle.style.display = 'block';
                    } else {
                        subtitle.style.display = 'none';
                    }
                });
            });
            
            // 準備錄製
            window.startRecording = () => {
                return video.play();
            };
            
            window.getDuration = () => {
                return video.duration;
            };
        </script>
    </body>
    </html>
  `;
}

export async function POST(request: Request) {
  let browser: Browser | null = null;
  
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
    let videoUrl: string;

    if (videoPath) {
      finalVideoPath = path.join(tempDir, videoPath);
      videoUrl = `/temp/${videoPath}`;
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
      videoUrl = `/temp/${videoFileName}`;
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

    console.log(`Video info: ${videoWidth}x${videoHeight}, duration: ${videoDuration}s`);

    // 生成 HTML 內容
    const fullVideoUrl = `http://localhost:3005${videoUrl}`;
    const html = generateVideoWithSubtitlesHTML(fullVideoUrl, subtitles, videoWidth, videoHeight);
    
    // 保存 HTML 文件
    const htmlFileName = `video_with_subtitles_${Date.now()}.html`;
    const htmlPath = path.join(tempDir, htmlFileName);
    await fs.promises.writeFile(htmlPath, html, 'utf-8');

    // 啟動 Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();
    
    // 設置頁面大小
    await page.setViewport({
      width: videoWidth,
      height: videoHeight,
      deviceScaleFactor: 1
    });

    // 載入 HTML 頁面
    const htmlUrl = `file://${htmlPath}`;
    await page.goto(htmlUrl, { waitUntil: 'networkidle0' });

    // 開始錄製影片
    console.log('Starting video recording...');
    
    const outputFileName = `rendered_${Date.now()}.webm`;
    const outputPath = path.join(tempDir, outputFileName);

    // 使用 Puppeteer 錄製影片
    await page.evaluate(() => window.startRecording());
    
    // 等待影片加載完成
    await page.waitForFunction(() => {
      const video = document.getElementById('mainVideo') as HTMLVideoElement;
      return video && !isNaN(video.duration);
    });

    const duration = await page.evaluate(() => window.getDuration());
    console.log(`Recording duration: ${duration}s`);

    // 開始屏幕錄製
    const recordingOptions = {
      path: outputPath,
      format: 'webm' as const,
      quality: 50,
      fps: 30
    };

    // 由於 Puppeteer 本身不支持視頻錄製，我們使用 ffmpeg 進行屏幕錄製
    // 先截圖生成關鍵幀，然後用 ffmpeg 生成視頻
    const framesDir = path.join(tempDir, `frames_${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });

    const fps = 30;
    const totalFrames = Math.ceil(duration * fps);
    
    console.log(`Generating ${totalFrames} frames...`);

    // 模擬播放並截圖
    for (let frame = 0; frame < totalFrames; frame++) {
      const currentTime = frame / fps;
      
      // 設置視頻時間
      await page.evaluate((time) => {
        const video = document.getElementById('mainVideo') as HTMLVideoElement;
        video.currentTime = time;
        
        // 手動觸發 timeupdate 事件來更新字幕
        const event = new Event('timeupdate');
        video.dispatchEvent(event);
      }, currentTime);

      // 等待一小段時間確保畫面更新
      await page.waitForTimeout(50);

      // 截圖
      const screenshotPath = path.join(framesDir, `frame_${frame.toString().padStart(6, '0')}.png`);
      await page.screenshot({
        path: screenshotPath,
        type: 'png'
      });

      // 進度報告
      if (frame % Math.ceil(totalFrames / 10) === 0) {
        console.log(`Progress: ${Math.round((frame / totalFrames) * 100)}%`);
      }
    }

    await browser.close();
    browser = null;

    // 使用 FFmpeg 將截圖序列轉換為視頻
    const finalOutputPath = path.join(tempDir, `final_${Date.now()}.mp4`);
    
    const ffmpegCommand = process.platform === 'win32'
      ? `ffmpeg -framerate ${fps} -i "${framesDir.replace(/\\/g, '/')}/frame_%06d.png" -i "${finalVideoPath.replace(/\\/g, '/')}" -c:v libx264 -c:a aac -pix_fmt yuv420p -shortest "${finalOutputPath.replace(/\\/g, '/')}"`
      : `ffmpeg -framerate ${fps} -i "${framesDir}/frame_%06d.png" -i "${finalVideoPath}" -c:v libx264 -c:a aac -pix_fmt yuv420p -shortest "${finalOutputPath}"`;

    console.log("Final FFmpeg command:", ffmpegCommand);

    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });

    if (stdout) console.log("FFmpeg stdout:", stdout);
    if (stderr) console.log("FFmpeg stderr:", stderr);

    // 讀取最終輸出
    const outputBuffer = await fs.promises.readFile(finalOutputPath);

    // 清理臨時檔案
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.unlink(htmlPath);
      await fs.promises.rmdir(framesDir, { recursive: true });
      await fs.promises.unlink(finalOutputPath);
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