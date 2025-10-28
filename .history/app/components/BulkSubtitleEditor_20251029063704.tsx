'use client';

import { useSubtitleStore } from '../stores/subtitle-store';
import { X, Replace, Eye, EyeOff, Monitor, Move } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface BulkSubtitleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string; // 添加影片 URL 參數
}

export default function BulkSubtitleEditor({ isOpen, onClose, videoUrl }: BulkSubtitleEditorProps) {
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
  const [previewTime, setPreviewTime] = useState(1); // 預覽時間（秒）
  const [videoError, setVideoError] = useState(false); // 影片載入錯誤狀態
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 調試：檢查 videoUrl
  useEffect(() => {
    if (isOpen) {
      console.log('BulkSubtitleEditor videoUrl:', videoUrl);
    }
  }, [isOpen, videoUrl]);

  // 處理不同格式的影片 URL
  const getVideoSrc = (url: string): string => {
    // 如果是相對路徑（/temp/video_xxx.mp4），轉換為完整 URL
    if (url.startsWith('/temp/')) {
      return url; // 相對路徑，瀏覽器會自動補全
    }
    // 如果是 data: URL 或 blob: URL，直接使用
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    // 如果是完整 HTTP URL，直接使用
    if (url.startsWith('http')) {
      return url;
    }
    // 其他情況，假設是相對路徑
    return url;
  };

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
      
      // 載入第一個字幕的位置作為預設位置
      if (segments.length > 0 && segments[0].style) {
        setSubtitlePosition({
          x: segments[0].style.positionX || 50,
          y: segments[0].style.positionY || 85
        });
      }
    }
  }, [isOpen, segments]);

  // 儲存字體大小到 localStorage
  useEffect(() => {
    localStorage.setItem('bulkEditorFontSize', fontSize.toString());
  }, [fontSize]);

  // 處理全域滑鼠事件以支援拖拽
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !previewRef.current) return;
      
      const rect = previewRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      
      setSubtitlePosition({ x, y });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  // 處理預覽時間變化
  useEffect(() => {
    if (videoRef.current && showPreview) {
      const video = videoRef.current;
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA 或更高
        video.currentTime = previewTime;
        video.pause(); // 確保暫停
      }
    }
  }, [previewTime, showPreview]);

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
    
    // 顯示儲存成功訊息，但不自動關閉
    alert(`已儲存 ${segments.length} 條字幕的文字變更`);
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

  // 處理字幕位置拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updatePosition(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    updatePosition(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updatePosition = (e: React.MouseEvent) => {
    if (!previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    
    setSubtitlePosition({ x, y });
  };

  // 套用位置變更到所有字幕
  const applyPositionToAll = () => {
    // 批量更新所有字幕的位置
    segments.forEach(segment => {
      updateSegment(segment.id, {
        style: {
          ...segment.style,
          positionX: subtitlePosition.x,
          positionY: subtitlePosition.y
        }
      });
    });
    
    alert(`字幕位置已套用到 ${segments.length} 條字幕\nX: ${subtitlePosition.x.toFixed(1)}%, Y: ${subtitlePosition.y.toFixed(1)}%`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h2 className="text-base font-bold">批量編輯字幕</h2>
          <div className="flex items-center gap-3">
            {/* 字幕位置預覽按鈕 */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-1.5 hover:bg-gray-800 rounded transition ${showPreview ? 'bg-purple-600' : ''}`}
              title="調整字幕位置"
            >
              <Monitor size={16} />
            </button>
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

        {/* 字幕位置預覽區 */}
        {showPreview && (
          <div className="border-t border-gray-700 p-3 bg-gray-800/50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-300">字幕位置調整</h3>
              <div className="flex items-center gap-2">
                {videoUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">預覽時間:</span>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="0.5"
                      value={previewTime}
                      onChange={(e) => {
                        const time = Number(e.target.value);
                        setPreviewTime(time);
                        if (videoRef.current) {
                          // 確保影片已載入後再設定時間
                          if (videoRef.current.readyState >= 2) {
                            videoRef.current.currentTime = time;
                          }
                        }
                      }}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-8">{previewTime.toFixed(1)}s</span>
                  </div>
                )}
                <button
                  onClick={applyPositionToAll}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition"
                >
                  套用到所有字幕
                </button>
              </div>
            </div>
            <div 
              ref={previewRef}
              className="relative w-full bg-black rounded border border-gray-600 overflow-hidden cursor-crosshair flex items-center justify-center"
              style={{ height: '400px' }} // 更高的高度
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* 真實影片畫面 */}
              {videoUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={getVideoSrc(videoUrl)}
                    className="max-w-full max-h-full object-contain"
                    style={{ 
                      width: 'auto', 
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: '100%'
                    }}
                    muted
                    playsInline
                    preload="metadata"
                    controls={false}
                    crossOrigin="anonymous"
                    onLoadedMetadata={() => {
                      console.log('影片元數據載入完成');
                      if (videoRef.current) {
                        videoRef.current.currentTime = previewTime;
                      }
                    }}
                    onSeeked={() => {
                      console.log('影片跳轉到時間:', previewTime);
                      if (videoRef.current && !videoRef.current.paused) {
                        videoRef.current.pause();
                      }
                    }}
                    onLoadStart={() => {
                      console.log('開始載入影片:', videoUrl);
                      console.log('處理後的 src:', getVideoSrc(videoUrl));
                    }}
                    onError={(e) => {
                      console.error('影片載入錯誤:', e);
                      console.error('原始 URL:', videoUrl);
                      console.error('處理後 URL:', getVideoSrc(videoUrl));
                      console.error('錯誤詳情:', e.target);
                    }}
                    onCanPlay={() => {
                      console.log('影片可以播放');
                      if (videoRef.current) {
                        videoRef.current.currentTime = previewTime;
                        videoRef.current.pause();
                      }
                    }}
                  />
                  {/* 載入錯誤時的備用顯示 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50" 
                       id="video-error-fallback" 
                       style={{ display: 'none' }}>
                    <div className="text-center">
                      <span className="text-gray-400 text-sm">影片載入失敗</span>
                      <br />
                      <span className="text-gray-500 text-xs">URL: {videoUrl}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">影片預覽區域</span>
                </div>
              )}
              
              {/* 字幕預覽 */}
              <div
                className="absolute text-white px-3 py-2 rounded-lg font-medium shadow-lg cursor-move select-none border border-purple-500/50"
                style={{
                  left: `${subtitlePosition.x}%`,
                  top: `${subtitlePosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                  fontSize: '16px',
                  lineHeight: '1.4',
                }}
                onMouseDown={handleMouseDown}
              >
                <div className="flex items-center justify-center gap-1">
                  <Move size={14} className="text-purple-400" />
                  <span>範例字幕文字</span>
                </div>
              </div>
              
              {/* 位置資訊顯示 */}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                X: {subtitlePosition.x.toFixed(1)}%, Y: {subtitlePosition.y.toFixed(1)}%
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {videoUrl 
                ? "調整時間滑桿來選擇影片畫面，拖拽字幕到想要的位置，然後點擊「套用到所有字幕」" 
                : "拖拽字幕到想要的位置，然後點擊「套用到所有字幕」來批量調整位置"
              }
            </p>
          </div>
        )}

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between p-3 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            共 {segments.length} 條字幕
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              儲存文字變更
            </button>
            <button
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded-lg transition"
            >
              完成並關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}