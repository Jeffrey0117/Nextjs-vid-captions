import { SubtitleSegment } from '@/app/stores/subtitle-store';

/**
 * Canvas文字測量工具
 * 用於精確計算文字在指定字體下的實際渲染寬度
 */
let measureCanvas: HTMLCanvasElement | null = null;
let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureContext = measureCanvas.getContext('2d');
  }
  return measureContext!;
}

export interface TextMeasurement {
  width: number;
  height: number;
}

/**
 * 測量文字實際渲染寬度
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): TextMeasurement {
  const ctx = getMeasureContext();
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;

  const metrics = ctx.measureText(text);

  return {
    width: metrics.width,
    height: fontSize * 1.2, // 行高估算
  };
}

/**
 * 字幕溢出檢測配置
 */
export interface OverflowCheckConfig {
  videoWidth: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  scale: number;
  maxWidth: number; // 百分比 (0-100)
}

/**
 * 溢出檢測結果
 */
export interface OverflowResult {
  isTooLong: boolean;
  actualWidth: number;
  maxWidth: number;
  overflowRatio: number; // 實際寬度 / 最大寬度
}

/**
 * 檢查字幕是否太長（超出影片邊界）
 */
export function isSubtitleTooLong(config: OverflowCheckConfig): OverflowResult {
  const { videoWidth, text, fontSize, fontFamily, fontWeight, scale, maxWidth } = config;

  // 計算實際字體大小（應用縮放）
  const actualFontSize = fontSize * scale;

  // 計算文字實際寬度
  const { width: textWidthPx } = measureText(text, actualFontSize, fontFamily, fontWeight);

  // 計算影片可用寬度
  const maxWidthPx = videoWidth * (maxWidth / 100);

  // 判斷是否超寬
  const isTooLong = textWidthPx > maxWidthPx;
  const overflowRatio = textWidthPx / maxWidthPx;

  return {
    isTooLong,
    actualWidth: textWidthPx,
    maxWidth: maxWidthPx,
    overflowRatio,
  };
}

/**
 * 分割配置
 */
export interface SplitConfig {
  videoWidth: number;
  minFontSize?: number; // 最小字體大小，預設20
  maxFontSize?: number; // 最大字體大小，預設60
  preserveSemantics?: boolean; // 保持語義完整，預設true
}

/**
 * 智能分割策略
 */
enum SplitStrategy {
  PUNCTUATION_STRONG = 1, // 按強標點符號（。！？）
  PUNCTUATION_WEAK = 2,   // 按弱標點符號（，；）
  SEMANTIC = 3,            // 按語義單元
  FORCED = 4,              // 強制按長度分割
}

/**
 * 按標點符號分割文字
 */
function splitByPunctuation(text: string, strong: boolean = true): string[] {
  if (strong) {
    // 強標點符號
    const regex = /([^。！？\n]+[。！？\n]?)/g;
    const matches = text.match(regex);
    return matches ? matches.map(s => s.trim()).filter(s => s.length > 0) : [text];
  } else {
    // 弱標點符號
    const regex = /([^，；,;]+[，；,;]?)/g;
    const matches = text.match(regex);
    return matches ? matches.map(s => s.trim()).filter(s => s.length > 0) : [text];
  }
}

/**
 * 按語義單元分割（中英文處理）
 */
function splitBySemantic(text: string, targetSegments: number): string[] {
  // 簡單策略：按字數均分
  const avgLength = Math.ceil(text.length / targetSegments);
  const segments: string[] = [];

  for (let i = 0; i < text.length; i += avgLength) {
    const segment = text.slice(i, i + avgLength);
    segments.push(segment);
  }

  return segments;
}

/**
 * 智能分組句子（避免過短片段）
 */
