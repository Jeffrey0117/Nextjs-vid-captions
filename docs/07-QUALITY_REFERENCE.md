# 07 - 質量參數快速查詢

**階段**: 性能與畫質優化
**日期**: 2025-11-14
**狀態**: ✅ 參考文檔

---

## 一、質量預設快速對比

| 模式 | CRF | Preset | 色彩採樣 | 超採樣 | 文件大小* | 編碼時間* | 畫質 |
|------|-----|--------|----------|--------|-----------|-----------|------|
| **Fast** | 28 | veryfast | 4:2:0 | 無 | 0.5x | 0.3x | 75/100 |
| **Balanced** | 23 | medium | 4:2:0 | 無 | 1x | 1x | 85/100 |
| **High** | 18 | slow | 4:2:0 | 2x字幕層 | 2.5x | 1.8x | 94/100 |
| **Ultra** | 15 | veryslow | 4:4:4 | 4x全畫面 | 4.5x | 3.5x | 99/100 |

*相對於Balanced模式

---

## 二、FFmpeg核心參數速查

### Fast模式（快速預覽）
```bash
-preset veryfast -crf 28 -pix_fmt yuv420p
-g 30 -bf 0
-vsync 2
```
**適用**: 預覽、草稿、快速導出
**特點**: 最快速度，質量可接受

### Balanced模式（日常使用）
```bash
-preset medium -crf 23 -pix_fmt yuv420p
-g 25 -bf 3
-vsync 2
```
**適用**: 日常使用、一般分享
**特點**: 質量與速度平衡（默認）

### High模式（重要項目）
```bash
-preset slow -crf 18 -pix_fmt yuv420p
-tune film -g 20 -bf 5 -refs 4
-me_method umh -subme 8
-vsync 2
```
**適用**: 最終輸出、重要項目
**特點**: 高畫質，2x超採樣字幕

### Ultra模式（專業制作）
```bash
-preset veryslow -crf 15 -pix_fmt yuv444p
-tune film -profile:v high444
-g 15 -bf 8 -refs 6
-me_method umh -subme 10 -trellis 2
-aq-mode 3 -psy-rd 1.0:0.15
-vsync 2
```
**適用**: 專業制作、長期歸檔
**特點**: Near-lossless質量，4x超採樣

---

## 三、CRF值速查表

| CRF | 質量等級 | 視覺效果 | 推薦場景 | 文件大小 |
|-----|----------|----------|----------|----------|
| 0 | 無損 | 完美 | 中間文件 | 極大 |
| 10-15 | Near-Lossless | 極佳 | 歸檔/專業 | 很大 |
| 16-18 | 高質量 | 優秀 | 最終輸出 | 大 |
| 19-23 | 標準質量 | 良好 | 日常使用 | 適中 |
| 24-28 | 中等質量 | 可接受 | 預覽/草稿 | 小 |
| 29-35 | 低質量 | 明顯壓縮 | 快速測試 | 很小 |
| 36-51 | 極低質量 | 嚴重失真 | 不推薦 | 極小 |

**原則**: CRF每減少1，文件大小約增加10-15%

---

## 四、編碼速度預設對比

| Preset | 速度 | 質量 | 編碼時間* | 文件大小 | 推薦場景 |
|--------|------|------|-----------|----------|---------|
| ultrafast | 最快 | 最低 | 0.2x | 最大 | 實時編碼 |
| veryfast | 很快 | 低 | 0.4x | 大 | 快速預覽 |
| fast | 快 | 中低 | 0.6x | 較大 | 草稿 |
| medium | 中等 | 中等 | 1x | 中等 | 日常使用 |
| slow | 慢 | 高 | 1.5x | 較小 | 正式發布 |
| veryslow | 很慢 | 很高 | 3x | 小 | 專業制作 |

*相對於實時速度

**原則**: 慢preset提高壓縮效率，減小文件，但編碼時間增加

---

## 五、色度採樣對比

| 格式 | 描述 | 色度分辨率 | 兼容性 | 文件大小 | 質量 | 推薦場景 |
|------|------|------------|--------|----------|------|---------|
| yuv420p | 4:2:0 | 色度減半 | 通用 | 小 | 良好 | 日常使用 |
| yuv422p | 4:2:2 | 色度水平減半 | 中等 | 中等 | 很好 | 專業視頻 |
| yuv444p | 4:4:4 | 完整色度 | 有限 | 大 | 最佳 | 專業制作 |

**建議**:
- 通用用途、兼容性優先 → yuv420p
- 專業制作、極致質量 → yuv444p

---

## 六、GOP（關鍵幀間隔）指南

| GOP大小 | 場景 | 優點 | 缺點 | 推薦fps |
|---------|------|------|------|---------|
| 5-10 | 高動態、剪輯 | 更好隨機訪問 | 文件較大 | 任意 |
| 10-15 | 平衡 | 質量與大小平衡 | - | 30 |
| 15-30 | 低動態、流媒體 | 文件較小 | 隨機訪問慢 | 30-60 |

**公式**: GOP = FPS × 秒數
**示例**: 30fps × 0.5秒 = 15幀

