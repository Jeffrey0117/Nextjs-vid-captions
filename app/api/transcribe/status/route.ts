// app/api/transcribe/status/route.ts
// Poll task status and progress
import { NextResponse } from "next/server";
import { taskQueue } from "@/app/lib/task-queue";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const longPoll = searchParams.get("longPoll") === "true";

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    // Long polling: wait for next update (max 30s)
    if (longPoll) {
      const task = await taskQueue.waitForUpdate(taskId, 30000);
      if (!task) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(task);
    }

    // Regular polling: immediate response
    const task = taskQueue.getTaskStatus(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