function groupSentences(
  sentences: string[],
  targetGroups: number,
  videoWidth: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  scale: number,
  maxWidth: number
): string[] {
  if (sentences.length <= targetGroups) {
    return sentences;
  }

  // 貪婪分組：盡可能合併句子，直到接近最大寬度
  const groups: string[] = [];
  let currentGroup = '';

  for (const sentence of sentences) {
    const testGroup = currentGroup ? `${currentGroup}${sentence}` : sentence;
    const overflow = isSubtitleTooLong({
      videoWidth,
      text: testGroup,
      fontSize,
      fontFamily,
      fontWeight,
      scale,
      maxWidth,
    });

    if (overflow.isTooLong && currentGroup) {
      // 當前組會溢出，保存當前組並開始新組
      groups.push(currentGroup);
      currentGroup = sentence;
    } else {
      // 繼續累加
      currentGroup = testGroup;
    }
  }

  // 添加最後一組
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * 按字數比例分配時間
 */
function distributeTime(
  originalSegment: SubtitleSegment,
  textSegments: string[]
): SubtitleSegment[] {
  const totalChars = textSegments.reduce((sum, text) => sum + text.length, 0);
  const totalDuration = originalSegment.endTime - originalSegment.startTime;

  let currentTime = originalSegment.startTime;
  const newSegments: SubtitleSegment[] = [];

  textSegments.forEach((text, index) => {
    const charRatio = text.length / totalChars;
    const duration = index === textSegments.length - 1
      ? originalSegment.endTime - currentTime // 最後一段用剩餘時間
      : totalDuration * charRatio;

    const endTime = currentTime + duration;

    newSegments.push({
      ...originalSegment,
      id: `${originalSegment.id}_split_${index}`,
      text,
      translatedText: text, // 已翻譯的情況下保留
      startTime: currentTime,
      endTime,
    });

    currentTime = endTime;
  });

  return newSegments;
}

/**
 * 智能分割字幕
 * 根據溢出程度自動選擇最佳分割策略
 */
export function smartSplitSubtitle(
  segment: SubtitleSegment,
  config: SplitConfig
): SubtitleSegment[] {
  const { videoWidth } = config;
  const { text, style } = segment;

  // 1. 檢查是否需要分割
  const measurement = isSubtitleTooLong({
    videoWidth,
    text,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    scale: style.scale,
    maxWidth: style.maxWidth,
  });

  if (!measurement.isTooLong) {
    return [segment]; // 不需要分割
  }

  console.log(`📏 字幕溢出檢測: ${text.substring(0, 20)}...`, {
    overflowRatio: measurement.overflowRatio,
    actualWidth: measurement.actualWidth,
    maxWidth: measurement.maxWidth,
  });

  // 2. 計算需要分成幾段
  const targetSegments = Math.ceil(measurement.overflowRatio);

  console.log(`✂️ 計劃分割成 ${targetSegments} 段`);

  // 3. 嘗試不同的分割策略
  let textSegments: string[] = [];

  // 策略1: 按強標點符號
  if (config.preserveSemantics !== false) {
    textSegments = splitByPunctuation(text, true);
    console.log(`嘗試強標點分割: ${textSegments.length} 段`);

    // 如果分割數不夠，嘗試弱標點
    if (textSegments.length < targetSegments) {
      textSegments = splitByPunctuation(text, false);
      console.log(`嘗試弱標點分割: ${textSegments.length} 段`);
    }

    // 智能分組（合併過短片段）
    textSegments = groupSentences(
      textSegments,
      targetSegments,
      videoWidth,
      style.fontSize,
      style.fontFamily,
      style.fontWeight,
      style.scale,
      style.maxWidth
    );
    console.log(`智能分組後: ${textSegments.length} 段`);
  }

  // 策略2: 如果標點分割失敗，按語義/長度分割
  if (textSegments.length === 1 || textSegments.some(seg => {
    const check = isSubtitleTooLong({
      videoWidth,
      text: seg,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      scale: style.scale,
      maxWidth: style.maxWidth,
    });
    return check.isTooLong;
  })) {
    console.log('標點分割不足，使用語義分割');
    textSegments = splitBySemantic(text, targetSegments);
  }

  // 4. 按字數比例分配時間
  const newSegments = distributeTime(segment, textSegments);

  console.log(`✅ 分割完成: ${newSegments.length} 段`, newSegments.map(s => s.text));

  return newSegments;
}

/**
 * 計算最佳字體大小
 * 使用二分查找找到最大可用字體（不超出影片寬度）
 */
export function calculateOptimalFontSize(config: {
  minFontSize: number;      // 最小字體 (如 20px)
  maxFontSize: number;      // 最大字體 (如 60px)
  targetWidth: number;      // 目標寬度 (px)
  text: string;
  fontFamily: string;
  fontWeight: string;
}): number {
  const { minFontSize, maxFontSize, targetWidth, text, fontFamily, fontWeight } = config;

  let low = minFontSize;
  let high = maxFontSize;
  let optimalSize = minFontSize;

  // 二分查找
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const { width } = measureText(text, mid, fontFamily, fontWeight);

    if (width <= targetWidth) {
      // 字體可以更大
      optimalSize = mid;
      low = mid + 1;
    } else {
      // 字體太大，縮小
      high = mid - 1;
    }
  }

  console.log(`🔍 最佳字體計算: ${text.substring(0, 20)}...`, {
    原始範圍: `${minFontSize}-${maxFontSize}px`,
    最佳字體: `${optimalSize}px`,
    目標寬度: `${targetWidth}px`,
  });

  return optimalSize;
}

