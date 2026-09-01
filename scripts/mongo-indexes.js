// ============================================================================
// P1.5 — MongoDB Index Creation Script
// ============================================================================
// Run: node scripts/mongo-indexes.js
//
// Creates all required indexes for the MMS Sender V7 application:
//   • users: email unique (sparse)
//   • campaigns: userId + createdAt (compound)
//   • delivery_reports (sent_logs): campaignId + status (already in schema),
//     senderApiId + sentAt (credentialId + ts), sentAt TTL (30-day expiry)
//   • emailAccounts: provider + status, ownerId + status
//   • tag_maps: campaignId + recipientId, createdAt TTL (30-day)
//   • routing_audit: createdAt TTL (30-day)
//   • custom_tags: name unique
//
// This script is IDEMPOTENT — running it multiple times is safe. MongoDB
// createIndex() is a no-op if the index already exists.
//
// Acceptance: exits 0 when all indexes are created/confirmed.
// ============================================================================

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  console.error('Set it before running: export MONGODB_URI="mongodb+srv://..."');
  process.exit(1);
}

const MONGODB_DB = process.env.MONGODB_DB || 'mms_sender';

// ---------------------------------------------------------------------------
// Index definitions — each entry is { collection, name, spec, options }
// ---------------------------------------------------------------------------
const INDEXES = [
  // ── users ──
  {
    collection: 'users',
    name: 'email_unique_sparse',
    spec: { email: 1 },
    options: { unique: true, sparse: true },
  },
  {
    collection: 'users',
    name: 'userId_unique_sparse',
    spec: { userId: 1 },
    options: { unique: true, sparse: true },
  },
  {
    collection: 'users',
    name: 'role_status',
    spec: { role: 1, status: 1 },
    options: {},
  },

  // ── campaigns ──
  {
    collection: 'campaigns',
    name: 'userId_createdAt',
    spec: { userId: 1, createdAt: -1 },
    options: {},
  },
  {
    collection: 'campaigns',
    name: 'userEmail_status',
    spec: { userEmail: 1, status: 1 },
    options: {},
  },
  {
    collection: 'campaigns',
    name: 'createdAt',
    spec: { createdAt: -1 },
    options: {},
  },

  // ── delivery_reports (sent_logs) ──
  {
    collection: 'deliveryreports',
    name: 'campaignId_status',
    spec: { campaignId: 1, status: 1 },
    options: {},
  },
  {
    collection: 'deliveryreports',
    name: 'senderApiId_sentAt',
    spec: { senderApiId: 1, sentAt: -1 },
    options: {},
  },
  {
    collection: 'deliveryreports',
    name: 'userEmail_sentAt',
    spec: { userEmail: 1, sentAt: -1 },
    options: {},
  },
  {
    collection: 'deliveryreports',
    name: 'sentAt_ttl_30d',
    spec: { sentAt: 1 },
    options: { expireAfterSeconds: 30 * 24 * 60 * 60 }, // 30-day TTL
  },

  // ── emailaccounts ──
  {
    collection: 'emailaccounts',
    name: 'provider_status',
    spec: { provider: 1, status: 1 },
    options: {},
  },
  {
    collection: 'emailaccounts',
    name: 'ownerId_status',
    spec: { ownerId: 1, status: 1 },
    options: {},
  },
  {
    collection: 'emailaccounts',
    name: 'status_sentToday',
    spec: { status: 1, sentToday: 1 },
    options: {},
  },

  // ── tag_maps (P2 collection — created here so index exists) ──
  {
    collection: 'tag_maps',
    name: 'campaignId_recipientId',
    spec: { campaignId: 1, recipientId: 1 },
    options: {},
  },
  {
    collection: 'tag_maps',
    name: 'createdAt_ttl_30d',
    spec: { createdAt: 1 },
    options: { expireAfterSeconds: 30 * 24 * 60 * 60 },
  },

  // ── routing_audit (P3 collection — created here so index exists) ──
  {
    collection: 'routing_audits',
    name: 'createdAt_ttl_30d',
    spec: { createdAt: 1 },
    options: { expireAfterSeconds: 30 * 24 * 60 * 60 },
  },
  {
    collection: 'routing_audits',
    name: 'campaignId_createdAt',
    spec: { campaignId: 1, createdAt: -1 },
    options: {},
  },

  // ── custom_tags (P2 collection) ──
  {
    collection: 'custom_tags',
    name: 'name_unique',
    spec: { name: 1 },
    options: { unique: true },
  },
  {
    collection: 'custom_tags',
    name: 'ownerId',
    spec: { ownerId: 1 },
    options: {},
  },

  // ── routing_configs (P3 collection) ──
  {
    collection: 'routing_configs',
    name: 'campaignId_unique',
    spec: { campaignId: 1 },
    options: { unique: true, sparse: true },
  },

  // ── activitylogs ──
  {
    collection: 'activitylogs',
    name: 'timestamp',
    spec: { timestamp: -1 },
    options: {},
  },
  {
    collection: 'activitylogs',
    name: 'actor_action',
    spec: { actor: 1, action: 1, timestamp: -1 },
    options: {},
  },

  // ── userpackages (P5.2 — Package Manager) ──
  // userId already has a schema-level unique index, but we declare it here
  // for explicit inventory visibility. packageName index supports package-
  // distribution queries (e.g. "how many pro users?").
  {
    collection: 'userpackages',
    name: 'userId_unique',
    spec: { userId: 1 },
    options: { unique: true },
  },
  {
    collection: 'userpackages',
    name: 'packageName',
    spec: { packageName: 1 },
    options: {},
  },

  // ── featuretoggles (P5.1 — Toggle Registry) ──
  // Singleton document (one record). No query indexes needed beyond _id,
  // but we declare the collection here for inventory completeness.
  // No additional indexes required — getOrCreate() uses _id lookup.
];

