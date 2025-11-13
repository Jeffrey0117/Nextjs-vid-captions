/**
 * 视频质量配置类型定义
 * 提供多种质量预设和自定义选项
 */

/**
 * FFmpeg编码预设
 * - ultrafast: 最快速度，文件较大
 * - superfast: 非常快，质量略好
 * - veryfast: 很快，适合实时编码
 * - faster: 快速，较好平衡
 * - fast: 快速，良好质量
 * - medium: 平衡速度和质量（默认）
 * - slow: 较慢，高质量
 * - slower: 很慢，更高质量
 * - veryslow: 极慢，最高质量
 */
export type FFmpegPreset =
  | 'ultrafast'
  | 'superfast'
  | 'veryfast'
  | 'faster'
  | 'fast'
  | 'medium'
  | 'slow'
  | 'slower'
  | 'veryslow';

/**
 * 像素格式
 * - yuv420p: 标准兼容性（推荐）
 * - yuv444p: 更高色彩精度
 * - yuv420p10le: 10位色深
 */
export type PixelFormat = 'yuv420p' | 'yuv444p' | 'yuv420p10le';

/**
 * 硬件加速选项
 */
export type HardwareAcceleration =
  | 'none'           // 无硬件加速
  | 'auto'           // 自动检测
  | 'nvenc'          // NVIDIA GPU
  | 'qsv'            // Intel Quick Sync
  | 'videotoolbox'   // macOS硬件加速
  | 'amf';           // AMD GPU

/**
 * 质量等级
 */
export type QualityLevel = 'fast' | 'balanced' | 'high' | 'ultra' | 'custom';

/**
 * FFmpeg编码配置
 */
export interface FFmpegEncodingConfig {
  /** CRF值（0-51），越小质量越高，文件越大 */
  crf: number;

  /** 编码预设 */
  preset: FFmpegPreset;

  /** 像素格式 */
  pixelFormat: PixelFormat;

  /** 视频同步方法（-vsync参数）
   * - 0 (passthrough): 直通
   * - 1 (cfr): 固定帧率
   * - 2 (vfr): 可变帧率
   * - -1 (auto): 自动
   */
  vsync?: number;

  /** 硬件加速 */
  hardwareAccel?: HardwareAcceleration;

  /** 音频编码器 */
  audioCodec?: 'copy' | 'aac' | 'libmp3lame';

  /** 音频比特率（仅当audioCodec不是copy时有效） */
  audioBitrate?: string;

  /** 视频比特率（可选，通常使用CRF而不是比特率） */
  videoBitrate?: string;

  /** GOP大小（关键帧间隔） */
  gopSize?: number;

  /** B帧数量 */
  bframes?: number;

  /** 额外的FFmpeg参数 */
  extraArgs?: string[];
}

/**
 * Canvas渲染质量配置
 */
export interface CanvasRenderingConfig {
  /** 图像平滑/抗锯齿 */
  imageSmoothingEnabled: boolean;

  /** 图像平滑质量 */
  imageSmoothingQuality: 'low' | 'medium' | 'high';

  /** 字体渲染选项 */
  textRendering: {
    /** 文本渲染质量 */
    quality: 'auto' | 'optimizeSpeed' | 'optimizeLegibility' | 'geometricPrecision';

    /** 字体平滑 */
    fontSmoothing: boolean;

    /** 子像素渲染 */
    subpixelRendering: boolean;
  };

  /** Canvas导出质量（0-1） */
  exportQuality: number;

  /** Canvas导出格式 */
  exportFormat: 'image/png' | 'image/jpeg' | 'image/webp';
}

/**
 * 完整的视频质量配置
 */
export interface VideoQualityConfig {
  /** 质量等级 */
  level: QualityLevel;

  /** FFmpeg编码配置 */
  encoding: FFmpegEncodingConfig;

  /** Canvas渲染配置 */
  rendering: CanvasRenderingConfig;

  /** 配置名称 */
  name?: string;

  /** 配置描述 */
  description?: string;
}

/**
 * 质量预设配置
 */
