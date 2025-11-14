# FFmpeg质量参数快速参考

## 快速对比表

| 模式 | CRF | Preset | 色彩采样 | 用途 | 文件大小* | 编码时间* |
|------|-----|--------|----------|------|-----------|-----------|
| **Fast** | 28 | veryfast | 4:2:0 | 预览/草稿 | 0.5x | 0.3x |
| **Balanced** | 23 | medium | 4:2:0 | 日常使用 | 1x | 1x |
| **High** | 16 | slow | 4:2:0 | 重要项目 | 2.5x | 1.8x |
| **Ultra** | 15 | veryslow | 4:4:4 | 专业/归档 | 4.5x | 3.5x |

*相对于Balanced模式

---

## 核心参数速查

### Ultra模式 (Near-Lossless)
```bash
-preset veryslow -crf 15 -pix_fmt yuv444p
-tune film -profile:v high444
-g 10 -bf 8 -refs 6
-me_method umh -subme 10 -trellis 2
-aq-mode 3 -psy-rd 1.0:0.15
```
**适用**: 专业制作、长期归档、展示
**注意**: 需要现代播放器支持yuv444p

### High模式
```bash
-preset slow -crf 16 -pix_fmt yuv420p
-tune film -g 15 -bf 5 -refs 4
-me_method umh -subme 8
```
**适用**: 最终输出、重要项目
**兼容**: 所有播放器

### Balanced模式
```bash
-preset medium -crf 18 -pix_fmt yuv420p
-g 25 -bf 3
```
**适用**: 日常使用
**推荐**: 大多数场景

---

## CRF值速查

| CRF | 质量等级 | 视觉效果 | 推荐场景 |
|-----|----------|----------|----------|
| 0 | 无损 | 完美 | 中间文件 |
| 10-15 | Near-Lossless | 极佳 | 归档/专业 |
| 16-18 | 高质量 | 优秀 | 最终输出 |
| 19-23 | 标准质量 | 良好 | 日常使用 |
| 24-28 | 中等质量 | 可接受 | 预览/草稿 |
| 29-35 | 低质量 | 明显压缩 | 快速测试 |
| 36-51 | 极低质量 | 严重失真 | 不推荐 |

**原则**: CRF每减少1，文件大小约增加10-15%

---

## 色度采样对比

| 格式 | 色度分辨率 | 兼容性 | 文件大小 | 质量 |
|------|------------|--------|----------|------|
| yuv420p | 4:2:0 | 通用 | 小 | 良好 |
| yuv422p | 4:2:2 | 中等 | 中等 | 很好 |
| yuv444p | 4:4:4 | 有限 | 大 | 最佳 |

**建议**:
- 通用用途 → yuv420p
- 专业制作 → yuv444p

---

## 编码速度对比

| Preset | 速度 | 质量 | 编码时间 | 文件大小 |
|--------|------|------|----------|----------|
| ultrafast | 最快 | 最低 | 0.2x | 最大 |
| veryfast | 很快 | 低 | 0.4x | 大 |
| fast | 快 | 中低 | 0.6x | 较大 |
| medium | 中等 | 中等 | 1x | 中等 |
| slow | 慢 | 高 | 1.5x | 较小 |
| veryslow | 很慢 | 很高 | 3x | 小 |

**原则**: 慢preset提高压缩效率，减小文件，但编码时间增加

---

## 使用场景推荐

### 快速预览/测试
```bash
-preset veryfast -crf 28
```
- 编码速度: 极快
- 适合: 实时预览、快速迭代

### 日常工作流
```bash
-preset medium -crf 23
```
- 平衡: 速度与质量
- 适合: 大多数场景

### 重要项目输出
```bash
-preset slow -crf 16 -tune film
```
- 优先: 质量
- 适合: 客户交付、重要视频

### 专业归档/展示
```bash
-preset veryslow -crf 15 -pix_fmt yuv444p -profile:v high444
```
- 极致: Near-lossless质量
- 适合: 长期保存、专业制作

---

## 参数优化技巧

### 减小文件大小（保持质量）
1. 使用slower/veryslow preset
2. 增加B帧: `-bf 8`
3. 增加参考帧: `-refs 5-6`

### 提升编码速度（牺牲质量）
1. 使用faster preset
2. 减少B帧: `-bf 0-2`
3. 减少参考帧: `-refs 1-2`

