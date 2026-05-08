import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.js";
import "dotenv/config";

const log = createLogger('brain:ai');
const config = getConfig();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const MAX_TOOL_LOOPS = 5;

function parseXmlToolRequest(content) {
  if (!content || !content.includes('<tool_call>')) return null;

  const functionMatch = content.match(/<function=([^>]+)>/);
  if (!functionMatch) return null;

  const toolName = functionMatch[1].trim();
  const args = {};

  for (const match of content.matchAll(/<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g)) {
    const key = match[1].trim();
    const rawValue = match[2].trim();

    if (rawValue === '') {
      args[key] = '';
      continue;
    }

    const numericValue = Number(rawValue);
    args[key] = Number.isFinite(numericValue) && rawValue === String(numericValue)
      ? numericValue
      : rawValue;
  }

  return { toolName, args };
}

function isToolRequestMessage(message) {
  if (message?.tool_calls?.length) return true;
  return Boolean(parseXmlToolRequest(message?.content));
}

function summarizeJobResult(result) {
  const jobs = result?.data?.jobs || [];
  const query = result?.data?.query || 'your query';

  if (!jobs.length) {
    return `Scout returned 0 matching jobs for "${query}" after a fresh scrape.`;
  }

  const lines = jobs.slice(0, 5).map((job, index) => {
    const location = job.location || 'Unknown location';
    const score = typeof job.overall_score === 'number' ? job.overall_score.toFixed(1) : 'n/a';
    return `${index + 1}. ${job.title} at ${job.company} (${location}) - score ${score}`;
  });

  return [`Scout found ${jobs.length} matching jobs for "${query}":`, ...lines].join('\n');
}

function summarizeSavedJobsResult(result) {
  const jobs = result?.data?.jobs || [];

  if (!jobs.length) {
    return 'No saved roles yet.';
  }

  const lines = jobs.slice(0, 10).map((job, index) => {
    const title = job.title || job.job_title || 'Untitled role';
    const company = job.company || job.job_company || 'Unknown company';
    const location = job.location || 'Unknown location';
    return `${index + 1}. ${title} at ${company} (${location})`;
  });

  return [`Saved roles (${jobs.length}):`, ...lines].join('\n');
}

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
- saved jobs / saved roles → scout_saved_jobs
- jobs / hiring / roles → scout_search or scout_digest

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

  const requestCompletion = async (withTools) => {
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
        ...(withTools ? {
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
        } : {}),
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message;
  };

  const initialMessage = await requestCompletion(true);
  apiMessages.push(initialMessage);

  const xmlToolRequest = parseXmlToolRequest(initialMessage.content);

  if (!initialMessage.tool_calls?.length && !xmlToolRequest) {
    return initialMessage.content || 'No response generated.';
  }

  const toolCalls = initialMessage.tool_calls?.length
    ? initialMessage.tool_calls.map(toolCall => ({
        id: toolCall.id,
        toolName: toolCall.function.name,
        args: JSON.parse(toolCall.function.arguments || '{}'),
      }))
    : [{
        id: 'xml-tool-call-0',
        ...xmlToolRequest,
      }];

  const toolResults = [];

  for (const toolCall of toolCalls) {
    const { id, toolName, args } = toolCall;

    const result = await executeTool(
      toolName,
      args,
      config.coordinator.port
    );

    toolResults.push({ toolName, args, result });

    apiMessages.push({
      role: 'tool',
      tool_call_id: id,
      content: typeof result === 'string'
        ? result
        : JSON.stringify(result),
    });
  }

  const scoutSearchResult = toolResults.find(entry => entry.toolName === 'scout_search');
  if (scoutSearchResult) {
    try {
      const parsed = typeof scoutSearchResult.result === 'string'
        ? JSON.parse(scoutSearchResult.result)
        : scoutSearchResult.result;

      return summarizeJobResult(parsed);
    } catch {
      return 'Scout returned results, but they could not be parsed.';
    }
  }

  const scoutSavedJobsResult = toolResults.find(entry => entry.toolName === 'scout_saved_jobs');
  if (scoutSavedJobsResult) {
    try {
      const parsed = typeof scoutSavedJobsResult.result === 'string'
        ? JSON.parse(scoutSavedJobsResult.result)
        : scoutSavedJobsResult.result;

      return summarizeSavedJobsResult(parsed);
    } catch {
      return 'Saved roles were returned, but they could not be parsed.';
    }
  }

  const scoutDigestResult = toolResults.find(entry => entry.toolName === 'scout_digest');
  if (scoutDigestResult) {
    try {
      const parsed = typeof scoutDigestResult.result === 'string'
        ? JSON.parse(scoutDigestResult.result)
        : scoutDigestResult.result;

      return summarizeJobResult(parsed);
    } catch {
      return 'Scout digest was returned, but it could not be parsed.';
    }
  }

  const finalMessage = await requestCompletion(false);

  if (finalMessage.tool_calls?.length) {
    log.warn(
      { toolCalls: finalMessage.tool_calls.map(tc => tc.function?.name) },
      'model requested more tools after final pass; returning tool result summary'
    );

    return finalMessage.content || 'Tool results received.';
  }

  if (!finalMessage.content || parseXmlToolRequest(finalMessage.content)) {
    const scoutResult = toolResults.find(entry => entry.toolName === 'scout_search' || entry.toolName === 'scout_digest');

    if (scoutResult) {
      try {
        const parsed = typeof scoutResult.result === 'string'
          ? JSON.parse(scoutResult.result)
          : scoutResult.result;

        return summarizeJobResult(parsed);
      } catch {
        return 'Scout returned results, but the summary could not be parsed.';
      }
    }
  }

  return finalMessage.content || 'No response generated.';
}