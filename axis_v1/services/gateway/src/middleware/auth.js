import { getConfig } from "../../../../packages/config/src/index.js";
import { createLogger } from "../../../../packages/logger/src/index.js";
import jwt from "jsonwebtoken";

const log = createLogger('gateway:auth')
const config = getConfig()

export function requireAuth(req, res, next) {
    const header = req.headers['authorization']

    if (!header || !header.startsWith('Bearer')) {
        log.warn({ url: req.url }, 'missing auth token')
        return res.status(401).json({
            ok: false,
            error: { code: 'UNAUTHORIZED', message: 'missing bearer token' }
        })
    }

    const token = header.slice(7)

    try {
        const payload = jwt.verify(token, config.gateway.jwtSecret)
        req.user = payload
        next()
    } catch (err) {
        log.warn({ err: err.message, url: req.url }, 'invalid token')
        return res.status(401).json({
            ok: false,
            error: { code: 'INVALID_TOKEN', message: err.message }
        })
    }
}

export function generateToken(){
    const token = jwt.sign(
        {sub: 'ab', role:'owner'},
        config.gateway.jwtSecret,
        { expiresIn: '365d' }
    )

    console.log('\nYour Axis token:\n')
    console.log(token)
    console.log('\nStore this in your app.\n')
    return token
}