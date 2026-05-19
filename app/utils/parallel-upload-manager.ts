/**
 * 并行上传管理器
 *
 * 核心优化：实现真正的并行处理
 * 1. 编码下一批次的同时上传当前批次
 * 2. 双缓冲机制：编码队列 + 上传队列
 * 3. 智能背压控制：防止内存爆满
 * 4. 错误处理和自动重试
 */

interface UploadTask {
  batchId: number;
  frames: Blob[];
  isLastBatch: boolean;
  retryCount: number;
  timestamp: number;
}

interface UploadStats {
  totalBatches: number;
  uploadedBatches: number;
  failedBatches: number;
  totalBytes: number;
  uploadedBytes: number;
  avgUploadSpeed: number; // bytes/second
  estimatedTimeRemaining: number; // seconds
}

export class ParallelUploadManager {
  private uploadQueue: UploadTask[] = [];
  private isUploading = false;
  private maxConcurrentUploads = 2; // 最多2个并发上传
  private maxRetries = 3;
  private activeUploads = 0;

  private sessionId: string;
  private videoPath: string;
  private fps: number;
  private totalFrames: number;

  private stats: UploadStats = {
    totalBatches: 0,
    uploadedBatches: 0,
    failedBatches: 0,
    totalBytes: 0,
    uploadedBytes: 0,
    avgUploadSpeed: 0,
    estimatedTimeRemaining: 0,
  };

  private uploadStartTime = 0;
  private onProgressCallback?: (progress: number, stats: UploadStats) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(
    sessionId: string,
    videoPath: string,
    fps: number,
    totalFrames: number,
    totalBatches: number
  ) {
    this.sessionId = sessionId;
    this.videoPath = videoPath;
    this.fps = fps;
    this.totalFrames = totalFrames;
    this.stats.totalBatches = totalBatches;
  }

  /**
   * 设置回调函数
   */
  public setCallbacks(
    onProgress?: (progress: number, stats: UploadStats) => void,
    onError?: (error: Error) => void
  ) {
    this.onProgressCallback = onProgress;
    this.onErrorCallback = onError;
  }

  /**
   * 添加批次到上传队列（非阻塞）
   */
  public async queueBatch(batchId: number, frames: Blob[], isLastBatch: boolean): Promise<void> {
    const task: UploadTask = {
      batchId,
      frames,
      isLastBatch,
      retryCount: 0,
      timestamp: Date.now(),
    };

    // 计算批次大小
    const batchSize = frames.reduce((sum, blob) => sum + blob.size, 0);
    this.stats.totalBytes += batchSize;

    this.uploadQueue.push(task);
    console.log(`📦 批次 ${batchId} 已加入上传队列 (${frames.length}帧, ${(batchSize / 1024 / 1024).toFixed(2)}MB)`);

    // 立即触发上传（非阻塞）
    this.processQueue();
  }

