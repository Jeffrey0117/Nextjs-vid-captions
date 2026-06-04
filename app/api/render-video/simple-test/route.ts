import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    console.log("📝 Simple test API called");
    
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const videoPath = formData.get("videoPath") as string;
    const subtitlesJson = formData.get("subtitles") as string;
    
    console.log("📊 Form data received:", {
      hasVideoFile: !!videoFile,
      videoPath: videoPath,
      subtitlesExists: !!subtitlesJson
    });
    
    if (subtitlesJson) {
      const subtitles = JSON.parse(subtitlesJson);
      console.log("📝 Subtitles count:", subtitles.length);
    }
    
    return NextResponse.json({
      status: "success",
      message: "Test API working",
      data: {
        hasVideoFile: !!videoFile,
        videoPath: videoPath,
        subtitlesCount: subtitlesJson ? JSON.parse(subtitlesJson).length : 0
      }
    });
    
  } catch (error: any) {
    console.error("❌ Test API error:", error);
    return NextResponse.json(
      { 
        error: "Test API failed", 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}