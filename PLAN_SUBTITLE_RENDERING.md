# 字幕渲染與輸出功能規劃

## 🎯 需求分析

### 用戶需求
1. **在影片上即時顯示字幕** - 預覽時看到字幕效果
2. **字幕編輯功能** - 參考 OpenCut 右側編輯區
3. **字幕樣式設定** - 字型、大小、顏色、位置等
4. **輸出帶字幕的影片** - 燒錄字幕到影片檔

## 📋 功能拆解

### Phase 1: 字幕即時渲染 (影片上顯示)
**目標**: 在影片播放時,於影片上方疊加字幕

#### 實作方式
- 使用 HTML `<div>` 疊加在 `<video>` 上方
- 根據 `currentTime` 顯示對應字幕
- 支援字幕樣式 (字型、大小、顏色、位置)

#### 技術細節
```tsx
<div className="relative">
  <video ref={videoRef} src={videoUrl} />
  <div className="absolute bottom-0 w-full text-center">
    <span style={{
      fontSize: `${currentSubtitle.fontSize}px`,
      color: currentSubtitle.color,
      // ... 其他樣式
    }}>
      {currentSubtitle.text}
    </span>
  </div>
</div>
```

#### 優點
- ✅ 簡單易實作
- ✅ 即時預覽
- ✅ 不需要額外依賴

#### 缺點
- ❌ 無法輸出到影片檔 (只是網頁顯示)

---

### Phase 2: 字幕編輯介面
**目標**: 參考 OpenCut 的字幕屬性面板

#### 功能項目
1. **文字編輯**: Textarea 編輯字幕內容
2. **字型選擇**: FontPicker (需要字型庫)
3. **樣式控制**:
   - Bold (粗體)
   - Italic (斜體)
   - Underline (底線)
   - Strike-through (刪除線)
4. **字型大小**: Slider (8-300px)
5. **顏色**: ColorPicker
6. **透明度**: Opacity Slider (0-100%)
7. **背景顏色**: ColorPicker + 透明選項
8. **位置**: Top / Center / Bottom

#### Store 擴充
```typescript
// app/stores/subtitle-store.ts
export interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translatedText?: string;
  style: {
    fontSize: number;        // 16-300
    fontFamily: string;      // 'Inter', 'Arial', etc.
    fontWeight: string;      // 'normal' | 'bold'
    fontStyle: string;       // 'normal' | 'italic'
    textDecoration: string;  // 'none' | 'underline' | 'line-through'
    color: string;           // '#FFFFFF'
    opacity: number;         // 0-1
    backgroundColor: string; // '#000000' | 'transparent'
    position: 'top' | 'center' | 'bottom';
  };
}
```

---

### Phase 3: 影片輸出 (燒錄字幕)
**目標**: 將字幕永久嵌入影片檔

#### 方案 A: FFmpeg.js (瀏覽器端)
**使用 `@ffmpeg/ffmpeg` (已在 OpenCut 中使用)**

##### 優點
- ✅ 純前端,不需要後端
- ✅ OpenCut 已在使用
- ✅ 支援 MP4, WebM 等格式

##### 缺點
- ❌ 需要載入 ~30MB 的 WASM
- ❌ 瀏覽器效能限制
- ❌ 大檔案處理慢

##### 實作流程
```typescript
1. 生成 ASS/SRT 字幕檔
2. 使用 FFmpeg.js 合併:
   ffmpeg.exec([
     '-i', 'video.mp4',
     '-vf', `subtitles=subtitle.ass`,
     '-c:a', 'copy',
     'output.mp4'
   ])
3. 下載輸出檔案
```

---

#### 方案 B: 後端 FFmpeg API (推薦)
**建立 Node.js API 使用系統 FFmpeg**

##### 優點
- ✅ 效能好,速度快
- ✅ 支援大檔案
- ✅ 可使用 GPU 加速
- ✅ 更穩定

##### 缺點
- ❌ 需要安裝 FFmpeg
- ❌ 伺服器處理負擔

##### 實作流程
```typescript
// app/api/burn-subtitles/route.ts
export async function POST(request: Request) {
  const formData = await request.formData();
  const videoFile = formData.get('video');
  const subtitles = JSON.parse(formData.get('subtitles'));
  
  // 1. 儲存影片到臨時檔案
  // 2. 生成 ASS 字幕檔 (支援樣式)
  // 3. 執行 FFmpeg 命令
  const output = await execAsync(`
    ffmpeg -i "${videoPath}" 
           -vf "ass=${assPath}" 
           -c:v libx264 
           -c:a copy 
           "${outputPath}"
  `);
  
  // 4. 回傳輸出影片
  return new Response(outputBuffer);
}
```

---

#### 方案 C: Canvas 錄製 (純前端)
**使用 MediaRecorder API 錄製 Canvas**

##### 優點
- ✅ 純前端
- ✅ 完全控制渲染
- ✅ 不需要 FFmpeg

