#!/usr/bin/env bash
# Deja el comando "roku" disponible desde cualquier carpeta.
DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="${PREFIX:-$HOME/.local}/bin"
mkdir -p "$DEST"
printf '#!/usr/bin/env bash\nexec python3 "%s/roku.py" "$@"\n' "$DIR" > "$DEST/roku"
chmod +x "$DEST/roku" "$DIR/start_bridge.sh" "$DIR/roku_bridge.py" "$DIR/roku.py"
case ":$PATH:" in *":$DEST:"*) ;; *) echo "export PATH=\"$DEST:\$PATH\"" >> "$HOME/.bashrc"; echo "Añadí $DEST al PATH: cierra y abre la terminal.";; esac
echo "Listo. Prueba: roku estado"
