import { useRef, useState, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onEnd?: () => void;
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: () => void;
  onend: () => void;
  onnomatch: (event: SpeechRecognitionEvent) => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useSpeechRecognition({
  onResult,
  onError,
  onStart,
  onEnd,
  lang = 'en-US',
  continuous = false,
  interimResults = true,
}: UseSpeechRecognitionOptions = {}) {
  const optionsRef = useRef({ onResult, onError, onStart, onEnd });
  optionsRef.current = { onResult, onError, onStart, onEnd };
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSpeechRecognitionClass = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  // Check browser support on mount
  useEffect(() => {
    setIsSupported(!!getSpeechRecognitionClass());
  }, [getSpeechRecognitionClass]);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      const error = new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      optionsRef.current.onError?.(error);
      setError(error.message);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognitionClass();

      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = langRef.current || lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        optionsRef.current.onStart?.();
      };

      recognition.onend = () => {
        setIsListening(false);
        optionsRef.current.onEnd?.();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          optionsRef.current.onResult?.(finalTranscript, true);
        } else if (interimTranscript) {
          optionsRef.current.onResult?.(interimTranscript, false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') {
          return;
        }
        let userMessage = event.message || event.error;
        if (event.error === 'not-allowed') {
          userMessage = 'Microphone permission denied. Please allow microphone access in Chrome.';
        }
        const error = new Error(`Speech recognition error: ${userMessage}`);
        optionsRef.current.onError?.(error);
        setError(userMessage);
      };

      recognition.onnomatch = () => {
        // No match found
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start speech recognition');
      optionsRef.current.onError?.(error);
      setError(error.message);
    }
  }, [continuous, getSpeechRecognitionClass, interimResults, lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    abortListening,
  };
}