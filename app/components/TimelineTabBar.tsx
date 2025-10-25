'use client';

import { useState } from 'react';
import { 
  VideoIcon, 
  MusicIcon, 
  TypeIcon, 
  StickerIcon, 
  SparklesIcon, 
  ArrowLeftRightIcon, 
  CaptionsIcon, 
  BlendIcon, 
  SlidersHorizontalIcon, 
  SettingsIcon,
  type LucideIcon 
} from 'lucide-react';

type Tab = 
  | 'media' 
  | 'sounds' 
  | 'text' 
  | 'stickers' 
  | 'effects' 
  | 'transitions' 
  | 'captions' 
  | 'filters' 
  | 'adjustment' 
  | 'settings';

const tabs: { [key in Tab]: { icon: LucideIcon; label: string } } = {
  media: { icon: VideoIcon, label: 'Media' },
  sounds: { icon: MusicIcon, label: 'Sounds' },
  text: { icon: TypeIcon, label: 'Text' },
  stickers: { icon: StickerIcon, label: 'Stickers' },
  effects: { icon: SparklesIcon, label: 'Effects' },
  transitions: { icon: ArrowLeftRightIcon, label: 'Transitions' },
  captions: { icon: CaptionsIcon, label: 'Captions' },
  filters: { icon: BlendIcon, label: 'Filters' },
  adjustment: { icon: SlidersHorizontalIcon, label: 'Adjustment' },
  settings: { icon: SettingsIcon, label: 'Settings' },
};

interface TimelineTabBarProps {
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
}

export default function TimelineTabBar({ 
  activeTab = 'text', 
  onTabChange 
}: TimelineTabBarProps) {
  const [currentTab, setCurrentTab] = useState<Tab>(activeTab);

  const handleTabClick = (tab: Tab) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4 px-2 bg-gray-900 border-r border-gray-800 h-full overflow-y-auto scrollbar-thin">
      {(Object.keys(tabs) as Tab[]).map((tabKey) => {
        const tab = tabs[tabKey];
        const Icon = tab.icon;
        const isActive = currentTab === tabKey;

        return (
          <button
            key={tabKey}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition group relative ${
              isActive 
                ? 'text-primary opacity-100' 
                : 'text-muted-foreground opacity-70 hover:opacity-100'
            }`}
            onClick={() => handleTabClick(tabKey)}
            title={tab.label}
          >
            <Icon className="w-5 h-5" />
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition">
              {tab.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}