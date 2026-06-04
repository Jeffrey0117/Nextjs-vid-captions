'use client';

import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';

export default function TestSubtitlePage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState('');
  
  // 字幕樣式設定
  const [subtitleStyle, setSubtitleStyle] = useState({
    fontSize: 32,
    fontFamily: 'Noto Sans TC',
    fontWeight: 'bold',
    color: '#FFFFFF',
    enableStroke: true,
    strokeColor: '#000000',
    strokeWidth: 3,
    enableShadow: true,
    shadowColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    positionX: 50,
    positionY: 85,
  });

  // 測試字幕資料
  const testSubtitles = [
    {
      startTime: 1.0,
      endTime: 3.0,
      text: '這是測試字幕，使用 Google Fonts',
      style: subtitleStyle
    },
    {
      startTime: 4.0,
      endTime: 6.0,
      text: '描邊效果和陰影測試',
      style: subtitleStyle
    },
    {
      startTime: 7.0,
      endTime: 9.0,
      text: 'Test English subtitle with stroke',
      style: subtitleStyle
    }
  ];

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  const handleRenderVideo = async () => {
    if (!videoFile) {
      alert('請先上傳影片檔案');
      return;
    }

    setIsRendering(true);
    setRenderProgress('準備開始渲染...');

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('subtitles', JSON.stringify(testSubtitles));

      setRenderProgress('正在渲染字幕影片...');
      
      const response = await fetch('/api/render-video/drawtext', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`渲染失敗: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // 創建下載連結
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `subtitle_rendered_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setRenderProgress('渲染完成！影片已下載');
      
    } catch (error) {
      console.error('渲染錯誤:', error);
      setRenderProgress(`渲染失敗: ${error}`);
    } finally {
      setIsRendering(false);
    }
  };

  const updateStyle = (updates: Partial<typeof subtitleStyle>) => {
    setSubtitleStyle(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">字幕渲染測試頁面</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：影片上傳和預覽 */}
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">影片上傳</h2>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
              />
            </div>

            {videoUrl && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">影片預覽</h2>
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">渲染控制</h2>
              <button
                onClick={handleRenderVideo}
                disabled={!videoFile || isRendering}
                className={`w-full py-3 px-4 rounded-lg font-semibold ${
                  !videoFile || isRendering
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isRendering ? '渲染中...' : '開始渲染字幕'}
              </button>
              
              {renderProgress && (
                <div className="mt-3 p-2 bg-gray-700 rounded text-sm">
                  {renderProgress}
                </div>
              )}
            </div>
          </div>

          {/* 右側：字幕樣式設定 */}
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">字幕樣式設定</h2>
              
              {/* 字體設定 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">字體大小</label>
                  <input
                    type="range"
                    min="16"
                    max="72"
                    value={subtitleStyle.fontSize}
                    onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-400">{subtitleStyle.fontSize}px</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">字體</label>
                  <select
                    value={subtitleStyle.fontFamily}
                    onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                  >
                    <option value="Noto Sans TC">思源黑體 TC</option>
                    <option value="Noto Serif TC">思源宋體 TC</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Orbitron">Orbitron (科技感)</option>
                    <option value="Bangers">Bangers (漫畫風)</option>
                  </select>
                </div>
              </div>

              {/* 文字顏色 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">文字顏色</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-600 cursor-pointer"
                    style={{ backgroundColor: subtitleStyle.color }}
                  />
                  <input
                    type="text"
                    value={subtitleStyle.color}
                    onChange={(e) => updateStyle({ color: e.target.value })}
                    className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded font-mono text-sm"
                  />
                </div>
              </div>

              {/* 描邊效果 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={subtitleStyle.enableStroke}
                    onChange={(e) => updateStyle({ enableStroke: e.target.checked })}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">啟用描邊效果</label>
                </div>
                
                {subtitleStyle.enableStroke && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="block text-xs mb-1">描邊顏色</label>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border border-gray-600 cursor-pointer"
                          style={{ backgroundColor: subtitleStyle.strokeColor }}
                        />
                        <input
                          type="text"
                          value={subtitleStyle.strokeColor}
                          onChange={(e) => updateStyle({ strokeColor: e.target.value })}
                          className="flex-1 p-1 bg-gray-700 border border-gray-600 rounded font-mono text-xs"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs mb-1">描邊寬度</label>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={subtitleStyle.strokeWidth}
                        onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-400">{subtitleStyle.strokeWidth}px</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 陰影效果 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={subtitleStyle.enableShadow}
                    onChange={(e) => updateStyle({ enableShadow: e.target.checked })}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">啟用陰影效果</label>
                </div>
              </div>

              {/* 位置調整 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">水平位置</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={subtitleStyle.positionX}
                    onChange={(e) => updateStyle({ positionX: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-400">{subtitleStyle.positionX}%</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">垂直位置</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={subtitleStyle.positionY}
                    onChange={(e) => updateStyle({ positionY: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-400">{subtitleStyle.positionY}%</span>
                </div>
              </div>
            </div>

            {/* 字幕預覽 */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">字幕預覽</h2>
              <div className="bg-black rounded-lg aspect-video relative overflow-hidden">
                <div 
                  className="absolute text-center w-full"
                  style={{
                    left: `${subtitleStyle.positionX}%`,
                    top: `${subtitleStyle.positionY}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${subtitleStyle.fontSize * 0.5}px`,
                    fontFamily: subtitleStyle.fontFamily,
                    fontWeight: subtitleStyle.fontWeight,
                    color: subtitleStyle.color,
                    textShadow: subtitleStyle.enableShadow ? 
                      `${subtitleStyle.shadowOffsetX}px ${subtitleStyle.shadowOffsetY}px 4px ${subtitleStyle.shadowColor}` : 'none',
                    WebkitTextStroke: subtitleStyle.enableStroke ? 
                      `${subtitleStyle.strokeWidth * 0.5}px ${subtitleStyle.strokeColor}` : 'none'
                  }}
                >
                  測試字幕效果預覽
                </div>
              </div>
            </div>

            {/* 測試字幕列表 */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">測試字幕</h2>
              <div className="space-y-2">
                {testSubtitles.map((subtitle, index) => (
                  <div key={index} className="bg-gray-700 p-3 rounded">
                    <div className="text-sm text-gray-400 mb-1">
                      {subtitle.startTime}s - {subtitle.endTime}s
                    </div>
                    <div className="text-white">{subtitle.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}