/**
 * Canvas Renderer Web Worker
 *
 * 用于在后台线程中预处理Canvas渲染
 * 注意：OffscreenCanvas在某些浏览器中支持有限
 * 这个Worker主要用于图像数据的预处理和优化
 */

let canvasCache = null;
let ctxCache = null;

/**
 * 初始化OffscreenCanvas（如果支持）
 */
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'init':
        handleInit(data);
        break;

      case 'renderFrame':
        await handleRenderFrame(data);
        break;

      case 'dispose':
        handleDispose();
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
    });
  }
});

/**
 * 初始化Canvas
 */
function handleInit(data) {
  const { width, height, colorSpace } = data;

  // 检查OffscreenCanvas支持
  if (typeof OffscreenCanvas === 'undefined') {
    self.postMessage({
      type: 'init-result',
      success: false,
      reason: 'OffscreenCanvas not supported',
    });
    return;
  }

  try {
    canvasCache = new OffscreenCanvas(width, height);
    ctxCache = canvasCache.getContext('2d', {
      alpha: false,
      desynchronized: true,
      colorSpace: colorSpace || 'srgb',
    });

    if (!ctxCache) {
      throw new Error('Failed to get 2D context');
    }

    // 设置高质量渲染
    ctxCache.imageSmoothingEnabled = true;
    ctxCache.imageSmoothingQuality = 'high';

    self.postMessage({
      type: 'init-result',
      success: true,
      width,
      height,
    });

    console.log('✅ OffscreenCanvas initialized:', width, 'x', height);
  } catch (error) {
    self.postMessage({
      type: 'init-result',
      success: false,
      reason: error.message,
    });
  }
}

/**
 * 渲染帧（目前OffscreenCanvas无法直接访问HTMLVideoElement）
 * 所以这个方法主要用于图像数据的后处理
 */
async function handleRenderFrame(data) {
  const { frameIndex, imageData, subtitles, timestamp } = data;

  if (!canvasCache || !ctxCache) {
    throw new Error('Canvas not initialized');
  }

  try {
    // 将ImageData绘制到canvas
    if (imageData) {
      const imgData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      ctxCache.putImageData(imgData, 0, 0);
    }

    // 绘制字幕（简化版，完整逻辑在主线程）
    if (subtitles && subtitles.length > 0) {
      for (const subtitle of subtitles) {
        drawSubtitleText(ctxCache, subtitle);
      }
    }

    // 导出为Blob
    const blob = await canvasCache.convertToBlob({
      type: 'image/png',
      quality: 1.0,
    });

    self.postMessage({
      type: 'frame-rendered',
      frameIndex,
      blob,
      timestamp,
    });
  } catch (error) {
    self.postMessage({
      type: 'frame-error',
      frameIndex,
      error: error.message,
    });
  }
}

/**
 * 简化的字幕绘制（主要逻辑仍在主线程）
 */
function drawSubtitleText(ctx, subtitle) {
  const { text, x, y, fontSize, color, fontFamily } = subtitle;

  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * 清理资源
 */
function handleDispose() {
  if (canvasCache) {
    canvasCache.width = 0;
    canvasCache.height = 0;
    canvasCache = null;
  }
  ctxCache = null;

  self.postMessage({
    type: 'disposed',
  });

  console.log('✅ OffscreenCanvas disposed');
}
