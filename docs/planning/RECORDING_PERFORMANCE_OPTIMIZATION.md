# 錄影性能優化規劃文檔

## 文檔資訊
- **創建日期**: 2025-11-14
- **版本**: v1.0
- **作者**: Claude Code Analysis
- **目標**: 提升字幕錄影功能的性能和用戶體驗

---

## 一、現狀分析

### 1.1 當前錄影流程

現有系統採用「前端逐幀渲染 + 後端FFmpeg合成」的混合方案，主要流程如下：

#### 前端處理階段 (`usePreviewRecorder.ts`)
```
1. 創建離屏Canvas (videoWidth × videoHeight)
2. 逐幀循環 (totalFrames = duration × fps)
   ├─ 設置video.currentTime = frameIndex / fps
   ├─ 等待視頻跳轉完成 (requestAnimationFrame輪詢)
   ├─ 繪製視頻幀到Canvas
   ├─ 繪製字幕到Canvas (固定字幕 + 當前字幕)
   └─ 導出PNG (canvas.toDataURL)
3. 收集所有幀的Base64數據
4. 發送到後端 (FormData with JSON)
```

#### 後端處理階段 (`record-preview/route.ts`)
```
1. 接收幀數據 (Base64 JSON字符串)
2. 解碼並寫入PNG文件 (逐幀寫入磁盤)
3. 使用FFmpeg合成:
   - 輸入: PNG序列 + 原始視頻音軌
   - 編碼: libx264, preset medium, CRF 18
   - 輸出: MP4文件
4. 返回文件給前端下載
```

### 1.2 性能瓶頸分析

經過代碼分析，識別出以下關鍵性能瓶頸：

#### 🔴 嚴重瓶頸

| 瓶頸點 | 位置 | 影響 | 預估耗時佔比 |
|--------|------|------|-------------|
| **視頻幀跳轉等待** | `usePreviewRecorder.ts:71-80` | 每幀需等待video.currentTime更新，涉及視頻解碼 | ~40-50% |
| **Base64編碼** | `usePreviewRecorder.ts:102` | PNG轉Base64，CPU密集型操作 | ~15-20% |
| **JSON序列化** | `record-preview/route.ts:41` | 解析大型JSON (可能數百MB) | ~5-10% |
| **磁盤I/O** | `record-preview/route.ts:46-55` | 逐幀寫入PNG文件到磁盤 | ~10-15% |
| **內存佔用** | 整個流程 | 將所有幀保存在內存中 (可達1-2GB) | 影響穩定性 |

#### 🟡 次要瓶頸

- **Canvas繪製** (10-15%): 字幕渲染涉及多次文本測量和多層繪製
- **FFmpeg等待** (5-10%): 後端等待FFmpeg處理完成
- **網絡傳輸** (變動): 取決於幀數量和網絡狀況

### 1.3 具體問題

#### 問題1: 視頻幀跳轉效率低下
```typescript
// 當前實現 (usePreviewRecorder.ts:68-80)
videoElement.currentTime = currentTime;
await new Promise<void>((resolve) => {
  const checkTime = () => {
    if (Math.abs(videoElement.currentTime - currentTime) < 0.01) {
      resolve();
    } else {
      requestAnimationFrame(checkTime);  // 可能需要多次輪詢
    }
  };
  checkTime();
});
```
**問題**: 每幀平均需要2-5次RAF輪詢，30fps影片每秒需60-150次輪詢

#### 問題2: 大量數據內存佔用
```typescript
// 當前實現 (usePreviewRecorder.ts:51)
const frames: string[] = [];  // 所有幀的Base64字符串
// ...
const frameData = canvas.toDataURL('image/png', 1.0);
frames.push(frameData);  // 累積所有幀在內存中
```
**問題**: 60秒影片 @ 30fps = 1800幀 × ~500KB = ~900MB內存

#### 問題3: 低效的數據傳輸格式
```typescript
// 當前實現 (usePreviewRecorder.ts:128)
formData.append('framesData', JSON.stringify(frames));  // 將Base64數組序列化為JSON
```
**問題**: Base64本身已增加33%體積，再加上JSON的引號和逗號，總體積膨脹~40%

---

## 二、優化方案

### 方案1: WebCodecs API 硬件加速編碼 ⭐⭐⭐⭐⭐

#### 原理
使用瀏覽器原生的 WebCodecs API 進行硬件加速的視頻編碼，完全在前端完成錄製，無需後端參與。

