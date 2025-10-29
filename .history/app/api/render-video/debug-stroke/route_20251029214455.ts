import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    console.log("🔍 Debug API called");
    
    const formData = await request.formData();
    const videoPath = formData.get("videoPath") as string;
    const subtitlesJson = formData.get("subtitles") as string;
    
    console.log("📄 Received data:", {
      videoPath,
      subtitlesCount: subtitlesJson ? JSON.parse(subtitlesJson).length : 0
    });
    
    if (!videoPath || !subtitlesJson) {
      return NextResponse.json(
        { error: "缺少必要參數" },
        { status: 400 }
      );
    }
    
    const subtitles = JSON.parse(subtitlesJson);
    console.log("📝 First subtitle:", subtitles[0]);
    
    return NextResponse.json({
      success: true,
      message: "資料接收成功",
      data: {
        videoPath,
        subtitlesCount: subtitles.length,
        firstSubtitle: subtitles[0]
      }
    });
    
  } catch (error) {
    console.error("❌ Debug API error:", error);
    return NextResponse.json(
      { error: `伺服器錯誤: ${error.message}` },
      { status: 500 }
    );
  }
}