### 极致质量（不计代价）
```bash
-preset veryslow -crf 12 -pix_fmt yuv444p
-tune film -profile:v high444
-g 5 -bf 16 -refs 8
-me_method tesa -subme 11 -trellis 2
-aq-mode 3 -psy-rd 1.2:0.2
```

---

## 常见问题解决

### 播放器不支持yuv444p
```bash
# 转换为yuv420p
ffmpeg -i input.mp4 -pix_fmt yuv420p output.mp4
```

### 文件太大
```bash
# 提高CRF（质量稍降）
-crf 18  # 从15/16提高

# 或使用2-pass编码指定比特率
ffmpeg -i input -c:v libx264 -b:v 5M -pass 1 -f null /dev/null
ffmpeg -i input -c:v libx264 -b:v 5M -pass 2 output.mp4
```

### 编码太慢
```bash
# 降低preset
-preset slow  # 从veryslow降低

# 减少高级参数
# 移除 -trellis, -psy-rd, 减少 -refs
```

---

## GOP (关键帧间隔) 指南

| GOP大小 | 场景 | 优点 | 缺点 |
|---------|------|------|------|
| 5-10 | 高动态、剪辑 | 更好随机访问 | 文件较大 |
| 10-15 | 平衡 | 质量与大小平衡 | - |
| 15-30 | 低动态、流媒体 | 文件较小 | 随机访问慢 |

**公式**: GOP = FPS × 秒数
**示例**: 30fps × 0.5秒 = 15帧

---

## B帧数量指南

| B帧数 | 场景 | 编码时间 | 压缩率 |
|-------|------|----------|--------|
| 0 | 快速编码 | 最快 | 低 |
| 3 | 平衡 | 快 | 中 |
| 5-8 | 高质量 | 慢 | 高 |
| 16 | 极致压缩 | 很慢 | 极高 |

**建议**:
- 快速: 0-2
- 标准: 3-5
- 高质量: 5-8

---

## 参考帧数量

| Refs | 内存使用 | 质量提升 | 编码时间 |
|------|----------|----------|----------|
| 1 | 低 | 基准 | 快 |
| 3 | 中 | +5% | +20% |
| 5 | 高 | +8% | +40% |
| 8 | 很高 | +10% | +60% |

**建议**:
- 快速: 1-2
- 平衡: 3-4
- 高质量: 5-6
- 极致: 8+

---

## 命令行示例

### 基础编码
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 output.mp4
```

### 高质量编码
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 16 \
  -tune film -g 15 -bf 5 -refs 4 \
  -me_method umh -subme 8 \
  output.mp4
```

### Near-Lossless编码
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset veryslow -crf 15 \
  -pix_fmt yuv444p -profile:v high444 -tune film \
  -g 10 -bf 8 -refs 6 \
  -me_method umh -subme 10 -trellis 2 \
  -aq-mode 3 -psy-rd 1.0:0.15 \
  output.mp4
```

### 带滤镜的高质量编码
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:0.5:5:5:0" \
  -c:v libx264 -preset slow -crf 16 -tune film \
  output.mp4
```

---

## 质量验证命令

### 查看视频信息
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,pix_fmt,bit_rate \
  output.mp4
```

### 对比两个视频质量
```bash
# 使用SSIM
ffmpeg -i distorted.mp4 -i reference.mp4 \
  -lavfi ssim -f null -

# 使用PSNR
ffmpeg -i distorted.mp4 -i reference.mp4 \
  -lavfi psnr -f null -
```

---

## 移动端/Web优化

### H.264 Baseline Profile (最大兼容性)
```bash
-profile:v baseline -level 3.0 -pix_fmt yuv420p
```

### H.264 Main Profile (平衡)
```bash
-profile:v main -level 4.0 -pix_fmt yuv420p
```

### H.264 High Profile (桌面/现代设备)
```bash
-profile:v high -level 4.2 -pix_fmt yuv420p
```

---

## 总结建议

### 新手用户
- 使用 **Balanced模式** (CRF 23, medium preset)
- 不调整其他参数
- 测试编码时间和文件大小

### 进阶用户
- 根据用途选择 **High** 或 **Ultra** 模式
- 微调CRF值 (±2)
- 测试不同preset的效果

### 专业用户
- 使用 **Ultra模式** + 自定义参数
- 基于VMAF/SSIM测试质量
- 2-pass编码控制比特率

---

**最后更新**: 2025-11-14
**版本**: 2.0
