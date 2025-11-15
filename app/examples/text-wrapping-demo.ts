/**
 * 文本自動換行示例
 *
 * 這個文件展示如何使用 text-wrapping 工具進行智能換行
 */

import {
  wrapTextByActualWidth,
  buildFontString,
  measureTextWidth,
  previewWrappedLines,
  joinWrappedLines
} from '../utils/text-wrapping';

// ============================================
// 示例 1: 基礎用法 - 中文字幕換行
// ============================================
export function example1_BasicChineseWrapping() {
  const text = "這是一段很長的中文字幕，需要根據實際渲染寬度進行智能換行處理。系統會優先在標點符號處斷開，確保閱讀體驗最佳。";

  const font = buildFontString({
    fontSize: 32,
    fontFamily: 'Noto Sans TC',
    fontWeight: '700',
    fontStyle: 'normal'
  });

  const lines = wrapTextByActualWidth(text, {
    maxWidth: 600, // 最大寬度600像素
    font,
  });

  console.log('=== 示例 1: 基礎中文換行 ===');
  console.log('原文:', text);
  console.log('換行後:');
  console.log(previewWrappedLines(lines));
  console.log('實際輸出:', joinWrappedLines(lines));
  console.log('');

  return lines;
}

// ============================================
// 示例 2: 英文字幕換行
// ============================================
export function example2_EnglishWrapping() {
  const text = "This is a very long English subtitle that needs to be wrapped based on actual rendering width. The system will try to break at spaces for better readability.";

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

  console.log('=== 示例 2: 英文換行 ===');
  console.log('原文:', text);
  console.log('換行後:');
  console.log(previewWrappedLines(lines));
  console.log('');

  return lines;
}

// ============================================
// 示例 3: 中英文混排
// ============================================
export function example3_MixedLanguageWrapping() {
  const text = "這是混合語言字幕，包含中文和English words，系統會智能處理。System will handle it intelligently, breaking at appropriate points.";

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

  console.log('=== 示例 3: 中英文混排 ===');
  console.log('原文:', text);
  console.log('換行後:');
  console.log(previewWrappedLines(lines));
  console.log('');

  return lines;
}

// ============================================
// 示例 4: 保留手動換行
// ============================================
export function example4_PreserveManualBreaks() {
  const text = "第一段文字。\n第二段文字，這段比較長需要自動換行處理。\n第三段文字。";

  const font = buildFontString({
    fontSize: 32,
    fontFamily: 'Noto Sans TC',
    fontWeight: '400',
    fontStyle: 'normal'
  });

  const lines = wrapTextByActualWidth(text, {
    maxWidth: 400,
    font,
  });

  console.log('=== 示例 4: 保留手動換行 ===');
  console.log('原文:', text);
  console.log('換行後:');
  console.log(previewWrappedLines(lines));
  console.log('');

  return lines;
}

// ============================================
// 示例 5: 不同字體大小的影響
// ============================================
export function example5_DifferentFontSizes() {
  const text = "相同的文字，不同的字體大小，會產生不同的換行結果。";

  const fontSizes = [24, 32, 40, 48];
  const maxWidth = 500;

  console.log('=== 示例 5: 不同字體大小 ===');
  console.log('原文:', text);
  console.log('最大寬度:', maxWidth, 'px');
  console.log('');

  fontSizes.forEach(fontSize => {
    const font = buildFontString({
      fontSize,
      fontFamily: 'Noto Sans TC',
      fontWeight: '400',
      fontStyle: 'normal'
    });

    const lines = wrapTextByActualWidth(text, {
      maxWidth,
      font,
    });

    console.log(`字體大小 ${fontSize}px:`);
    console.log(previewWrappedLines(lines));
    console.log('');
  });
}

// ============================================
// 示例 6: 測量文本寬度
// ============================================
export function example6_MeasureTextWidth() {
  const texts = [
    "短文字",
    "這是中等長度的文字",
    "這是一段比較長的文字，用來測試寬度測量功能是否準確"
  ];

  const font = buildFontString({
    fontSize: 32,
    fontFamily: 'Noto Sans TC',
    fontWeight: '400',
    fontStyle: 'normal'
  });

  console.log('=== 示例 6: 測量文本寬度 ===');
  console.log('字體:', font);
  console.log('');

  texts.forEach(text => {
    const width = measureTextWidth(text, font);
    console.log(`"${text}"`);
    console.log(`  寬度: ${width.toFixed(2)}px`);
    console.log('');
  });
}

// ============================================
// 示例 7: 自定義斷點字符
// ============================================
export function example7_CustomBreakPoints() {
  const text = "這段文字包含特殊字符|需要在這些字符處斷開|系統支持自定義斷點";

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

  console.log('=== 示例 7: 自定義斷點 ===');
  console.log('原文:', text);
  console.log('自定義斷點: |');
  console.log('換行後:');
  console.log(previewWrappedLines(lines));
  console.log('');

  return lines;
}

// ============================================
// 運行所有示例
// ============================================
export function runAllExamples() {
  console.log('====================================');
  console.log('文本自動換行工具 - 完整示例');
  console.log('====================================');
  console.log('');

  example1_BasicChineseWrapping();
  example2_EnglishWrapping();
  example3_MixedLanguageWrapping();
  example4_PreserveManualBreaks();
  example5_DifferentFontSizes();
  example6_MeasureTextWidth();
  example7_CustomBreakPoints();

  console.log('====================================');
  console.log('所有示例運行完成');
  console.log('====================================');
}

// 在瀏覽器控制台中運行:
// import { runAllExamples } from './app/examples/text-wrapping-demo';
// runAllExamples();
