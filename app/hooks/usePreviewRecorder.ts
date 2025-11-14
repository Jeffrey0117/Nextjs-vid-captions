import { useState, useRef, useCallback } from 'react';
import { SubtitleSegment, PinnedSubtitle } from '../stores/subtitle-store';
import { VideoQualityConfig, CanvasRenderingConfig, getQualityConfig, QualityLevel } from '../types/video-quality';
import { ColorManagementConfig, ColorQualityLevel, getColorConfig, getRecommendedColorConfig } from '../types/color-management';
import { VideoFrameExtractor, createOptimizedCanvas, applyCanvasRenderingQuality, exportCanvasToBlob } from '../utils/video-frame-extractor';

interface RecorderOptions {
  fps?: number;
  qualityLevel?: QualityLevel;
  customQuality?: Partial<VideoQualityConfig>;
  colorQuality?: ColorQualityLevel;
  customColorConfig?: Partial<ColorManagementConfig>;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function usePreviewRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const cancelledRef = useRef(false);

  /**
   * 直接錄製預覽畫面
   * 將video元素和所有字幕層繪製到Canvas，然後逐幀導出
   */
  const recordPreview = useCallback(async (
    videoElement: HTMLVideoElement,
    previewContainer: HTMLElement,
    subtitles: SubtitleSegment[],
    pinnedSubtitles: PinnedSubtitle[],
    videoDisplaySize: { width: number; height: number },
    videoPath: string,
    options: RecorderOptions = {}
  ) => {
    const {
      fps = 30,
      qualityLevel = 'balanced',
      customQuality,
      colorQuality = 'standard',
      customColorConfig,
      onProgress,
      onComplete,
      onError
    } = options;

    // 获取质量配置
    const qualityConfig = getQualityConfig(qualityLevel, customQuality);
    const renderConfig = qualityConfig.rendering;

    // 获取色彩管理配置
    let colorConfig: ColorManagementConfig;
    if (qualityConfig.colorManagement) {
      // 如果质量配置中已包含色彩配置，使用它
      colorConfig = qualityConfig.colorManagement;
    } else if (colorQuality) {
      // 否则根据色彩质量级别获取
      colorConfig = getColorConfig(colorQuality, customColorConfig);
    } else {
      // 或使用推荐配置
      colorConfig = getRecommendedColorConfig();
    }

    console.log(`📊 质量配置: ${qualityConfig.name || qualityLevel}`, {
      crf: qualityConfig.encoding.crf,
      preset: qualityConfig.encoding.preset,
      exportFormat: renderConfig.exportFormat,
      exportQuality: renderConfig.exportQuality,
    });

    console.log(`🎨 色彩配置: ${colorConfig.name || colorQuality}`, {
      colorSpace: colorConfig.canvas.colorSpace,
      extractionMode: colorConfig.frameExtraction.mode,
      colorSpaceConversion: colorConfig.frameExtraction.colorSpaceConversion,
    });

    setIsRecording(true);
    setProgress(0);
    setStatus('準備錄製...');
    cancelledRef.current = false;

    try {
      // 確保視頻已經載入
      if (videoElement.readyState < 2) {
        setStatus('等待視頻載入...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('視頻載入超時')), 30000);
          videoElement.addEventListener('loadeddata', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      }

      const duration = videoElement.duration;
      const totalFrames = Math.ceil(duration * fps);
      const frameDuration = 1 / fps;

      // 批次處理配置
      const BATCH_SIZE = 30; // 每批30幀（約1秒視頻，約15MB數據）
      const MAX_RETRIES = 3; // 最大重試次數
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const totalBatches = Math.ceil(totalFrames / BATCH_SIZE);

      console.log(`🎬 開始錄製: ${duration}秒, ${totalFrames}幀, ${fps}FPS`);
      console.log(`📦 批次配置: ${totalBatches}批, 每批${BATCH_SIZE}幀, SessionID: ${sessionId}`);
      console.log(`💾 預計內存峰值: ~${Math.ceil(BATCH_SIZE * 0.5)}MB (批次) vs ~${Math.ceil(totalFrames * 0.5)}MB (原方案)`);

      // 計算超采样尺寸
      const ssConfig = renderConfig.supersampling;
      const ssMultiplier = ssConfig.mode === '4x' ? 4 : ssConfig.mode === '2x' ? 2 : 1;

      // 获取源视频分辨率
      const sourceWidth = videoElement.videoWidth;
      const sourceHeight = videoElement.videoHeight;

      // 强制输出到更高分辨率（提升画质）
      // 如果源视频小于1080p，upscale到1080p
      let targetWidth = sourceWidth;
      let targetHeight = sourceHeight;

      const MIN_HEIGHT = 1080; // 最小输出高度
      if (sourceHeight < MIN_HEIGHT) {
        const scale = MIN_HEIGHT / sourceHeight;
        targetWidth = Math.round(sourceWidth * scale);
        targetHeight = MIN_HEIGHT;
        console.log(`📈 视频分辨率提升: ${sourceWidth}x${sourceHeight} → ${targetWidth}x${targetHeight} (${scale.toFixed(2)}x)`);
      } else {
        console.log(`✅ 源视频分辨率: ${sourceWidth}x${sourceHeight} (已达标)`);
      }

      console.log(`🎨 超采样配置: ${ssConfig.mode} (${ssMultiplier}x), 仅字幕: ${ssConfig.subtitlesOnly}, 算法: ${ssConfig.downscaleAlgorithm}`);

      // 創建主Canvas（用於視频+字幕合成）
      const canvas = document.createElement('canvas');

      // 根据超采样模式设置canvas尺寸
      const renderWidth = ssConfig.mode !== 'none' && !ssConfig.subtitlesOnly ? targetWidth * ssMultiplier : targetWidth;
      const renderHeight = ssConfig.mode !== 'none' && !ssConfig.subtitlesOnly ? targetHeight * ssMultiplier : targetHeight;

      canvas.width = renderWidth;
      canvas.height = renderHeight;

      // 使用高质量渲染设置
      const ctx = canvas.getContext('2d', {
        alpha: false,           // 禁用alpha通道，提升性能
        desynchronized: false,  // 确保同步渲染，保证质量
        willReadFrequently: true, // 优化频繁读取
      })!;

      // 应用Canvas渲染质量配置
      if (ctx.imageSmoothingEnabled !== undefined) {
        ctx.imageSmoothingEnabled = renderConfig.imageSmoothingEnabled;
      }
      if (ctx.imageSmoothingQuality) {
        ctx.imageSmoothingQuality = renderConfig.imageSmoothingQuality;
      }

      // 字体渲染优化（如果支持）
      if ((ctx as any).textRendering) {
        (ctx as any).textRendering = renderConfig.textRendering.quality;
      }
      if ((ctx as any).fontSmooth) {
        (ctx as any).fontSmooth = renderConfig.textRendering.fontSmoothing ? 'always' : 'never';
      }

      // 创建独立的字幕超采样canvas（如果启用）
      let subtitleCanvas: HTMLCanvasElement | null = null;
      let subtitleCtx: CanvasRenderingContext2D | null = null;
      let downscaleCanvas: HTMLCanvasElement | null = null;
      let downscaleCtx: CanvasRenderingContext2D | null = null;

      if (ssConfig.mode !== 'none' && ssConfig.subtitlesOnly && ssConfig.useSeperateCanvas) {
        // 创建超采样字幕canvas
        subtitleCanvas = document.createElement('canvas');
        subtitleCanvas.width = targetWidth * ssMultiplier;
        subtitleCanvas.height = targetHeight * ssMultiplier;
        subtitleCtx = subtitleCanvas.getContext('2d', {
          alpha: true,  // 需要alpha通道用于透明度
          desynchronized: false,
          willReadFrequently: true,
        })!;

        // 应用高质量渲染设置
        if (subtitleCtx.imageSmoothingEnabled !== undefined) {
          subtitleCtx.imageSmoothingEnabled = renderConfig.imageSmoothingEnabled;
        }
        if (subtitleCtx.imageSmoothingQuality) {
          subtitleCtx.imageSmoothingQuality = renderConfig.imageSmoothingQuality;
        }

        // 创建downscale canvas（用于高质量缩放）
        downscaleCanvas = document.createElement('canvas');
        downscaleCanvas.width = targetWidth;
        downscaleCanvas.height = targetHeight;
        downscaleCtx = downscaleCanvas.getContext('2d', {
          alpha: true,
          desynchronized: false,
          willReadFrequently: true,
        })!;

        // 设置高质量downscale
        if (downscaleCtx.imageSmoothingEnabled !== undefined) {
          downscaleCtx.imageSmoothingEnabled = true;
        }
        if (downscaleCtx.imageSmoothingQuality) {
          downscaleCtx.imageSmoothingQuality = 'high';
        }

        console.log(`🎨 创建独立字幕超采样canvas: ${subtitleCanvas.width}x${subtitleCanvas.height} -> ${downscaleCanvas.width}x${downscaleCanvas.height}`);
      }

      // 暫存當前批次的幀（內存優化關鍵：只保留當前批次，不保留所有幀）
      let currentBatchFrames: Blob[] = [];
      let currentBatchIndex = 0;

      // 暫停影片
      const wasPlaying = !videoElement.paused;
      videoElement.pause();

      /**
       * 發送批次數據到後端（帶重試機制）
       */
      const sendBatch = async (batchId: number, frames: Blob[], isLastBatch: boolean, retryCount = 0): Promise<void> => {
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('batchId', batchId.toString());
        formData.append('totalBatches', totalBatches.toString());
        formData.append('isLastBatch', isLastBatch.toString());
        formData.append('videoPath', videoPath);
        formData.append('fps', fps.toString());
        formData.append('totalFrames', totalFrames.toString());

        // 添加所有幀的Blob
        frames.forEach((frameBlob, index) => {
          const frameIndex = batchId * BATCH_SIZE + index;
          formData.append(`frame_${frameIndex}`, frameBlob, `frame_${frameIndex.toString().padStart(8, '0')}.png`);
        });

        try {
          const response = await fetch('/api/record-preview/batch', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`批次${batchId}上傳失敗: ${errorText}`);
          }

          const result = await response.json();
          console.log(`✅ 批次 ${batchId + 1}/${totalBatches} 上傳成功`, result);

        } catch (error: any) {
          if (retryCount < MAX_RETRIES) {
            console.warn(`⚠️ 批次${batchId}上傳失敗，重試 ${retryCount + 1}/${MAX_RETRIES}:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 遞增延遲
            return sendBatch(batchId, frames, isLastBatch, retryCount + 1);
          } else {
            throw new Error(`批次${batchId}上傳失敗（已重試${MAX_RETRIES}次）: ${error.message}`);
          }
        }
      };

      // 逐幀錄製
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (cancelledRef.current) {
          setStatus('已取消');
          setIsRecording(false);
          // 清理未完成的會話
          await fetch('/api/record-preview/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          }).catch(err => console.warn('清理會話失敗:', err));
          return;
        }

        const currentTime = frameIndex * frameDuration;

        // 設置影片時間
        videoElement.currentTime = currentTime;

        // 等待影片跳轉到指定時間
        await new Promise<void>((resolve) => {
          const checkTime = () => {
            if (Math.abs(videoElement.currentTime - currentTime) < 0.01) {
              resolve();
            } else {
              requestAnimationFrame(checkTime);
            }
          };
          checkTime();
        });

        // 再等一幀確保渲染完成
        await new Promise(resolve => requestAnimationFrame(resolve as any));

        // === 方案A：全画面超采样 ===
        if (ssConfig.mode !== 'none' && !ssConfig.subtitlesOnly) {
          // 以超采样分辨率渲染整个画面
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          // 在超采样分辨率下绘制字幕（使用Canvas实际尺寸，确保字幕最大化）
          await drawSubtitles(
            ctx,
            currentTime,
            subtitles,
            pinnedSubtitles,
            canvas.width,
            canvas.height,
            { width: canvas.width, height: canvas.height }  // 使用Canvas实际尺寸
          );

          // 创建临时的downscale canvas
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = targetWidth;
          finalCanvas.height = targetHeight;
          const finalCtx = finalCanvas.getContext('2d')!;
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = 'high';

          // Downscale到目标分辨率（使用高质量算法）
          finalCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);

          // 导出downscale后的帧
          const frameBlob = await new Promise<Blob>((resolve) => {
            finalCanvas.toBlob(
              (b) => resolve(b!),
              renderConfig.exportFormat,
              renderConfig.exportQuality
            );
          });
          currentBatchFrames.push(frameBlob);

        // === 方案B：仅字幕层超采样 ===
        } else if (ssConfig.mode !== 'none' && ssConfig.subtitlesOnly && subtitleCanvas && subtitleCtx && downscaleCanvas && downscaleCtx) {
          // 1. 主canvas绘制视频（原分辨率）
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          // 2. 在超采样canvas上绘制字幕（使用Canvas实际尺寸，确保字幕最大化）
          subtitleCtx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);
          await drawSubtitles(
            subtitleCtx,
            currentTime,
            subtitles,
            pinnedSubtitles,
            subtitleCanvas.width,
            subtitleCanvas.height,
            { width: subtitleCanvas.width, height: subtitleCanvas.height }  // 使用Canvas实际尺寸
          );

          // 3. Downscale字幕层
          downscaleCtx.clearRect(0, 0, downscaleCanvas.width, downscaleCanvas.height);
          downscaleCtx.drawImage(subtitleCanvas, 0, 0, subtitleCanvas.width, subtitleCanvas.height, 0, 0, targetWidth, targetHeight);

          // 4. 合成：视频 + downscaled字幕
          ctx.drawImage(downscaleCanvas, 0, 0);

          // 导出合成后的帧
          const frameBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(
              (b) => resolve(b!),
              renderConfig.exportFormat,
              renderConfig.exportQuality
            );
          });
          currentBatchFrames.push(frameBlob);

        // === 默认：无超采样 ===
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          // 绘制字幕（使用Canvas实际尺寸，确保字幕最大化）
          await drawSubtitles(
            ctx,
            currentTime,
            subtitles,
            pinnedSubtitles,
            canvas.width,
            canvas.height,
            { width: canvas.width, height: canvas.height }  // 使用Canvas实际尺寸
          );

          const frameBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(
              (b) => resolve(b!),
              renderConfig.exportFormat,
              renderConfig.exportQuality
            );
          });
          currentBatchFrames.push(frameBlob);
        }

        // 當批次滿了或是最後一幀，發送批次
        const isBatchFull = currentBatchFrames.length >= BATCH_SIZE;
        const isLastFrame = frameIndex === totalFrames - 1;

        if (isBatchFull || isLastFrame) {
          const batchId = currentBatchIndex;
          const isLastBatch = isLastFrame;

          setStatus(`上傳批次 ${batchId + 1}/${totalBatches}... (${currentBatchFrames.length}幀)`);
          console.log(`📤 發送批次 ${batchId}, ${currentBatchFrames.length} 幀`);

          await sendBatch(batchId, currentBatchFrames, isLastBatch);

          // 清空當前批次（內存優化關鍵點！立即釋放內存）
          currentBatchFrames = [];
          currentBatchIndex++;
        }

        // 更新進度（80%錄製+上傳，20%合成）
        const currentProgress = (frameIndex + 1) / totalFrames;
        setProgress(currentProgress * 0.8);
        setStatus(`錄製中... ${frameIndex + 1}/${totalFrames} 幀`);
        onProgress?.(currentProgress * 0.8);

        // 每10幀輸出一次日誌
        if (frameIndex % 10 === 0) {
          console.log(`錄製進度: ${frameIndex}/${totalFrames} (當前批次: ${currentBatchFrames.length}幀)`);
        }
      }

      console.log(`✅ 所有批次已發送，共 ${totalFrames} 幀`);
      setStatus('合成影片中...');
      setProgress(0.85);

      // 恢復影片播放狀態
      if (wasPlaying) {
        videoElement.play().catch(err => {
          console.warn('無法恢復播放:', err);
        });
      }

      // 等待後端完成合成並下載影片
      setStatus('等待後端合成...');
      const finalizeResponse = await fetch('/api/record-preview/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          filters: qualityConfig.filters, // 传递滤镜配置
        }),
      });

      if (!finalizeResponse.ok) {
        const errorText = await finalizeResponse.text();
        console.error('❌ 合成失敗:', errorText);
        throw new Error(`合成失敗: ${errorText}`);
      }

      setProgress(0.95);
      setStatus('下載影片...');

      // 下載影片
      const blob = await finalizeResponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recorded_${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      setProgress(1);
      setStatus('完成！');
      setIsRecording(false);
      onComplete?.();

      console.log('🎉 錄製完成！');

    } catch (error: any) {
      console.error('❌ 錄製失敗:', error);
      setStatus(`錯誤: ${error.message}`);
      setIsRecording(false);
      onError?.(error);

      // 嘗試清理會話
      try {
        await fetch('/api/record-preview/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (cleanupError) {
        console.warn('清理會話失敗:', cleanupError);
      }
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    setStatus('正在取消...');
  }, []);

  return {
    recordPreview,
    cancelRecording,
    isRecording,
    progress,
    status,
  };
}

/**
 * 在Canvas上繪製字幕（完全匹配CSS渲染）
 */
async function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  subtitles: SubtitleSegment[],
  pinnedSubtitles: PinnedSubtitle[],
  canvasWidth: number,
  canvasHeight: number,
  videoDisplaySize: { width: number; height: number }
) {
  // 計算縮放係數（Canvas尺寸 vs 顯示尺寸）
  const scaleX = canvasWidth / videoDisplaySize.width;
  const scaleY = canvasHeight / videoDisplaySize.height;

  // === 1. 繪製固定字幕 ===
  for (const pinned of pinnedSubtitles) {
    if (!pinned.enabled) continue;

    const x = canvasWidth / 2;
    const y = (pinned.style.positionY / 100) * canvasHeight;
    const fontSize = (pinned.style.fontSize / 1080) * videoDisplaySize.height * scaleY;

    drawText(ctx, {
      text: pinned.text,
      x,
      y,
      fontSize,
      fontFamily: pinned.style.fontFamily,
      fontWeight: pinned.style.fontWeight,
      fontStyle: pinned.style.fontStyle,
      color: pinned.style.color,
      opacity: pinned.style.opacity,
      backgroundColor: pinned.style.backgroundColor,
      enableShadow: pinned.style.enableShadow,
      shadowColor: pinned.style.shadowColor,
      shadowOffsetX: (pinned.style.shadowOffsetX / 1080) * videoDisplaySize.height * scaleY,
      shadowOffsetY: (pinned.style.shadowOffsetY / 1080) * videoDisplaySize.height * scaleY,
      shadowBlur: (pinned.style.shadowBlur / 1080) * videoDisplaySize.height * scaleY,
      enableStroke: pinned.style.enableStroke,
      strokeColor: pinned.style.strokeColor,
      strokeWidth: (pinned.style.strokeWidth / 1080) * videoDisplaySize.height * scaleY,
      maxWidth: canvasWidth * 0.9,
      textAlign: 'center',
    });
  }

  // === 2. 繪製當前字幕 ===
  const currentSubtitle = subtitles.find(
    seg => currentTime >= seg.startTime && currentTime <= seg.endTime
  );

  if (currentSubtitle) {
    const x = (currentSubtitle.style.positionX / 100) * canvasWidth;
    const y = (currentSubtitle.style.positionY / 100) * canvasHeight;
    const fontSize = (currentSubtitle.style.fontSize * currentSubtitle.style.scale / 1080) * videoDisplaySize.height * scaleY;
    const displayText = currentSubtitle.translatedText || currentSubtitle.text;

    drawText(ctx, {
      text: displayText,
      x,
      y,
      fontSize,
      fontFamily: currentSubtitle.style.fontFamily,
      fontWeight: currentSubtitle.style.fontWeight,
      fontStyle: currentSubtitle.style.fontStyle,
      color: currentSubtitle.style.color,
      opacity: currentSubtitle.style.opacity,
      backgroundColor: currentSubtitle.style.backgroundColor,
      enableShadow: currentSubtitle.style.enableShadow,
      shadowColor: currentSubtitle.style.shadowColor,
      shadowOffsetX: (currentSubtitle.style.shadowOffsetX / 1080) * videoDisplaySize.height * scaleY,
      shadowOffsetY: (currentSubtitle.style.shadowOffsetY / 1080) * videoDisplaySize.height * scaleY,
      shadowBlur: (currentSubtitle.style.shadowBlur / 1080) * videoDisplaySize.height * scaleY,
      enableStroke: currentSubtitle.style.enableStroke,
      strokeColor: currentSubtitle.style.strokeColor,
      strokeWidth: (currentSubtitle.style.strokeWidth / 1080) * videoDisplaySize.height * scaleY,
      maxWidth: (currentSubtitle.style.maxWidth / 100) * canvasWidth,
      textAlign: 'center',
      textDecoration: currentSubtitle.style.textDecoration,
    });
  }
}

interface DrawTextOptions {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
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
  maxWidth: number;
  textAlign: 'left' | 'center' | 'right';
  textDecoration?: string;
}

/**
 * 在Canvas上繪製文字（完全匹配CSS效果）
 */
function drawText(ctx: CanvasRenderingContext2D, options: DrawTextOptions) {
  const {
    text,
    x,
    y,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    color,
    opacity,
    backgroundColor,
    enableShadow,
    shadowColor,
    shadowOffsetX,
    shadowOffsetY,
    shadowBlur,
    enableStroke,
    strokeColor,
    strokeWidth,
    maxWidth,
    textAlign,
    textDecoration,
  } = options;

  ctx.save();

  // 設置字體
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';

  // 處理多行文字
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  // 繪製背景（如果有）
  if (backgroundColor !== 'transparent') {
    const padding = fontSize * 0.5;
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const bgWidth = maxLineWidth + padding * 2;
    const bgHeight = totalHeight + padding;
    const bgX = x - bgWidth / 2;
    const bgY = y - totalHeight / 2 - padding / 2;

    ctx.fillStyle = backgroundColor;
    ctx.globalAlpha = 1;
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
  }

  ctx.globalAlpha = opacity;

  // 繪製每一行
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;

    // 描邊效果（使用16個方向模擬CSS text-shadow）
    if (enableStroke && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * 2; // 乘以2因為Canvas strokeText在中心線
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const angle = (i * 2 * Math.PI) / steps;
        const offsetX = Math.cos(angle) * strokeWidth;
        const offsetY = Math.sin(angle) * strokeWidth;
        ctx.strokeText(line, x + offsetX, lineY + offsetY, maxWidth);
      }
    }

    // 陰影效果
    if (enableShadow) {
      ctx.shadowColor = shadowColor;
      ctx.shadowOffsetX = shadowOffsetX;
      ctx.shadowOffsetY = shadowOffsetY;
      ctx.shadowBlur = shadowBlur;
    }

    // 填充文字
    ctx.fillStyle = color;
    ctx.fillText(line, x, lineY, maxWidth);

    // 重置陰影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 文字裝飾（下劃線、刪除線）
    if (textDecoration && textDecoration !== 'none') {
      const metrics = ctx.measureText(line);
      const lineWidth = metrics.width;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, fontSize / 20);

      if (textDecoration === 'underline') {
        const underlineY = lineY + fontSize * 0.15;
        ctx.beginPath();
        ctx.moveTo(x - lineWidth / 2, underlineY);
        ctx.lineTo(x + lineWidth / 2, underlineY);
        ctx.stroke();
      } else if (textDecoration === 'line-through') {
        ctx.beginPath();
        ctx.moveTo(x - lineWidth / 2, lineY);
        ctx.lineTo(x + lineWidth / 2, lineY);
        ctx.stroke();
      }
    }
  });

  ctx.restore();
}
