# 字幕自動換行系統 - 實現文檔

## 概述

本文檔描述了一個**真正有效**的字幕自動換行系統的完整實現。該系統基於實際渲染寬度進行智能換行，並確保預覽和導出的一致性。

## 核心特性

### 1. 基於實際渲染寬度
- 使用 Canvas API 的 `measureText()` 方法測量真實像素寬度
- 不依賴字符數估算，完全精確
- 支持不同字體、字重、字號的精確測量

### 2. 智能斷句
- 優先級斷點：`。！？；：、，. ! ? ; : ,`
- 中英文混排支持
- 保留用戶手動換行符（`\n`）
- 空格處智能斷行（英文單詞分隔）

### 3. 預覽和導出一致
- 預覽（editor-pro）、WebCodecs 錄製、Preview 錄製使用相同換行邏輯
- 統一的字體字符串構建
- 統一的斷點配置

## 文件結構

```
app/
├── utils/
│   └── text-wrapping.ts          # 核心換行工具
├── hooks/
│   ├── useWebCodecsRecorder.ts   # WebCodecs 錄製（已整合）
│   └── usePreviewRecorder.ts     # Preview 錄製（已整合）
├── editor-pro/
│   └── page.tsx                  # 編輯器預覽（已整合）
└── examples/
    └── text-wrapping-demo.ts     # 使用示例
```

## 核心 API

### 1. `wrapTextByActualWidth()`

主要換行函數，基於實際渲染寬度進行智能換行。

```typescript
function wrapTextByActualWidth(
  text: string,
  options: TextWrappingOptions
): string[]

interface TextWrappingOptions {
  maxWidth: number;              // 最大寬度（像素）
  font: string;                  // 字體字符串
  allowForcedBreak?: boolean;    // 允許強制斷行（默認 true）
  customBreakPoints?: string[];  // 自定義斷點字符
}
```

**返回值**: 換行後的字符串數組

**示例**:
```typescript
import { wrapTextByActualWidth, buildFontString } from '@/app/utils/text-wrapping';

const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(
  "這是一段很長的文本，需要自動換行。",
  { maxWidth: 600, font }
);
// 返回: ["這是一段很長的文本，", "需要自動換行。"]
```

### 2. `buildFontString()`

構建 Canvas 字體字符串。

```typescript
function buildFontString(options: {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number;
  fontStyle?: string;
}): string
```

**示例**:
```typescript
const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'italic'
});
// 返回: "italic 700 32px \"Noto Sans TC\""
```

### 3. `measureTextWidth()`

測量文本實際渲染寬度。

```typescript
function measureTextWidth(text: string, font: string): number
```

**示例**:
```typescript
const width = measureTextWidth(
  "測試文本",
  "normal 400 16px 'Noto Sans TC'"
);
// 返回: 128.5 (像素)
```

### 4. `joinWrappedLines()`

將換行後的行數組轉換為單個字符串。

```typescript
function joinWrappedLines(lines: string[]): string
```

**示例**:
```typescript
const lines = ["第一行", "第二行", "第三行"];
const text = joinWrappedLines(lines);
// 返回: "第一行\n第二行\n第三行"
```

## 集成點

### 1. 編輯器預覽（editor-pro/page.tsx）

**位置**: Line 29-56

```typescript
function wrapSubtitleTextByWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string = 'Arial',
  fontWeight: string = 'normal',
  fontStyle: string = 'normal'
): string {
  // 構建字體字符串
  const font = buildFontString({
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
  });

  // 使用通用換行工具
  const lines = wrapTextByActualWidth(text, {
    maxWidth,
    font,
    allowForcedBreak: true,
  });

  // 轉換為換行符分隔的字符串
  return joinWrappedLines(lines);
}
```

**使用場景**:
- 當前字幕實時預覽（Line 1905-1912）
- 固定字幕實時預覽（Line 1966-1973）

### 2. WebCodecs 錄製（useWebCodecsRecorder.ts）

**位置**: Line 245-260

```typescript
const wrapText = useCallback((
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  // 使用通用換行工具（基於實際渲染寬度）
  return wrapTextByActualWidth(text, {
    maxWidth,
    font: ctx.font, // 使用當前Canvas的字體設置
    allowForcedBreak: true,
  });
}, []);
```

**使用場景**:
- Canvas 字幕渲染（Line 367, 722）

