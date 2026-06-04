import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { buildFFmpegFilterChain, FFmpegFiltersConfig } from "@/app/types/video-quality";

const execAsync = promisify(exec);

/**
 * 合成最終影片API
 *
 * 方案2優化：流式數據傳輸與批次處理
 * - 確認所有批次已接收
 * - 使用FFmpeg合成PNG序列為視頻
 * - 返回最終視頻文件
 */
export async function POST(request: Request) {
  try {
    const { sessionId, filters } = await request.json();

    console.log(`🎥 開始合成會話: ${sessionId}`);

    if (!sessionId) {
      return NextResponse.json(
        { error: "缺少sessionId" },
        { status: 400 }
      );
    }

    // 解析滤镜配置
    const filterConfig: FFmpegFiltersConfig | undefined = filters;

    // 檢查會話目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    const sessionDir = path.join(tempDir, sessionId);
    const framesDir = path.join(sessionDir, "frames");
    const metaPath = path.join(sessionDir, "meta.json");

    if (!fs.existsSync(sessionDir) || !fs.existsSync(metaPath)) {
      return NextResponse.json(
        { error: "會話不存在或已過期" },
        { status: 404 }
      );
    }

    // 讀取元數據
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    console.log(`📊 會話資訊:`, {
      totalBatches: meta.totalBatches,
      receivedBatches: meta.receivedBatches.length,
      totalFrames: meta.totalFrames,
      fps: meta.fps,
    });

    // 確認所有批次都已接收
    if (meta.receivedBatches.length !== meta.totalBatches) {
      return NextResponse.json(
        {
          error: "部分批次未接收",
          receivedBatches: meta.receivedBatches.length,
          totalBatches: meta.totalBatches,
        },
        { status: 400 }
      );
    }

    // 檢查幀文件數量
    const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
    console.log(`📁 發現 ${frameFiles.length} 個幀文件`);

    if (frameFiles.length === 0) {
      return NextResponse.json(
        { error: "沒有找到幀文件" },
        { status: 400 }
      );
    }

    // 獲取原始影片路徑
    let originalVideoPath: string;
    if (meta.videoPath) {
      originalVideoPath = path.join(tempDir, meta.videoPath);
      if (!fs.existsSync(originalVideoPath)) {
        console.warn(`⚠️ 原始影片不存在: ${originalVideoPath}，將不包含音軌`);
        originalVideoPath = '';
      }
    } else {
      originalVideoPath = '';
    }

    // 輸出檔案路徑
    const outputFileName = `recorded_${sessionId}_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFileName);

    console.log("🎥 開始FFmpeg合成...");

    // 构建滤镜链
    let filterChain = '';
    if (filterConfig && filterConfig.enabled) {
      filterChain = buildFFmpegFilterChain(filterConfig);
      console.log(`🎨 应用滤镜链: ${filterChain}`);
    }

    // 构建FFmpeg编码参数（基于filterConfig的质量级别）
    // 默认使用balanced质量，如果有filterConfig则从中推断质量级别
    let encodingParams = {
      preset: 'medium',
      crf: 18,
      pixFmt: 'yuv420p',
      extraArgs: [] as string[]
    };

    // 根据滤镜配置推断质量级别并应用对应参数
    if (filterConfig && filterConfig.enabled) {
      // 检测ultra模式特征：scale with lanczos + sharpen强度较高
      if (filterConfig.scale?.algorithm === 'lanczos' &&
          filterConfig.scale?.flags?.includes('full_chroma_int')) {
        // Ultra模式 - Near-Lossless极致画质
        encodingParams = {
          preset: 'veryslow',
          crf: 15,
          pixFmt: 'yuv444p',
          extraArgs: [
            '-tune', 'film',
            '-profile:v', 'high444',
            '-x264-params', 'ref=6:me=umh:subme=10:trellis=2:aq-mode=3:psy-rd=1.0,0.15:bframes=8:keyint=10'
          ]
        };
      } else if (filterConfig.sharpen?.enabled) {
        // High模式 - 高质量
        encodingParams = {
          preset: 'slow',
          crf: 16,
          pixFmt: 'yuv420p',
          extraArgs: [
            '-tune', 'film',
            '-x264-params', 'ref=4:me=umh:subme=8:bframes=5:keyint=15'
          ]
        };
      }
    }

    // 使用FFmpeg將PNG序列和原始音頻合成
    let ffmpegCommand: string;
    const videoFilterArg = filterChain ? `-vf "${filterChain}"` : '';
    const extraArgsStr = encodingParams.extraArgs.length > 0
      ? encodingParams.extraArgs.join(' ') + ' '
      : '';

    if (originalVideoPath) {
      // 包含音軌
      ffmpegCommand = `ffmpeg -framerate ${meta.fps} -i "${framesDir}\\frame_%08d.png" -i "${originalVideoPath}" -map 0:v -map 1:a? ${videoFilterArg} -c:v libx264 -preset ${encodingParams.preset} -crf ${encodingParams.crf} -pix_fmt ${encodingParams.pixFmt} ${extraArgsStr}-c:a copy "${outputPath}"`;
    } else {
      // 不包含音軌
      ffmpegCommand = `ffmpeg -framerate ${meta.fps} -i "${framesDir}\\frame_%08d.png" ${videoFilterArg} -c:v libx264 -preset ${encodingParams.preset} -crf ${encodingParams.crf} -pix_fmt ${encodingParams.pixFmt} ${extraArgsStr}"${outputPath}"`;
    }

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

    const stats = fs.statSync(outputPath);
    console.log(`✅ 合成完成！文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 讀取輸出檔案
    const videoBuffer = await fs.promises.readFile(outputPath);

    // 清理臨時檔案（異步執行，不阻塞響應）
    setTimeout(async () => {
      try {
        console.log(`🧹 清理會話: ${sessionId}`);
        await fs.promises.rm(sessionDir, { recursive: true, force: true });
        if (fs.existsSync(outputPath)) {
          await fs.promises.unlink(outputPath);
        }
        console.log(`✅ 會話清理完成`);
      } catch (cleanupError) {
        console.warn("清理臨時檔案失敗:", cleanupError);
      }
    }, 5000); // 5秒後清理

    // 返回影片
    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="recorded_video.mp4"`,
        "Content-Length": videoBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error("❌ 合成失敗:", error);
    return NextResponse.json(
      { error: error.message || "合成失敗" },
      { status: 500 }
    );
  }
}
