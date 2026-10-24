#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Puente local de NEXO para controlar una TV Roku (ECP, puerto 8060).

Solo usa la librería estándar de Python 3. Escucha únicamente en 127.0.0.1.
La clase Roku también la usa la CLI (roku.py), así que la lógica no se duplica.
"""
import json
import os
import re
import socket
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RUTA_CONFIG = os.environ.get("ROKU_CONFIG", os.path.expanduser("~/.roku.json"))
DEFECTO = {
    "ip": "192.168.40.89",                      # IP de la TV
    "origen": "https://anyelmo27.github.io",    # dominio de NEXO (GitHub Pages); puede ser texto o lista
    "puerto": 8765,                             # puerto del puente en este celular
    "puerto_ecp": 8060,                         # puerto ECP de la TV
    "ssdp": "239.255.255.250:1900",             # dirección de búsqueda SSDP
}


# ---------------------------------------------------------------- utilidades
class RokuError(Exception):
    """Error con mensaje claro en español, un código corto y un estado HTTP."""

    def __init__(self, mensaje, codigo="error", http=502):
        super().__init__(mensaje)
        self.mensaje, self.codigo, self.http = mensaje, codigo, http


def norm(s):
    """Minúsculas, sin tildes ni signos: para comparar nombres."""
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+ ]", " ", s)).strip()


def cargar_config():
    cfg = dict(DEFECTO)
    try:
        with open(RUTA_CONFIG, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except FileNotFoundError:
        guardar_config(cfg)
    except (OSError, ValueError):
        pass
    return cfg


def guardar_config(cfg):
    try:
        with open(RUTA_CONFIG, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
    except OSError:
        pass


def descubrir(cfg, espera=2.5):
    """Busca la Roku por SSDP (M-SEARCH, ST: roku:ecp). Devuelve su IP o None."""
    try:
        host, puerto = cfg.get("ssdp", DEFECTO["ssdp"]).split(":")
        msg = ('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\n'
               "MX: 2\r\nST: roku:ecp\r\n\r\n").encode()
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.4)
        s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
        for _ in range(2):
            s.sendto(msg, (host, int(puerto)))
        fin = time.time() + espera
        while time.time() < fin:
            try:
                datos, dire = s.recvfrom(4096)
            except socket.timeout:
                continue
            txt = datos.decode("utf-8", "ignore")
            m = re.search(r"LOCATION:\s*http://([\d.]+)", txt, re.I)
            if m or re.search(r"roku", txt, re.I):
                s.close()
                return m.group(1) if m else dire[0]
        s.close()
    except OSError:
        pass
    return None


def xml_dict(b):
    """Convierte el XML plano de device-info en un diccionario."""
    return {e.tag: (e.text or "").strip() for e in ET.fromstring(b)}


# Teclas ECP y sus nombres en español
TECLAS = {
    "home": "Home", "inicio": "Home", "atras": "Back", "back": "Back", "volver": "Back",
    "ok": "Select", "select": "Select", "aceptar": "Select", "enter": "Enter",
    "arriba": "Up", "up": "Up", "abajo": "Down", "down": "Down",
    "izquierda": "Left", "left": "Left", "derecha": "Right", "right": "Right",
    "info": "Info", "opciones": "Info", "asterisco": "Info", "buscar": "Search", "search": "Search",
    "play": "Play", "pausa": "Play", "pause": "Play", "adelante": "Fwd", "fwd": "Fwd",
    "atrasar": "Rev", "rev": "Rev", "repetir": "InstantReplay", "replay": "InstantReplay",
    "borrar": "Backspace", "backspace": "Backspace",
    "canal+": "ChannelUp", "canal-": "ChannelDown", "channelup": "ChannelUp", "channeldown": "ChannelDown",
    "volumeup": "VolumeUp", "volumedown": "VolumeDown", "volumemute": "VolumeMute", "mute": "VolumeMute",
    "poweroff": "PowerOff", "poweron": "PowerOn", "power": "Power",
    "hdmi1": "InputHDMI1", "hdmi2": "InputHDMI2", "hdmi3": "InputHDMI3", "hdmi4": "InputHDMI4",
    "antena": "InputTuner", "tv": "InputTuner", "av1": "InputAV1",
}
APODOS = {  # nombre hablado -> palabra que debe contener la app
    "disney": "disney", "disney plus": "disney", "disney+": "disney", "prime": "prime", "prime video": "prime",
    "amazon": "prime", "amazon prime": "prime", "hbo": "max", "hbo max": "max", "max": "max", "yt": "youtube",
}


# ---------------------------------------------------------------- lógica Roku
class Roku:
    def __init__(self):
        self.cfg = cargar_config()
        self._apps, self._apps_t, self._busq_t = None, 0.0, 0.0
        self.cerrojo = threading.Lock()

    # --- red
    def base(self):
        return "http://%s:%d" % (self.cfg["ip"], int(self.cfg.get("puerto_ecp", 8060)))

    def redescubrir(self):
        """Busca la TV por SSDP (como máximo cada 20 s) y guarda la IP nueva."""
        if time.time() - self._busq_t < 20:
            return False
        self._busq_t = time.time()
        ip = descubrir(self.cfg)
        if ip and ip != self.cfg.get("ip"):
            self.cfg["ip"] = ip
            guardar_config(self.cfg)
            return True
        return bool(ip)

    def http(self, metodo, ruta, timeout=3.0, reintentar=True):
        req = urllib.request.Request(self.base() + ruta, data=b"" if metodo == "POST" else None, method=metodo)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 403:
                raise RokuError("La TV rechazó el control (403). En la TV: Ajustes, Sistema, Configuración avanzada, "
                                "Control por apps móviles, y ponlo en Permisivo.", "403", 403)
            if e.code == 404:
                raise RokuError("La TV no reconoce esa orden (404).", "404", 404)
            raise RokuError("La TV respondió con error %d." % e.code, "http_%d" % e.code, 502)
        except (urllib.error.URLError, OSError):
            if reintentar and self.redescubrir():
                return self.http(metodo, ruta, timeout, False)
            raise RokuError("No llego a la TV (%s). ¿Está encendida y en la misma WiFi?" % self.cfg["ip"], "sin_tv", 504)

    def tecla_cruda(self, k):
        self.http("POST", "/keypress/" + urllib.parse.quote(k, safe=""))

    # --- consultas
    def estado(self):
        d = xml_dict(self.http("GET", "/query/device-info"))
        modo = d.get("power-mode", "PowerOn")
        r = {"ok": True, "nombre": d.get("friendly-device-name") or d.get("user-device-name") or d.get("model-name", "Roku"),
             "modelo": d.get("model-name", ""), "ip": self.cfg["ip"], "encendida": modo == "PowerOn", "modo": modo,
             "app": None, "reproduciendo": None}
        if r["encendida"]:
            try:
                a = ET.fromstring(self.http("GET", "/query/active-app")).find("app")
                if a is not None:
                    r["app"] = (a.text or "").strip() or "Inicio"
            except (RokuError, ET.ParseError):
                pass
            try:
                p = ET.fromstring(self.http("GET", "/query/media-player"))
                st = p.get("state", "")
                if st and st != "close":
                    pl = p.find("plugin")
                    r["reproduciendo"] = {"estado": st, "app": pl.get("name") if pl is not None else r["app"],
                                          "posicion": (p.findtext("position") or "").strip()}
            except (RokuError, ET.ParseError):
                pass
        r["hecho"] = ("%s está %s" % (r["nombre"], "encendida" if r["encendida"] else "apagada (en espera)")
                      + (", en %s" % r["app"] if r["app"] else "")
                      + (" y está en %s" % ("reproducción" if r["reproduciendo"]["estado"] == "play" else "pausa") if r["reproduciendo"] else "") + ".")
        return r

    def apps(self):
        if self._apps is None or time.time() - self._apps_t > 60:
            raiz = ET.fromstring(self.http("GET", "/query/apps"))
            self._apps = [{"id": a.get("id"), "nombre": (a.text or "").strip()} for a in raiz.findall("app")]
            self._apps_t = time.time()
        return {"ok": True, "apps": self._apps, "hecho": "Tengo %d apps en la TV." % len(self._apps)}

    # --- acciones
    def tecla(self, nombre):
        n = norm(nombre).replace(" ", "")
        k = TECLAS.get(n) or next((v for v in TECLAS.values() if v.lower() == n), None)
        if not k:
            raise RokuError("No conozco la tecla «%s»." % nombre, "tecla_desconocida", 400)
        self.tecla_cruda(k)
        return {"ok": True, "tecla": k, "hecho": "Tecla %s enviada." % k}

    def volumen(self, accion, veces=1):
        a = norm(accion)
        try:
            veces = max(1, min(25, int(veces)))
        except (TypeError, ValueError):
            veces = 1
        if a in ("subir", "sube", "up", "mas", "+", "subele", "aumentar"):
            k, txt = "VolumeUp", "Subí el volumen %d %s." % (veces, "paso" if veces == 1 else "pasos")
        elif a in ("bajar", "baja", "down", "menos", "-", "bajale", "reducir"):
            k, txt = "VolumeDown", "Bajé el volumen %d %s." % (veces, "paso" if veces == 1 else "pasos")
        elif a in ("mute", "silencio", "silenciar", "mutear"):
            k, txt, veces = "VolumeMute", "Alterné el silencio de la TV.", 1
        else:
            raise RokuError("Acción de volumen no válida: usa subir, bajar o mute.", "accion_invalida", 400)
        for i in range(veces):
            self.tecla_cruda(k)
            if i < veces - 1:
                time.sleep(0.07)
        return {"ok": True, "veces": veces, "hecho": txt}

    def buscar_app(self, nombre):
        n = norm(nombre)
        n = APODOS.get(n, n)
        apps = self.apps()["apps"]
        for criterio in (lambda x: norm(x) == n, lambda x: norm(x).startswith(n), lambda x: n in norm(x), lambda x: n.replace("+", "") in norm(x).replace("+", "")):
            for a in apps:
                if criterio(a["nombre"]):
                    return a
        raise RokuError("No encontré la app «%s» en la TV." % nombre, "app_no_encontrada", 404)

    def app(self, nombre):
        a = self.buscar_app(nombre)
        self.http("POST", "/launch/" + urllib.parse.quote(str(a["id"]), safe=""))
        return {"ok": True, "app": a["nombre"], "id": a["id"], "hecho": "Abrí %s en la TV." % a["nombre"]}

    def buscar(self, texto):
        texto = str(texto or "").strip()
        if not texto:
            raise RokuError("Falta el texto a buscar.", "falta_texto", 400)
        self.http("POST", "/search/browse?keyword=" + urllib.parse.quote(texto, safe=""))
        return {"ok": True, "hecho": "Busqué «%s» en la TV." % texto}

    def escribir(self, texto):
        texto = str(texto or "")[:120]
        if not texto:
            raise RokuError("Falta el texto a escribir.", "falta_texto", 400)
        for ch in texto:
            self.tecla_cruda("Lit_" + ch)
            time.sleep(0.05)
        return {"ok": True, "hecho": "Escribí «%s» en la TV." % texto}

    def reproduccion(self, accion):
        a = norm(accion)
        if a in ("adelante", "avanzar", "forward"):
            self.tecla_cruda("Fwd")
            return {"ok": True, "hecho": "Adelanté."}
        if a in ("atras", "retroceder", "rewind"):
            self.tecla_cruda("Rev")
            return {"ok": True, "hecho": "Retrocedí."}
        if a not in ("play", "pausa", "pause", "reproducir", "continuar"):
            raise RokuError("Acción no válida: play, pausa, adelante o atrás.", "accion_invalida", 400)
        quiere_pausa = a in ("pausa", "pause")
        estado = None
        try:
            estado = ET.fromstring(self.http("GET", "/query/media-player")).get("state")
        except (RokuError, ET.ParseError):
            pass
        if quiere_pausa and estado in ("pause", "stop"):
            return {"ok": True, "hecho": "Ya estaba en pausa."}
        if not quiere_pausa and estado == "play":
            return {"ok": True, "hecho": "Ya se está reproduciendo."}
        self.tecla_cruda("Play")
        return {"ok": True, "hecho": "Puse pausa." if quiere_pausa else "Reproduciendo."}

    def energia(self, accion):
        a = norm(accion)
        if a in ("apagar", "apaga", "off"):
            self.tecla_cruda("PowerOff")
            return {"ok": True, "hecho": "Apagué la TV."}
        if a in ("encender", "enciende", "prender", "on"):
            self.tecla_cruda("PowerOn")
            return {"ok": True, "hecho": "Mandé la orden de encender. Si no prende, la TV no mantiene la red en espera."}
        raise RokuError("Acción de energía no válida: encender o apagar.", "accion_invalida", 400)

    def despachar(self, ruta, datos):
        """Une cada endpoint con su método. Devuelve un diccionario JSON."""
        with self.cerrojo:
            if ruta == "/estado":
                return self.estado()
            if ruta == "/apps":
                return self.apps()
            if ruta == "/tecla":
                return self.tecla(datos.get("tecla", ""))
            if ruta == "/volumen":
                return self.volumen(datos.get("accion", ""), datos.get("veces", 1))
            if ruta == "/app":
                return self.app(datos.get("nombre", ""))
            if ruta == "/buscar":
                return self.buscar(datos.get("texto"))
            if ruta == "/escribir":
                return self.escribir(datos.get("texto"))
            if ruta == "/reproduccion":
                return self.reproduccion(datos.get("accion", ""))
            if ruta == "/energia":
                return self.energia(datos.get("accion", ""))
        raise RokuError("Ruta desconocida.", "ruta", 404)


# ---------------------------------------------------------------- servidor HTTP
GET_OK = {"/estado", "/apps"}
POST_OK = {"/tecla", "/volumen", "/app", "/buscar", "/escribir", "/reproduccion", "/energia"}
ROKU = None


def origenes_permitidos():
    o = ROKU.cfg.get("origen", [])
    lista = o if isinstance(o, list) else [o]
    r = set()
    for x in lista:
        p = urllib.parse.urlparse(str(x).strip())
        if p.scheme and p.netloc:
            r.add("%s://%s" % (p.scheme, p.netloc.lower()))
    return r


def origen_valido(o):
    if not o:
        return True  # curl y la CLI no mandan Origin
    p = urllib.parse.urlparse(o)
    if p.scheme == "http" and p.hostname in ("127.0.0.1", "localhost"):
        return True
    return o.rstrip("/").lower() in origenes_permitidos()


class Manejador(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), fmt % a))

    def responder(self, codigo, obj):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        o = self.headers.get("Origin")
        if o and origen_valido(o):
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", self.headers.get("Access-Control-Request-Headers") or "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_OPTIONS(self):
        if not origen_valido(self.headers.get("Origin")):
            return self.responder(403, {"ok": False, "error": "Origen no permitido.", "codigo": "origen"})
        self.responder(204, {})

    def atender(self, metodo):
        if not origen_valido(self.headers.get("Origin")):
            return self.responder(403, {"ok": False, "error": "Origen no permitido: revisa «origen» en ~/.roku.json.", "codigo": "origen"})
        ruta = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        datos = {}
        if metodo == "POST":
            n = int(self.headers.get("Content-Length") or 0)
            if n > 20000:
                return self.responder(413, {"ok": False, "error": "Cuerpo demasiado grande.", "codigo": "grande"})
            if n:
                try:
                    datos = json.loads(self.rfile.read(n).decode("utf-8"))
                    if not isinstance(datos, dict):
                        raise ValueError
                except ValueError:
                    return self.responder(400, {"ok": False, "error": "JSON no válido.", "codigo": "json"})
        if ruta in ("/", "/ping"):
            return self.responder(200, {"ok": True, "servicio": "roku_bridge", "ip": ROKU.cfg["ip"]})
        if (metodo == "GET" and ruta not in GET_OK) or (metodo == "POST" and ruta not in POST_OK):
            return self.responder(404, {"ok": False, "error": "Ruta desconocida.", "codigo": "ruta"})
        try:
            self.responder(200, ROKU.despachar(ruta, datos))
        except RokuError as e:
            self.responder(e.http, {"ok": False, "error": e.mensaje, "codigo": e.codigo})
        except Exception as e:  # nunca tumbar el puente por un fallo raro
            self.responder(500, {"ok": False, "error": "Fallo interno del puente: %s" % e, "codigo": "interno"})

    def do_GET(self):
        self.atender("GET")

    def do_POST(self):
        self.atender("POST")


def main(argv):
    global ROKU
    ROKU = Roku()
    i = 0
    while i < len(argv):  # opciones: --ip X, --origen URL, --puerto N
        if argv[i] in ("--ip", "--origen", "--puerto") and i + 1 < len(argv):
            ROKU.cfg[argv[i][2:]] = int(argv[i + 1]) if argv[i] == "--puerto" else argv[i + 1]
            guardar_config(ROKU.cfg)
            i += 1
        i += 1
    puerto = int(ROKU.cfg.get("puerto", 8765))
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", puerto), Manejador)
    except OSError as e:
        print("No pude abrir 127.0.0.1:%d (%s). ¿Ya hay otro puente corriendo?" % (puerto, e))
        return 1
    srv.daemon_threads = True
    print("Puente Roku listo en http://127.0.0.1:%d  ·  TV: %s  ·  origen: %s" % (puerto, ROKU.cfg["ip"], ", ".join(sorted(origenes_permitidos())) or "(ninguno)"))
    print("Config: %s  ·  Ctrl+C para salir" % RUTA_CONFIG)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nPuente detenido.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
