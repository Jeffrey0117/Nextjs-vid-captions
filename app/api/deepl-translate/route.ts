import { NextResponse } from "next/server";
import * as deepl from 'deepl-node';

export async function POST(request: Request) {
  try {
    const { text, texts } = await request.json();

    // 支援單一文字和批量文字翻譯
    const isTextArray = texts && Array.isArray(texts);
    const textToTranslate = isTextArray ? texts : [text];

    console.log('收到翻譯請求:', isTextArray ? `批量 ${texts.length} 條` : '單條');

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

    // DeepL API 限制：每次請求最多 50 條文本
    // 如果超過 50 條，需要分批處理
    const BATCH_SIZE = 50;
    const allTranslatedTexts: string[] = [];

    if (textToTranslate.length > BATCH_SIZE) {
      console.log(`📦 文本數量 ${textToTranslate.length} 超過限制，分批處理（每批 ${BATCH_SIZE} 條）`);

      // 分批處理
      for (let i = 0; i < textToTranslate.length; i += BATCH_SIZE) {
        const batch = textToTranslate.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(textToTranslate.length / BATCH_SIZE);

        console.log(`🔄 處理第 ${batchNumber}/${totalBatches} 批 (${batch.length} 條)`);

        const result = await deeplClient.translateText(batch, null, 'ZH-HANT' as any);
        const batchTranslated = Array.isArray(result)
          ? result.map((r: any) => r.text)
          : [(result as any).text];

        allTranslatedTexts.push(...batchTranslated);
        console.log(`✅ 第 ${batchNumber}/${totalBatches} 批完成`);
      }

    } else {
      // 一次性翻譯（不超過 50 條）
      const result = await deeplClient.translateText(textToTranslate, null, 'ZH-HANT' as any);
      const translatedTexts = Array.isArray(result)
        ? result.map((r: any) => r.text)
        : [(result as any).text];

      allTranslatedTexts.push(...translatedTexts);
    }

    console.log('翻譯完成:', {
      原文數量: textToTranslate.length,
      翻譯結果數量: allTranslatedTexts.length,
    });

    // 根據請求類型返回不同格式
    if (isTextArray) {
      return NextResponse.json({
        success: true,
        translatedTexts: allTranslatedTexts,
        originalTexts: textToTranslate
      });
    } else {
      return NextResponse.json({
        success: true,
        translatedText: allTranslatedTexts[0],
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