import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.js";
import "dotenv/config";

const log = createLogger('brain:ai');
const config = getConfig();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const MAX_TOOL_LOOPS = 5;

export function buildSystemPrompt(context) {
  const { coreMemory, episodes, systemState } = context;

  const facts = Object.entries(coreMemory)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const history = episodes.length
    ? episodes.map(e => `- ${e.summary}`).join('\n')
    : 'No recent episodes yet';

  const system = systemState
    ? `
Agent: ${systemState.agents?.[0]?.status || 'unknown'}
Processes: ${systemState.agents?.[0]?.snapshot?.processes?.length || 0}
Memory: ${systemState.agents?.[0]?.snapshot?.memory?.usedPct || 'unknown'}%
`
    : 'Unavailable';

  return `
You are AXIS — a system execution agent.

CRITICAL RULES:
- If user asks about system state → MUST use tools
- NEVER hallucinate results
- NEVER say "I sent a command" unless tool is executed
- ALWAYS prefer tool_calls when available
- Be concise and technical

TOOLS USAGE RULES:
- processes → list_processes
- git status → get_git_status
- system info → get_system_state

MEMORY:
${facts}

HISTORY:
${history}

SYSTEM:
${system}
`;
}

export async function chat(messages, context) {
  const systemPrompt = buildSystemPrompt(context);

  let apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  let loops = 0;

  while (loops < MAX_TOOL_LOOPS) {
    loops++;

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
        messages: apiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    apiMessages.push(message);

    if (!message.tool_calls?.length) {
      return message.content || "No response generated.";
    }

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      const result = await executeTool(
        toolName,
        args,
        config.coordinator.port
      );

      apiMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: typeof result === 'string'
          ? result
          : JSON.stringify(result),
      });
    }
  }

  return 'Tool loop limit reached';
}