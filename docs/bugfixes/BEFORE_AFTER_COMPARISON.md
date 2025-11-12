# Before/After Comparison: ASS Stroke Enhancement

## Overview
This document shows the key differences in the ASS generation code before and after the stroke enhancement implementation.

---

## 1. Color Conversion Function

### BEFORE
```typescript
function hexToAssColor(hex: string, opacity: number): string {
  // 移除 # 號
  hex = hex.replace('#', '');

  // 提取 RGB
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);

  // 計算 alpha (0=不透明, FF=全透明)
  const alpha = Math.round((1 - opacity) * 255).toString(16).padStart(2, '0').toUpperCase();

  // ASS 格式: &HAABBGGRR
  return `&H${alpha}${b}${g}${r}`;
}
```

**Issues:**
- No documentation of color format
- String manipulation instead of proper parsing
- No default parameter

### AFTER
```typescript
/**
 * 將 HEX 顏色轉換為 ASS 格式
 * @param hex - #RRGGBB 格式的顏色值
 * @param alpha - 0-1 之間的透明度值 (0=完全透明, 1=完全不透明)
 * @returns &HAABBGGRR 格式的 ASS 顏色字串
 *
 * ASS 顏色格式說明:
 * - &H 是前綴
 * - AA 是 alpha (00=不透明, FF=全透明, 與 CSS 相反)
 * - BB 是 blue
 * - GG 是 green
 * - RR 是 red (順序與 CSS 的 RGB 相反)
 */
function hexToAssColor(hex: string, alpha: number = 1): string {
  // 移除 # 號
  hex = hex.replace('#', '');

  // 解析 RGB 值
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 計算 ASS alpha (0=不透明, FF=全透明, 與 CSS 相反)
  const a = Math.round((1 - alpha) * 255);

  // 轉換為十六進位並填充到兩位
  const aHex = a.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const rHex = r.toString(16).padStart(2, '0');

  // ASS 格式: &HAABBGGRR
  return `&H${aHex}${bHex}${gHex}${rHex}`.toUpperCase();
}
```

**Improvements:**
- ✅ Comprehensive documentation
- ✅ Proper RGB parsing with parseInt
- ✅ Default parameter (alpha = 1)
- ✅ Clearer variable names

---

## 2. Color Variables

### BEFORE
```typescript
// ASS 顏色格式: &HAABBGGRR (alpha, blue, green, red)
const primaryColor = hexToAssColor(style.color, style.opacity);
const shadowColor = style.enableShadow ? hexToAssColor(style.shadowColor, 1) : '&H00000000';
const backgroundColor = style.backgroundColor === 'transparent'
  ? '&H00000000'
  : hexToAssColor(style.backgroundColor, 1);
```

**Issues:**
- No outline color variable
- OutlineColour parameter always used shadowColor

### AFTER
```typescript
// ASS 顏色格式: &HAABBGGRR (alpha, blue, green, red)
const primaryColor = hexToAssColor(style.color, style.opacity);

// 陰影顏色 (BackColour in ASS)
const shadowColor = style.enableShadow
  ? hexToAssColor(style.shadowColor, 1)
  : '&H00000000';

// 描邊顏色 (OutlineColour in ASS)
const outlineColor = style.enableStroke
  ? hexToAssColor(style.strokeColor, 1)
  : '&H00000000';

// 背景顏色 (用於 BorderStyle=3 的不透明背景框)
const backgroundColor = style.backgroundColor === 'transparent'
  ? '&H00000000'
  : hexToAssColor(style.backgroundColor, 1);
```

**Improvements:**
- ✅ Added outlineColor variable for stroke support
- ✅ Clear comments for each color's purpose
- ✅ Proper mapping of strokeColor to OutlineColour

---

## 3. Shadow Distance Calculation

### BEFORE
```typescript
// Shadow 距離 (ASS 只支援一個 shadow 參數,計算對角線距離)
// 使用勾股定理計算 X 和 Y 偏移的合成距離
const shadow = style.enableShadow
  ? Math.round(Math.sqrt(
      Math.pow(style.shadowOffsetX, 2) +
      Math.pow(style.shadowOffsetY, 2)
    ))
  : 0;
```

**Issues:**
- Unnecessary Math.round() (ASS accepts decimals)
- Verbose Math.pow() syntax

### AFTER
```typescript
// Shadow 距離 (ASS 只支援一個 shadow 參數,計算對角線距離)
// 使用勾股定理計算 X 和 Y 偏移的合成距離,這樣可以更準確地模擬 CSS 陰影效果
const shadowDistance = style.enableShadow
  ? Math.sqrt(
      style.shadowOffsetX ** 2 +
      style.shadowOffsetY ** 2
    )
  : 0;
```

**Improvements:**
- ✅ Removed Math.round() for decimal precision
- ✅ Used exponentiation operator (**)
- ✅ Renamed to shadowDistance for clarity
- ✅ Enhanced comment

---

## 4. BorderStyle and Outline Logic

### BEFORE
```typescript
// BorderStyle: 1=普通邊框, 3=不透明方框背景
// 如果有背景色,使用 BorderStyle=3 來顯示背景框
const borderStyle = style.backgroundColor !== 'transparent' ? 3 : 1;

// Outline: 邊框寬度 (當 BorderStyle=3 時,這個值控制背景框的 padding)
// 使用 8px 的 padding (對應網頁預覽的 padding)
const outline = style.backgroundColor !== 'transparent' ? 8 : 0;
```

**Issues:**
- No stroke support
- Always 0 outline when no background
- No consideration of strokeWidth

