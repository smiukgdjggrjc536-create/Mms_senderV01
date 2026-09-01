// ============================================================================
// vault-cli.js — Command-line manager for the encrypted credentials vault
// ----------------------------------------------------------------------------
// Usage:
//   node scripts/vault-cli.js set <key> <value>   # add/update a secret
//   node scripts/vault-cli.js get <key>           # print a secret value
//   node scripts/vault-cli.js list                # list keys (no values)
//   node scripts/vault-cli.js delete <key>        # remove a secret
//   node scripts/vault-cli.js import <jsonFile>   # bulk import from JSON file
//   node scripts/vault-cli.js status              # vault file + key presence
//
// Env:
//   CRED_MASTER_KEY  — 48-byte random (hex/base64). Required in production.
//                      If unset, vault.js uses an INSECURE dev passphrase and
//                      warns loudly.
//   CRED_VAULT_PATH  — override vault file location (default .credentials.enc)
//
// ESM (project is "type":"module"); uses import/export.
// ============================================================================

import { setKey, getKey, listKeys, deleteKey, readVault, writeVault, vaultExists, VAULT_FILE } from '../src/lib/security/vault.js';
import fs from 'fs';

function printUsage() {
  console.log(`vault-cli — encrypted credentials vault manager

Usage:
  node scripts/vault-cli.js set <key> <value>     Add or update a secret
  node scripts/vault-cli.js get <key>             Print a secret value
  node scripts/vault-cli.js list                  List all keys (no values)
  node scripts/vault-cli.js delete <key>          Remove a secret
  node scripts/vault-cli.js import <jsonFile>     Bulk import keys from a JSON file
  node scripts/vault-cli.js status                Show vault file + key count

Env:
  CRED_MASTER_KEY   48-byte random key (required in production)
  CRED_VAULT_PATH   override vault file (default: ${VAULT_FILE})
`);
}

async function main() {
  const [, , cmd, ...args] = process.argv;

  try {
    switch (cmd) {
      case 'set': {
        if (args.length < 2) {
          console.error('Usage: vault-cli.js set <key> <value>');
          process.exit(2);
        }
        const [key, ...rest] = args;
        const value = rest.join(' ');
        setKey(key, value);
        console.log(`✓ set "${key}" in vault (${VAULT_FILE})`);
        break;
      }
      case 'get': {
        if (args.length < 1) {
          console.error('Usage: vault-cli.js get <key>');
          process.exit(2);
        }
        const [key] = args;
        const value = getKey(key);
        if (value === undefined) {
          console.error(`✗ key "${key}" not found in vault`);
          process.exit(3);
        }
        console.log(value);
        break;
      }
      case 'list': {
        const keys = listKeys();
        if (keys.length === 0) {
          console.log('(vault is empty)');
        } else {
          keys.forEach((k) => console.log(k));
        }
        break;
      }
      case 'delete': {
        if (args.length < 1) {
          console.error('Usage: vault-cli.js delete <key>');
          process.exit(2);
        }
        const [key] = args;
        const ok = deleteKey(key);
        if (!ok) {
          console.error(`✗ key "${key}" not found in vault`);
          process.exit(3);
        }
        console.log(`✓ deleted "${key}" from vault`);
        break;
      }
      case 'import': {
        if (args.length < 1) {
          console.error('Usage: vault-cli.js import <jsonFile>');
          process.exit(2);
        }
        const [jsonFile] = args;
        if (!fs.existsSync(jsonFile)) {
          console.error(`✗ file not found: ${jsonFile}`);
          process.exit(3);
        }
        const incoming = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        const existing = readVault();
        const merged = { ...existing, ...incoming };
        writeVault(merged);
        console.log(`✓ imported ${Object.keys(incoming).length} key(s) into vault (merged with ${Object.keys(existing).length} existing)`);
        break;
      }
      case 'status': {
        const exists = vaultExists();
        const keys = listKeys();
        console.log(`vault file: ${VAULT_FILE}`);
        console.log(`exists:     ${exists ? 'yes' : 'no'}`);
        console.log(`key count:  ${keys.length}`);
        if (keys.length > 0) {
          console.log(`keys:       ${keys.join(', ')}`);
        }
        if (!process.env.CRED_MASTER_KEY) {
          console.log('CRED_MASTER_KEY: NOT SET (using INSECURE dev passphrase — production must set it)');
        } else {
          console.log('CRED_MASTER_KEY: set');
        }
        break;
      }
      case undefined:
      case '--help':
      case '-h':
      case 'help':
        printUsage();
        break;
      default:
        console.error(`✗ unknown command: ${cmd}`);
        printUsage();
        process.exit(2);
    }
  } catch (err) {
    console.error(`✗ vault-cli error: ${err.message}`);
    process.exit(1);
  }
}

main();
