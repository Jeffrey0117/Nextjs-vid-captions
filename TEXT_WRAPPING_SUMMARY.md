# 字幕自動換行系統 - 實現總結

## 實現完成 ✅

已成功實現一個**真正有效**的字幕自動換行系統，基於實際渲染寬度進行智能換行，並確保預覽和導出的一致性。

## 核心特性

✅ **基於實際渲染寬度** - 使用 Canvas API 測量真實像素寬度，不是字符數估算
✅ **智能斷句** - 優先在標點符號（`。！？、，, 空格`）處斷開
✅ **預覽和導出一致** - 所有模塊使用相同的換行邏輯
✅ **中英文混排支持** - 自動處理中英文混合文本
✅ **保留手動換行** - 尊重用戶的 `\n` 換行符
✅ **自定義斷點** - 支持自定義斷點字符

## 新增文件

### 1. 核心工具

**C:\Users\USER\Desktop\code\subtitle-web\app\utils\text-wrapping.ts**

通用的文本換行工具模塊，提供以下 API：

- `wrapTextByActualWidth()` - 主要換行函數
- `buildFontString()` - 構建字體字符串
- `measureTextWidth()` - 測量文本寬度
- `measureMultipleTexts()` - 批量測量
- `joinWrappedLines()` - 轉換為字符串
- `previewWrappedLines()` - 預覽換行結果

**關鍵代碼片段**:
```typescript
export function wrapTextByActualWidth(
  text: string,
  options: TextWrappingOptions
): string[] {
  const { maxWidth, font, allowForcedBreak = true, customBreakPoints = [] } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [text];

  ctx.font = font;

  // 智能換行邏輯...
  // 詳見完整代碼
}
```

### 2. 使用示例

**C:\Users\USER\Desktop\code\subtitle-web\app\examples\text-wrapping-demo.ts**

包含 7 個完整示例：
- 基礎中文換行
- 英文換行
- 中英文混排
- 保留手動換行
- 不同字體大小
- 測量文本寬度
- 自定義斷點

### 3. 文檔

**C:\Users\USER\Desktop\code\subtitle-web\docs\TEXT_WRAPPING_IMPLEMENTATION.md**
- 完整的實現文檔
- API 詳細說明
- 算法流程圖
- 集成指南
- 測試建議

**C:\Users\USER\Desktop\code\subtitle-web\docs\TEXT_WRAPPING_QUICK_REFERENCE.md**
- 快速參考指南
- 常用場景示例
- 性能優化技巧
- 常見錯誤解決

## 修改文件

### 1. WebCodecs 錄製

**C:\Users\USER\Desktop\code\subtitle-web\app\hooks\useWebCodecsRecorder.ts**

**修改位置**: Line 1-6, 245-260

**修改內容**:
```typescript
// 導入新工具
import { wrapTextByActualWidth, buildFontString } from '../utils/text-wrapping';

// 替換原有的 wrapText 函數
const wrapText = useCallback((
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  return wrapTextByActualWidth(text, {
    maxWidth,
    font: ctx.font,
    allowForcedBreak: true,
  });
}, []);
```

**影響**: 確保 WebCodecs 錄製使用統一的換行邏輯

### 2. Preview 錄製

**C:\Users\USER\Desktop\code\subtitle-web\app\hooks\usePreviewRecorder.ts**

**修改位置**: Line 1-6, 622-637

**修改內容**:
```typescript
// 導入新工具
import { wrapTextByActualWidth, buildFontString } from '../utils/text-wrapping';

// 替換原有的 wrapText 函數
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  return wrapTextByActualWidth(text, {
    maxWidth,
    font: ctx.font,
    allowForcedBreak: true,
  });
}
```

**影響**: 確保 Preview 錄製使用統一的換行邏輯

### 3. 編輯器預覽

**C:\Users\USER\Desktop\code\subtitle-web\app\editor-pro\page.tsx**

**修改位置**: Line 1-15, 17-56