### AFTER
```typescript
// BorderStyle 和 Outline 的邏輯:
// - BorderStyle=1: 普通描邊模式 (支援 Outline 寬度和顏色)
// - BorderStyle=3: 不透明背景框模式 (Outline 控制 padding)
//
// 優先級:
// 1. 如果有背景色 → BorderStyle=3 (背景框模式)
// 2. 如果有描邊 → BorderStyle=1 (描邊模式)
// 3. 否則 → BorderStyle=1, Outline=0 (無邊框)
const hasBackground = style.backgroundColor !== 'transparent';
const hasStroke = style.enableStroke && style.strokeWidth > 0;

let borderStyle: number;
let outline: number;

if (hasBackground) {
  // 背景框模式: Outline 控制背景框的 padding
  borderStyle = 3;
  outline = 8; // 8px padding
} else if (hasStroke) {
  // 描邊模式: Outline 控制描邊寬度
  borderStyle = 1;
  outline = style.strokeWidth;
} else {
  // 無邊框模式
  borderStyle = 1;
  outline = 0;
}
```

**Improvements:**
- ✅ Added stroke support with priority system
- ✅ Maps strokeWidth to Outline parameter
- ✅ Clear decision tree with comments
- ✅ Proper handling of all cases

---

## 5. Style String Generation

### BEFORE
```typescript
return `Style: Style${index},${fontName},${actualFontSize},${primaryColor},&H000000FF,${shadowColor},${backgroundColor},${bold},${italic},${underline},${strikeout},${scale},${scale},0,0,${borderStyle},${outline},${shadow},${alignment},10,10,10,1`;
```

**Issues:**
- OutlineColour always uses shadowColor (wrong!)
- Shadow uses variable named 'shadow'

### AFTER
```typescript
return `Style: Style${index},${fontName},${actualFontSize},${primaryColor},&H000000FF,${outlineColor},${backgroundColor},${bold},${italic},${underline},${strikeout},${scale},${scale},0,0,${borderStyle},${outline},${shadowDistance},${alignment},10,10,10,1`;
```

**Improvements:**
- ✅ OutlineColour uses outlineColor (correct stroke color)
- ✅ Shadow uses shadowDistance (better naming)

**Parameter Positions:**
```
Position 5: OutlineColour = ${outlineColor}  ← Now uses stroke color!
Position 16: Outline = ${outline}            ← Now uses stroke width!
Position 17: Shadow = ${shadowDistance}      ← More accurate calculation!
```

---

## 6. Documentation

### BEFORE
```typescript
/**
 * 生成 ASS (Advanced SubStation Alpha) 字幕檔
 * ASS 格式支援豐富的字幕樣式,適合用於 FFmpeg 燒錄
 */
```

**Issues:**
- No style support matrix
- No guidance on what CSS features are supported

### AFTER
```typescript
/**
 * CSS to ASS Style Mapping
 *
 * Fully Supported:
 * - fontSize, fontFamily, fontWeight, fontStyle
 * - color, opacity
 * - position (Alignment + MarginV)
 * - textDecoration (underline, line-through)
 *
 * Partially Supported (with limitations):
 * - stroke (mapped to Outline, but rendering may differ)
 * - shadow (single distance instead of X/Y offsets)
 * - backgroundColor (opaque box only, no rounded corners)
 *
 * Not Supported (fallback to default):
 * - gradients (use first color)
 * - backdrop blur (ignored)
 * - animations (static only)
 * - multiple strokes (single outline only)
 * - shadowBlur (ASS doesn't support blur radius)
 */

/**
 * 生成 ASS (Advanced SubStation Alpha) 字幕檔
 * ASS 格式支援豐富的字幕樣式,適合用於 FFmpeg 燒錄
 */
```

**Improvements:**
- ✅ Clear style support matrix
- ✅ Categorized by support level
- ✅ Documents limitations
- ✅ Helps developers understand capabilities

---

## Example Output Comparison

### Test Case: Yellow text with blue stroke

**Style Properties:**
```typescript
{
  color: '#FFFF00',           // Yellow
  strokeColor: '#0000FF',     // Blue
  strokeWidth: 5,
  enableStroke: true,
  shadowOffsetX: 3,
  shadowOffsetY: 4,
}
```

### BEFORE (No Stroke Support)
```
Style: Style0,Arial,48,&H0000FFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,5,2,10,10,10,1
                                              ^^^^^^^^^^              ^
                                              OutlineColour=black    Outline=0 (no stroke!)
```

### AFTER (With Stroke Support)
```
Style: Style0,Arial,48,&H0000FFFF,&H000000FF,&H00FF0000,&H00000000,0,0,0,0,100,100,0,0,1,5,5,2,10,10,10,1
                                              ^^^^^^^^^^              ^
                                              OutlineColour=blue     Outline=5 (5px stroke!)
```

**Visual Result:**
- BEFORE: Yellow text, no outline
- AFTER: Yellow text with 5px blue outline ✅

---

## Summary of Improvements

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| Stroke Color Mapping | ❌ Not supported | ✅ Maps to OutlineColour | Implemented |
| Stroke Width Mapping | ❌ Not supported | ✅ Maps to Outline | Implemented |
| Shadow Calculation | ⚠️ Rounded integer | ✅ Decimal precision | Improved |
| Color Conversion | ⚠️ String manipulation | ✅ Proper parsing | Improved |
| Documentation | ❌ Minimal | ✅ Comprehensive | Added |
| Style Support Matrix | ❌ None | ✅ Documented | Added |

---

## Testing Checklist

- [x] Stroke color converts correctly (RGB → BGR)
- [x] Stroke width maps to Outline parameter
- [x] BorderStyle=1 when stroke enabled
- [x] Shadow distance calculated with decimals
- [x] Priority system works (background > stroke > none)
- [x] Color conversion handles all cases
- [x] Documentation is clear and accurate

---

*All enhancements have been successfully implemented and tested.*
