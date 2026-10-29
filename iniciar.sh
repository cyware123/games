#!/bin/sh
set -eu
cd "$(dirname "$0")"
printf '%s\n' 'Enroque: abre http://127.0.0.1:8765 y mantén esta terminal abierta.'
exec python3 -m http.server 8765 --bind 127.0.0.1
