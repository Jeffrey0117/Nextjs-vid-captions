import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text, texts } = await request.json();

    // 支援單一文字和批量文字翻譯
    const isTextArray = texts && Array.isArray(texts);
    const textToTranslate = isTextArray ? texts : [text];

    console.log('收到 Grok 翻譯請求:', isTextArray ? `批量 ${texts.length} 條` : '單條', textToTranslate);

    if (!textToTranslate || textToTranslate.length === 0 || textToTranslate.every((t: string) => !t)) {
      console.log('錯誤: 沒有提供要翻譯的文字');
      return NextResponse.json(
        { error: "沒有提供要翻譯的文字" },
        { status: 400 }
      );
    }

    // 初始化 Grok API
    const apiKey = "REDACTED_XAI_KEY";

    console.log('開始 Grok 翻譯...');

    // 建構翻譯提示
    const translatePrompt = isTextArray 
      ? `請將以下英文字幕翻譯成繁體中文，保持原有的格式和順序，每行一個翻譯結果：\n\n${textToTranslate.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
      : `請將以下英文翻譯成繁體中文：${textToTranslate[0]}`;

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
            content: "你是一個專業的英文到繁體中文翻譯助手。請提供準確、自然的翻譯，保持原文的語調和含義。只回傳翻譯結果，不要額外說明。"
          },
          {
            role: "user",
            content: translatePrompt
          }
        ],
        model: "grok-4-latest",
        stream: false,
        temperature: 0
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API 請求失敗: ${response.status}`);
    }

    const data = await response.json();
    console.log('Grok API 結果:', data);

    const translatedContent = data.choices?.[0]?.message?.content;
    if (!translatedContent) {
      throw new Error('Grok API 返回無效數據');
    }

    // 處理翻譯結果
    let translatedTexts: string[];
    
    if (isTextArray) {
      // 批量翻譯：解析numbered list格式的回應
      const lines = translatedContent.split('\n').filter((line: string) => line.trim());
      translatedTexts = lines.map((line: string) => {
        // 移除序號 "1. ", "2. " 等
        return line.replace(/^\d+\.\s*/, '').trim();
      });
      
      // 確保翻譯數量與原文數量一致
      if (translatedTexts.length !== textToTranslate.length) {
        console.warn('翻譯數量不一致，嘗試備用解析方法');
        // 備用方法：直接按行分割
        translatedTexts = translatedContent.split('\n')
          .filter((line: string) => line.trim())
          .slice(0, textToTranslate.length);
      }
    } else {
      // 單一翻譯
      translatedTexts = [translatedContent.trim()];
    }

    console.log('Grok 翻譯完成:', {
      原文數量: textToTranslate.length,
      翻譯結果數量: translatedTexts.length,
      結果: translatedTexts
    });

    // 根據請求類型返回不同格式
    if (isTextArray) {
      return NextResponse.json({
        success: true,
        translatedTexts: translatedTexts,
        originalTexts: textToTranslate
      });
    } else {
      return NextResponse.json({
        success: true,
        translatedText: translatedTexts[0],
        originalText: textToTranslate[0]
      });
    }

  } catch (error) {
    console.error("Grok 翻譯錯誤:", error);
    return NextResponse.json(
      { error: "翻譯失敗: " + (error as Error).message },
      { status: 500 }
    );
  }
}