**配置**:
- Fast: GOP 30
- Balanced: GOP 25
- High: GOP 20
- Ultra: GOP 15

---

## 七、B幀數量指南

| B幀數 | 場景 | 編碼時間 | 壓縮率 | 質量提升 |
|-------|------|----------|--------|---------|
| 0 | 快速編碼 | 最快 | 低 | 基準 |
| 3 | 平衡 | 快 | 中 | +5% |
| 5-8 | 高質量 | 慢 | 高 | +10% |
| 16 | 極致壓縮 | 很慢 | 極高 | +15% |

**建議**:
- 快速: 0-2
- 標準: 3-5
- 高質量: 5-8

**配置**:
- Fast: 0
- Balanced: 3
- High: 5
- Ultra: 8

---

## 八、參考幀數量

| Refs | 內存使用 | 質量提升 | 編碼時間 | 推薦場景 |
|------|----------|----------|----------|---------|
| 1 | 低 | 基準 | 快 | 快速編碼 |
| 3 | 中 | +5% | +20% | 平衡 |
| 5 | 高 | +8% | +40% | 高質量 |
| 8 | 很高 | +10% | +60% | 極致質量 |

**建議**:
- 快速: 1-2
- 平衡: 3-4
- 高質量: 5-6
- 極致: 8+

**配置**:
- Fast/Balanced: 默認
- High: 4
- Ultra: 6

---

## 九、超採樣配置速查

### 超採樣模式

| 模式 | 分辨率倍數 | 性能影響 | 畫質提升 | 推薦場景 |
|------|-----------|---------|---------|---------|
| none | 1x | 基準 | 基準 | 快速預覽 |
| 2x字幕層 | ~1.2x | +20% | +17分 | 日常使用 |
| 2x全畫面 | 2x | +100% | +8分 | 高質量 |
| 4x字幕層 | ~1.5x | +50% | +22分 | 專業 |
| 4x全畫面 | 4x | +300% | +22分 | 極致質量 |

### Downscale算法

| 算法 | 速度 | 質量 | 銳度 | 推薦模式 |
|------|------|------|------|---------|
| Bilinear | 最快 | 75/100 | 低 | fast |
| Bicubic | 快 | 85/100 | 中 | balanced |
| Lanczos | 慢 | 98/100 | 高 | high/ultra |

**配置**:
- Fast/Balanced: 無超採樣
- High: 2x字幕層 + Lanczos
- Ultra: 4x全畫面 + Lanczos

---

## 十、Canvas渲染質量

### imageSmoothingQuality

| Quality | 速度 | 質量 | 推薦模式 |
|---------|------|------|---------|
| 'low' | 快速 | 75/100 | fast |
| 'medium' | 平衡 | 85/100 | balanced |
| 'high' | 慢 | 98/100 | high/ultra |

### 導出格式

| 格式 | 壓縮 | 透明度 | 文件大小 | 質量 | 推薦場景 |
|------|------|--------|----------|------|---------|
| PNG | 無損 | 支持 | 大 | 最佳 | high/ultra |
| JPEG | 有損 | 不支持 | 小 | 良好 | fast/balanced |
| WebP | 可選 | 支持 | 較小 | 優秀 | 未來推薦 |

### 導出質量（JPEG/WebP）

| Quality | 質量 | 文件大小 | 推薦場景 |
|---------|------|----------|---------|
| 0.85 | 中等 | 小 | fast |
| 0.92 | 良好 | 適中 | balanced |
| 0.98 | 優秀 | 較大 | high |
| 1.0 | 最佳 | 最大 | ultra |

---

## 十一、使用場景推薦

### 快速預覽/測試（<30秒視頻）
```typescript
qualityLevel: 'fast'
```
**配置**: CRF 28, veryfast, 無超採樣
**編碼時間**: 30秒
**文件大小**: 50MB
**適合**: 實時預覽、快速迭代

### 日常工作流（1-3分鐘視頻）
```typescript
qualityLevel: 'balanced'
```
**配置**: CRF 23, medium, 無超採樣
**編碼時間**: 60秒
**文件大小**: 80MB
**適合**: 大多數場景、社交媒體分享

### 重要項目輸出（YouTube/Bilibili）
```typescript
qualityLevel: 'high'
```
**配置**: CRF 18, slow, 2x超採樣字幕
**編碼時間**: 90秒
**文件大小**: 120MB
**適合**: 客戶交付、重要視頻

### 專業歸檔/展示
```typescript
qualityLevel: 'ultra'
```
**配置**: CRF 15, veryslow, yuv444p, 4x超採樣
**編碼時間**: 180秒
**文件大小**: 150MB
**適合**: 長期保存、專業制作

---

## 十二、命令行示例

### 基礎編碼（Balanced）
```bash
ffmpeg -framerate 30 \
  -i "frames/frame_%08d.png" \
  -i "original_video.mp4" \
  -map 0:v -map 1:a? \
  -c:v libx264 -preset medium -crf 23 \
  -pix_fmt yuv420p -g 25 -bf 3 \
  -vsync 2 -c:a copy \
  "output.mp4"
```

