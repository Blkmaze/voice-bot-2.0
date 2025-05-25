// organize.js - Full Scaffold & Cleanup Script for AI Voice Bot Next.js App Router
// Save this file as 'organize.js' in your project root (e.g., C:\frontend\ai-voice-bot)
// Run with `node organize.js` to reset and rebuild your project structure.

const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcApp = path.join(root, 'src', 'app');
const srcHooks = path.join(root, 'src', 'hooks');

// 1. Remove default Pages Router and cache
const toRemove = ['pages', path.join('src','pages'), '.next'];
toRemove.forEach(dir => {
  const fullPath = path.join(root, dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Removed directory: ${fullPath}`);
  } else {
    console.log(`Directory not found (skipped): ${fullPath}`);
  }
});

// 2. Ensure directories exist
[srcApp, srcHooks].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// 3. Write globals.css
const globalsCss = `/* src/app/globals.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: sans-serif; }
`;
fs.writeFileSync(path.join(srcApp, 'globals.css'), globalsCss);
console.log('Created globals.css');

// 4. Write layout.tsx
const layoutTsx = `// src/app/layout.tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
fs.writeFileSync(path.join(srcApp, 'layout.tsx'), layoutTsx);
console.log('Created layout.tsx');

// 5. Write useVoice hook
const useVoiceTs = `// src/hooks/useVoice.ts
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
`;
fs.writeFileSync(path.join(srcHooks, 'useVoice.ts'), useVoiceTs);
console.log('Created useVoice.ts');

// 6. Write page.tsx
const pageTsx = `// src/app/page.tsx
'use client';
import { useState } from 'react';
import { useVoice } from '../hooks/useVoice';

export default function HomePage() {
  const [text, setText] = useState('');
  const rec = useVoice(t => {
    setText(t);
    speechSynthesis.speak(new SpeechSynthesisUtterance(t));
  });

  return (
    <main style={{ padding: '2rem' }}>
      <h1>🎙️ AI Friend Voice Test</h1>
      <button onClick={() => rec?.start()} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Start Listening
      </button>
      <p style={{ marginTop: '1rem' }}><strong>Heard you say:</strong> {text}</p>
    </main>
  );
}
`;
fs.writeFileSync(path.join(srcApp, 'page.tsx'), pageTsx);
console.log('Created page.tsx');

console.log('Scaffold complete. Run `npm install` if needed, then `npm run dev` to start the server.');
