'use client';

import { useSubtitleStore, PinnedSubtitle } from '../stores/subtitle-store';
import { Pin, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

export default function PinnedSubtitlePanel() {
  const {
    pinnedSubtitles,
    updatePinnedSubtitle,
    togglePinnedSubtitle,
    tracks,
  } = useSubtitleStore();

  // 使用 useMemo 避免無限循環
  const segments = useMemo(() => {
    return tracks
      .filter(t => t.visible && !t.muted)
      .flatMap(t => t.segments)
      .sort((a, b) => a.startTime - b.startTime);
  }, [tracks]);

  // Debug: 確認 segments 是否正確取得
  console.log('🔍 PinnedSubtitlePanel - segments 數量:', segments?.length || 0);

  const topPinned = pinnedSubtitles.find(p => p.position === 'top');
  const bottomPinned = pinnedSubtitles.find(p => p.position === 'bottom');

  return (
    <div className="h-full overflow-y-auto space-y-4 p-4">
      <h2 className="text-lg font-bold mb-4">固定字幕</h2>

      {/* 頂部固定字幕 */}
      {topPinned && (
        <PinnedSubtitleEditor
          pinned={topPinned}
          title="頂部標題"
          icon={<Pin size={18} />}
          onUpdate={updatePinnedSubtitle}
          onToggle={togglePinnedSubtitle}
          segments={segments}
        />
      )}

      {/* 底部浮水印 */}
      {bottomPinned && (
        <PinnedSubtitleEditor
          pinned={bottomPinned}
          title="底部浮水印"
          icon={<Pin size={18} className="rotate-180" />}
          onUpdate={updatePinnedSubtitle}
          onToggle={togglePinnedSubtitle}
        />
      )}
    </div>
  );
}

// 子元件：單個固定字幕編輯器
function PinnedSubtitleEditor({
  pinned,
  title,
  icon,
  onUpdate,
  onToggle,
  segments
}: {
  pinned: PinnedSubtitle;
  title: string;
  icon: React.ReactNode;
  onUpdate: (id: string, updates: Partial<PinnedSubtitle>) => void;
  onToggle: (id: string, enabled: boolean) => void;
  segments?: any[];
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTitles, setGeneratedTitles] = useState<{
    viral: string;
    funny: string;
    mystery: string;
  } | null>(null);
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);

  const handleGenerateTitle = async () => {
    console.log('📝 handleGenerateTitle 被調用，segments:', segments?.length);

    if (!segments || segments.length === 0) {
      console.error('❌ 沒有字幕內容');
      toast.error('沒有字幕內容可供分析');
      return;
    }

    console.log('🚀 開始生成標題，字幕數量:', segments.length);
    setIsGenerating(true);
    setGeneratedTitles(null);

    try {
      console.log('📤 發送 API 請求到 /api/generate-title');
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subtitles: segments }),
      });

      console.log('📥 收到 API 回應，狀態:', response.status);

      // 先讀取 response 為文本（只能讀一次）
      const responseText = await response.text();

      // 檢查 HTTP 狀態
      if (!response.ok) {
        let errorMessage = `API 請求失敗 (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // 解析成功響應
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON 解析失敗:', parseError);
        console.error('響應內容:', responseText ? responseText.substring(0, 200) : '(empty)');
        throw new Error('API 返回格式錯誤');
      }

      console.log('📄 API 回應資料:', data);

      if (!data.success) {
        const errorMsg = data.error || 'AI 生成失敗';
        if (data.details) {
          console.error('詳細錯誤:', data.details);
        }
        throw new Error(errorMsg);
      }

      setGeneratedTitles(data.titles);
      setShowTitleDropdown(true);
      toast.success('AI 標題生成完成！');
      console.log('✅ 標題生成成功:', data.titles);
    } catch (error: any) {
      console.error('❌ AI 標題生成錯誤:', error);
      toast.error(`生成失敗: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyTitle = (e: React.MouseEvent, titleType: 'viral' | 'funny' | 'mystery') => {
    e.preventDefault();
    e.stopPropagation();
    if (generatedTitles) {
      onUpdate(pinned.id, { text: generatedTitles[titleType] });
      // 不關閉 dropdown，讓用戶可以繼續選擇其他標題
      toast.success('標題已套用！');
    }
  };
  return (
    <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
      {/* 標題欄 + 啟用開關 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-purple-400">{icon}</div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pinned.enabled}
            onChange={(e) => onToggle(pinned.id, e.target.checked)}
            className="w-4 h-4 accent-purple-600"
          />
          <span className="text-sm">啟用</span>
        </label>
      </div>

      {pinned.enabled && (
        <>
          {/* 文字內容 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-gray-400">文字內容</label>
              {(() => {
                const shouldShowButton = segments && segments.length > 0 && pinned.position === 'top';
                console.log('✨ AI按鈕渲染檢查:', {
                  hasSegments: !!segments,
                  segmentsCount: segments?.length || 0,
                  isTopPosition: pinned.position === 'top',
                  shouldShowButton
                });
                return shouldShowButton ? (
                  <button
                    onClick={() => {
                      console.log('🎯 AI生成標題按鈕被點擊！');
                      handleGenerateTitle();
                    }}
                    disabled={isGenerating}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        <span>AI生成標題</span>
                      </>
                    )}
                  </button>
                ) : null;
              })()}
            </div>
            <textarea
              value={pinned.text}
              onChange={(e) => onUpdate(pinned.id, { text: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              rows={2}
              placeholder="輸入字幕文字..."
            />

            {/* AI 生成的標題選項 */}
            {showTitleDropdown && generatedTitles && (
              <div className="mt-3 p-3 bg-gray-900 border border-purple-500/50 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="text-sm font-semibold text-purple-400">AI 生成的標題建議</span>
                  </div>
                  <button
                    onClick={() => setShowTitleDropdown(false)}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    關閉
                  </button>
                </div>

                {/* 病毒式傳播標題 */}
                <button
                  onClick={(e) => handleApplyTitle(e, 'viral')}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-pink-500 transition-all group"
                >
                  <div className="text-xs text-pink-400 mb-1">🚀 病毒式傳播</div>
                  <div className="text-sm text-gray-200 group-hover:text-white">{generatedTitles.viral}</div>
                </button>

                {/* 搞笑直球標題 */}
                <button
                  onClick={(e) => handleApplyTitle(e, 'funny')}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-yellow-500 transition-all group"
                >
                  <div className="text-xs text-yellow-400 mb-1">😂 搞笑直球</div>
                  <div className="text-sm text-gray-200 group-hover:text-white">{generatedTitles.funny}</div>
                </button>

                {/* 懸念式標題 */}
                <button
                  onClick={(e) => handleApplyTitle(e, 'mystery')}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-purple-500 transition-all group"
                >
                  <div className="text-xs text-purple-400 mb-1">❓ 懸念式</div>
                  <div className="text-sm text-gray-200 group-hover:text-white">{generatedTitles.mystery}</div>
                </button>
              </div>
            )}
          </div>

          {/* 樣式控制 */}
          <div className="space-y-3">
            {/* 字體大小 */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                字體大小: {pinned.style.fontSize}px
              </label>
              <input
                type="range"
                min="16"
                max="80"
                value={pinned.style.fontSize}
                onChange={(e) => onUpdate(pinned.id, {
                  style: { ...pinned.style, fontSize: parseInt(e.target.value) }
                })}
                className="w-full"
              />
            </div>

            {/* 透明度 */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                透明度: {Math.round(pinned.style.opacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={pinned.style.opacity * 100}
                onChange={(e) => onUpdate(pinned.id, {
                  style: { ...pinned.style, opacity: parseInt(e.target.value) / 100 }
                })}
                className="w-full"
              />
            </div>

            {/* 垂直位置 */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">
                垂直位置: {pinned.style.positionY}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={pinned.style.positionY}
                onChange={(e) => onUpdate(pinned.id, {
                  style: { ...pinned.style, positionY: parseInt(e.target.value) }
                })}
                className="w-full"
              />
            </div>

            {/* 文字顏色 */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">文字顏色</label>
              <input
                type="color"
                value={pinned.style.color}
                onChange={(e) => onUpdate(pinned.id, {
                  style: { ...pinned.style, color: e.target.value }
                })}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>

            {/* 背景顏色（僅頂部固定字幕） */}
            {pinned.position === 'top' && (
              <div>
                <label className="block text-xs text-gray-400 mb-2">背景顏色</label>
                <input
                  type="color"
                  value={pinned.style.backgroundColor === 'transparent' ? '#000000' : pinned.style.backgroundColor}
                  onChange={(e) => onUpdate(pinned.id, {
                    style: { ...pinned.style, backgroundColor: e.target.value }
                  })}
                  className="w-full h-10 rounded cursor-pointer"
                />
                <button
                  onClick={() => onUpdate(pinned.id, {
                    style: { ...pinned.style, backgroundColor: 'transparent' }
                  })}
                  className="mt-2 text-xs text-gray-400 hover:text-white"
                >
                  設為透明
                </button>
              </div>
            )}

            {/* 字體粗細 */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">字體粗細</label>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate(pinned.id, {
                    style: { ...pinned.style, fontWeight: 'normal' }
                  })}
                  className={`flex-1 px-3 py-2 rounded text-sm ${
                    pinned.style.fontWeight === 'normal'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  正常
                </button>
                <button
                  onClick={() => onUpdate(pinned.id, {
                    style: { ...pinned.style, fontWeight: 'bold' }
                  })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-bold ${
                    pinned.style.fontWeight === 'bold'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  粗體
                </button>
              </div>
            </div>

            {/* 描邊設置 */}
            <div className="pt-3 border-t border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">描邊</label>
                <input
                  type="checkbox"
                  checked={pinned.style.enableStroke}
                  onChange={(e) => onUpdate(pinned.id, {
                    style: { ...pinned.style, enableStroke: e.target.checked }
                  })}
                  className="w-4 h-4 accent-purple-600"
                />
              </div>

              {pinned.style.enableStroke && (
                <div className="space-y-3 mt-2">
                  {/* 描邊顏色 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">描邊顏色</label>
                    <input
                      type="color"
                      value={pinned.style.strokeColor}
                      onChange={(e) => onUpdate(pinned.id, {
                        style: { ...pinned.style, strokeColor: e.target.value }
                      })}
                      className="w-full h-10 rounded cursor-pointer"
                    />
                  </div>

                  {/* 描邊寬度 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      描邊寬度: {pinned.style.strokeWidth}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={pinned.style.strokeWidth}
                      onChange={(e) => onUpdate(pinned.id, {
                        style: { ...pinned.style, strokeWidth: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 陰影設置 */}
            <div className="pt-3 border-t border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">陰影</label>
                <input
                  type="checkbox"
                  checked={pinned.style.enableShadow}
                  onChange={(e) => onUpdate(pinned.id, {
                    style: { ...pinned.style, enableShadow: e.target.checked }
                  })}
                  className="w-4 h-4 accent-purple-600"
                />
              </div>

              {pinned.style.enableShadow && (
                <div className="space-y-3 mt-2">
                  {/* 陰影顏色 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">陰影顏色</label>
                    <input
                      type="color"
                      value={pinned.style.shadowColor}
                      onChange={(e) => onUpdate(pinned.id, {
                        style: { ...pinned.style, shadowColor: e.target.value }
                      })}
                      className="w-full h-10 rounded cursor-pointer"
                    />
                  </div>

                  {/* 陰影 X 偏移 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      陰影 X 偏移: {pinned.style.shadowOffsetX}px
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={pinned.style.shadowOffsetX}
                      onChange={(e) => onUpdate(pinned.id, {
                        style: { ...pinned.style, shadowOffsetX: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>

                  {/* 陰影 Y 偏移 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      陰影 Y 偏移: {pinned.style.shadowOffsetY}px
                    </label>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={pinned.style.shadowOffsetY}
                      onChange={(e) => onUpdate(pinned.id, {
                        style: { ...pinned.style, shadowOffsetY: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>

                  {/* 陰影模糊 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      陰影模糊: {pinned.style.shadowBlur}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={pinned.style.shadowBlur}
                      onChange={(e) => onUpdate(pinned.id, {
                        style: { ...pinned.style, shadowBlur: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
