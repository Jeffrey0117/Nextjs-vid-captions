/**
 * 色彩管理和视频解码优化类型定义
 * 确保从视频解码到Canvas渲染到PNG导出的全链路色彩一致性
 */

/**
 * Canvas色彩空间
 * - srgb: 标准RGB色彩空间（默认，广泛兼容）
 * - display-p3: Display P3宽色域（支持更丰富的色彩，适合现代显示器）
 */
export type CanvasColorSpace = 'srgb' | 'display-p3';

/**
 * 视频帧提取质量模式
 */
export type VideoFrameExtractionMode =
  | 'canvas-only'           // 仅使用Canvas drawImage（兼容性最好）
  | 'imagebitmap-standard'  // 使用createImageBitmap标准模式
  | 'imagebitmap-optimized' // 使用createImageBitmap优化模式（可能不支持）
  | 'rvfc-sync';           // 使用requestVideoFrameCallback同步提取（最高质量）

/**
 * 色彩空间转换策略
 */
export type ColorSpaceConversion =
  | 'none'    // 保持原始色彩空间，不转换（推荐用于保真）
  | 'default'; // 浏览器默认行为（可能会转换）

/**
 * ImageBitmap调整大小质量
 * 注意：'medium'和'high'在多数浏览器中未实现，实际效果可能与'low'相同
 */
export type ResizeQuality =
  | 'pixelated'  // 最近邻算法（快速，锐利但有锯齿）
  | 'low'        // 低质量插值（默认，平衡）
  | 'medium'     // 中等质量（浏览器支持有限）
  | 'high';      // 高质量插值（浏览器支持有限）

/**
 * 视频解码就绪状态
 */
export const VideoReadyState = {
  HAVE_NOTHING: 0,      // 无数据
  HAVE_METADATA: 1,     // 有元数据
  HAVE_CURRENT_DATA: 2, // 有当前帧数据
  HAVE_FUTURE_DATA: 3,  // 有当前和下一帧数据
  HAVE_ENOUGH_DATA: 4,  // 有足够数据播放
} as const;

/**
 * Canvas 2D渲染上下文色彩管理配置
 */
export interface CanvasColorConfig {
  /** 色彩空间 */
  colorSpace: CanvasColorSpace;

  /** 是否禁用alpha通道（禁用可提升性能） */
  alpha: boolean;

  /** 是否去同步化（false确保渲染质量） */
  desynchronized: boolean;

  /** 是否频繁读取（true优化toBlob等操作） */
  willReadFrequently: boolean;

  /** 像素格式（实验性，部分浏览器支持） */
  pixelFormat?: 'uint8' | 'float16';
}

/**
 * 视频帧提取配置
 */
export interface VideoFrameExtractionConfig {
  /** 提取模式 */
  mode: VideoFrameExtractionMode;

  /** 是否等待视频完全解码 */
  waitForDecode: boolean;

  /** 等待解码超时时间（毫秒） */
  decodeTimeout: number;

  /** 色彩空间转换策略 */
  colorSpaceConversion: ColorSpaceConversion;

  /** ImageBitmap调整大小质量 */
  resizeQuality: ResizeQuality;

  /** 是否预乘alpha（建议设为'none'） */
  premultiplyAlpha: 'none' | 'premultiply' | 'default';

  /** 视频帧跳转后的额外等待帧数 */
  additionalWaitFrames: number;

  /** 最小readyState要求 */
  minReadyState: number;
}

/**
 * PNG导出色彩配置
 */
export interface PNGExportConfig {
  /** 导出质量（0-1，PNG虽然无损但会影响压缩） */
  quality: number;

  /** 是否嵌入色彩配置文件（实验性） */
  embedColorProfile: boolean;

  /** 色彩空间（应与Canvas一致） */
  colorSpace: CanvasColorSpace;
}

/**
 * 完整的色彩管理配置
 */
export interface ColorManagementConfig {
  /** Canvas色彩配置 */
  canvas: CanvasColorConfig;

  /** 视频帧提取配置 */
  frameExtraction: VideoFrameExtractionConfig;

  /** PNG导出配置 */
  pngExport: PNGExportConfig;

  /** 配置名称 */
  name?: string;

  /** 配置描述 */
  description?: string;
}

/**
 * 色彩管理预设级别
 */
export type ColorQualityLevel = 'compatible' | 'standard' | 'high-fidelity' | 'custom';

/**
 * 色彩管理预设配置
 */
