#!/usr/bin/env bash
# Arranca el puente Roku de NEXO en Termux (o en Ubuntu dentro de Termux).
cd "$(dirname "$0")" || exit 1
# Evita que Android duerma Termux mientras el puente corre
for w in termux-wake-lock /data/data/com.termux/files/usr/bin/termux-wake-lock; do
  if command -v "$w" >/dev/null 2>&1 || [ -x "$w" ]; then "$w" 2>/dev/null; break; fi
done
if ! command -v python3 >/dev/null 2>&1; then
  echo "Falta Python. En Termux: pkg install python   ·   En Ubuntu: apt install python3"; exit 1
fi
exec python3 roku_bridge.py "$@"
