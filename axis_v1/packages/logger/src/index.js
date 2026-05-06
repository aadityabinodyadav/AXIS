import pino from "pino";

export function createLogger(service){
    const isDev = process.env.NODE_ENV !== "production"

    return pino({
        level: process.env.LOG_LEVEL || 'info',
        base: {service},
        timestamp: pino.stdTimeFunctions.isoTime,
        ...(isDev && {
            transport:{
                target: 'pino-pretty',
                options: {colorize: true}
            }
        })
    })
}