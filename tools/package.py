#!/usr/bin/env python3
"""Create a complete offline distribution, excluding dependencies and caches."""
from pathlib import Path
import argparse, hashlib, shutil, zipfile
ROOT=Path(__file__).resolve().parent.parent
FILES=['index.html','style.css','app.js','boot.js','README.md','LEEME.html','SOURCES.md','package.json','package-lock.json','data/puzzles.js','data/openings.js','data/manifest.json','data/CC0.txt','engine/embedded.js','engine/uci.js','engine/COPYING.txt','engine/stockfish-corresponding-source.tar.gz','vendor/chess-rules.js','vendor/LICENSE','tests/chess.test.cjs','tests/browser.cjs','tests/help.cjs','tools/fetch-data.py','tools/build-data.cjs','tools/prepare-engine.cjs','tools/build-portable.cjs','tools/package.py','enroque-portatil.html','tests/local-file.cjs','tests/engine-compat.cjs']
parser=argparse.ArgumentParser()
parser.add_argument('--out',type=Path,default=ROOT/'dist'/'enroque-profesional')
args=parser.parse_args()
out=args.out.resolve()
if out==ROOT or ROOT.is_relative_to(out): raise SystemExit('El destino no puede contener el repositorio.')
if out.exists() and any(out.iterdir()) and not (out/'ENROQUE-PACKAGE.txt').exists():raise SystemExit('El destino contiene archivos ajenos. Elige una carpeta nueva.')
checks=[]
for name in FILES:
 source=ROOT/name
 checks.append(hashlib.sha256(source.read_bytes()).hexdigest()+'  '+name)
 dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
checksum='\n'.join(checks)+'\n'
(ROOT/'ASSETS.sha256').write_text(checksum,encoding='utf-8')
(out/'ASSETS.sha256').write_text(checksum,encoding='utf-8')
(out/'ENROQUE-PACKAGE.txt').write_text('Enroque 3.2 · Stockfish 17.1 · paquete completo sin dependencias de Internet.\n',encoding='utf-8')
archive=out.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name in FILES+['ASSETS.sha256','ENROQUE-PACKAGE.txt']:z.write(out/name,Path(out.name)/name)
with zipfile.ZipFile(archive) as z:
 bad=z.testzip()
 if bad: raise SystemExit('ZIP incorrecto: '+bad)
print('Carpeta: '+str(out))
print('ZIP: '+str(archive))
print('Archivos: '+str(len(FILES)+2))
print('Tamaño ZIP: '+str(round(archive.stat().st_size/1024/1024,2))+' MiB')