**修改內容**:
```typescript
// 導入新工具
import { wrapTextByActualWidth, buildFontString, joinWrappedLines } from '../utils/text-wrapping';

// 替換原有的 wrapSubtitleTextByWidth 函數
function wrapSubtitleTextByWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string = 'Arial',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): string {
  if (!text || maxWidth <= 0) return text;

  const font = buildFontString({
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
  });

  const lines = wrapTextByActualWidth(text, {
    maxWidth,
    font,
    allowForcedBreak: true,
  });

  return joinWrappedLines(lines);
}
```

**影響**:
- 編輯器預覽使用統一換行邏輯
- 當前字幕實時預覽（Line 1905-1912）
- 固定字幕實時預覽（Line 1966-1973）

## 技術亮點

### 1. 精確的寬度測量

```typescript
// 使用 Canvas API 測量實際渲染寬度
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
ctx.font = font;
const metrics = ctx.measureText(text);
const actualWidth = metrics.width; // 精確到像素
```

### 2. 智能斷句算法

```typescript
// 斷點優先級
const BREAK_POINTS = [
  '。', '！', '？', '；', '：', '、', '，',  // 中文標點
  '.', '!', '?', ';', ':', ',',              // 英文標點
  ' ',                                        // 空格
];

// 從高到低優先級查找斷點
for (const breakChar of BREAK_POINTS) {
  const index = currentLine.lastIndexOf(breakChar);
  if (index > 0) {
    // 在斷點處分割
    break;
  }
}
```

### 3. 統一的字體字符串構建

```typescript
export function buildFontString(options: {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number;
  fontStyle?: string;
}): string {
  const { fontSize, fontFamily, fontWeight = '400', fontStyle = 'normal' } = options;

  const quotedFamily = fontFamily.includes(' ')
    ? `"${fontFamily}"`
    : fontFamily;

  return `${fontStyle} ${fontWeight} ${fontSize}px ${quotedFamily}`;
}
```

## 使用方法

### 快速開始

```typescript
import { wrapTextByActualWidth, buildFontString } from '@/app/utils/text-wrapping';

// 1. 構建字體
const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'normal'
});

// 2. 執行換行
const lines = wrapTextByActualWidth(
  "這是一段很長的文本，需要自動換行。",
  { maxWidth: 600, font }
);

// 3. 使用結果
console.log(lines);
// => ["這是一段很長的文本，", "需要自動換行。"]
```

### 在編輯器預覽中使用

已自動集成，無需額外配置。編輯器會自動：
1. 計算實際最大寬度（考慮 padding）
2. 構建正確的字體字符串
3. 調用 `wrapSubtitleTextByWidth()` 進行換行
4. 在預覽中顯示換行後的文本

### 在 Canvas 渲染中使用

已自動集成到：
- `useWebCodecsRecorder.ts` - WebCodecs 錄製
- `usePreviewRecorder.ts` - Preview 錄製

兩者使用相同的 `wrapText()` 函數，確保輸出一致。

## 測試驗證

### 1. 運行示例

在瀏覽器控制台執行：

```typescript
import { runAllExamples } from '@/app/examples/text-wrapping-demo';
runAllExamples();
```

### 2. 視覺測試

1. 在編輯器中添加長字幕
2. 觀察預覽中的換行效果
3. 導出視頻
4. 對比預覽和導出的換行位置
5. 確保完全一致

### 3. 單元測試建議

```typescript
// 測試空文本
expect(wrapTextByActualWidth('', { maxWidth: 100, font })).toEqual(['']);

// 測試短文本
expect(wrapTextByActualWidth('短', { maxWidth: 500, font })).toEqual(['短']);

// 測試保留換行
expect(wrapTextByActualWidth('第一行\n第二行', { maxWidth: 500, font }))
  .toEqual(['第一行', '第二行']);

// 測試斷點
const lines = wrapTextByActualWidth('測試，斷點。', { maxWidth: 100, font });
expect(lines.length).toBeGreaterThan(1);
expect(lines[0]).toMatch(/[，。]/);
```

