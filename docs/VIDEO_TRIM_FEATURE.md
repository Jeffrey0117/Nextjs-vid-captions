# 影片剪輯功能規劃

## 功能需求

**核心目標**：讓用戶可以剪掉影片中多餘的部分，只保留需要的片段

## 使用場景

1. **去掉開頭/結尾多餘部分**
   - 例如：前 5 秒的空白、片尾的閒聊

2. **刪除中間不要的片段**
   - 例如：說錯話的部分、冗長的停頓

3. **只保留有字幕的部分**
   - 自動識別無字幕區間並標記

---

## UI/UX 設計

### 方案 A：時間軸標記法（推薦）

在影片播放器下方添加時間軸：

```
[播放器]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  保留   刪除    保留    刪除   保留
```

**交互方式**：
1. 拖動滑桿標記「保留區間」的起點和終點
2. 點擊「添加保留區間」按鈕
3. 未標記的區間自動視為刪除

**優點**：
- 直觀，類似專業剪輯軟件
- 可以精確控制

### 方案 B：字幕基準法

基於字幕自動標記：

```
字幕 1: [00:00 - 00:05] ✅ 保留
字幕 2: [00:05 - 00:10] ❌ 刪除
字幕 3: [00:10 - 00:15] ✅ 保留
```

**交互方式**：
1. 顯示所有字幕列表
2. 每個字幕旁有「保留/刪除」開關
3. 根據選擇生成剪輯

**優點**：
- 適合基於內容剪輯
- 與字幕編輯器整合

---

## 技術實現

### 後端方案：FFmpeg

使用 FFmpeg 的 `concat` demuxer：

```bash
# 1. 創建片段列表文件
cat > segments.txt <<EOF
file 'temp/video.mp4'
inpoint 0
outpoint 5

file 'temp/video.mp4'
inpoint 10
outpoint 20
EOF

# 2. 合併片段
ffmpeg -f concat -safe 0 -i segments.txt -c copy output.mp4
```

### 前端實現

#### 1. 時間軸組件 (`TrimTimeline.tsx`)

```typescript
interface TrimSegment {
  start: number; // 秒
  end: number;   // 秒
}

interface TrimTimelineProps {
  duration: number;
  segments: TrimSegment[];
  onSegmentsChange: (segments: TrimSegment[]) => void;
}

// 功能：
// - 顯示時間軸
// - 拖動標記點
// - 添加/刪除片段
// - 預覽保留時長
```

#### 2. API 端點 (`/api/trim-video`)

```typescript
POST /api/trim-video
{
  videoPath: string;
  segments: Array<{ start: number; end: number }>;
}

Response:
{
  success: boolean;
  outputPath: string;
  duration: number;
}
```

---

## 實現步驟

### Phase 1: 基礎剪輯 UI（2-3 小時）

1. **創建時間軸組件**
   - 文件：`app/components/TrimTimeline.tsx`
   - 功能：
     - 顯示影片總時長
     - 標記保留區間（起點/終點）
     - 顯示當前片段列表

2. **整合到編輯器**
   - 在 `app/editor/page.tsx` 添加「剪輯模式」
   - 切換按鈕：「編輯字幕」 ⇄ 「剪輯影片」

3. **狀態管理**
   - 添加 `trimSegments` state
   - 保存到專案數據

### Phase 2: 後端剪輯實現（2-3 小時）

1. **創建 API**
   - 文件：`app/api/trim-video/route.ts`
   - 功能：
     - 接收片段列表
     - 使用 FFmpeg 執行剪輯
     - 返回新影片路徑

2. **FFmpeg 邏輯**
   - 生成 concat 文件
   - 執行剪輯命令
   - 清理臨時文件

3. **錯誤處理**
   - 驗證片段有效性
   - FFmpeg 執行失敗處理
   - 進度追蹤（可選）

### Phase 3: 進階功能（可選）

1. **字幕同步**
   - 剪輯後自動調整字幕時間軸
   - 刪除被剪掉片段的字幕

2. **預覽功能**
   - 播放器跳轉到保留區間
   - 高亮顯示當前片段

3. **快捷操作**
   - 「刪除無字幕區間」自動標記
   - 「合併短片段」優化

---

## 代碼示例

### 時間軸組件框架