export const QUALITY_PRESETS: Record<Exclude<QualityLevel, 'custom'>, VideoQualityConfig> = {
  /**
   * 快速模式 - 优先速度
   * 适合：预览、草稿、快速导出
   * 特点：编码速度最快，文件较大，质量可接受
   */
  fast: {
    level: 'fast',
    name: '快速模式',
    description: '优先编码速度，适合预览和草稿',
    encoding: {
      crf: 28,                    // 较高CRF，质量适中
      preset: 'veryfast',         // 非常快的编码
      pixelFormat: 'yuv420p',
      vsync: 2,                   // 可变帧率
      audioCodec: 'copy',         // 直接复制音频，不重编码
      gopSize: 30,                // 较大GOP，减少关键帧
      bframes: 0,                 // 不使用B帧，加快编码
    },
    rendering: {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
      textRendering: {
        quality: 'optimizeSpeed',
        fontSmoothing: true,
        subpixelRendering: false,
      },
      exportQuality: 0.85,        // 稍低的导出质量
      exportFormat: 'image/jpeg', // 使用JPEG加快编码
    }
  },

  /**
   * 平衡模式 - 速度与质量兼顾
   * 适合：大多数场景、日常使用
   * 特点：编码速度适中，质量良好，文件大小合理
   */
  balanced: {
    level: 'balanced',
    name: '平衡模式',
    description: '速度与质量兼顾，推荐用于大多数场景',
    encoding: {
      crf: 23,                    // 标准质量
      preset: 'medium',           // 平衡编码
      pixelFormat: 'yuv420p',
      vsync: 2,
      audioCodec: 'copy',
      gopSize: 25,
      bframes: 3,                 // 使用B帧提高压缩率
    },
    rendering: {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'medium',
      textRendering: {
        quality: 'auto',
        fontSmoothing: true,
        subpixelRendering: true,
      },
      exportQuality: 0.92,
      exportFormat: 'image/png',
    }
  },

  /**
   * 高质量模式 - 优先质量
   * 适合：最终输出、重要项目、高清内容
   * 特点：编码速度较慢，质量优秀，文件大小适中
   */
  high: {
    level: 'high',
    name: '高质量模式',
    description: '优先视频质量，适合最终输出和重要项目',
    encoding: {
      crf: 18,                    // 高质量
      preset: 'slow',             // 较慢但高质量
      pixelFormat: 'yuv420p',
      vsync: 2,
      audioCodec: 'copy',
      gopSize: 20,                // 更多关键帧
      bframes: 5,                 // 更多B帧
    },
    rendering: {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      textRendering: {
        quality: 'optimizeLegibility',
        fontSmoothing: true,
        subpixelRendering: true,
      },
      exportQuality: 0.98,
      exportFormat: 'image/png',
    }
  },

  /**
   * 超高质量模式 - 极致质量
   * 适合：专业制作、归档、无损需求
   * 特点：编码速度最慢，质量最佳，文件较大
   */
  ultra: {
    level: 'ultra',
    name: '超高质量模式',
    description: '极致视频质量，适合专业制作和归档',
    encoding: {
      crf: 15,                    // 极高质量
      preset: 'veryslow',         // 最慢但最高质量
      pixelFormat: 'yuv444p',     // 更高色彩精度
      vsync: 2,
      audioCodec: 'copy',
      gopSize: 15,                // 最多关键帧
      bframes: 8,                 // 最多B帧
      extraArgs: [
        '-tune', 'film',          // 针对电影内容优化
        '-profile:v', 'high444',  // 使用high444 profile
      ],
    },
    rendering: {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      textRendering: {
        quality: 'geometricPrecision',
        fontSmoothing: true,
        subpixelRendering: true,
      },
      exportQuality: 1.0,         // 最高质量
      exportFormat: 'image/png',
    }
  }
};

/**
 * 获取质量配置
 */
export function getQualityConfig(level: QualityLevel, customConfig?: Partial<VideoQualityConfig>): VideoQualityConfig {
  if (level === 'custom') {
    if (!customConfig) {
      throw new Error('Custom quality level requires customConfig parameter');
    }
    return {
      level: 'custom',
      name: customConfig.name || '自定义',
      description: customConfig.description || '自定义质量配置',
      encoding: {
        ...QUALITY_PRESETS.balanced.encoding,
        ...customConfig.encoding,
      },
      rendering: {
        ...QUALITY_PRESETS.balanced.rendering,
        ...customConfig.rendering,
      },
    };
  }

  return QUALITY_PRESETS[level];
}

/**
 * 构建FFmpeg命令参数
 */
