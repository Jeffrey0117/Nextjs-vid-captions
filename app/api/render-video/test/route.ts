import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      status: "OK",
      message: "Canvas render API is working",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Test failed", details: error.message },
      { status: 500 }
    );
  }
}