import { createLogger } from "../../../packages/logger/src/index.js";
import * as coreMemory from "../memory/core.js";
import * as episodeStore from "../memory/episodes.js";

const log = createLogger('brain:summarizer');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

export async function summarizeSession(session) {
  if (session.messages.length < 2) return;

  const transcript = session.messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AXIS'
    },

    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 0,

      messages: [
        {
          role: 'system',
          content: `
Return ONLY valid JSON:

{
  "episode": "one sentence summary",
  "tags": ["tag1"],
  "core_updates": {}
}
`
        },
        {
          role: 'user',
          content: transcript
        }
      ]
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    log.error({ err }, 'summarizer failed');
    return;
  }

  const data = await response.json();
  const raw = data.choices[0].message.content.trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.error({ raw }, 'invalid JSON');
    return;
  }

  if (parsed.episode) {
    episodeStore.add(parsed.episode, parsed.tags || []);
  }

  if (parsed.core_updates && Object.keys(parsed.core_updates).length) {
    coreMemory.setMany(parsed.core_updates);
  }
}