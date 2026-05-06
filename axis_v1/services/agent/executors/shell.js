import path from "path";
import { createLogger } from "../../../packages/logger/src/index.js";
import {exec, execSync} from "child_process";

const log = createLogger('agent: executor')

const ALLOWLIST = {
    exec_shell: execShell,
    list_process: listProcesses,
    get_git_status: getGitStatus,
    read_log: readLog,
    kill_process: killProcess,
}

export async function execute(action, params = {}){
  const handler = ALLOWLIST[action]

    if(!handler){
        log.warn({action}, 'REJECTED - action not in allowlist')
        return {
            ok: false,
            output: null,
            error: `action ${action} is not permitted`
        }
    }

    try {
        log.info({action, params}, 'executing')
        const output = await handler(params)
        log.info({action}, 'execution complete')
        return {ok:true, output, error: null}
    } catch (error) {
      log.error({action, err: error.message}, 'execution failed')
      return { ok: false, output: null, error: error.message }
    }
}

export async function execShell({command, cwd}){
    if(!command) throw new Error('command is required')

    const blocked = [
        /rm\s+-rf\s+\//,
        /mkfs/,
        /dd\s+if=.*of=\/dev/,
        />\s*\/dev\/sd/,
        /chmod\s+777\s+\// 
    ]

    if (blocked.some(pattern => pattern.test(command))){
        throw new Error('command blocked by safety filter')
    }

    return new Promise((resolve, reject)=>{
        exec(command, {
            cwd: cwd || process.env.WORKSPACE_DIR || process.cwd(),
            timeout: 30_000,
            encoding: 'utf8'
        }, (err, stdout, stderr) => {
            if(err && !stdout) return new reject(new Error(stderr || err.message))
                resolve({stdout, stderr})
        })
    })
}

export async function listProcesses(){
    // const out = execShell('ps aux --no-headers', {encoding: 'utf8'})
    const out = execShell('tasklist', {encoding: 'utf8'})
  return out
    .split('\n')
    .filter(line => line.match(/node|go|python|next|vite|webpack/i))
    .slice(0, 30)
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        pid:     parts[1],
        cpu:     parts[2],
        mem:     parts[3],
        command: parts.slice(10).join(' ').slice(0, 100),
      }
    })
}

export async function getGitStatus({ dir }) {
  const cwd = dir || process.env.WORKSPACE_DIR || process.cwd()
  const branch = execSync('git rev-parse --abbrev-ref HEAD',
    { encoding: 'utf8', cwd }).trim()
  const status = execSync('git status --porcelain',
    { encoding: 'utf8', cwd }).trim()
  const log = execSync('git log --oneline -5',
    { encoding: 'utf8', cwd }).trim()

  return {
    branch,
    dirty:   status.length > 0,
    changes: status.split('\n').filter(Boolean),
    recent:  log.split('\n'),
  }
}

export async function readLog({ filePath, lines = 50 }) {
  if (!filePath) throw new Error('filePath is required')

  const resolved = path.resolve(filePath)
  const allowed  = [
    process.env.WORKSPACE_DIR,
    '/tmp',
    path.join(process.env.HOME || '', 'projects'),
  ].filter(Boolean).map(p => path.resolve(p))

  const safe = allowed.some(dir => resolved.startsWith(dir))
  if (!safe) throw new Error(`path not in allowed directories: ${resolved}`)

  const out = execSync(`tail -n ${parseInt(lines)} "${resolved}"`,
    { encoding: 'utf8' })
  return { filePath: resolved, lines: out.split('\n').filter(Boolean) }
}

export async function killProcess({ pid, signal = 'SIGTERM' }) {
  if (!pid) throw new Error('pid is required')
  const allowed = ['SIGTERM', 'SIGKILL', 'SIGINT']
  if (!allowed.includes(signal)) throw new Error(`signal ${signal} not allowed`)

  process.kill(parseInt(pid), signal)
  return { pid, signal, killed: true }
}