"""Generate the self-contained file-panel preview from the canonical three files."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text()
css = (root / 'styles.css').read_text()
js = (root / 'app.js').read_text()
html, styles_count = re.subn(
    r'<link rel="stylesheet" href="styles\.css[^\"]*">',
    lambda _: '<style>\n' + css + '\n</style>', html,
)
html, scripts_count = re.subn(
    r'<script src="app\.js[^\"]*" defer></script>', '', html,
)
if styles_count != 1 or scripts_count != 1:
    raise SystemExit('Expected exactly one local stylesheet and one script reference.')
html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')
(root / 'preview.html').write_text(html)
print('Updated preview.html from index.html, styles.css, and app.js.')