/**
 * 字體自適應策略類型
 */
export enum FontAdaptStrategy {
  SPLIT_ONLY = 'split_only',           // 保持字體，分割字幕
  SHRINK_ONLY = 'shrink_only',         // 縮小字體，保持單行
  HYBRID = 'hybrid',                   // 混合策略（推薦）
}

/**
 * 自適應優化配置
 */
export interface AutoOptimizeConfig {
  videoWidth: number;
  strategy?: FontAdaptStrategy;
  minFontSize?: number;
  maxFontSize?: number;
  preserveSemantics?: boolean;
}

/**
 * 自適應優化結果
 */
export interface AutoOptimizeResult {
  segments: SubtitleSegment[];
  strategy: FontAdaptStrategy;
  changes: string; // 變更描述
}

/**
 * 自動優化字幕（分割或縮小字體）
 * 根據溢出程度自動選擇最佳策略
 */
export function autoOptimizeSubtitle(
  segment: SubtitleSegment,
  config: AutoOptimizeConfig
): AutoOptimizeResult {
  const {
    videoWidth,
    strategy = FontAdaptStrategy.HYBRID,
    minFontSize = 20,
    maxFontSize = 60,
    preserveSemantics = true,
  } = config;

  const { text, style } = segment;

  // 檢查是否溢出
  const measurement = isSubtitleTooLong({
    videoWidth,
    text,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    scale: style.scale,
    maxWidth: style.maxWidth,
  });

  if (!measurement.isTooLong) {
    return {
      segments: [segment],
      strategy,
      changes: '無需優化',
    };
  }

  // 根據策略處理
  switch (strategy) {
    case FontAdaptStrategy.SPLIT_ONLY: {
      // 只分割，不改字體
      const segments = smartSplitSubtitle(segment, { videoWidth, preserveSemantics });
      return {
        segments,
        strategy: FontAdaptStrategy.SPLIT_ONLY,
        changes: `分割成 ${segments.length} 段`,
      };
    }

    case FontAdaptStrategy.SHRINK_ONLY: {
      // 只縮小字體，不分割
      const targetWidth = videoWidth * (style.maxWidth / 100);
      const optimalFontSize = calculateOptimalFontSize({
        minFontSize,
        maxFontSize: style.fontSize * style.scale,
        targetWidth,
        text,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
      });

      const newSegment: SubtitleSegment = {
        ...segment,
        style: {
          ...style,
          fontSize: Math.round(optimalFontSize / style.scale),
        },
      };

      return {
        segments: [newSegment],
        strategy: FontAdaptStrategy.SHRINK_ONLY,
        changes: `字體從 ${style.fontSize}px 縮小至 ${newSegment.style.fontSize}px`,
      };
    }

    case FontAdaptStrategy.HYBRID:
    default: {
      // 混合策略：根據溢出程度決定
      const overflowPercent = (measurement.overflowRatio - 1) * 100;

      if (overflowPercent <= 50) {
        // 溢出50%以內：嘗試縮小字體
        const targetWidth = videoWidth * (style.maxWidth / 100);
        const optimalFontSize = calculateOptimalFontSize({
          minFontSize,
          maxFontSize: style.fontSize * style.scale,
          targetWidth,
          text,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
        });

        // 如果字體不會太小，就縮小
        if (optimalFontSize >= minFontSize) {
          const newSegment: SubtitleSegment = {
            ...segment,
            style: {
              ...style,
              fontSize: Math.round(optimalFontSize / style.scale),
            },
          };

          return {
            segments: [newSegment],
            strategy: FontAdaptStrategy.HYBRID,
            changes: `字體從 ${style.fontSize}px 縮小至 ${newSegment.style.fontSize}px`,
          };
        }
      }

      // 溢出超過50%或字體會太小：分割字幕
      const segments = smartSplitSubtitle(segment, { videoWidth, preserveSemantics });
      return {
        segments,
        strategy: FontAdaptStrategy.HYBRID,
        changes: `溢出 ${overflowPercent.toFixed(0)}%，分割成 ${segments.length} 段`,
      };
    }
  }
}

/**
 * 批量檢測溢出字幕
 */
export function detectOverflowSegments(
  segments: SubtitleSegment[],
  videoWidth: number
): SubtitleSegment[] {
  return segments.filter(segment => {
    const measurement = isSubtitleTooLong({
      videoWidth,
      text: segment.text,
      fontSize: segment.style.fontSize,
      fontFamily: segment.style.fontFamily,
      fontWeight: segment.style.fontWeight,
      scale: segment.style.scale,
      maxWidth: segment.style.maxWidth,
    });
    return measurement.isTooLong;
  });
}
