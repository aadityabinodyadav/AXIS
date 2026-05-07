import { createLogger } from "../../../packages/logger/src/index.js";
import { getDb } from "./db.js";

const log = createLogger('brain:core')

const INITIAL_FACTS = {
  'user.name':          'AB',
  'user.location':      'Kathmandu, Nepal',
  'user.role':          'Computer Engineering student + founder',
  'user.stack':         'Node.js, TypeScript, Go, React Native, C++',
  'user.experience':    '1.5 years professional + active builder',
  'user.projects':      'Flint Secure (fraud detection), Legal Advice Nepal, Axis (this system)',
  'user.goal.immediate':'Build and ship Axis',
  'user.goal.career':   'Land remote EU fintech role, Blue Card, relocate',
  'user.targets':       'Checkout.com, Primer.io, Wise, Revolut',
  'user.interests':     'Distributed systems, HFT, embedded systems, fraud detection',
  'user.preference.tone': 'Direct, no fluff, technical depth appreciated',
  'user.community':     'TEDx NCIT Lead, GDG Kathmandu, Nepal Tek Community',
  'axis.stack':         'Node.js monorepo, WebSocket, SQLite, DeepSeek API',
}

export function seedIfEmpty(){
    const db = getDb();

    const count = db.prepare('SELECT COUNT(*) as n FROM core_memory').get()

    if(count.n === 0){
        log.info('seeding initial core memory')
        const insert = db.prepare(`
            INSERT INTO core_memory (key, value, updated_at)
            VALUES(?, ?, ?)
            `)

        const now = new Date().toISOString()

        for (const [key, value] of Object.entries(INITIAL_FACTS)){
            insert.run(key, value, now)
        }
    }
}

export function getAll(){
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM core_memory').all()
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export function set(key, value){
    const db = getDb()
    db.prepare(`
        INSERT INTO core_memory (key, value, updated_at)
        VALUES(?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, String(value), new Date().toISOString())
    log.debug({ key, value }, 'core memory updated')
}

export function setMany(facts){
    for (const [key, value] of Object.entries(facts)) set(key, value)
}