### 3. Preview 錄製（usePreviewRecorder.ts）

**位置**: Line 622-637

```typescript
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // 使用通用換行工具（基於實際渲染寬度）
  return wrapTextByActualWidth(text, {
    maxWidth,
    font: ctx.font,
    allowForcedBreak: true,
  });
}
```

**使用場景**:
- Canvas 字幕渲染（Line 722）

## 換行算法詳解

### 算法流程

```
1. 按手動換行符（\n）分割段落
   ↓
2. 對每個段落:
   a. 測量總寬度
   b. 如果 ≤ maxWidth，直接添加
   c. 如果 > maxWidth，執行智能分割:
      ↓
3. 智能分割流程:
   逐字添加 → 測量寬度 → 超出？
                              ↓ 是
                        查找最佳斷點
                              ↓
                     找到斷點？ | 未找到
                        ↓            ↓
                  在斷點處分割   強制分割
                        ↓            ↓
                     添加該行     添加該行
                        ↓            ↓
                     繼續處理下一個字符
```

### 斷點優先級

```typescript
const BREAK_POINTS = [
  '。',  // 中文句號 - 最高優先級
  '！',  // 中文感嘆號
  '？',  // 中文問號
  '；',  // 中文分號
  '：',  // 中文冒號
  '、',  // 中文頓號
  '，',  // 中文逗號
  '.',   // 英文句號
  '!',   // 英文感嘆號
  '?',   // 英文問號
  ';',   // 英文分號
  ':',   // 英文冒號
  ',',   // 英文逗號
  ' ',   // 空格（英文單詞分隔）- 最低優先級
];
```

### 關鍵特性

1. **保留斷點字符**: 斷點字符保留在前一行末尾
   ```
   輸入: "這是句子。下一句話"
   輸出: ["這是句子。", "下一句話"]
   ```

2. **去除多餘空格**: 分割後自動去除行首空格
   ```
   輸入: "Hello world, this is a test"
   斷點: ","
   輸出: ["Hello world,", "this is a test"]  // 注意 "this" 前沒有空格
   ```

3. **強制斷行**: 當無法找到合適斷點時，在當前位置強制斷開
   ```
   輸入: "一個沒有標點符號的超長連續字符串"
   輸出: ["一個沒有標點符號的超", "長連續字符串"]
   ```

## 使用示例

### 示例 1: 基礎中文換行

```typescript
import { wrapTextByActualWidth, buildFontString } from '@/app/utils/text-wrapping';

const text = "這是一段很長的中文字幕，需要根據實際渲染寬度進行智能換行處理。系統會優先在標點符號處斷開，確保閱讀體驗最佳。";

const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(text, {
  maxWidth: 600,
  font,
});

console.log(lines);
// 輸出:
// [
//   "這是一段很長的中文字幕，",
//   "需要根據實際渲染寬度進行智能換行處理。",
//   "系統會優先在標點符號處斷開，",
//   "確保閱讀體驗最佳。"
// ]
```

### 示例 2: 英文換行

```typescript
const text = "This is a very long English subtitle that needs to be wrapped.";

const font = buildFontString({
  fontSize: 28,
  fontFamily: 'Arial',
  fontWeight: '400',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(text, {
  maxWidth: 500,
  font,
});

console.log(lines);
// 輸出:
// [
//   "This is a very long English subtitle",
//   "that needs to be wrapped."
// ]
```

### 示例 3: 中英文混排

```typescript
const text = "這是混合語言字幕，包含中文和English words，系統會智能處理。";

const font = buildFontString({
  fontSize: 30,
  fontFamily: 'Noto Sans TC',
  fontWeight: '500',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(text, {
  maxWidth: 550,
  font,
});

console.log(lines);
// 輸出:
// [
//   "這是混合語言字幕，",
//   "包含中文和English words，",
//   "系統會智能處理。"
// ]
```

### 示例 4: 自定義斷點

```typescript
const text = "這段文字包含特殊字符|需要在這些字符處斷開|系統支持自定義";

const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '400',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(text, {
  maxWidth: 400,
  font,
  customBreakPoints: ['|'], // 添加 | 作為斷點
});

console.log(lines);
// 輸出:
// [
//   "這段文字包含特殊字符|",
//   "需要在這些字符處斷開|",
//   "系統支持自定義"
// ]
```

## 性能優化

### 1. Canvas 重用

避免在每次測量時創建新的 Canvas：

