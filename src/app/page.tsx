// src/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

export default function HomePage() {
  const [text, setText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize SpeechRecognition once, on mount
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('SpeechRecognition API not supported in this browser');
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert('Speech Recognition API not available');
      return;
    }
    recognition.onstart = () => console.log('🎙️ Listening started');
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      console.log('📝 Result:', transcript);
      setText(transcript);
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(transcript));
    };
    recognition.onerror = (e: any) => console.error('❌ Error:', e.error);
    recognition.onend = () => console.log('🛑 Listening ended');
    recognition.start();
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>🎙️ AI Friend Voice Test</h1>
      <button onClick={startListening} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Start Listening
      </button>
      {text && (
        <p style={{ marginTop: '1rem' }}>
          <strong>You said:</strong> {text}
        </p>
      )}
    </main>
  );
}
