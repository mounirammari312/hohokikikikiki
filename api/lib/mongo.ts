// @ts-nocheck — serverless functions are type-checked by Vercel at deploy time, not by the client tsc build
/**
 * Shared MongoDB connection helper for Vercel Serverless Functions.
 *
 * In serverless environments, each function invocation may run in a fresh
 * process — so we cache the connection on `globalThis` to avoid opening
 * a new connection on every single request (which would quickly exhaust
 * MongoDB Atlas's free-tier connection limit).
 *
 * Usage:
 *   import { connectDB } from '../lib/mongo'
 *   await connectDB()
 *
 * Environment variables (set in Vercel → Project → Settings → Environment Variables):
 *   - MONGODB_URI: full mongodb+srv:// connection string from MongoDB Atlas
 *
 * If MONGODB_URI is not set, the helper throws a clear error so the
 * developer knows they forgot to configure the env var (instead of a
 * cryptic MongooseError down the line).
 */

import mongoose from 'mongoose'

declare global {
  // eslint-disable-next-line no-var
  var __mongoConn: mongoose.Connection | null
}

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  // We don't throw at module load time — that would crash the entire
  // serverless function before we could return a helpful JSON response.
  // Instead, we expose a getter and let connectDB() throw a structured error.
  console.warn('[mongo] MONGODB_URI is not set. API routes will return 500.')
}

let cached: mongoose.Connection | null =
  globalThis.__mongoConn ?? null

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI_NOT_CONFIGURED')
  }

  // Reuse cached connection if available and still connected
  if (cached && mongoose.connection.readyState === 1) {
    return mongoose
  }

  // If there's a stale cached connection that disconnected, drop it
  if (cached && mongoose.connection.readyState === 0) {
    cached = null
    globalThis.__mongoConn = null
  }

  mongoose.set('strictQuery', true)

  // Connection options — Atlas-friendly defaults that reduce connection
  // churn in serverless environments.
  const opts = {
    bufferCommands: false,
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 12000,
    connectTimeoutMS: 8000,
  }

  // One-shot retry: serverless cold starts occasionally fail the first
  // connect attempt with a transient ETIMEDOUT / ECONNRESET from the
  // Atlas load balancer. Waiting 500ms and retrying once recovers most
  // of those without adding noticeable latency to the happy path.
  try {
    await mongoose.connect(MONGODB_URI, opts)
  } catch (err) {
    console.warn('[mongo] first connect failed, retrying in 500ms:', err instanceof Error ? err.message : err)
    await new Promise(r => setTimeout(r, 500))
    await mongoose.connect(MONGODB_URI, opts)
  }

  cached = mongoose.connection
  globalThis.__mongoConn = cached
  return mongoose
}

/** Helper for API routes: returns a JSON response with proper headers. */
export function json(body: unknown, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

/** Helper for API routes: catches errors and returns a structured 500. */
export function handleError(err: unknown) {
  console.error('[api error]', err)
  const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR'
  if (msg === 'MONGODB_URI_NOT_CONFIGURED') {
    return json(
      {
        error: 'MONGODB_URI_NOT_CONFIGURED',
        message:
          'MONGODB_URI environment variable is missing. Add it in Vercel → Settings → Environment Variables.',
      },
      500
    )
  }
  return json({ error: msg }, 500)
}
