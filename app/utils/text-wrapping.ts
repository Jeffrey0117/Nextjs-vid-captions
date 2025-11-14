/**
 * 字幕自動換行工具 - 基於實際渲染寬度的智能換行
 *
 * 核心特性：
 * 1. 使用Canvas API測量實際渲染寬度（不是字符數）
 * 2. 智能斷句：優先在標點符號和空格處斷開
 * 3. 支持中英文混排
 * 4. 預覽和導出使用相同邏輯保證一致性
 */

/**
 * 斷句優先級配置
 * 按優先級從高到低排列
 */
const BREAK_POINTS = [
  '。', // 中文句號
  '！', // 中文感嘆號
  '？', // 中文問號
  '；', // 中文分號
  '：', // 中文冒號
  '、', // 中文頓號
  '，', // 中文逗號
  '.', // 英文句號
  '!', // 英文感嘆號
  '?', // 英文問號
  ';', // 英文分號
  ':', // 英文冒號
  ',', // 英文逗號
  ' ', // 空格（英文單詞分隔）
] as const;

/**
 * 換行配置選項
 */
export interface TextWrappingOptions {
  /** 最大寬度（像素） */
  maxWidth: number;
  /** 字體字符串，格式: "italic bold 16px Arial" */
  font: string;
  /** 是否允許強制斷行（當無法找到合適斷點時） */
  allowForcedBreak?: boolean;
  /** 自定義斷點字符（會追加到默認斷點列表） */
  customBreakPoints?: string[];
}

/**
 * 使用Canvas API測量文本實際渲染寬度並智能換行
 *
 * @param text 要換行的文本
 * @param options 換行配置選項
 * @returns 換行後的字符串數組
 *
 * @example
 * ```typescript
 * const lines = wrapTextByActualWidth(
 *   "這是一段很長的文本，需要自動換行處理。This is a long text that needs wrapping.",
 *   {
 *     maxWidth: 600,
 *     font: "normal 400 32px 'Noto Sans TC'"
 *   }
 * );
 * // 返回: ["這是一段很長的文本，", "需要自動換行處理。", "This is a long text that", "needs wrapping."]
 * ```
 */
export function wrapTextByActualWidth(
  text: string,
  options: TextWrappingOptions
): string[] {
  const {
    maxWidth,
    font,
    allowForcedBreak = true,
    customBreakPoints = [],
  } = options;

  // 創建臨時Canvas用於測量
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('無法創建Canvas 2D context，返回原始文本');
    return [text];
  }

  // 設置字體
  ctx.font = font;

  // 合併斷點列表
  const breakPoints = [...BREAK_POINTS, ...customBreakPoints];

  // 先按手動換行符分割（保留用戶的換行意圖）
  const paragraphs = text.split('\n');
  const wrappedLines: string[] = [];

  paragraphs.forEach(paragraph => {
    // 如果是空行，保留它
    if (paragraph.trim() === '') {
      wrappedLines.push('');
      return;
    }

    // 測量整段文字寬度
    const metrics = ctx.measureText(paragraph);

    // 如果不超過最大寬度，直接添加
    if (metrics.width <= maxWidth) {
      wrappedLines.push(paragraph);
      return;
    }

    // 需要換行，執行智能分割
    let currentLine = '';
    const chars = paragraph.split('');

    for (let i = 0; i < chars.length; i++) {
      const testLine = currentLine + chars[i];
      const testMetrics = ctx.measureText(testLine);

      if (testMetrics.width > maxWidth && currentLine.length > 0) {
        // 超過寬度，需要換行
        // 嘗試找到最佳斷點
        const breakResult = findBestBreakPoint(currentLine, breakPoints);

        if (breakResult.index > 0) {
          // 在斷點處分割
          wrappedLines.push(currentLine.substring(0, breakResult.index + 1));
          // 下一行的起始文本 = 斷點後的內容 + 當前字符
          const remaining = currentLine.substring(breakResult.index + 1).trimStart();
          currentLine = remaining + chars[i];
        } else if (allowForcedBreak) {
          // 沒有合適斷點，強制在當前位置斷開
          wrappedLines.push(currentLine);
          currentLine = chars[i];
        } else {
          // 不允許強制斷行，繼續添加（可能超出寬度）
          currentLine = testLine;
        }
      } else {
        currentLine = testLine;
      }
    }

    // 添加最後一行
    if (currentLine.length > 0) {
      wrappedLines.push(currentLine);
    }
  });

  return wrappedLines;
}

