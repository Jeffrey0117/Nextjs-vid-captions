"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { parseSrt, findCurrentSubtitle } from "@/lib/parseSrt";
import { Subtitle } from "@/lib/types";

// Dynamically import VideoPlayer with no SSR
const VideoPlayer = dynamic(() => import("./components/VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="relative w-full max-w-4xl mx-auto aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
      <p>Loading video player...</p>
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

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<Subtitle | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // Set hasMounted to true after component mounts (client-side only)
  useEffect(() => {
    setHasMounted(true);
  }, []);

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
        setSubtitles(parsedSubtitles);
      }
    } catch (err) {
      console.error("Error uploading video:", err);
      setError("Failed to process video. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTimeUpdate = (currentTimeMs: number) => {
    console.log("🕰️ Current time:", currentTimeMs);
    console.log("📝 Subtitles length:", subtitles.length);
    console.log("📝 First subtitle:", subtitles[0]);

    const sub = findCurrentSubtitle(subtitles, currentTimeMs);
    console.log("🎯 Found subtitle:", sub);

    setCurrentSubtitle(sub);
  };

  const handleVideoEnd = () => {
    setCurrentSubtitle(null);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Video Subtitle Player
        </h1>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="text-center mb-6">
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
              className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                isProcessing
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isProcessing ? "Processing..." : "Upload Video"}
            </button>
            {error && <p className="mt-2 text-red-500">{error}</p>}
          </div>

          {videoUrl && (
            <VideoPlayer
              videoUrl={videoUrl}
              subtitles={subtitles}
              currentSubtitle={currentSubtitle}
              onTimeUpdate={handleTimeUpdate}
              onVideoEnd={handleVideoEnd}
            />
          )}
        </div>

        {subtitles.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Subtitles
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {subtitles.map((sub) => (
                <div
                  key={sub.id}
                  className={`p-2 rounded ${
                    currentSubtitle?.id === sub.id ? "bg-blue-50" : ""
                  }`}
                >
                  <p className="text-sm text-gray-500">
                    {formatTime(sub.startTime)} - {formatTime(sub.endTime)}
                  </p>
                  <p>{sub.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Helper function to format time (ms) to MM:SS
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60));
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
