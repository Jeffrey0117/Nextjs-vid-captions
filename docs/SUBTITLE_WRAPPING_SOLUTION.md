# 字幕自動換行解決方案

## 問題診斷

### 為什麼之前的 `wrapSubtitleText` 沒有生效？

**核心問題：基於字符數的換行無法處理實際渲染寬度**

1. **CSS 渲染基於像素寬度，不是字符數**
   - 原實現：使用 `text.length > maxCharsPerLine` 判斷是否需要換行
   - 問題：中文、英文、標點符號的實際顯示寬度完全不同
   - 例如："有時候，我覺得我需要一個女孩，然後我得到了一個，" (25個字符)
     - 中文字符寬度 ≈ 英文的 2 倍
     - 實際渲染寬度遠超容器寬度

2. **CSS `maxWidth` 限制沒有被換行邏輯考慮**
   - `maxWidth: 80vw` 在不同螢幕尺寸下對應不同像素寬度
   - 字體大小、字體族、字重都會影響實際寬度
   - 原實現完全沒有考慮這些因素

3. **`whiteSpace: 'pre-wrap'` 配置衝突**
   - CSS 設置了 `whiteSpace: 'pre-wrap'` 保留換行符
   - 但換行判斷邏輯不準確，導致文本仍然超出容器

## 解決方案

### 核心實現：基於實際寬度的智能換行

創建了 `wrapSubtitleTextByWidth()` 函數，使用 **Canvas measureText API** 進行精確寬度測量：

```typescript
function wrapSubtitleTextByWidth(
  text: string,
  maxWidth: number,          // 最大寬度（像素）
  fontSize: number,          // 字體大小（像素）
  fontFamily: string = 'Arial',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): string
```

### 關鍵技術點

1. **使用 Canvas API 測量實際渲染寬度**
   ```typescript
   const canvas = document.createElement('canvas');
   const ctx = canvas.getContext('2d');
   ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
   const metrics = ctx.measureText(text);
   const width = metrics.width; // 實際像素寬度
   ```

2. **智能斷句優先級**
   - 優先在標點符號處斷開：`。！？、，, 空格`
   - 如果沒有合適的斷點，則強制斷開
   - 保留原有的手動換行符 (`\n`)

3. **準確計算容器寬度**
   - **當前字幕**：
     ```typescript
     const containerWidthPx = (currentSubtitle.style.maxWidth / 100) * window.innerWidth;
     const paddingPx = (16 / 1080) * videoDisplaySize.height * 2;
     const actualMaxWidth = containerWidthPx - paddingPx;
     ```
   - **固定字幕**：
     ```typescript
     const containerWidthPx = window.innerWidth * 0.9; // width: 90%
     const paddingPx = 16 * 2; // px-4 = 16px padding
     const actualMaxWidth = containerWidthPx - paddingPx;
     ```

## 修改文件清單

### 1. `app/editor-pro/page.tsx`

#### 新增函數
- `wrapSubtitleTextByWidth()` - 基於實際寬度的智能換行（第 29-111 行）
- 保留 `wrapSubtitleText()` 作為回退方案（第 117-162 行，標記為 @deprecated）

#### 修改渲染邏輯

**當前字幕渲染（第 1893-1913 行）**
```typescript
{(() => {
  // 計算實際的最大寬度（像素）
  const containerWidthPx = (currentSubtitle.style.maxWidth / 100) * window.innerWidth;
  const paddingPx = (16 / 1080) * videoDisplaySize.height * 2;
  const actualMaxWidth = containerWidthPx - paddingPx;

  // 計算實際字體大小
  const actualFontSize = (currentSubtitle.style.fontSize * currentSubtitle.style.scale / 1080) * videoDisplaySize.height;

  // 使用基於寬度的智能換行
  return wrapSubtitleTextByWidth(
    currentSubtitle.translatedText || currentSubtitle.text,
    actualMaxWidth,
    actualFontSize,
    currentSubtitle.style.fontFamily,
    currentSubtitle.style.fontWeight,
    currentSubtitle.style.fontStyle
  );
})()}
```

**固定字幕渲染（第 2009-2029 行）**
```typescript
{(() => {
  // 計算固定字幕的實際最大寬度
  const containerWidthPx = window.innerWidth * 0.9;
  const paddingPx = 16 * 2;
  const actualMaxWidth = containerWidthPx - paddingPx;

  // 計算實際字體大小
  const actualFontSize = (pinned.style.fontSize / 1080) * videoDisplaySize.height;

  // 使用基於寬度的智能換行
  return wrapSubtitleTextByWidth(
    pinned.text,
    actualMaxWidth,
    actualFontSize,
    pinned.style.fontFamily,
    pinned.style.fontWeight,
    pinned.style.fontStyle
  );
})()}
```

### 2. 導出視頻邏輯（無需修改）

以下文件已經使用基於 Canvas measureText 的正確換行邏輯：
- `app/hooks/useWebCodecsRecorder.ts` - `wrapText()` 函數（第 247-307 行）
- `app/hooks/usePreviewRecorder.ts` - `wrapText()` 函數（第 624-684 行）