```typescript
// app/components/TrimTimeline.tsx
import { useState } from 'react';

interface TrimSegment {
  id: string;
  start: number;
  end: number;
}

export default function TrimTimeline({
  duration,
  segments,
  onSegmentsChange
}: {
  duration: number;
  segments: TrimSegment[];
  onSegmentsChange: (segments: TrimSegment[]) => void;
}) {
  const [currentSegment, setCurrentSegment] = useState({ start: 0, end: 0 });

  const addSegment = () => {
    const newSegment: TrimSegment = {
      id: Date.now().toString(),
      start: currentSegment.start,
      end: currentSegment.end
    };
    onSegmentsChange([...segments, newSegment]);
  };

  const deleteSegment = (id: string) => {
    onSegmentsChange(segments.filter(s => s.id !== id));
  };

  // 計算保留總時長
  const totalDuration = segments.reduce((sum, seg) =>
    sum + (seg.end - seg.start), 0
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">添加保留片段</h3>

        {/* 起點輸入 */}
        <div className="flex gap-4 items-center">
          <label>
            起點（秒）:
            <input
              type="number"
              value={currentSegment.start}
              onChange={(e) => setCurrentSegment({
                ...currentSegment,
                start: parseFloat(e.target.value)
              })}
              className="ml-2 px-2 py-1 bg-gray-700 rounded"
            />
          </label>

          <label>
            終點（秒）:
            <input
              type="number"
              value={currentSegment.end}
              onChange={(e) => setCurrentSegment({
                ...currentSegment,
                end: parseFloat(e.target.value)
              })}
              className="ml-2 px-2 py-1 bg-gray-700 rounded"
            />
          </label>

          <button
            onClick={addSegment}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            添加片段
          </button>
        </div>
      </div>

      {/* 片段列表 */}
      <div className="space-y-2">
        <h3 className="font-semibold">
          保留片段列表 (總時長: {totalDuration.toFixed(1)}秒)
        </h3>
        {segments.map(segment => (
          <div
            key={segment.id}
            className="flex items-center justify-between bg-gray-800 p-3 rounded"
          >
            <span>
              {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
              (時長: {(segment.end - segment.start).toFixed(1)}s)
            </span>
            <button
              onClick={() => deleteSegment(segment.id)}
              className="text-red-500 hover:text-red-400"
            >
              刪除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### API 實現框架

```typescript
// app/api/trim-video/route.ts
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { videoPath, segments } = await request.json();

    // 驗證片段
    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: '沒有指定保留片段' },
        { status: 400 }
      );
    }

    // 生成 concat 文件
    const concatFile = path.join(
      process.cwd(),
      'public/temp',
      `concat_${Date.now()}.txt`
    );

    const concatContent = segments
      .map((seg: { start: number; end: number }) =>
        `file '${videoPath}'\ninpoint ${seg.start}\noutpoint ${seg.end}`
      )
      .join('\n');

    await fs.promises.writeFile(concatFile, concatContent);

    // 輸出文件
    const outputPath = path.join(
      process.cwd(),
      'public/temp',
      `trimmed_${Date.now()}.mp4`
    );

    // FFmpeg 剪輯
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      outputPath
    ]);

    return new Promise((resolve) => {
      ffmpeg.on('close', async (code) => {
        // 清理 concat 文件
        await fs.promises.unlink(concatFile);

        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            outputPath: outputPath.replace(process.cwd() + '/public', '')
          }));
        } else {
          resolve(NextResponse.json(
            { error: 'FFmpeg 剪輯失敗' },
            { status: 500 }
          ));
        }
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: '剪輯失敗: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

## 預估工作量

- **Phase 1 (基礎 UI)**：2-3 小時
- **Phase 2 (後端實現)**：2-3 小時
- **Phase 3 (進階功能)**：3-4 小時（可選）

**總計**：MVP 約 4-6 小時，完整版 7-10 小時

---

## 下一步行動

1. **確認方案**：選擇方案 A（時間軸）或方案 B（字幕基準）
2. **創建組件**：`TrimTimeline.tsx`
3. **實現 API**：`/api/trim-video`
4. **測試驗證**：上傳影片 → 標記片段 → 執行剪輯

---

## 注意事項

1. **FFmpeg 依賴**：確保服務器已安裝 FFmpeg
2. **文件大小**：大影片剪輯可能需要較長時間
3. **磁碟空間**：及時清理臨時文件
4. **用戶體驗**：添加進度提示避免用戶等待焦慮
