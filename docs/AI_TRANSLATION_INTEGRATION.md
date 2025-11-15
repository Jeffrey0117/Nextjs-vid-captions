# AI 翻譯整合方案

## 專案概述

將 AI 驅動的翻譯服務（基於 Groq/Ollama）整合到現有翻譯系統中，為用戶提供 DeepL 之外的另一個翻譯選擇。

### 背景

- **現有系統**：已實現 DeepL 批量翻譯（`app/api/deepl-translate/route.ts`）
- **AI 基礎**：已有 Groq API 整合用於標題生成（`app/api/generate-title/route.ts`）
- **用戶需求**：希望增加 AI 翻譯選項，因為某些場景下效果更好
- **UI 預留**：TranslationSelectionModal 組件已預留 Grok 選項（目前禁用）

---

## 架構設計

### 1. 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                    前端翻譯選擇層                              │
│         TranslationSelectionModal Component                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   DeepL      │  │  Groq AI     │  │  Ollama      │      │
│  │   翻譯       │  │   翻譯       │  │  (本地)      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      API 路由層                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /api/deepl-  │  │ /api/ai-     │  │ /api/ai-     │      │
│  │  translate   │  │  translate   │  │  translate   │      │
│  │              │  │ (groq)       │  │ (ollama)     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    外部服務層                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DeepL API    │  │ Groq API     │  │ Ollama       │      │
│  │ (專業翻譯)   │  │ (雲端AI)     │  │ (本地AI)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2. API 選項對比

| 特性 | DeepL | Groq AI | Ollama (本地) |
|------|-------|---------|---------------|
| **性質** | 專業翻譯 API | 雲端 LLM | 本地 LLM |
| **模型** | DeepL 專用 | llama-3.3-70b-versatile | qwen2.5:3b |
| **速度** | 極快 (2-5s) | 快 (5-10s) | 較慢 (15-30s) |
| **準確度** | 極高 | 高 | 中等 |
| **批量限制** | 50 條/批次 | 無明確限制 | 受本地性能限制 |
| **成本** | 需 API Key | 需 API Key | 免費 |
| **網絡需求** | 需要 | 需要 | 不需要 |
| **特色** | 專業術語精準 | 上下文理解好 | 完全離線可用 |
| **適用場景** | 正式內容 | 口語化內容 | 無網絡環境 |

### 3. 統一 API 接口設計

#### 請求格式（統一）
```typescript
POST /api/ai-translate
{
  texts: string[],      // 批量翻譯文本數組
  targetLang?: string,  // 目標語言（默認: zh-Hant）
  provider?: string     // AI 提供商（groq | ollama）
}
```

#### 回應格式（統一）
```typescript
{
  success: boolean,
  translatedTexts: string[],
  originalTexts: string[],
  provider: string,
  metadata?: {
    model: string,
    tokensUsed?: number,
    duration: number
  }
}
```

---

## 實現步驟

### Phase 1: 核心 AI 翻譯 API (2-3 小時)

#### 步驟 1.1: 創建 AI 翻譯路由
**文件**: `app/api/ai-translate/route.ts`

```typescript
import { NextResponse } from "next/server";

// AI Provider 類型
type AIProvider = 'groq' | 'ollama';
type TargetLanguage = 'zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko';

interface TranslateRequest {
  texts: string[];
  targetLang?: TargetLanguage;
  provider?: AIProvider;
}

export async function POST(request: Request) {
  try {
    const { texts, targetLang = 'zh-Hant', provider } = await request.json() as TranslateRequest;

    console.log('🤖 收到 AI 翻譯請求:', {
      數量: texts.length,
      目標語言: targetLang,
      提供商: provider || process.env.AI_PROVIDER || 'groq'
    });

    // 驗證輸入
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "沒有提供要翻譯的文字" },
        { status: 400 }
      );
    }

    // 確定 AI Provider
    const selectedProvider = provider || (process.env.AI_PROVIDER as AIProvider) || 'groq';

    // 根據 Provider 選擇翻譯策略
    let translatedTexts: string[];
    let metadata: any;

    if (selectedProvider === 'groq') {
      const result = await translateWithGroq(texts, targetLang);
      translatedTexts = result.translatedTexts;
      metadata = result.metadata;
    } else {
      const result = await translateWithOllama(texts, targetLang);
      translatedTexts = result.translatedTexts;
      metadata = result.metadata;
    }

    return NextResponse.json({
      success: true,
      translatedTexts,
      originalTexts: texts,
      provider: selectedProvider,
      metadata
    });

  } catch (error) {
    console.error("❌ AI 翻譯錯誤:", error);
    return NextResponse.json(
      { error: "翻譯失敗: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// Groq 翻譯實現
async function translateWithGroq(texts: string[], targetLang: string) {
  const startTime = Date.now();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY 未設定');
  }

  // 構建翻譯提示詞
  const systemPrompt = buildTranslationPrompt(targetLang);
  const userPrompt = `請將以下文本翻譯成${getLanguageName(targetLang)}，保持原文的語氣和格式：

