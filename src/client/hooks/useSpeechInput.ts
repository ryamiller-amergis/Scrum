import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Encapsulates browser speech-to-text. Calls `onTranscript` with the full
 * composed text (base + final + interim) on every recognition update.
 */
export function useSpeechInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setIsSpeechSupported(false); return; }

    setIsSpeechSupported(true);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onstart = () => { setIsListening(true); setSpeechError(null); };
    rec.onend   = () => { setIsListening(false); };
    rec.onerror = (e) => {
      const code = e.error ?? 'unknown';
      if (code === 'not-allowed') {
        setSpeechError('Microphone access is blocked. Allow microphone permissions and try again.');
      } else if (code === 'no-speech') {
        setSpeechError('No speech detected. Try again and speak closer to your microphone.');
      } else {
        setSpeechError(`Speech recognition error: ${code}`);
      }
    };
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript?.trim() ?? '';
        if (r.isFinal) finalText += `${t} `;
        else interimText += `${t} `;
      }
      const base = baseRef.current.trim();
      const next = [base, finalText.trim(), interimText.trim()].filter(Boolean).join(' ');
      onTranscriptRef.current(next);
    };

    recognitionRef.current = rec;
    return () => {
      rec.onstart = null; rec.onend = null; rec.onerror = null; rec.onresult = null;
      rec.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggle = useCallback((currentInput: string) => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isListening) { rec.stop(); return; }
    baseRef.current = currentInput;
    setSpeechError(null);
    try { rec.start(); } catch {
      setSpeechError('Could not start voice transcription. Please try again.');
    }
  }, [isListening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { isListening, isSpeechSupported, speechError, toggle, stop };
}
