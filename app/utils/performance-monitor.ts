/**
 * 性能监控工具
 *
 * 用于收集和分析录制过程的性能数据
 * 支持：
 * 1. 帧渲染时间统计
 * 2. 编码性能监控
 * 3. 上传速度追踪
 * 4. 内存使用分析
 * 5. 性能瓶颈识别
 */

export interface PerformanceMetrics {
  // 整体统计
  totalDuration: number; // 总耗时（秒）
  totalFrames: number; // 总帧数
  avgFps: number; // 平均FPS

  // 帧渲染统计
  rendering: {
    totalTime: number; // 总渲染时间（毫秒）
    avgFrameTime: number; // 平均每帧时间（毫秒）
    minFrameTime: number; // 最快帧（毫秒）
    maxFrameTime: number; // 最慢帧（毫秒）
    framesPerSecond: number; // 渲染FPS
  };

  // 编码统计
  encoding: {
    totalTime: number; // 总编码时间（毫秒）
    avgFrameTime: number; // 平均每帧编码时间
    queueSizeAvg: number; // 平均队列大小
    queueSizeMax: number; // 最大队列大小
    framesPerSecond: number; // 编码FPS
  };

  // 上传统计（仅Legacy方案）
  upload?: {
    totalTime: number; // 总上传时间（秒）
    totalBytes: number; // 总字节数
    avgSpeed: number; // 平均速度（MB/s）
    batchCount: number; // 批次数量
    parallelUploads: number; // 并发上传数
  };

  // 内存统计
  memory: {
    peakUsage: number; // 峰值内存（MB）
    avgUsage: number; // 平均内存（MB）
    gcCount: number; // GC次数（如果可用）
  };

  // 瓶颈分析
  bottlenecks: {
    slowestPhase: 'rendering' | 'encoding' | 'upload' | 'seek';
    timeBreakdown: {
      seek: number; // 视频跳转耗时百分比
      render: number; // 渲染耗时百分比
      encode: number; // 编码耗时百分比
      upload: number; // 上传耗时百分比
    };
    recommendations: string[]; // 优化建议
  };
}

export class PerformanceMonitor {
  private startTime = 0;
  private endTime = 0;
  private totalFrames = 0;

  // 帧渲染追踪
  private frameRenderTimes: number[] = [];
  private frameRenderStart = 0;

  // 编码追踪
  private frameEncodeTimes: number[] = [];
  private frameEncodeStart = 0;
  private encodeQueueSizes: number[] = [];

  // 上传追踪
  private uploadStats = {
    startTime: 0,
    endTime: 0,
    totalBytes: 0,
    batchCount: 0,
    maxParallelUploads: 0,
  };

  // 内存追踪
  private memoryReadings: number[] = [];
  private memoryCheckInterval: any = null;

  // 视频跳转追踪
  private seekTimes: number[] = [];
  private seekStart = 0;

  constructor(totalFrames: number) {
    this.totalFrames = totalFrames;
  }