${texts.map((text, i) => `[${i}] ${text}`).join('\n')}

請返回 JSON 格式：{"translations": ["翻譯1", "翻譯2", ...]}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3, // 降低溫度以提高一致性
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API 請求失敗: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Groq API 返回無效數據');
  }

  // 解析 JSON 結果
  const cleanedContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const result = JSON.parse(cleanedContent);

  return {
    translatedTexts: result.translations,
    metadata: {
      model: 'llama-3.3-70b-versatile',
      duration: Date.now() - startTime,
      tokensUsed: data.usage?.total_tokens
    }
  };
}

// Ollama 翻譯實現
async function translateWithOllama(texts: string[], targetLang: string) {
  const startTime = Date.now();

  const systemPrompt = buildTranslationPrompt(targetLang);
  const userPrompt = `請將以下文本翻譯成${getLanguageName(targetLang)}：

${texts.map((text, i) => `[${i}] ${text}`).join('\n')}

返回格式：{"translations": ["翻譯1", "翻譯2", ...]}`;

  const response = await fetch('http://localhost:11434/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen2.5:3b',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API 請求失敗: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Ollama 返回無效數據');
  }

  const cleanedContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const result = JSON.parse(cleanedContent);

  return {
    translatedTexts: result.translations,
    metadata: {
      model: 'qwen2.5:3b',
      duration: Date.now() - startTime
    }
  };
}

// 構建翻譯系統提示詞
function buildTranslationPrompt(targetLang: string): string {
  return `你是專業的翻譯專家。請遵循以下規則：

1. 準確翻譯成${getLanguageName(targetLang)}
2. 保持原文的語氣和風格
3. 保留專有名詞（人名、地名、品牌）
4. 保持標點符號的適當使用
5. 對於字幕文本，使用自然口語化表達
6. 嚴格按照給定的序號順序返回翻譯結果
7. 返回純 JSON 格式，不要添加任何其他文字`;
}

// 獲取語言全名
function getLanguageName(langCode: string): string {
  const names: Record<string, string> = {
    'zh-Hant': '繁體中文',
    'zh-Hans': '簡體中文',
    'en': 'English',
    'ja': '日本語',
    'ko': '한국어'
  };
  return names[langCode] || '繁體中文';
}
```

#### 步驟 1.2: 添加環境變數配置
**文件**: `.env.local`（已存在，需要確保配置正確）

```bash
# AI Provider 配置
AI_PROVIDER=groq        # 可選: groq | ollama
GROQ_API_KEY=REDACTED_GROQ_KEY
```

### Phase 2: 前端整合 (1-2 小時)

#### 步驟 2.1: 更新翻譯選擇模態框
**文件**: `app/components/TranslationSelectionModal.tsx`

```typescript
'use client';

import { X, Zap, Brain, Laptop } from 'lucide-react';
import { useState } from 'react';

interface TranslationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeepL: () => void;
  onSelectAI: (provider: 'groq' | 'ollama') => void; // 修改為支援 provider 參數
}

