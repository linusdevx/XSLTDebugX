"""
Bug scan script: combines graphify graph data with direct source analysis
to find real code-level bugs in the XSLTDebugX JS modules.
"""
import json, re, collections
from pathlib import Path

results = collections.defaultdict(list)

for jsfile in sorted(Path('js').glob('*.js')):
    src = jsfile.read_text(encoding='utf-8', errors='replace')
    lines = src.splitlines()

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # 1. Silent catch: .catch(() => {}) hides errors silently
        if re.search(r'\.catch\s*\(\s*(?:\(\s*\)|_|\w+)\s*=>\s*\{\s*\}\s*\)', stripped):
            results['silent-catch'].append((jsfile.name, i, stripped))

        # 2. innerHTML with non-literal RHS and no escHtml wrapper (XSS risk)
        if re.search(r'\.innerHTML\s*(?:\+)?=', stripped) and 'escHtml' not in stripped and not stripped.startswith('//'):
            results['innerHTML-unescaped'].append((jsfile.name, i, stripped))

        # 3. Direct _suppressNext* = true bypasses _withSuppress factory
        if re.search(r'_suppressNext\w+\s*=\s*true', stripped):
            results['bypass-suppress'].append((jsfile.name, i, stripped))

        # 4. SaxonJS.transform or SaxonJS.XPath without saxonReady/guardReady nearby
        if re.search(r'SaxonJS\.(transform|XPath)\b', stripped):
            window = '\n'.join(lines[max(0, i - 6):i + 2])
            if 'saxonReady' not in window and 'guardReady' not in window:
                results['unguarded-saxon'].append((jsfile.name, i, stripped))

        # 5. .then() chain with no .catch within 5 lines and no logError
        if re.search(r'\.\s*then\s*\(', stripped) and '.catch' not in stripped:
            window = '\n'.join(lines[i - 1:i + 5])
            if '.catch' not in window and 'logError' not in window:
                results['then-no-catch'].append((jsfile.name, i, stripped))

        # 6. scheduleSave() calls — flag all so we can verify legitimacy
        if 'scheduleSave()' in stripped and not stripped.startswith('//'):
            results['scheduleSave-call'].append((jsfile.name, i, stripped))

        # 7. getElementById / querySelector result used without null check
        if re.search(r'(?:getElementById|querySelector)\s*\([^)]+\)\s*\.', stripped):
            results['unchecked-dom-access'].append((jsfile.name, i, stripped))

        # 8. Promise constructor anti-pattern: new Promise(resolve => { somePromise.then(resolve) })
        if re.search(r'new\s+Promise\s*\(', stripped):
            results['promise-constructor'].append((jsfile.name, i, stripped))

        # 9. JSON.parse without try/catch — fragile on malformed input
        if re.search(r'JSON\.parse\s*\(', stripped):
            # Check if there's a try/catch in surrounding 10 lines
            window = '\n'.join(lines[max(0, i - 5):i + 5])
            if 'try' not in window and 'catch' not in window:
                results['json-parse-unguarded'].append((jsfile.name, i, stripped))

        # 10. localStorage access without try/catch (can throw in private mode)
        if re.search(r'localStorage\.\s*(?:getItem|setItem|removeItem)', stripped):
            window = '\n'.join(lines[max(0, i - 5):i + 5])
            if 'try' not in window and 'catch' not in window:
                results['localstorage-unguarded'].append((jsfile.name, i, stripped))

print('=== XSLTDebugX Bug Scan Results ===\n')
for category, hits in sorted(results.items()):
    print(f'--- {category} ({len(hits)} hits) ---')
    for fname, lineno, line in hits[:20]:
        safe = line[:110].encode('ascii', 'replace').decode('ascii')
        print(f'  {fname}:{lineno:<5}  {safe}')
    if len(hits) > 20:
        print(f'  ... and {len(hits) - 20} more')
    print()