```typescript
// ❌ 不好 - 每次都創建新 Canvas
function measureWidth(text: string, font: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  return ctx.measureText(text).width;
}

// ✅ 好 - 重用 Canvas 實例
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

function measureWidth(text: string, font: string) {
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}
```

### 2. 批量測量

使用 `measureMultipleTexts()` 進行批量測量：

```typescript
import { measureMultipleTexts } from '@/app/utils/text-wrapping';

const texts = ["文本1", "文本2", "文本3"];
const font = "normal 400 16px Arial";

// 一次性測量所有文本
const widths = measureMultipleTexts(texts, font);
```

### 3. 緩存結果

對於重複使用的文本，緩存換行結果：

```typescript
const wrapCache = new Map<string, string[]>();

function cachedWrap(text: string, maxWidth: number, font: string) {
  const key = `${text}:${maxWidth}:${font}`;

  if (wrapCache.has(key)) {
    return wrapCache.get(key)!;
  }

  const lines = wrapTextByActualWidth(text, { maxWidth, font });
  wrapCache.set(key, lines);
  return lines;
}
```

## 測試建議

### 1. 功能測試

測試不同場景下的換行行為：

```typescript
// 測試用例 1: 空文本
test('empty text', () => {
  const lines = wrapTextByActualWidth('', { maxWidth: 100, font });
  expect(lines).toEqual(['']);
});

// 測試用例 2: 短文本（不需要換行）
test('short text', () => {
  const lines = wrapTextByActualWidth('短文本', { maxWidth: 500, font });
  expect(lines).toEqual(['短文本']);
});

// 測試用例 3: 保留手動換行
test('preserve manual breaks', () => {
  const lines = wrapTextByActualWidth('第一行\n第二行', { maxWidth: 500, font });
  expect(lines).toEqual(['第一行', '第二行']);
});

// 測試用例 4: 智能斷點
test('smart break points', () => {
  const lines = wrapTextByActualWidth('測試文本，這裡斷開。', { maxWidth: 100, font });
  expect(lines.length).toBeGreaterThan(1);
  expect(lines[0]).toMatch(/[，。]/); // 第一行應該以斷點結尾
});
```

### 2. 視覺測試

使用開發者工具檢查實際渲染：

```typescript
// 在瀏覽器控制台執行
import { runAllExamples } from '@/app/examples/text-wrapping-demo';
runAllExamples();
```

### 3. 一致性測試

確保預覽和導出使用相同邏輯：

1. 在編輯器中預覽字幕
2. 導出視頻
3. 對比預覽和導出的換行位置
4. 確保完全一致

## 常見問題

### Q1: 為什麼換行位置與預期不符？

**A**: 檢查以下幾點：
1. 字體設置是否一致（fontSize, fontFamily, fontWeight, fontStyle）
2. maxWidth 計算是否正確
3. 是否考慮了 padding 和邊距

### Q2: 如何處理 Emoji 和特殊字符？

**A**: Canvas API 的 `measureText()` 自動處理 Emoji 和特殊字符，無需額外配置。

### Q3: 如何優化性能？

**A**:
1. 重用 Canvas 實例
2. 緩存換行結果
3. 使用批量測量 API
4. 避免頻繁換行（如實時輸入時使用 debounce）

### Q4: 如何添加新的斷點字符？

**A**: 使用 `customBreakPoints` 選項：

```typescript
const lines = wrapTextByActualWidth(text, {
  maxWidth: 600,
  font,
  customBreakPoints: ['/', '\\', '|'], // 添加自定義斷點
});
```

## 總結

這個字幕自動換行系統提供了：

✅ **精確測量**: 基於實際渲染寬度，不是字符數估算
✅ **智能斷句**: 優先在標點符號處斷開
✅ **統一邏輯**: 預覽和導出使用相同的換行算法
✅ **靈活配置**: 支持自定義斷點和強制斷行
✅ **性能優化**: 提供緩存和批量測量功能
✅ **完整測試**: 包含使用示例和測試建議

## 相關文檔

- [使用示例](../app/examples/text-wrapping-demo.ts)
- [API 文檔](../app/utils/text-wrapping.ts)
- [WebCodecs 集成](../app/hooks/useWebCodecsRecorder.ts)
- [Preview 集成](../app/hooks/usePreviewRecorder.ts)
- [編輯器集成](../app/editor-pro/page.tsx)
