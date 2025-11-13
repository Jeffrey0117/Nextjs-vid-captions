import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

/**
 * 將前端發送的PNG幀序列合成影片
 * 這個方案直接使用前端渲染的畫面，保證100%一致
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const videoPath = formData.get("videoPath") as string;
    const framesDataJson = formData.get("framesData") as string; // Base64編碼的PNG幀
    const fps = parseInt(formData.get("fps") as string) || 30;
    const totalFrames = parseInt(formData.get("totalFrames") as string);

    console.log(`🎬 收到錄製請求: ${totalFrames} 幀, ${fps} FPS`);

    if (!framesDataJson) {
      return NextResponse.json(
        { error: "缺少幀數據" },
        { status: 400 }
      );
    }

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    const framesDir = path.join(tempDir, `frames_${Date.now()}`);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(framesDir, { recursive: true });

    // 解析幀數據
    const framesData: string[] = JSON.parse(framesDataJson);
    console.log(`📦 解析到 ${framesData.length} 幀`);

    // 儲存PNG幀
    console.log("💾 儲存PNG幀...");
    for (let i = 0; i < framesData.length; i++) {
      const frameData = framesData[i].replace(/^data:image\/png;base64,/, "");
      const frameBuffer = Buffer.from(frameData, "base64");
      const framePath = path.join(framesDir, `frame_${i.toString().padStart(8, '0')}.png`);
      await fs.promises.writeFile(framePath, frameBuffer);

      if (i % 100 === 0) {
        console.log(`  儲存進度: ${i}/${framesData.length}`);
      }
    }

    // 獲取原始影片路徑
    let originalVideoPath: string;
    if (videoPath) {
      originalVideoPath = path.join(tempDir, videoPath);
    } else if (videoFile) {
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      const videoFileName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;
      originalVideoPath = path.join(tempDir, videoFileName);
      await fs.promises.writeFile(originalVideoPath, videoBuffer);
    } else {
      return NextResponse.json({ error: "缺少影片" }, { status: 400 });
    }

    // 輸出檔案路徑
    const outputFileName = `recorded_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("🎥 開始FFmpeg合成...");

    // 使用FFmpeg將PNG序列和原始音頻合成
    const ffmpegCommand = `ffmpeg -framerate ${fps} -i "${framesDir}/frame_%08d.png" -i "${originalVideoPath}" -map 0:v -map 1:a? -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy "${outputPath}"`;

    console.log("FFmpeg命令:", ffmpegCommand);

    const { stdout, stderr } = await execAsync(ffmpegCommand, {
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer
    });

    if (stdout) console.log("FFmpeg stdout:", stdout);
    if (stderr) console.log("FFmpeg stderr:", stderr);

    // 檢查輸出檔案
    if (!fs.existsSync(outputPath)) {
      throw new Error("影片合成失敗");
    }

    console.log("✅ 合成完成！");

    // 讀取輸出檔案
    const videoBuffer = await fs.promises.readFile(outputPath);

    // 清理臨時檔案
    try {
      await fs.promises.rm(framesDir, { recursive: true, force: true });
      // 不刪除輸出檔案，留待後續下載
    } catch (cleanupError) {
      console.warn("清理臨時檔案失敗:", cleanupError);
    }

    // 返回影片
    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="recorded_video.mp4"`,
      },
    });

  } catch (error: any) {
    console.error("❌ 錄製失敗:", error);
    return NextResponse.json(
      { error: error.message || "錄製失敗" },
      { status: 500 }
    );
  }
}
