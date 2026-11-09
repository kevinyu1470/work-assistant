from pathlib import Path
import re, hashlib, json
root=Path(__file__).resolve().parents[1]/'web'
if not root.exists(): root=Path(__file__).resolve().parents[3]/'kansai'
version='reliable-20261109'
html=(root/'index.html').read_text()
html=re.sub(r'11/08 大阪路線圖版','11/09 穩定同步版',html)
if 'src="durable-trip.js' not in html: html=html.replace('<script src="cloud.js', '<script src="durable-trip.js"></script><script src="cloud.js')
# Every referenced script/style gets an exact content fingerprint.
def ref(m):
 name=m[2].split('?')[0]
 file=root/name
 digest=hashlib.sha256(file.read_bytes()).hexdigest()[:16]
 return m[1]+name+'?v='+digest+m[3]
html=re.sub(r'((?:src|href)=")([^"?]+\.(?:js|css))(?:\?[^" ]*)?(\")',ref,html)
(root/'index.html').write_text(html)
assets={}
for name in ['index.html',*re.findall(r'(?:src|href)="([^" ]+\.(?:js|css)\?[^" ]+)"',html),'data.js','config.js','autumn.svg','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest']:
 assets[name]=hashlib.sha256((root/name.split('?')[0]).read_bytes()).hexdigest()
release={'version':version,'assets':assets}
(root/'release.json').write_text(json.dumps(release,separators=(',',':'))+'\n')
worker=(Path(__file__).parent/'sw-template.js').read_text().replace('__VERSION__',version).replace('__ASSETS__',json.dumps(assets,separators=(',',':')))
(root/'sw.js').write_text(worker)
print('Release:',version,'verified assets:',len(assets))
