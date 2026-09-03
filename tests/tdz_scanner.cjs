// =============================================================================
// tdz_scanner.cjs — Static TDZ (Temporal Dead Zone) risk scanner (acorn-based)
//
// Detects the pattern that caused 'Cannot access X before initialization' in
// this codebase: a `const`/`let` declaration referenced (in a closure,
// useMemo/useEffect/useCallback factory or deps array, or any expression) by
// a node whose source position is ABOVE the declaration line, within the same
// function scope.
//
// Usage: node tests/tdz_scanner.cjs [file1.js file2.jsx ...]
//   (defaults to the email send chain + panels + core + system route)
// =============================================================================
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const Parser = acorn.Parser.extend(jsx());

const PARSE_OPTS = { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowReturnOutsideFunction: true };

class Scope {
  constructor(name, parent, startLine) {
    this.name = name; this.parent = parent; this.startLine = startLine;
    this.consts = new Map(); // name -> declLine
    this.lets = new Map();
    this.vars = new Set();   // hoisted, no TDZ
    this.funcs = new Set();  // hoisted function decls
  }
}

function lineOf(node) { return node && node.loc ? node.loc.start.line : 0; }

// ---- prescanDeclarations: walk a block/function body and record ALL const/let
// declarations and hoisted function/var names that belong to THIS scope (i.e.
// NOT inside a nested function). This runs before reference-checking so an
// early reference to a later-declared const/let is caught (the TDZ case).
function prescanDeclarations(node, scope) {
  if (!node || typeof node.type !== 'string') return;
  const t = node.type;
  // Stop at nested function boundaries — their declarations belong to their
  // own scope, which is created when walk() enters them.
  if (t === 'FunctionExpression' || t === 'ArrowFunctionExpression' || t === 'FunctionDeclaration') {
    // But DO record the function's own NAME in the enclosing scope (hoisted).
    if (t === 'FunctionDeclaration' && node.id) scope.funcs.add(node.id.name);
    return;
  }
  if (t === 'VariableDeclaration') {
    for (const decl of (node.declarations || [])) {
      const ln = lineOf(decl);
      const names = collectPatternNames(decl.id);
      for (const name of names) {
        if (node.kind === 'const') { if (!scope.consts.has(name)) scope.consts.set(name, ln); }
        else if (node.kind === 'let') { if (!scope.lets.has(name)) scope.lets.set(name, ln); }
        else if (node.kind === 'var') scope.vars.add(name);
      }
    }
    return;
  }
  // Recurse children (skip nested functions handled above)
  for (const key in node) {
    if (key === 'loc' || key === 'range' || key === 'start' || key === 'end' || key === 'type') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item.type === 'string') prescanDeclarations(item, scope);
      }
    } else if (val && typeof val.type === 'string') {
      prescanDeclarations(val, scope);
    }
  }
}

function walk(node, scope, findings, filename) {
  if (!node || typeof node.type !== 'string') return;
  const t = node.type;

  // ---- PASS 1 (pre-scan): record ALL const/let declarations + hoisted funcs
  // in THIS scope BEFORE checking any references. This is essential because a
  // reference that appears textually above a `const`/`let` declaration (the
  // classic TDZ case) must be detected — a single-pass walk would miss it.
  if (t === 'Program') {
    prescanDeclarations(node, scope);
  }

  // New function scope
  if (t === 'FunctionExpression' || t === 'ArrowFunctionExpression' || t === 'FunctionDeclaration') {
    const child = new Scope(`fn@${lineOf(node)}`, scope, lineOf(node));
    for (const p of (node.params || [])) {
      collectPatternNames(p).forEach(n => child.lets.set(n, lineOf(p))); // params: in scope, no TDZ
    }
    // PASS 1 for this function scope: prescan its body so all const/let are
    // known before we check references (catches early-ref-before-decl TDZ).
    if (node.body) prescanDeclarations(node.body, child);
    if (node.body) walk(node.body, child, findings, filename);
    return;
  }

  // Identifier reference → check TDZ against enclosing scopes
  if (t === 'Identifier') {
    // Skip property keys in object literals (e.g. { geminiApi: x }) — the key
    // is a name, not a variable reference. Also skip member-access property
    // names (e.g. obj.foo — foo is not a reference).
    const parentIsKey = (node._parentType === 'Property' && node._isKey);
    const parentIsMember = (node._parentType === 'MemberExpression' && node._isProperty);
    if (parentIsKey || parentIsMember) { /* not a reference */ }
    else {
      const name = node.name;
      const refLine = lineOf(node);
      let s = scope;
      while (s) {
        if (s.consts.has(name)) {
          const declLine = s.consts.get(name);
          if (refLine && declLine && refLine < declLine) {
            findings.push({ file: filename, name, refLine, declLine, kind: 'const' });
          }
          break;
        }
        if (s.lets.has(name)) {
          const declLine = s.lets.get(name);
          if (refLine && declLine && refLine < declLine) {
            findings.push({ file: filename, name, refLine, declLine, kind: 'let' });
          }
          break;
        }
        if (s.vars.has(name) || s.funcs.has(name)) break; // hoisted
        s = s.parent;
      }
    }
  }

  // Recurse children generically, tagging Identifiers with parent context
  // so we can skip property keys / member-access names (not real references).
  for (const key in node) {
    if (key === 'loc' || key === 'range' || key === 'start' || key === 'end' || key === 'type') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item.type === 'string') {
          tagParent(item, node, key);
          walk(item, scope, findings, filename);
        }
      }
    } else if (val && typeof val.type === 'string') {
      tagParent(val, node, key);
      walk(val, scope, findings, filename);
    }
  }
}

