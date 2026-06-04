'use client';

import { useSubtitleStore, SubtitleSegment, SubtitleTrack } from '../stores/subtitle-store';
import { HexColorPicker } from 'react-colorful';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Type, Bold, Italic, Underline, Strikethrough, Palette, Eye, Square, Save, X, Plus, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, ChevronDown, ChevronRight, Scissors, Layers, Trash2, Lock } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

interface SubtitlePropertiesPanelProps {
  selectedSegmentId: string | null;
  applyToAll: boolean;
  setApplyToAll: (value: boolean) => void;
  currentTrack?: SubtitleTrack | null;
  segmentIndex?: number;
  onDelete?: () => void;
  onTrackSwitch?: (trackId: string) => void;
}

export default function SubtitlePropertiesPanel({
  selectedSegmentId,
  applyToAll,
  setApplyToAll,
  currentTrack,
  segmentIndex,
  onDelete,
  onTrackSwitch
}: SubtitlePropertiesPanelProps) {
  const { tracks, updateSegment, splitSegment, deleteSegment, lockedTrackId } = useSubtitleStore();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showShadowColorPicker, setShowShadowColorPicker] = useState(false);
  const [showStrokeColorPicker, setShowStrokeColorPicker] = useState(false);

  // 折叠状态
  const [expandedSections, setExpandedSections] = useState({
    fontStyle: false,
    colors: false,
    stroke: false,
    shadow: false,
  });

  // Refs for color pickers
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const bgColorPickerRef = useRef<HTMLDivElement>(null);
  const shadowColorPickerRef = useRef<HTMLDivElement>(null);
  const strokeColorPickerRef = useRef<HTMLDivElement>(null);

  // Click outside handlers for color pickers
  useClickOutside(colorPickerRef, () => setShowColorPicker(false), showColorPicker);
  useClickOutside(bgColorPickerRef, () => setShowBgColorPicker(false), showBgColorPicker);
  useClickOutside(shadowColorPickerRef, () => setShowShadowColorPicker(false), showShadowColorPicker);
  useClickOutside(strokeColorPickerRef, () => setShowStrokeColorPicker(false), showStrokeColorPicker);

  // 查找选中段的轨道
  const selectedSegmentTrackInfo = useMemo(() => {
    if (!selectedSegmentId) {
      console.log('🔒 [轨道锁定] ❌ 没有选中的字幕ID');
      return { track: null, segment: null };
    }

    for (const track of tracks) {
      const segment = track.segments.find(seg => seg.id === selectedSegmentId);
      if (segment) {
        console.log('🔒 [轨道锁定] ✅ 找到选中的字幕', {
          轨道: track.name,
          轨道ID: track.id,
          字幕文本: segment.text.slice(0, 20)
        });
        return { track, segment };
      }
    }

    console.log('🔒 [轨道锁定] ⚠️ 未找到匹配的字幕 - ID:', selectedSegmentId);
    return { track: null, segment: null };
  }, [selectedSegmentId, tracks]);

  // 从所有 tracks 中查找选中的 segment（向后兼容）
  const selectedSegment = selectedSegmentTrackInfo.segment;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 检查是否需要轨道切换提示
  if (!selectedSegment) {
    // 如果有选中的字幕ID但没有找到，可能需要切换轨道
    if (selectedSegmentId && selectedSegmentTrackInfo.track === null) {
      console.log('🔒 [轨道锁定] 检测到轨道不匹配');
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Type size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">選中的字幕不在當前軌道</p>
            <p className="text-xs text-gray-400 mb-4">請在軌道列表中切換到對應軌道</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Type size={48} className="mx-auto mb-4 opacity-50" />
          <p>請選擇字幕片段進行編輯</p>
        </div>
      </div>
    );
  }

  // 检查选中字幕是否在当前轨道中
  const isSegmentInCurrentTrack = selectedSegmentTrackInfo.track?.id === currentTrack?.id;

  if (!isSegmentInCurrentTrack && currentTrack && selectedSegmentTrackInfo.track) {
    console.log('🔒 [轨道锁定] ⚠️ 轨道不匹配 - 当前轨道:', currentTrack.name, '字幕轨道:', selectedSegmentTrackInfo.track.name);
    return (
      <div className="h-full flex items-center justify-center text-gray-500 p-4">
        <div className="text-center">
          <Type size={48} className="mx-auto mb-4 opacity-50" />
          <p className="mb-2 font-semibold">軌道不匹配</p>
          <p className="text-sm text-gray-400 mb-4">
            選中的字幕在「<span className="text-blue-400">{selectedSegmentTrackInfo.track.name}</span>」軌道中
          </p>
          <button
            onClick={() => {
              console.log('🔒 [轨道锁定] 用户点击切换轨道按钮');
              if (onTrackSwitch && selectedSegmentTrackInfo.track) {
                onTrackSwitch(selectedSegmentTrackInfo.track.id);
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
          >
            切換到該軌道
          </button>
        </div>
      </div>
    );
  }

  const updateStyle = (updates: Partial<SubtitleSegment['style']>) => {
    if (applyToAll) {
      // 套用到所有字幕 - 遍历所有轨道
      tracks.forEach(track => {
        track.segments.forEach(seg => {
          updateSegment(seg.id, {
            style: { ...seg.style, ...updates },
          });
        });
      });
    } else if (selectedSegment) {
      // 只更新選中的字幕
      updateSegment(selectedSegment.id, {
        style: { ...selectedSegment.style, ...updates },
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* 轨道信息头部 */}
      {currentTrack && (
        <div
          className="px-4 py-3 rounded-lg border-2 bg-gradient-to-r from-gray-800/50 to-gray-900/50"
          style={{
            borderColor: currentTrack.color,
            boxShadow: `0 0 10px ${currentTrack.color}40`
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Layers size={18} style={{ color: currentTrack.color }} />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">正在编辑</h3>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentTrack.color }}
                />
                <span className="text-sm text-gray-300">{currentTrack.name}</span>
                {segmentIndex !== undefined && (
                  <span className="text-xs text-gray-500">
                    · 字幕 #{segmentIndex + 1}
                  </span>
                )}
              </div>
            </div>
            {currentTrack.locked && (
              <div className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-xs text-yellow-300">
                已锁定
              </div>
            )}
            {lockedTrackId === currentTrack.id && (
              <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded text-xs text-cyan-300 flex items-center gap-1">
                <Lock size={10} />
                編輯中
              </div>
            )}
            {/* 删除按钮 */}
            <button
              onClick={() => {
                if (selectedSegment && confirm(`確定要刪除字幕「${selectedSegment.text}」嗎？`)) {
                  deleteSegment(selectedSegment.id);
                  onDelete?.();
                }
              }}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors group"
              title="刪除字幕"
            >
              <Trash2 size={18} className="text-gray-400 group-hover:text-red-400" />
            </button>
          </div>
          <div className="text-xs text-gray-400">
            共 {currentTrack.segments.length} 个字幕片段
          </div>
        </div>
      )}

      {/* 套用到所有字幕 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <input
          type="checkbox"
          id="apply-to-all"
          checked={applyToAll}
          onChange={(e) => {
            const newValue = e.target.checked;
            setApplyToAll(newValue);

            // 如果打勾，立即同步當前字幕樣式到所有其他字幕
            if (newValue && selectedSegment) {
              tracks.forEach(track => {
                track.segments.forEach(seg => {
                  if (seg.id !== selectedSegment.id) {
                    updateSegment(seg.id, {
                      style: { ...selectedSegment.style },
                    });
                  }
                });
              });
            }
          }}
          className="w-4 h-4"
        />
        <label htmlFor="apply-to-all" className="text-sm font-medium cursor-pointer">
          套用到所有字幕
        </label>
      </div>

      {/* ========== 文字內容 ========== */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">文字內容</h3>

        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">字幕內容</label>
          <textarea
            value={selectedSegment.text}
            onChange={(e) => updateSegment(selectedSegment.id, { text: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            rows={2}
            placeholder="輸入字幕文字..."
          />
        </div>

        {selectedSegment.translatedText !== undefined && (
          <div>
            <label className="block text-xs font-medium mb-2 text-gray-400">翻譯文字</label>
            <textarea
              value={selectedSegment.translatedText}
              onChange={(e) => updateSegment(selectedSegment.id, { translatedText: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700 rounded-lg resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={2}
              placeholder="輸入翻譯文字..."
            />
          </div>
        )}

        {/* 自動分句按鈕 */}
        <button
          onClick={() => splitSegment(selectedSegment.id)}
          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Scissors size={16} />
          自動分句
        </button>
      </div>

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 文字大小 ========== */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">文字大小</h3>

        {/* 字型大小 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">
            字體大小: <span className="text-white">{selectedSegment.style.fontSize}px</span>
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
              className="w-16 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-center focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 字幕位置 ========== */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">字幕位置</h3>

        {/* 垂直位置 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">
            垂直位置: <span className="text-white">{selectedSegment.style.positionY}%</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">提示: 也可以直接拖曳影片上的字幕</p>
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

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 字體樣式 (可折疊) ========== */}
      <CollapsibleSection
        title="字體樣式"
        isExpanded={expandedSections.fontStyle}
        onToggle={() => toggleSection('fontStyle')}
      >
        {/* 字體選擇 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">字体系列</label>
          <select
            value={selectedSegment.style.fontFamily}
            onChange={(e) => updateStyle({ fontFamily: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <optgroup label="系统字体">
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="PingFang SC">苹方</option>
              <option value="SimHei">黑体</option>
            </optgroup>
            <optgroup label="Google Fonts - 中文">
              <option value="Noto Sans SC">Noto Sans SC (黑体)</option>
              <option value="Noto Serif SC">Noto Serif SC (宋体)</option>
            </optgroup>
            <optgroup label="Google Fonts - 英文">
              <option value="Roboto">Roboto</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Poppins">Poppins</option>
              <option value="Inter">Inter</option>
              <option value="Lato">Lato</option>
            </optgroup>
            <optgroup label="特效字体 (英文为主)">
              <option value="Orbitron">Orbitron (科技)</option>
              <option value="Bangers">Bangers (漫画)</option>
              <option value="Righteous">Righteous (复古)</option>
              <option value="Anton">Anton (粗体)</option>
              <option value="Bebas Neue">Bebas Neue (窄体)</option>
            </optgroup>
          </select>
        </div>

        {/* 样式按钮 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">文字样式</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => updateStyle({
                fontWeight: selectedSegment.style.fontWeight === 'bold' ? 'normal' : 'bold'
              })}
              className={`px-3 py-2 rounded-lg border transition ${
                selectedSegment.style.fontWeight === 'bold'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
              title="粗体"
            >
              <Bold size={16} className="mx-auto" />
            </button>
            <button
              onClick={() => updateStyle({
                fontStyle: selectedSegment.style.fontStyle === 'italic' ? 'normal' : 'italic'
              })}
              className={`px-3 py-2 rounded-lg border transition ${
                selectedSegment.style.fontStyle === 'italic'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
              title="斜体"
            >
              <Italic size={16} className="mx-auto" />
            </button>
            <button
              onClick={() => updateStyle({
                textDecoration: selectedSegment.style.textDecoration === 'underline' ? 'none' : 'underline'
              })}
              className={`px-3 py-2 rounded-lg border transition ${
                selectedSegment.style.textDecoration === 'underline'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
              title="下划线"
            >
              <Underline size={16} className="mx-auto" />
            </button>
            <button
              onClick={() => updateStyle({
                textDecoration: selectedSegment.style.textDecoration === 'line-through' ? 'none' : 'line-through'
              })}
              className={`px-3 py-2 rounded-lg border transition ${
                selectedSegment.style.textDecoration === 'line-through'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
              title="删除线"
            >
              <Strikethrough size={16} className="mx-auto" />
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 顏色 (可折疊) ========== */}
      <CollapsibleSection
        title="顏色"
        isExpanded={expandedSections.colors}
        onToggle={() => toggleSection('colors')}
      >
        {/* 文字顏色 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">文字顏色</label>
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
            >
              <div
                className="w-8 h-8 rounded border-2 border-gray-600"
                style={{ backgroundColor: selectedSegment.style.color }}
              />
              <span className="font-mono text-sm">{selectedSegment.style.color}</span>
            </button>
            {showColorPicker && (
              <div ref={colorPickerRef} className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
                <HexColorPicker
                  color={selectedSegment.style.color}
                  onChange={(color) => updateStyle({ color })}
                />
              </div>
            )}
          </div>
        </div>

        {/* 背景顏色 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">背景顏色</label>
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
                <span className="font-mono text-sm">
                  {selectedSegment.style.backgroundColor === 'transparent'
                    ? '透明'
                    : selectedSegment.style.backgroundColor}
                </span>
              </button>
              {showBgColorPicker && selectedSegment.style.backgroundColor !== 'transparent' && (
                <div ref={bgColorPickerRef} className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
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
              className={`w-full px-3 py-2 text-sm rounded-lg border transition ${
                selectedSegment.style.backgroundColor === 'transparent'
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
              }`}
            >
              {selectedSegment.style.backgroundColor === 'transparent' ? '已启用透明背景' : '使用透明背景'}
            </button>
          </div>
        </div>

        {/* 透明度 */}
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">
            透明度: <span className="text-white">{Math.round(selectedSegment.style.opacity * 100)}%</span>
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
      </CollapsibleSection>

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 描边效果 (可折叠) ========== */}
      <CollapsibleSection
        title="描边效果"
        isExpanded={expandedSections.stroke}
        onToggle={() => toggleSection('stroke')}
        hasToggle={true}
        toggleChecked={selectedSegment.style.enableStroke}
        onToggleChange={(checked) => updateStyle({ enableStroke: checked })}
      >
        {selectedSegment.style.enableStroke && (
          <>
            {/* 描邊顏色 */}
            <div>
              <label className="block text-xs font-medium mb-2 text-gray-400">描邊顏色</label>
              <div className="relative">
                <button
                  onClick={() => setShowStrokeColorPicker(!showStrokeColorPicker)}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
                >
                  <div
                    className="w-8 h-8 rounded border-2 border-gray-600"
                    style={{ backgroundColor: selectedSegment.style.strokeColor }}
                  />
                  <span className="font-mono text-sm">{selectedSegment.style.strokeColor}</span>
                </button>
                {showStrokeColorPicker && (
                  <div ref={strokeColorPickerRef} className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
                    <HexColorPicker
                      color={selectedSegment.style.strokeColor}
                      onChange={(color) => updateStyle({ strokeColor: color })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 描邊寬度 */}
            <div>
              <label className="block text-xs font-medium mb-2 text-gray-400">
                描邊寬度: <span className="text-white">{selectedSegment.style.strokeWidth}px</span>
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={selectedSegment.style.strokeWidth}
                  onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={selectedSegment.style.strokeWidth}
                  onChange={(e) => updateStyle({ strokeWidth: parseInt(e.target.value) })}
                  className="w-16 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-center focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </>
        )}
      </CollapsibleSection>

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 陰影效果 (可折疊) ========== */}
      <CollapsibleSection
        title="陰影效果"
        isExpanded={expandedSections.shadow}
        onToggle={() => toggleSection('shadow')}
        hasToggle={true}
        toggleChecked={selectedSegment.style.enableShadow}
        onToggleChange={(checked) => updateStyle({ enableShadow: checked })}
      >
        {selectedSegment.style.enableShadow && (
          <ShadowControlsImproved
            selectedSegment={selectedSegment}
            updateStyle={updateStyle}
            showShadowColorPicker={showShadowColorPicker}
            setShowShadowColorPicker={setShowShadowColorPicker}
            shadowColorPickerRef={shadowColorPickerRef}
          />
        )}
      </CollapsibleSection>

      <div className="border-t border-gray-700/50"></div>

      {/* 樣式模板區域 */}
      <StyleTemplateSection
        selectedSegment={selectedSegment}
        applyToAll={applyToAll}
      />

      <div className="border-t border-gray-700/50"></div>

      {/* ========== 預覽區域 ========== */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">預覽</h3>
        <LivePreviewCard selectedSegment={selectedSegment} />
      </div>
    </div>
  );
}

// 可折叠区域组件
interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  hasToggle?: boolean;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
  hasToggle = false,
  toggleChecked = false,
  onToggleChange
}: CollapsibleSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {title}
        </button>
        {hasToggle && onToggleChange && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={toggleChecked}
              onChange={(e) => onToggleChange(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs text-gray-400">啟用</span>
          </label>
        )}
      </div>
      {isExpanded && (
        <div className="space-y-3 pl-6 border-l-2 border-gray-700/50">
          {children}
        </div>
      )}
    </div>
  );
}

// 即时预览卡片组件
interface LivePreviewCardProps {
  selectedSegment: SubtitleSegment;
}

function LivePreviewCard({ selectedSegment }: LivePreviewCardProps) {
  const style = selectedSegment.style;

  // 计算预览样式（缩小50%）
  const previewStyle: React.CSSProperties = {
    color: style.color,
    fontSize: `${style.fontSize * 0.5}px`,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: style.textDecoration,
    opacity: style.opacity,
    backgroundColor: style.backgroundColor,
    padding: '8px 12px',
    borderRadius: '6px',
    display: 'inline-block',
  };

  // 添加描边效果
  if (style.enableStroke) {
    previewStyle.WebkitTextStroke = `${style.strokeWidth * 0.5}px ${style.strokeColor}`;
  }

  // 添加阴影效果
  if (style.enableShadow) {
    previewStyle.textShadow = `${style.shadowOffsetX * 0.5}px ${style.shadowOffsetY * 0.5}px ${style.shadowBlur * 0.5}px ${style.shadowColor}`;
  }

  return (
    <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Eye size={16} className="text-blue-400" />
        <span className="text-sm font-medium text-gray-400">即時預覽</span>
      </div>
      <div className="w-full min-h-[80px] bg-black rounded-lg flex items-center justify-center overflow-hidden p-4">
        <div style={previewStyle}>
          {selectedSegment.text || '示例文字'}
        </div>
      </div>
      {selectedSegment.translatedText && (
        <div className="w-full min-h-[64px] bg-black rounded-lg flex items-center justify-center overflow-hidden mt-2 p-4">
          <div style={previewStyle}>
            {selectedSegment.translatedText}
          </div>
        </div>
      )}
    </div>
  );
}

// 阴影控制改良版组件
interface ShadowControlsImprovedProps {
  selectedSegment: SubtitleSegment;
  updateStyle: (updates: Partial<SubtitleSegment['style']>) => void;
  showShadowColorPicker: boolean;
  setShowShadowColorPicker: (show: boolean) => void;
  shadowColorPickerRef: React.RefObject<HTMLDivElement | null>;
}

function ShadowControlsImproved({
  selectedSegment,
  updateStyle,
  showShadowColorPicker,
  setShowShadowColorPicker,
  shadowColorPickerRef,
}: ShadowControlsImprovedProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 处理方向盘拖曳
  const handlePadMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateShadowFromPad(e);
  };

  const handlePadMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateShadowFromPad(e);
    }
  };

  const handlePadMouseUp = () => {
    setIsDragging(false);
  };

  const updateShadowFromPad = (e: React.MouseEvent) => {
    if (!padRef.current) return;

    const rect = padRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 将坐标转换为 -50 到 50 的范围
    const offsetX = Math.round(((x / rect.width) * 100) - 50);
    const offsetY = Math.round(((y / rect.height) * 100) - 50);

    updateStyle({
      shadowOffsetX: Math.max(-50, Math.min(50, offsetX)),
      shadowOffsetY: Math.max(-50, Math.min(50, offsetY)),
    });
  };

  // 快速预设方向
  const setPresetDirection = (x: number, y: number) => {
    updateStyle({ shadowOffsetX: x, shadowOffsetY: y });
  };

  // 快速模糊预设
  const setBlurPreset = (blur: number) => {
    updateStyle({ shadowBlur: blur });
  };

  // 计算方向点的位置
  const pointX = ((selectedSegment.style.shadowOffsetX + 50) / 100) * 96;
  const pointY = ((selectedSegment.style.shadowOffsetY + 50) / 100) * 96;

  return (
    <div className="space-y-4">
      {/* 陰影顏色 */}
      <div>
        <label className="block text-xs font-medium mb-2 text-gray-400">陰影顏色</label>
        <div className="relative">
          <button
            onClick={() => setShowShadowColorPicker(!showShadowColorPicker)}
            className="w-full flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition"
          >
            <div
              className="w-8 h-8 rounded border-2 border-gray-600"
              style={{ backgroundColor: selectedSegment.style.shadowColor }}
            />
            <span className="font-mono text-sm">{selectedSegment.style.shadowColor}</span>
          </button>
          {showShadowColorPicker && (
            <div ref={shadowColorPickerRef} className="absolute top-full mt-2 z-50 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
              <HexColorPicker
                color={selectedSegment.style.shadowColor}
                onChange={(color) => updateStyle({ shadowColor: color })}
              />
            </div>
          )}
        </div>
      </div>

      {/* 方向控制區域 */}
      <div>
        <label className="block text-xs font-medium mb-2 text-gray-400">陰影方向</label>
        <div className="flex gap-3">
          {/* 可拖曳的方向盘 */}
          <div className="flex-shrink-0">
            <div
              ref={padRef}
              className="w-24 h-24 bg-gray-900 border-2 border-gray-600 rounded-lg relative cursor-crosshair"
              onMouseDown={handlePadMouseDown}
              onMouseMove={handlePadMouseMove}
              onMouseUp={handlePadMouseUp}
              onMouseLeave={handlePadMouseUp}
            >
              {/* 中心十字线 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-full h-px bg-gray-700"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-px h-full bg-gray-700"></div>
              </div>

              {/* 可拖曳的点 */}
              <div
                className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${pointX}px`,
                  top: `${pointY}px`,
                }}
              />
            </div>
          </div>

          {/* 快速预设按钮 */}
          <div className="flex-1 grid grid-cols-3 gap-1.5">
            <div></div>
            <button
              onClick={() => setPresetDirection(0, -10)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition"
              title="向上"
            >
              <ArrowUp size={16} className="mx-auto" />
            </button>
            <div></div>

            <button
              onClick={() => setPresetDirection(-10, 0)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition"
              title="向左"
            >
              <ArrowLeft size={16} className="mx-auto" />
            </button>
            <button
              onClick={() => setPresetDirection(0, 0)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition text-xs"
              title="無陰影"
            >
              無
            </button>
            <button
              onClick={() => setPresetDirection(10, 0)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition"
              title="向右"
            >
              <ArrowRight size={16} className="mx-auto" />
            </button>

            <div></div>
            <button
              onClick={() => setPresetDirection(0, 10)}
              className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition"
              title="向下"
            >
              <ArrowDown size={16} className="mx-auto" />
            </button>
            <div></div>
          </div>
        </div>
      </div>

      {/* 精确数值输入 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">
            水平偏移: <span className="text-white">{selectedSegment.style.shadowOffsetX}px</span>
          </label>
          <input
            type="number"
            min="-50"
            max="50"
            value={selectedSegment.style.shadowOffsetX}
            onChange={(e) => updateStyle({ shadowOffsetX: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-center focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-400">
            垂直偏移: <span className="text-white">{selectedSegment.style.shadowOffsetY}px</span>
          </label>
          <input
            type="number"
            min="-50"
            max="50"
            value={selectedSegment.style.shadowOffsetY}
            onChange={(e) => updateStyle({ shadowOffsetY: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-center focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 模糊程度 */}
      <div>
        <label className="block text-xs font-medium mb-2 text-gray-400">
          模糊程度: <span className="text-white">{selectedSegment.style.shadowBlur}px</span>
        </label>

        {/* 快速预设按钮 */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <button
            onClick={() => setBlurPreset(0)}
            className={`px-2 py-1.5 text-xs rounded-lg border transition ${
              selectedSegment.style.shadowBlur === 0
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
          >
            無
          </button>
          <button
            onClick={() => setBlurPreset(5)}
            className={`px-2 py-1.5 text-xs rounded-lg border transition ${
              selectedSegment.style.shadowBlur === 5
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
          >
            輕微
          </button>
          <button
            onClick={() => setBlurPreset(15)}
            className={`px-2 py-1.5 text-xs rounded-lg border transition ${
              selectedSegment.style.shadowBlur === 15
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
          >
            中等
          </button>
          <button
            onClick={() => setBlurPreset(30)}
            className={`px-2 py-1.5 text-xs rounded-lg border transition ${
              selectedSegment.style.shadowBlur === 30
                ? 'bg-blue-600 border-blue-500'
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
          >
            強烈
          </button>
        </div>

        {/* 滑杆控制 */}
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min="0"
            max="50"
            value={selectedSegment.style.shadowBlur}
            onChange={(e) => updateStyle({ shadowBlur: parseInt(e.target.value) })}
            className="flex-1"
          />
          <input
            type="number"
            min="0"
            max="50"
            value={selectedSegment.style.shadowBlur}
            onChange={(e) => updateStyle({ shadowBlur: parseInt(e.target.value) || 0 })}
            className="w-16 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-center focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

// 样式模板区域组件
interface StyleTemplateSectionProps {
  selectedSegment: SubtitleSegment;
  applyToAll: boolean;
}

function StyleTemplateSection({ selectedSegment, applyToAll }: StyleTemplateSectionProps) {
  const {
    styleTemplates,
    saveStyleTemplate,
    applyStyleTemplate,
    deleteStyleTemplate,
    setDefaultTemplate
  } = useSubtitleStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;

    saveStyleTemplate(templateName.trim(), selectedSegment.style, false);
    setTemplateName('');
    setShowSaveDialog(false);
  };

  const handleApplyTemplate = (templateId: string) => {
    applyStyleTemplate(templateId, selectedSegment.id, applyToAll);
  };

  const handleSetDefault = (templateId: string) => {
    setDefaultTemplate(templateId);
  };

  return (
    <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Type size={16} />
          样式模板
        </h3>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1.5 transition"
        >
          <Save size={14} />
          保存当前样式
        </button>
      </div>

      {/* 模板格子网格 */}
      <div className="grid grid-cols-6 gap-2">
        {styleTemplates.map((template) => (
          <div key={template.id} className="relative group">
            <button
              onClick={() => handleApplyTemplate(template.id)}
              className={`
                w-full aspect-square rounded-lg border-2 transition-all duration-200
                flex items-center justify-center text-lg font-bold
                ${template.isDefault
                  ? 'border-yellow-500 bg-yellow-600 hover:bg-yellow-700'
                  : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                }
              `}
              title={template.name}
            >
              T
            </button>

            {/* 删除按钮 - 只有非预设模板才能删除 */}
            {!template.isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteStyleTemplate(template.id);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            )}

            {/* 设为预设按钮 */}
            {!template.isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetDefault(template.id);
                }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-600 hover:bg-yellow-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                title="设为预设"
              >
                ⭐
              </button>
            )}

            {/* 模板名称 */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {template.name}
            </div>
          </div>
        ))}

        {/* 新增模板按钮 - 如果模板数量少于12个 */}
        {styleTemplates.length < 12 && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-500 flex items-center justify-center text-gray-500 hover:text-gray-400 transition-all"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* 储存对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 w-96" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold mb-4">保存樣式模板</h4>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="請輸入模板名稱..."
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-600 rounded-lg mb-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
