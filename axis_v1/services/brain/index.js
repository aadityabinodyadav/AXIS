import { getConfig } from "../../packages/config/src/index.js";
import { createLogger } from "../../packages/logger/src/index.js";
import express from "express";
import { build } from "./context/builder.js";
import { chat } from "./ai/deepseek.js";
import { summarizeSession } from "./ai/summarizer.js";
import * as core from "./memory/core.js";
import { addMessage, getApiMessages } from "./memory/sessions.js";

const log = createLogger('brain')
const config = getConfig()
const PORT = parseInt(process.env.BRAIN_PORT || '3002')
const app = express()
app.use(express.json())

core.seedIfEmpty()

process.on('session:closed', (session)=>{
    summarizeSession(session).catch((err)=> {
        log.error(
            {err: err.message},
            'summarizer error'
        )
    })
})

app.post('/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'MISSING_MESSAGE',
        message: 'message is required',
      }
    })
  }

  try {

    addMessage(sessionId, 'user', message)

    const context = await build()

    const apiMessages = getApiMessages(sessionId)

    const reply = await chat(apiMessages, context)

    addMessage(sessionId, 'assistant', reply)

    return res.json({
      ok: true,
      data: {
        reply,
        sessionId,
      }
    })

  } catch (err) {

    log.error(
      { err: err.message },
      'chat error'
    )

    return res.status(500).json({
      ok: false,
      error: {
        code: 'AI_ERROR',
        message: err.message,
      }
    })
  }
})

app.get('/memory/core', (req, res) => {
  res.json({
    ok: true,
    data: core.getAll(),
  })
})

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    data: {
      service: 'brain',
    }
  })
})

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'route not found',
    }
  })
})

const server = app.listen(PORT, ()=>{
    log.info(
        {port: PORT},
        'brain listening'
    )
})

process.on('SIGINT', ()=>{
    log.info('shutting down brain')
    server.close(()=>{
        process.exit(0)
    })
})