import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 批次接收幀數據API
 *
 * 方案2優化：流式數據傳輸與批次處理
 * - 接收前端分批發送的幀數據
 * - 逐步寫入磁盤，避免內存爆滿
 * - 支持會話管理和進度追踪
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const sessionId = formData.get("sessionId") as string;
    const batchId = parseInt(formData.get("batchId") as string);
    const totalBatches = parseInt(formData.get("totalBatches") as string);
    const isLastBatch = formData.get("isLastBatch") === "true";
    const videoPath = formData.get("videoPath") as string;
    const fps = parseInt(formData.get("fps") as string) || 30;
    const totalFrames = parseInt(formData.get("totalFrames") as string);

    console.log(`📦 收到批次 ${batchId + 1}/${totalBatches} (Session: ${sessionId})`);

    if (!sessionId) {
      return NextResponse.json(
        { error: "缺少sessionId" },
        { status: 400 }
      );
    }

    // 創建會話目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    const sessionDir = path.join(tempDir, sessionId);
    const framesDir = path.join(sessionDir, "frames");
    const metaPath = path.join(sessionDir, "meta.json");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    // 保存或更新元數據
    const meta = {
      sessionId,
      videoPath,
      fps,
      totalFrames,
      totalBatches,
      receivedBatches: [] as number[],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    // 如果元數據已存在，讀取並更新
    if (fs.existsSync(metaPath)) {
      const existingMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      meta.receivedBatches = existingMeta.receivedBatches || [];
      meta.createdAt = existingMeta.createdAt;
    }

    // 記錄已接收的批次
    if (!meta.receivedBatches.includes(batchId)) {
      meta.receivedBatches.push(batchId);
    }
    meta.receivedBatches.sort((a, b) => a - b);

    // 儲存當前批次的幀
    const frameKeys = Array.from(formData.keys()).filter(key => key.startsWith("frame_"));
    console.log(`  儲存 ${frameKeys.length} 幀...`);

    let savedCount = 0;
    for (const key of frameKeys) {
      const frameBlob = formData.get(key) as Blob;
      if (!frameBlob) continue;

      const frameIndex = parseInt(key.replace("frame_", ""));
      const framePath = path.join(framesDir, `frame_${frameIndex.toString().padStart(8, '0')}.png`);

      // 將Blob轉為Buffer並寫入
      const arrayBuffer = await frameBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.promises.writeFile(framePath, buffer);
      savedCount++;
    }

    // 更新元數據
    await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2));

    console.log(`✅ 批次 ${batchId} 儲存完成: ${savedCount} 幀`);
    console.log(`   進度: ${meta.receivedBatches.length}/${totalBatches} 批次已接收`);

    // 檢查是否所有批次都已接收
    const allBatchesReceived = meta.receivedBatches.length === totalBatches;

    return NextResponse.json({
      success: true,
      batchId,
      savedFrames: savedCount,
      receivedBatches: meta.receivedBatches.length,
      totalBatches,
      allBatchesReceived,
      isLastBatch,
    });

  } catch (error: any) {
    console.error("❌ 批次處理失敗:", error);
    return NextResponse.json(
      { error: error.message || "批次處理失敗" },
      { status: 500 }
    );
  }
}
