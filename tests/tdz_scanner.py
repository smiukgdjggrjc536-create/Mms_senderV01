#!/usr/bin/env python3
"""
tdz_scanner.py — Static TDZ (Temporal Dead Zone) risk scanner.

Detects the EXACT pattern that caused 'Cannot access X before initialization'
in this codebase: a `const`/`let` declaration that is REFERENCED (in a closure,
useMemo/useEffect/useCallback factory or deps array, or any expression) by a
node whose source position is ABOVE the declaration line, within the same
function scope.

We use esprima to parse each JS/JSX file into an AST, walk it, and for every
function scope record the declaration line of each const/let. Then for every
Identifier reference, if it resolves to a const/let declared LATER in the same
scope (or an enclosing scope), we flag it as a TDZ risk.

Note: esprima does not parse TS or modern class fields perfectly, but this
codebase is JS/JSX only.
"""
import sys, os, re
try:
    import esprima
except ImportError:
    print("esprima not installed"); sys.exit(2)

class Scope:
    def __init__(self, name, parent, start_line):
        self.name = name
        self.parent = parent
        self.start_line = start_line
        # var_name -> (decl_line, kind)  for const/let declared in THIS scope
        self.consts = {}
        self.lets = {}
        # hoisted function names
        self.funcs = {}

def get_pos(node):
    # esprima nodes have .loc.start.line (1-based) and .range
    return node.loc.start.line if hasattr(node, 'loc') and node.loc else 0

def walk(node, scope, findings, filename):
    if not hasattr(node, 'type'):
        return
    t = node.type

    # Track declarations in current scope
    if t in ('VariableDeclaration',):
        for decl in node.declarations:
            if decl.id and decl.id.type == 'Identifier':
                name = decl.id.name
                line = get_pos(decl)
                if node.kind == 'const':
                    scope.consts[name] = line
                elif node.kind == 'let':
                    scope.lets[name] = line
                elif node.kind == 'var':
                    pass  # var is hoisted, no TDZ

    # Function declarations are hoisted (no TDZ) but record name
    if t == 'FunctionDeclaration' and node.id:
        scope.funcs[node.id.name] = get_pos(node)

    # When we enter a new function, create a child scope
    func_types = ('FunctionExpression','ArrowFunctionExpression','FunctionDeclaration','MethodDefinition')
    if t in ('FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'):
        child = Scope(f"fn@{get_pos(node)}", scope, get_pos(node))
        # params are in scope from the start
        for p in (node.params or []):
            if p.type == 'Identifier':
                child.lets[p.name] = get_pos(p)  # params: no TDZ but track
        # body
        if node.body:
            walk(node.body, child, findings, filename)
        return

    # Check Identifier references for TDZ
    if t == 'Identifier':
        name = node.name
        ref_line = get_pos(node)
        # Search enclosing scopes
        s = scope
        while s is not None:
            if name in s.consts:
                decl_line = s.consts[name]
                if ref_line < decl_line:
                    findings.append((filename, name, ref_line, decl_line, 'const'))
                break
            if name in s.lets:
                decl_line = s.lets[name]
                if ref_line < decl_line:
                    findings.append((filename, name, ref_line, decl_line, 'let'))
                break
            if name in s.funcs:
                break  # hoisted
            s = s.parent

    # Recurse into children
    for attr in dir(node):
        if attr.startswith('_'): continue
        try:
            val = getattr(node, attr)
        except Exception:
            continue
        if isinstance(val, list):
            for item in val:
                if hasattr(item, 'type'):
                    walk(item, scope, findings, filename)
        elif hasattr(val, 'type'):
            walk(val, scope, findings, filename)

def scan_file(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            src = f.read()
    except Exception as e:
        return []
    # esprima can parse JSX with jsx=True
    try:
        tree = esprima.parseScript(src, {'jsx': True, 'loc': True, 'range': True, 'tolerant': True})
    except Exception as e:
        # try module
        try:
            tree = esprima.parseModule(src, {'jsx': True, 'loc': True, 'range': True, 'tolerant': True})
        except Exception as e2:
            return [(path, 'PARSE_ERROR', 0, 0, str(e2)[:60])]
    root = Scope('global', None, 0)
    findings = []
    walk(tree, root, findings, path)
    return findings

def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else []
    if not targets:
        # default: scan send chain + panels + core + system route
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
        ]
    all_findings = []
    for t in targets:
        if not os.path.exists(t):
            continue
        all_findings.extend(scan_file(t))
    if not all_findings:
        print("No TDZ risks found.")
        return
    print(f"=== {len(all_findings)} TDZ risk(s) found ===")
    for f in all_findings:
        print(f"  {f[0]}: '{f[1]}' referenced at line {f[2]} BEFORE declaration at line {f[3]} ({f[4]})")

if __name__ == '__main__':
    main()