export const COLOR_PRESETS: Record<Exclude<ColorQualityLevel, 'custom'>, ColorManagementConfig> = {
  /**
   * 兼容模式 - 最大兼容性
   * 适合：需要在所有浏览器和设备上工作
   * 特点：使用标准sRGB，简单Canvas配置，无高级特性
   */
  compatible: {
    name: '兼容模式',
    description: '最大兼容性，适合所有浏览器和设备',
    canvas: {
      colorSpace: 'srgb',
      alpha: false,
      desynchronized: false,
      willReadFrequently: true,
    },
    frameExtraction: {
      mode: 'canvas-only',
      waitForDecode: true,
      decodeTimeout: 5000,
      colorSpaceConversion: 'default',
      resizeQuality: 'low',
      premultiplyAlpha: 'none',
      additionalWaitFrames: 1,
      minReadyState: VideoReadyState.HAVE_CURRENT_DATA,
    },
    pngExport: {
      quality: 0.92,
      embedColorProfile: false,
      colorSpace: 'srgb',
    }
  },

  /**
   * 标准模式 - 平衡质量与兼容性
   * 适合：大多数场景，推荐使用
   * 特点：使用sRGB，等待完整解码，优化帧提取
   */
  standard: {
    name: '标准模式',
    description: '平衡质量与兼容性，推荐用于大多数场景',
    canvas: {
      colorSpace: 'srgb',
      alpha: false,
      desynchronized: false,
      willReadFrequently: true,
    },
    frameExtraction: {
      mode: 'imagebitmap-standard',
      waitForDecode: true,
      decodeTimeout: 8000,
      colorSpaceConversion: 'none', // 保持原始色彩
      resizeQuality: 'low', // 浏览器支持最好
      premultiplyAlpha: 'none',
      additionalWaitFrames: 2,
      minReadyState: VideoReadyState.HAVE_ENOUGH_DATA,
    },
    pngExport: {
      quality: 0.95,
      embedColorProfile: false,
      colorSpace: 'srgb',
    }
  },

  /**
   * 高保真模式 - 最高色彩质量
   * 适合：专业制作、色彩敏感内容、现代浏览器
   * 特点：Display P3宽色域，requestVideoFrameCallback，无色彩转换
   */
  'high-fidelity': {
    name: '高保真模式',
    description: '最高色彩质量，适合专业制作和现代浏览器',
    canvas: {
      colorSpace: 'display-p3',
      alpha: false,
      desynchronized: false,
      willReadFrequently: true,
    },
    frameExtraction: {
      mode: 'rvfc-sync',
      waitForDecode: true,
      decodeTimeout: 10000,
      colorSpaceConversion: 'none', // 保持原始色彩，至关重要
      resizeQuality: 'low', // 即使设high也可能降级
      premultiplyAlpha: 'none',
      additionalWaitFrames: 3, // 等待更多帧确保完全解码
      minReadyState: VideoReadyState.HAVE_ENOUGH_DATA,
    },
    pngExport: {
      quality: 1.0,
      embedColorProfile: true, // 尝试嵌入色彩配置
      colorSpace: 'display-p3',
    }
  }
};

/**
 * 获取色彩管理配置
 */
export function getColorConfig(
  level: ColorQualityLevel,
  customConfig?: Partial<ColorManagementConfig>
): ColorManagementConfig {
  if (level === 'custom') {
    if (!customConfig) {
      throw new Error('Custom color quality level requires customConfig parameter');
    }
    return {
      name: customConfig.name || '自定义',
      description: customConfig.description || '自定义色彩管理配置',
      canvas: {
        ...COLOR_PRESETS.standard.canvas,
        ...customConfig.canvas,
      },
      frameExtraction: {
        ...COLOR_PRESETS.standard.frameExtraction,
        ...customConfig.frameExtraction,
      },
      pngExport: {
        ...COLOR_PRESETS.standard.pngExport,
        ...customConfig.pngExport,
      },
    };
  }

  return COLOR_PRESETS[level];
}

/**
 * 检测浏览器色彩空间支持
 */
export function detectColorSpaceSupport(): {
  canvasDisplayP3: boolean;
  requestVideoFrameCallback: boolean;
  createImageBitmap: boolean;
  imageDataColorSpace: boolean;
} {
  const canvas = document.createElement('canvas');

  // 检测Canvas Display P3支持
  let canvasDisplayP3 = false;
  try {
    const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' } as any);
    canvasDisplayP3 = ctx !== null;
  } catch (e) {
    canvasDisplayP3 = false;
  }

  // 检测requestVideoFrameCallback
  const video = document.createElement('video');
  const requestVideoFrameCallback = typeof (video as any).requestVideoFrameCallback === 'function';

  // 检测createImageBitmap
  const createImageBitmap = typeof window.createImageBitmap === 'function';

  // 检测ImageData colorSpace支持
  let imageDataColorSpace = false;
  try {
    const imageData = new ImageData(1, 1, { colorSpace: 'display-p3' } as any);
    imageDataColorSpace = true;
  } catch (e) {
    imageDataColorSpace = false;
  }

  return {
    canvasDisplayP3,
    requestVideoFrameCallback,
    createImageBitmap,
    imageDataColorSpace,
  };
}

/**
 * 验证色彩配置
 */
