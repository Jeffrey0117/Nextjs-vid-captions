import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;

    if (!videoFile) {
      return NextResponse.json(
        { error: "沒有找到影片檔案" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 生成檔案名稱
    const fileExtension = videoFile.name.split('.').pop() || 'mp4';
    const videoFileName = `video_${Date.now()}.${fileExtension}`;
    const videoPath = path.join(tempDir, videoFileName);

    // 儲存影片檔案
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.promises.writeFile(videoPath, videoBuffer);

    return NextResponse.json({
      success: true,
      videoPath: videoFileName, // 只返回檔案名稱
      message: "影片上傳成功"
    }, { headers: corsHeaders });

  } catch (error) {
    console.error("影片上傳錯誤:", error);
    return NextResponse.json(
      { error: "影片上傳失敗" },
      { status: 500, headers: corsHeaders }
    );
  }
}