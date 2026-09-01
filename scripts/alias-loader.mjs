// ============================================================================
// alias-loader.mjs — ESM resolve hook: maps @/* aliases to real paths
// ============================================================================
// Maps:
//   @/lib/*        → src/lib/*
//   @/models/*     → models/*
//   @/services/*   → services/*
//   @/components/* → src/components/*
//
// Usage: node --experimental-loader ./scripts/alias-loader.mjs scripts/test-*.js
// (Node 20 also supports --import for register-based hooks, but
//  --experimental-loader works across versions.)
// ============================================================================

import { pathToFileURL } from 'url';
import { resolve as pathResolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');

function withExtension(fileUrl) {
  const p = fileURLToPath(fileUrl);
  if (extname(p)) return fileUrl;
  if (fs.existsSync(p + '.js')) return pathToFileURL(p + '.js');
  if (fs.existsSync(p + '.mjs')) return pathToFileURL(p + '.mjs');
  if (fs.existsSync(pathResolve(p, 'index.js'))) return pathToFileURL(pathResolve(p, 'index.js'));
  return fileUrl;
}

export async function resolve(specifier, context, nextResolve) {
  let mapped = specifier;
  if (specifier.startsWith('@/lib/')) {
    mapped = withExtension(pathToFileURL(pathResolve(ROOT, 'src', specifier.slice(2))));
  } else if (specifier.startsWith('@/models/')) {
    mapped = withExtension(pathToFileURL(pathResolve(ROOT, 'models', specifier.slice(9))));
  } else if (specifier.startsWith('@/services/')) {
    mapped = withExtension(pathToFileURL(pathResolve(ROOT, 'services', specifier.slice(10))));
  } else if (specifier.startsWith('@/components/')) {
    mapped = withExtension(pathToFileURL(pathResolve(ROOT, 'src', specifier.slice(2))));
  } else if (specifier.startsWith('@/')) {
    mapped = withExtension(pathToFileURL(pathResolve(ROOT, 'src', specifier.slice(2))));
  }
  if (mapped !== specifier) {
    return nextResolve(String(mapped), { ...context, parentURL: undefined });
  }
  return nextResolve(specifier, context);
}