##### 缺點
- ❌ 效能問題
- ❌ 需要實時播放並錄製
- ❌ 檔案品質可能降低

---

## 🚀 推薦實作順序

### 階段 1: 字幕即時預覽 (2-3 小時)
```
1. [x] 擴充 SubtitleStore 加入 style 屬性
2. [ ] 在影片上方建立字幕疊加層
3. [ ] 根據 currentTime 顯示對應字幕
4. [ ] 套用字幕樣式 (fontSize, color, position)
```

### 階段 2: 字幕編輯面板 (3-4 小時)
```
1. [ ] 建立右側字幕屬性編輯面板
2. [ ] 實作文字編輯 Textarea
3. [ ] 實作樣式控制 (Bold, Italic, Underline)
4. [ ] 實作字型大小 Slider
5. [ ] 實作顏色選擇器
6. [ ] 實作透明度控制
7. [ ] 實作背景顏色設定
8. [ ] 實作位置選擇 (Top/Center/Bottom)
```

### 階段 3: 字幕輸出功能 (4-6 小時)
```
選擇方案 B (後端 FFmpeg)

1. [ ] 安裝 FFmpeg 到系統
2. [ ] 建立 /api/burn-subtitles API
3. [ ] 實作 ASS 字幕檔生成 (支援樣式)
4. [ ] 整合 FFmpeg 燒錄命令
5. [ ] 加入進度條顯示
6. [ ] 完成輸出下載功能
```

---

## 📦 需要的依賴

### 字幕渲染與編輯
```json
{
  "dependencies": {
    "@radix-ui/react-slider": "^1.2.0",    // 已安裝
    "@radix-ui/react-select": "^2.0.0",    // 字型選擇
    "react-colorful": "^5.6.1"              // 顏色選擇器
  }
}
```

### FFmpeg (系統安裝)
```bash
# Windows (使用 Chocolatey)
choco install ffmpeg

# macOS
brew install ffmpeg

# Linux (Ubuntu)
sudo apt install ffmpeg
```

---

## 🎨 UI 設計參考

### 預覽區 (左側)
```
┌─────────────────────────────────┐
│                                 │
│          [影片畫面]             │
│                                 │
│      ┌──────────────┐          │
│      │  字幕顯示區  │          │  ← 疊加層
│      └──────────────┘          │
└─────────────────────────────────┘
```

### 字幕編輯面板 (右側)
```
┌─────────────────────┐
│  字幕屬性            │
├─────────────────────┤
│ 文字內容             │
│ [Textarea]          │
├─────────────────────┤
│ 字型: [Inter ▼]     │
│ 樣式: [B] [I] [U]   │
│ 大小: [━━●─] 32px   │
│ 顏色: [●] #FFFFFF   │
│ 透明: [━━━●] 100%   │
│ 背景: [●] 透明      │
│ 位置: [Bottom ▼]    │
└─────────────────────┘
```

---

## 📝 ASS 字幕格式範例

ASS (Advanced SubStation Alpha) 支援豐富的樣式:

```ass
[Script Info]
Title: Subtitles

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, BackColour, Bold, Italic, Alignment
Style: Default,Arial,32,&H00FFFFFF,&H00000000,0,0,2

[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,0:00:01.00,0:00:05.00,Default,Hello World
Dialogue: 0,0:00:06.00,0:00:10.00,Default,{\b1}Bold Text{\b0}
```

---

## 🔧 技術挑戰

### 1. 字型載入
- 需要提供字型檔案或使用 Google Fonts
- 確保輸出影片也能正確渲染字型

### 2. 中文字幕支援
- 確保字型支援中文字符
- ASS 字幕檔需要 UTF-8 編碼

### 3. FFmpeg 效能
- 長影片處理時間較長
- 需要顯示進度條
- 可考慮背景處理

---

## ✅ 最終交付成果

### 功能清單
- ✅ 影片播放時即時顯示字幕
- ✅ 完整的字幕樣式編輯面板
- ✅ 字型、大小、顏色、位置控制
- ✅ 字幕燒錄到影片功能
- ✅ 支援 MP4 輸出
- ✅ 進度條顯示
- ✅ 下載輸出影片

### API 端點
- `POST /api/burn-subtitles` - 燒錄字幕到影片

### 使用流程
```
1. 上傳影片
2. Whisper 識別字幕
3. 翻譯字幕 (可選)
4. 編輯字幕樣式
5. 即時預覽效果
6. 輸出帶字幕的影片
7. 下載完成檔案
```

---

## 🤔 建議

我建議分階段實作:

1. **先做字幕即時預覽** (最快看到效果)
2. **再做編輯面板** (讓樣式可調整)
3. **最後做輸出功能** (需要安裝 FFmpeg)

這樣可以逐步驗證功能,並在每個階段給用戶反饋。

是否要開始實作 Phase 1: 字幕即時預覽?