"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { parseSrt, findCurrentSubtitle } from "@/lib/parseSrt";
import { Subtitle, SubtitleStyle, DEFAULT_STYLE } from "@/lib/types";

// Dynamically import VideoPlayer with no SSR
const VideoPlayer = dynamic(() => import("../components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
      <p className="text-white">Loading video player...</p>
    </div>
  ),
});

// Move handleFileChange outside the component to prevent recreation on each render
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to process video");
    }

    return await response.json();
  } catch (error) {
    console.error("Error uploading video:", error);
    throw error;
  }
};

export default function EditorPage() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 全域樣式狀態 (套用到所有字幕)
  const [globalStyle, setGlobalStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError("");

    try {
      const data = await handleFileUpload(file);
      setVideoUrl(data.videoUrl);

      if (data.srtContent) {
        const parsedSubtitles = parseSrt(data.srtContent);
        // 為每個字幕添加預設樣式
        const subtitlesWithStyle = parsedSubtitles.map((sub) => ({
          ...sub,
          style: { ...DEFAULT_STYLE },
        }));
        setSubtitles(subtitlesWithStyle);
      }
    } catch (err) {
      console.error("Error uploading video:", err);
      setError("Failed to process video. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTimeUpdate = (currentTimeMs: number) => {
    const sub = findCurrentSubtitle(subtitles, currentTimeMs);
    setCurrentSubtitle(sub);
  };

  const handleVideoEnd = () => {
    setCurrentSubtitle(null);
  };

  // 更新全域樣式並套用到所有字幕
  const updateGlobalStyle = (newStyle: Partial<SubtitleStyle>) => {
    const updatedStyle = { ...globalStyle, ...newStyle };
    setGlobalStyle(updatedStyle);

    // 更新所有字幕的樣式
    setSubtitles((prev) =>
      prev.map((sub) => ({
        ...sub,
        style: { ...updatedStyle },
      }))
    );
  };

  // 下載 SRT 檔案
  const downloadSRT = () => {
    const srtContent = subtitles
      .map((sub, i) => {
        const start = formatTimeToSRT(
          typeof sub.startTime === "number" ? sub.startTime : 0
        );
        const end = formatTimeToSRT(
          typeof sub.endTime === "number" ? sub.endTime : 0
        );
        return `${i + 1}\n${start} --> ${end}\n${sub.text}\n`;
      })
      .join("\n");

    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">字幕編輯器</h1>
          <div className="flex items-center gap-4">
            {/* 下載 SRT */}
            {subtitles.length > 0 && (
              <button
                onClick={downloadSRT}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors"
              >
                下載 SRT
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* 上傳區域 */}
        {!videoUrl && (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className={`px-8 py-4 rounded-lg font-medium text-white transition-colors ${
                isProcessing
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isProcessing ? "處理中..." : "上傳影片"}
            </button>
            {error && <p className="mt-4 text-red-400">{error}</p>}
          </div>
        )}

        {/* 編輯器區域 */}
        {videoUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左側: 影片播放器 */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-xl p-4">
                <VideoPlayer
                  videoUrl={videoUrl}
                  subtitles={subtitles}
                  currentSubtitle={currentSubtitle}
                  onTimeUpdate={handleTimeUpdate}
                  onVideoEnd={handleVideoEnd}
                  onSubtitlePositionChange={(x, y) => {
                    if (!currentSubtitle) return;
                    // 更新當前字幕的位置
                    setSubtitles((prev) =>
                      prev.map((sub) =>
                        sub.id === currentSubtitle.id
                          ? {
                              ...sub,
                              style: {
                                ...sub.style!,
                                position: { x, y },
                              },
                            }
                          : sub
                      )
                    );
                  }}
                  isDraggableSubtitle={true}
                />
              </div>

              {/* 樣式控制面板 */}
              <div className="bg-gray-800 rounded-xl p-6 mt-6">
                <h2 className="text-lg font-semibold mb-4">字幕樣式</h2>

                {/* 字體大小 */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">
                    字體大小: {globalStyle.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="16"
                    max="48"
                    value={globalStyle.fontSize}
                    onChange={(e) =>
                      updateGlobalStyle({ fontSize: Number(e.target.value) })
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* 顏色選擇 */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">
                    字幕顏色
                  </label>
                  <div className="flex gap-3">
                    {[
                      { name: "白色", color: "#FFFFFF" },
                      { name: "黃色", color: "#FDE047" },
                      { name: "紅色", color: "#EF4444" },
                      { name: "藍色", color: "#3B82F6" },
                      { name: "綠色", color: "#22C55E" },
                    ].map((item) => (
                      <button
                        key={item.color}
                        onClick={() => updateGlobalStyle({ color: item.color })}
                        className={`w-12 h-12 rounded-lg border-2 transition-all ${
                          globalStyle.color === item.color
                            ? "border-white scale-110"
                            : "border-gray-600 hover:border-gray-400"
                        }`}
                        style={{ backgroundColor: item.color }}
                        title={item.name}
                      />
                    ))}
                  </div>
                </div>

                {/* 提示 */}
                <div className="text-sm text-gray-400 bg-gray-700 rounded p-3">
                  💡 提示: 直接在影片上拖曳字幕可調整位置
                </div>
              </div>
            </div>

            {/* 右側: 字幕列表 */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-xl p-6 sticky top-6">
                <h2 className="text-lg font-semibold mb-4">字幕列表</h2>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {subtitles.map((sub) => (
                    <div
                      key={sub.id}
                      className={`p-3 rounded cursor-pointer transition-colors ${
                        currentSubtitle?.id === sub.id
                          ? "bg-blue-600"
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      <p className="text-xs text-gray-400 mb-1">
                        {formatTime(sub.startTime)} -{" "}
                        {formatTime(sub.endTime)}
                      </p>
                      <p className="text-sm">{sub.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Helper function to format time (ms) to MM:SS
function formatTime(time: number | string): string {
  const ms = typeof time === "number" ? time : 0;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// Helper function to format time (ms) to SRT format (HH:MM:SS,mmm)
function formatTimeToSRT(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds
    .toString()
    .padStart(3, "0")}`;
}