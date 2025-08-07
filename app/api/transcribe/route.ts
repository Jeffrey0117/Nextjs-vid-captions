// app/api/transcribe/route.ts
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 創建臨時目錄
    const tempDir = path.join(process.cwd(), "public", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 保存上傳的檔案
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `video_${Date.now()}.${file.name.split(".").pop()}`;
    const filePath = path.join(tempDir, fileName);
    await fs.promises.writeFile(filePath, fileBuffer);

    // 生成 SRT 檔案路徑
    const srtFileName = `${path.basename(
      fileName,
      path.extname(fileName)
    )}.srt`;
    const srtPath = path.join(tempDir, srtFileName);

    try {
      // 執行 Whisper 命令
      const { stderr } = await execAsync(
        `whisper "${filePath}" --model base --output_format srt --output_dir "${tempDir}" --language zh`
      );

      if (stderr) {
        console.error("Whisper stderr:", stderr);
      }

      // 讀取生成的 SRT 檔案
      let srtContent = "";
      if (fs.existsSync(srtPath)) {
        srtContent = await fs.promises.readFile(srtPath, "utf-8");
      }

      return NextResponse.json({
        videoUrl: `/temp/${fileName}`,
        srtContent: srtContent,
        status: "completed",
      });
    } catch (error) {
      console.error("Whisper error:", error);
      return NextResponse.json(
        { error: "Failed to process video with Whisper" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
