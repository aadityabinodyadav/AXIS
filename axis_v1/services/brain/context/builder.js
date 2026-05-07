import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import * as core from "../memory/core.js";
import * as episodes from "../memory/episodes.js";

const log = createLogger('brain: context')
const config = getConfig()

export async function build(){
    const [coreMemory, recentEpisodes, systemState] = await Promise.all([
        Promise.resolve(core.getAll()),
        Promise.resolve(episodes.getRecent(8)),
        fetchSystemState()
    ])

    return { coreMemory, episodes: recentEpisodes, systemState}
}

async function fetchSystemState(){
    try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const r = await fetch(
      `http://localhost:${config.coordinator.port}/state`,
      { signal: controller.signal }
    )
    clearTimeout(timeout);
    return await r.json()
  } catch (err) {
    log.warn('could not fetch system state for context')
    return null
  }
}