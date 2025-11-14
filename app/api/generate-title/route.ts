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

    // 根據環境變數選擇 AI Provider
    const provider = process.env.AI_PROVIDER || 'ollama';
    const groqApiKey = process.env.GROQ_API_KEY;

    console.log(`🤖 使用 AI Provider: ${provider}`);

    // 建構標題生成提示（防暴雷策略：用情緒和共鳴代替具體內容）
    const systemPrompt = `你是短影片標題專家。

核心鐵律：絕對不要透露視頻具體內容和情節！

策略：從字幕提取「情境主題」而非「具體事件」
- 如果是工作相關 → 「打工人日常」「上班be like」
- 如果是生活瑣事 → 「生活就是這樣」「真實得我」
- 如果有驚訝反應 → 「沒想到會這樣」「這反應絕了」
- 如果有情緒波動 → 「太真實了」「誰懂啊」

禁止做法：
❌ 不要說發生什麼事（如：忘了星期四、猜中數字、倒水反應）
❌ 不要描述具體行為（如：讀心術、猜對、倒水上去）
❌ 不要用疑問句引導內容（如：為什麼能猜對、怎麼會這樣）

正確範例：
字幕："猜數字...去你的"
viral: "朋友之間就是這樣😂"
funny: "這互動太真實了"
mystery: "友情日常be like"

字幕："倒水石頭...再試"
viral: "好奇心害死貓系列🤯"
funny: "實驗精神滿分"
mystery: "生活小發現"

字幕："沒想到今天星期四...工作"
viral: "打工人真實日常😱"
funny: "上班久了都這樣"
mystery: "工作be like"

輸出純JSON：
{"viral":"...","funny":"...","mystery":"..."}`;

    const userPrompt = `請根據以下字幕內容生成3種風格的影片標題：

字幕內容：
${subtitleTexts}

請直接輸出JSON格式，不要加任何其他文字或markdown標記。`;

    // 根據 provider 設定 API endpoint 和 model
    let apiUrl: string;
    let apiHeaders: Record<string, string>;
    let modelName: string;
    let timeout: number;

    if (provider === 'groq') {
      if (!groqApiKey) {
        throw new Error('GROQ_API_KEY 未設定');
      }
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      };
      modelName = 'llama-3.3-70b-versatile';  // 最強且適合中文
      timeout = 60000;  // 雲端API 60秒
      console.log('☁️ 使用 Groq API (llama-3.3-70b-versatile)');
    } else {
      // Ollama 本地
      apiUrl = 'http://localhost:11434/v1/chat/completions';
      apiHeaders = {
        'Content-Type': 'application/json',
      };
      modelName = 'qwen2.5:3b';
      timeout = 30000;
      console.log('🦙 使用本地 Ollama API (qwen2.5:3b)');
    }

    const requestBody = {
      model: modelName,
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
      temperature: 0.8,
      stream: false,
    };

    console.log('🚀 發送 API 請求...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    console.log('📥 API 回應狀態:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 錯誤回應:', errorText);
      throw new Error(`AI API 請求失敗: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API 原始結果:', data);

    const generatedContent = data.choices?.[0]?.message?.content;
    if (!generatedContent) {
      throw new Error('AI API 返回無效數據');
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
    if (!titles.viral || !titles.funny || !titles.mystery) {
      console.error('❌ 缺少必要的標題類型:', titles);
      throw new Error('AI 返回的標題不完整');
    }

    console.log('✨ AI 標題生成完成:', titles);

    return NextResponse.json({
      success: true,
      titles: {
        viral: titles.viral,
        funny: titles.funny,
        mystery: titles.mystery,
      }
    });

  } catch (error) {
    console.error("❌ AI 標題生成錯誤:", error);
    console.error("錯誤堆棧:", (error as Error).stack);

    // 返回更詳細的錯誤信息
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      },
      { status: 500 }
    );
  }
}