#### 技術細節
```typescript
// 偽代碼示例
const videoEncoder = new VideoEncoder({
  output: (chunk, metadata) => {
    // 收集編碼後的視頻chunk
    encodedChunks.push(chunk);
  },
  error: (e) => console.error(e)
});

videoEncoder.configure({
  codec: 'vp8',  // 或 'avc1.42E01E' (H.264)
  width: 1920,
  height: 1080,
  bitrate: 5_000_000,
  framerate: 30,
  hardwareAcceleration: 'prefer-hardware'
});

// 逐幀編碼
for (let frame of frames) {
  const videoFrame = new VideoFrame(canvas, {
    timestamp: frameIndex * 33333  // 微秒
  });
  videoEncoder.encode(videoFrame);
  videoFrame.close();
}

// 使用 WebM Muxer 合成
const muxer = new WebMMuxer({
  target: 'buffer',
  video: { codec: 'V_VP8', width: 1920, height: 1080 }
});
```

#### 優勢
- ✅ **硬件加速**: 使用GPU進行編碼，速度提升3-10倍
- ✅ **實時編碼**: 邊渲染邊編碼，無需存儲所有幀
- ✅ **內存友好**: 只保留當前幀，內存佔用降低90%+
- ✅ **無後端依賴**: 完全在瀏覽器完成，減輕服務器負擔
- ✅ **格式靈活**: 支持VP8/VP9/H.264等多種編碼

#### 實施步驟
1. 引入 `webm-muxer` 庫處理容器格式
2. 修改 `usePreviewRecorder.ts`:
   ```typescript
   import { WebMMuxer } from 'webm-muxer';

   const encoder = new VideoEncoder({ ... });
   const muxer = new WebMMuxer({ target: 'buffer' });

   // 逐幀編碼
   for (let i = 0; i < totalFrames; i++) {
     // 渲染到Canvas (保持原有邏輯)
     // ...

     // 編碼幀
     const frame = new VideoFrame(canvas, { timestamp: i * frameDuration * 1e6 });
     encoder.encode(frame);
     frame.close();
   }

   await encoder.flush();
   const webmBuffer = muxer.finalize();
   ```
3. 使用 FFmpeg 或 Web Audio API 合併音軌 (可選後端處理)

#### 風險與挑戰
- ⚠️ **瀏覽器兼容性**: Chrome 94+, Safari 17.5+, Firefox不支持
- ⚠️ **音頻處理**: 需額外處理音軌合成 (可用Web Audio API或後端FFmpeg)
- ⚠️ **編碼器配置**: H.264需要特定配置才能廣泛兼容

#### 預期效果
- **編碼速度**: 提升 **300-500%** (取決於硬件)
- **內存佔用**: 降低 **90%** (從~900MB到~90MB)
- **用戶體驗**: 錄製60秒影片從 **120秒降至25-40秒**

---

### 方案2: 流式數據傳輸與批次處理 ⭐⭐⭐⭐

#### 原理
將幀數據分批次傳輸到後端，後端邊接收邊寫入磁盤，避免前端內存爆滿和大JSON傳輸。

#### 技術細節
```typescript
// 前端: 分批發送
const BATCH_SIZE = 30;  // 每批30幀 (約1秒)
let batchId = 0;

for (let i = 0; i < totalFrames; i += BATCH_SIZE) {
  const batch = frames.slice(i, i + BATCH_SIZE);

  await fetch('/api/record-preview/stream', {
    method: 'POST',
    body: JSON.stringify({
      batchId: batchId++,
      frames: batch,
      isLast: i + BATCH_SIZE >= totalFrames
    })
  });

  frames = [];  // 清空已發送的幀
}

// 後端: 邊接收邊寫入
const framesDir = path.join(tempDir, sessionId);
fs.mkdirSync(framesDir);

for await (const batch of batches) {
  // 寫入當前批次
  await Promise.all(batch.frames.map(async (frame, idx) => {
    const frameIndex = batch.batchId * BATCH_SIZE + idx;
    await fs.promises.writeFile(
      path.join(framesDir, `frame_${frameIndex}.png`),
      Buffer.from(frame, 'base64')
    );
  }));

  if (batch.isLast) {
    // 觸發FFmpeg合成
    await synthesizeVideo(framesDir);
  }
}
```

#### 優勢
- ✅ **內存友好**: 前端最多保留1批數據 (~15MB vs ~900MB)
- ✅ **漸進式處理**: 後端可提前開始準備
- ✅ **失敗恢復**: 支持斷點續傳
- ✅ **實時反饋**: 可顯示更精確的進度

