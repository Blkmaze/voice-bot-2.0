// src/hooks/useVoice.ts
'use client';
import { useEffect, useState } from 'react';

export function useVoice(onResult: (transcript: string) => void) {
  const [rec, setRec] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: SpeechRecognitionEvent) => onResult(e.results[0][0].transcript);
    setRec(recognition);
  }, [onResult]);

  return rec;
}
