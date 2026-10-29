#!/usr/bin/env python3
"""Reproduce the pinned CC0 datasets. Runtime use never needs these downloads."""
from pathlib import Path
import csv, hashlib, io, json, subprocess, urllib.request
ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'data'/'.build-cache'
CACHE.mkdir(parents=True,exist_ok=True)
OPENINGS_COMMIT='e76b8b4ec5c8aeeba41dac6caf4a60b938f652db'
OPENING_HASHES= {'a': '3282e4c9155289a29224f9a85fba0decb46efa35c2fa5e39662d2ac48fb0f793', 'b': '4bf2269a8e7571a00a7b346bae4fa86a241a6e7e86beab01783c81acb1622b63', 'c': '45e843c7b7e79a0d04d5bda879c9bd23f5a10974488bd8615e4f4c5d0749986f', 'd': '1cf4057a8aece94f27bb3f278ad410ee2844831a642364eeceaafa091dbcceda', 'e': '48c6f6645b031a5937c8386839debab0e2e48837251687ba1afb6369677f8546'}

def fetch(url,expected):
    with urllib.request.urlopen(url,timeout=60) as response: raw=response.read()
    actual=hashlib.sha256(raw).hexdigest()
    if actual!=expected: raise RuntimeError('SHA256 mismatch: '+url+' actual '+actual)
    return raw.decode('utf-8-sig')

puzzles=fetch('https://raw.githubusercontent.com/Ali-Raza764/chess_puzzles_api/94e65c36af8358a04d3c835984435845fc638fe3/puzzles_10000.csv','9216f3af0f56b5f8b9e6a0a4a0fbb6c0dd63c6762aa9f7f3e78db10fc93c2564')
(CACHE/'puzzle-rows.json').write_text(json.dumps(list(csv.DictReader(io.StringIO(puzzles)))),encoding='utf-8')
rows=[]
for letter,expected in OPENING_HASHES.items():
    text=fetch('https://raw.githubusercontent.com/lichess-org/chess-openings/'+OPENINGS_COMMIT+'/'+letter+'.tsv',expected)
    rows.extend(csv.DictReader(io.StringIO(text),delimiter='\t'))
(CACHE/'opening-rows.json').write_text(json.dumps(rows),encoding='utf-8')
subprocess.run(['node','tools/build-data.cjs'],cwd=ROOT,check=True)