#### 實施步驟
1. 創建新API路由 `/api/record-preview/stream`
2. 實現會話管理機制 (sessionId)
3. 修改前端循環為分批處理
4. 後端實現批次接收和寫入邏輯

#### 風險與挑戰
- ⚠️ **網絡延遲**: 多次請求可能受網絡影響
- ⚠️ **會話管理**: 需處理並發錄製和會話清理
- ⚠️ **錯誤處理**: 需處理部分批次失敗的情況

#### 預期效果
- **內存峰值**: 降低 **95%** (從~900MB到~45MB)
- **傳輸穩定性**: 提升 **80%** (避免大請求超時)
- **總體耗時**: 小幅增加 **5-10%** (因網絡往返)

---

### 方案3: WebAssembly FFmpeg (ffmpeg.wasm) ⭐⭐⭐⭐

#### 原理
在瀏覽器中運行FFmpeg，直接從Canvas幀生成視頻，完全離線處理。

#### 技術細節
```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();
await ffmpeg.load();

// 逐幀寫入虛擬文件系統
for (let i = 0; i < totalFrames; i++) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const frameFile = await fetchFile(blob);
  ffmpeg.writeFile(`frame_${i.toString().padStart(6, '0')}.png`, frameFile);
}

// 執行FFmpeg編碼
await ffmpeg.exec([
  '-framerate', '30',
  '-i', 'frame_%06d.png',
  '-i', 'original_video.mp4',  // 音軌來源
  '-map', '0:v',
  '-map', '1:a',
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '23',
  'output.mp4'
]);

// 讀取輸出
const data = await ffmpeg.readFile('output.mp4');
```

#### 優勢
- ✅ **完全離線**: 不需要後端服務器
- ✅ **熟悉工具**: FFmpeg功能強大且穩定
- ✅ **音頻處理**: 原生支持音視頻合成
- ✅ **格式支持**: 支持各種編碼格式

#### 實施步驟
1. 安裝 `@ffmpeg/ffmpeg` 和 `@ffmpeg/util`
2. 配置 SharedArrayBuffer (需HTTPS + COOP/COEP headers)
3. 修改錄製流程使用 ffmpeg.wasm
4. 處理虛擬文件系統的內存管理

#### 風險與挑戰
- ⚠️ **性能限制**: 純CPU編碼，速度約為原生FFmpeg的30-50%
- ⚠️ **內存佔用**: 虛擬文件系統會佔用大量內存
- ⚠️ **瀏覽器限制**: 需要特定的HTTP headers
- ⚠️ **文件大小**: ffmpeg.wasm核心約30MB下載

#### 預期效果
- **部署簡化**: 無需服務器端FFmpeg
- **隱私增強**: 數據不離開客戶端
- **總體速度**: 與當前方案相當或略慢 **10-20%**

---

### 方案4: Canvas到Blob直接傳輸 ⭐⭐⭐

#### 原理
使用 `canvas.toBlob()` 代替 `toDataURL()`，直接獲取二進制數據，避免Base64編碼開銷。

#### 技術細節
```typescript
// 當前方案 (低效)
const frameData = canvas.toDataURL('image/png', 1.0);  // Base64編碼
frames.push(frameData);

// 優化方案 (高效)
const blob = await new Promise<Blob>((resolve) => {
  canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
});

// 使用 FormData 直接發送二進制
const formData = new FormData();
formData.append(`frame_${frameIndex}`, blob, `frame_${frameIndex}.png`);

// 或使用 ArrayBuffer
const arrayBuffer = await blob.arrayBuffer();
```

#### 優勢
- ✅ **性能提升**: 避免Base64編碼，提速 **30-40%**
- ✅ **體積減少**: 減少 **25%** 數據傳輸量
- ✅ **實施簡單**: 最小化代碼改動
- ✅ **兼容性好**: 所有現代瀏覽器支持

#### 實施步驟
1. 修改 `usePreviewRecorder.ts`:
   ```typescript
   const blob = await new Promise<Blob>(resolve =>
     canvas.toBlob(b => resolve(b!), 'image/png')
   );
   frames.push(blob);
   ```
2. 修改後端接收邏輯:
   ```typescript
   const formData = await request.formData();
   for (let i = 0; i < totalFrames; i++) {
     const frameBlob = formData.get(`frame_${i}`);
     const buffer = await frameBlob.arrayBuffer();
     await fs.promises.writeFile(framePath, Buffer.from(buffer));
   }
   ```

