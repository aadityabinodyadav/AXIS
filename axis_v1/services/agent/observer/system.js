import os from "os";
import { execSync } from "child_process";

export function getSnapShot(){
  return {
    timestamp:  new Date().toISOString(),
    hostname:   os.hostname(),
    platform:   os.platform(),
    uptime:     os.uptime(),
    memory: {
      total:    os.totalmem(),
      free:     os.freemem(),
      usedPct:  Math.round((1 - os.freemem() / os.totalmem()) * 100),
    },
    load:       os.loadavg(),
    processes:  getProcessList(),
    git:        getGitState(),
  }
}

 function getProcessList(){
    try { 
    // const out = execSync('ps aux --no-headers', { encoding: 'utf8' })
    const out = execSync('tasklist', { encoding: 'utf8' })
    return out
      .split('\n')
      .filter(line => line.match(/node|go|python|next|vite|webpack/i))
      .slice(0, 20)                    // cap at 20 — enough signal
      .map(line => {
        const parts = line.trim().split(/\s+/)
        return {
          pid:     parts[1],
          cpu:     parts[2],
          mem:     parts[3],
          command: parts.slice(10).join(' ').slice(0, 80),
        }
      })
  } catch {
    return []
  }
}

function getGitState() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      cwd: process.env.WORKSPACE_DIR || process.cwd(),
    }).trim()

    const status = execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: process.env.WORKSPACE_DIR || process.cwd(),
    }).trim()

    return {
      branch,
      dirty:   status.length > 0,
      changes: status.split('\n').filter(Boolean).length,
    }
  } catch {
    return null  
  }
}