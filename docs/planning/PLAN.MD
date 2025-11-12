# 字幕編輯器 MVP 規劃

> 快速輕量的影片字幕編輯器 - 專注核心功能,快速上線!

## 🎯 MVP 目標

打造一個**極簡但完整**的字幕編輯器,讓使用者能快速上傳影片、生成字幕、編輯樣式。

**開發時間**: 1-2 週  
**技術**: 基於現有程式碼擴充,無需額外套件

---

## ✅ 現有可用資源 (直接複用!)

### 已實作功能
- ✅ **影片上傳**: [`app/page.tsx`](app/page.tsx:54-75) - 檔案上傳邏輯完整
- ✅ **影片播放器**: [`app/components/VideoPlayer.tsx`](app/components/VideoPlayer.tsx:1) - 可直接擴充
- ✅ **字幕顯示**: [`app/components/SubtitleBox.tsx`](app/components/SubtitleBox.tsx:1) - 需加入樣式 props
- ✅ **SRT 解析**: [`lib/parseSrt.ts`](lib/parseSrt.ts:1) - 完整的 parser
- ✅ **AI 字幕生成**: [`app/api/transcribe/route.ts`](app/api/transcribe/route.ts:10-72) - Whisper 整合
- ✅ **型別定義**: [`lib/types.ts`](lib/types.ts:1) - 需擴充 style 欄位

---

## 🎯 MVP 三大核心功能 (只做這些!)

### 1. 調整字幕大小 ⭐
- 簡單的 `<input type="range">` 滑桿
- 範圍: 16px - 48px
- 即時更新到影片上的字幕

### 2. 更改字幕顏色 ⭐
- 4-6 個預設顏色按鈕
  - 白色 `#FFFFFF`
  - 黃色 `#FDE047`
  - 紅色 `#EF4444`
  - 藍色 `#3B82F6`
  - 綠色 `#22C55E`
- 點擊按鈕即可切換顏色

### 3. 拖曳字幕位置 ⭐
- 直接在影片上用滑鼠拖曳字幕
- 儲存為百分比座標 (x%, y%)
- 使用原生 `onMouseDown/Move/Up` 事件

### 4. AI 生成中文字幕 (已有,需微調)
- 加入 API Key 輸入框
- 儲存到 `localStorage`
- 將 Key 傳給 `/api/transcribe`

---

## 🎨 MVP UI 設計 (極簡版)

### 頁面佈局
```
┌───────────────────────────────────────────┐
│  字幕編輯器         [API Key] [下載SRT]   │
├───────────────────────────────────────────┤
│                                            │
│         影片 + 可拖曳的字幕覆蓋層           │
│            [播放控制]                      │
│                                            │
├───────────────────────────────────────────┤
│  樣式控制                                  │
│  大小: [====●====] 24px                   │
│  顏色: [⚪][🟡][🔴][🔵][🟢]               │
│  💡 拖曳影片上的字幕可調整位置             │
├───────────────────────────────────────────┤
│  字幕列表                                  │
│  ● 00:01 - 00:03  這是第一句字幕          │
│  ○ 00:04 - 00:06  這是第二句字幕          │
└───────────────────────────────────────────┘
```

### 設計原則
- **極簡**: 只有必要的控制項
- **直覺**: 看到就會用,無需說明
- **快速**: 3 分鐘完成一個影片的字幕編輯

---

## 🛠 技術架構 (全用現有!)

### 技術棧
- Next.js 15 + React 19 + TypeScript ✅
- Tailwind CSS ✅
- **零額外套件!** 全部用原生實作

### 檔案結構
```
/app
  /editor              ← 新建編輯器頁面
    page.tsx           ← 主編輯器 (複製 app/page.tsx 改造)
    
  /components
    VideoPlayer.tsx    ← 複用並擴充
    SubtitleBox.tsx    ← 複用,加入 style props
    StylePanel.tsx     ← 新建樣式控制面板
    SubtitleList.tsx   ← 新建字幕列表
    
  /api
    /transcribe
      route.ts         ← 現有,加入 API Key 參數支援

/lib
  parseSrt.ts          ← 複用現有
  exportSrt.ts         ← 新建 (反向生成 SRT)
  types.ts             ← 擴充 SubtitleStyle 介面
```

---

## 📊 資料結構 (簡化版)

```typescript
// 擴充現有的 Subtitle interface
interface Subtitle {
  id: string;
  startTime: number;      // 毫秒
  endTime: number;        // 毫秒
  text: string;           // 字幕文字
  style?: SubtitleStyle;  // 新增: 樣式設定 (選填)
}

// MVP 樣式 - 只有三個屬性!
interface SubtitleStyle {
  fontSize: number;        // 字體大小 (px), 預設 24
  color: string;           // 文字顏色 (hex), 預設 #FFFFFF
  position: {              // 位置 (百分比)
    x: number;             // 0-100, 預設 50 (水平置中)
    y: number;             // 0-100, 預設 85 (底部)
  };
}

// 預設樣式
const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 24,
  color: '#FFFFFF',
  position: { x: 50, y: 85 }
};
```

---

## 🚀 MVP 開發步驟 (8天完成!)

### Day 1: 建立編輯器頁面
- [ ] 複製 `app/page.tsx` 到 `app/editor/page.tsx`
- [ ] 調整 layout 為左右或上下佈局
- [ ] 保留影片上傳功能

