'use client';

import { useSubtitleStore } from '../stores/subtitle-store';
import { X, Replace, Eye, EyeOff, Monitor, Move, Languages } from 'lucide-react';
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
  const [subtitleFontSize, setSubtitleFontSize] = useState(16); // 字體大小 (px)
  const [isTranslating, setIsTranslating] = useState(false); // 翻譯進行中
  const [translationProgress, setTranslationProgress] = useState(0); // 翻譯進度
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

  // 初始化樣式 - 從第一個字幕段獲取現有樣式（只在開啟時執行一次）
  useEffect(() => {
    if (isOpen && segments.length > 0) {
      const firstSegment = segments[0];
      if (firstSegment.style) {
        // 設置字體大小
        if (firstSegment.style.fontSize) {
          setSubtitleFontSize(firstSegment.style.fontSize);
        }
        // 設置位置
        if (firstSegment.style.positionX !== undefined && firstSegment.style.positionY !== undefined) {
          setSubtitlePosition({ 
            x: firstSegment.style.positionX, 
            y: firstSegment.style.positionY 
          });
        }
      }
    }
  }, [isOpen]); // 移除 segments 依賴，只在開啟時執行

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
    
    // 即時套用位置到所有字幕
    applyPositionToAllSegments(x, y);
  };

  // 套用位置到所有字幕
  const applyPositionToAllSegments = (x: number, y: number) => {
    if (segments.length > 0) {
      segments.forEach(segment => {
        updateSegment(segment.id, {
          style: {
            ...segment.style,
            positionX: x,
            positionY: y
          }
        });
      });
    }
  };

  // 套用字體大小到所有字幕
  const applyFontSizeToAllSegments = (fontSize: number) => {
    if (segments.length > 0) {
      segments.forEach(segment => {
        updateSegment(segment.id, {
          style: {
            ...segment.style,
            fontSize: fontSize
          }
        });
      });
    }
  };

  // DeepL 翻譯功能
  const translateAllSubtitles = async () => {
    if (segments.length === 0) {
      alert('沒有字幕可以翻譯');
      return;
    }

    setIsTranslating(true);
    setTranslationProgress(0);

    try {
      // 批量翻譯所有字幕
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // 如果沒有翻譯文字，就翻譯原文
        const textToTranslate = segment.translatedText || segment.text;
        
        if (textToTranslate && textToTranslate.trim()) {
          try {
            const response = await fetch('/api/deepl-translate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: textToTranslate }),
            });

            if (!response.ok) {
              throw new Error(`翻譯請求失敗: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success && data.translatedText) {
              // 更新字幕的翻譯文字
              updateSegment(segment.id, {
                translatedText: data.translatedText
              });
              
              // 同時更新編輯狀態中的文字
              setEditedTexts(prev => ({
                ...prev,
                [segment.id]: data.translatedText
              }));
            }
          } catch (error) {
            console.error(`翻譯字幕 ${i + 1} 失敗:`, error);
            // 繼續翻譯其他字幕，不中斷整個過程
          }
        }

        // 更新進度
        setTranslationProgress(Math.round(((i + 1) / segments.length) * 100));
        
        // 添加小延遲避免 API 請求過於頻繁
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      alert(`翻譯完成！已翻譯 ${segments.length} 條字幕`);
    } catch (error) {
      console.error('批量翻譯失敗:', error);
      alert('翻譯失敗: ' + (error as Error).message);
    } finally {
      setIsTranslating(false);
      setTranslationProgress(0);
    }
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
            {/* DeepL 翻譯按鈕 */}
            <button
              onClick={translateAllSubtitles}
              disabled={isTranslating}
              className={`p-1.5 hover:bg-gray-800 rounded transition relative ${
                isTranslating ? 'bg-orange-600 cursor-not-allowed' : 'hover:bg-orange-600'
              }`}
              title={isTranslating ? `翻譯中... ${translationProgress}%` : 'DeepL 翻譯所有字幕'}
            >
              <Languages size={16} />
              {isTranslating && (
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {translationProgress}%
                </div>
              )}
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
              <h3 className="text-sm font-medium text-gray-300">字幕位置與樣式調整</h3>
              {/* 預覽時間控制 - 水平滑桿 */}
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
            </div>
            
            {/* 預覽區域 - 左邊影片，右邊字體大小控制 */}
            <div className="flex gap-3">
              {/* 影片預覽區域 */}
              <div 
                ref={previewRef}
                className="relative flex-1 bg-black rounded border border-gray-600 overflow-hidden cursor-crosshair flex items-center justify-center"
                style={{ height: '400px' }}
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
                        setVideoError(false); // 重置錯誤狀態
                      }}
                      onError={(e) => {
                        console.error('影片載入錯誤:', e);
                        console.error('原始 URL:', videoUrl);
                        console.error('處理後 URL:', getVideoSrc(videoUrl));
                        console.error('錯誤詳情:', e.target);
                        setVideoError(true); // 設置錯誤狀態
                      }}
                      onCanPlay={() => {
                        console.log('影片可以播放');
                        setVideoError(false); // 成功載入，清除錯誤狀態
                        if (videoRef.current) {
                          videoRef.current.currentTime = previewTime;
                          videoRef.current.pause();
                        }
                      }}
                    />
                    {/* 載入錯誤時的備用顯示 */}
                    {videoError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
                        <div className="text-center p-4">
                          <span className="text-red-400 text-sm block mb-2">影片載入失敗</span>
                          <span className="text-gray-500 text-xs block mb-2">URL: {videoUrl}</span>
                          <button 
                            onClick={() => {
                              setVideoError(false);
                              if (videoRef.current) {
                                videoRef.current.load(); // 重新載入影片
                              }
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            重試
                          </button>
                        </div>
                      </div>
                    )}
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
                    fontSize: `${subtitleFontSize}px`,
                    lineHeight: '1.4',
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Move size={Math.max(12, subtitleFontSize * 0.75)} className="text-purple-400" />
                    <span>範例字幕文字</span>
                  </div>
                </div>
                
                {/* 位置與字體資訊顯示 */}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  <div>X: {subtitlePosition.x.toFixed(1)}%, Y: {subtitlePosition.y.toFixed(1)}%</div>
                  <div>字體: {subtitleFontSize}px</div>
                </div>
              </div>
              
              {/* 右側字體大小控制 */}
              <div className="w-16 flex flex-col items-center bg-gray-800 p-3 rounded border border-gray-600">
                <span className="text-xs text-gray-400 mb-2">字體大小</span>
                <div className="flex flex-col items-center justify-center" style={{ height: '240px', width: '40px' }}>
                  <span className="text-xs text-gray-500 mb-2">32px</span>
                  <div className="flex items-center justify-center" style={{ height: '200px', width: '40px' }}>
                    <input
                      type="range"
                      min="12"
                      max="32"
                      step="1"
                      value={subtitleFontSize}
                      onChange={(e) => {
                        const newFontSize = Number(e.target.value);
                        setSubtitleFontSize(newFontSize);
                        applyFontSizeToAllSegments(newFontSize);
                      }}
                      className="vertical-slider"
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-2">12px</span>
                </div>
                <span className="text-xs text-white font-medium mt-2">{subtitleFontSize}px</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-400 mt-2">
              {videoUrl 
                ? "使用上方時間滑桿選擇影片畫面，右側滑桿調整字體大小，拖拽字幕調整位置，所有變更會即時套用到全部字幕" 
                : "使用右側滑桿調整字體大小，拖拽字幕調整位置，所有變更會即時套用到全部字幕"
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