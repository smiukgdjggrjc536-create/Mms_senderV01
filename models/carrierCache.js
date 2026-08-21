// ============================================================================
// CarrierCache Schema — Email-to-MMS Gateway Backend Engine (Phase 1)
// ============================================================================
// Caches the MMS carrier gateway domain (e.g. "mms.att.net") and line type
// for a given phone number so the Smart Carrier Caching engine (Phase 2) can
// avoid repeated paid carrier-lookup API calls.
//
// Strict 60-day auto-expiration is enforced via a native MongoDB TTL index on
// `ttlExpiresAt`. Documents are automatically deleted by MongoDB after the
// TTL date, so the cache stays fresh and stale carrier data never ships.
//
// This model is NON-DESTRUCTIVE: brand-new collection, no existing schema is
// touched. Style matches the rest of the project.
// ============================================================================

import mongoose from 'mongoose';

const carrierCacheSchema = new mongoose.Schema({
  // E.164 or normalized phone number. Unique + indexed for fast lookups.
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },

  // The MMS gateway domain used to construct the send address:
  //   <number>@<carrierDomain>  e.g. 12125551234@mms.att.net
  carrierDomain: {
    type: String,
    required: true,
    default: '',
  },

  // Line type from the carrier lookup. Only MOBILE numbers can receive MMS.
  // LANDLINE/VOIP results are cached to short-circuit future lookups (skip).
  lineType: {
    type: String,
    enum: ['MOBILE', 'LANDLINE', 'VOIP', 'UNKNOWN'],
    default: 'UNKNOWN',
  },

  // When the carrier info was last confirmed against the lookup API.
  lastVerified: {
    type: Date,
    default: Date.now,
  },

  // TTL date: set to lastVerified + 60 days when a record is created/updated.
  // Indexed with `expireAfterSeconds: 0` so MongoDB deletes the doc at this
  // exact time (strict 60-day expiration, not a relative offset).
  ttlExpiresAt: {
    type: Date,
    required: true,
    default: function () {
      // 60 days in milliseconds
      return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    },
    index: { expireAfterSeconds: 0 },
  },

  // Carrier name (optional, from lookup) for analytics/diagnostics.
  carrierName: {
    type: String,
    default: '',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// lastVerified + ttlExpiresAt are refreshed explicitly by the carrier engine
// (Phase 2) on every re-verification, so no pre('save') hook is needed.

const CarrierCache =
  mongoose.models.CarrierCache ||
  mongoose.model('CarrierCache', carrierCacheSchema);

export default CarrierCache;
export { carrierCacheSchema };
