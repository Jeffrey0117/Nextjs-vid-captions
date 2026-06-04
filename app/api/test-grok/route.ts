import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = "REDACTED_XAI_KEY";
    
    console.log('測試 Grok API 連接...');
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a test assistant."
          },
          {
            role: "user",
            content: "Testing. Just say hi and hello world and nothing else."
          }
        ],
        model: "grok-beta",
        stream: false,
        temperature: 0
      }),
    });

    console.log('測試回應狀態:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('測試錯誤回應:', errorText);
      return NextResponse.json({
        success: false,
        error: `API 測試失敗: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('測試成功，回應:', data);

    return NextResponse.json({
      success: true,
      message: "Grok API 連接成功",
      response: data.choices?.[0]?.message?.content || "無回應內容"
    });

  } catch (error) {
    console.error("Grok API 測試錯誤:", error);
    return NextResponse.json({
      success: false,
      error: "測試失敗: " + (error as Error).message
    });
  }
}