export function buildFFmpegArgs(
  config: FFmpegEncodingConfig,
  inputFramesPattern: string,
  inputVideoPath: string,
  outputPath: string,
  fps: number
): string[] {
  const args: string[] = [];

  // 硬件加速（必须在输入之前）
  if (config.hardwareAccel && config.hardwareAccel !== 'none') {
    if (config.hardwareAccel === 'auto') {
      args.push('-hwaccel', 'auto');
    } else {
      args.push('-hwaccel', config.hardwareAccel);
    }
  }

  // 输入帧序列
  args.push(
    '-framerate', fps.toString(),
    '-i', inputFramesPattern
  );

  // 输入原始视频（用于音频）
  args.push('-i', inputVideoPath);

  // 映射流：视频从第一个输入，音频从第二个输入
  args.push(
    '-map', '0:v',      // 使用帧序列作为视频
    '-map', '1:a?',     // 如果存在，使用原始视频的音频
  );

  // 视频编码设置
  args.push(
    '-c:v', 'libx264',
    '-preset', config.preset,
    '-crf', config.crf.toString(),
    '-pix_fmt', config.pixelFormat
  );

  // 视频比特率（如果指定）
  if (config.videoBitrate) {
    args.push('-b:v', config.videoBitrate);
  }

  // GOP和B帧设置
  if (config.gopSize) {
    args.push('-g', config.gopSize.toString());
  }
  if (config.bframes !== undefined) {
    args.push('-bf', config.bframes.toString());
  }

  // 同步方法
  if (config.vsync !== undefined) {
    args.push('-vsync', config.vsync.toString());
  }

  // 音频编码设置
  if (config.audioCodec) {
    args.push('-c:a', config.audioCodec);
    if (config.audioCodec !== 'copy' && config.audioBitrate) {
      args.push('-b:a', config.audioBitrate);
    }
  }

  // 额外参数
  if (config.extraArgs && config.extraArgs.length > 0) {
    args.push(...config.extraArgs);
  }

  // 输出文件
  args.push(outputPath);

  return args;
}

/**
 * 验证质量配置
 */
export function validateQualityConfig(config: VideoQualityConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证CRF值
  if (config.encoding.crf < 0 || config.encoding.crf > 51) {
    errors.push(`CRF值必须在0-51之间，当前值: ${config.encoding.crf}`);
  }

  // 验证导出质量
  if (config.rendering.exportQuality < 0 || config.rendering.exportQuality > 1) {
    errors.push(`导出质量必须在0-1之间，当前值: ${config.rendering.exportQuality}`);
  }

  // 验证GOP大小
  if (config.encoding.gopSize && config.encoding.gopSize < 1) {
    errors.push(`GOP大小必须大于0，当前值: ${config.encoding.gopSize}`);
  }

  // 验证B帧数量
  if (config.encoding.bframes !== undefined && config.encoding.bframes < 0) {
    errors.push(`B帧数量不能为负数，当前值: ${config.encoding.bframes}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取质量配置的预估信息
 */
export function getQualityEstimate(config: VideoQualityConfig, durationSeconds: number): {
  estimatedFileSize: string;
  estimatedEncodeTime: string;
  qualityRating: number;
} {
  // 基于CRF估算文件大小（非常粗略的估算）
  const crfFactor = Math.exp((28 - config.encoding.crf) / 10);
  const baseSizeMB = durationSeconds * 2; // 基准：2MB/秒
  const estimatedSizeMB = baseSizeMB * crfFactor;

  // 基于preset估算编码时间
  const presetFactors: Record<FFmpegPreset, number> = {
    'ultrafast': 0.3,
    'superfast': 0.4,
    'veryfast': 0.5,
    'faster': 0.7,
    'fast': 0.9,
    'medium': 1.0,
    'slow': 1.5,
    'slower': 2.0,
    'veryslow': 3.0,
  };
  const presetFactor = presetFactors[config.encoding.preset] || 1.0;
  const baseTimeSeconds = durationSeconds * 2; // 基准：2倍实时
  const estimatedTimeSeconds = baseTimeSeconds * presetFactor;

  // 质量评分（0-100）
  const qualityRating = Math.round((51 - config.encoding.crf) / 51 * 100);

  return {
    estimatedFileSize: estimatedSizeMB < 1024
      ? `${estimatedSizeMB.toFixed(1)} MB`
      : `${(estimatedSizeMB / 1024).toFixed(2)} GB`,
    estimatedEncodeTime: estimatedTimeSeconds < 60
      ? `${Math.round(estimatedTimeSeconds)} 秒`
      : `${Math.round(estimatedTimeSeconds / 60)} 分钟`,
    qualityRating
  };
}
