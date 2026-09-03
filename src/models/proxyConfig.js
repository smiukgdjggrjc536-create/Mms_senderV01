// ============================================================================
// ProxyConfig Schema — Module 6: Origin IP Masking & Proxy Routing
// ============================================================================
// Stores Cloudflare Worker URLs and Rotating Proxy IPs that the gateway uses
// to route ALL outbound dispatch requests. This hides the Render/VPS origin
// server IP from telecom A2P filters.
//
// The admin panel can dynamically Add / Edit / Update / Delete / List proxy
// entries via REST API — NO server restart required (active selection is
// cached in Redis and read on every dispatch).
//
// NON-DESTRUCTIVE: brand-new schema. Registered in core.js via the project's
// mongoose.models.X || mongoose.model() pattern.
// ============================================================================

import mongoose from 'mongoose';

const proxyConfigSchema = new mongoose.Schema(
  {
    // Human-readable label for the proxy / worker (e.g. "CF Worker US-East 1")
    label: {
      type: String,
      required: true,
      trim: true,
      default: 'Unnamed Proxy',
    },

    // Type of proxy: 'cloudflare_worker' | 'rotating_proxy' | 'static_proxy'
    type: {
      type: String,
      required: true,
      enum: ['cloudflare_worker', 'rotating_proxy', 'static_proxy'],
      default: 'cloudflare_worker',
      index: true,
    },

    // The full URL the gateway will route through.
    // For Cloudflare Workers: https://my-worker.user.workers.dev/proxy
    // For rotating/static proxies: http://user:pass@proxy-host:port
    url: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional API key / bearer token the worker expects (stored encrypted-at-rest
    // is ideal, but we store as-is for simplicity — the DB is already access-controlled).
    authKey: {
      type: String,
      default: '',
      trim: true,
    },

    // Weighted selection — higher weight = more likely to be chosen (round-robin).
    weight: {
      type: Number,
      default: 1,
      min: 0,
    },

    // Region tag for geo-aware routing (e.g. 'us-east', 'eu-west', 'ap-south')
    region: {
      type: String,
      default: 'default',
      trim: true,
      index: true,
    },

    // Whether this proxy is active / eligible for selection.
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Health tracking — updated by the circuit breaker / health checker.
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'down', 'unknown'],
      default: 'unknown',
    },

    // Consecutive failure count (used by mini circuit-breaker per proxy).
    consecutiveFailures: {
      type: Number,
      default: 0,
    },

    // Last time this proxy was used (for least-recently-used rotation).
    lastUsedAt: {
      type: Date,
      default: null,
    },

    // Latency in ms (updated after each proxied request).
    avgLatencyMs: {
      type: Number,
      default: 0,
    },

    // Total requests routed through this proxy (lifetime).
    totalRequests: {
      type: Number,
      default: 0,
    },

    // Arbitrary config blob — admin can store any worker-specific settings
    // (e.g. { "stripHeaders": true, "timeoutMs": 10000, "customHeaders": {...} }).
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Created / updated audit
    createdBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index for fast active-proxy queries
proxyConfigSchema.index({ enabled: 1, status: 1, type: 1 });

export { proxyConfigSchema };
export default proxyConfigSchema;
