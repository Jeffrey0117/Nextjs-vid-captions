'use client';

import { useSubtitleStore } from '../stores/subtitle-store';
import { X, Replace, Eye, EyeOff, Monitor, Move } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface BulkSubtitleEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkSubtitleEditor({ isOpen, onClose }: BulkSubtitleEditorProps) {
  const { tracks, updateSegment } = useSubtitleStore();
  const [editedTexts, setEditedTexts] = useState<{ [key: string]: string }>({});
  const [fontSize, setFontSize] = useState<number>(14);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [showReplace, setShowReplace] = useState<boolean>(false);
  const [showOriginalText, setShowOriginalText] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 50, y: 85 }); // 預設位置 (百分比)
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 從 tracks 計算 segments (reactive)
  const segments = tracks.length > 0 ? tracks[0].segments : [];

  // 初始化編輯文字和字體大小
  useEffect(() => {
    if (isOpen) {
      const texts: { [key: string]: string } = {};
      segments.forEach(seg => {
        texts[seg.id] = seg.translatedText || seg.text;
      });
      setEditedTexts(texts);
      
      // 從 localStorage 讀取字體大小
      const savedFontSize = localStorage.getItem('bulkEditorFontSize');
      if (savedFontSize) {
        setFontSize(Number(savedFontSize));
      }
    }
  }, [isOpen, segments]);

  // 儲存字體大小到 localStorage
  useEffect(() => {
    localStorage.setItem('bulkEditorFontSize', fontSize.toString());
  }, [fontSize]);

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

  const handleReplaceAll = () => {
    if (!findText) return;
    
    const newTexts = { ...editedTexts };
    Object.keys(newTexts).forEach(id => {
      newTexts[id] = newTexts[id].replaceAll(findText, replaceText);
    });
    setEditedTexts(newTexts);
  };

  const handleReplaceCurrent = (segmentId: string) => {
    if (!findText) return;
    
    setEditedTexts({
      ...editedTexts,
      [segmentId]: editedTexts[segmentId]?.replaceAll(findText, replaceText) || ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h2 className="text-base font-bold">批量編輯字幕</h2>
          <div className="flex items-center gap-3">
            {/* 顯示原文按鈕 */}
            <button
              onClick={() => setShowOriginalText(!showOriginalText)}
              className={`p-1.5 hover:bg-gray-800 rounded transition ${showOriginalText ? 'bg-green-600' : ''}`}
              title="顯示原文參考"
            >
              {showOriginalText ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            {/* 取代功能按鈕 */}
            <button
              onClick={() => setShowReplace(!showReplace)}
              className={`p-1.5 hover:bg-gray-800 rounded transition ${showReplace ? 'bg-blue-600' : ''}`}
              title="尋找與取代"
            >
              <Replace size={16} />
            </button>
            {/* 字體大小控制 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">字體:</span>
              <input
                type="range"
                min="10"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs text-gray-400 w-8">{fontSize}px</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 rounded transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 取代功能區 */}
        {showReplace && (
          <div className="p-3 border-b border-gray-700 bg-gray-800/50 space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="尋找文字..."
                className="flex-1 px-2 py-1.5 text-xs bg-gray-900 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="取代為..."
                className="flex-1 px-2 py-1.5 text-xs bg-gray-900 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleReplaceAll}
                disabled={!findText}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition"
              >
                全部取代
              </button>
            </div>
            <p className="text-[0.65rem] text-gray-400">
              輸入要尋找的文字和取代內容,點擊「全部取代」可一次取代所有字幕中的文字
            </p>
          </div>
        )}

        {/* 字幕列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className="p-1.5 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition"
            >
              <div className="flex items-center gap-2">
                {/* 序號 */}
                <div className="flex-shrink-0 w-8 text-center">
                  <span className="text-[0.65rem] font-bold text-gray-400">#{index + 1}</span>
                </div>

                {/* 文字編輯區 */}
                <input
                  type="text"
                  value={editedTexts[segment.id] || ''}
                  onChange={(e) => setEditedTexts({
                    ...editedTexts,
                    [segment.id]: e.target.value
                  })}
                  style={{ fontSize: `${fontSize}px` }}
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                  placeholder="字幕內容"
                />

                {/* 單條取代按鈕 */}
                {showReplace && findText && (
                  <button
                    onClick={() => handleReplaceCurrent(segment.id)}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition text-[0.65rem]"
                    title="取代此條字幕"
                  >
                    取代
                  </button>
                )}
              </div>
              
              {/* 原文顯示區 */}
              {showOriginalText && segment.text && (
                <div className="mt-1 ml-10 px-2 py-1 bg-gray-900/50 rounded text-gray-400 text-sm border-l-2 border-gray-600">
                  <span className="text-xs text-gray-500 mr-2">原文:</span>
                  {segment.text}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between p-3 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            共 {segments.length} 條字幕
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              儲存變更
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}