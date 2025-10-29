'use client';

import { X, Zap, Brain } from 'lucide-react';

interface TranslationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeepL: () => void;
  onSelectGrok: () => void;
}

export default function TranslationSelectionModal({ 
  isOpen, 
  onClose, 
  onSelectDeepL, 
  onSelectGrok 
}: TranslationSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">選擇翻譯服務</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* 翻譯選項 */}
        <div className="space-y-3">
          {/* DeepL 選項 */}
          <button
            onClick={() => {
              onSelectDeepL();
              onClose();
            }}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium">DeepL 翻譯</div>
              <div className="text-blue-200 text-sm">專業翻譯引擎，精準度高</div>
            </div>
          </button>

          {/* Grok 選項 */}
          <button
            onClick={() => {
              onSelectGrok();
              onClose();
            }}
            className="w-full p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all duration-200 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Brain size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-medium">Grok 翻譯</div>
              <div className="text-purple-200 text-sm">AI 智能翻譯，理解上下文</div>
            </div>
          </button>
        </div>

        {/* 說明文字 */}
        <div className="mt-4 text-xs text-gray-400 text-center">
          選擇翻譯服務來翻譯所有字幕
        </div>
      </div>
    </div>
  );
}