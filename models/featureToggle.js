// ============================================================================
// FeatureToggle Schema — God-Mode Matrix (v4.0 MASTER RELEASE)
// ============================================================================
// Universal feature toggle system for the Admin Control Hub.
// Allows the admin to show/hide/enable/disable ANY field, section, or feature
// in the User Panel from a single central control matrix.
//
// This is a singleton document (one record) that holds the entire toggle map.
// The User Panel fetches this on load and conditionally renders fields based
// on the toggle state. The Admin Panel's "God-Mode Matrix" tab provides the UI
// to flip any toggle in real-time without a redeploy.
//
// Toggle shape per feature:
//   {
//     key:        'tfnNumber',           // unique identifier
//     label:      'TFN Number Input',    // human-readable label
//     category:   'dedicated_inputs',    // grouping for the matrix UI
//     visible:    true,                  // show/hide in user panel
//     enabled:    true,                  // enable/disable functionality
//     locked:     false,                 // if true, user cannot change this value
//   }
//
// Categories:
//   - dedicated_inputs   (TFN, Help Desk, Invoice Format, etc.)
//   - content_editor     (HTML editor, tag pills, content mode)
//   - sending_options    (batch size, delay, rotation, anti-detect)
//   - validation         (Cognitive Trust Validator)
//   - ai_engine          (Background AI pools, name generation)
//   - threshold          (Google API smart threshold, resume loop)
//   - sender_management  (Gmail connect, sender rotation)
// ============================================================================

import mongoose from 'mongoose';

const featureToggleItemSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true,
  },
  label: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: 'general',
    index: true,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  locked: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const featureToggleSchema = new mongoose.Schema({
  // Singleton identifier — always 'god_mode_matrix'
  singletonId: {
    type: String,
    default: 'god_mode_matrix',
    unique: true,
    index: true,
  },

  // The full toggle map (array of feature toggle items)
  toggles: {
    type: [featureToggleItemSchema],
    default: [],
  },

  // ── Package & Resource Manager (global limits) ──
  packageConfig: {
    // Maximum campaigns a user can create (default 4)
    maxCampaigns: {
      type: Number,
      default: 4,
    },
    // Maximum recipients per campaign send
    maxRecipientsPerSend: {
      type: Number,
      default: 10000,
    },
    // Maximum batch size allowed
    maxBatchSize: {
      type: Number,
      default: 50,
    },
    // Minimum delay between sends (ms)
    minDelayMs: {
      type: Number,
      default: 500,
    },
    // Google API per-credential daily threshold (auto-pause limit)
    googleApiThreshold: {
      type: Number,
      default: 500,
    },
    // AI generation quota per day (Gemini calls for name/subject generation)
    aiQuotaPerDay: {
      type: Number,
      default: 10000,
    },
    // Background AI pool minimum size (auto-restock trigger)
    aiPoolMinSize: {
      type: Number,
      default: 5000,
    },
    // Background AI pool target size (restock up to this)
    aiPoolTargetSize: {
      type: Number,
      default: 50000,
    },
    // Auto-restock enabled
    autoRestockEnabled: {
      type: Boolean,
      default: true,
    },
    // Global sending speed cap (emails per minute across all users)
    globalSpeedCapPerMin: {
      type: Number,
      default: 0, // 0 = unlimited
    },
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Default toggles — seeded on first access
const DEFAULT_TOGGLES = [
  // Dedicated inputs
  { key: 'tfnNumber', label: 'TFN Number Input', category: 'dedicated_inputs', visible: true, enabled: true, locked: false },
  { key: 'helpDeskLink', label: 'Help Desk Link Input', category: 'dedicated_inputs', visible: true, enabled: true, locked: false },
  { key: 'invoiceFormat', label: 'Custom Invoice Format Input', category: 'dedicated_inputs', visible: true, enabled: true, locked: false },
  { key: 'transactionFormat', label: 'Custom Transaction Format Input', category: 'dedicated_inputs', visible: true, enabled: true, locked: false },
  { key: 'boilingSummary', label: 'Boiling Summary Input', category: 'dedicated_inputs', visible: true, enabled: true, locked: false },

  // Content editor
  { key: 'htmlEditor', label: 'Raw HTML Editor', category: 'content_editor', visible: true, enabled: true, locked: false },
  { key: 'tagPills', label: 'Interactive Tag Pills', category: 'content_editor', visible: true, enabled: true, locked: false },
  { key: 'contentMode', label: 'Content Mode Selector', category: 'content_editor', visible: true, enabled: true, locked: false },
  { key: 'bodyTemplates', label: 'Body Template Manager', category: 'content_editor', visible: true, enabled: true, locked: false },
  { key: 'subjectCategories', label: 'Subject Category Manager', category: 'content_editor', visible: true, enabled: true, locked: false },

  // Sending options
  { key: 'batchSize', label: 'Batch Size Control', category: 'sending_options', visible: true, enabled: true, locked: false },
  { key: 'delayControl', label: 'Send Delay Control', category: 'sending_options', visible: true, enabled: true, locked: false },
  { key: 'senderRotation', label: 'Sender Mail Rotation', category: 'sending_options', visible: true, enabled: true, locked: false },
  { key: 'fromNameRotation', label: 'From Name Rotation', category: 'sending_options', visible: true, enabled: true, locked: false },
  { key: 'antiDetect', label: 'Anti-Detection Mode', category: 'sending_options', visible: true, enabled: true, locked: false },
  { key: 'trackPixel', label: 'Tracking Pixel', category: 'sending_options', visible: true, enabled: true, locked: false },
  { key: 'humanizeMode', label: 'Humanize Mode', category: 'sending_options', visible: true, enabled: true, locked: false },

  // Validation
  { key: 'cognitiveTrustValidator', label: '5-Second Cognitive Trust Validator', category: 'validation', visible: true, enabled: true, locked: false },
  { key: 'bounceCheck', label: 'Bounce Risk Filter', category: 'validation', visible: true, enabled: true, locked: false },

  // AI engine
  { key: 'backgroundAiEngine', label: 'Background AI Engine', category: 'ai_engine', visible: true, enabled: true, locked: false },
  { key: 'aiNameGeneration', label: 'AI Name Pool Generation', category: 'ai_engine', visible: true, enabled: true, locked: false },
  { key: 'aiSubjectGeneration', label: 'AI Subject Pool Generation', category: 'ai_engine', visible: true, enabled: true, locked: false },
  { key: 'autoRestock', label: 'Auto-Restock Pools', category: 'ai_engine', visible: true, enabled: true, locked: false },

  // Threshold
  { key: 'googleApiThreshold', label: 'Google API Smart Threshold', category: 'threshold', visible: true, enabled: true, locked: false },
  { key: 'autoPauseAtLimit', label: 'Auto-Pause at Limit', category: 'threshold', visible: true, enabled: true, locked: false },
  { key: 'resumeLoop', label: 'Seamless Resume Loop', category: 'threshold', visible: true, enabled: true, locked: false },
  { key: 'credentialAlertModal', label: 'Enterprise Alert Modal for New Credentials', category: 'threshold', visible: true, enabled: true, locked: false },

  // Sender management
  { key: 'gmailConnect', label: 'Gmail Credentials.json Connect', category: 'sender_management', visible: true, enabled: true, locked: false },
  { key: 'senderList', label: 'Sender Account List', category: 'sender_management', visible: true, enabled: true, locked: false },
  { key: 'senderAutoFill', label: 'Sender Mail Auto-Fill', category: 'sender_management', visible: true, enabled: true, locked: false },

  // Campaign sandboxes
  { key: 'campaignSandboxes', label: '4 Campaign Sandboxes', category: 'sending_options', visible: true, enabled: true, locked: false },
];

// Helper: get or create the singleton toggle document with defaults seeded
featureToggleSchema.statics.getOrCreate = async function() {
  let doc = await this.findOne({ singletonId: 'god_mode_matrix' });
  if (!doc) {
    doc = new this({ singletonId: 'god_mode_matrix', toggles: DEFAULT_TOGGLES });
    await doc.save();
  }
  // Merge any new default toggles that don't exist yet (forward-compatible)
  const existingKeys = new Set(doc.toggles.map(t => t.key));
  for (const def of DEFAULT_TOGGLES) {
    if (!existingKeys.has(def.key)) {
      doc.toggles.push(def);
    }
  }
  if (doc.isModified()) await doc.save();
  return doc;
};

const FeatureToggle =
  mongoose.models.FeatureToggle ||
  mongoose.model('FeatureToggle', featureToggleSchema);

export default FeatureToggle;
export { featureToggleSchema, DEFAULT_TOGGLES };
