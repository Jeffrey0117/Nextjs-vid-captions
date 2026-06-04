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
    enableStroke: boolean;
    strokeColor: string;
    strokeWidth: number;
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

interface PinnedSubtitle {
  id: string;
  text: string;
  position: 'top' | 'bottom';
  enabled: boolean;
  style: {
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    color: string;
    opacity: number;
    backgroundColor: string;
    enableShadow: boolean;
    shadowColor: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    enableStroke: boolean;
    strokeColor: string;
    strokeWidth: number;
    positionY: number;
  };
}

// 將顏色轉換為 FFmpeg 顏色格式
function hexToFFmpegColor(color: string): string {
  // 處理 transparent
  if (color === 'transparent') {
    return '0x00000000'; // 完全透明的黑色
  }

  // 處理 rgba(r,g,b,a) 格式
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    const a = rgbaMatch[4] ? Math.round(parseFloat(rgbaMatch[4]) * 255).toString(16).padStart(2, '0') : 'FF';
    return `0x${a}${r}${g}${b}`; // FFmpeg 格式: 0xAARRGGBB
  }

  // 處理 #RRGGBB 或 #RGB 格式
  let hex = color.startsWith('#') ? color.slice(1) : color;

  // 處理 #RGB 格式，轉為 #RRGGBB
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  return `0x${hex}`;
}

