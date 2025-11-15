# 字幕自動換行 - 快速參考

## 快速開始

### 安裝

```typescript
import { wrapTextByActualWidth, buildFontString } from '@/app/utils/text-wrapping';
```

### 基礎用法

```typescript
// 1. 構建字體字符串
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

## 核心 API

### wrapTextByActualWidth()

基於實際渲染寬度進行智能換行。

```typescript
wrapTextByActualWidth(text: string, options: {
  maxWidth: number;           // 最大寬度（像素）
  font: string;               // 字體字符串
  allowForcedBreak?: boolean; // 允許強制斷行（默認 true）
  customBreakPoints?: string[]; // 自定義斷點
}): string[]
```

### buildFontString()

構建 Canvas 字體字符串。

```typescript
buildFontString(options: {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number; // 默認 '400'
  fontStyle?: string;           // 默認 'normal'
}): string
```

### measureTextWidth()

測量文本實際寬度。

```typescript
measureTextWidth(text: string, font: string): number
```

### joinWrappedLines()

將行數組轉換為字符串。

```typescript
joinWrappedLines(lines: string[]): string
```

## 常用場景

### 場景 1: 編輯器預覽

```typescript
function renderSubtitle(subtitle) {
  const font = buildFontString({
    fontSize: subtitle.fontSize,
    fontFamily: subtitle.fontFamily,
    fontWeight: subtitle.fontWeight,
    fontStyle: subtitle.fontStyle
  });

  const lines = wrapTextByActualWidth(subtitle.text, {
    maxWidth: calculateMaxWidth(),
    font
  });

  return lines.join('\n');
}
```

### 場景 2: Canvas 渲染

```typescript
function drawSubtitle(ctx, subtitle, maxWidth) {
  // 設置字體
  ctx.font = buildFontString({
    fontSize: subtitle.fontSize,
    fontFamily: subtitle.fontFamily,
    fontWeight: subtitle.fontWeight,
    fontStyle: subtitle.fontStyle
  });

  // 換行
  const lines = wrapTextByActualWidth(subtitle.text, {
    maxWidth,
    font: ctx.font
  });

  // 繪製每一行
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    ctx.fillText(line, x, y);
  });
}
```

### 場景 3: 寬度計算

```typescript
function getSubtitleWidth(text, fontSize, fontFamily) {
  const font = buildFontString({ fontSize, fontFamily });
  return measureTextWidth(text, font);
}
```

## 斷點優先級

```
。> ！> ？> ；> ：> 、> ，> . > ! > ? > ; > : > , > 空格
```

## 配置示例

### 中文字幕

```typescript
const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(text, {
  maxWidth: 600,
  font
});
```

### 英文字幕

```typescript
const font = buildFontString({
  fontSize: 28,
  fontFamily: 'Arial',
  fontWeight: '400',
  fontStyle: 'normal'
});

const lines = wrapTextByActualWidth(text, {
  maxWidth: 500,
  font
});
```

### 自定義斷點

```typescript
const lines = wrapTextByActualWidth(text, {
  maxWidth: 600,
  font,
  customBreakPoints: ['|', '/', '\\']
});
```

## 性能優化

### 緩存換行結果

```typescript
const cache = new Map();

function cachedWrap(text, maxWidth, font) {
  const key = `${text}:${maxWidth}:${font}`;
  if (cache.has(key)) return cache.get(key);

  const lines = wrapTextByActualWidth(text, { maxWidth, font });
  cache.set(key, lines);
  return lines;
}
```

### 批量測量

```typescript
import { measureMultipleTexts } from '@/app/utils/text-wrapping';

const texts = ["文本1", "文本2", "文本3"];
const widths = measureMultipleTexts(texts, font);
```

## 調試技巧

### 預覽換行結果

```typescript
import { previewWrappedLines } from '@/app/utils/text-wrapping';

const lines = wrapTextByActualWidth(text, options);
console.log(previewWrappedLines(lines));
// 輸出:
// Line 1: 第一行
// Line 2: 第二行
// Line 3: 第三行
```

### 測試換行

```typescript
// 在瀏覽器控制台
import { runAllExamples } from '@/app/examples/text-wrapping-demo';
runAllExamples();
```

## 常見錯誤

### ❌ 字體設置不一致

```typescript
// 預覽
const previewFont = "bold 32px Arial";

// 導出
const exportFont = "normal 32px Arial"; // ❌ 不一致！
```

### ✅ 統一字體設置

```typescript
const font = buildFontString({
  fontSize: 32,
  fontFamily: 'Arial',
  fontWeight: 'bold',
  fontStyle: 'normal'
});

// 預覽和導出都使用相同的 font
```

### ❌ maxWidth 計算錯誤

```typescript
// ❌ 忘記減去 padding
const maxWidth = containerWidth;
```

### ✅ 正確計算 maxWidth

```typescript
// ✅ 考慮 padding
const maxWidth = containerWidth - paddingLeft - paddingRight;
```

## 完整示例

```typescript
import {
  wrapTextByActualWidth,
  buildFontString,
  measureTextWidth,
  joinWrappedLines
} from '@/app/utils/text-wrapping';

// 字幕配置
const subtitle = {
  text: "這是一段很長的字幕文本，需要根據實際渲染寬度進行智能換行處理。",
  fontSize: 32,
  fontFamily: 'Noto Sans TC',
  fontWeight: '700',
  fontStyle: 'normal'
};

// 容器配置
const containerWidth = 600;
const padding = 20;
const maxWidth = containerWidth - padding * 2;

// 構建字體
const font = buildFontString({
  fontSize: subtitle.fontSize,
  fontFamily: subtitle.fontFamily,
  fontWeight: subtitle.fontWeight,
  fontStyle: subtitle.fontStyle
});

// 換行
const lines = wrapTextByActualWidth(subtitle.text, {
  maxWidth,
  font,
  allowForcedBreak: true
});

// 使用結果
console.log('原文:', subtitle.text);
console.log('換行後:', lines);
console.log('顯示:', joinWrappedLines(lines));

// 測量寬度
lines.forEach((line, i) => {
  const width = measureTextWidth(line, font);
  console.log(`第 ${i + 1} 行寬度: ${width.toFixed(2)}px`);
});
```

## 相關文檔

- [完整實現文檔](./TEXT_WRAPPING_IMPLEMENTATION.md)
- [使用示例](../app/examples/text-wrapping-demo.ts)
- [API 文檔](../app/utils/text-wrapping.ts)
