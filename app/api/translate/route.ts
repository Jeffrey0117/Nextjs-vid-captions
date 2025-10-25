import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'zh-TW', sourceLang = 'auto' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: '請提供要翻譯的文字' },
        { status: 400 }
      );
    }

    // 使用 Google Translate 免費 API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('翻譯服務暫時無法使用');
    }

    const data = await response.json();
    
    // Google Translate API 回傳格式: [[[翻譯文字, 原文字, null, null, 可信度]]]
    const translatedText = data[0]?.map((item: any[]) => item[0]).join('') || text;

    return NextResponse.json({
      success: true,
      originalText: text,
      translatedText,
      sourceLang,
      targetLang,
    });

  } catch (error) {
    console.error('翻譯錯誤:', error);
    return NextResponse.json(
      { 
        error: '翻譯失敗',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}

// 批量翻譯端點
export async function PUT(request: NextRequest) {
  try {
    const { texts, targetLang = 'zh-TW', sourceLang = 'auto' } = await request.json();

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: '請提供要翻譯的文字陣列' },
        { status: 400 }
      );
    }

    // 批量翻譯
    const translations = await Promise.all(
      texts.map(async (text: string) => {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error('翻譯失敗');
          }

          const data = await response.json();
          const translatedText = data[0]?.map((item: any[]) => item[0]).join('') || text;

          return {
            originalText: text,
            translatedText,
            success: true,
          };
        } catch (error) {
          return {
            originalText: text,
            translatedText: text,
            success: false,
            error: error instanceof Error ? error.message : '翻譯失敗',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      translations,
      sourceLang,
      targetLang,
    });

  } catch (error) {
    console.error('批量翻譯錯誤:', error);
    return NextResponse.json(
      { 
        error: '批量翻譯失敗',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}