/**
 * 在文本中查找最佳斷點位置
 *
 * @param text 要查找的文本
 * @param breakPoints 斷點字符列表（按優先級排序）
 * @returns 斷點信息 { index: 斷點字符的索引, char: 斷點字符 }
 */
function findBestBreakPoint(
  text: string,
  breakPoints: readonly string[]
): { index: number; char: string | null } {
  // 從高優先級到低優先級遍歷斷點
  for (const breakChar of breakPoints) {
    const index = text.lastIndexOf(breakChar);
    if (index > 0) {
      // 找到斷點（確保不是在開頭，避免產生空行）
      return { index, char: breakChar };
    }
  }

  // 沒有找到合適斷點
  return { index: -1, char: null };
}

/**
 * 構建字體字符串（用於Canvas font屬性）
 *
 * @param options 字體配置
 * @returns 格式化的字體字符串
 *
 * @example
 * ```typescript
 * const fontString = buildFontString({
 *   fontSize: 32,
 *   fontFamily: 'Noto Sans TC',
 *   fontWeight: '700',
 *   fontStyle: 'italic'
 * });
 * // 返回: "italic 700 32px 'Noto Sans TC'"
 * ```
 */
export function buildFontString(options: {
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number;
  fontStyle?: string;
}): string {
  const {
    fontSize,
    fontFamily,
    fontWeight = '400',
    fontStyle = 'normal',
  } = options;

  // 字體名稱如果包含空格需要加引號
  const quotedFamily = fontFamily.includes(' ')
    ? `"${fontFamily}"`
    : fontFamily;

  return `${fontStyle} ${fontWeight} ${fontSize}px ${quotedFamily}`;
}

/**
 * 測量文本實際渲染寬度
 *
 * @param text 要測量的文本
 * @param font 字體字符串
 * @returns 文本寬度（像素）
 *
 * @example
 * ```typescript
 * const width = measureTextWidth(
 *   "測試文本",
 *   "normal 400 16px 'Noto Sans TC'"
 * );
 * ```
 */
export function measureTextWidth(text: string, font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('無法創建Canvas 2D context');
    return 0;
  }

  ctx.font = font;
  const metrics = ctx.measureText(text);
  return metrics.width;
}

/**
 * 批量測量多個文本的寬度
 *
 * @param texts 文本數組
 * @param font 字體字符串
 * @returns 寬度數組（與texts順序一致）
 */
export function measureMultipleTexts(texts: string[], font: string): number[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('無法創建Canvas 2D context');
    return texts.map(() => 0);
  }

  ctx.font = font;
  return texts.map(text => ctx.measureText(text).width);
}

/**
 * 預覽換行結果（用於開發調試）
 * 將換行後的文本數組轉換為可視化字符串
 *
 * @param lines 換行後的行數組
 * @returns 格式化的字符串
 *
 * @example
 * ```typescript
 * const lines = ["第一行", "第二行", "第三行"];
 * console.log(previewWrappedLines(lines));
 * // 輸出:
 * // Line 1: 第一行
 * // Line 2: 第二行
 * // Line 3: 第三行
 * ```
 */
export function previewWrappedLines(lines: string[]): string {
  return lines
    .map((line, index) => `Line ${index + 1}: ${line}`)
    .join('\n');
}

/**
 * 將換行後的行數組轉換為單個字符串（用於顯示）
 *
 * @param lines 換行後的行數組
 * @returns 用換行符連接的字符串
 */
export function joinWrappedLines(lines: string[]): string {
  return lines.join('\n');
}
