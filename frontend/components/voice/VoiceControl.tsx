'use client';

import { MicrophoneButton } from './MicrophoneButton';
import { StateIndicator } from './StateIndicator';
import { TranscriptDisplay } from './TranscriptDisplay';
import { AssistantState } from '@/types/websocket';
import { cn } from '@/lib/utils';

interface VoiceControlProps {
  state: AssistantState;
  isRecording: boolean;
  audioLevel: number;
  transcript: string;
  isFinalTranscript: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function VoiceControl({
  state,
  isRecording,
  audioLevel,
  transcript,
  isFinalTranscript,
  onStart,
  onStop,
  disabled,
}: VoiceControlProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <StateIndicator state={state} />
      <MicrophoneButton
        state={state}
        isRecording={isRecording}
        audioLevel={audioLevel}
        onStart={onStart}
        onStop={onStop}
        disabled={disabled}
      />
      <TranscriptDisplay transcript={transcript} isFinal={isFinalTranscript} />
    </div>
  );
}