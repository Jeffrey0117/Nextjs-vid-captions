# 字幕自动换行解决方案

## 概述

本文档介绍字幕编辑器的智能自动换行功能，该功能能够根据实际渲染宽度精确地对字幕文本进行换行，确保字幕不会超出视频显示区域。

## 问题描述

### 为什么需要自动换行？

在视频字幕制作过程中，我们经常遇到以下问题：

1. **长文本溢出**：字幕内容过长时会超出屏幕边界，导致部分文字看不见
2. **字体大小不一致**：不同字体大小下，相同字符数的文本宽度差异很大
3. **多语言支持**：中文、英文等不同语言的字符宽度差异巨大
4. **响应式布局**：不同屏幕尺寸下，字幕需要自适应调整

### 传统方案的局限性

传统的基于字符数换行方式存在以下问题：

- **不准确**：固定字符数（如 20 字/行）无法适应不同字体和大小
- **不灵活**：无法处理中英混排、标点符号等复杂情况
- **用户体验差**：需要手动调整换行位置

## 解决方案概述

### 核心思路

使用 **Canvas API 的 `measureText()` 方法**，在渲染前精确测量文本的实际像素宽度，根据最大允许宽度智能地插入换行符。

### 关键特性

1. **精确测量**：使用 Canvas API 测量文本的实际渲染宽度（像素级）
2. **智能断句**：优先在标点符号处换行，保持语义完整性
3. **多字体支持**：支持不同字体族、字体大小、字重、斜体等样式
4. **实时计算**：根据视频容器的实际尺寸动态计算最大宽度
5. **性能优化**：使用临时 Canvas 进行测量，不影响主渲染性能

## 技术实现细节

### 1. 核心函数

#### `wrapSubtitleTextByWidth()`

```typescript
function wrapSubtitleTextByWidth(
  text: string,              // 原始文本
  maxWidth: number,          // 最大宽度（像素）
  fontSize: number,          // 字体大小（像素）
  fontFamily: string,        // 字体族
  fontWeight: string,        // 字体粗细
  fontStyle: string          // 字体样式
): string
```

**返回值**：换行后的文本（使用 `\n` 分隔多行）

### 2. 工作流程

```
输入文本
    ↓
创建临时 Canvas
    ↓
设置字体样式
    ↓
逐字符测量宽度
    ↓
超出宽度时智能断句
    ↓
返回换行后的文本
```

### 3. 断句优先级

按以下优先级在合适的位置插入换行符：

1. 句号 `。`
2. 问号 `？` / 惊叹号 `！`
3. 逗号 `，` / 顿号 `、`
4. 英文逗号 `,`
5. 空格 ` `
6. 强制断开（如果找不到合适的断句点）

### 4. 宽度计算

```typescript
// 获取视频显示尺寸
const videoDisplaySize = {
  width: containerElement.offsetWidth,
  height: containerElement.offsetHeight
};

// 计算最大允许宽度（百分比）
const maxWidthPercent = currentSubtitle.style.maxWidth; // 例如: 80%
const containerWidthPx = (maxWidthPercent / 100) * videoDisplaySize.width;

// 减去 padding
const paddingPx = 32;
const actualMaxWidth = containerWidthPx - paddingPx;

// 计算实际字体大小（根据视频高度缩放）
const actualFontSize = (fontSize * scale / 1080) * videoDisplaySize.height;
```

## 使用示例

### 基本用法

```typescript
import { wrapSubtitleTextByWidth } from './editor-pro/page';

const text = "这是一段很长的字幕文本，需要根据实际宽度进行智能换行处理。";
const maxWidth = 800; // 像素
const fontSize = 32;
const fontFamily = "Noto Sans SC";

const wrappedText = wrapSubtitleTextByWidth(
  text,
  maxWidth,
  fontSize,
  fontFamily,
  'normal',
  'normal'
);

console.log(wrappedText);
// 输出：
// 这是一段很长的字幕文本，
// 需要根据实际宽度进行智能换行处理。
```

