import { NextResponse } from "next/server";
import { SubtitleSegment } from "@/app/stores/subtitle-store";

export async function POST(request: Request) {
  try {
    const { subtitles } = await request.json() as { subtitles: SubtitleSegment[] };

    console.log('🎬 收到 AI 標題生成請求，字幕數量:', subtitles?.length);

    if (!subtitles || subtitles.length === 0) {
      return NextResponse.json(
        { error: "沒有提供字幕內容" },
        { status: 400 }
      );
    }

    // 提取所有字幕文字內容
    const subtitleTexts = subtitles
      .map(seg => seg.translatedText || seg.text)
      .filter(text => text && text.trim().length > 0)
      .join('\n');

    console.log('📝 字幕內容摘要:', subtitleTexts.substring(0, 200) + '...');

    // 初始化 Grok API
    const apiKey = "REDACTED_XAI_KEY";

    // 建構標題生成提示
    const systemPrompt = `你是專業的影片標題生成專家。

請根據提供的字幕內容，生成3種風格的標題：

1. 吸睛標題 (catchy)
   - 目標：最大化點擊率
   - 長度：15-25字
   - 技巧：使用數字、疑問句、情緒詞、emoji
   - 例如：「🔥 3分鐘學會！新手都能懂的XX技巧」

2. 資訊標題 (informative)
   - 目標：清晰傳達內容主題
   - 長度：10-20字
   - 技巧：包含核心關鍵字、客觀描述
   - 例如：「Python基礎：變數與資料型態教學」

3. 專業標題 (professional)
   - 目標：展現專業性與權威性
   - 長度：12-30字
   - 技巧：使用專業術語、正式語氣
   - 例如：「機器學習模型優化技術深度解析」

請分析字幕內容的主題、核心概念和目標受眾，生成最合適的3種標題。

輸出格式（純JSON，不要markdown代碼塊）：
{
  "catchy": "吸睛標題內容",
  "informative": "資訊標題內容",
  "professional": "專業標題內容"
}`;

    const userPrompt = `請根據以下字幕內容生成3種風格的影片標題：

字幕內容：
${subtitleTexts}

請直接輸出JSON格式的標題，不要加其他文字或markdown格式。`;

    const requestBody = {
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      model: "grok-beta",
      stream: false,
      temperature: 0.7, // 適度創意
    };

    console.log('🚀 發送到 Grok API...');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Grok API 回應狀態:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Grok API 錯誤回應:', errorText);
      throw new Error(`Grok API 請求失敗: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Grok API 原始結果:', data);

    const generatedContent = data.choices?.[0]?.message?.content;
    if (!generatedContent) {
      throw new Error('Grok API 返回無效數據');
    }

    console.log('📄 生成的內容:', generatedContent);

    // 解析 JSON 結果（處理可能的 markdown 代碼塊）
    let titles;
    try {
      // 移除可能的 markdown 代碼塊標記
      const cleanedContent = generatedContent
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      titles = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('❌ JSON 解析失敗:', parseError);
      console.error('原始內容:', generatedContent);
      throw new Error('AI 返回格式錯誤，請重試');
    }

    // 驗證返回格式
    if (!titles.catchy || !titles.informative || !titles.professional) {
      console.error('❌ 缺少必要的標題類型:', titles);
      throw new Error('AI 返回的標題不完整');
    }

    console.log('✨ AI 標題生成完成:', titles);

    return NextResponse.json({
      success: true,
      titles: {
        catchy: titles.catchy,
        informative: titles.informative,
        professional: titles.professional,
      }
    });

  } catch (error) {
    console.error("❌ AI 標題生成錯誤:", error);
    return NextResponse.json(
      {
        success: false,
        error: "標題生成失敗: " + (error as Error).message
      },
      { status: 500 }
    );
  }
}