  /**
   * 开始监控
   */
  public start(): void {
    this.startTime = performance.now();
    console.log('🔍 性能监控已启动');

    // 开始内存监控（每秒检查一次）
    if ('memory' in performance) {
      this.memoryCheckInterval = setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo && memInfo.usedJSHeapSize) {
          const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;
          this.memoryReadings.push(usedMB);
        }
      }, 1000);
    }
  }

  /**
   * 结束监控
   */
  public stop(): void {
    this.endTime = performance.now();

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    console.log('🔍 性能监控已停止');
  }

  /**
   * === 帧渲染追踪 ===
   */
  public startFrameRender(): void {
    this.frameRenderStart = performance.now();
  }

  public endFrameRender(): void {
    const duration = performance.now() - this.frameRenderStart;
    this.frameRenderTimes.push(duration);
  }

  /**
   * === 编码追踪 ===
   */
  public startFrameEncode(): void {
    this.frameEncodeStart = performance.now();
  }

  public endFrameEncode(queueSize: number): void {
    const duration = performance.now() - this.frameEncodeStart;
    this.frameEncodeTimes.push(duration);
    this.encodeQueueSizes.push(queueSize);
  }

  /**
   * === 视频跳转追踪 ===
   */
  public startSeek(): void {
    this.seekStart = performance.now();
  }

  public endSeek(): void {
    const duration = performance.now() - this.seekStart;
    this.seekTimes.push(duration);
  }

  /**
   * === 上传追踪 ===
   */
  public startUpload(): void {
    this.uploadStats.startTime = performance.now();
  }

  public endUpload(): void {
    this.uploadStats.endTime = performance.now();
  }

  public recordUploadBatch(bytes: number, parallelUploads: number): void {
    this.uploadStats.totalBytes += bytes;
    this.uploadStats.batchCount++;
    this.uploadStats.maxParallelUploads = Math.max(
      this.uploadStats.maxParallelUploads,
      parallelUploads
    );
  }

  /**
   * 生成性能报告
   */
  public generateReport(): PerformanceMetrics {
    const totalDuration = (this.endTime - this.startTime) / 1000; // 秒
    const avgFps = this.totalFrames / totalDuration;

    // 渲染统计
    const renderTotal = this.frameRenderTimes.reduce((a, b) => a + b, 0);
    const renderAvg = renderTotal / this.frameRenderTimes.length;
    const renderMin = Math.min(...this.frameRenderTimes);
    const renderMax = Math.max(...this.frameRenderTimes);
    const renderFps = 1000 / renderAvg;

    // 编码统计
    const encodeTotal = this.frameEncodeTimes.reduce((a, b) => a + b, 0);
    const encodeAvg = encodeTotal / this.frameEncodeTimes.length;
    const queueAvg = this.encodeQueueSizes.reduce((a, b) => a + b, 0) / this.encodeQueueSizes.length;
    const queueMax = Math.max(...this.encodeQueueSizes);
    const encodeFps = 1000 / encodeAvg;

    // 上传统计
    let uploadStats = undefined;
    if (this.uploadStats.batchCount > 0) {
      const uploadDuration = (this.uploadStats.endTime - this.uploadStats.startTime) / 1000;
      const avgSpeed = (this.uploadStats.totalBytes / 1024 / 1024) / uploadDuration;

      uploadStats = {
        totalTime: uploadDuration,
        totalBytes: this.uploadStats.totalBytes,
        avgSpeed,
        batchCount: this.uploadStats.batchCount,
        parallelUploads: this.uploadStats.maxParallelUploads,
      };
    }

    // 内存统计
    const peakMemory = this.memoryReadings.length > 0 ? Math.max(...this.memoryReadings) : 0;
    const avgMemory = this.memoryReadings.length > 0
      ? this.memoryReadings.reduce((a, b) => a + b, 0) / this.memoryReadings.length
      : 0;

    // 跳转统计
    const seekTotal = this.seekTimes.reduce((a, b) => a + b, 0);

    // 时间分解
    const uploadTime = uploadStats?.totalTime || 0;
    const totalTime = totalDuration;

    const timeBreakdown = {
      seek: (seekTotal / 1000) / totalTime * 100,
      render: (renderTotal / 1000) / totalTime * 100,
      encode: (encodeTotal / 1000) / totalTime * 100,
      upload: uploadTime / totalTime * 100,
    };

    // 瓶颈分析
    const bottlenecks = this.analyzeBottlenecks(timeBreakdown, renderAvg, encodeAvg, queueAvg);

    return {
      totalDuration,
      totalFrames: this.totalFrames,
      avgFps,

      rendering: {
        totalTime: renderTotal,
        avgFrameTime: renderAvg,
        minFrameTime: renderMin,
        maxFrameTime: renderMax,
        framesPerSecond: renderFps,
      },

      encoding: {
        totalTime: encodeTotal,
        avgFrameTime: encodeAvg,
        queueSizeAvg: queueAvg,
        queueSizeMax: queueMax,
        framesPerSecond: encodeFps,
      },

      upload: uploadStats,

      memory: {
        peakUsage: peakMemory,
        avgUsage: avgMemory,
        gcCount: 0, // 无法精确获取
      },

      bottlenecks,
    };
  }

  /**
   * 分析瓶颈
   */
  private analyzeBottlenecks(
    timeBreakdown: any,
    renderAvg: number,
    encodeAvg: number,
    queueAvg: number
  ): PerformanceMetrics['bottlenecks'] {
    const recommendations: string[] = [];

    // 找出最慢的阶段
    let slowestPhase: 'rendering' | 'encoding' | 'upload' | 'seek' = 'rendering';
    let maxTime = timeBreakdown.render;

    if (timeBreakdown.encode > maxTime) {
      slowestPhase = 'encoding';
      maxTime = timeBreakdown.encode;
    }
    if (timeBreakdown.upload > maxTime) {
      slowestPhase = 'upload';
      maxTime = timeBreakdown.upload;
    }
    if (timeBreakdown.seek > maxTime) {
      slowestPhase = 'seek';
      maxTime = timeBreakdown.seek;
    }

    // 生成优化建议
    if (slowestPhase === 'rendering') {
      recommendations.push('渲染是瓶颈。建议：减少超采样倍数、优化字幕绘制、使用OffscreenCanvas');
      if (renderAvg > 50) {
        recommendations.push('每帧渲染时间过长（>50ms）。考虑降低画质设置或减少字幕特效');
      }
    }

    if (slowestPhase === 'encoding') {
      recommendations.push('编码是瓶颈。建议：降低比特率、使用更快的preset、启用硬件加速');
      if (queueAvg > 5) {
        recommendations.push('编码队列过大。考虑优化背压控制或降低编码质量');
      }
    }

    if (slowestPhase === 'upload') {
      recommendations.push('上传是瓶颈。建议：增加并发上传数、压缩帧数据、优化网络连接');
    }

    if (slowestPhase === 'seek') {
      recommendations.push('视频跳转是瓶颈。建议：使用requestVideoFrameCallback、预加载下一帧');
    }

    // 内存建议
    if (this.memoryReadings.length > 0) {
      const peak = Math.max(...this.memoryReadings);
      if (peak > 500) {
        recommendations.push(`内存使用过高（${peak.toFixed(0)}MB）。建议：减小批次大小、立即释放VideoFrame`);
      }
    }

    return {
      slowestPhase,
      timeBreakdown,
      recommendations,
    };
  }

  /**
   * 打印性能报告
   */
  public printReport(): void {
    const report = this.generateReport();

    console.log('\n📊 ========== 性能报告 ==========');
    console.log(`⏱️  总耗时: ${report.totalDuration.toFixed(2)}s`);
    console.log(`🎬 总帧数: ${report.totalFrames}`);
    console.log(`📈 平均FPS: ${report.avgFps.toFixed(1)}`);

    console.log('\n🎨 渲染性能:');
    console.log(`  - 总时间: ${(report.rendering.totalTime / 1000).toFixed(2)}s`);
    console.log(`  - 平均帧时: ${report.rendering.avgFrameTime.toFixed(2)}ms`);
    console.log(`  - 最快帧: ${report.rendering.minFrameTime.toFixed(2)}ms`);
    console.log(`  - 最慢帧: ${report.rendering.maxFrameTime.toFixed(2)}ms`);
    console.log(`  - 渲染FPS: ${report.rendering.framesPerSecond.toFixed(1)}`);

    console.log('\n🔥 编码性能:');
    console.log(`  - 总时间: ${(report.encoding.totalTime / 1000).toFixed(2)}s`);
    console.log(`  - 平均帧时: ${report.encoding.avgFrameTime.toFixed(2)}ms`);
    console.log(`  - 平均队列: ${report.encoding.queueSizeAvg.toFixed(1)}`);
    console.log(`  - 最大队列: ${report.encoding.queueSizeMax}`);
    console.log(`  - 编码FPS: ${report.encoding.framesPerSecond.toFixed(1)}`);

    if (report.upload) {
      console.log('\n📤 上传性能:');
      console.log(`  - 总时间: ${report.upload.totalTime.toFixed(2)}s`);
      console.log(`  - 总数据: ${(report.upload.totalBytes / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  - 平均速度: ${report.upload.avgSpeed.toFixed(2)}MB/s`);
      console.log(`  - 批次数: ${report.upload.batchCount}`);
      console.log(`  - 并发数: ${report.upload.parallelUploads}`);
    }

    console.log('\n💾 内存使用:');
    console.log(`  - 峰值: ${report.memory.peakUsage.toFixed(1)}MB`);
    console.log(`  - 平均: ${report.memory.avgUsage.toFixed(1)}MB`);

    console.log('\n🔍 时间分解:');
    console.log(`  - 视频跳转: ${report.bottlenecks.timeBreakdown.seek.toFixed(1)}%`);
    console.log(`  - 渲染: ${report.bottlenecks.timeBreakdown.render.toFixed(1)}%`);
    console.log(`  - 编码: ${report.bottlenecks.timeBreakdown.encode.toFixed(1)}%`);
    console.log(`  - 上传: ${report.bottlenecks.timeBreakdown.upload.toFixed(1)}%`);

    console.log(`\n⚠️  瓶颈: ${report.bottlenecks.slowestPhase}`);
    console.log('💡 优化建议:');
    report.bottlenecks.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });

    console.log('================================\n');
  }

  /**
   * 导出JSON格式报告
   */
  public exportJSON(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }
}