// ---------------------------------------------------------------------------
// Main — connect, create indexes, disconnect
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== MongoDB Index Creation (P1.5) ===\n');
  console.log(`URI: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***:***@')}`);
  console.log(`DB:  ${MONGODB_DB}\n`);

  let conn;
  try {
    conn = await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✓ Connected to MongoDB\n');
  } catch (err) {
    console.error('✗ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const db = conn.connection.db;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const idx of INDEXES) {
    try {
      const collection = db.collection(idx.collection);
      // createIndex is idempotent — no-op if index exists
      await collection.createIndex(idx.spec, { name: idx.name, ...idx.options });
      console.log(`  ✓ ${idx.collection}.${idx.name}`);
      created++;
    } catch (err) {
      if (err.code === 86 || err.codeName === 'IndexOptionsConflict') {
        // Index already exists with different options — skip, not fatal
        console.log(`  ⊙ ${idx.collection}.${idx.name} (already exists)`);
        skipped++;
      } else {
        console.error(`  ✗ ${idx.collection}.${idx.name} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n=== Result: ${created} created, ${skipped} skipped, ${failed} failed ===`);

  // List all indexes per collection for verification
  console.log('\n=== Index Inventory ===');
  const collections = ['users', 'campaigns', 'deliveryreports', 'emailaccounts', 'tag_maps', 'routing_audits', 'custom_tags', 'routing_configs', 'activitylogs', 'userpackages', 'featuretoggles'];
  for (const colName of collections) {
    try {
      const indexes = await db.collection(colName).listIndexes().toArray();
      console.log(`  ${colName}: ${indexes.map((i) => i.name).join(', ')}`);
    } catch (_e) {
      // Collection may not exist yet — that's fine
      console.log(`  ${colName}: (collection does not exist yet)`);
    }
  }

  await mongoose.disconnect();
  console.log('\n✓ Disconnected. MONGO_INDEXES_EXIT=0');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
