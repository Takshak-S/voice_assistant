import { useRef, useState, useCallback, useEffect } from 'react';

interface UseAudioRecorderOptions {
  onDataAvailable?: (chunk: Blob) => void;
  onStop?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onVoiceActivity?: (isActive: boolean) => void;
  onSilence?: () => void;
  vadThreshold?: number;
  silenceDurationMs?: number;
}

export function useAudioRecorder({
  onDataAvailable,
  onStop,
  onError,
  onVoiceActivity,
  onSilence,
  vadThreshold = 0.02,
  silenceDurationMs = 1500,
}: UseAudioRecorderOptions = {}) {
  const optionsRef = useRef({
    onDataAvailable,
    onStop,
    onError,
    onVoiceActivity,
    onSilence,
    vadThreshold,
    silenceDurationMs,
  });

  useEffect(() => {
    optionsRef.current = {
      onDataAvailable,
      onStop,
      onError,
      onVoiceActivity,
      onSilence,
      vadThreshold,
      silenceDurationMs,
    };
  }, [onDataAvailable, onStop, onError, onVoiceActivity, onSilence, vadThreshold, silenceDurationMs]);

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
    const threshold = optionsRef.current.vadThreshold ?? 0.02;
    const silenceDuration = optionsRef.current.silenceDurationMs ?? 1500;

    if (level > threshold) {
      if (!state.isVoiceActive) {
        state.isVoiceActive = true;
        state.voiceActiveCount = 0;
        state.consecutiveSilence = 0;
        optionsRef.current.onVoiceActivity?.(true);
      }
      state.silenceStartTime = null;
      state.voiceActiveCount++;
    } else {
      if (state.isVoiceActive) {
        state.consecutiveSilence++;
        if (state.silenceStartTime === null) {
          state.silenceStartTime = now;
        } else if (now - state.silenceStartTime > silenceDuration) {
          state.isVoiceActive = false;
          optionsRef.current.onVoiceActivity?.(false);
          optionsRef.current.onSilence?.();
        }
      }
    }
  }, []);

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

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
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
          optionsRef.current.onDataAvailable?.(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        optionsRef.current.onStop?.(blob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.onerror = (event) => {
        optionsRef.current.onError?.(new Error(`Recording error: ${event.error}`));
      };

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
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

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      optionsRef.current.onError?.(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, [checkVoiceActivity]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping mediaRecorder:', err);
      }
    }
    setIsRecording(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.warn('Error cancelling mediaRecorder:', err);
      }
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}