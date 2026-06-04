import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 清理會話API
 *
 * 方案2優化：流式數據傳輸與批次處理
 * - 清理未完成或已取消的錄製會話
 * - 刪除臨時幀文件和元數據
 * - 釋放磁盤空間
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    console.log(`🧹 清理會話: ${sessionId}`);

    if (!sessionId) {
      return NextResponse.json(
        { error: "缺少sessionId" },
        { status: 400 }
      );
    }

    // 檢查會話目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    const sessionDir = path.join(tempDir, sessionId);

    if (!fs.existsSync(sessionDir)) {
      console.log(`⚠️ 會話目錄不存在: ${sessionId}`);
      return NextResponse.json({
        success: true,
        message: "會話已不存在",
      });
    }

    // 刪除會話目錄
    await fs.promises.rm(sessionDir, { recursive: true, force: true });

    console.log(`✅ 會話清理完成: ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: "會話已清理",
      sessionId,
    });

  } catch (error: any) {
    console.error("❌ 清理失敗:", error);
    return NextResponse.json(
      { error: error.message || "清理失敗" },
      { status: 500 }
    );
  }
}

/**
 * 清理所有過期會話（可選的定期清理）
 */
export async function GET() {
  try {
    const tempDir = path.join(process.cwd(), "public", "temp");

    if (!fs.existsSync(tempDir)) {
      return NextResponse.json({
        success: true,
        message: "沒有臨時目錄",
        cleaned: 0,
      });
    }

    // 清理超過1小時的會話
    const MAX_AGE = 60 * 60 * 1000; // 1小時
    const now = Date.now();
    let cleanedCount = 0;

    const entries = fs.readdirSync(tempDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('session_')) {
        continue;
      }

      const sessionDir = path.join(tempDir, entry.name);
      const metaPath = path.join(sessionDir, "meta.json");

      try {
        // 檢查元數據文件的修改時間
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          const age = now - (meta.lastUpdated || meta.createdAt || 0);

          if (age > MAX_AGE) {
            console.log(`🧹 清理過期會話: ${entry.name} (${Math.floor(age / 1000 / 60)}分鐘前)`);
            await fs.promises.rm(sessionDir, { recursive: true, force: true });
            cleanedCount++;
          }
        } else {
          // 沒有元數據文件的異常會話，直接刪除
          console.log(`🧹 清理異常會話: ${entry.name}`);
          await fs.promises.rm(sessionDir, { recursive: true, force: true });
          cleanedCount++;
        }
      } catch (cleanupError) {
        console.warn(`⚠️ 清理會話失敗: ${entry.name}`, cleanupError);
      }
    }

    console.log(`✅ 清理完成，共清理 ${cleanedCount} 個過期會話`);

    return NextResponse.json({
      success: true,
      message: `已清理 ${cleanedCount} 個過期會話`,
      cleaned: cleanedCount,
    });

  } catch (error: any) {
    console.error("❌ 批量清理失敗:", error);
    return NextResponse.json(
      { error: error.message || "批量清理失敗" },
      { status: 500 }
    );
  }
}
