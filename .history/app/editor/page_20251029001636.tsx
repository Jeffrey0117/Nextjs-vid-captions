"use client";

import {
  Calendar,
  ChevronLeft,
  Edit,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSubtitleStore } from "../stores/subtitle-store";
import BulkSubtitleEditor from "../components/BulkSubtitleEditor";
import { parseSrt } from "@/lib/parseSrt";

// 專案資料類型
interface Project {
  id: string;
  name: string;
  createdAt: Date;
  thumbnail?: string | null;
  
  // 影片相關
  videoFile?: File | null;
  videoUrl?: string | null;
  
  // 狀態追蹤
  status: 'idle' | 'uploading' | 'transcribing' | 'translating' | 'ready' | 'error';
  progress: number; // 0-100
  errorMessage?: string;
  
  // 字幕資料
  segments?: Array<{
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    translatedText?: string;
  }>;
}

export default function ProjectsPage() {
  const router = useRouter();
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // 使用 localStorage 持久化專案列表
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  
  // 批量編輯器狀態
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [currentEditingProjectId, setCurrentEditingProjectId] = useState<string | null>(null);
  
  // Zustand store
  const { tracks, loadProjectSegments, clearAll } = useSubtitleStore();
  
  // 初始化:從 localStorage 載入專案
  useEffect(() => {
    const savedProjects = localStorage.getItem('subtitle-projects');
    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      // 恢復 Date 物件
      const restored = parsed.map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        status: p.status || 'idle',
        progress: p.progress || 0,
      }));
      setProjects(restored);
    }
  }, []);
  
  // 持久化:專案變更時儲存到 localStorage
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('subtitle-projects', JSON.stringify(projects));
    }
  }, [projects]);

  // 更新專案狀態
  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
  };

  // 產生影片封面圖
  const generateVideoThumbnail = async (videoFile: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadeddata = () => {
        // 設定 canvas 尺寸
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 截取第 1 秒的影格
        video.currentTime = 1;
      };
      
      video.onseeked = () => {
        // 繪製影格到 canvas
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 轉換為 Data URL
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        
        // 清理資源
        URL.revokeObjectURL(video.src);
        
        resolve(thumbnail);
      };
      
      video.onerror = () => {
        // 失敗時返回空字串
        resolve('');
      };
      
      // 載入影片
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleCreateProject = () => {
    const newId = Date.now().toString();
    const newProject: Project = {
      id: newId,
      name: `專案 ${projects.length + 1}`,
      createdAt: new Date(),
      status: 'idle',
      progress: 0,
    };
    setProjects([newProject, ...projects]);
  };
  
  // 處理專案卡片點擊 → 觸發影片上傳
  const handleProjectClick = (projectId: string) => {
    if (isSelectionMode) return;
    setCurrentEditingProjectId(projectId);
    videoInputRef.current?.click();
  };
  
  // 處理影片檔案上傳
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentEditingProjectId) return;
    
    const projectId = currentEditingProjectId;
    
    // 檢查檔案大小 (限制 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`影片檔案過大 (${(file.size / 1024 / 1024).toFixed(1)}MB)。請選擇小於 50MB 的影片檔案。`);
      return;
    }
    
    // 檢查 localStorage 可用空間
    try {
      const testData = 'x'.repeat(1024 * 1024); // 1MB 測試資料
      localStorage.setItem('test', testData);
      localStorage.removeItem('test');
    } catch (e) {
      // localStorage 空間不足，清理舊專案
      if (confirm('儲存空間不足。是否要清理舊的專案資料？')) {
        clearOldProjects();
      } else {
        alert('儲存空間不足，無法上傳影片。');
        return;
      }
    }
    
    // 轉換為 Data URL 以便跨頁面使用
    const videoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    
    try {
      updateProject(projectId, {
        videoFile: file,
        videoUrl: videoDataUrl, // 改用 Data URL
        status: 'uploading',
        progress: 0,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert('儲存空間不足。請清理舊專案或選擇較小的影片檔案。');
        return;
      }
      throw error;
    }
    
    // 模擬上傳進度
    updateProject(projectId, { status: 'uploading', progress: 100 });
    
    // 產生影片封面圖
    const thumbnailUrl = await generateVideoThumbnail(file);
    updateProject(projectId, { thumbnail: thumbnailUrl });
    
    // 自動執行字幕識別+翻譯
    await autoProcessVideo(projectId, file);
    
    // 重置檔案選擇器
    e.target.value = '';
    setCurrentEditingProjectId(null);
  };
  
  // 自動處理流程:字幕識別 → 翻譯
  const autoProcessVideo = async (projectId: string, videoFile: File) => {
    try {
      // Step 1: Whisper 字幕識別
      updateProject(projectId, { status: 'transcribing', progress: 0 });
      
      const formData = new FormData();
      formData.append('file', videoFile); // 修正:改用 'file' 參數名
      formData.append('language', 'zh');
      
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!transcribeRes.ok) {
        const errorData = await transcribeRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || '字幕識別失敗');
      }
      
      const { srtContent } = await transcribeRes.json(); // 修正:改用 'srtContent' 欄位名
      const parsedSegments = parseSrt(srtContent);
      
      updateProject(projectId, { progress: 50 });
      
      // Step 2: Google Translate 翻譯
      updateProject(projectId, { status: 'translating', progress: 50 });
      
      const translateRes = await fetch('/api/translate', {
        method: 'PUT', // 修正:改用 PUT method (API route 定義)
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: parsedSegments.map(s => s.text),
          targetLang: 'zh-TW',
        }),
      });
      
      if (!translateRes.ok) {
        const errorData = await translateRes.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || '翻譯失敗');
      }
      
      const { translations } = await translateRes.json();
      
      // 合併字幕資料 (translations 是物件陣列,需要提取 translatedText 欄位)
      const segments = parsedSegments.map((seg, i) => ({
        ...seg,
        translatedText: translations[i]?.translatedText || seg.text,
      }));
      
      console.log('🔍 處理後的字幕時間格式:', segments.slice(0, 3).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text
      })));
      
      updateProject(projectId, {
        status: 'ready',
        progress: 100,
        segments,
      });
      
    } catch (error: any) {
      console.error('自動處理失敗:', error);
      updateProject(projectId, {
        status: 'error',
        errorMessage: error.message || '處理失敗',
      });
    }
  };
  
  // 開啟批量編輯器
  const openBulkEditor = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // 載入字幕到 Zustand store
    clearAll();
    if (project.segments && project.segments.length > 0) {
      loadProjectSegments(project.segments);
    }
    setCurrentEditingProjectId(projectId);
    setShowBulkEditor(true);
  };
  
  // 關閉批量編輯器並儲存
  const closeBulkEditor = () => {
    if (currentEditingProjectId && tracks[0]?.segments) {
      // 儲存編輯結果回專案
      updateProject(currentEditingProjectId, {
        segments: tracks[0].segments,
      });
    }
    setShowBulkEditor(false);
    setCurrentEditingProjectId(null);
    clearAll();
  };

  // 清理舊專案資料以釋放空間
  const clearOldProjects = () => {
    const oldProjects = projects.filter(p => {
      const createdAt = new Date(p.createdAt);
      const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated > 7; // 清理7天前的專案
    });

    if (oldProjects.length > 0) {
      // 只保留最近7天的專案
      const recentProjects = projects.filter(p => {
        const createdAt = new Date(p.createdAt);
        const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreated <= 7;
      });
      
      setProjects(recentProjects);
      alert(`已清理 ${oldProjects.length} 個舊專案，釋放儲存空間。`);
    } else {
      // 如果沒有舊專案，清理最大的專案
      const sortedBySize = [...projects].sort((a, b) => {
        const sizeA = (a.videoUrl?.length || 0) + JSON.stringify(a.segments || []).length;
        const sizeB = (b.videoUrl?.length || 0) + JSON.stringify(b.segments || []).length;
        return sizeB - sizeA;
      });
      
      if (sortedBySize.length > 1) {
        const projectsToKeep = sortedBySize.slice(1); // 移除最大的專案
        setProjects(projectsToKeep);
        alert(`已清理最大的專案，釋放儲存空間。`);
      }
    }
  };
  
  // 輸出影片
  const exportVideo = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.videoFile || !project.segments || project.segments.length === 0) {
      alert('請先上傳影片並完成字幕識別');
      return;
    }
    
    try {
      updateProject(projectId, { status: 'uploading', progress: 0 });
      
      const formData = new FormData();
      formData.append('video', project.videoFile);
      formData.append('segments', JSON.stringify(project.segments));
      
      const res = await fetch('/api/burn-subtitles', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('影片輸出失敗');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}_字幕版.mp4`;
      a.click();
      
      updateProject(projectId, { status: 'ready', progress: 100 });
      
    } catch (error: any) {
      console.error('輸出失敗:', error);
      alert('輸出失敗:' + error.message);
      updateProject(projectId, { status: 'error', errorMessage: error.message });
    }
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(projects.filter((p) => p.id !== projectId));
  };

  const handleSelectProject = (projectId: string, checked: boolean) => {
    const newSelected = new Set(selectedProjects);
    if (checked) {
      newSelected.add(projectId);
    } else {
      newSelected.delete(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjects(new Set(filteredProjects.map((p) => p.id)));
    } else {
      setSelectedProjects(new Set());
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedProjects(new Set());
  };

  const handleBulkDelete = () => {
    setProjects(projects.filter((p) => !selectedProjects.has(p.id)));
    setSelectedProjects(new Set());
    setIsSelectionMode(false);
  };

  // 搜尋過濾
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected =
    filteredProjects.length > 0 &&
    selectedProjects.size === filteredProjects.length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 隱藏的檔案選擇器 */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />
      
      {/* 批量編輯器全螢幕 Modal */}
      {showBulkEditor && (
        <div className="fixed inset-0 z-50 bg-gray-900">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold">批量編輯字幕</h2>
              <button
                onClick={closeBulkEditor}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                完成編輯
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <BulkSubtitleEditor isOpen={showBulkEditor} onClose={closeBulkEditor} />
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="pt-6 px-6 flex items-center justify-between w-full h-16">
        <Link
          href="/"
          className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">返回</span>
        </Link>
        <div className="block md:hidden">
          {isSelectionMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4 inline-block mr-1" />
                取消
              </button>
              {selectedProjects.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 inline-block mr-1" />
                  刪除 ({selectedProjects.size})
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={clearOldProjects}
                className="px-2 py-1.5 text-xs border border-gray-600 rounded hover:bg-gray-800 transition-colors"
                title="清理舊專案"
              >
                清理
              </button>
              <CreateButton onClick={handleCreateProject} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pt-6 pb-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              您的專案
            </h1>
            <p className="text-gray-400">
              {projects.length}{" "}
              {projects.length === 1 ? "個專案" : "個專案"}
              {isSelectionMode && selectedProjects.size > 0 && (
                <span className="ml-2 text-blue-400">
                  • {selectedProjects.size} 個已選取
                </span>
              )}
            </p>
          </div>
          <div className="hidden md:block">
            {isSelectionMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelSelection}
                  className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4 inline-block mr-1" />
                  取消
                </button>
                {selectedProjects.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 inline-block mr-1" />
                    刪除選取的 ({selectedProjects.size})
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={clearOldProjects}
                  className="px-3 py-2 text-sm border border-gray-600 rounded hover:bg-gray-800 transition-colors"
                  title="清理舊專案以釋放儲存空間"
                >
                  清理空間
                </button>
                <button
                  onClick={() => setIsSelectionMode(true)}
                  disabled={projects.length === 0}
                  className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  選取專案
                </button>
                <CreateButton onClick={handleCreateProject} />
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-72 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋專案..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Select All */}
        {isSelectionMode && filteredProjects.length > 0 && (
          <button
            onClick={() => handleSelectAll(!allSelected)}
            className="w-full mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700 flex items-center gap-2 hover:bg-gray-700 transition-colors"
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                allSelected
                  ? "bg-blue-600 border-blue-600"
                  : "border-gray-500"
              }`}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium">
              {allSelected ? "取消全選" : "全選"}
            </span>
            <span className="text-sm text-gray-400">
              ({selectedProjects.size} / {filteredProjects.length} 已選取)
            </span>
          </button>
        )}

        {/* Project Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={`skeleton-${index}`}
                className="overflow-hidden bg-gray-800 border border-gray-700 rounded-lg p-0"
              >
                <div className="aspect-square w-full bg-gray-700 animate-pulse" />
                <div className="px-4 pt-5 pb-4 flex flex-col gap-2">
                  <div className="h-4 w-3/4 bg-gray-700 animate-pulse rounded" />
                  <div className="h-4 w-24 bg-gray-700 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <NoProjects onCreateProject={handleCreateProject} />
        ) : filteredProjects.length === 0 ? (
          <NoResults
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery("")}
          />
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isSelectionMode={isSelectionMode}
                isSelected={selectedProjects.has(project.id)}
                onSelect={handleSelectProject}
                onDelete={handleDeleteProject}
                onProjectClick={handleProjectClick}
                onBulkEdit={openBulkEditor}
                onExport={exportVideo}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Project Card Component
interface ProjectCardProps {
  project: Project;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (projectId: string, checked: boolean) => void;
  onDelete?: (projectId: string) => void;
  onProjectClick?: (projectId: string) => void;
  onBulkEdit?: (projectId: string) => void;
  onExport?: (projectId: string) => void;
}

function ProjectCard({
  project,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  onDelete,
  onProjectClick,
  onBulkEdit,
  onExport,
}: ProjectCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // 狀態文字和顏色
  const getStatusText = (status: Project['status']) => {
    switch (status) {
      case 'idle': return '待上傳';
      case 'uploading': return '上傳中';
      case 'transcribing': return '字幕識別中';
      case 'translating': return '翻譯中';
      case 'ready': return '已完成';
      case 'error': return '錯誤';
      default: return '待上傳';
    }
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'idle': return 'text-gray-400';
      case 'uploading': return 'text-blue-400';
      case 'transcribing': return 'text-yellow-400';
      case 'translating': return 'text-yellow-400';
      case 'ready': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      onSelect?.(project.id, !isSelected);
    } else if (project.status === 'idle') {
      // 點擊專案 = 觸發影片上傳 (只有 idle 狀態才能上傳)
      e.preventDefault();
      onProjectClick?.(project.id);
    }
  };

  const cardContent = (
    <div
      className={`overflow-hidden bg-gray-800 border rounded-lg p-0 transition-all ${
        isSelectionMode && isSelected
          ? "ring-2 ring-blue-500 border-blue-500"
          : "border-gray-700 hover:border-gray-600"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-gray-700 transition-opacity group-hover:opacity-80">
        {isSelectionMode && (
          <div className="absolute top-3 left-3 z-10">
            <div className="w-6 h-6 rounded-full bg-gray-900/80 backdrop-blur-sm border border-gray-600 flex items-center justify-center">
              <div
                className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${
                  isSelected
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-400"
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          {project.thumbnail ? (
            <img
              src={project.thumbnail}
              alt="專案縮圖"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
              <Video className="h-12 w-12 text-gray-500" />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pt-5 pb-4 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-sm leading-snug group-hover:text-gray-200 transition-colors line-clamp-2 flex-1">
            {project.name}
          </h3>
          {!isSelectionMode && (
            <div className="relative ml-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className={`w-6 h-6 p-0 text-gray-400 hover:text-white transition-all ${
                  isDropdownOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      // TODO: 重命名功能
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors rounded-t-lg"
                  >
                    重新命名
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      // TODO: 複製功能
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
                  >
                    複製
                  </button>
                  <div className="border-t border-gray-700" />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      setIsDeleteDialogOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors rounded-b-lg"
                  >
                    刪除
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(project.createdAt)}</span>
          </div>
          <span className={`font-medium ${getStatusColor(project.status)}`}>
            {getStatusText(project.status)}
          </span>
        </div>
        
        {/* 進度條 (上傳/處理中才顯示) */}
        {['uploading', 'transcribing', 'translating'].includes(project.status) && (
          <div className="mt-2">
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{project.progress}%</p>
          </div>
        )}
        
        {/* 錯誤訊息 */}
        {project.status === 'error' && project.errorMessage && (
          <p className="text-xs text-red-400 mt-1">{project.errorMessage}</p>
        )}
        
        {/* 操作按鈕 (只有 ready 狀態才顯示) */}
        {project.status === 'ready' && !isSelectionMode && (
          <div className="flex flex-col gap-2 mt-2">
            <Link
              href={`/editor-pro?projectId=${project.id}`}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="w-full px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded transition-colors flex items-center justify-center gap-1"
            >
              <Edit className="w-3 h-3" />
              進階編輯
            </Link>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBulkEdit?.(project.id);
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors flex items-center justify-center gap-1"
              >
                <Edit className="w-3 h-3" />
                批量編輯
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onExport?.(project.id);
                }}
                className="flex-1 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded transition-colors flex items-center justify-center gap-1"
              >
                <Upload className="w-3 h-3" />
                輸出影片
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDeleteDialogOpen(false);
          }}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <h3 className="text-lg font-bold mb-2">刪除專案</h3>
            <p className="text-gray-400 mb-6">
              確定要刪除「{project.name}」嗎?此操作無法復原。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDeleteDialogOpen(false);
                }}
                className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete?.(project.id);
                  setIsDeleteDialogOpen(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 根據狀態決定是否顯示為可點擊卡片
  if (isSelectionMode) {
    return (
      <div
        onClick={handleCardClick}
        className="block group cursor-pointer w-full text-left"
      >
        {cardContent}
      </div>
    );
  } else if (project.status === 'idle') {
    // idle 狀態 = 點擊上傳影片
    return (
      <div
        onClick={handleCardClick}
        className="block group cursor-pointer w-full text-left"
      >
        {cardContent}
      </div>
    );
  } else if (project.status === 'ready') {
    // ready 狀態 = 顯示批量編輯和輸出按鈕 (不跳轉頁面)
    return (
      <div className="block group">
        {cardContent}
      </div>
    );
  } else {
    // 處理中或錯誤狀態 = 不可點擊
    return <div className="block group">{cardContent}</div>;
  }
}

// Create Button Component
function CreateButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm font-medium">新增專案</span>
    </button>
  );
}

// No Projects Component
function NoProjects({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <Video className="h-8 w-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-medium mb-2">尚無專案</h3>
      <p className="text-gray-400 mb-6 max-w-md">
        開始建立您的第一個影片專案。匯入媒體、編輯並匯出專業影片。
      </p>
      <button
        onClick={onCreateProject}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        <Plus className="h-4 w-4" />
        建立您的第一個專案
      </button>
    </div>
  );
}

// No Results Component
function NoResults({
  searchQuery,
  onClearSearch,
}: {
  searchQuery: string;
  onClearSearch: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-medium mb-2">找不到結果</h3>
      <p className="text-gray-400 mb-6 max-w-md">
        您搜尋的「{searchQuery}」沒有找到任何結果。
      </p>
      <button
        onClick={onClearSearch}
        className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700 transition-colors"
      >
        清除搜尋
      </button>
    </div>
  );
}