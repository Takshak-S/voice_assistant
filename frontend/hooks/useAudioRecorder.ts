import { useRef, useState, useCallback, useEffect } from 'react';

interface UseAudioRecorderOptions {
  onDataAvailable?: (chunk: Blob) => void;
  onStop?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onVoiceActivity?: (isActive: boolean) => void;
  vadThreshold?: number;
  silenceDurationMs?: number;
}

export function useAudioRecorder({
  onDataAvailable,
  onStop,
  onError,
  onVoiceActivity,
  vadThreshold = 0.02,
  silenceDurationMs = 1500,
}: UseAudioRecorderOptions = {}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  
  // VAD state
  const vadStateRef = useRef<{
    isVoiceActive: boolean;
    silenceStartTime: number | null;
    voiceActiveCount: number;
    consecutiveSilence: number;
  }>({
    isVoiceActive: false,
    silenceStartTime: null,
    voiceActiveCount: 0,
    consecutiveSilence: 0,
  });

  const checkVoiceActivity = useCallback((level: number) => {
    const now = Date.now();
    const state = vadStateRef.current;
    
    if (level > vadThreshold) {
      // Voice detected
      if (!state.isVoiceActive) {
        state.isVoiceActive = true;
        state.voiceActiveCount = 0;
        state.consecutiveSilence = 0;
        onVoiceActivity?.(true);
      }
      state.silenceStartTime = null;
      state.voiceActiveCount++;
    } else {
      // Silence
      if (state.isVoiceActive) {
        state.consecutiveSilence++;
        if (state.silenceStartTime === null) {
          state.silenceStartTime = now;
        } else if (now - state.silenceStartTime > silenceDurationMs) {
          // End of speech detected
          state.isVoiceActive = false;
          onVoiceActivity?.(false);
        }
      }
    }
  }, [vadThreshold, silenceDurationMs, onVoiceActivity]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Reset VAD state
      vadStateRef.current = {
        isVoiceActive: false,
        silenceStartTime: null,
        voiceActiveCount: 0,
        consecutiveSilence: 0,
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          onDataAvailable?.(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onStop?.(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        onError?.(new Error(`Recording error: ${event.error}`));
      };

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalizedLevel = average / 255;
          setAudioLevel(normalizedLevel);
          checkVoiceActivity(normalizedLevel);
        }
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      // Start with small chunks for real-time streaming
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, [onDataAvailable, onStop, onError, checkVoiceActivity]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      setIsRecording(false);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isRecording]);

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}