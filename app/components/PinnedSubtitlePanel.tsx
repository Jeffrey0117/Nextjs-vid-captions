'use client';

import { useSubtitleStore, PinnedSubtitle } from '../stores/subtitle-store';
import { Pin, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function PinnedSubtitlePanel() {
  const {
    pinnedSubtitles,
    updatePinnedSubtitle,
    togglePinnedSubtitle
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
  onToggle
}: {
  pinned: PinnedSubtitle;
  title: string;
  icon: React.ReactNode;
  onUpdate: (id: string, updates: Partial<PinnedSubtitle>) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
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
            <label className="block text-xs text-gray-400 mb-2">文字內容</label>
            <textarea
              value={pinned.text}
              onChange={(e) => onUpdate(pinned.id, { text: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              rows={2}
              placeholder="輸入字幕文字..."
            />
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
