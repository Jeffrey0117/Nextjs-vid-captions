'use client';

import { useSubtitleStore, PinnedSubtitle } from '../stores/subtitle-store';
import { Pin, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function PinnedSubtitlePanel() {
  const {
    pinnedSubtitles,
    updatePinnedSubtitle,
    togglePinnedSubtitle,
    segments
  } = useSubtitleStore();

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
    catchy: string;
    informative: string;
    professional: string;
  } | null>(null);
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);

  const handleGenerateTitle = async () => {
    if (!segments || segments.length === 0) {
      toast.error('沒有字幕內容可供分析');
      return;
    }

    setIsGenerating(true);
    setGeneratedTitles(null);

    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subtitles: segments }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'AI 生成失敗');
      }

      setGeneratedTitles(data.titles);
      setShowTitleDropdown(true);
      toast.success('AI 標題生成完成！');
    } catch (error: any) {
      console.error('AI 標題生成錯誤:', error);
      toast.error(`生成失敗: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyTitle = (titleType: 'catchy' | 'informative' | 'professional') => {
    if (generatedTitles) {
      onUpdate(pinned.id, { text: generatedTitles[titleType] });
      setShowTitleDropdown(false);
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
              {segments && pinned.position === 'top' && (
                <button
                  onClick={handleGenerateTitle}
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
              )}
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

                {/* 吸睛標題 */}
                <button
                  onClick={() => handleApplyTitle('catchy')}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-orange-500 transition-all group"
                >
                  <div className="text-xs text-orange-400 mb-1">🔥 吸睛標題</div>
                  <div className="text-sm text-gray-200 group-hover:text-white">{generatedTitles.catchy}</div>
                </button>

                {/* 資訊標題 */}
                <button
                  onClick={() => handleApplyTitle('informative')}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-blue-500 transition-all group"
                >
                  <div className="text-xs text-blue-400 mb-1">📋 資訊標題</div>
                  <div className="text-sm text-gray-200 group-hover:text-white">{generatedTitles.informative}</div>
                </button>

                {/* 專業標題 */}
                <button
                  onClick={() => handleApplyTitle('professional')}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 hover:border-green-500 transition-all group"
                >
                  <div className="text-xs text-green-400 mb-1">🎓 專業標題</div>
                  <div className="text-sm text-gray-200 group-hover:text-white">{generatedTitles.professional}</div>
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
          </div>
        </>
      )}
    </div>
  );
}
