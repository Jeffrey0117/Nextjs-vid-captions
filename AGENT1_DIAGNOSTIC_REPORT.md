# Agent 1: 診斷報告 - 第二軌道點擊誤判問題

**日期**: 2025-11-15 23:53
**狀態**: 診斷完成
**結論**: 發現問題根源並定位需要修改的代碼

---

## 執行摘要

經過詳細的代碼審查和邏輯分析，我發現了為什麼點擊第二軌道字幕會誤判選中第一軌道字幕的根本原因。問題的核心在於**點擊事件處理流程缺少基於鼠標 Y 坐標的軌道判斷邏輯**。

---

## 問題根源分析

### 1. 核心問題位置

**文件**: `C:\Users\USER\Desktop\code\subtitle-web\app\editor-pro\page.tsx`
**行號**: 3506-3523（segment onClick 處理器）

當用戶點擊時間軸上的字幕片段時，onClick 事件處理器會調用 `handleSegmentClick` 函數，但這個調用**只傳遞了 segment.id 和 segment.startTime**，完全沒有考慮用戶實際點擊的位置（Y 坐標）。

```typescript
// 當前的實現（第 3506-3523 行）
onClick={(e) => {
  e.stopPropagation();
  if (!hasMoved) {
    TimelineDebugLogger.click({...});
    handleSegmentClick(segment.id, segment.startTime);  // ❌ 只傳 ID 和時間
    selectTrack(track.id);  // ⚠️ 雖然調用了，但順序錯誤
  }
}}
```

**問題點**:
- `handleSegmentClick` 先於 `selectTrack` 被調用
- 沒有驗證點擊的 segment 是否真的屬於這個 track
- 依賴執行順序而非邏輯驗證

---

### 2. handleSegmentClick 函數的設計缺陷

**文件**: `C:\Users\USER\Desktop\code\subtitle-web\app\editor-pro\page.tsx`
**行號**: 1457-1466

```typescript
const handleSegmentClick = (segmentId: string, startTime: number) => {
  console.log('📌 handleSegmentClick 被调用', {
    segmentId,
    startTime,
    previousSelectedId: selectedSegmentId
  });
  setSelectedSegmentId(segmentId);
  selectSegment(segmentId);  // ⚠️ 關鍵問題所在
  seekTo(startTime);
};
```

**設計缺陷**:
1. **缺少軌道參數**: 函數簽名中沒有 `trackId` 參數
2. **缺少驗證邏輯**: 沒有檢查 segment 是否屬於預期的軌道
3. **盲目選擇**: 直接調用 `selectSegment(segmentId)` 而不考慮上下文

這導致了一個關鍵問題：如果有兩個軌道在相同時間點都有字幕，系統無法知道用戶到底點擊的是哪個軌道的字幕。

---

### 3. Store 層面的問題

**文件**: `C:\Users\USER\Desktop\code\subtitle-web\app\stores\subtitle-store.ts`
**行號**: 433-435

```typescript
selectSegment: (id) => {
  set({ selectedSegmentId: id });
},
```

**問題分析**:
- 函數過於簡單，只是設置一個 ID
- 沒有任何驗證邏輯
- 沒有根據 segment 所屬軌道自動更新 `selectedTrackId`
- 不檢查 ID 是否有效或存在

**應該有的邏輯**（但目前缺失）:
```typescript
// 理想的實現應該包含：
selectSegment: (id) => {
  const state = get();

  // 1. 驗證 segment 是否存在
  const track = state.tracks.find(t =>
    t.segments.some(s => s.id === id)
  );

  if (!track) {
    console.warn('Segment not found in any track:', id);
    return;
  }

  // 2. 自動切換到包含此 segment 的軌道
  set({
    selectedSegmentId: id,
    selectedTrackId: track.id  // ✅ 自動同步軌道選擇
  });
},
```

---

### 4. 時間軸渲染邏輯的問題

**文件**: `C:\Users\USER\Desktop\code\subtitle-web\app\editor-pro\page.tsx`
**行號**: 3419-3560

```typescript
{tracks.map((track, trackIndex) => (
  <div key={track.id} style={{ height: `${track.height}px` }}>
    {track.segments.map((segment, segmentIndex) => {
      return (
        <div onClick={(e) => {
          // ❌ 執行順序有問題
          handleSegmentClick(segment.id, segment.startTime);
          selectTrack(track.id);
        }}>
      )
    })}
  </div>
))}
```

**執行流程分析**:
1. 用戶點擊第二軌道的某個字幕
2. `handleSegmentClick(segment.id, ...)` **先執行**
3. 在 handleSegmentClick 內部調用 `selectSegment(segmentId)`
4. **問題**: 此時 `selectedTrackId` 可能還指向第一軌道
5. 然後才執行 `selectTrack(track.id)` 切換到第二軌道
6. **結果**: 短暫的狀態不一致 + 可能觸發錯誤的副作用

---

### 5. 缺失的 Y 坐標判斷邏輯

**當前代碼完全沒有使用鼠標 Y 坐標來**:
- ❌ 計算點擊發生在哪個軌道上
- ❌ 驗證點擊的字幕確實屬於該軌道
- ❌ 處理點擊軌道間隙的情況
- ❌ 提供更精確的用戶意圖判斷

這導致系統完全依賴於：
- segment ID 的全局唯一性（這個假設是對的）
- 執行順序的正確性（這個假設是脆弱的）
- 沒有任何防禦性編程措施

---

## 需要修改的代碼位置

