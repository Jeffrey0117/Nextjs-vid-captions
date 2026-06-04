# AI 翻譯整合 - 快速開始指南

## 30 分鐘快速實現

這份指南幫助你在 30 分鐘內完成基本的 AI 翻譯整合。

---

## 步驟 1: 創建 API 路由 (10 分鐘)

創建文件：`app/api/ai-translate/route.ts`

```typescript
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { texts, provider = 'groq' } = await request.json();

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: "無效的文字" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 GROQ_API_KEY" }, { status: 500 });
    }

    // 構建翻譯提示
    const prompt = `請將以下文本翻譯成繁體中文，保持語氣和格式：

${texts.map((text, i) => `[${i}] ${text}`).join('\n')}

返回 JSON 格式：{"translations": ["翻譯1", "翻譯2", ...]}`;

    // 調用 Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: "system",
            content: "你是專業翻譯專家。請準確翻譯並返回純 JSON 格式。"
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('API 返回無效數據');
    }

    // 解析 JSON
    const cleanContent = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanContent);

    return NextResponse.json({
      success: true,
      translatedTexts: result.translations,
      originalTexts: texts
    });

  } catch (error) {
    console.error("AI 翻譯錯誤:", error);
    return NextResponse.json(
      { error: "翻譯失敗: " + (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

## 步驟 2: 更新翻譯選擇模態框 (10 分鐘)

修改文件：`app/components/TranslationSelectionModal.tsx`

### 2.1 更新介面定義

```typescript
interface TranslationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeepL: () => void;
  onSelectAI: () => void;  // 新增這一行
}
```

### 2.2 更新組件

```typescript
export default function TranslationSelectionModal({
  isOpen,
  onClose,
  onSelectDeepL,
  onSelectAI  // 新增這一行
}: TranslationSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">選擇翻譯服務</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {/* DeepL 選項 */}
          <button
            onClick={() => {
              onSelectDeepL();
              onClose();
            }}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium">DeepL 翻譯</div>
              <div className="text-blue-200 text-sm">專業翻譯引擎，精準度高</div>
            </div>
          </button>

          {/* AI 翻譯選項 - 啟用並更新 */}
          <button
            onClick={() => {
              onSelectAI();  // 改這裡
              onClose();
            }}
            className="w-full p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all duration-200 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Brain size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium">Groq AI 翻譯</div>
              <div className="text-purple-200 text-sm">雲端 AI，理解上下文佳</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2.3 添加必要的 import

```typescript
import { X, Zap, Brain } from 'lucide-react';
```

---

## 步驟 3: 更新批量編輯器 (10 分鐘)

修改文件：`app/components/BulkSubtitleEditor.tsx`

### 3.1 添加 AI 翻譯函數

在 `translateWithDeepL` 函數後面添加：

```typescript
// AI 翻譯
const translateWithAI = () => {
  translateAllSubtitles('/api/ai-translate', 'AI');
};
```

### 3.2 更新 Modal 調用

找到 `<TranslationSelectionModal` 組件，修改為：

```typescript
<TranslationSelectionModal
  isOpen={showTranslationModal}
  onClose={() => setShowTranslationModal(false)}
  onSelectDeepL={translateWithDeepL}
  onSelectAI={translateWithAI}  // 添加這一行
/>
```

---

## 步驟 4: 測試 (5 分鐘)

### 4.1 啟動開發服務器

```bash
npm run dev
```

### 4.2 測試流程

1. 打開編輯器頁面
2. 上傳帶字幕的影片
3. 點擊翻譯按鈕（Languages 圖標）
4. 選擇 "Groq AI 翻譯"
5. 等待翻譯完成
6. 驗證翻譯結果

### 4.3 測試 API（可選）

使用 curl 測試：

```bash
curl -X POST http://localhost:3005/api/ai-translate \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Hello", "How are you?"]}'
```

預期返回：

```json
{
  "success": true,
  "translatedTexts": ["你好", "你好嗎？"],
  "originalTexts": ["Hello", "How are you?"]
}
```

---

## 驗證清單

- [ ] API 路由創建成功 (`app/api/ai-translate/route.ts`)
- [ ] 環境變數配置正確 (`GROQ_API_KEY` 在 `.env.local`)
- [ ] TranslationSelectionModal 顯示 AI 翻譯選項
- [ ] 點擊 AI 翻譯可以正常調用
- [ ] 翻譯結果正確顯示
- [ ] 翻譯進度正確更新

---

## 常見問題排查

### 問題 1: "未配置 GROQ_API_KEY"

**解決方案**：
1. 確認 `.env.local` 文件存在
2. 確認包含 `GROQ_API_KEY=your_key_here`
3. 重啟開發服務器

### 問題 2: "API 返回無效數據"

**解決方案**：
1. 檢查 Groq API Key 是否有效
2. 檢查網絡連接
3. 查看瀏覽器控制台的詳細錯誤

### 問題 3: 翻譯結果不準確

**解決方案**：
1. 調整 `temperature` 參數（降低以提高一致性）
2. 優化系統提示詞
3. 使用更大的模型（如果可用）

### 問題 4: 翻譯速度慢

**解決方案**：
1. 實現批量處理（詳見完整方案文檔）
2. 考慮使用 DeepL（速度更快）
3. 減少每批處理的字幕數量

---

## 下一步優化

完成基本實現後，可以參考完整方案文檔進行以下優化：

1. **添加 Ollama 本地支持**
   - 完全離線翻譯
   - 無 API 費用

2. **批量處理優化**
   - 大量字幕自動分批
   - 提升處理速度

3. **錯誤處理增強**
   - 自動重試機制
   - 降級策略

4. **進度追蹤優化**
   - 實時進度更新
   - 預估剩餘時間

5. **翻譯質量提升**
   - 更詳細的提示詞
   - 上下文保持
   - 術語一致性

---

## 相關文檔

- [完整技術方案](./AI_TRANSLATION_INTEGRATION.md)
- [現有 DeepL 實現](../app/api/deepl-translate/route.ts)
- [現有 AI 標題生成](../app/api/generate-title/route.ts)

---

## 技術支持

如果遇到問題，請查看：
1. 瀏覽器控制台錯誤信息
2. 後端服務器日誌
3. Groq API 狀態頁面
