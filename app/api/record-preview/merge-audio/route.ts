import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * WebCodecs音軌快速合併API
 *
 * 功能：將WebCodecs生成的無音軌MP4與原始視頻的音軌合併
 *
 * 核心優化：
 * - 使用FFmpeg -c copy（無需重編碼）
 * - 視頻流：直接複製（0損失，極快）
 * - 音頻流：直接複製（0損失，極快）
 * - 速度：60秒視頻僅需1-3秒
 *
 * 流程：
 * 1. 接收WebCodecs生成的無音軌視頻
 * 2. 接收原始視頻路徑
 * 3. FFmpeg快速合併音軌
 * 4. 返回帶音軌的完整視頻
 */

interface MergeAudioRequest {
  videoBlob: Blob;
  originalVideoPath: string;
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    console.log('🎵 開始音軌合併處理...');

    // 1. 接收FormData
    const formData = await request.formData();
    const videoBlob = formData.get('video') as Blob;
    const originalVideoPath = formData.get('originalVideoPath') as string;

    if (!videoBlob || !originalVideoPath) {
      return NextResponse.json(
        { error: '缺少必要參數：video或originalVideoPath' },
        { status: 400 }
      );
    }

    console.log('📦 接收數據:', {
      videoSize: `${(videoBlob.size / 1024 / 1024).toFixed(2)}MB`,
      originalPath: originalVideoPath,
    });

    // 2. 創建臨時目錄
    const tempDir = path.join(os.tmpdir(), 'webcodecs-merge');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const sessionId = `merge_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sessionDir = path.join(tempDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // 3. 保存WebCodecs生成的視頻
    const noAudioVideoPath = path.join(sessionDir, 'video_no_audio.mp4');
    const arrayBuffer = await videoBlob.arrayBuffer();
    fs.writeFileSync(noAudioVideoPath, Buffer.from(arrayBuffer));
    tempFiles.push(noAudioVideoPath);

    console.log('💾 無音軌視頻已保存:', noAudioVideoPath);

    // 4. 驗證原始視頻存在
    if (!fs.existsSync(originalVideoPath)) {
      throw new Error(`原始視頻不存在: ${originalVideoPath}`);
    }

    // 5. 輸出路徑
    const outputPath = path.join(sessionDir, 'output_with_audio.mp4');
    tempFiles.push(outputPath);

    // 6. 🔥 FFmpeg快速音軌合併（關鍵優化）
    console.log('🚀 開始FFmpeg音軌合併...');

    const ffmpegArgs = [
      '-i', noAudioVideoPath,     // 輸入1：WebCodecs生成的無音軌視頻
      '-i', originalVideoPath,     // 輸入2：原始視頻（音軌來源）
      '-map', '0:v',              // 映射輸入0的視頻流
      '-map', '1:a',              // 映射輸入1的音頻流
      '-c:v', 'copy',             // 🔥 關鍵：視頻流不重編碼（極快）
      '-c:a', 'copy',             // 🔥 關鍵：音頻流不重編碼（極快）
      '-shortest',                // 以較短的流為準
      '-y',                       // 覆蓋輸出文件
      outputPath
    ];

    const startTime = Date.now();

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (code === 0) {
          console.log(`✅ FFmpeg合併完成！耗時: ${duration}s`);
          resolve();
        } else {
          console.error('❌ FFmpeg合併失敗:', stderr);
          reject(new Error(`FFmpeg失敗，退出碼: ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg進程錯誤:', error);
        reject(error);
      });
    });

    // 7. 讀取輸出文件
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg輸出文件不存在');
    }

    const outputBuffer = fs.readFileSync(outputPath);
    const outputSize = (outputBuffer.length / 1024 / 1024).toFixed(2);

    console.log('🎉 音軌合併成功！', {
      outputSize: `${outputSize}MB`,
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    });

    // 8. 清理臨時文件
    setTimeout(() => {
      try {
        tempFiles.forEach((file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
        if (fs.existsSync(sessionDir)) {
          fs.rmdirSync(sessionDir);
        }
        console.log('🧹 臨時文件已清理');
      } catch (error) {
        console.error('⚠️ 清理臨時文件失敗:', error);
      }
    }, 5000);

    // 9. 返回帶音軌的視頻
    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="output_webcodecs.mp4"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('❌ 音軌合併失敗:', error);

    // 清理臨時文件
    tempFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (e) {}
    });

    return NextResponse.json(
      {
        error: '音軌合併失敗',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
