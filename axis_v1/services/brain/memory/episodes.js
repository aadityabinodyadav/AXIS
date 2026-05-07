import { createLogger } from "../../../packages/logger/src/index.js";
import { getDb } from "./db.js";

const log = createLogger('brain:episodes')

export function add(summary, tags=[]){
    const db = getDb()
    const id = crypto.randomUUID()

    db.prepare(`
        INSERT INTO episodes (id, summary, tags, created_at)
        VALUES (?, ?, ?, ?)
        `).run(id, summary, tags.join(','), new Date().toISOString())
        log.debug({id, tags}, 'episode stored')
        return id
}

export function getRecent(limit = 8){
    const db = getDb()
    return db.prepare(`
        SELECT summary, tags, created_at
        FROM episodes
        ORDER BY created_at DESC
        LIMIT ?
        `).limit(8)
}
