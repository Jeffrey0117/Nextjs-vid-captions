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
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

// 生成 ASS 格式字幕 (更好的渲染效果)
function generateAdvancedASS(segments: SubtitleSegment[]): string {
  let assContent = `[Script Info]
Title: Advanced Subtitle
ScriptType: v4.00+
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  const styles = new Set<string>();
  
  segments.forEach((segment, index) => {
    const { style } = segment;
    const styleName = `Style${index}`;
    
    // 計算顏色值 (ASS 使用 BGR 格式)
    const primaryColor = hexToBGR(style.color);
    const shadowColor = hexToBGR(style.shadowColor);
    const backgroundColor = style.backgroundColor === 'transparent' ? '&H00000000' : hexToBGR(style.backgroundColor);
    
    // 計算對齊方式 (ASS 數字格式)
    let alignment = 2; // 底部居中
    if (style.position === 'top') alignment = 8;
    else if (style.position === 'center') alignment = 5;
    
    const styleString = `Style: ${styleName},${style.fontFamily},${style.fontSize},${primaryColor},${primaryColor},${shadowColor},${backgroundColor},${style.fontWeight === 'bold' ? 1 : 0},${style.fontStyle === 'italic' ? 1 : 0},${style.textDecoration === 'underline' ? 1 : 0},${style.textDecoration === 'line-through' ? 1 : 0},100,100,0,0,1,${style.enableShadow ? 2 : 0},${style.enableShadow ? style.shadowBlur / 5 : 0},${alignment},10,10,10,1`;
    
    if (!styles.has(styleString)) {
      styles.add(styleString);
      assContent += styleString + '\n';
    }
  });

  assContent += `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  segments.forEach((segment, index) => {
    const startTime = formatAssTime(segment.startTime);
    const endTime = formatAssTime(segment.endTime);
    const styleName = `Style${index}`;
    
    // 處理位置 (使用 ASS 標籤)
    let positionTag = '';
    if (segment.style.positionX !== 50 || segment.style.positionY !== 90) {
      // 計算實際像素位置 (假設 1920x1080)
      const x = Math.round((segment.style.positionX / 100) * 1920);
      const y = Math.round((segment.style.positionY / 100) * 1080);
      positionTag = `{\\pos(${x},${y})}`;
    }
    
    // 處理縮放
    let scaleTag = '';
    if (segment.style.scale !== 1.0) {
      const scalePercent = Math.round(segment.style.scale * 100);
      scaleTag = `{\\fscx${scalePercent}\\fscy${scalePercent}}`;
    }
    
    const text = segment.text.replace(/\n/g, '\\N');
    assContent += `Dialogue: 0,${startTime},${endTime},${styleName},,0,0,0,,${positionTag}${scaleTag}${text}\n`;
  });

  return assContent;
}

// 將 HEX 顏色轉換為 ASS BGR 格式
function hexToBGR(hex: string): string {
  if (hex.startsWith('#')) hex = hex.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `&H00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`;
}

// 格式化時間為 ASS 格式
function formatAssTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100); // 百分之一秒
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export async function POST(request: Request) {
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

    // 生成高級 ASS 字幕檔
    const assContent = generateAdvancedASS(subtitles);
    const assFileName = `advanced_subtitle_${Date.now()}.ass`;
    const assPath = path.join(tempDir, assFileName);
    await fs.promises.writeFile(assPath, assContent, "utf-8");

    // 輸出檔案路徑
    const outputFileName = `canvas_rendered_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("Starting advanced ASS subtitle rendering...");
    console.log("Video path:", finalVideoPath);
    console.log("ASS path:", assPath);
    console.log("Output path:", outputPath);

    // 使用改進的 FFmpeg 命令與高級 ASS 渲染
    let ffmpegCommand: string;
    
    if (process.platform === 'win32') {
      const videoPathNormalized = finalVideoPath.replace(/\\/g, '/');
      const outputPathNormalized = outputPath.replace(/\\/g, '/');
      const assPathEscaped = assPath.replace(/\\/g, '\\\\\\\\').replace(/:/g, '\\\\:');
      
      // 使用更高質量的編碼設置
      ffmpegCommand = `ffmpeg -i "${videoPathNormalized}" -vf "ass=${assPathEscaped}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "${outputPathNormalized}"`;
    } else {
      ffmpegCommand = `ffmpeg -i "${finalVideoPath}" -vf "ass=${assPath}" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "${outputPath}"`;
    }
    
    console.log("FFmpeg command:", ffmpegCommand);
    
    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer
    });

    if (stdout) console.log("FFmpeg stdout:", stdout);
    if (stderr) console.log("FFmpeg stderr:", stderr);

    // 讀取輸出影片
    const outputBuffer = await fs.promises.readFile(outputPath);

    // 清理臨時檔案
    try {
      if (!videoPath) await fs.promises.unlink(finalVideoPath);
      await fs.promises.unlink(assPath);
      await fs.promises.unlink(outputPath);
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="canvas_rendered_video.mp4"`,
      },
    });

  } catch (error: any) {
    console.error("Error in canvas video rendering:", error);

    return NextResponse.json(
      { error: "Canvas video rendering failed", details: error.message },
      { status: 500 }
    );
  }
}