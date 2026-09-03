// dupkey_scanner.cjs — find object literals with duplicate keys (silent overwrite bug)
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const Parser = acorn.Parser.extend(jsx());
const OPTS = { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowReturnOutsideFunction: true };

function findObjDupKeys(node, file, findings) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'ObjectExpression') {
    const seen = new Map();
    for (const prop of (node.properties || [])) {
      let keyName = null;
      if (prop.type === 'Property') {
        if (prop.key && prop.key.type === 'Identifier') keyName = prop.key.name;
        else if (prop.key && prop.key.type === 'Literal') keyName = String(prop.key.value);
      }
      if (keyName) {
        if (seen.has(keyName)) {
          findings.push({ file, key: keyName, line: prop.loc.start.line, firstLine: seen.get(keyName) });
        } else {
          seen.set(keyName, prop.loc.start.line);
        }
      }
    }
  }
  for (const k in node) {
    if (['loc','range','start','end','type'].includes(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(it => findObjDupKeys(it, file, findings));
    else if (v && typeof v.type === 'string') findObjDupKeys(v, file, findings);
  }
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : (() => {
  const out = [];
  function walk(d){ for (const e of fs.readdirSync(d, {withFileTypes:true})) {
    if (e.name==='node_modules'||e.name==='.next'||e.name==='.git') continue;
    const p = path.join(d,e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }}
  ['src','services','models'].forEach(walk);
  return out;
})();

const findings = [];
for (const t of targets) {
  let src; try { src = fs.readFileSync(t,'utf8'); } catch { continue; }
  let tree; try { tree = Parser.parse(src, OPTS); } catch { try { tree = Parser.parse(src, {...OPTS, sourceType:'script'}); } catch { continue; } }
  findObjDupKeys(tree, t, findings);
}
// filter out spread-element cases (duplicate key with spread is often intentional override)
if (!findings.length) console.log('No duplicate-key object literals found.');
else {
  console.log(`=== ${findings.length} duplicate-key object literal(s) ===`);
  for (const f of findings) console.log(`  ${f.file}: duplicate key '${f.key}' at line ${f.line} (first at ${f.firstLine})`);
}