// 生成固定字幕的 drawbox + drawtext filters（支援全寬背景）
function generatePinnedDrawTextFilters(pinnedSubtitles: PinnedSubtitle[], videoWidth: number, videoHeight: number): string {
  const filters: string[] = [];

  pinnedSubtitles.forEach((pinned, index) => {
    if (!pinned.enabled) return; // 跳過未啟用的固定字幕

    const style = pinned.style;
    const displayText = pinned.text;

    // 基於 1080p 的縮放係數
    const scaleFactor = videoHeight / 1080;

    // 計算位置 (水平居中，垂直使用 positionY)
    const centerX = videoWidth / 2; // 水平居中
    const centerY = Math.round((style.positionY / 100) * videoHeight);

    // 使用 fontconfig 讓 FFmpeg 自動找字體（支援中文）
    // 根據 fontWeight 選擇正確的字體
    const fontName = style.fontWeight === 'bold'
      ? 'Microsoft JhengHei UI Bold'  // 粗體
      : 'Microsoft JhengHei UI';       // 正常

    // 字體大小 (基於 1080p 縮放)
    const fontSize = Math.round((style.fontSize / 1080) * videoHeight);

    // 顏色處理 - 需要考慮 opacity
    let textColor = hexToFFmpegColor(style.color);
    // 應用 opacity 到文字顏色
    if (style.opacity < 1) {
      const colorStr = textColor.replace('0x', '');
      let alpha, rgb;
      if (colorStr.length === 8) {
        alpha = parseInt(colorStr.substring(0, 2), 16);
        rgb = colorStr.substring(2);
      } else {
        alpha = 255;
        rgb = colorStr;
      }
      const finalAlpha = Math.round(alpha * style.opacity).toString(16).padStart(2, '0');
      textColor = `0x${finalAlpha}${rgb}`;
    }

    const shadowColor = style.enableShadow ? hexToFFmpegColor(style.shadowColor) : textColor;

    // 處理文字內容，轉義特殊字符
    const escapedText = displayText
      .replace(/\\/g, '\\\\\\\\')
      .replace(/'/g, "\\\\'")
      .replace(/"/g, '\\\\"')
      .replace(/:/g, '\\\\:')
      .replace(/\n/g, '\\n');

    // 如果有背景色且不是透明，先繪製全寬背景矩形
    if (style.backgroundColor !== 'transparent') {
      let bgColor = hexToFFmpegColor(style.backgroundColor);

      // 應用 opacity 到背景色
      if (style.opacity < 1) {
        const colorStr = bgColor.replace('0x', '');
        let alpha, rgb;
        if (colorStr.length === 8) {
          alpha = parseInt(colorStr.substring(0, 2), 16);
          rgb = colorStr.substring(2);
        } else {
          alpha = 255;
          rgb = colorStr;
        }
        const finalAlpha = Math.round(alpha * style.opacity).toString(16).padStart(2, '0');
        bgColor = `0x${finalAlpha}${rgb}`;
      }

      // 計算背景矩形尺寸（寬度90%，高度根據字體大小 + padding）
      const boxWidth = Math.round(videoWidth * 0.9);
      const boxX = Math.round(videoWidth * 0.05); // 左邊距 5%
      const verticalPadding = Math.round(fontSize * 0.5); // 上下 padding
      const boxHeight = Math.round(fontSize + verticalPadding * 2);
      const boxY = Math.round(centerY - boxHeight / 2); // 垂直居中

      // 繪製全寬背景矩形（使用 drawbox filter）
      // drawbox 格式: drawbox=x:y:w:h:color:t (t=thickness, fill 用 'fill')
      // 轉換顏色格式從 0xAARRGGBB 到 drawbox 需要的格式
      // drawbox 接受 color@alpha 格式，其中 alpha 是 0.0-1.0
      let boxColorStr = bgColor.replace('0x', '');
      let boxAlpha = '1.0';
      let boxRGB = boxColorStr;

      if (boxColorStr.length === 8) {
        // 有 alpha: 0xAARRGGBB
        const alphaHex = boxColorStr.substring(0, 2);
        boxAlpha = (parseInt(alphaHex, 16) / 255).toFixed(2);
        boxRGB = boxColorStr.substring(2);
      }

      // FFmpeg drawbox 使用 0xRRGGBB@alpha 格式
      const drawBoxFilter = `drawbox=x=${boxX}:y=${boxY}:w=${boxWidth}:h=${boxHeight}:color=0x${boxRGB}@${boxAlpha}:t=fill`;
      filters.push(drawBoxFilter);
    }

    // 構建 drawtext filter (在背景之上繪製文字)
    let drawTextFilter = `drawtext=font='${fontName}':text='${escapedText}':fontsize=${fontSize}:fontcolor=${textColor}:x=${centerX}-text_w/2:y=${centerY}-text_h/2`;

    // 添加描邊效果
    if (style.enableStroke && style.strokeWidth > 0) {
      const strokeColor = hexToFFmpegColor(style.strokeColor);
      const scaledStrokeWidth = Math.round((style.strokeWidth / 1080) * videoHeight);
      drawTextFilter += `:borderw=${scaledStrokeWidth}:bordercolor=${strokeColor}`;
    }

    // 添加陰影效果
    if (style.enableShadow) {
      const scaledShadowX = Math.round((style.shadowOffsetX / 1080) * videoHeight);
      const scaledShadowY = Math.round((style.shadowOffsetY / 1080) * videoHeight);
      drawTextFilter += `:shadowcolor=${shadowColor}:shadowx=${scaledShadowX}:shadowy=${scaledShadowY}`;
    }

    filters.push(drawTextFilter);
  });

  return filters.join(',');
}

// 生成高品質的 FFmpeg drawtext filter
function generateDrawTextFilters(subtitles: SubtitleSegment[], videoWidth: number, videoHeight: number): string {
  const filters: string[] = [];

  subtitles.forEach((segment, index) => {
    const { text, translatedText, style: rawStyle } = segment;
    // 優先使用翻譯文本
    const displayText = translatedText || text;
    
    // 確保樣式包含所有必要的屬性，提供預設值
    const defaultStyle = {
      fontSize: 24,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#FFFFFF',
      opacity: 1,
      backgroundColor: 'transparent',
      position: 'bottom',
      enableShadow: false,
      shadowColor: '#000000',
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowBlur: 0,
      enableStroke: false,
      strokeColor: '#000000',
      strokeWidth: 2,
      positionX: 50,
      positionY: 85,
      maxWidth: 80,
      scale: 1
    };
    
    const style = { ...defaultStyle, ...rawStyle };

    // 基於 1080p 的縮放係數（與瀏覽器預覽一致）
    const scaleFactor = videoHeight / 1080;

    // 計算位置 (百分比轉像素)
    const x = Math.round((style.positionX / 100) * videoWidth);
    const y = Math.round((style.positionY / 100) * videoHeight);

    // 使用 fontconfig 讓 FFmpeg 自動找字體（支援中文）
    // 根據 fontWeight 選擇正確的字體
    const fontName = style.fontWeight === 'bold'
      ? 'Microsoft JhengHei UI Bold'  // 粗體
      : 'Microsoft JhengHei UI';       // 正常

    // 字體大小 (基於 1080p 縮放，與瀏覽器預覽一致)
    const fontSize = Math.round((style.fontSize * style.scale / 1080) * videoHeight);

    // 顏色處理
    const textColor = hexToFFmpegColor(style.color);
    const shadowColor = style.enableShadow ? hexToFFmpegColor(style.shadowColor) : textColor;

    // 處理文字內容，轉義特殊字符
    const escapedText = displayText
      .replace(/\\/g, '\\\\\\\\')  // 反斜線
      .replace(/'/g, "\\\\'")      // 單引號
      .replace(/"/g, '\\\\"')      // 雙引號
      .replace(/:/g, '\\\\:')      // 冒號
      .replace(/\n/g, '\\n');      // 換行

    // 構建 drawtext filter
    // 使用 font 參數讓 FFmpeg 通過 fontconfig 自動查找字體
    let drawTextFilter = `drawtext=font='${fontName}':text='${escapedText}':fontsize=${fontSize}:fontcolor=${textColor}:x=${x}-text_w/2:y=${y}-text_h/2:enable='between(t,${segment.startTime},${segment.endTime})'`;

    // 添加描邊效果 (基於 1080p 縮放)
    if (style.enableStroke && style.strokeWidth > 0) {
      const strokeColor = hexToFFmpegColor(style.strokeColor);
      const scaledStrokeWidth = Math.round((style.strokeWidth / 1080) * videoHeight);
      drawTextFilter += `:borderw=${scaledStrokeWidth}:bordercolor=${strokeColor}`;
    }

    // 添加陰影效果 (基於 1080p 縮放)
    if (style.enableShadow) {
      const scaledShadowX = Math.round((style.shadowOffsetX / 1080) * videoHeight);
      const scaledShadowY = Math.round((style.shadowOffsetY / 1080) * videoHeight);
      drawTextFilter += `:shadowcolor=${shadowColor}:shadowx=${scaledShadowX}:shadowy=${scaledShadowY}`;
    }

    // 添加背景色
    if (style.backgroundColor !== 'transparent') {
      const bgColor = hexToFFmpegColor(style.backgroundColor);
      const boxPadding = Math.round((10 / 1080) * videoHeight);
      drawTextFilter += `:box=1:boxcolor=${bgColor}:boxborderw=${boxPadding}`;
    }
    
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
    const pinnedSubtitlesJson = formData.get("pinnedSubtitles") as string;

    console.log("📊 Form data received:", {
      hasVideoFile: !!videoFile,
      videoPath: videoPath,
      subtitlesExists: !!subtitlesJson,
      pinnedSubtitlesExists: !!pinnedSubtitlesJson
    });

    if ((!videoFile && !videoPath) || !subtitlesJson) {
      return NextResponse.json(
        { error: "Missing video or subtitles" },
        { status: 400 }
      );
    }

    const subtitles: SubtitleSegment[] = JSON.parse(subtitlesJson);
    const pinnedSubtitles: PinnedSubtitle[] = pinnedSubtitlesJson ? JSON.parse(pinnedSubtitlesJson) : [];
    console.log("📝 Processing", subtitles.length, "subtitle segments and", pinnedSubtitles.filter(p => p.enabled).length, "enabled pinned subtitles");
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

    // 生成 drawtext filters (固定字幕 + 普通字幕)
    console.log("🎨 Generating drawtext filters...");
    const pinnedFilters = generatePinnedDrawTextFilters(pinnedSubtitles, videoWidth, videoHeight);
    const subtitleFilters = generateDrawTextFilters(subtitles, videoWidth, videoHeight);

    // 合併 filter：先渲染固定字幕（底層），再渲染普通字幕（頂層）
    const drawTextFilters = pinnedFilters
      ? (subtitleFilters ? `${pinnedFilters},${subtitleFilters}` : pinnedFilters)
      : subtitleFilters;

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