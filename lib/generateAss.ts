import { SubtitleSegment } from '../app/stores/subtitle-store';

/**
 * 生成 ASS (Advanced SubStation Alpha) 字幕檔
 * ASS 格式支援豐富的字幕樣式,適合用於 FFmpeg 燒錄
 */
export function generateAssSubtitle(segments: SubtitleSegment[]): string {
  // ASS 檔頭
  const header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  // 為每個字幕片段生成樣式
  const styles = segments.map((seg, index) => {
    const style = seg.style;
    
    // ASS 顏色格式: &HAABBGGRR (alpha, blue, green, red)
    const primaryColor = hexToAssColor(style.color, style.opacity);
    const outlineColor = hexToAssColor(style.outlineColor, 1);
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
    
    // Outline 寬度
    const outline = style.outlineWidth;
    
    return `Style: Style${index},${style.fontFamily},${style.fontSize},${primaryColor},&H000000FF,${outlineColor},${backgroundColor},${bold},${italic},${underline},${strikeout},100,100,0,0,1,${outline},0,${alignment},10,10,10,1`;
  }).join('\n');

  // 事件 (字幕內容)
  const events = `

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
` + segments.map((seg, index) => {
    const start = formatAssTime(seg.startTime);
    const end = formatAssTime(seg.endTime);
    const text = (seg.translatedText || seg.text).replace(/\n/g, '\\N');
    
    // 計算垂直邊距 (positionY 0-100% -> MarginV)
    // 1080p 為基準,positionY 是從頂部開始的百分比
    const marginV = Math.round(1080 * (seg.style.positionY / 100));
    
    // 使用 \pos 標籤精確定位
    const posTag = `{\\pos(960,${marginV})}`;
    
    return `Dialogue: 0,${start},${end},Style${index},,0,0,0,,${posTag}${text}`;
  }).join('\n');

  return header + styles + events;
}

/**
 * 將 HEX 顏色轉換為 ASS 格式
 * @param hex - #RRGGBB 格式
 * @param opacity - 0-1
 * @returns &HAABBGGRR 格式
 */
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