# 專案卡片點擊跳轉到 editor-pro 並載入影片功能規劃

## 需求分析

用戶在 `/editor` 頁面上傳影片並完成字幕識別/翻譯後,點擊專案卡片應該:
1. 跳轉到 `/editor-pro` 頁面
2. 自動載入該專案的影片
3. 自動載入該專案的字幕資料

## 現有架構分析

### 1. `/editor` 頁面 (app/editor/page.tsx)
- 使用 localStorage 儲存專案列表 (`subtitle-projects`)
- 專案資料結構:
  ```typescript
  {
    id: string;
    name: string;
    videoUrl: string;
    thumbnail: string;
    status: 'idle' | 'uploading' | 'transcribing' | 'translating' | 'ready' | 'error';
    progress: number;
    srtContent?: string;
    createdAt: number;
  }
  ```
- 目前專案卡片只有刪除和批量編輯功能,沒有點擊跳轉

### 2. `/editor-pro` 頁面 (app/editor-pro/page.tsx)
- 使用 `useSubtitleStore()` 管理字幕狀態
- 影片載入方式:用戶手動上傳或從 MediaPanel 選擇
- 沒有從 URL 參數載入專案的功能

### 3. subtitle-store (app/stores/subtitle-store.ts)
- 管理字幕軌道、影片 URL、選中狀態等
- 提供 `loadVideo()` 方法載入影片
- 提供 `addSegments()` 方法批量添加字幕

## 實現方案

### 步驟 1: 修改專案卡片添加點擊事件
**檔案**: app/editor/page.tsx

在專案卡片的 `onClick` 事件中:
```typescript
const handleProjectClick = (project: Project) => {
  if (project.status !== 'ready') return; // 只有 ready 狀態才能編輯
  
  // 儲存當前專案 ID 到 localStorage
  localStorage.setItem('current-editing-project', project.id);
  
  // 跳轉到 editor-pro
  router.push(`/editor-pro?projectId=${project.id}`);
};
```

### 步驟 2: 修改 editor-pro 頁面支援 URL 參數載入
**檔案**: app/editor-pro/page.tsx

添加 URL 參數檢測和自動載入邏輯:
```typescript
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get('projectId');
  
  if (projectId) {
    loadProjectFromLocalStorage(projectId);
  }
}, []);

const loadProjectFromLocalStorage = (projectId: string) => {
  const projectsData = localStorage.getItem('subtitle-projects');
  if (!projectsData) return;
  
  const projects = JSON.parse(projectsData);
  const project = projects.find((p: any) => p.id === projectId);
  
  if (!project || project.status !== 'ready') return;
  
  // 1. 載入影片
  loadVideo(project.videoUrl);
  
  // 2. 解析 SRT 字幕
  if (project.srtContent) {
    const parsedSegments = parseSrt(project.srtContent);
    
    // 3. 清空現有字幕並添加新字幕
    // 使用 subtitle-store 的方法
    const store = useSubtitleStore.getState();
    store.tracks[0].segments = []; // 清空
    parsedSegments.forEach(seg => {
      store.addSegment(seg.start, seg.end, seg.text);
    });
  }
};
```

### 步驟 3: 優化 subtitle-store 添加批量載入方法
**檔案**: app/stores/subtitle-store.ts

添加新方法:
```typescript
loadProjectSegments: (segments: Array<{start: number; end: number; text: string}>) => {
  set((state) => {
    // 清空第一軌道的所有字幕
    if (state.tracks[0]) {
      state.tracks[0].segments = [];
    }
    
    // 批量添加字幕
    segments.forEach(seg => {
      const id = Math.random().toString(36).substring(7);
      state.tracks[0].segments.push({
        id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        // 使用全域樣式
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        color: state.color,
        backgroundColor: state.backgroundColor,
        // ... 其他樣式屬性
      });
    });
  });
}
```

## 修改檔案清單

### 1. app/editor/page.tsx
- [ ] 添加 `useRouter()` hook
- [ ] 修改專案卡片 onClick 事件
- [ ] 添加 `handleProjectClick()` 函數
- [ ] 只有 status='ready' 的專案才能點擊

### 2. app/editor-pro/page.tsx
- [ ] 添加 `useEffect` 檢測 URL 參數
- [ ] 添加 `loadProjectFromLocalStorage()` 函數
- [ ] 呼叫 `parseSrt()` 解析字幕
- [ ] 呼叫 store 的 `loadProjectSegments()` 方法
- [ ] 呼叫 store 的 `loadVideo()` 方法

### 3. app/stores/subtitle-store.ts
- [ ] 添加 `loadProjectSegments()` 方法
- [ ] 確保清空舊字幕再載入新字幕
- [ ] 保持字幕樣式一致性

## 技術細節

### URL 參數格式
```
/editor-pro?projectId=abc123
```

### localStorage 資料流
```
/editor 頁面
  ↓ 儲存專案到 localStorage (subtitle-projects)
  ↓ 點擊專案卡片
  ↓ 跳轉到 /editor-pro?projectId=abc123
  ↓ editor-pro 讀取 localStorage
  ↓ 載入影片和字幕到 subtitle-store
  ↓ 使用者開始編輯
```

### parseSrt() 函數使用
```typescript
import { parseSrt } from '@/lib/parseSrt';

const segments = parseSrt(project.srtContent);
// 返回: Array<{ start: number; end: number; text: string }>
```

## 使用者體驗流程

1. 使用者在 `/editor` 上傳影片
2. 系統自動字幕識別 → 翻譯中文
3. 專案卡片顯示「已完成」狀態
4. **使用者點擊專案卡片**
5. **跳轉到 `/editor-pro` 並自動載入影片和字幕**
6. 使用者在專業編輯器中調整字幕
7. 輸出最終影片

## 錯誤處理

- [ ] 專案不存在時顯示錯誤訊息
- [ ] 專案 status 不是 'ready' 時不允許點擊
- [ ] 影片 URL 失效時顯示錯誤
- [ ] SRT 解析失敗時顯示錯誤

## 後續優化

- [ ] 添加載入動畫 (Loading spinner)
- [ ] 添加麵包屑導航 (返回專案列表)
- [ ] 支援保存編輯後的字幕回 localStorage
- [ ] 支援多專案切換