export function validateColorConfig(config: ColorManagementConfig): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const support = detectColorSpaceSupport();

  // 检查Display P3支持
  if (config.canvas.colorSpace === 'display-p3' && !support.canvasDisplayP3) {
    warnings.push('浏览器不支持Display P3色彩空间，将降级为sRGB');
  }

  // 检查requestVideoFrameCallback
  if (config.frameExtraction.mode === 'rvfc-sync' && !support.requestVideoFrameCallback) {
    errors.push('浏览器不支持requestVideoFrameCallback，请使用其他提取模式');
  }

  // 检查createImageBitmap
  if (config.frameExtraction.mode.startsWith('imagebitmap') && !support.createImageBitmap) {
    errors.push('浏览器不支持createImageBitmap，请使用canvas-only模式');
  }

  // 检查ResizeQuality
  if (['medium', 'high'].includes(config.frameExtraction.resizeQuality)) {
    warnings.push('resizeQuality的medium/high在多数浏览器中未实现，可能降级为low');
  }

  // 检查PNG质量
  if (config.pngExport.quality < 0 || config.pngExport.quality > 1) {
    errors.push(`PNG质量必须在0-1之间，当前值: ${config.pngExport.quality}`);
  }

  // 检查色彩空间一致性
  if (config.canvas.colorSpace !== config.pngExport.colorSpace) {
    warnings.push(`Canvas色彩空间(${config.canvas.colorSpace})与PNG导出色彩空间(${config.pngExport.colorSpace})不一致，可能导致色彩转换`);
  }

  // 检查解码超时
  if (config.frameExtraction.decodeTimeout < 1000) {
    warnings.push('解码超时时间过短，可能导致帧未完全解码');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 获取推荐的色彩配置（基于浏览器支持自动选择）
 */
export function getRecommendedColorConfig(): ColorManagementConfig {
  const support = detectColorSpaceSupport();

  // 如果支持所有高级特性，使用高保真模式
  if (support.canvasDisplayP3 && support.requestVideoFrameCallback && support.createImageBitmap) {
    return COLOR_PRESETS['high-fidelity'];
  }

  // 如果支持createImageBitmap，使用标准模式
  if (support.createImageBitmap) {
    return COLOR_PRESETS.standard;
  }

  // 否则使用兼容模式
  return COLOR_PRESETS.compatible;
}

/**
 * 色彩配置信息
 */
export interface ColorConfigInfo {
  level: ColorQualityLevel;
  colorGamut: 'sRGB' | 'Display P3';
  extractionMethod: string;
  colorPreservation: 'Standard' | 'High' | 'Maximum';
  browserCompatibility: 'Universal' | 'Modern' | 'Latest';
}

/**
 * 获取色彩配置信息
 */
export function getColorConfigInfo(config: ColorManagementConfig): ColorConfigInfo {
  const colorGamut = config.canvas.colorSpace === 'display-p3' ? 'Display P3' : 'sRGB';

  let extractionMethod: string;
  switch (config.frameExtraction.mode) {
    case 'canvas-only':
      extractionMethod = 'Canvas drawImage (兼容性最好)';
      break;
    case 'imagebitmap-standard':
      extractionMethod = 'createImageBitmap 标准模式';
      break;
    case 'imagebitmap-optimized':
      extractionMethod = 'createImageBitmap 优化模式';
      break;
    case 'rvfc-sync':
      extractionMethod = 'requestVideoFrameCallback (最高质量)';
      break;
    default:
      extractionMethod = '未知';
  }

  let colorPreservation: 'Standard' | 'High' | 'Maximum';
  if (config.frameExtraction.colorSpaceConversion === 'none' &&
      config.canvas.colorSpace === 'display-p3') {
    colorPreservation = 'Maximum';
  } else if (config.frameExtraction.colorSpaceConversion === 'none') {
    colorPreservation = 'High';
  } else {
    colorPreservation = 'Standard';
  }

  let browserCompatibility: 'Universal' | 'Modern' | 'Latest';
  if (config.frameExtraction.mode === 'canvas-only' && config.canvas.colorSpace === 'srgb') {
    browserCompatibility = 'Universal';
  } else if (config.frameExtraction.mode === 'rvfc-sync' || config.canvas.colorSpace === 'display-p3') {
    browserCompatibility = 'Latest';
  } else {
    browserCompatibility = 'Modern';
  }

  // 尝试从预设中找到匹配的级别
  let level: ColorQualityLevel = 'custom';
  for (const [presetLevel, presetConfig] of Object.entries(COLOR_PRESETS)) {
    if (JSON.stringify(presetConfig) === JSON.stringify(config)) {
      level = presetLevel as ColorQualityLevel;
      break;
    }
  }

  return {
    level,
    colorGamut,
    extractionMethod,
    colorPreservation,
    browserCompatibility,
  };
}
