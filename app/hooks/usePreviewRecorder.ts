import { useState, useRef, useCallback } from 'react';
import { SubtitleSegment, PinnedSubtitle } from '../stores/subtitle-store';

interface RecorderOptions {
  fps?: number;
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
    const { fps = 30, onProgress, onComplete, onError } = options;

    setIsRecording(true);
    setProgress(0);
    setStatus('準備錄製...');
    cancelledRef.current = false;

    try {
      const duration = videoElement.duration;
      const totalFrames = Math.ceil(duration * fps);
      const frameDuration = 1 / fps;

      console.log(`🎬 開始錄製: ${duration}秒, ${totalFrames}幀, ${fps}FPS`);

      // 創建離屏Canvas用於渲染
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      // 存儲所有幀
      const frames: string[] = [];

      // 暫停影片
      const wasPlaying = !videoElement.paused;
      videoElement.pause();

      // 逐幀錄製
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (cancelledRef.current) {
          setStatus('已取消');
          setIsRecording(false);
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

        // === 繪製影片幀 ===
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // === 繪製字幕 ===
        await drawSubtitles(
          ctx,
          currentTime,
          subtitles,
          pinnedSubtitles,
          canvas.width,
          canvas.height,
          videoDisplaySize
        );

        // 導出PNG
        const frameData = canvas.toDataURL('image/png', 1.0);
        frames.push(frameData);

        // 更新進度
        const currentProgress = (frameIndex + 1) / totalFrames;
        setProgress(currentProgress * 0.8); // 80%用於錄製，20%用於合成
        setStatus(`錄製中... ${frameIndex + 1}/${totalFrames} 幀`);
        onProgress?.(currentProgress * 0.8);

        // 每10幀輸出一次日誌
        if (frameIndex % 10 === 0) {
          console.log(`錄製進度: ${frameIndex}/${totalFrames}`);
        }
      }

      console.log(`✅ 錄製完成，共 ${frames.length} 幀`);
      setStatus('合成影片中...');

      // 恢復影片播放狀態
      if (wasPlaying) {
        videoElement.play();
      }

      // 發送到後端合成
      const formData = new FormData();
      formData.append('videoPath', videoPath);
      formData.append('framesData', JSON.stringify(frames));
      formData.append('fps', fps.toString());
      formData.append('totalFrames', totalFrames.toString());

      setStatus('上傳幀數據...');
      console.log('📤 上傳幀數據到後端...');

      const response = await fetch('/api/record-preview', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '合成失敗');
      }

      setProgress(0.95);
      setStatus('下載影片...');

      // 下載影片
      const blob = await response.blob();
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
