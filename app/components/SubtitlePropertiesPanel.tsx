'use client';

import { useSubtitleStore, SubtitleSegment } from '../stores/subtitle-store';
import { HexColorPicker } from 'react-colorful';
import { useState } from 'react';
import { Type, Bold, Italic, Underline, Strikethrough, Palette, Eye, Square } from 'lucide-react';

interface SubtitlePropertiesPanelProps {
  selectedSegmentId: string | null;
  applyToAll: boolean;
  setApplyToAll: (value: boolean) => void;
}

export default function SubtitlePropertiesPanel({
  selectedSegmentId,
  applyToAll,
  setApplyToAll
}: SubtitlePropertiesPanelProps) {
  const { segments, updateSegment } = useSubtitleStore();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showOutlineColorPicker, setShowOutlineColorPicker] = useState(false);

  const selectedSegment = segments.find(seg => seg.id === selectedSegmentId);

  if (!selectedSegment) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Type size={48} className="mx-auto mb-4 opacity-50" />
          <p>請選擇字幕片段進行編輯</p>
        </div>
      </div>
    );
  }

  const updateStyle = (updates: Partial<SubtitleSegment['style']>) => {
    if (applyToAll) {
      // 套用到所有字幕
      segments.forEach(seg => {
        updateSegment(seg.id, {
          style: { ...seg.style, ...updates },
        });
      });
    } else {
      // 只更新選中的字幕
      updateSegment(selectedSegment.id, {
        style: { ...selectedSegment.style, ...updates },
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* 套用到所有字幕 */}
      <div className="flex items-center gap-2 p-3 bg-blue-900 border border-blue-700 rounded-lg">
        <input
          type="checkbox"
          id="apply-to-all"
          checked={applyToAll}
          onChange={(e) => setApplyToAll(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="apply-to-all" className="text-sm font-medium cursor-pointer">
          套用到所有字幕
        </label>
      </div>

      {/* 文字內容 */}
      <div>
        <label className="block text-sm font-medium mb-2">字幕內容</label>
        <textarea
          value={selectedSegment.text}
          onChange={(e) => updateSegment(selectedSegment.id, { text: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg resize-none focus:outline-none focus:border-blue-500"
          rows={3}
        />
      </div>

      {/* 譯文 */}
      {selectedSegment.translatedText && (
        <div>
          <label className="block text-sm font-medium mb-2">翻譯文字</label>
          <textarea
            value={selectedSegment.translatedText}
            onChange={(e) => updateSegment(selectedSegment.id, { translatedText: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg resize-none focus:outline-none focus:border-blue-500"
            rows={3}
          />
        </div>
      )}

      {/* 字型樣式 */}
      <div>
        <label className="block text-sm font-medium mb-2">樣式</label>
        <div className="flex gap-2">
          <button
            onClick={() => updateStyle({
              fontWeight: selectedSegment.style.fontWeight === 'bold' ? 'normal' : 'bold'
            })}
            className={`flex-1 px-3 py-2 rounded-lg border transition ${
              selectedSegment.style.fontWeight === 'bold'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
            }`}
          >
            <Bold size={18} className="mx-auto" />
          </button>
          <button
            onClick={() => updateStyle({
              fontStyle: selectedSegment.style.fontStyle === 'italic' ? 'normal' : 'italic'
            })}
            className={`flex-1 px-3 py-2 rounded-lg border transition ${
              selectedSegment.style.fontStyle === 'italic'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
            }`}
          >
            <Italic size={18} className="mx-auto" />
          </button>
          <button
            onClick={() => updateStyle({
              textDecoration: selectedSegment.style.textDecoration === 'underline' ? 'none' : 'underline'
            })}
            className={`flex-1 px-3 py-2 rounded-lg border transition ${
              selectedSegment.style.textDecoration === 'underline'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
            }`}
          >
            <Underline size={18} className="mx-auto" />
          </button>
          <button
            onClick={() => updateStyle({
              textDecoration: selectedSegment.style.textDecoration === 'line-through' ? 'none' : 'line-through'
            })}
            className={`flex-1 px-3 py-2 rounded-lg border transition ${
              selectedSegment.style.textDecoration === 'line-through'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
            }`}
          >
            <Strikethrough size={18} className="mx-auto" />
          </button>
        </div>
      </div>

      {/* 字型大小 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          字型大小: {selectedSegment.style.fontSize}px
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min="16"
            max="120"
            value={selectedSegment.style.fontSize}
            onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
            className="flex-1"
          />
          <input
            type="number"
            min="16"
            max="120"
            value={selectedSegment.style.fontSize}
            onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
            className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-center"
          />
        </div>
      </div>

      {/* 文字顏色 */}
      <div>
        <label className="block text-sm font-medium mb-2">文字顏色</label>
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
          >
            <div
              className="w-8 h-8 rounded border-2 border-gray-600"
              style={{ backgroundColor: selectedSegment.style.color }}
            />
            <span className="font-mono">{selectedSegment.style.color}</span>
          </button>
          {showColorPicker && (
            <div className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
              <HexColorPicker
                color={selectedSegment.style.color}
                onChange={(color) => updateStyle({ color })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 透明度 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          透明度: {Math.round(selectedSegment.style.opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={selectedSegment.style.opacity * 100}
          onChange={(e) => updateStyle({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full"
        />
      </div>

      {/* 描邊顏色 */}
      <div>
        <label className="block text-sm font-medium mb-2">描邊顏色</label>
        <div className="relative">
          <button
            onClick={() => setShowOutlineColorPicker(!showOutlineColorPicker)}
            className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
          >
            <div
              className="w-8 h-8 rounded border-2 border-gray-600"
              style={{ backgroundColor: selectedSegment.style.outlineColor }}
            />
            <span className="font-mono">{selectedSegment.style.outlineColor}</span>
          </button>
          {showOutlineColorPicker && (
            <div className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
              <HexColorPicker
                color={selectedSegment.style.outlineColor}
                onChange={(color) => updateStyle({ outlineColor: color })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 描邊寬度 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          描邊寬度: {selectedSegment.style.outlineWidth}px
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min="0"
            max="10"
            value={selectedSegment.style.outlineWidth}
            onChange={(e) => updateStyle({ outlineWidth: parseInt(e.target.value) })}
            className="flex-1"
          />
          <input
            type="number"
            min="0"
            max="10"
            value={selectedSegment.style.outlineWidth}
            onChange={(e) => updateStyle({ outlineWidth: parseInt(e.target.value) })}
            className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-center"
          />
        </div>
      </div>

      {/* 背景顏色 */}
      <div>
        <label className="block text-sm font-medium mb-2">背景顏色</label>
        <div className="space-y-2">
          <div className="relative">
            <button
              onClick={() => setShowBgColorPicker(!showBgColorPicker)}
              className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
              disabled={selectedSegment.style.backgroundColor === 'transparent'}
            >
              <div
                className="w-8 h-8 rounded border-2 border-gray-600"
                style={{
                  backgroundColor: selectedSegment.style.backgroundColor === 'transparent'
                    ? '#000000'
                    : selectedSegment.style.backgroundColor
                }}
              />
              <span className="font-mono">
                {selectedSegment.style.backgroundColor === 'transparent'
                  ? '透明'
                  : selectedSegment.style.backgroundColor}
              </span>
            </button>
            {showBgColorPicker && selectedSegment.style.backgroundColor !== 'transparent' && (
              <div className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
                <HexColorPicker
                  color={selectedSegment.style.backgroundColor}
                  onChange={(color) => updateStyle({ backgroundColor: color })}
                />
              </div>
            )}
          </div>
          <button
            onClick={() => updateStyle({
              backgroundColor: selectedSegment.style.backgroundColor === 'transparent' ? '#000000' : 'transparent'
            })}
            className={`w-full px-3 py-2 rounded-lg border transition ${
              selectedSegment.style.backgroundColor === 'transparent'
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
            }`}
          >
            {selectedSegment.style.backgroundColor === 'transparent' ? '✓ 透明背景' : '使用透明背景'}
          </button>
        </div>
      </div>

      {/* 垂直位置 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          垂直位置: {selectedSegment.style.positionY}%
        </label>
        <p className="text-xs text-gray-400 mb-2">提示: 也可以直接拖曳影片上的字幕</p>
        <input
          type="range"
          min="0"
          max="100"
          value={selectedSegment.style.positionY}
          onChange={(e) => updateStyle({ positionY: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  );
}