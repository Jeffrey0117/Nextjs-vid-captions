// Task Queue System for Async Whisper Processing
// Supports task submission, status query, and real-time progress updates

import { EventEmitter } from "events";

export interface TaskProgress {
  taskId: string;
  status: "queued" | "processing" | "completed" | "error";
  progress: number; // 0-100
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  message?: string; // Human-readable status message
}

interface TaskHandler {
  execute: () => Promise<any>;
  onProgress?: (progress: number, message?: string) => void;
}

class TaskQueue extends EventEmitter {
  private tasks: Map<string, TaskProgress> = new Map();
  private runningTasks: Set<string> = new Set();
  private maxConcurrentTasks = 3; // Limit concurrent tasks

  constructor() {
    super();
    this.setMaxListeners(100); // Increase max listeners for long polling
  }

  /**
   * Submit a new task to the queue
   */
  public submitTask(taskId: string, handler: TaskHandler): void {
    const task: TaskProgress = {
      taskId,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      message: "Task queued",
    };

    this.tasks.set(taskId, task);
    this.emit(`task:${taskId}:update`, task);

    // Start processing if capacity available
    this.processNext(taskId, handler);
  }

  /**
   * Get task status
   */
  public getTaskStatus(taskId: string): TaskProgress | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Update task progress
   */
  public updateProgress(
    taskId: string,
    progress: number,
    message?: string
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.min(100, Math.max(0, progress));
    task.updatedAt = new Date();
    if (message) task.message = message;

    this.tasks.set(taskId, task);
    this.emit(`task:${taskId}:update`, task);
  }

  /**
   * Mark task as completed
   */
  public completeTask(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = "completed";
    task.progress = 100;
    task.result = result;
    task.updatedAt = new Date();
    task.message = "Task completed successfully";

    this.tasks.set(taskId, task);
    this.runningTasks.delete(taskId);
    this.emit(`task:${taskId}:update`, task);
    this.emit(`task:${taskId}:completed`, task);
  }

  /**
   * Mark task as failed
   */
  public failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = "error";
    task.error = error;
    task.updatedAt = new Date();
    task.message = `Error: ${error}`;

    this.tasks.set(taskId, task);
    this.runningTasks.delete(taskId);
    this.emit(`task:${taskId}:update`, task);
    this.emit(`task:${taskId}:error`, task);
  }

  /**
   * Process task execution
   */
  private async processNext(taskId: string, handler: TaskHandler): Promise<void> {
    // Check concurrency limit
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      return; // Task stays queued
    }

    const task = this.tasks.get(taskId);
    if (!task) return;

    // Start processing
    task.status = "processing";
    task.updatedAt = new Date();
    task.message = "Processing started";
    this.tasks.set(taskId, task);
    this.runningTasks.add(taskId);
    this.emit(`task:${taskId}:update`, task);

    // Setup progress callback
    if (handler.onProgress) {
      handler.onProgress = (progress: number, message?: string) => {
        this.updateProgress(taskId, progress, message);
      };
    }

    try {
      // Execute task
      const result = await handler.execute();
      this.completeTask(taskId, result);
    } catch (error: any) {
      this.failTask(taskId, error.message || "Unknown error");
    }
  }

  /**
   * Clean up old tasks (older than 1 hour)
   */
  public cleanup(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        task.updatedAt < oneHourAgo &&
        (task.status === "completed" || task.status === "error")
      ) {
        this.tasks.delete(taskId);
        this.removeAllListeners(`task:${taskId}:update`);
        this.removeAllListeners(`task:${taskId}:completed`);
        this.removeAllListeners(`task:${taskId}:error`);
      }
    }
  }

  /**
   * Wait for task completion (for long polling)
   */
  public async waitForUpdate(
    taskId: string,
    timeout = 30000
  ): Promise<TaskProgress | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // If already completed or error, return immediately
    if (task.status === "completed" || task.status === "error") {
      return task;
    }

    // Wait for next update
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener(`task:${taskId}:update`, handler);
        resolve(this.tasks.get(taskId) || null);
      }, timeout);

      const handler = (updatedTask: TaskProgress) => {
        clearTimeout(timer);
        this.removeListener(`task:${taskId}:update`, handler);
        resolve(updatedTask);
      };

      this.once(`task:${taskId}:update`, handler);
    });
  }
}

// Singleton instance (防止 Next.js 熱重載時丟失)
declare global {
  var __taskQueue: TaskQueue | undefined;
}

export const taskQueue = global.__taskQueue || new TaskQueue();

if (!global.__taskQueue) {
  global.__taskQueue = taskQueue;

  // Cleanup old tasks every 10 minutes
  setInterval(() => {
    taskQueue.cleanup();
  }, 10 * 60 * 1000);
}