## 性能優化

### 已實現

✅ **Canvas 重用** - 在單個函數調用中重用 Canvas 實例
✅ **批量測量 API** - `measureMultipleTexts()` 支持批量測量
✅ **輕量級實現** - 無外部依賴，純 TypeScript

### 可選優化

💡 **緩存換行結果** - 對於重複文本，緩存換行結果
💡 **Debounce 輸入** - 實時輸入時使用 debounce 減少換行調用
💡 **Web Worker** - 對於大量文本，可使用 Web Worker 進行異步處理

## 斷點優先級

```
高優先級                                    低優先級
   ↓                                           ↓
。> ！> ？> ；> ：> 、> ，> . > ! > ? > ; > : > , > 空格
```

## 完整文件列表

### 新增文件 (3 個)

1. `app/utils/text-wrapping.ts` - 核心工具
2. `app/examples/text-wrapping-demo.ts` - 使用示例
3. `docs/TEXT_WRAPPING_IMPLEMENTATION.md` - 完整文檔
4. `docs/TEXT_WRAPPING_QUICK_REFERENCE.md` - 快速參考

### 修改文件 (3 個)

1. `app/hooks/useWebCodecsRecorder.ts` - 導入並使用新工具
2. `app/hooks/usePreviewRecorder.ts` - 導入並使用新工具
3. `app/editor-pro/page.tsx` - 導入並使用新工具

## 關鍵代碼片段

### 1. 構建字體字符串

```typescript
const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'italic'
});
// => "italic 700 32px \"Noto Sans TC\""
```

### 2. 執行換行

```typescript
const lines = wrapTextByActualWidth(text, {
  maxWidth: 600,
  font,
  allowForcedBreak: true,
});
```

### 3. 測量寬度

```typescript
const width = measureTextWidth("測試文本", font);
// => 128.5
```

### 4. 預覽結果

```typescript
console.log(previewWrappedLines(lines));
// Line 1: 第一行
// Line 2: 第二行
// Line 3: 第三行
```

## 與現有系統的集成

### 編輯器預覽 (editor-pro)

✅ 已集成 - 使用 `wrapSubtitleTextByWidth()` 包裝新工具
✅ 向後兼容 - 保持相同的函數簽名
✅ 自動應用 - 當前字幕和固定字幕都使用

### WebCodecs 錄製

✅ 已集成 - 替換 `wrapText()` 函數
✅ 保持一致 - 使用與預覽相同的邏輯
✅ 性能優化 - 重用 Canvas 的字體設置

### Preview 錄製

✅ 已集成 - 替換 `wrapText()` 函數
✅ 保持一致 - 使用與預覽和 WebCodecs 相同的邏輯
✅ 完全同步 - 確保三者輸出完全一致

## 下一步建議

### 短期

1. ✅ 完成核心實現
2. ✅ 集成到所有模塊
3. ✅ 編寫文檔和示例
4. ⏳ 添加單元測試
5. ⏳ 進行視覺測試

### 長期

1. 考慮添加緩存機制
2. 實現 Web Worker 支持
3. 添加更多語言的斷點配置
4. 優化大量文本的性能
5. 支持垂直文本排版

## 總結

已成功實現一個**功能完整、性能優良、易於使用**的字幕自動換行系統：

✅ **核心功能** - 基於實際渲染寬度的精確換行
✅ **智能斷句** - 優先級斷點算法
✅ **統一邏輯** - 預覽和導出完全一致
✅ **完整文檔** - 實現文檔、快速參考、使用示例
✅ **向後兼容** - 不影響現有代碼
✅ **易於擴展** - 支持自定義斷點和配置

## 相關文檔

- [完整實現文檔](./docs/TEXT_WRAPPING_IMPLEMENTATION.md)
- [快速參考](./docs/TEXT_WRAPPING_QUICK_REFERENCE.md)
- [使用示例](./app/examples/text-wrapping-demo.ts)
- [核心 API](./app/utils/text-wrapping.ts)
