// Project: AI Voice Bot (Next.js App Router)

// ===== FILE: src/app/globals.css =====
/* TODO: Add your global styles here */

// ===== FILE: src/app/layout.tsx =====
'use client';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* TODO: Add site-wide layout components (header, footer) */}
        {children}
      </body>
    </html>
  );
}

// ===== FILE: src/app/page.tsx =====
'use client';
console.log('🛠  page.tsx loaded at', new Date().toISOString());

import { useState, useCallback } from 'react';
import { useVoice } from '../hooks/useVoice';

export default function HomePage() {
  const [text, setText] = useState('');

  const handleResult = useCallback((transcript: string) => {
    setText(transcript);
    speechSynthesis.speak(new SpeechSynthesisUtterance(transcript));
  }, []);

  const startListening = useVoice(handleResult);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>🎙️ AI Friend Voice Test</h1>
      <button onClick={startListening} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Start Listening
      </button>
      <p style={{ marginTop: '1rem' }}>
        <strong>Heard you say:</strong> {text}
      </p>
    </main>
  );
}

// ===== FILE: src/hooks/useVoice.ts =====
'use client';
import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle speech recognition.
 * @param onResult Callback invoked with the recognized transcript.
 * @returns A function to start listening.
 */
export function useVoice(onResult: (transcript: string) => void): () => void {
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('SpeechRecognition not supported in this browser');
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [onResult]);

  return () => {
    recognitionRef.current?.start();
  };
}

// ===== NEXT STEPS =====
// 1. Add common UI components
// 2. Implement `useVoice` hook under src/hooks
// 3. Wire `HomePage` to call speech recognition
// 4. **Clear Next.js cache and restart** to ensure fresh builds:
//    ```bash
//    rm -rf .next node_modules/.cache
//    npm run dev
//    ```