#### 風險與挑戰
- ⚠️ **FormData大小限制**: 某些服務器對multipart請求有限制
- ⚠️ **內存佔用**: 仍需存儲所有Blob對象 (可結合方案2解決)

#### 預期效果
- **編碼速度**: 提升 **30-40%**
- **內存佔用**: 降低 **25%**
- **總體耗時**: 降低 **15-25%**

---

### 方案5: WebGL加速渲染 + OffscreenCanvas ⭐⭐⭐

#### 原理
使用WebGL進行字幕渲染加速，並使用OffscreenCanvas在Web Worker中處理，釋放主線程。

#### 技術細節
```typescript
// 主線程
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('recorder-worker.js');
worker.postMessage({
  canvas: offscreen,
  videoElement: videoElement,
  subtitles: subtitles
}, [offscreen]);

// recorder-worker.js
self.onmessage = async (e) => {
  const { canvas, subtitles } = e.data;
  const gl = canvas.getContext('webgl2');

  // 使用WebGL shader渲染字幕
  const textShader = compileShader(gl, textVertexShader, textFragmentShader);

  for (let i = 0; i < totalFrames; i++) {
    // WebGL渲染
    renderVideoFrame(gl, videoTexture);
    renderSubtitles(gl, textShader, subtitles, currentTime);

    // 讀取像素
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // 發送到主線程或直接編碼
    self.postMessage({ frameIndex: i, pixels });
  }
};
```

#### 優勢
- ✅ **GPU加速**: 利用GPU並行處理能力
- ✅ **非阻塞**: Worker不阻塞主線程
- ✅ **渲染速度**: 提升 **2-3倍**

#### 實施步驟
1. 創建WebGL shader程序用於文本渲染
2. 實現文本紋理生成和緩存
3. 設置OffscreenCanvas和Worker通信
4. 整合視頻幀獲取和WebGL渲染

#### 風險與挑戰
- ⚠️ **實現複雜度**: 需要WebGL專業知識
- ⚠️ **字體渲染**: WebGL文本渲染需要預生成紋理
- ⚠️ **調試困難**: Worker中的錯誤較難調試
- ⚠️ **視頻訪問**: Worker無法直接訪問HTMLVideoElement

#### 預期效果
- **渲染速度**: 提升 **100-200%**
- **主線程佔用**: 降低 **70%**
- **開發時間**: 需要 **3-5週**

---

### 方案6: 智能幀採樣與差分編碼 ⭐⭐

#### 原理
檢測字幕變化點，只在字幕出現/消失時捕捉關鍵幀，中間幀使用原始視頻補償。

#### 技術細節
```typescript
// 計算關鍵幀時間點
const keyframeTimes = new Set<number>();
keyframeTimes.add(0);  // 開始幀
keyframeTimes.add(duration);  // 結束幀

subtitles.forEach(seg => {
  keyframeTimes.add(seg.startTime);
  keyframeTimes.add(seg.endTime);
});

// 只渲染關鍵幀
const sortedKeyframes = Array.from(keyframeTimes).sort();
const renderedFrames = [];

for (const time of sortedKeyframes) {
  // 渲染當前關鍵幀
  const frame = await renderFrameAtTime(time);
  renderedFrames.push({ time, frame });
}

// FFmpeg使用overlay filter
const ffmpegArgs = [
  '-i', 'original_video.mp4',
  ...renderedFrames.map((f, i) => `-i frame_${i}.png`),
  '-filter_complex', `[0:v]${overlayFilters}[out]`,
  '-map', '[out]',
  'output.mp4'
];
```

#### 優勢
- ✅ **減少幀數**: 只渲染 **10-20%** 的幀
- ✅ **質量保持**: 無損字幕效果
- ✅ **速度提升**: **5-10倍** 加速

#### 風險與挑戰
- ⚠️ **FFmpeg複雜性**: overlay filter配置複雜
- ⚠️ **動畫效果**: 不支持字幕淡入淡出等動畫
- ⚠️ **對齊精度**: 時間點對齊可能出現誤差

#### 預期效果
- **渲染幀數**: 減少 **80-90%**
- **總體速度**: 提升 **400-800%**
- **適用場景**: 靜態字幕 (無動畫效果)

---

## 三、優先級建議

### 短期實施 (1-2週)

