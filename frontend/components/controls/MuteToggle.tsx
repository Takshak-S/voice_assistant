'use client';

import { Button } from '@/components/ui/Button';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

interface MuteToggleProps {
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
}

export function MuteToggle({ isMuted, volume, onToggleMute, onVolumeChange }: MuteToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        aria-pressed={isMuted}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </Button>

      {!isMuted && volume > 0 && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-24 h-2 appearance-none bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer accent-primary-600"
          aria-label="Volume"
        />
      )}
    </div>
  );
}