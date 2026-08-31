// ============================================================================
// AiPool Schema — Background AI Engine (v4.0 MASTER RELEASE)
// ============================================================================
// Stores pre-generated randomized sender names + subject lines in a persistent
// pool so the sending engine never starves. The Background AI Engine worker
// continuously generates and restocks this pool asynchronously.
//
// Two pool types:
//   - 'sender_name'   — randomized From names (e.g. "Sarah Mitchell", "James Carter")
//   - 'subject_line'  — randomized email subject lines
//
// Each item has a `used` flag so the engine can track consumption and trigger
// auto-restock when the available (unused) count drops below the minimum
// threshold defined in FeatureToggle.packageConfig.aiPoolMinSize.
//
// The pool is shared globally (not per-user) — all users draw from the same
// pool, which keeps the generation cost low and the variety high.
// ============================================================================

import mongoose from 'mongoose';

const aiPoolItemSchema = new mongoose.Schema({
  // The pool type: sender_name or subject_line
  poolType: {
    type: String,
    enum: ['sender_name', 'subject_line'],
    required: true,
    index: true,
  },

  // The generated content (the actual name or subject line)
  content: {
    type: String,
    required: true,
    trim: true,
  },

  // Whether this item has been consumed by a send
  used: {
    type: Boolean,
    default: false,
    index: true,
  },

  // When this item was consumed (for analytics)
  usedAt: {
    type: Date,
    default: null,
  },

  // Which user consumed it (optional, for analytics)
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Batch ID — items generated in the same restock run share a batch ID
  batchId: {
    type: String,
    default: '',
    index: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for fast "get next available" queries
aiPoolItemSchema.index({ poolType: 1, used: 1, createdAt: 1 });

// ── Static helpers for pool management ──

// Get pool statistics (available vs used counts per type)
aiPoolItemSchema.statics.getStats = async function() {
  const [nameAvailable, nameUsed, subjectAvailable, subjectUsed] = await Promise.all([
    this.countDocuments({ poolType: 'sender_name', used: false }),
    this.countDocuments({ poolType: 'sender_name', used: true }),
    this.countDocuments({ poolType: 'subject_line', used: false }),
    this.countDocuments({ poolType: 'subject_line', used: true }),
  ]);
  return {
    senderName: { available: nameAvailable, used: nameUsed, total: nameAvailable + nameUsed },
    subjectLine: { available: subjectAvailable, used: subjectUsed, total: subjectAvailable + subjectUsed },
  };
};

// Fetch N available items from a pool (marks them as used atomically)
aiPoolItemSchema.statics.consume = async function(poolType, count, userId = null) {
  const items = await this.find({ poolType, used: false })
    .sort({ createdAt: 1 })
    .limit(count)
    .lean();
  if (items.length > 0) {
    const ids = items.map(i => i._id);
    await this.updateMany(
      { _id: { $in: ids } },
      { $set: { used: true, usedAt: new Date(), usedBy: userId } }
    );
  }
  return items.map(i => i.content);
};

// Add items to a pool (used by the Background AI Engine restock worker)
aiPoolItemSchema.statics.addItems = async function(poolType, contents, batchId = '') {
  const docs = contents.map(content => ({
    poolType,
    content: content.trim(),
    used: false,
    batchId,
  }));
  if (docs.length === 0) return { inserted: 0 };
  const result = await this.insertMany(docs, { ordered: false });
  return { inserted: result.length };
};

const AiPool =
  mongoose.models.AiPool ||
  mongoose.model('AiPool', aiPoolItemSchema);

export default AiPool;
export { aiPoolItemSchema };