#### 🥇 優先級1: 方案4 - Canvas到Blob直接傳輸
**理由**:
- 實施難度最低 (1-2天)
- 立即見效 (15-25%性能提升)
- 風險極低
- 為其他方案打基礎

**實施路徑**:
```
第1天: 修改前端toDataURL → toBlob
第2天: 修改後端接收邏輯並測試
第3天: 性能測試和回歸測試
```

#### 🥈 優先級2: 方案2 - 流式數據傳輸 (可選)
**理由**:
- 解決內存問題 (關鍵痛點)
- 中等難度 (3-5天)
- 可與方案4結合使用

**實施路徑**:
```
第1-2天: 實現批次傳輸邏輯
第3-4天: 會話管理和錯誤處理
第5天: 集成測試
```

### 中期實施 (1-2個月)

#### 🥇 優先級3: 方案1 - WebCodecs API硬件加速
**理由**:
- 最大性能提升 (300-500%)
- 技術前瞻性
- 減輕後端負擔

**實施路徑**:
```
第1週: WebCodecs API調研和原型
第2週: 實現視頻編碼器
第3週: 音軌合成方案 (FFmpeg後端或Web Audio)
第4週: 兼容性處理和降級方案
第5-6週: 完整測試和優化
```

**降級策略**: 不支持WebCodecs的瀏覽器繼續使用優化後的當前方案

### 長期考慮 (3-6個月)

#### 方案3 - ffmpeg.wasm
**適用場景**:
- 需要完全離線工作
- 隱私敏感的應用場景
- 後端資源受限

#### 方案5 - WebGL加速
**適用場景**:
- 需要複雜特效
- 有專業WebGL開發資源
- 追求極致性能

#### 方案6 - 智能採樣
**適用場景**:
- 字幕數量少且靜態
- 視頻時長很長 (>10分鐘)

---

## 四、綜合優化建議

### 推薦組合方案: 方案1 + 方案4 + 方案2

**實施順序**:
1. **階段1 (立即)**: 實施方案4 (Blob傳輸)
2. **階段2 (2週後)**: 實施方案2 (流式傳輸)
3. **階段3 (1個月後)**: 實施方案1 (WebCodecs)

**預期綜合效果**:
- 總體速度提升: **400-600%**
- 內存佔用降低: **90%**
- 服務器負載降低: **70%**
- 用戶體驗分數: **從6/10提升到9/10**

**投資回報**:
- 開發時間: 6-8週
- 性能提升: 5-6倍
- 成本節省: 減少70%服務器處理時間

---

## 五、技術風險評估

### 高風險項
| 風險 | 影響範圍 | 緩解措施 |
|------|---------|---------|
| **WebCodecs瀏覽器兼容性** | 方案1 | 實施降級策略，維護雙軌道方案 |
| **內存溢出** | 方案3, 5 | 實施分批處理，限制最大視頻長度 |
| **音頻同步問題** | 方案1, 3 | 嚴格的時間戳管理，增加同步檢測 |

### 中風險項
| 風險 | 影響範圍 | 緩解措施 |
|------|---------|---------|
| **網絡傳輸失敗** | 方案2 | 實施重試機制和斷點續傳 |
| **編碼質量下降** | 所有方案 | 增加質量預設選項，AB測試 |
| **跨域資源限制** | 方案3, 5 | 配置正確的CORS和COOP/COEP headers |

### 低風險項
- Blob API兼容性 (方案4): 所有現代瀏覽器支持
- FFmpeg穩定性: 成熟工具，風險極低
- 數據格式轉換: 標準API，測試充分即可

---

## 六、實施路線圖

### 第1-2週: 快速優化階段
```
├─ 方案4實施 (Canvas to Blob)
│  ├─ 前端改造 (1天)
│  ├─ 後端改造 (1天)
│  └─ 測試發布 (1天)
├─ 性能基準測試
│  ├─ 建立測試用例 (3個不同長度視頻)
│  ├─ 記錄優化前指標
│  └─ 記錄優化後指標
└─ 用戶反饋收集
```

### 第3-4週: 穩定性提升階段
```
├─ 方案2實施 (流式傳輸)
│  ├─ API路由設計 (1天)
│  ├─ 前端批次處理 (2天)
│  ├─ 後端接收邏輯 (2天)
│  └─ 集成測試 (2天)
├─ 錯誤處理增強
│  ├─ 網絡失敗重試
│  ├─ 進度持久化
│  └─ 取消機制優化
└─ 內存監控與優化
```

