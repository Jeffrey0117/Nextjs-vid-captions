import { NextResponse } from "next/server";
import * as deepl from 'deepl-node';

export async function POST(request: Request) {
  try {
    const { text, texts } = await request.json();

    // 支援單一文字和批量文字翻譯
    const isTextArray = texts && Array.isArray(texts);
    const textToTranslate = isTextArray ? texts : [text];

    console.log('收到翻譯請求:', isTextArray ? `批量 ${texts.length} 條` : '單條', textToTranslate);

    if (!textToTranslate || textToTranslate.length === 0 || textToTranslate.every((t: string) => !t)) {
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

    // DeepL API 支援批量翻譯，一次傳送多個文字
    const result = await deeplClient.translateText(textToTranslate, null, 'ZH-HANT' as any);

    console.log('DeepL API 結果:', result);

    // 處理結果 - DeepL 批量翻譯會返回陣列
    const translatedTexts = Array.isArray(result) 
      ? result.map(r => r.text) 
      : [result.text];

    console.log('翻譯完成:', {
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
    console.error("DeepL 翻譯錯誤:", error);
    return NextResponse.json(
      { error: "翻譯失敗: " + (error as Error).message },
      { status: 500 }
    );
  }
}