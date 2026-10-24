#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI «roku»: controla la TV desde la terminal. Reutiliza la clase Roku del puente."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import roku_bridge as rb  # noqa: E402

COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")
CIAN, MAGENTA, FIN = ("\033[36m", "\033[35m", "\033[0m") if COLOR else ("", "", "")

AYUDA = """%sroku%s · control de la TV Roku
  estado                 qué hace la TV ahora
  encender | apagar      energía
  vol+ [n] | vol- [n]    volumen por pasos (n veces, por defecto 3)
  mute                   silencio
  home | atras | ok      navegación
  arriba abajo izquierda derecha
  play | pausa           reproducción
  youtube netflix disney prime
  abrir <app>            cualquier app instalada
  apps                   lista las apps
  buscar <texto>         búsqueda global de la TV
  escribir <texto>       teclea en el campo activo
  ip [dirección]         ver o cambiar la IP de la TV""" % (CIAN, FIN)


def ok(t):
    print("%s✔ %s%s" % (CIAN, t, FIN))


def mal(t):
    print("%s✖ %s%s" % (MAGENTA, t, FIN), file=sys.stderr)


def num(a, defecto=3):
    return int(a[0]) if a and a[0].isdigit() else defecto


def main(av):
    if not av or av[0] in ("-h", "--help", "ayuda"):
        print(AYUDA)
        return 0
    c, a, r = av[0].lower(), av[1:], rb.Roku()
    try:
        if c == "estado":
            e = r.estado()
            print("%s%s%s · %s · %s" % (MAGENTA, e["nombre"], FIN, e["modelo"], e["ip"]))
            ok(e["hecho"])
        elif c == "apps":
            for x in r.apps()["apps"]:
                print("%s%8s%s  %s" % (MAGENTA, x["id"], FIN, x["nombre"]))
        elif c == "ip":
            if a:
                r.cfg["ip"] = a[0]
                rb.guardar_config(r.cfg)
            ok("IP de la TV: %s" % r.cfg["ip"])
        elif c in ("vol+", "vol-"):
            ok(r.volumen("subir" if c == "vol+" else "bajar", num(a))["hecho"])
        elif c == "mute":
            ok(r.volumen("mute")["hecho"])
        elif c in ("encender", "apagar"):
            ok(r.energia(c)["hecho"])
        elif c in ("play", "pausa"):
            ok(r.reproduccion(c)["hecho"])
        elif c in ("youtube", "netflix", "disney", "prime"):
            ok(r.app(c)["hecho"])
        elif c == "abrir" and a:
            ok(r.app(" ".join(a))["hecho"])
        elif c == "buscar" and a:
            ok(r.buscar(" ".join(a))["hecho"])
        elif c == "escribir" and a:
            ok(r.escribir(" ".join(a))["hecho"])
        elif c in ("home", "atras", "ok", "arriba", "abajo", "izquierda", "derecha"):
            ok(r.tecla(c)["hecho"])
        else:
            mal("No entendí «%s». Usa: roku ayuda" % " ".join(av))
            return 2
    except rb.RokuError as e:
        mal(e.mensaje)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