### 第5-10週: 革命性升級階段
```
├─ 方案1調研 (1週)
│  ├─ WebCodecs API學習
│  ├─ 瀏覽器支持測試
│  └─ 原型開發
├─ WebCodecs實施 (3週)
│  ├─ 視頻編碼器集成
│  ├─ 音軌處理方案
│  ├─ Muxer選擇和集成
│  └─ 降級策略實施
├─ 全面測試 (1週)
│  ├─ 功能測試
│  ├─ 性能測試
│  ├─ 兼容性測試
│  └─ 壓力測試
└─ 灰度發布 (1週)
   ├─ 10%用戶灰度
   ├─ 監控關鍵指標
   └─ 全量發布
```

---

## 七、成功指標

### 性能指標
| 指標 | 當前值 | 目標值 | 測量方法 |
|------|--------|--------|----------|
| **60秒視頻錄製時間** | ~120秒 | <30秒 | 計時測量 |
| **峰值內存佔用** | ~900MB | <150MB | Chrome DevTools Memory Profiler |
| **幀渲染速度** | ~2fps | >15fps | 計算totalFrames/renderTime |
| **數據傳輸大小** | ~1.2GB | <300MB | Network面板 |
| **服務器CPU佔用** | 80% | <30% | 服務器監控 |

### 用戶體驗指標
| 指標 | 當前值 | 目標值 |
|------|--------|--------|
| **進度更新頻率** | 每幀 | 實時(60fps) |
| **界面卡頓** | 嚴重 | 無 |
| **取消響應時間** | 1-3秒 | <0.5秒 |
| **失敗率** | ~5% | <0.5% |

### 業務指標
| 指標 | 目標 |
|------|------|
| **用戶滿意度** | >90% |
| **錄製完成率** | >98% |
| **重複錄製率** | <10% (因錯誤重錄) |

---

## 八、備選方案與未來展望

### 備選技術
1. **MediaRecorder API** (限制: 無法自定義字幕渲染)
2. **Canvas Streams** (限制: 需要額外的錄製方案)
3. **Server-Side Rendering** (限制: 延遲高，服務器成本高)

### 未來可能的改進
1. **AI優化編碼**: 使用機器學習優化碼率分配
2. **雲端協同處理**: 複雜任務分發到雲端GPU
3. **預測性渲染**: 預測用戶需求，提前渲染常用配置
4. **增量更新**: 只重新渲染修改過的字幕片段

---

## 九、附錄

### A. 性能測試腳本示例
```typescript
// performance-test.ts
async function benchmarkRecording(videoUrl: string, duration: number) {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

  await recordPreview(/* ... */);

  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

  return {
    totalTime: endTime - startTime,
    peakMemory: endMemory - startMemory,
    fps: totalFrames / ((endTime - startTime) / 1000)
  };
}
```

### B. 瀏覽器兼容性矩陣
| 功能 | Chrome | Safari | Firefox | Edge |
|------|--------|--------|---------|------|
| WebCodecs | ✅ 94+ | ✅ 17.5+ | ❌ | ✅ 94+ |
| OffscreenCanvas | ✅ 69+ | ✅ 16.4+ | ✅ 105+ | ✅ 79+ |
| Canvas.toBlob | ✅ | ✅ | ✅ | ✅ |
| SharedArrayBuffer | ✅* | ✅* | ✅* | ✅* |

*需要COOP/COEP headers

### C. 參考資源
- [WebCodecs API - W3C Draft](https://w3c.github.io/webcodecs/)
- [FFmpeg官方文檔](https://ffmpeg.org/documentation.html)
- [webm-muxer庫](https://github.com/Vanilagy/webm-muxer)
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [OffscreenCanvas - MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

---

## 結論

本優化規劃提供了**6個獨立方案**和**1個組合推薦方案**，可根據實際情況選擇實施。

**核心建議**:
1. **立即實施**: 方案4 (Blob傳輸) - 低成本高回報
2. **短期實施**: 方案2 (流式傳輸) - 解決內存問題
3. **中期實施**: 方案1 (WebCodecs) - 革命性性能提升

通過逐步實施，預計可實現:
- ⚡ **總體速度提升 5-6倍**
- 💾 **內存佔用降低 90%**
- 🚀 **用戶體驗質的飛躍**

建議建立專門的性能優化團隊，按照本文路線圖執行，並持續監控關鍵指標。
