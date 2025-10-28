import { NextResponse } from "next/server";
import * as deepl from 'deepl-node';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    console.log('收到翻譯請求:', text);

    if (!text) {
      console.log('錯誤: 沒有提供要翻譯的文字');
      return NextResponse.json(
        { error: "沒有提供要翻譯的文字" },
        { status: 400 }
      );
    }

    // 初始化 DeepL 客戶端
    const authKey = "f1e85fc7-778a-4306-8b0b-7f10badf91ff:fx";
    const deeplClient = new deepl.DeepLClient(authKey);

    console.log('開始翻譯...');

    // 翻譯文字到中文（簡體，DeepL 不支援繁體中文）
    const result = await deeplClient.translateText(text, null, 'zh');

    console.log('DeepL API 結果:', result);

    // 處理結果（可能是單個結果或數組）
    const translatedText = Array.isArray(result) ? result[0].text : result.text;

    console.log('翻譯完成:', {
      原文: text,
      翻譯結果: translatedText
    });

    return NextResponse.json({
      success: true,
      translatedText: translatedText,
      originalText: text
    });

  } catch (error) {
    console.error("DeepL 翻譯錯誤:", error);
    return NextResponse.json(
      { error: "翻譯失敗: " + (error as Error).message },
      { status: 500 }
    );
  }
}