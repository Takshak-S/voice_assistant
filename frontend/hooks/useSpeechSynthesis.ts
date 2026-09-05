import { useRef, useState, useCallback, useEffect } from 'react';

export function useSpeechSynthesis() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    currentUtteranceRef.current = null;
    setIsPlaying(false);
  }, []);

  const speak = useCallback((text: string, onStart?: () => void, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return;
    }

    if (!text || !text.trim()) {
      onEnd?.();
      return;
    }

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    currentUtteranceRef.current = utterance;

    utterance.volume = isMutedRef.current ? 0 : volumeRef.current;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    ) || voices.find((v) => v.lang.startsWith('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      onStart?.();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      currentUtteranceRef.current = null;
      onEnd?.();
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      currentUtteranceRef.current = null;
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.volume = next ? 0 : volumeRef.current;
      }
      return next;
    });
  }, []);

  const setVolumeLevel = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    setVolume(clamped);
    if (currentUtteranceRef.current && !isMutedRef.current) {
      currentUtteranceRef.current.volume = clamped;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isPlaying,
    isMuted,
    volume,
    speak,
    stop,
    toggleMute,
    setVolume: setVolumeLevel,
  };
}