// Tag a child Identifier with whether it is an object-property key or a
// member-access property (so the reference check can skip it).
function tagParent(child, parent, parentKey) {
  if (child.type !== 'Identifier') return;
  if (parent.type === 'Property' && parentKey === 'key') {
    child._parentType = 'Property'; child._isKey = true;
  } else if (parent.type === 'MemberExpression' && parentKey === 'property' && !parent.computed) {
    child._parentType = 'MemberExpression'; child._isProperty = true;
  } else if (parent.type === 'LabeledStatement' && parentKey === 'label') {
    child._parentType = 'LabeledStatement'; child._isKey = true;
  } else {
    child._parentType = parent.type;
  }
}

function collectPatternNames(pat) {
  const out = [];
  if (!pat) return out;
  if (pat.type === 'Identifier') out.push(pat.name);
  else if (pat.type === 'AssignmentPattern') out.push(...collectPatternNames(pat.left));
  else if (pat.type === 'ArrayPattern') for (const e of (pat.elements||[])) out.push(...collectPatternNames(e));
  else if (pat.type === 'ObjectPattern') for (const p of (pat.properties||[])) out.push(...collectPatternNames(p.value || p.key));
  else if (pat.type === 'RestElement') out.push(...collectPatternNames(pat.argument));
  return out;
}

function scanFile(p) {
  let src;
  try { src = fs.readFileSync(p, 'utf8'); } catch (e) { return []; }
  let tree;
  try {
    tree = Parser.parse(src, PARSE_OPTS);
  } catch (e) {
    // try as script
    try { tree = Parser.parse(src, { ...PARSE_OPTS, sourceType: 'script' }); }
    catch (e2) { return [{ file: p, name: 'PARSE_ERROR', refLine: 0, declLine: 0, kind: String(e2.message).slice(0,80) }]; }
  }
  const root = new Scope('global', null, 0);
  const findings = [];
  walk(tree, root, findings, p);
  return findings;
}

function main() {
  let targets = process.argv.slice(2);
  if (targets.length === 0) {
    targets = [
      'services/bulkSendEmailMms.js',
      'services/queueRouter.js',
      'services/bounceHandler.js',
      'services/senders/index.js',
      'services/senders/gmailSender.js',
      'services/senders/smtpSender.js',
      'services/senders/outlookSender.js',
      'services/prepareEmail.js',
      'services/safetyFilter.js',
      'services/aiRewriter.js',
      'src/lib/core.js',
      'src/app/api/system/route.js',
      'src/components/UserPanel.jsx',
      'src/components/AdminPanel.jsx',
      'src/app/page.js',
    ];
  }
  let all = [];
  for (const t of targets) {
    if (!fs.existsSync(t)) { console.error(`skip (missing): ${t}`); continue; }
    all = all.concat(scanFile(t));
  }
  // Filter out parse errors separately
  const real = all.filter(f => f.name !== 'PARSE_ERROR');
  const errors = all.filter(f => f.name === 'PARSE_ERROR');
  if (errors.length) {
    console.log(`\n=== ${errors.length} parse error(s) (could not scan) ===`);
    for (const e of errors) console.log(`  ${e.file}: ${e.kind}`);
  }
  if (real.length === 0) {
    console.log('\nNo TDZ risks found in scanned files.');
  } else {
    console.log(`\n=== ${real.length} TDZ risk(s) ===`);
    for (const f of real) console.log(`  ${f.file}: '${f.name}' referenced at line ${f.refLine} BEFORE ${f.kind} declaration at line ${f.declLine}`);
  }
}
main();
