# AI 翻譯整合 - 需要修改的文件清單

## 文件修改總覽

本次 AI 翻譯整合需要創建 1 個新文件，修改 2 個現有文件。

---

## 新增文件 (1 個)

### 1. app/api/ai-translate/route.ts
**狀態**: 🆕 新建
**類型**: API 路由
**行數**: ~200 行
**描述**: AI 翻譯 API 端點，支持 Groq 和 Ollama

**主要功能**:
- 接收批量翻譯請求
- 支持多種 AI Provider（groq/ollama）
- 統一的請求/回應格式
- 錯誤處理和日誌記錄

**關鍵代碼結構**:
```typescript
export async function POST(request: Request) { ... }
async function translateWithGroq(texts: string[], targetLang: string) { ... }
async function translateWithOllama(texts: string[], targetLang: string) { ... }
function buildTranslationPrompt(targetLang: string): string { ... }
```

**依賴**:
- Next.js Request/Response
- Groq API (https://api.groq.com/openai/v1/chat/completions)
- Ollama API (http://localhost:11434/v1/chat/completions)

---

## 修改文件 (2 個)

### 2. app/components/TranslationSelectionModal.tsx
**狀態**: ✏️ 修改
**當前行數**: 81 行
**預計新增**: +30 行
**描述**: 翻譯服務選擇模態框

#### 修改內容：

**A. Props 介面更新**
```typescript
// 修改前
interface TranslationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeepL: () => void;
  onSelectGrok: () => void;  // 舊名稱
}

// 修改後
interface TranslationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeepL: () => void;
  onSelectAI: () => void;  // 新名稱，更通用
}
```

**B. 啟用 AI 翻譯按鈕**
```typescript
// 修改前（第 60-71 行）
<button
  disabled  // 移除這行
  className="... opacity-50 cursor-not-allowed"  // 修改樣式
>
  <div className="text-white font-medium">Grok 翻譯 (暫時不可用)</div>
  <div className="text-gray-300 text-sm">需要 API 額度，暫時禁用</div>
</button>

// 修改後
<button
  onClick={() => {
    onSelectAI();
    onClose();
  }}
  className="... from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
>
  <div className="text-white font-medium">Groq AI 翻譯</div>
  <div className="text-purple-200 text-sm">雲端 AI，理解上下文佳</div>
</button>
```

**C. 更新 Icons**
確保已導入：
```typescript
import { X, Zap, Brain } from 'lucide-react';
```

#### 具體修改位置：
- **第 9 行**: 修改 Props 參數名 `onSelectGrok` → `onSelectAI`
- **第 12-17 行**: 更新函數參數
- **第 60-71 行**: 啟用按鈕並更新樣式/文字

---

### 3. app/components/BulkSubtitleEditor.tsx
**狀態**: ✏️ 修改
**當前行數**: ~650 行
**預計新增**: +10 行
**描述**: 批量字幕編輯器

#### 修改內容：

**A. 添加 AI 翻譯函數**
```typescript
// 在第 338 行（translateWithGrok 後面）添加
const translateWithAI = () => {
  translateAllSubtitles('/api/ai-translate', 'AI');
};
```

**B. 更新 Modal 調用**
```typescript
// 修改前（約第 590 行）
<TranslationSelectionModal
  isOpen={showTranslationModal}
  onClose={() => setShowTranslationModal(false)}
  onSelectDeepL={translateWithDeepL}
  onSelectGrok={translateWithGrok}  // 移除這行
/>

// 修改後
<TranslationSelectionModal
  isOpen={showTranslationModal}
  onClose={() => setShowTranslationModal(false)}
  onSelectDeepL={translateWithDeepL}
  onSelectAI={translateWithAI}  // 添加這行
/>
```

**C. (可選) 刪除舊的 translateWithGrok**
```typescript
// 可以移除第 337-339 行
const translateWithGrok = () => {
  translateAllSubtitles('/api/grok-translate', 'Grok');
};
```

#### 具體修改位置：
- **第 338 行**: 添加 `translateWithAI` 函數
- **第 337-339 行**: (可選) 刪除 `translateWithGrok`
- **約第 590 行**: 更新 `<TranslationSelectionModal>` 的 props

---

## 環境變數文件

### 4. .env.local
**狀態**: ✏️ 確認
**描述**: 環境變數配置

**檢查項目**:
```bash
# 確認以下變數存在
GROQ_API_KEY=REDACTED_GROQ_KEY
AI_PROVIDER=groq

# 如果使用 Ollama，可選
# AI_PROVIDER=ollama
```

**注意**: 該文件已存在，只需確認配置正確。

---

## 修改優先級

### 必須修改（MVP）
1. ✅ **app/api/ai-translate/route.ts** (新建)
2. ✅ **app/components/TranslationSelectionModal.tsx** (修改)
3. ✅ **app/components/BulkSubtitleEditor.tsx** (修改)

### 可選修改（增強）
4. ⭕ **app/editor/page.tsx** (如果該頁面有獨立的翻譯調用)
5. ⭕ **app/editor-pro/page.tsx** (如果存在專業版編輯器)

---

## 修改工作量估算

| 文件 | 類型 | 行數變化 | 預計時間 | 難度 |
|------|------|---------|---------|------|
| app/api/ai-translate/route.ts | 新建 | +200 | 15 分鐘 | 中等 |
| TranslationSelectionModal.tsx | 修改 | +30 | 5 分鐘 | 簡單 |
| BulkSubtitleEditor.tsx | 修改 | +10 | 5 分鐘 | 簡單 |
| .env.local | 確認 | 0 | 1 分鐘 | 簡單 |
| **總計** | - | **+240** | **26 分鐘** | - |

---

## 修改前檢查清單

在開始修改前，請確認：

- [ ] 已備份現有代碼（或使用 Git）
- [ ] 已閱讀完整技術方案文檔
- [ ] 已確認 GROQ_API_KEY 可用
- [ ] 開發環境正常運行
- [ ] 已理解現有翻譯邏輯

---

## 修改後測試清單

修改完成後，請執行：

- [ ] TypeScript 編譯檢查：`npx tsc --noEmit`
- [ ] ESLint 檢查：`npm run lint`
- [ ] 啟動開發服務器：`npm run dev`
- [ ] 測試 DeepL 翻譯（確保未破壞現有功能）
- [ ] 測試 AI 翻譯（新功能）
- [ ] 檢查瀏覽器控制台錯誤
- [ ] 檢查後端日誌輸出

---

## Git 提交建議

### 分階段提交

**Commit 1: 添加 AI 翻譯 API**
```bash
git add app/api/ai-translate/
git commit -m "feat: add AI translation API with Groq/Ollama support

- Create new API route at /api/ai-translate
- Support Groq (cloud) and Ollama (local) providers
- Implement batch translation with retry logic
- Add comprehensive error handling and logging"
```

**Commit 2: 整合 AI 翻譯到 UI**
```bash
git add app/components/TranslationSelectionModal.tsx app/components/BulkSubtitleEditor.tsx
git commit -m "feat: integrate AI translation into subtitle editor

- Enable AI translation option in selection modal
- Update BulkSubtitleEditor to call AI translate API
- Maintain backward compatibility with DeepL"
```

**Commit 3: 添加文檔**
```bash
git add docs/AI_TRANSLATION_*.md
git commit -m "docs: add AI translation integration documentation

- Add comprehensive technical design doc
- Add quick start guide for developers
- Add implementation checklist
- Add file modification summary"
```

---

## 回滾計劃

如果需要回滾修改：

```bash
# 回滾到上一次提交
git reset --hard HEAD~1

# 或者回滾特定文件
git checkout HEAD -- app/components/TranslationSelectionModal.tsx
git checkout HEAD -- app/components/BulkSubtitleEditor.tsx

# 刪除新建的 API 文件
rm app/api/ai-translate/route.ts
```

---

## 相關文件（不需要修改）

這些文件與翻譯相關，但本次不需要修改：

- ✅ `app/api/deepl-translate/route.ts` - DeepL 翻譯（保持不變）
- ✅ `app/api/generate-title/route.ts` - AI 標題生成（參考代碼）
- ✅ `app/stores/subtitle-store.ts` - 字幕狀態管理（已支持翻譯）
- ✅ `app/components/SubtitlePropertiesPanel.tsx` - 屬性面板（不涉及）

---

## 快速修改指令（複製即用）

### Step 1: 創建 API 文件
```bash
# Windows
mkdir app\api\ai-translate
type nul > app\api\ai-translate\route.ts

# Linux/Mac
mkdir -p app/api/ai-translate
touch app/api/ai-translate/route.ts
```

### Step 2: 打開文件進行編輯
```bash
# 使用 VS Code
code app/api/ai-translate/route.ts
code app/components/TranslationSelectionModal.tsx
code app/components/BulkSubtitleEditor.tsx
```

### Step 3: 測試 API
```bash
# 啟動開發服務器
npm run dev

# 在另一個終端測試 API
curl -X POST http://localhost:3005/api/ai-translate \
  -H "Content-Type: application/json" \
  -d "{\"texts\": [\"Hello\", \"World\"]}"
```

---

## 聯繫與支持

如果在修改過程中遇到問題：

1. 查看完整技術方案：`docs/AI_TRANSLATION_INTEGRATION.md`
2. 查看快速開始指南：`docs/AI_TRANSLATION_QUICK_START.md`
3. 查看實現檢查清單：`docs/AI_TRANSLATION_CHECKLIST.md`
4. 檢查瀏覽器/服務器控制台的錯誤信息
5. 驗證環境變數配置是否正確
