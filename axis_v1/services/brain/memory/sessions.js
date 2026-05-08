import { createLogger } from "../../../packages/logger/src/index.js";
import { getDb } from "./db.js";

const log = createLogger('brain:sessions')

const INACTIVITY_MS = 10 * 60 * 1000

const active = new Map()

export function getOrCreate(sessionId){

    const session   = {
        id: sessionId,
        messages: [],
        startedAt: new Date().toISOString(),
        _timer: null
    }

    if(active.has(sessionId)){
        const s = active.get(sessionId)
        _resetTimer(s)
        return s
    }

    _resetTimer(session)
    active.set(sessionId, session)
    log.info({sessionId}, 'session started')
    return session
}

export function addMessage(sessionId, role, content){
    const session = getOrCreate(sessionId)
    session.messages.push({role, content, ts: new Date().toISOString()})
    _resetTimer(session)
}

function getMessages(sessionId){
    const session = active.get(sessionId)
    return session ? session.messages: []
}

export function getApiMessages(sessionId){
    const messages = getMessages(sessionId)
    return messages.slice(-20).map(m => ({role: m.role, content: m.content}))
}

function _resetTimer(session){
    if(session._timer) clearTimeout(session._timer)
        session._timer = setTimeout(
            ()=> _closeSession(session.id),
            INACTIVITY_MS
        )
}

async function _closeSession(sessionId){
    const session = active.get(sessionId)
    if(!session) return

    log.info({sessionId}, 'session closing - summarizing')

    if(session._timer){
        clearTimeout(session._timer)
        session._timer = null
    }

    active.delete(sessionId)

    const db = getDb()
    db.prepare(`
        INSERT INTO sessions (id, messages, started_at, closed_at)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          messages = excluded.messages,
          started_at = excluded.started_at,
          closed_at = excluded.closed_at
        `).run(
            session.id,
            JSON.stringify(session.messages),
            session.startedAt,
            new Date().toISOString()
        )
    process.emit('session:closed', session)
}