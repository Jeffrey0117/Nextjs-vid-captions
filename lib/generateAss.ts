import { SubtitleSegment } from '../app/stores/subtitle-store';

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
export function generateAssSubtitle(segments: SubtitleSegment[]): string {
  // ASS 檔頭 - 添加 Hinting 和抗鋸齒優化
  const header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  // 為每個字幕片段生成樣式
  const styles = segments.map((seg, index) => {
    const style = seg.style;
    
    // 字體回退策略: 根據平台選擇最佳字體
    // Windows: Microsoft YaHei → Arial → SimHei
    // Mac: PingFang TC → Helvetica → Arial
    // Linux: Noto Sans CJK TC → DejaVu Sans → Arial
    const getFontWithFallback = (fontFamily: string): string => {
      // 如果已經是常見字體,直接使用
      const commonFonts = ['Arial', 'Helvetica', 'Microsoft YaHei', 'PingFang TC', 'SimHei', 'Noto Sans CJK TC'];
      if (commonFonts.includes(fontFamily)) {
        return fontFamily;
      }
      
      // 預設回退到 Arial (最通用的字體)
      return 'Arial';
    };
    
    const fontName = getFontWithFallback(style.fontFamily);
    
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
    
    // 對齊方式: 1-3=底部左中右, 4-6=中央左中右, 7-9=頂部左中右
    // 使用中間對齊 (2) 因為我們用 positionY 控制位置
    const alignment = 2;
    
    // Bold: 0=normal, -1=bold
    const bold = style.fontWeight === 'bold' ? -1 : 0;
    
    // Italic: 0=normal, -1=italic
    const italic = style.fontStyle === 'italic' ? -1 : 0;
    
    // Underline/Strikeout: 0=off, -1=on
    const underline = style.textDecoration === 'underline' ? -1 : 0;
    const strikeout = style.textDecoration === 'line-through' ? -1 : 0;

    // Shadow 距離 (ASS 只支援一個 shadow 參數,計算對角線距離)
    // 使用勾股定理計算 X 和 Y 偏移的合成距離,這樣可以更準確地模擬 CSS 陰影效果
    const shadowDistance = style.enableShadow
      ? Math.sqrt(
          style.shadowOffsetX ** 2 +
          style.shadowOffsetY ** 2
        )
      : 0;
    
    // ASS 字體大小應該包含 scale 的效果,才能與網頁預覽一致
    // 網頁上實際顯示大小 = fontSize * scale
    const actualFontSize = Math.round(style.fontSize * style.scale);
    
    // ScaleX/ScaleY 設為 100 (不再額外縮放,因為已經算在字體大小裡)
    const scale = 100;

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

    return `Style: Style${index},${fontName},${actualFontSize},${primaryColor},&H000000FF,${outlineColor},${backgroundColor},${bold},${italic},${underline},${strikeout},${scale},${scale},0,0,${borderStyle},${outline},${shadowDistance},${alignment},10,10,10,1`;
  }).join('\n');

  // 事件 (字幕內容)
  const events = `

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
` + segments.map((seg, index) => {
    const start = formatAssTime(seg.startTime);
    const end = formatAssTime(seg.endTime);
    const text = (seg.translatedText || seg.text).replace(/\n/g, '\\N');
    
    // 計算位置 (1920x1080 為基準)
    // positionX: 0-100% (水平位置,可能超出範圍 -50 到 150)
    // positionY: 0-100% (垂直位置,可能超出範圍 -50 到 150)
    const posX = Math.round(1920 * (seg.style.positionX / 100));
    const posY = Math.round(1080 * (seg.style.positionY / 100));
    
    // 使用 \pos 標籤精確定位,支援 X/Y 雙軸
    const posTag = `{\\pos(${posX},${posY})}`;
    
    return `Dialogue: 0,${start},${end},Style${index},,0,0,0,,${posTag}${text}`;
  }).join('\n');

  return header + styles + events;
}

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

/**
 * 格式化時間為 ASS 格式
 * @param seconds - 秒數
 * @returns H:MM:SS.CC 格式
 */
function formatAssTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}