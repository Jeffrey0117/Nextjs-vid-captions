import { useState, useEffect, useCallback } from 'react';
import { useWebCodecsRecorder } from './useWebCodecsRecorder';
import { usePreviewRecorder } from './usePreviewRecorder';
import { SubtitleSegment, PinnedSubtitle } from '../stores/subtitle-store';

/**
 * 智能錄製Hook - 自動選擇最佳方案
 *
 * 優先級：
 * 1. ✅ WebCodecs（如果瀏覽器支持）- 速度4-5倍，畫質保持
 * 2. ✅ 舊版優化方案（降級）- Blob傳輸 + 批次處理
 *
 * 特性：
 * - 自動檢測瀏覽器WebCodecs支持
 * - 無縫降級，用戶無感知
 * - 完全保留超採樣畫質優化
 * - WebCodecs後自動合併音軌
 */

interface RecorderOptions {
  fps?: number;
  qualityLevel?: 'fast' | 'balanced' | 'high' | 'ultra';
  customQuality?: any;
  colorQuality?: 'fast' | 'standard' | 'high' | 'professional';
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  forceMethod?: 'webcodecs' | 'legacy'; // 強制使用某種方法（測試用）
}

export function useSmartRecorder() {
  const [recordingMethod, setRecordingMethod] = useState<'webcodecs' | 'legacy' | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  const webCodecsRecorder = useWebCodecsRecorder();
  const legacyRecorder = usePreviewRecorder();

  /**
   * 檢測WebCodecs支持
   */
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await webCodecsRecorder.checkWebCodecsSupport();
      setIsSupported(supported);

      if (supported) {
        console.log('✅ 使用WebCodecs加速錄製（速度提升4-5倍）');
      } else {
        console.log('⚠️ WebCodecs不支持，使用標準優化方案');
      }
    };

    checkSupport();
  }, []);

  /**
   * WebCodecs錄製 + 音軌合併
   */
  const recordWithWebCodecs = useCallback(async (
    videoElement: HTMLVideoElement,
    previewContainer: HTMLElement,
    subtitles: SubtitleSegment[],
    pinnedSubtitles: PinnedSubtitle[],
    videoDisplaySize: { width: number; height: number },
    videoPath: string,
    options: RecorderOptions = {}
  ) => {
    const { onProgress, onComplete, onError, ...restOptions } = options;

    try {
      // 階段1：WebCodecs編碼（90%進度）
      const result = await webCodecsRecorder.recordWithWebCodecs(
        videoElement,
        previewContainer,
        subtitles,
        pinnedSubtitles,
        videoDisplaySize,
        videoPath,
        {
          ...restOptions,
          onProgress: (p) => onProgress?.(p * 0.9), // 0-90%
        }
      );

      // 階段2：音軌合併（90-100%進度）
      onProgress?.(0.92);

      console.log('🎵 開始音軌合併...');

      const formData = new FormData();
      formData.append('video', result.videoBlob);
      formData.append('originalVideoPath', videoPath);

      const response = await fetch('/api/record-preview/merge-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`音軌合併失敗: ${errorData.details || errorData.error}`);
      }

      onProgress?.(0.98);

      const finalBlob = await response.blob();

      console.log('🎉 WebCodecs錄製完成（含音軌）!', {
        size: `${(finalBlob.size / 1024 / 1024).toFixed(2)}MB`,
      });

      onProgress?.(1.0);
      onComplete?.();

      // 自動下載
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `output_webcodecs_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('❌ WebCodecs錄製失敗:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [webCodecsRecorder]);

  /**
   * 主錄製函數（自動選擇方法）
   */
  const record = useCallback(async (
    videoElement: HTMLVideoElement,
    previewContainer: HTMLElement,
    subtitles: SubtitleSegment[],
    pinnedSubtitles: PinnedSubtitle[],
    videoDisplaySize: { width: number; height: number },
    videoPath: string,
    options: RecorderOptions = {}
  ) => {
    // 強制方法（測試用）
    if (options.forceMethod === 'legacy') {
      console.log('🔧 強制使用Legacy方案');
      setRecordingMethod('legacy');
      return await legacyRecorder.recordPreview(
        videoElement,
        previewContainer,
        subtitles,
        pinnedSubtitles,
        videoDisplaySize,
        videoPath,
        options
      );
    }

    if (options.forceMethod === 'webcodecs') {
      console.log('🔧 強制使用WebCodecs方案');
      setRecordingMethod('webcodecs');
      return await recordWithWebCodecs(
        videoElement,
        previewContainer,
        subtitles,
        pinnedSubtitles,
        videoDisplaySize,
        videoPath,
        options
      );
    }

    // 自動選擇
    if (isSupported === true) {
      console.log('🚀 使用WebCodecs加速錄製');
      setRecordingMethod('webcodecs');
      return await recordWithWebCodecs(
        videoElement,
        previewContainer,
        subtitles,
        pinnedSubtitles,
        videoDisplaySize,
        videoPath,
        options
      );
    } else if (isSupported === false) {
      console.log('📦 使用Legacy優化方案');
      setRecordingMethod('legacy');
      return await legacyRecorder.recordPreview(
        videoElement,
        previewContainer,
        subtitles,
        pinnedSubtitles,
        videoDisplaySize,
        videoPath,
        options
      );
    } else {
      // 仍在檢測中，等待
      await new Promise(resolve => setTimeout(resolve, 100));
      return await record(
        videoElement,
        previewContainer,
        subtitles,
        pinnedSubtitles,
        videoDisplaySize,
        videoPath,
        options
      );
    }
  }, [isSupported, recordWithWebCodecs, legacyRecorder]);

  /**
   * 取消錄製
   */
  const cancel = useCallback(() => {
    if (recordingMethod === 'webcodecs') {
      webCodecsRecorder.cancelRecording();
    } else if (recordingMethod === 'legacy') {
      legacyRecorder.cancelRecording();
    }
  }, [recordingMethod, webCodecsRecorder, legacyRecorder]);

  return {
    // 狀態
    isRecording: recordingMethod === 'webcodecs'
      ? webCodecsRecorder.isRecording
      : legacyRecorder.isRecording,
    progress: recordingMethod === 'webcodecs'
      ? webCodecsRecorder.progress
      : legacyRecorder.progress,
    status: recordingMethod === 'webcodecs'
      ? webCodecsRecorder.status
      : legacyRecorder.status,

    // 方法信息
    recordingMethod,
    isWebCodecsSupported: isSupported,

    // 函數
    record,
    cancel,
  };
}
