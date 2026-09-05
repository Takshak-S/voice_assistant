export interface VoiceSettings {
  mute: boolean;
  volume: number;
}

export interface TranscriptSegment {
  text: string;
  is_final: boolean;
  timestamp: number;
}