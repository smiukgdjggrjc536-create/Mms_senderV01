// Bootstrap wrapper: sets fast-fail env BEFORE importing test modules.
// Usage: node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs <test-file>
process.env.MONGODB_URI =
  'mongodb://localhost:27017/test?serverSelectionTimeoutMS=1000&connectTimeoutMS=1000&socketTimeoutMS=1000';
process.env.REDIS_URL = ''; // force in-memory Redis fallback
process.env.GEMINI_TIMEOUT_MS = '2000';

const testFile = process.argv[2] || 'scripts/test-restock.js';
const { default: nothing } = await import('./' + testFile.replace(/^scripts\//, '')).catch((err) => {
  console.error('IMPORT ERROR:', err);
  process.exit(1);
});