### Day 2: API Key 整合
- [ ] 加入 API Key 輸入框元件
- [ ] 儲存到 `localStorage`
- [ ] 修改 `handleFileUpload` 傳送 API Key

### Day 3-4: 樣式控制面板
- [ ] 建立 `StylePanel.tsx`
- [ ] 實作字體大小滑桿
  ```tsx
  <input 
    type="range" 
    min="16" 
    max="48" 
    value={fontSize}
    onChange={(e) => setFontSize(Number(e.target.value))}
  />
  ```
- [ ] 實作顏色選擇按鈕
  ```tsx
  const colors = ['#FFFFFF', '#FDE047', '#EF4444', '#3B82F6', '#22C55E'];
  {colors.map(c => <button onClick={() => setColor(c)}>)}
  ```
- [ ] 即時更新 `currentSubtitle.style`

### Day 5: 修改 SubtitleBox 支援樣式
- [ ] 修改 `SubtitleBox.tsx` 接收 `style` prop
- [ ] 套用 `fontSize` 和 `color`
- [ ] 套用 `position` (absolute positioning)
  ```tsx
  style={{
    fontSize: `${subtitle.style?.fontSize || 24}px`,
    color: subtitle.style?.color || '#FFFFFF',
    left: `${subtitle.style?.position.x || 50}%`,
    top: `${subtitle.style?.position.y || 85}%`,
    transform: 'translate(-50%, -50%)'
  }}
  ```

### Day 6: 拖曳功能實作
- [ ] 在 `SubtitleBox` 加入拖曳邏輯
  ```tsx
  const handleMouseDown = (e) => {
    setIsDragging(true);
    // 記錄起始位置
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    // 計算新位置 (百分比)
    const newX = (e.clientX / videoWidth) * 100;
    const newY = (e.clientY / videoHeight) * 100;
    // 更新 subtitle.style.position
  };
  ```
- [ ] 測試拖曳流暢度

### Day 7: 匯出功能
- [ ] 建立 `lib/exportSrt.ts`
  ```typescript
  export function generateSrt(subtitles: Subtitle[]): string {
    return subtitles.map((sub, i) => {
      return `${i + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`;
    }).join('\n');
  }
  ```
- [ ] 加入下載 SRT 按鈕
- [ ] 選配: 下載包含樣式的 JSON

### Day 8: 測試與優化
- [ ] 測試整個流程 (上傳 → 生成 → 編輯 → 下載)
- [ ] UI/UX 微調
- [ ] 加入 loading 狀態
- [ ] 錯誤處理完善
- [ ] 部署! 🚀

---

## 📤 匯出功能

### 標準 SRT 格式
```srt
1
00:00:01,000 --> 00:00:03,500
這是第一句字幕

2
00:00:04,000 --> 00:00:06,500
這是第二句字幕
```

### JSON 格式 (含樣式,選配)
```json
{
  "videoUrl": "/temp/video_123.mp4",
  "subtitles": [
    {
      "id": "1",
      "startTime": 1000,
      "endTime": 3500,
      "text": "這是第一句字幕",
      "style": {
        "fontSize": 28,
        "color": "#FDE047",
        "position": { "x": 50, "y": 80 }
      }
    }
  ]
}
```

---

## 🎯 MVP 成功標準

- ✅ 使用者能上傳影片
- ✅ AI 自動生成中文字幕
- ✅ 能調整字幕大小 (16-48px)
- ✅ 能選擇 5 種預設顏色
- ✅ 能拖曳字幕到任意位置
- ✅ 能下載標準 SRT 檔案
- ✅ **整個流程在 3 分鐘內完成**

---

## 💡 實作技巧

### 1. 複用現有程式碼
```tsx
// 直接從 app/page.tsx 複製
const [videoUrl, setVideoUrl] = useState<string>("");
const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
const handleFileChange = async (e) => { /* 已有的邏輯 */ };
```

### 2. 簡單的拖曳實作
```tsx
// 不需要任何套件!
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
const [isDragging, setIsDragging] = useState(false);

<div
  draggable
  onMouseDown={(e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }}
  onMouseMove={(e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    // 更新位置
  }}
/>
```

### 3. localStorage 管理
```typescript
// 儲存 API Key
localStorage.setItem('whisper_api_key', apiKey);

// 讀取 API Key
const savedKey = localStorage.getItem('whisper_api_key');
```

---

## 🔮 未來可加功能 (v2.0)

等 MVP 上線後,如果有需求再加:

- 時間軸編輯 (拖曳調整字幕時間)
- 文字編輯功能
- 背景顏色/透明度設定
- 更多字型選擇
- 字幕動畫效果 (淡入淡出)
- 批次套用樣式
- 字幕翻譯功能

---

## 🚀 開始開發!

### 第一步
```bash
# 確保開發伺服器正在運行
npm run dev

# 開始建立編輯器頁面
# 複製 app/page.tsx 到 app/editor/page.tsx
```

### 快速測試
1. 上傳一個短影片 (10-30 秒)
2. 生成字幕
3. 調整樣式
4. 下載 SRT
5. **整個流程應在 3 分鐘內完成!**

---

**最後更新**: 2025-10-24  
**版本**: MVP 1.0  
**狀態**: 準備開發 🚀  
**預計完成**: 8 天  
**核心理念**: 簡單、快速、實用