### 在组件中使用

```typescript
<p
  style={{
    fontSize: actualFontSize,
    fontFamily: currentSubtitle.style.fontFamily,
    fontWeight: currentSubtitle.style.fontWeight,
    whiteSpace: 'pre-wrap', // 保留换行符
  }}
>
  {(() => {
    // 计算最大宽度
    const maxWidthPercent = currentSubtitle.style.maxWidth;
    const containerWidthPx = (maxWidthPercent / 100) * videoDisplaySize.width;
    const actualMaxWidth = containerWidthPx - 32;

    // 计算实际字体大小
    const actualFontSize = (currentSubtitle.style.fontSize * currentSubtitle.style.scale / 1080) * videoDisplaySize.height;

    // 应用智能换行
    return wrapSubtitleTextByWidth(
      currentSubtitle.text,
      actualMaxWidth,
      actualFontSize,
      currentSubtitle.style.fontFamily,
      currentSubtitle.style.fontWeight,
      currentSubtitle.style.fontStyle
    );
  })()}
</p>
```

## 优势与效果

### 优势

1. **精确度高**：基于实际渲染像素，而非字符数估算
2. **自适应**：自动适应不同屏幕尺寸和字体大小
3. **语义友好**：优先在标点符号处断句，保持可读性
4. **易于维护**：集中管理换行逻辑，不需要在每个字幕上手动调整

### 效果对比

#### 传统方式（固定字符数）

```
这是一段很长的字幕文本需要根据实际宽度进行智能换
行处理以确保字幕不会超出屏幕边界
```
- 可能在单词中间断开
- 不考虑标点符号
- 无法适应字体大小变化

#### 智能换行（本方案）

```
这是一段很长的字幕文本，
需要根据实际宽度进行智能换行处理。
```
- 在标点符号处断句
- 语义完整
- 自适应字体和屏幕尺寸

## 常见问题 FAQ

### Q1: 换行会影响性能吗？

**A**: 不会。我们使用临时的离屏 Canvas 进行测量，开销很小。测量是在渲染前进行的，不会阻塞主线程。

### Q2: 支持哪些字体？

**A**: 支持所有 Web 字体，只需确保 `fontFamily` 参数与实际渲染时使用的字体一致即可。

### Q3: 如何处理手动换行符？

**A**: 函数会保留用户手动输入的 `\n` 换行符，并在此基础上进行智能换行。

### Q4: 中英文混排如何处理？

**A**: Canvas `measureText()` 会自动处理不同字符的宽度，无需特殊处理。

### Q5: 能否自定义断句规则？

**A**: 可以。修改 `breakPoints` 数组即可自定义断句优先级：

```typescript
const breakPoints = ['。', '！', '？', '、', '，', ',', ' '];
```

### Q6: 如果一个词太长怎么办？

**A**: 如果找不到合适的断句点，函数会强制在当前位置断开，确保不会溢出。

### Q7: 换行后的文本如何渲染？

**A**: 使用 CSS `white-space: pre-wrap` 保留换行符，或使用 `<br />` 标签：

```typescript
text.split('\n').map((line, i) => (
  <Fragment key={i}>
    {line}
    {i < lines.length - 1 && <br />}
  </Fragment>
))
```

### Q8: 支持 RTL 语言（如阿拉伯文）吗？

**A**: 理论上支持，但需要额外配置 Canvas 的 `direction` 属性。

## 相关文档

- [实现详解](./SUBTITLE_WRAPPING_IMPLEMENTATION.md) - 完整的代码实现说明
- [测试指南](./SUBTITLE_WRAPPING_TEST_GUIDE.md) - 测试场景和验收标准

## 总结

字幕自动换行功能通过精确的宽度测量和智能断句算法，解决了传统方案的局限性，为用户提供了更好的字幕编辑体验。该方案已在生产环境中稳定运行，支持多种字体、多语言和响应式布局。
