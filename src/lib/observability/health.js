// ============================================================================
// V7 P7.1 — Observability: Health check aggregator
// ----------------------------------------------------------------------------
// Aggregates live status from all critical subsystems:
//   - MongoDB (DB reachable)
//   - Redis (cache/queue/pool reachable)
//   - Queue depth (BullMQ job counts)
//   - AI pool levels (sender + subject via engine.getStats)
//   - Restock last-run (via restockWorker.getRestockStatus)
//   - Circuit breaker states (via circuitBreaker.getAllCircuitStates)
//
// Every subsystem call is wrapped in try/catch so the health endpoint degrades
// gracefully — a failing subsystem reports { reachable: false, error } rather
// than crashing the whole response.
//
// Non-destructive: brand-new module. Does not modify existing code.
// ============================================================================
import mongoose from 'mongoose';
import { isRedisLive, getRedis } from '@/lib/redis';
import { connectDB } from '@/lib/core';
import { getStats as getAiPoolStats } from '../../services/ai/engine.js';
import { getRestockStatus } from '../../services/ai/restockWorker.js';
import { getAllCircuitStates, getCircuitState, getFailureCount } from '../../services/circuitBreaker.js';

// ---------------------------------------------------------------------------
// withTimeout(promise, ms, label) — race a promise against a timeout
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// checkDb() — is MongoDB reachable?
// ---------------------------------------------------------------------------
export async function checkDb() {
  try {
    await withTimeout(connectDB(), 3000, 'connectDB');
    const state = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const reachable = state === 1;
    return {
      reachable,
      readyState: state,
      readyStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown',
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
    };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// checkRedis() — is Redis reachable + ping round-trip?
// ---------------------------------------------------------------------------
export async function checkRedis() {
  try {
    const live = isRedisLive();
    if (!live) {
      return {
        reachable: true,  // in-memory fallback is "reachable" (process-local)
        mode: 'memory-fallback',
        pingMs: 0,
      };
    }
    const redis = getRedis();
    const t0 = Date.now();
    const pong = await redis.ping();
    const pingMs = Date.now() - t0;
    return {
      reachable: pong === 'PONG',
      mode: 'redis',
      pingMs,
    };
  } catch (err) {
    return { reachable: false, mode: 'redis', error: err.message };
  }
}

// ---------------------------------------------------------------------------
// checkQueue() — queue depth (waiting/active/failed/delayed/completed)
// ---------------------------------------------------------------------------
export async function checkQueue() {
  try {
    // Dynamic import to avoid pulling BullMQ at module load time in tests
    const { getQueueStatus } = await import('../../services/queueEngine.js');
    const status = await withTimeout(getQueueStatus(), 3000, 'getQueueStatus');
    if (status && status.error) {
      return { reachable: false, error: status.error };
    }
    return { reachable: true, ...status };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// checkAiPools() — sender + subject pool levels
// ---------------------------------------------------------------------------
export async function checkAiPools() {
  try {
    const stats = await getAiPoolStats();
    return { reachable: true, ...stats };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// checkRestock() — restock worker last-run info
// ---------------------------------------------------------------------------
export async function checkRestock() {
  try {
    const status = getRestockStatus();
    return { reachable: true, ...status };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// checkCircuitBreakers() — all gateway account circuit states
// ---------------------------------------------------------------------------
export async function checkCircuitBreakers() {
  try {
    const states = await withTimeout(getAllCircuitStates(), 3000, 'getAllCircuitStates');
    if (states && states.error) {
      return { reachable: false, error: states.error };
    }
    const arr = Array.isArray(states) ? states : [];
    const summary = {
      total: arr.length,
      closed: arr.filter((s) => s.circuitState === 'CLOSED').length,
      open: arr.filter((s) => s.circuitState === 'OPEN').length,
      halfOpen: arr.filter((s) => s.circuitState === 'HALF_OPEN').length,
    };
    return { reachable: true, summary, accounts: arr };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// getHealth() — full health snapshot
//   Returns { status, timestamp, uptime, db, redis, queue, aiPools, restock,
//             circuitBreakers }
//   status: 'healthy' | 'degraded' | 'unhealthy'
// ---------------------------------------------------------------------------
export async function getHealth() {
  const timestamp = new Date().toISOString();
  const uptimeMs = process.uptime() * 1000;

  const [db, redis, queue, aiPools, restock, circuitBreakers] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkQueue(),
    checkAiPools(),
    checkRestock(),
    checkCircuitBreakers(),
  ]);

  // Determine overall status
  const dbOk = db.reachable;
  const redisOk = redis.reachable;
  const criticalOk = dbOk && redisOk;

  let status;
  if (criticalOk) {
    // Degraded if any non-critical subsystem is down
    const subsystemsDown = [
      queue.reachable,
      aiPools.reachable,
      restock.reachable,
      circuitBreakers.reachable,
    ].filter((r) => r === false).length;
    status = subsystemsDown > 0 ? 'degraded' : 'healthy';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    timestamp,
    uptimeMs,
    uptimeHuman: formatUptime(uptimeMs),
    db,
    redis,
    queue,
    aiPools,
    restock,
    circuitBreakers,
  };
}

// ---------------------------------------------------------------------------
// formatUptime(ms) → "2d 3h 15m 10s"
// ---------------------------------------------------------------------------
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

export default {
  getHealth,
  checkDb,
  checkRedis,
  checkQueue,
  checkAiPools,
  checkRestock,
  checkCircuitBreakers,
};
