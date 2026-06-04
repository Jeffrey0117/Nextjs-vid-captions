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

    // 建構標題生成提示（切題但不劇透策略）
    const systemPrompt = `你是短影片標題專家，專精於創造引人點擊的標題。

## 核心策略：深度分析關鍵詞 + 製造反轉感

**分析步驟：**
1. 找出字幕中最**特殊/有趣**的詞或概念（如「毀了我」「舌頭顏色」「星期四」）
2. 分析這個詞的**反轉或意外之處**（如：字面意思 vs 真實意思的落差）
3. 用這個反轉點創造懸念標題

**標題公式：**
1. **viral（病毒式）**：聚焦核心關鍵詞 + 反轉，用「沒想到」「原來」呼應意外
2. **funny（搞笑）**：重現關鍵詞的荒謬感，用反問或反差強化笑點
3. **mystery（懸念式）**：圍繞關鍵概念提問，讓人想點開看答案

**禁忌：**
❌ 不用萬用標題：「太真實了」「生活就是這樣」「這互動絕了」「誰懂啊」
❌ 不要忽略關鍵詞：標題中必須呼應字幕中的特殊概念
❌ 不要劇透結局：暗示即可

**正確範例：**

字幕：「我要你毀了我 / 好喔」
關鍵詞：「毀了我」（字面很嚴重，但語氣輕鬆，有反差）
✅ 切題:
- viral: "沒想到是這個意思😱"
- funny: "是你說要毀了你的🤣"
- mystery: "這句話另有含義？"

字幕：「忘了今天星期四 / 該死 / 我的手機」
關鍵詞：「忘了星期四」（上班族的噩夢）
✅ 切題:
- viral: "連星期幾都忘了😂"
- funny: "上班上到失憶"
- mystery: "忘記星期四的代價"

字幕：「你的舌頭什麼顏色 / 紅色 / 讓我看看」
關鍵詞：「舌頭顏色」（奇怪的問題，明顯有陷阱）
✅ 切題:
- viral: "沒想到這樣也能被騙😱"
- funny: "誰會去看自己的舌頭啊🤣"
- mystery: "這個問題有什麼陷阱？"

字幕：「我需要女孩 / 然後我得到了 / 這就是為什麼我不想要」
關鍵詞：「需要 → 得到 → 不想要」（情感反轉）
✅ 切題:
- viral: "沒想到是這種感覺😂"
- funny: "這反轉太快了"
- mystery: "為什麼得到了又不要？"

**生成標題時，請先在心中完成：**
1. 字幕關鍵詞是？
2. 反轉/意外點在哪？
3. 如何用這個反轉點創造懸念？

輸出純JSON，不要任何其他文字：
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
