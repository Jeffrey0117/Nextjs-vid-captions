'use client';

import { useSubtitleStore } from '../stores/subtitle-store';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface BulkSubtitleEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkSubtitleEditor({ isOpen, onClose }: BulkSubtitleEditorProps) {
  const { segments, updateSegment } = useSubtitleStore();
  const [editedTexts, setEditedTexts] = useState<{ [key: string]: string }>({});

  // 初始化編輯文字
  useEffect(() => {
    if (isOpen) {
      const texts: { [key: string]: string } = {};
      segments.forEach(seg => {
        texts[seg.id] = seg.translatedText || seg.text;
      });
      setEditedTexts(texts);
    }
  }, [isOpen, segments]);

  const handleSave = () => {
    // 批量更新所有字幕
    Object.keys(editedTexts).forEach(id => {
      const segment = segments.find(s => s.id === id);
      if (segment) {
        if (segment.translatedText) {
          updateSegment(id, { translatedText: editedTexts[id] });
        } else {
          updateSegment(id, { text: editedTexts[id] });
        }
      }
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">批量編輯字幕</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* 字幕列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className="flex items-center gap-3 p-2 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition"
            >
              {/* 序號 */}
              <div className="flex-shrink-0 w-10 text-center">
                <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
              </div>

              {/* 文字編輯區 */}
              <input
                type="text"
                value={editedTexts[segment.id] || ''}
                onChange={(e) => setEditedTexts({
                  ...editedTexts,
                  [segment.id]: e.target.value
                })}
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded focus:outline-none focus:border-blue-500 text-sm"
                placeholder="字幕內容"
              />
            </div>
          ))}
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            共 {segments.length} 條字幕
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              儲存變更
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}