export default function TranslationSelectionModal({
  isOpen,
  onClose,
  onSelectDeepL,
  onSelectAI
}: TranslationSelectionModalProps) {
  const [showAIOptions, setShowAIOptions] = useState(false);

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
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">選擇翻譯服務</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 翻譯選項 */}
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
              <div className="text-blue-200 text-sm">專業翻譯引擎，精準度極高</div>
            </div>
          </button>

          {/* AI 翻譯選項組 */}
          <div className="space-y-2">
            {/* Groq AI 選項 */}
            <button
              onClick={() => {
                onSelectAI('groq');
                onClose();
              }}
              className="w-full p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all duration-200 flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Brain size={18} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium">Groq AI 翻譯</div>
                <div className="text-purple-200 text-sm">雲端 AI，上下文理解佳</div>
              </div>
            </button>

            {/* Ollama 本地選項 */}
            <button
              onClick={() => {
                onSelectAI('ollama');
                onClose();
              }}
              className="w-full p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg transition-all duration-200 flex items-center gap-3"
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Laptop size={18} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium">Ollama 本地翻譯</div>
                <div className="text-green-200 text-sm">完全離線，保護隱私</div>
              </div>
            </button>
          </div>
        </div>

        {/* 說明文字 */}
        <div className="mt-4 text-xs text-gray-400 space-y-1">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-blue-400" />
            <span>DeepL: 最快最準，適合正式內容</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain size={12} className="text-purple-400" />
            <span>Groq: 理解上下文，適合口語化</span>
          </div>
          <div className="flex items-center gap-2">
            <Laptop size={12} className="text-green-400" />
            <span>Ollama: 無需網絡，完全免費</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 步驟 2.2: 更新批量編輯器
**文件**: `app/components/BulkSubtitleEditor.tsx`

修改以下部分：

```typescript
// 1. 更新翻譯函數調用
const translateWithAI = (provider: 'groq' | 'ollama') => {
  translateAllSubtitles('/api/ai-translate', `AI (${provider})`, provider);
};

// 2. 修改 translateAllSubtitles 函數簽名
const translateAllSubtitles = async (
  apiEndpoint: string,
  serviceName: string,
  provider?: string
) => {
  // ... 現有邏輯 ...

  const body: any = { texts: textsToTranslate };
  if (provider) {
    body.provider = provider;
  }

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // ... 其餘邏輯不變 ...
};

// 3. 更新 Modal 回調
<TranslationSelectionModal
  isOpen={showTranslationModal}
  onClose={() => setShowTranslationModal(false)}
  onSelectDeepL={translateWithDeepL}
  onSelectAI={translateWithAI}  // 新增
/>
```

#### 步驟 2.3: 更新專案頁面（如果需要）
**文件**: `app/editor/page.tsx`

確保翻譯調用處也支援新的 AI 翻譯選項（如果該頁面有直接翻譯調用）。

### Phase 3: 優化與測試 (1-2 小時)

#### 步驟 3.1: 批量處理優化

對於大量字幕（超過 50 條），AI 翻譯可能需要分批處理：

```typescript
// app/api/ai-translate/route.ts
const BATCH_SIZE = 30; // AI 翻譯建議每批 30 條（降低 token 使用）

async function translateWithGroqBatched(texts: string[], targetLang: string) {
  const allTranslations: string[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    console.log(`🔄 處理第 ${batchNumber}/${totalBatches} 批 (${batch.length} 條)`);

    const result = await translateWithGroq(batch, targetLang);
    allTranslations.push(...result.translatedTexts);

    console.log(`✅ 第 ${batchNumber}/${totalBatches} 批完成`);
  }

  return {
    translatedTexts: allTranslations,
    metadata: {
      model: 'llama-3.3-70b-versatile',
      batches: Math.ceil(texts.length / BATCH_SIZE)
    }
  };
}
```

#### 步驟 3.2: 錯誤處理與重試機制

```typescript
async function translateWithRetry(
  translateFn: () => Promise<any>,
  maxRetries: number = 3
) {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await translateFn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`翻譯失敗 (嘗試 ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        // 指數退避
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError!;
}
```

#### 步驟 3.3: 進度追蹤優化

為 AI 翻譯添加更詳細的進度反饋：

```typescript
// BulkSubtitleEditor.tsx
const [translationStatus, setTranslationStatus] = useState<string>('');

// 在翻譯過程中更新狀態
setTranslationStatus(`正在處理第 ${currentBatch}/${totalBatches} 批...`);
```

---

## 代碼示例：完整調用流程

### 前端調用示例

```typescript
// 用戶點擊 "Groq AI 翻譯"
const handleGroqTranslation = async () => {
  setIsTranslating(true);

  try {
    const response = await fetch('/api/ai-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: ['Hello', 'How are you?', 'Goodbye'],
        targetLang: 'zh-Hant',
        provider: 'groq'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('翻譯結果:', data.translatedTexts);
      console.log('元數據:', data.metadata);
      // 更新字幕...
    }
  } catch (error) {
    console.error('翻譯失敗:', error);
  } finally {
    setIsTranslating(false);
  }
};
```

### 後端返回示例

```json
{
  "success": true,
  "translatedTexts": [
    "你好",
    "你好嗎？",
    "再見"
  ],
  "originalTexts": [
    "Hello",
    "How are you?",
    "Goodbye"
  ],
  "provider": "groq",
  "metadata": {
    "model": "llama-3.3-70b-versatile",
    "duration": 3245,
    "tokensUsed": 156
  }
}
```

---

## 測試計劃

### 單元測試

1. **API 端點測試**
   - 測試單條翻譯
   - 測試批量翻譯（10, 30, 50 條）
   - 測試錯誤處理（無 API Key、網絡錯誤）

2. **Provider 切換測試**
   - Groq 翻譯
   - Ollama 翻譯
   - 自動 fallback

### 整合測試

1. **前端整合**
   - 翻譯選擇模態框正確顯示
   - 各翻譯選項正確調用對應 API
   - 進度顯示正確更新

2. **性能測試**
   - 100 條字幕翻譯時間
   - 網絡請求次數
   - 內存使用情況

### 用戶驗收測試

1. 選擇 DeepL 翻譯，驗證結果準確
2. 選擇 Groq AI 翻譯，驗證結果自然
3. 選擇 Ollama 翻譯（本地），驗證離線可用
4. 切換不同翻譯服務，驗證結果可覆蓋

---

## 部署檢查清單

### 環境變數
- [ ] `AI_PROVIDER` 設定（groq/ollama）
- [ ] `GROQ_API_KEY` 配置（如果使用 Groq）
- [ ] Ollama 服務運行（如果使用本地）

### 依賴檢查
- [ ] `package.json` 無需新增依賴（使用原生 fetch）
- [ ] TypeScript 類型定義完整

### 文件清單
- [ ] `app/api/ai-translate/route.ts` (新增)
- [ ] `app/components/TranslationSelectionModal.tsx` (修改)
- [ ] `app/components/BulkSubtitleEditor.tsx` (修改)
- [ ] `app/editor/page.tsx` (可選修改)

---

## 性能預期

### 翻譯速度對比（50 條字幕）

| 服務 | 預期時間 | 網絡請求 | Token 消耗 |
|------|---------|----------|-----------|
| **DeepL** | 2-5 秒 | 1-2 次 | N/A |
| **Groq AI** | 5-10 秒 | 1-2 次 | ~2000 tokens |
| **Ollama** | 15-30 秒 | 1-2 次 | N/A (本地) |

### 成本估算（基於 Groq 定價）

- Groq API: 約 $0.10-0.20 / 百萬 tokens
- 50 條字幕 ≈ 2000 tokens ≈ $0.0002
- 非常經濟實惠

---

## 進階功能（未來擴展）

### 1. 翻譯質量評分
添加 AI 評估翻譯質量的功能

### 2. 混合翻譯策略
關鍵內容用 DeepL，口語內容用 AI

### 3. 自定義翻譯風格
允許用戶選擇翻譯風格（正式/口語/專業術語）

### 4. 翻譯記憶庫
緩存常見翻譯，提升速度

### 5. 多語言支持
擴展到更多目標語言

---

## 常見問題 FAQ

### Q1: 為什麼要添加 AI 翻譯？
**A**: DeepL 雖然準確，但在某些口語化場景和上下文理解上，AI 翻譯可能更自然。提供選擇讓用戶根據需求選擇。

### Q2: Groq 和 Ollama 該選哪個？
**A**:
- **Groq**: 速度快、質量高，需要網絡和 API Key
- **Ollama**: 完全免費、離線可用，但速度較慢

### Q3: AI 翻譯會替代 DeepL 嗎？
**A**: 不會。DeepL 在專業翻譯場景仍然是首選，AI 翻譯作為補充選項。

### Q4: 如何處理翻譯失敗？
**A**: 系統會自動重試 3 次，如果仍失敗會顯示錯誤信息，用戶可以選擇其他翻譯服務。

### Q5: 翻譯質量如何保證？
**A**: 使用 temperature=0.3 降低隨機性，使用詳細的系統提示詞指導翻譯質量，並在測試階段對比多個樣本。

---

## 技術債務與注意事項

1. **API Key 安全**: 確保 `.env.local` 不會提交到 Git
2. **速率限制**: Groq API 有速率限制，需要適當的錯誤處理
3. **成本監控**: 建議添加翻譯次數統計，避免意外高額費用
4. **本地 Ollama**: 需要確保用戶已安裝並運行 Ollama 服務
5. **兼容性**: 保持與現有 DeepL 翻譯的接口一致性

---

## 參考資源

- [Groq API 文檔](https://console.groq.com/docs)
- [Ollama API 文檔](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [現有 generate-title API](../app/api/generate-title/route.ts)
- [現有 DeepL 翻譯實現](../app/api/deepl-translate/route.ts)

---

## 版本歷史

- **v1.0** (2025-11-14): 初始方案設計
  - 完整架構設計
  - API 實現代碼
  - 前端整合方案
  - 測試計劃