### 位置 1: handleSegmentClick 函數
**文件**: `app/editor-pro/page.tsx`
**行號**: 1457-1466
**修改內容**: 添加 `trackId` 參數，先選擇軌道再選擇字幕

```typescript
// 修改前
const handleSegmentClick = (segmentId: string, startTime: number) => {
  setSelectedSegmentId(segmentId);
  selectSegment(segmentId);
  seekTo(startTime);
};

// 修改後
const handleSegmentClick = (segmentId: string, startTime: number, trackId: string) => {
  console.log('📌 handleSegmentClick 被调用', {
    segmentId,
    startTime,
    trackId,  // ✅ 新增
    previousSelectedId: selectedSegmentId
  });

  // ✅ 先選擇軌道，確保上下文正確
  selectTrack(trackId);

  // 然後選擇字幕
  setSelectedSegmentId(segmentId);
  selectSegment(segmentId);
  seekTo(startTime);
};
```

---

### 位置 2: onClick 調用點
**文件**: `app/editor-pro/page.tsx`
**行號**: 3520
**修改內容**: 傳遞 `track.id` 參數

```typescript
// 修改前
onClick={(e) => {
  e.stopPropagation();
  if (!hasMoved) {
    handleSegmentClick(segment.id, segment.startTime);
    selectTrack(track.id);
  }
}}

// 修改後
onClick={(e) => {
  e.stopPropagation();
  if (!hasMoved) {
    TimelineDebugLogger.click({
      trackId: track.id,
      trackName: track.name,
      segmentId: segment.id,
      segmentText: segment.text,
      startTime: segment.startTime,
      wasAlreadySelected: selectedSegmentId === segment.id,
    });

    // ✅ 傳遞 trackId
    handleSegmentClick(segment.id, segment.startTime, track.id);

    // ⚠️ 這行可以移除，因為 handleSegmentClick 內部已經處理
    // selectTrack(track.id);
  }
}}
```

---

### 位置 3: Store 的 selectSegment 函數（可選優化）
**文件**: `app/stores/subtitle-store.ts`
**行號**: 433-435
**修改內容**: 添加軌道歸屬驗證和自動同步

```typescript
// 修改前
selectSegment: (id) => {
  set({ selectedSegmentId: id });
},

// 修改後（增強版）
selectSegment: (id) => {
  const state = get();

  // 查找包含此 segment 的軌道
  const trackWithSegment = state.tracks.find(track =>
    track.segments.some(seg => seg.id === id)
  );

  if (!trackWithSegment) {
    console.warn('⚠️ Segment not found in any track:', id);
    set({ selectedSegmentId: null });
    return;
  }

  // 自動同步軌道選擇
  set({
    selectedSegmentId: id,
    selectedTrackId: trackWithSegment.id,  // ✅ 自動切換軌道
  });

  console.log('✅ Selected segment:', id, 'in track:', trackWithSegment.name);
},
```

---

### 位置 4: 添加基於 Y 坐標的軌道判斷函數（未來優化）
**文件**: `app/editor-pro/page.tsx`
**建議添加位置**: 1456 行之前（在 handleSegmentClick 之前）
**用途**: 處理複雜場景，如點擊空白區域、拖拽等

```typescript
/**
 * 根據鼠標 Y 坐標判斷點擊的軌道
 */
const getTrackIdFromMouseY = (
  mouseY: number,
  tracksContainer: HTMLElement | null,
  scrollTop: number
): string | null => {
  if (!tracksContainer) return null;

  const containerRect = tracksContainer.getBoundingClientRect();
  const relativeY = mouseY - containerRect.top;
  const adjustedY = relativeY + scrollTop;

  let accumulatedHeight = 0;

  for (const track of tracks) {
    if (adjustedY >= accumulatedHeight && adjustedY < accumulatedHeight + track.height) {
      return track.id;
    }
    accumulatedHeight += track.height;
  }

  return null;
};
```

---

## 根本原因總結

**核心問題**:
系統假設 segment ID 是全局唯一的（這個假設是正確的），但在選擇字幕時沒有考慮到**用戶的點擊意圖**和**軌道上下文**。

**具體表現**:
1. ❌ handleSegmentClick 缺少軌道參數
2. ❌ selectSegment (store) 缺少驗證和自動同步邏輯
3. ❌ onClick 處理器的執行順序有問題（先選字幕後選軌道）
4. ❌ 完全沒有使用鼠標 Y 坐標來輔助判斷

**導致的後果**:
- 點擊第二軌道字幕時，系統可能選中第一軌道
- 狀態更新順序混亂，可能觸發錯誤的副作用
- 缺少防禦性編程，容易出現邊界情況錯誤

---

## 修復優先級

### 必須修復（高優先級）
1. ✅ **位置 1**: 修改 `handleSegmentClick` 函數簽名
2. ✅ **位置 2**: 更新 onClick 調用，傳遞 trackId

### 建議修復（中優先級）
3. ⚙️ **位置 3**: 增強 Store 的 `selectSegment` 函數

### 未來優化（低優先級）
4. 🔮 **位置 4**: 添加基於 Y 坐標的軌道判斷函數

---

## 測試建議

修復後需要測試的場景：
- ✅ 點擊第一軌道字幕 → 應選中第一軌道
- ✅ 點擊第二軌道字幕 → 應選中第二軌道
- ✅ 快速連續點擊不同軌道 → 應正確切換
- ✅ 雙擊打開調整面板 → 應顯示正確軌道的字幕
- ✅ 右側屬性面板更新 → 應顯示正確軌道的信息

---

**報告完成時間**: 2025-11-15 23:53
**下一步**: 交接給 Agent 3 實現修復