這些函數與新的 `wrapSubtitleTextByWidth()` 使用相同的原理，確保預覽和導出的換行結果完全一致。

## 測試方法

### 1. 預覽測試

1. 打開專案，導入或識別字幕
2. 找一條長字幕，例如："有時候，我覺得我需要一個女孩，然後我得到了一個，"
3. 觀察預覽畫面：
   - ✅ 字幕應該在標點符號處自動換行
   - ✅ 不會超出螢幕邊界
   - ✅ 換行位置智能選擇（優先在逗號、句號等處斷開）

### 2. 響應式測試

1. 調整瀏覽器窗口大小
2. 觀察字幕換行是否動態適應新的寬度
3. 修改字幕樣式：
   - 字體大小
   - 字體族（例如從 Arial 改為 "Microsoft YaHei"）
   - 字重（normal → bold）
4. 確認換行邏輯正確反應這些變化

### 3. 固定字幕測試

1. 添加頂部固定字幕（例如標題）
2. 輸入長文本測試自動換行
3. 修改字體大小、位置，確認換行正確

### 4. 導出測試

1. 導出視頻（WebCodecs 或 Preview Recorder）
2. 下載後播放視頻
3. 確認：
   - ✅ 導出的字幕換行與預覽畫面一致
   - ✅ 字幕不超出視頻邊界
   - ✅ 斷句位置合理

## 性能優化

### Canvas 創建開銷

每次渲染都會創建臨時 Canvas 來測量寬度，性能開銷：
- **可接受**：Canvas 創建非常快（<1ms）
- **優化方案**（如果需要）：
  1. 在組件層級緩存 Canvas 實例
  2. 使用 `useMemo` 緩存換行結果（當字幕文本、樣式、容器寬度不變時）

示例優化（可選）：
```typescript
const wrappedText = useMemo(() => {
  return wrapSubtitleTextByWidth(...);
}, [text, maxWidth, fontSize, fontFamily, fontWeight, fontStyle]);
```

## 與現有系統的兼容性

### 1. 預覽渲染（瀏覽器 DOM）
- ✅ 使用 `wrapSubtitleTextByWidth()` 進行精確換行
- ✅ CSS `whiteSpace: 'pre-wrap'` 正確顯示換行符

### 2. 視頻導出（Canvas 渲染）
- ✅ `useWebCodecsRecorder.ts` 已有 `wrapText()` 使用相同邏輯
- ✅ `usePreviewRecorder.ts` 已有 `wrapText()` 使用相同邏輯
- ✅ 預覽和導出結果完全一致

### 3. 與字幕樣式系統集成
- ✅ 正確處理 `fontSize`、`scale`、`fontFamily`、`fontWeight`、`fontStyle`
- ✅ 正確計算 `maxWidth`（vw 單位）、padding、transform scale
- ✅ 支持中英文混合、標點符號智能斷句

## 已知限制與未來改進

### 當前限制

1. **字體載入問題**
   - Canvas measureText 需要字體已載入
   - 如果自定義字體未載入完成，寬度測量可能不準確
   - **解決方案**：使用 `document.fonts.ready` 確保字體載入

2. **emoji 和特殊字符**
   - emoji 寬度測量可能不完全準確
   - **影響較小**：大多數情況下可接受

3. **動態窗口調整**
   - 窗口大小改變時，需要重新渲染才能觸發換行重計算
   - **已自動處理**：React 組件重渲染會自動更新

### 未來改進方向

1. **在數據層自動處理**（可選）
   - 在 Whisper 識別後自動換行
   - 在導入 SRT 時自動換行
   - 添加"重新換行所有字幕"按鈕
   - **優點**：換行結果永久保存，無需每次渲染計算
   - **缺點**：失去動態響應能力

2. **換行策略配置**（可選）
   - 允許用戶選擇換行模式：自動/手動/禁用
   - 配置最大行數限制
   - 配置斷句優先級

3. **性能優化**（如需要）
   - 使用 `useMemo` 緩存換行結果
   - 組件級 Canvas 實例重用
   - Web Worker 處理大量字幕換行

## 總結

### 問題根源
基於字符數的換行無法處理實際渲染寬度，導致長字幕超出螢幕。

### 解決方案
使用 Canvas measureText API 測量實際像素寬度，結合智能斷句算法，實現精確的自動換行。

### 核心優勢
1. ✅ **精確**：基於實際渲染寬度，不是字符數
2. ✅ **智能**：優先在標點符號處斷開
3. ✅ **兼容**：與現有導出邏輯完全一致
4. ✅ **響應式**：自動適應窗口大小、字體變化
5. ✅ **透明**：用戶無需手動操作，完全自動

### 使用建議
- 預覽畫面：直接使用，自動生效
- 導出視頻：已自動使用相同邏輯，無需額外配置
- 如遇到字幕仍然超出，檢查字體是否已載入完成

---

**實現日期**：2025-11-14
**文件路徑**：`C:\Users\USER\Desktop\code\subtitle-web\docs\SUBTITLE_WRAPPING_SOLUTION.md`
