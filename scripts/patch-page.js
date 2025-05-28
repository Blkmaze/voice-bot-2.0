// scripts/patch-page.js
/**
 * Auto-injects an async/IIFE onresult handler into src/app/page.tsx
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// This regex grabs the old onresult block (from recognition.onresult to its closing brace)
const newHandler = `recognition.onresult = (event) => {
  console.log('🗣️ Speech event:', event);
  (async () => {
    try {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('').trim();

      const res = await fetch('/api/your-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(\`HTTP \${res.status} – \${text || '(no body returned)'}\`);
      }

      const { answer = '' } = await res.json();
      handleReply(answer);

    } catch (err) {
      console.error('❌ Error in recognition.onresult:', err);
    }
  })();
};`;

content = content.replace(
  /recognition\.onresult\s*=\s*\([\s\S]*?};/,
  newHandler
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('✅ Patched recognition.onresult in page.tsx');
