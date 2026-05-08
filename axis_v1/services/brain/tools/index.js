import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { set } from "../memory/core.js";

const log = createLogger('brain: tools')
const config = getConfig()

export const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: 'Execute a command on the user\'s laptop via the Axis agent. Use for: running shell commands, checking processes, reading logs, git status, killing processes.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['exec_shell', 'list_processes', 'get_git_status', 'read_log', 'kill_process'],
                        description: 'The action to execute',
                    },
                    params: {
                        type: 'object',
                        description: 'Parameters for the action. exec_shell needs {command}, read_log needs {filePath, lines}, kill_process needs {pid}',
                    },
                },
                required: ['action'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_system_state',
            description: 'Get current system state from the laptop — processes, memory, uptime, git state. Use when user asks about what\'s running or system health.',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'update_memory',
            description: 'Update a core memory fact about the user or their projects. Use when user mentions something worth remembering permanently.',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Memory key e.g. user.current_focus' },
                    value: { type: 'string', description: 'Value to store' },
                },
                required: ['key', 'value'],
            },
        },
    },

    {
        type: 'function',
        function: {
            name: 'scout_search',
            description: 'Search for jobs on demand. Use when user asks about jobs, opportunities, companies hiring, or career signals. Triggers Scout pipeline for specific queries.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'What to search for e.g. "backend Go roles fintech Europe"',
                    },
                    minScore: {
                        type: 'number',
                        description: 'Minimum relevance score 1-10. Default 6.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'scout_digest',
            description: 'Get today\'s job digest — the pre-ranked morning brief. Use when user asks what jobs are available today or wants the daily summary.',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },

]

export async function executeTool(toolName, args, coordinatorPort) {
    const start = Date.now()
    log.info({ toolName, args }, 'tool called')

    try {
        let result

        switch (toolName) {
            case 'execute_command': {
                const r = await fetch(
                    `http://localhost:${coordinatorPort}/commands`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agentId: 'default-agent',
                            action: args.action,
                            params: args.params || {},
                        }),
                    }
                )
                result = await r.json()
                break
            }

            case 'get_system_state': {
                const r = await fetch(
                    `http://localhost:${coordinatorPort}/state`
                )
                result = await r.json()
                break
            }

            case 'update_memory': {
                set(args.key, args.value)
                result = { ok: true, message: `remembered: ${args.key} = ${args.value}` }
                break
            }


            case 'scout_search': {
                const scoutPort = process.env.SCOUT_PORT || 3003
                const minScore = args.minScore || 6
                const r = await fetch(
                    `http://localhost:${scoutPort}/jobs?min_score=${minScore}&limit=10`
                )
                result = await r.json()
                break
            }

            case 'scout_digest': {
                const scoutPort = process.env.SCOUT_PORT || 3003
                const r = await fetch(`http://localhost:${scoutPort}/digest/latest`)
                result = await r.json()
                break
            }

            default:
                result = { ok: false, error: `unknown tool: ${toolName}` }
        }

        const duration = Date.now() - start
        log.info({ toolName, duration, ok: result.ok }, 'tool complete')
        return JSON.stringify(result)
    } catch (error) {
        log.error({ toolName, err: err.message }, 'tool error')
        return JSON.stringify({ ok: false, error: err.message })
    }
}