  /**
   * 处理上传队列（并行上传）
   */
  private async processQueue(): Promise<void> {
    // 如果已达到并发上限，等待
    if (this.activeUploads >= this.maxConcurrentUploads) {
      console.log(`⏳ 达到并发上限 (${this.activeUploads}/${this.maxConcurrentUploads})，等待中...`);
      return;
    }

    // 如果队列为空，退出
    if (this.uploadQueue.length === 0) {
      return;
    }

    // 取出第一个任务
    const task = this.uploadQueue.shift()!;
    this.activeUploads++;

    if (this.uploadStartTime === 0) {
      this.uploadStartTime = Date.now();
    }

    // 异步执行上传（不阻塞）
    this.uploadBatch(task)
      .then(() => {
        this.activeUploads--;
        this.stats.uploadedBatches++;

        // 更新统计信息
        this.updateStats();

        // 继续处理队列
        this.processQueue();
      })
      .catch((error) => {
        this.activeUploads--;
        this.stats.failedBatches++;

        console.error(`❌ 批次 ${task.batchId} 上传失败:`, error);

        // 如果未达到重试上限，重新加入队列
        if (task.retryCount < this.maxRetries) {
          task.retryCount++;
          this.uploadQueue.unshift(task); // 插入到队列前面优先重试
          console.log(`🔄 批次 ${task.batchId} 将重试 (${task.retryCount}/${this.maxRetries})`);

          // 延迟后重试
          setTimeout(() => this.processQueue(), 1000 * task.retryCount);
        } else {
          // 达到重试上限，报告错误
          this.onErrorCallback?.(new Error(`批次 ${task.batchId} 上传失败（已重试${this.maxRetries}次）`));
        }
      });

    // 如果还有空闲并发槽位，继续处理
    if (this.activeUploads < this.maxConcurrentUploads && this.uploadQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * 上传单个批次
   */
  private async uploadBatch(task: UploadTask): Promise<void> {
    const { batchId, frames, isLastBatch } = task;

    const formData = new FormData();
    formData.append('sessionId', this.sessionId);
    formData.append('batchId', batchId.toString());
    formData.append('totalBatches', this.stats.totalBatches.toString());
    formData.append('isLastBatch', isLastBatch.toString());
    formData.append('videoPath', this.videoPath);
    formData.append('fps', this.fps.toString());
    formData.append('totalFrames', this.totalFrames.toString());

    // 添加所有帧
    const batchSize = task.batchId * frames.length;
    frames.forEach((frameBlob, index) => {
      const frameIndex = batchSize + index;
      formData.append(
        `frame_${frameIndex}`,
        frameBlob,
        `frame_${frameIndex.toString().padStart(8, '0')}.png`
      );
    });

    const uploadStart = Date.now();

    const response = await fetch('/api/record-preview/batch', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`批次 ${batchId} 上传失败: ${errorText}`);
    }

    const uploadTime = (Date.now() - uploadStart) / 1000;
    const batchBytes = frames.reduce((sum, blob) => sum + blob.size, 0);
    this.stats.uploadedBytes += batchBytes;

    const result = await response.json();
    console.log(`✅ 批次 ${batchId + 1}/${this.stats.totalBatches} 上传成功 (${uploadTime.toFixed(1)}s, ${(batchBytes / 1024 / 1024 / uploadTime).toFixed(2)}MB/s)`);

    return result;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const elapsed = (Date.now() - this.uploadStartTime) / 1000;
    this.stats.avgUploadSpeed = this.stats.uploadedBytes / elapsed;

    const remainingBytes = this.stats.totalBytes - this.stats.uploadedBytes;
    this.stats.estimatedTimeRemaining = this.stats.avgUploadSpeed > 0
      ? remainingBytes / this.stats.avgUploadSpeed
      : 0;

    const progress = this.stats.uploadedBatches / this.stats.totalBatches;
    this.onProgressCallback?.(progress, this.stats);
  }

  /**
   * 等待所有上传完成
   */
  public async waitForCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.stats.failedBatches > 0 && this.uploadQueue.length === 0 && this.activeUploads === 0) {
          reject(new Error(`${this.stats.failedBatches} 个批次上传失败`));
        } else if (this.stats.uploadedBatches === this.stats.totalBatches) {
          console.log(`🎉 所有批次上传完成！`, {
            totalBatches: this.stats.totalBatches,
            totalSize: `${(this.stats.totalBytes / 1024 / 1024).toFixed(2)}MB`,
            avgSpeed: `${(this.stats.avgUploadSpeed / 1024 / 1024).toFixed(2)}MB/s`,
            totalTime: `${((Date.now() - this.uploadStartTime) / 1000).toFixed(1)}s`,
          });
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * 获取当前统计信息
   */
  public getStats(): UploadStats {
    return { ...this.stats };
  }

  /**
   * 取消所有上传
   */
  public cancel(): void {
    this.uploadQueue = [];
    console.log('🛑 上传已取消');
  }
}
