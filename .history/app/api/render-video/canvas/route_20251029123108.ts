import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 動態導入 canvas 以避免編譯時錯誤
let canvasLib: any = null;
try {
  canvasLib = require('canvas');
} catch (error) {
  console.warn('Canvas library not available, falling back to alternative method');
}

interface SubtitleSegment {
  startTime: number;
  endTime: number;
  text: string;
  style: {
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    fontStyle: string;
    textDecoration: string;
    color: string;
    opacity: number;
    backgroundColor: string;
    position: string;
    enableShadow: boolean;
    shadowColor: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    positionX: number;
    positionY: number;
    maxWidth: number;
    scale: number;
  };
}

// 渲染字幕到 Canvas 並生成 PNG
async function renderSubtitleToCanvas(
  segment: SubtitleSegment, 
  width: number, 
  height: number
): Promise<Buffer> {
  if (!canvasLib) {
    throw new Error('Canvas library not available');
  }

  const { createCanvas } = canvasLib;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 設置透明背景
  ctx.clearRect(0, 0, width, height);

  const { text, style } = segment;
  
  // 設置字體
  const fontWeight = style.fontWeight === 'bold' ? 'bold' : 'normal';
  const fontStyle = style.fontStyle === 'italic' ? 'italic' : 'normal';
  ctx.font = `${fontStyle} ${fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  
  // 設置文字顏色和透明度
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.opacity;
  
  // 計算文字位置
  const x = (style.positionX / 100) * width;
  const y = (style.positionY / 100) * height;
  
  // 設置文字對齊
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 處理陰影
  if (style.enableShadow) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowOffsetX = style.shadowOffsetX;
    ctx.shadowOffsetY = style.shadowOffsetY;
    ctx.shadowBlur = style.shadowBlur;
  }
  
  // 處理背景色
  if (style.backgroundColor !== 'transparent') {
    const textMetrics = ctx.measureText(text);
    const padding = 16;
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(
      x - textMetrics.width / 2 - padding,
      y - style.fontSize / 2 - padding / 2,
      textMetrics.width + padding * 2,
      style.fontSize + padding
    );
    ctx.fillStyle = style.color; // 重設文字顏色
  }
  
  // 繪製文字
  const lines = text.split('\n');
  const lineHeight = style.fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + (index + 0.5) * lineHeight);
  });
  
  return canvas.toBuffer('image/png');
}

// 為每一秒生成字幕幀
async function generateSubtitleFrames(
  subtitles: SubtitleSegment[],
  width: number,
  height: number,
  duration: number,
  fps: number,
  outputDir: string
): Promise<number> {
  const totalFrames = Math.ceil(duration * fps);
  let framesGenerated = 0;
  
  for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
    const currentTime = frameNumber / fps;
    
    // 找到當前時間應該顯示的字幕
    const activeSubtitle = subtitles.find(sub => 
      currentTime >= sub.startTime && currentTime <= sub.endTime
    );
    
    const framePath = path.join(outputDir, `frame_${frameNumber.toString().padStart(8, '0')}.png`);
    
    if (activeSubtitle) {
      try {
        const frameBuffer = await renderSubtitleToCanvas(activeSubtitle, width, height);
        await fs.promises.writeFile(framePath, frameBuffer);
        framesGenerated++;
      } catch (error) {
        console.error(`Error rendering frame ${frameNumber}:`, error);
        // 創建空的透明幀
        const transparentPng = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8l6wAAAABJRU5ErkJggg==',
          'base64'
        );
        await fs.promises.writeFile(framePath, transparentPng);
      }
    } else {
      // 創建空的透明幀
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8l6wAAAABJRU5ErkJggg==',
        'base64'
      );
      await fs.promises.writeFile(framePath, transparentPng);
    }
    
    // 進度報告
    if (frameNumber % Math.ceil(totalFrames / 20) === 0) {
      console.log(`Canvas rendering progress: ${Math.round((frameNumber / totalFrames) * 100)}%`);
    }
  }
  
  return framesGenerated;
}