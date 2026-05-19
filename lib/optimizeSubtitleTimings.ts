/**
 * 字幕时间轴优化工具
 * 通过音频静音检测来优化字幕的开始时间，避免字幕在说话前就出现
 */

import { spawn } from 'child_process';
import { Subtitle } from './types';

interface SilenceSegment {
  start: number;
  end: number;
}

interface VoiceSegment {
  start: number;
  end: number;
}

/**
 * 使用 ffmpeg 检测音频中的静音段落
 * @param audioPath 音频或视频文件路径
 * @param silenceThreshold 静音阈值（dB），默认 -30dB
 * @param minSilenceDuration 最小静音持续时间（秒），默认 0.3秒
 */
export async function detectSilence(
  audioPath: string,
  silenceThreshold: number = -30,
  minSilenceDuration: number = 0.3
): Promise<SilenceSegment[]> {
  return new Promise((resolve, reject) => {
    const silenceSegments: SilenceSegment[] = [];

    // ffmpeg silencedetect 命令
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioPath,
      '-af', `silencedetect=noise=${silenceThreshold}dB:d=${minSilenceDuration}`,
      '-f', 'null',
      '-'
    ]);

    let stderrData = '';

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderrData += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        // ffmpeg 有时返回 1 但仍成功
        console.warn(`ffmpeg exited with code ${code}`);
      }

      // 解析静音检测结果
      // 格式: [silencedetect @ ...] silence_start: 1.234
      //       [silencedetect @ ...] silence_end: 5.678 | silence_duration: 4.444
      const startMatches = stderrData.matchAll(/silence_start:\s*([\d.]+)/g);
      const endMatches = stderrData.matchAll(/silence_end:\s*([\d.]+)/g);

      const starts = Array.from(startMatches).map(m => parseFloat(m[1]));
      const ends = Array.from(endMatches).map(m => parseFloat(m[1]));

      // 组合成静音段落
      for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
        silenceSegments.push({
          start: starts[i],
          end: ends[i],
        });
      }

      console.log(`✅ 检测到 ${silenceSegments.length} 个静音段落`);
      resolve(silenceSegments);
    });

    ffmpeg.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        reject(new Error('ffmpeg 未安装。请安装 ffmpeg。'));
      } else {
        reject(error);
      }
    });
  });
}

/**
 * 从静音段落推导出语音段落
 */
function getVoiceSegments(silenceSegments: SilenceSegment[], totalDuration: number): VoiceSegment[] {
  const voiceSegments: VoiceSegment[] = [];

  if (silenceSegments.length === 0) {
    // 没有静音，整个音频都是语音
    return [{ start: 0, end: totalDuration }];
  }

  // 第一个语音段（从开始到第一个静音）
  if (silenceSegments[0].start > 0.1) {
    voiceSegments.push({
      start: 0,
      end: silenceSegments[0].start,
    });
  }

  // 中间的语音段（静音之间）
  for (let i = 0; i < silenceSegments.length - 1; i++) {
    const voiceStart = silenceSegments[i].end;
    const voiceEnd = silenceSegments[i + 1].start;

    if (voiceEnd - voiceStart > 0.1) {
      voiceSegments.push({ start: voiceStart, end: voiceEnd });
    }
  }

  // 最后一个语音段（最后一个静音到结束）
  const lastSilence = silenceSegments[silenceSegments.length - 1];
  if (totalDuration - lastSilence.end > 0.1) {
    voiceSegments.push({
      start: lastSilence.end,
      end: totalDuration,
    });
  }

  return voiceSegments;
}

/**
 * 找到最接近目标时间的语音开始点
 */
function findNearestVoiceStart(targetTime: number, voiceSegments: VoiceSegment[]): number {
  // 找到包含或最接近 targetTime 的语音段
  for (const segment of voiceSegments) {
    // 如果目标时间在语音段内，返回语音段的开始时间
    if (targetTime >= segment.start && targetTime <= segment.end) {
      return segment.start;
    }

    // 如果目标时间在语音段之前但很接近（0.5秒内），返回语音段开始
    if (targetTime < segment.start && segment.start - targetTime <= 0.5) {
      return segment.start;
    }
  }

  // 如果找不到合适的语音段，返回原始时间
  return targetTime;
}

/**
 * 优化字幕时间轴
 * @param subtitles 原始字幕数组
 * @param audioPath 音频/视频文件路径
 * @param options 优化选项
 */
export async function optimizeSubtitleTimings(
  subtitles: Subtitle[],
  audioPath: string,
  options: {
    silenceThreshold?: number;
    minSilenceDuration?: number;
    maxAdjustment?: number; // 最大调整幅度（秒），默认 0.5 秒
  } = {}
): Promise<Subtitle[]> {
  const {
    silenceThreshold = -30,
    minSilenceDuration = 0.3,
    maxAdjustment = 0.5,
  } = options;

  console.log('🔧 开始优化字幕时间轴...');
  console.log(`📁 音频文件: ${audioPath}`);
  console.log(`📊 字幕数量: ${subtitles.length}`);

  try {
    // 1. 检测静音段落
    const silenceSegments = await detectSilence(audioPath, silenceThreshold, minSilenceDuration);

    if (silenceSegments.length === 0) {
      console.log('⚠️ 未检测到明显静音段落，保持原始时间轴');
      return subtitles;
    }

    // 2. 计算总时长（使用最后一个字幕的结束时间作为估计）
    const totalDuration = Math.max(...subtitles.map(s => s.endTime)) + 1;

    // 3. 推导语音段落
    const voiceSegments = getVoiceSegments(silenceSegments, totalDuration);
    console.log(`🎤 检测到 ${voiceSegments.length} 个语音段落`);

    // 4. 优化每个字幕的开始时间
    let adjustedCount = 0;
    const optimizedSubtitles = subtitles.map((subtitle) => {
      const originalStart = subtitle.startTime;

      // 找到最近的语音开始点
      const optimizedStart = findNearestVoiceStart(originalStart, voiceSegments);

      // 检查调整幅度是否在允许范围内
      const adjustment = optimizedStart - originalStart;

      if (Math.abs(adjustment) > maxAdjustment) {
        // 调整幅度太大，保持原始时间
        return subtitle;
      }

      if (Math.abs(adjustment) > 0.05) {
        // 有显著调整（超过 50ms）
        adjustedCount++;
        console.log(`  ✏️ 字幕 #${subtitle.id}: ${originalStart.toFixed(3)}s → ${optimizedStart.toFixed(3)}s (${adjustment > 0 ? '+' : ''}${adjustment.toFixed(3)}s)`);

        return {
          ...subtitle,
          startTime: optimizedStart,
          // 保持持续时间不变
          endTime: optimizedStart + (subtitle.endTime - originalStart),
        };
      }

      return subtitle;
    });

    console.log(`✅ 优化完成！调整了 ${adjustedCount}/${subtitles.length} 个字幕`);
    return optimizedSubtitles;

  } catch (error) {
    console.error('❌ 字幕时间轴优化失败:', error);
    console.warn('⚠️ 将使用原始字幕时间轴');
    return subtitles;
  }
}

/**
 * 将优化后的字幕转换回 SRT 格式
 */
export function subtitlesToSRT(subtitles: Subtitle[]): string {
  return subtitles.map((subtitle, index) => {
    const startTime = formatSRTTime(subtitle.startTime);
    const endTime = formatSRTTime(subtitle.endTime);

    return `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
  }).join('\n');
}

/**
 * 格式化时间为 SRT 格式 (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