### 高質量編碼（High）
```bash
ffmpeg -framerate 30 \
  -i "frames/frame_%08d.png" \
  -i "original_video.mp4" \
  -map 0:v -map 1:a? \
  -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -tune film \
  -g 20 -bf 5 -refs 4 \
  -me_method umh -subme 8 \
  -vsync 2 -c:a copy \
  "output.mp4"
```

### Near-Lossless編碼（Ultra）
```bash
ffmpeg -framerate 30 \
  -i "frames/frame_%08d.png" \
  -i "original_video.mp4" \
  -map 0:v -map 1:a? \
  -c:v libx264 -preset veryslow -crf 15 \
  -pix_fmt yuv444p -profile:v high444 -tune film \
  -g 15 -bf 8 -refs 6 \
  -me_method umh -subme 10 -trellis 2 \
  -aq-mode 3 -psy-rd 1.0:0.15 \
  -vsync 2 -c:a copy \
  "output.mp4"
```

### 帶滤镜的高质量编码
```bash
ffmpeg -framerate 30 \
  -i "frames/frame_%08d.png" \
  -i "original_video.mp4" \
  -map 0:v -map 1:a? \
  -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:0.5:5:5:0" \
  -c:v libx264 -preset slow -crf 16 -tune film \
  -vsync 2 -c:a copy \
  "output.mp4"
```

---

## 十三、質量驗證命令

### 查看視頻信息
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,pix_fmt,bit_rate \
  output.mp4
```

### 對比兩個視頻質量（SSIM）
```bash
ffmpeg -i distorted.mp4 -i reference.mp4 \
  -lavfi ssim -f null -
```

### 對比兩個視頻質量（PSNR）
```bash
ffmpeg -i distorted.mp4 -i reference.mp4 \
  -lavfi psnr -f null -
```

---

## 十四、常見問題解決

### 播放器不支持yuv444p
```bash
# 轉換為yuv420p
ffmpeg -i input.mp4 -pix_fmt yuv420p output.mp4
```

### 文件太大
```bash
# 方案1：提高CRF（質量稍降）
-crf 20  # 從15/18提高

# 方案2：使用JPEG導出
exportFormat: 'image/jpeg'
exportQuality: 0.90
```

### 編碼太慢
```bash
# 方案1：降低preset
-preset fast  # 從slow/veryslow降低

# 方案2：減少B幀和參考幀
-bf 2 -refs 2

# 方案3：禁用超採樣
qualityLevel: 'balanced'
```

### 字幕模糊
```bash
# 方案1：使用high模式（2x超採樣）
qualityLevel: 'high'

# 方案2：降低CRF
-crf 16  # 從23降低

# 方案3：使用PNG導出
exportFormat: 'image/png'
exportQuality: 1.0
```

---

## 十五、性能預估（60秒1080p視頻）

| 指標 | Fast | Balanced | High | Ultra |
|------|------|----------|------|-------|
| **編碼時間** | 30秒 | 60秒 | 90秒 | 180秒 |
| **文件大小** | 50MB | 80MB | 120MB | 150MB |
| **內存占用** | 45MB | 45MB | 77MB | 173MB |
| **畫質評分** | 75/100 | 85/100 | 94/100 | 99/100 |
| **超採樣** | 無 | 無 | 2x字幕層 | 4x全畫面 |
| **推薦場景** | 預覽 | 日常 | 發布 | 專業 |

---

## 十六、參數優化技巧

### 減小文件大小（保持質量）
1. 使用slower/veryslow preset
2. 增加B幀: `-bf 8`
3. 增加參考幀: `-refs 5-6`
4. 使用JPEG導出: `exportFormat: 'image/jpeg'`

### 提升編碼速度（輕微降低質量）
1. 使用faster preset
2. 減少B幀: `-bf 0-2`
3. 減少參考幀: `-refs 1-2`
4. 禁用超採樣

### 極致質量（不計代價）
```bash
-preset veryslow -crf 12 -pix_fmt yuv444p
-tune film -profile:v high444
-g 5 -bf 16 -refs 8
-me_method tesa -subme 11 -trellis 2
-aq-mode 3 -psy-rd 1.2:0.2
```
配合4x全畫面超採樣

---

## 十七、總結建議

### 新手用戶
- 使用 **Balanced模式**
- 不調整其他參數
- 測試編碼時間和文件大小

### 進階用戶
- 根據用途選擇 **High** 或 **Ultra** 模式
- 微調CRF值 (±2)
- 測試不同preset的效果

### 專業用戶
- 使用 **Ultra模式** + 自定義參數
- 基於VMAF/SSIM測試質量
- 考慮2-pass編碼控制比特率

---

## 相關文檔

- [05-VIDEO_QUALITY_PLAN.md](./05-VIDEO_QUALITY_PLAN.md) - 視頻畫質優化規劃
- [06-SUPERSAMPLING_IMPLEMENTATION.md](./06-SUPERSAMPLING_IMPLEMENTATION.md) - 超採樣技術實施

---

**文檔類型**: 快速參考手冊
**最後更新**: 2025-11-14
**版本**: 2.0
