"""Generate the self-contained file-panel preview from the canonical HTML, CSS, app, and reply modules."""
from pathlib import Path
import re
import hashlib
import base64

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
css = (root / 'styles.css').read_text()
js = '\n'.join((root / name).read_text() for name in ['reply/core.js','reply/fixtures.js','reply/browser-adapter.js','app.js'])
html, styles_count = re.subn(
    r'<link rel="stylesheet" href="styles\.css[^\"]*">',
    lambda _: '<style>\n' + css + '\n</style>', html,
)
html=re.sub(r'<script src="reply/[^"]+" defer></script>', '',html)
html, scripts_count = re.subn(
    r'<script src="app\.js[^\"]*" defer></script>', '', html,
)
if styles_count != 1 or scripts_count != 1:
    raise SystemExit('Expected exactly one local stylesheet and one script reference.')
html=re.sub(r'(?m)^[ \t]+$', '',html)
digest=base64.b64encode(hashlib.sha256(('\n'+js+'\n').encode()).digest()).decode()
html=html.replace("script-src 'self'","script-src 'self' 'sha256-"+digest+"'")
html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')
(root / 'preview.html').write_text(html)
print('Updated preview.html from canonical dashboard sources and reply modules.')
