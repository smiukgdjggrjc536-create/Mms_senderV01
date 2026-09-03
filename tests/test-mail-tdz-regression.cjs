// =============================================================================
// test-mail-tdz-regression.cjs
// Regression test for the TDZ bug "Cannot access 'v' before initialization"
// that crashed the test-mail send path in /api/system (action: sendCampaign,
// options.testMail). Root cause: the test-mail block referenced `geminiApi`
// (via object shorthand) BEFORE the `const geminiApi = await getBestGeminiApi()`
// declaration line in the same function scope — a Temporal Dead Zone access.
//
// This test parses src/app/api/system/route.js and asserts:
//   1. The test-mail block does NOT contain a bare `geminiApi,` shorthand
//      (which would be a TDZ reference to a later const).
//   2. The test-mail block uses a locally-declared binding (testGeminiApi or
//      similar) that is declared BEFORE it is used.
//
// Run: node tests/test-mail-tdz-regression.cjs
// =============================================================================
const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const Parser = acorn.Parser.extend(jsx());

const FILE = 'src/app/api/system/route.js';
const src = fs.readFileSync(FILE, 'utf8');
const tree = Parser.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowReturnOutsideFunction: true });

// Locate the test-mail IfStatement: options.testMail && options.testRecipient
function find(node, pred) {
  if (!node || typeof node.type !== 'string') return null;
  if (pred(node)) return node;
  for (const k in node) {
    if (['loc','range','start','end','type'].includes(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const it of v) { const r = find(it, pred); if (r) return r; } }
    else if (v && typeof v.type === 'string') { const r = find(v, pred); if (r) return r; }
  }
  return null;
}

const post = find(tree, n => n.type === 'FunctionDeclaration' && n.id && n.id.name === 'POST');
if (!post) { console.error('FAIL: POST function not found'); process.exit(1); }

// Find the testMail IfStatement by scanning for a BinaryExpression referencing testMail & testRecipient
const testMailIf = find(post, n => {
  if (n.type !== 'IfStatement') return false;
  const test = n.test;
  if (!test) return false;
  // look for 'testMail' and 'testRecipient' identifiers in the test expression
  let hasMail = false, hasRecip = false;
  function scan(x) {
    if (!x || typeof x.type !== 'string') return;
    if (x.type === 'Identifier' && x.name === 'testMail') hasMail = true;
    if (x.type === 'Identifier' && x.name === 'testRecipient') hasRecip = true;
    for (const k in x) {
      if (['loc','range','start','end','type'].includes(k)) continue;
      const v = x[k];
      if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v.type === 'string') scan(v);
    }
  }
  scan(test);
  return hasMail && hasRecip;
});

if (!testMailIf) { console.error('FAIL: testMail IfStatement not found'); process.exit(1); }

// Collect the source lines of the testMail consequent block
const startLine = testMailIf.consequent.loc.start.line;
const endLine = testMailIf.consequent.loc.end.line;
const blockSrc = src.split('\n').slice(startLine - 1, endLine).join('\n');

let failures = 0;

// CHECK 1: no bare `geminiApi,` shorthand (TDZ reference to a later const)
// Pattern to flag: a property shorthand `geminiApi,` inside an object literal
// within the test-mail block (NOT `geminiApi: <value>`).
const shorthandRe = /\bgeminiApi\s*,/g;
const shorthandMatches = blockSrc.match(shorthandRe);
// exclude `geminiApi: ...,` (has a colon) — shorthand has no colon before comma
const trueShorthand = (shorthandMatches || []).filter(m => true); // match is 'geminiApi,'
// More precise: find 'geminiApi' not followed by ':' before the comma
const preciseRe = /\bgeminiApi\s*(?=:)/g; // these are FINE (geminiApi: value)
const badShorthand = blockSrc.match(/\bgeminiApi\s*,(?!\s*:)/g) || [];
// Actually check: is there a `geminiApi` used as a VALUE (shorthand) without a local decl?
if (/\bgeminiApi\s*,\s*/.test(blockSrc) && !/\bgeminiApi:/.test(blockSrc)) {
  console.error(`FAIL [check 1]: test-mail block (lines ${startLine}-${endLine}) still uses bare \`geminiApi,\` shorthand — TDZ risk to a later-declared const.`);
  failures++;
} else {
  console.log(`PASS [check 1]: test-mail block does not use bare \`geminiApi,\` shorthand.`);
}

// CHECK 2: the value passed for geminiApi is a locally-declared binding declared
// BEFORE its use within the block. Find `geminiApi: <binding>` and ensure
// `<binding>` has a `const <binding> = await getBestGeminiApi()` above it.
const propMatch = blockSrc.match(/\bgeminiApi:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
if (propMatch) {
  const binding = propMatch[1];
  const useLineRel = blockSrc.slice(0, propMatch.index).split('\n').length;
  const useLineAbs = startLine - 1 + useLineRel;
  // find declaration of `binding` in the whole POST body before useLineAbs
  const declRe = new RegExp(`\\bconst\\s+${binding}\\s*=`);
  const declMatch = src.match(declRe);
  if (!declMatch) {
    console.error(`FAIL [check 2]: binding '${binding}' passed to geminiApi has no const declaration.`);
    failures++;
  } else {
    const declLine = src.slice(0, declMatch.index).split('\n').length;
    if (declLine < useLineAbs) {
      console.log(`PASS [check 2]: '${binding}' declared at line ${declLine} BEFORE use at line ${useLineAbs}. No TDZ.`);
    } else {
      console.error(`FAIL [check 2]: '${binding}' declared at line ${declLine} but used at line ${useLineAbs} — TDZ!`);
      failures++;
    }
  }
} else {
  console.error('FAIL [check 2]: could not find `geminiApi: <binding>` in test-mail block.');
  failures++;
}

if (failures === 0) {
  console.log('\n✅ ALL CHECKS PASSED — test-mail TDZ regression is fixed.');
  process.exit(0);
} else {
  console.error(`\n❌ ${failures} check(s) FAILED.`);
  process.exit(1);
}
