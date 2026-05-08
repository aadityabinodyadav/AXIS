import pino from "pino";

const isDev = process.env.NODE_ENV !== "production"

const rootLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {},
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(isDev && {
        transport:{
            target: 'pino-pretty',
            options: {colorize: true}
        }
    })
})

export function createLogger(service){
    return rootLogger.child({ service })
}