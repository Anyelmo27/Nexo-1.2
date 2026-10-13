// NEXO AI v0.9 — holograma estilo Jarvis con IA (Gemini en streaming), voz, micrófono, cámara y agente local del PC.
(function () {
  "use strict";
  var NOMBRE = "Anyel";
  var MODELOS = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-flash-latest"], TTS = "gemini-3.1-flash-tts-preview";
  var API = "https://generativelanguage.googleapis.com/v1beta/models/", AG = "http://127.0.0.1:8765/accion";
  function $(id) { return document.getElementById(id); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function R() { return Math.random(); }
  function lim(x, a, b) { return Math.min(b, Math.max(a, +x)); }

  // ---------- Estados (paleta cálida tipo Jarvis) ----------
  function S(n, amp, rad, spd, br, wave, c) { return { n: n, amp: amp, rad: rad, spd: spd, br: br, wave: wave, c: c }; }
  var E = {
    reposo:     S("Reposo",     .6,  1,    .8,  .8,  .15, [1,.42,.06, 1,.72,.22, .85,.2,.02]),
    escucha:    S("Escucha",    .8,  1.06, .9,  1,   .1,  [1,.55,.1, 1,.85,.35, .95,.35,.05]),
    procesando: S("Procesando", 1.2, .92,  2.2, 1,   .5,  [1,.35,.05, 1,.9,.5, 1,.6,.1]),
    respuesta:  S("Respuesta",  .85, 1,    1.2, 1,   1,   [1,.5,.08, 1,.85,.4, .95,.3,.05]),
    feliz:      S("Feliz",      1,   1.04, 1.4, 1,   .7,  [1,.6,.1, 1,.92,.45, 1,.45,.05]),
    preocupado: S("Preocupado", .8,  .95,  .7,  .85, .2,  [.85,.3,.1, 1,.55,.3, .6,.12,.12]),
    error:      S("Error",      1.3, .98,  .5,  .95, 0,   [.95,.1,.2, 1,.4,.35, .6,.05,.25])
  };
  var K = ["amp", "rad", "spd", "br", "wave"];
  var actual = "reposo", v = { c: E.reposo.c.slice() }, tinte = null, emo = null;
  K.forEach(function (k) { v[k] = E.reposo[k]; });
  var etiqueta = $("estado");
  function fijar(c) { if (!E[c]) return false; actual = c; etiqueta.textContent = E[c].n; return true; }

  // ---------- Formas ----------
  var MAX = 16000;
  function esf() { var z = R() * 2 - 1, th = R() * 6.2832, r = Math.sqrt(1 - z * z); return [Math.cos(th) * r, Math.sin(th) * r, z]; }
  function poligono(P) {
    var xs = P.map(function (p) { return p[0]; }), ys = P.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    var k = 1.8 / Math.max(x1 - x0, y1 - y0, 1e-6), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var Q = P.map(function (p) { return [(p[0] - cx) * k, (p[1] - cy) * k]; }), n = Q.length;
    function dentro(x, y) { var c = false; for (var i = 0, j = n - 1; i < n; j = i++) if ((Q[i][1] > y) !== (Q[j][1] > y) && x < (Q[j][0] - Q[i][0]) * (y - Q[i][1]) / (Q[j][1] - Q[i][1]) + Q[i][0]) c = !c; return c; }
    return function () {
      if (R() < .35) { var i = (R() * n) | 0, a = Q[i], b = Q[(i + 1) % n], u = R(); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, (R() - .5) * .18]; }
      for (var t = 0; t < 40; t++) { var x = (R() * 2 - 1) * .9, y = (R() * 2 - 1) * .9; if (dentro(x, y)) return [x, y, (R() - .5) * .3]; }
      return [0, 0, 0];
    };
  }
  var estrellaPts = []; for (var si = 0; si < 10; si++) estrellaPts.push([(si % 2 ? .42 : 1) * Math.cos(Math.PI / 2 + si * Math.PI / 5), (si % 2 ? .42 : 1) * Math.sin(Math.PI / 2 + si * Math.PI / 5)]);
  var FORMAS = {
    esfera: esf,
    cubo: function () { var p = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1], a = (R() * 3) | 0; p[a] = p[a] < 0 ? -1 : 1; return p.map(function (x) { return x * .64; }); },
    toroide: function () { var u = R() * 6.2832, w = R() * 6.2832, q = .72 + .28 * Math.cos(w); return [q * Math.cos(u), q * Math.sin(u), .28 * Math.sin(w)]; },
    corazon: function () { var t = R() * 6.2832, s = Math.sqrt(R()), x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [x / 18 * s, (y + 2.5) / 18 * s, (R() - .5) * .55 * Math.sqrt(1 - s * s * .8)]; },
    estrella: poligono(estrellaPts),
    galaxia: function () { var a = (R() * 2 | 0) * Math.PI, r = Math.pow(R(), .75), t = r * 5.5 + a + (R() - .5) * .6; return [r * Math.cos(t), r * Math.sin(t) * .5 + (R() - .5) * .08, r * Math.sin(t) * .6]; },
    piramide: function () { var c = (R() * 4) | 0, a = [0, .8, 0], b = [[-.7,-.5,-.7],[.7,-.5,-.7],[.7,-.5,.7],[-.7,-.5,.7]], p = b[c], q = b[(c + 1) % 4], u = R(), w = R(); if (u + w > 1) { u = 1 - u; w = 1 - w; } return [0, 1, 2].map(function (i) { return a[i] + (p[i] - a[i]) * u + (q[i] - a[i]) * w; }); },
    cilindro: function () { var u = R() * 6.2832; if (R() < .2) { var r = Math.sqrt(R()) * .55, y = R() < .5 ? -.8 : .8; return [r * Math.cos(u), y, r * Math.sin(u)]; } return [.55 * Math.cos(u), (R() * 2 - 1) * .8, .55 * Math.sin(u)]; },
    adn: function () { var t = R() * 2 - 1, a = t * 9; if (R() < .2) { var s = R() * 2 - 1; return [.5 * Math.cos(a) * s, t * .95, .5 * Math.sin(a) * s]; } var f = R() < .5 ? 0 : Math.PI; return [.5 * Math.cos(a + f), t * .95, .5 * Math.sin(a + f)]; },
    anillo: function () { var u = R() * 6.2832, r = .85 + (R() - .5) * .1; return [r * Math.cos(u), r * Math.sin(u), (R() - .5) * .1]; }
  };
  var ALIAS = { bola: "esfera", circulo: "esfera", caja: "cubo", toro: "toroide", dona: "toroide", rosquilla: "toroide", espiral: "galaxia", helice: "adn", aro: "anillo" };
  var rnd = new Float32Array(MAX * 2); for (var ri = 0; ri < MAX * 2; ri++) rnd[ri] = R();
  function generar(g) { var a = new Float32Array(MAX * 3); for (var i = 0; i < MAX; i++) { var p = g(); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; } return a; }
  var src = generar(esf), tgt = src, morph = 1, rough = 1, roughT = 1, crisp = 0, crispT = 0, swirl = 1, swirlT = 1, rotK = 1, rotT = 1, relojOn = false, retorno = 0, ultHora = "";

  // ---------- WebGL ----------
  var VS = [
    "attribute vec2 aR;attribute vec3 aS,aT;",
    "uniform float uT,uAsp,uScale,uAmp,uRad,uWave,uPulse,uDPR,uSwap,uPS,uGlitch,uMorph,uRough,uOff,uCrisp,uSwirl;",
    "uniform vec2 uRot,uPtr,uFlip;uniform vec3 uC1,uC2,uC3;",
    "varying vec3 vC;varying float vA;",
    "void main(){",
    " float t=uT;",
    " float m=smoothstep(0.,1.,clamp(uMorph*1.5-aR.x*.5,0.,1.));",
    " vec3 d0=mix(aS,aT,m);",
    " float sw=t*(.25+.3*uAmp)*(1.3-length(d0.xz))*uSwirl;float cs=cos(sw),sn=sin(sw);",
    " vec3 d=vec3(cs*d0.x-sn*d0.z,d0.y,sn*d0.x+cs*d0.z);",
    " vec3 w=vec3(sin(d.y*2.6+t*.55+aR.y*6.283),sin(d.z*2.4-t*.47+aR.y*4.),sin(d.x*2.8+t*.4+aR.y*5.))",
    "  +.5*vec3(sin(d.z*5.1+t*.9),sin(d.x*4.7-t*.8),sin(d.y*5.3+t*.7));",
    " float shell=.82+uRough*.5*aR.x*aR.x*aR.x+(1.-uRough)*.1*aR.x;",
    " shell=mix(shell,.95,uCrisp);",
    " float pulse=1.+uPulse*.1+uWave*.05*sin(t*6.5+d.y*4.+aR.y*2.);",
    " vec3 p=d*uRad*shell*pulse+w*.07*uAmp*(1.-.8*uCrisp);",
    " p+=normalize(d+vec3(.001))*uPulse*.45*step(.965,aR.y);",
    " float cy=cos(uRot.x),sy=sin(uRot.x),cx=cos(uRot.y),sx=sin(uRot.y);",
    " p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);",
    " p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);",
    " float pe=1.7/(2.4-p.z);",
    " vec2 s=p.xy*pe*uScale+vec2(0.,uOff);",
    " vec2 sd=s-uPtr;float dist=length(sd);",
    " s+=sd/(dist+.001)*exp(-dist*dist*7.)*.1;",
    " vec2 q=vec2(s.x/uAsp,s.y);",
    " q.x+=uGlitch*sin(s.y*55.+t*90.)*.03*step(.6,fract(sin(floor(s.y*14.+t*30.))*437.5));",
    " if(uSwap>.5)q=q.yx;q*=uFlip;gl_Position=vec4(q,0.,1.);",
    " vA=mix(.25,1.,(p.z+1.)*.5)*(.7+.3*sin(t*2.5+aR.y*40.));",
    " vA=mix(vA,.95,uCrisp*.85);",
    " gl_PointSize=(1.5+2.4*aR.x)*pe*uDPR*uPS;",
    " vC=mix(mix(uC1,uC2,d.y*.5+.5),uC3,.5+.5*sin(d.x*3.+t*.3+aR.y*6.283));",
    "}"
  ].join("\n");
  var FS = [
    "precision mediump float;varying vec3 vC;varying float vA;uniform float uBr,uInt;",
    "void main(){float r=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(0.,1.,r);",
    " a*=a*vA*uBr*uInt*.6;vec3 c=vC*a;gl_FragColor=vec4(c,max(c.r,max(c.g,c.b)));}"
  ].join("\n");
  var cv = $("lienzo"), U = {}, listo = false, buf = null;
  var gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  function compilar(tipo, s) { var h = gl.createShader(tipo); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(h)); return null; } return h; }
  function subir() {
    var d = new Float32Array(MAX * 8);
    for (var i = 0; i < MAX; i++) { d[i * 8] = rnd[i * 2]; d[i * 8 + 1] = rnd[i * 2 + 1]; d.set(src.subarray(i * 3, i * 3 + 3), i * 8 + 2); d.set(tgt.subarray(i * 3, i * 3 + 3), i * 8 + 5); }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
  }
  function iniciar() {
    var vs = compilar(gl.VERTEX_SHADER, VS), fs = compilar(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(pr)); return false; }
    gl.useProgram(pr); buf = gl.createBuffer(); subir();
    [["aR", 2, 0], ["aS", 3, 8], ["aT", 3, 20]].forEach(function (a) { var l = gl.getAttribLocation(pr, a[0]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, a[1], gl.FLOAT, false, 32, a[2]); });
    ["uT","uAsp","uScale","uAmp","uRad","uWave","uPulse","uDPR","uSwap","uPS","uGlitch","uMorph","uRough","uOff","uCrisp","uSwirl","uRot","uPtr","uFlip","uC1","uC2","uC3","uBr","uInt"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clearColor(0, 0, 0, 0);
    return true;
  }
  if (!gl) etiqueta.textContent = "Este navegador no admite WebGL: no se puede dibujar el holograma";
  else if (!(listo = iniciar())) etiqueta.textContent = "Error al compilar el shader: abre la consola (F12)";
  var asp = 1, dpr = 1;
  function ajustar() { if (!gl) return; dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.max(2, Math.round(cv.clientWidth * dpr)); cv.height = Math.max(2, Math.round(cv.clientHeight * dpr)); asp = cv.width / cv.height; gl.viewport(0, 0, cv.width, cv.height); }
  window.addEventListener("resize", ajustar); ajustar();
  function aplicar(g, rg, cr, opt) {
    opt = opt || {};
    if (!opt.reloj) { relojOn = false; clearTimeout(retorno); }
    src = tgt; tgt = generar(g); subir(); morph = 0; roughT = rg; crispT = cr; swirlT = cr > .5 ? 0 : 1; rotT = cr > .5 ? .1 : 1;
    if (opt.segundos > 0) retorno = setTimeout(function () { setForma("esfera"); }, Math.min(opt.segundos, 600) * 1000);
    return { ok: true };
  }
  function setForma(n, pts) {
    var k = String(n || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); k = ALIAS[k] || k;
    var g = FORMAS[k];
    if (!g && pts && pts.length >= 3 && pts.length <= 200 && pts.every(function (p) { return p && isFinite(p[0]) && isFinite(p[1]); })) g = poligono(pts);
    if (!g) return { ok: false, error: "No conozco esa forma. Usa escribir_con_particulas (palabras, números, la hora), forma_con_emoji (objetos y animales) o forma_con_trazo (un dibujo en SVG)." };
    return aplicar(g, k === "esfera" ? 1 : .3, 0);
  }
  // Convierte cualquier cosa dibujada en un canvas en una nube de puntos (relleno + contorno)
  function desdePixeles(pinta, W, H, det) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d", { willReadFrequently: true }); pinta(x, W, H);
    var d = x.getImageData(0, 0, W, H).data, F = [], B = [], x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, px, py;
    function on(a2, b2) { return a2 >= 0 && b2 >= 0 && a2 < W && b2 < H && d[(b2 * W + a2) * 4 + 3] > 110; }
    var lum = null, thr = -1;
    if (det) {
      lum = new Float32Array(W * H); var ys = [];
      for (py = 0; py < H; py++) for (px = 0; px < W; px++) { var q = (py * W + px) * 4; if (d[q + 3] > 110) { var l = .3 * d[q] + .59 * d[q + 1] + .11 * d[q + 2]; lum[py * W + px] = l; ys.push(l); } else lum[py * W + px] = -1; }
      ys.sort(function (m1, m2) { return m1 - m2; }); thr = (ys[ys.length >> 1] || 0) * .55;
    }
    for (py = 0; py < H; py++) for (px = 0; px < W; px++) if (on(px, py)) {
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      var borde = !on(px - 1, py) || !on(px + 1, py) || !on(px, py - 1) || !on(px, py + 1), oscuro = false;
      if (det) {
        var l0 = lum[py * W + px], lr = px + 1 < W ? lum[py * W + px + 1] : -1, ld = py + 1 < H ? lum[(py + 1) * W + px] : -1;
        oscuro = l0 < thr; if ((lr >= 0 && Math.abs(l0 - lr) > 70) || (ld >= 0 && Math.abs(l0 - ld) > 70)) borde = true;
      }
      if (!oscuro) F.push(px, py); if (borde) B.push(px, py);
    }
    if (F.length < 40) return null;
    var k = 1.8 / Math.max(x1 - x0, y1 - y0, 1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, nF = F.length / 2, nB = B.length / 2;
    return function () {
      var useB = nB > 0 && R() < .3, L = useB ? B : F, j = ((R() * (useB ? nB : nF)) | 0) * 2;
      return [(L[j] + R() - .5 - cx) * k, -(L[j + 1] + R() - .5 - cy) * k, (R() - .5) * .05];
    };
  }
  function textoGen(txt) {
    var L = String(txt == null ? "" : txt).replace(/\r/g, "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4);
    if (!L.length) return null;
    return desdePixeles(function (x, W, H) {
      var fam = "800 PXpx system-ui, 'Segoe UI', Roboto, 'Noto Sans', Arial, sans-serif", fs = 220, ancho = 0;
      x.font = fam.replace("PX", fs); L.forEach(function (s) { ancho = Math.max(ancho, x.measureText(s).width); });
      fs = Math.max(20, Math.min(fs * (W * .94) / Math.max(ancho, 1), (H * .94) / (L.length * 1.15)));
      x.font = fam.replace("PX", Math.round(fs)); x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
      L.forEach(function (s, i) { x.fillText(s, W / 2, H / 2 + (i - (L.length - 1) / 2) * fs * 1.15); });
    }, 1024, 512);
  }
  function emojiGen(e) {
    e = String(e || "").trim().slice(0, 12); if (!e) return null;
    return desdePixeles(function (x, W, H) { x.font = Math.round(H * .78) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(e, W / 2, H / 2 + H * .04); }, 400, 400, true);
  }
  function trazoGen(d, rel) {
    var p; try { p = new Path2D(String(d || "").slice(0, 6000)); } catch (er) { return null; }
    return desdePixeles(function (x, W, H) { x.scale(W / 100, H / 100); x.fillStyle = "#fff"; x.strokeStyle = "#fff"; x.lineWidth = 2.4; x.lineJoin = "round"; x.lineCap = "round"; if (rel !== false) x.fill(p); x.stroke(p); }, 400, 400);
  }
  function horaPartes() {
    var s = new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/[  ]/g, " "), i = s.indexOf(" ");
    return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ""];
  }
  function horaTexto() { var p = horaPartes(); return p[0] + (p[1] ? "\n" + p[1] : ""); }
  function mostrarHora() {
    var t = horaTexto(), g = textoGen(t); if (!g) return false;
    clearTimeout(retorno); ultHora = t; relojOn = true; aplicar(g, .3, 1, { reloj: true, segundos: 45 }); return true;
  }
  function horaHablada() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes(), h12 = h % 12 || 12, per = h < 12 ? "de la mañana" : h < 19 ? "de la tarde" : "de la noche";
    return (h12 === 1 ? "Es la " : "Son las ") + h12 + (m === 0 ? " en punto" : " y " + m) + " " + per + ".";
  }
  setInterval(function () { if (!relojOn) return; var t = horaTexto(); if (t !== ultHora) { var g = textoGen(t); if (g) { ultHora = t; aplicar(g, .3, 1, { reloj: true }); } } }, 4000);

  // ---------- Bucle de dibujo ----------
  var ptr = [0, 0], pos = [9, 9], pS = [0, 0], pulso = 0;
  window.addEventListener("pointermove", function (e) { ptr[0] = e.clientX / innerWidth * 2 - 1; ptr[1] = e.clientY / innerHeight * 2 - 1; pos[0] = ptr[0] * asp; pos[1] = -ptr[1]; });
  window.addEventListener("pointerdown", function () { pulso = 1; });
  var reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var holo = false, inv = false, inten = +ls("nexo_inten") || 2.4, tam = .3, dist = .04, cuenta = 10000, velU = 1, escU = 1;
  var ult = 0, t = 0, ang = 0, acum = 0, cuadros = 0, pp = [9, 9], glitch = 0, sigG = 5, sigP = 2, fr = 0, raiz = document.documentElement;
  var VISTAS = [[0, 1, -1, 1, 0], [0, -1, 1, -1, 0], [1, 0, 1, 1, 1], [-1, 0, -1, -1, 1]];
  var ac = null, anS = null, anM = null, b1 = new Uint8Array(256), b2 = new Uint8Array(256), hablando = false, grabando = false, hablo = false, ultV = 0, t0 = 0, grab = null, fuente = null, pendNav = 0, streaming = false;
  function audio() { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); anS = ac.createAnalyser(); anS.fftSize = 256; gv = ac.createGain(); gv.gain.value = volV; anS.connect(gv); gv.connect(ac.destination); anM = ac.createAnalyser(); anM.fftSize = 256; } if (ac.state === "suspended") ac.resume(); return ac; }
  function nv(an, b) { an.getByteTimeDomainData(b); var s = 0; for (var i = 0; i < b.length; i++) { var x = (b[i] - 128) / 128; s += x * x; } return Math.sqrt(s / b.length); }

  function dibujar(now) {
    requestAnimationFrame(dibujar);
    if (!listo || document.hidden) return;
    var dt = Math.min((now - ult) / 1000, .1); ult = now;
    acum += dt; if (++cuadros === 90) { if (acum / 90 > .028 && cuenta > 1500) cuenta = Math.round(cuenta * .8); acum = 0; cuadros = 0; }
    var e = E[actual], k = 1 - Math.pow(.05, dt), tc = (tinte && actual !== "error" && actual !== "preocupado") ? tinte : e.c;
    K.forEach(function (n) { v[n] += (e[n] - v[n]) * k; });
    for (var i = 0; i < 9; i++) v.c[i] += (tc[i] - v.c[i]) * k;
    rough += (roughT - rough) * k; morph = Math.min(1, morph + dt / 1.6);
    pulso -= pulso * 3 * dt;
    var nvl = 0; if (hablando && anS) nvl = nv(anS, b1); if (pendNav > 0) nvl = Math.max(nvl, .1 + .08 * Math.abs(Math.sin(t * 9)));
    if (grabando && anM) { var lm = nv(anM, b2); nvl = Math.max(nvl, lm); if (now - t0 < 450) piso = Math.max(piso * .9, lm); else { umbral = Math.max(.02, Math.min(.12, piso * 2.2)); if (lm > umbral) { hablo = true; ultV = now; } } if ((hablo && now - ultV > 1300) || (!hablo && now - t0 > 9000) || now - t0 > 30000) detenerMic(true); }
    if (nvl > .01) pulso = Math.max(pulso, Math.min(1.2, nvl * 5));
    sigP -= dt; if (sigP < 0) { pulso = Math.max(pulso, .35); sigP = 2 + R() * 3; }
    var f = reducido ? .2 : 1;
    t += dt * (.6 + .5 * v.spd * velU) * f; ang += v.spd * velU * .22 * dt * f;
    pS[0] += (ptr[0] - pS[0]) * .05; pS[1] += (ptr[1] - pS[1]) * .05;
    pp[0] += (pos[0] - pp[0]) * .2; pp[1] += (pos[1] - pp[1]) * .2;
    if (++fr % 8 === 0) raiz.style.setProperty("--rgb", Math.round(v.c[3] * 255) + "," + Math.round(v.c[4] * 255) + "," + Math.round(v.c[5] * 255));
    sigG -= dt; if (sigG < 0) { glitch = reducido ? 0 : 1; sigG = 4 + R() * 5; }
    glitch -= glitch * 7 * dt; if (glitch < .02) glitch = 0;
    crisp += (crispT - crisp) * k; swirl += (swirlT - swirl) * k; rotK += (rotT - rotK) * k;
    var wS = lim((rough - .3) / .7, 0, 1), rx = (ang * wS + Math.sin(ang * .8) * .75 * (1 - wS)) * rotK;
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uAmp, v.amp); gl.uniform1f(U.uRad, v.rad); gl.uniform1f(U.uWave, v.wave * f);
    gl.uniform1f(U.uPulse, pulso); gl.uniform1f(U.uDPR, dpr); gl.uniform1f(U.uBr, v.br * (1 + .04 * Math.sin(t * 40)));
    gl.uniform1f(U.uCrisp, crisp); gl.uniform1f(U.uSwirl, swirl); gl.uniform1f(U.uInt, (holo ? inten * 1.35 : inten) * (1 + .4 * crisp)); gl.uniform1f(U.uGlitch, glitch); gl.uniform1f(U.uMorph, morph); gl.uniform1f(U.uRough, rough);
    gl.uniform2f(U.uRot, rx + pS[0] * .6 * (1 - .7 * crisp), pS[1] * .4 * (1 - .7 * crisp));
    gl.uniform3f(U.uC1, v.c[0], v.c[1], v.c[2]); gl.uniform3f(U.uC2, v.c[3], v.c[4], v.c[5]); gl.uniform3f(U.uC3, v.c[6], v.c[7], v.c[8]);
    var tp = 1 + .25 * (inten - 1);
    gl.disable(gl.SCISSOR_TEST); gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!holo) {
      gl.uniform1f(U.uAsp, asp); gl.uniform1f(U.uScale, Math.min(.55, asp * .9) * escU); gl.uniform1f(U.uOff, .44); gl.uniform2f(U.uPtr, pp[0], pp[1]);
      gl.uniform2f(U.uFlip, 1, 1); gl.uniform1f(U.uSwap, 0); gl.uniform1f(U.uPS, tp);
      gl.drawArrays(gl.POINTS, 0, cuenta);
    } else {
      var W = cv.width, H = cv.height, m = Math.min(W, H), q = Math.round(m * tam), off = q / 2 + m * dist, sg = inv ? -1 : 1;
      gl.enable(gl.SCISSOR_TEST);
      gl.uniform1f(U.uAsp, 1); gl.uniform1f(U.uScale, escU); gl.uniform1f(U.uOff, 0); gl.uniform2f(U.uPtr, 9, 9); gl.uniform1f(U.uPS, Math.max(.7, q / 460) * tp);
      VISTAS.forEach(function (w) {
        var x = Math.round(W / 2 + w[0] * off - q / 2), y = Math.round(H / 2 + w[1] * off - q / 2);
        gl.viewport(x, y, q, q); gl.scissor(x, y, q, q);
        gl.uniform2f(U.uFlip, w[2] * sg, w[3] * sg); gl.uniform1f(U.uSwap, w[4]);
        gl.drawArrays(gl.POINTS, 0, cuenta);
      });
    }
  }
  requestAnimationFrame(dibujar);

  // ---------- Controles ----------
  var bHolo = $("holo"), selVoz = $("voz"), raizEl = document.documentElement;
  function ponerHolo(on) {
    holo = on; document.body.classList.toggle("holo", on); bHolo.textContent = on ? "Salir del modo holograma (H)" : "Modo holograma (H)";
    try { var p = on ? (!document.fullscreenElement && raizEl.requestFullscreen && raizEl.requestFullscreen()) : (document.fullscreenElement && document.exitFullscreen()); if (p && p.catch) p.catch(function () {}); } catch (er) {}
  }
  bHolo.addEventListener("click", function () { ponerHolo(!holo); });
  $("inv").addEventListener("click", function () { inv = !inv; });
  $("inten").value = inten; $("inten").addEventListener("input", function (ev) { inten = +ev.target.value; ls("nexo_inten", String(inten)); });
  $("cant").addEventListener("input", function (ev) { cuenta = +ev.target.value; });
  $("tam").addEventListener("input", function (ev) { tam = +ev.target.value; });
  $("dist").addEventListener("input", function (ev) { dist = +ev.target.value; });
  if (ls("nexo_voz")) selVoz.value = ls("nexo_voz");
  selVoz.addEventListener("change", function () { ls("nexo_voz", selVoz.value); });
  window.addEventListener("keydown", function (ev) { if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT" || ev.ctrlKey || ev.metaKey || ev.altKey) return; if (ev.key === "h" || ev.key === "H") ponerHolo(!holo); });

  // ---------- Herramientas: holograma (locales) y PC (agente) ----------
  function mezcla(a, b, u) { return [0, 1, 2].map(function (i) { return a[i] + (b[i] - a[i]) * u; }); }
  function hex(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
  function paleta(cs) { var a = hex(cs[0]), b = cs[1] ? hex(cs[1]) : mezcla(a, [1, 1, 1], .45), c = cs[2] ? hex(cs[2]) : (cs[1] ? mezcla(a, b, .5) : a.map(function (x) { return x * .55; })); return a.concat(b, c); }
  function local(n, a) {
    a = a || {};
    if (n === "cambiar_color") { var c = (a.colores || []).filter(function (h) { return /^#?[0-9a-f]{6}$/i.test(h); }); if (!c.length) return { ok: false, error: "Color no válido" }; tinte = paleta(c.slice(0, 3)); return { ok: true }; }
    if (n === "cambiar_forma") return setForma(a.nombre, a.puntos);
    if (n === "ajustar") {
      if (a.restablecer) { tinte = null; velU = 1; escU = 1; inten = 2.4; cuenta = 10000; $("inten").value = 2.4; $("cant").value = 10000; setForma("esfera"); return { ok: true }; }
      if (isFinite(a.brillo)) { inten = lim(a.brillo, .6, 4); $("inten").value = inten; }
      if (isFinite(a.velocidad)) velU = lim(a.velocidad, .2, 3);
      if (isFinite(a.tamano)) escU = lim(a.tamano, .5, 1.5);
      if (isFinite(a.particulas)) { cuenta = Math.round(lim(a.particulas, 2000, MAX)); $("cant").value = cuenta; }
      return { ok: true };
    }
    if (n === "escribir_con_particulas") { var gt = textoGen(a.texto); if (!gt) return { ok: false, error: "No pude dibujar ese texto" }; return Object.assign(aplicar(gt, .3, 1, { segundos: +a.segundos || 0 }), { hecho: "Listo." }); }
    if (n === "mostrar_hora") { if (!mostrarHora()) return { ok: false, error: "No pude dibujar la hora" }; return { ok: true, hecho: horaHablada() }; }
    if (n === "forma_con_emoji") { var ge = emojiGen(a.emoji); if (!ge) return { ok: false, error: "Ese emoji no se pudo dibujar en este dispositivo. Prueba otro o usa forma_con_trazo." }; return Object.assign(aplicar(ge, .3, .85), { hecho: "Listo." }); }
    if (n === "forma_con_trazo") { var gz = trazoGen(a.trazo, a.relleno); if (!gz) return { ok: false, error: "El trazo SVG no es válido. Envía solo los datos d de un path en una caja de 0 a 100." }; return Object.assign(aplicar(gz, .3, .85), { hecho: "Listo." }); }
    if (n === "linterna") return linterna(a.estado !== "apagar");
    if (n === "bateria") return bateria();
    if (n === "vibrar") { if (!navigator.vibrate) return { ok: false, error: "Este navegador no permite vibrar." }; navigator.vibrate(lim(a.ms || 300, 20, 2000)); return { ok: true, hecho: "Listo." }; }
    if (n === "ubicacion") return ubicacion();
    if (n === "compartir") return compartir(a);
    if (n === "copiar") return copiar(a.texto);
    if (n === "abrir_app_movil") return abrirMovil(a.app, a.texto);
    if (n === "volumen_voz") { volV = lim((+a.nivel) / 100, 0, 1); ls("nexo_vol", String(volV)); if (gv) gv.gain.value = volV; return { ok: true, hecho: "Mi voz quedó al " + Math.round(volV * 100) + " por ciento." }; }
    if (n === "brillo_app") { var nb = lim(+a.nivel, 10, 100); ls("nexo_brillo", String(nb)); velo(nb); return { ok: true, hecho: "Brillo de la app al " + Math.round(nb) + " por ciento." }; }
    if (n === "recordar") return recordar(a.dato);
    if (n === "olvidar") return olvidar(a.texto);
    if (n === "palabra_clave") return cambiarPalabra(a.palabra);
    if (n === "sentir") { if (E[a.emocion]) { emo = a.emocion; return { ok: true }; } return { ok: false, error: "Emoción desconocida" }; }
    return { ok: false, error: "Herramienta desconocida" };
  }
  var token = ls("nexo_token") || "";
  function pedirToken() { var k = window.prompt("Pega el token del agente de NEXO (el agente lo copió al portapapeles al encenderse):", token); if (k && k.trim()) { token = k.trim(); ls("nexo_token", token); } return token; }
  $("tok").addEventListener("click", pedirToken);
  function agente(n, a) {
    if (!token && !pedirToken()) return Promise.resolve({ ok: false, error: "Falta el token del agente." });
    return fetch(AG, { method: "POST", headers: { "Content-Type": "application/json", "X-Nexo-Token": token }, body: JSON.stringify(Object.assign({ accion: n }, a || {})) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.error === "Token inválido.") { token = ""; ls("nexo_token", null); } return j; })
      .catch(function () { var o = location.origin, bien = /^http:\/\/(127\.0\.0\.1|localhost):55(0[0-5])$/.test(o); return { ok: false, error: bien ? "No llego al agente de NEXO. Ábrelo con iniciar-agente.bat y deja su ventana abierta." : "Esta página está en " + o + " y el agente solo acepta http://127.0.0.1:5500 (Live Server). Ábrela desde ahí, no como archivo ni desde otra dirección." }; });
  }
  var PC = { abrir_app: 1, abrir_ruta: 1, listar_carpeta: 1, crear_carpeta: 1, escribir_archivo: 1, bloc_de_notas: 1, leer_archivo: 1, excel_crear: 1 }, NECESITA = { listar_carpeta: 1, leer_archivo: 1 };
  function ejecutar(n, a) { return PC[n] ? agente(n, a) : Promise.resolve(local(n, a)); }
  function P(props, req) { return { type: "object", properties: props, required: req || [] }; }
  var TOOLS = [{ functionDeclarations: [
    { name: "cambiar_color", description: "Cambia el color del holograma.", parameters: P({ colores: { type: "array", items: { type: "string" }, description: "1 a 3 colores hexadecimales, por ejemplo #ff3366" } }, ["colores"]) },
    { name: "cambiar_forma", description: "Transforma las partículas en una forma. Disponibles: esfera, cubo, toroide, corazon, estrella, galaxia, piramide, cilindro, adn, anillo. Para otra forma envía también el contorno en puntos.", parameters: P({ nombre: { type: "string" }, puntos: { type: "array", items: { type: "array", items: { type: "number" } }, description: "Contorno cerrado de 20 a 60 vértices [x,y] entre -1 y 1, con y positivo hacia arriba" } }, ["nombre"]) },
    { name: "ajustar", description: "Ajusta brillo (0.6 a 3), velocidad (0.2 a 3), tamano (0.5 a 1.5), particulas (2000 a 16000) o restablece todo.", parameters: P({ brillo: { type: "number" }, velocidad: { type: "number" }, tamano: { type: "number" }, particulas: { type: "number" }, restablecer: { type: "boolean" } }) },
    { name: "sentir", description: "Expresa una emoción con el holograma.", parameters: P({ emocion: { type: "string", enum: ["reposo", "escucha", "procesando", "respuesta", "feliz", "preocupado", "error"] } }, ["emocion"]) },
    { name: "abrir_app", description: "Abre una aplicación del PC.", parameters: P({ nombre: { type: "string", enum: ["bloc de notas", "calculadora", "explorador", "excel", "word", "paint"] } }, ["nombre"]) },
    { name: "abrir_ruta", description: "Abre una carpeta en el Explorador o un archivo en su programa. Rutas: Escritorio, Documentos, Descargas, NEXO o una ruta dentro del usuario.", parameters: P({ ruta: { type: "string" } }, ["ruta"]) },
    { name: "listar_carpeta", description: "Lista el contenido de una carpeta.", parameters: P({ ruta: { type: "string" } }, ["ruta"]) },
    { name: "crear_carpeta", description: "Crea una carpeta en Escritorio, Documentos o Descargas.", parameters: P({ ruta: { type: "string" } }, ["ruta"]) },
    { name: "escribir_archivo", description: "Crea un archivo de texto (txt, md, csv, json, html) o añade texto a uno existente. Nunca sobrescribe.", parameters: P({ ruta: { type: "string" }, contenido: { type: "string" }, modo: { type: "string", enum: ["crear", "anadir"] }, abrir: { type: "boolean" } }, ["ruta", "contenido"]) },
    { name: "bloc_de_notas", description: "Escribe un texto en una nota nueva y la abre en el Bloc de notas.", parameters: P({ texto: { type: "string" }, titulo: { type: "string" } }, ["texto"]) },
    { name: "leer_archivo", description: "Lee un archivo de texto (txt, md, csv, json, log) para responder sobre su contenido.", parameters: P({ ruta: { type: "string" } }, ["ruta"]) },
    { name: "excel_crear", description: "Crea una hoja de Excel (.xlsx) con una tabla y la abre. Las filas son listas de celdas; un texto que empiece por = es una fórmula.", parameters: P({ ruta: { type: "string" }, filas: { type: "array", items: { type: "array", items: { type: "string" } } }, abrir: { type: "boolean" } }, ["ruta", "filas"]) }
  ] }];
  var SYS = { parts: [{ text: "Eres NEXO, el asistente personal holográfico de " + NOMBRE + ", con el estilo sereno y eficiente de Jarvis. Hablas en español natural y breve: una a tres frases, porque tu respuesta se lee en voz alta. Nada de markdown, listas ni emojis. Controlas tu cuerpo de partículas con cambiar_color, cambiar_forma, ajustar y sentir, y el PC con abrir_app, abrir_ruta, listar_carpeta, crear_carpeta, escribir_archivo, bloc_de_notas, leer_archivo y excel_crear. Cuando uses una herramienta, acompáñala siempre con una frase corta. No tienes forma de borrar nada: si te lo piden, dilo. Si una herramienta falla, cuéntalo con claridad y no digas que lo lograste. Usa sentir para reflejar tu emoción cuando encaje. Si el mensaje es de voz, respóndelo directamente. Si recibes una imagen de la cámara, descríbela solo si te preguntan." }] };

  TOOLS[0].functionDeclarations.forEach(function (f) { if (f.name === "cambiar_forma") f.description += " Si piden algo que no está en la lista (una palabra, un animal, un objeto, un dibujo), usa escribir_con_particulas, forma_con_emoji o forma_con_trazo."; });
  TOOLS[0].functionDeclarations.push(
    { name: "escribir_con_particulas", description: "Forma con las partículas cualquier palabra, frase, número o cifra. Usa \\n para separar líneas (máximo 4 líneas cortas). segundos opcional: tras ese tiempo vuelven a la esfera.", parameters: P({ texto: { type: "string" }, segundos: { type: "number" } }, ["texto"]) },
    { name: "mostrar_hora", description: "Muestra la hora actual escrita con las partículas (se actualiza sola)." },
    { name: "forma_con_emoji", description: "Convierte las partículas en la silueta de cualquier objeto, animal o símbolo usando UN emoji, por ejemplo 🐶 🚗 🌹 🚀 🏠.", parameters: P({ emoji: { type: "string" } }, ["emoji"]) },
    { name: "forma_con_trazo", description: "Dibuja cualquier forma con un trazo SVG. trazo = datos d de un path dentro de una caja de 0 a 100 en x e y (y crece hacia abajo). relleno=false deja solo el contorno.", parameters: P({ trazo: { type: "string" }, relleno: { type: "boolean" } }, ["trazo"]) },
    { name: "linterna", description: "Enciende o apaga la linterna del celular.", parameters: P({ estado: { type: "string", enum: ["encender", "apagar"] } }, ["estado"]) },
    { name: "bateria", description: "Consulta el nivel de batería del dispositivo." },
    { name: "vibrar", description: "Hace vibrar el celular unos milisegundos.", parameters: P({ ms: { type: "number" } }) },
    { name: "ubicacion", description: "Obtiene la ubicación aproximada del usuario (pide permiso)." },
    { name: "compartir", description: "Abre el menú de compartir del celular con un texto o enlace.", parameters: P({ texto: { type: "string" }, url: { type: "string" } }) },
    { name: "copiar", description: "Copia un texto al portapapeles.", parameters: P({ texto: { type: "string" } }, ["texto"]) },
    { name: "abrir_app_movil", description: "Abre una app o servicio en el celular: youtube, maps, spotify, whatsapp, telegram, instagram, tiktok, facebook, x, gmail, google, netflix, llamada, sms. texto = búsqueda, número de teléfono o mensaje.", parameters: P({ app: { type: "string" }, texto: { type: "string" } }, ["app"]) },
    { name: "volumen_voz", description: "Cambia el volumen de la voz de NEXO (0 a 100). No cambia el volumen del sistema.", parameters: P({ nivel: { type: "number" } }, ["nivel"]) },
    { name: "brillo_app", description: "Cambia el brillo de la pantalla de NEXO (10 a 100) oscureciendo la app. El brillo del sistema del celular no se puede cambiar desde una web.", parameters: P({ nivel: { type: "number" } }, ["nivel"]) },
    { name: "recordar", description: "Guarda en tu memoria un dato duradero sobre el usuario (nombre, gustos, rutinas, lo que pida recordar).", parameters: P({ dato: { type: "string" } }, ["dato"]) },
    { name: "olvidar", description: "Borra de tu memoria los datos que contengan ese texto.", parameters: P({ texto: { type: "string" } }, ["texto"]) },
    { name: "palabra_clave", description: "Cambia la palabra con la que el usuario te llama por voz (por defecto nexo).", parameters: P({ palabra: { type: "string" } }, ["palabra"]) }
  );
  NECESITA.bateria = 1; NECESITA.ubicacion = 1;
  SYS.parts[0].text += " Respondes como un asistente de voz: una frase corta y directa. Tus partículas pueden formar cualquier cosa: para palabras, números o la hora usa escribir_con_particulas o mostrar_hora; para objetos y animales usa forma_con_emoji; para un dibujo propio usa forma_con_trazo; nunca digas que no puedes formar algo. Del celular puedes: linterna, bateria, vibrar, ubicacion, compartir, copiar, abrir_app_movil, volumen_voz y brillo_app. Si piden cambiar el brillo o el volumen del sistema del celular, explica que desde una web no es posible y ofrece cambiar tu propio brillo o el volumen de tu voz. Usa recordar cuando el usuario te cuente algo duradero o te pida recordarlo.";
  function sysAhora() {
    var t = new Date().toLocaleString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(/[  ]/g, " ");
    return { parts: [{ text: SYS.parts[0].text + "\nAhora mismo: " + t + "." + (mem.length ? "\nLo que recuerdas del usuario:\n- " + mem.join("\n- ") : "") }] };
  }
  var ENPC = /^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(location.origin) || location.protocol === "file:";
  if (!ENPC) {
    TOOLS[0].functionDeclarations = TOOLS[0].functionDeclarations.filter(function (f) { return !PC[f.name]; });
    SYS.parts[0].text += " Ahora mismo estás en un celular o en una web sin agente: no tienes herramientas del PC, y si te piden algo del PC dilo con claridad.";
  }

  // ---------- Gemini en streaming ----------
  var clave = ls("nexo_clave") || "", modeloIdx = 0, hist = cargarHist(), pensar = true;
  function errHTTP(r) { return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error((j.error && j.error.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }); }
  function stream(contents, alTexto, k) {
    k = k || 0; var mi = (modeloIdx + k) % MODELOS.length;
    var g = { temperature: .8, maxOutputTokens: 1500 }; if (pensar) g.thinkingConfig = { thinkingLevel: "minimal" };
    return fetch(API + MODELOS[mi] + ":streamGenerateContent?alt=sse", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": clave }, body: JSON.stringify({ systemInstruction: sysAhora(), contents: contents, tools: TOOLS, generationConfig: g }) })
      .then(function (r) {
        if (!r.ok) return errHTTP(r);
        var rd = r.body.getReader(), dec = new TextDecoder(), bf = "", partes = [];
        function procesar(bloque) {
          bloque.split("\n").forEach(function (l) {
            if (l.indexOf("data:") !== 0) return; var tx = l.slice(5).trim(); if (!tx) return; var j; try { j = JSON.parse(tx); } catch (e) { return; }
            var c = j.candidates && j.candidates[0];
            if (!c) { if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error("Bloqueado: " + j.promptFeedback.blockReason); return; }
            ((c.content && c.content.parts) || []).forEach(function (p) { partes.push(p); if (p.text && !p.thought) alTexto(p.text); });
          });
        }
        function leer() {
          return rd.read().then(function (x) {
            if (x.done) { procesar(bf + "\n\n"); if (!partes.length) throw new Error("Sin respuesta del modelo"); return partes; }
            bf += dec.decode(x.value, { stream: true }).replace(/\r\n/g, "\n"); var i;
            while ((i = bf.indexOf("\n\n")) >= 0) { procesar(bf.slice(0, i)); bf = bf.slice(i + 2); }
            return leer();
          });
        }
        return leer();
      })
      .catch(function (e) {
        if (e.status === 400 && pensar && /think/i.test(e.message)) { pensar = false; return stream(contents, alTexto, k); }
        if (e.status === 404 && modeloIdx < MODELOS.length - 1) { modeloIdx++; return stream(contents, alTexto, 0); }
        if ((e.status === 503 || e.status === 500 || e.status === 429 || e.status === 504) && k < MODELOS.length * 2 - 1) {
          return new Promise(function (ok) { setTimeout(ok, k >= MODELOS.length - 1 ? 2500 : 400); }).then(function () { return stream(contents, alTexto, k + 1); });
        }
        throw e;
      });
  }

  // ---------- Voz ----------
  var tm = [];
  function limpiarTm() { tm.forEach(clearTimeout); tm = []; }
  function b64Pcm(b64) { var s = atob(b64), n = s.length >> 1, f = new Float32Array(n); for (var i = 0; i < n; i++) { var x = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8); if (x >= 32768) x -= 65536; f[i] = x / 32768; } return f; }
  function detenerVoz() { if (fuente) { try { fuente.onended = null; fuente.stop(); } catch (e) {} fuente = null; } hablando = false; pendNav = 0; if (window.speechSynthesis) speechSynthesis.cancel(); }
  function fin() { if (pendNav > 0 || hablando || streaming || grabando || escuchando || actual === "procesando") return; fijar("reposo"); if (conv) programarEscucha(700); else if (wakeOn) programarWake(900); }
  var vozNav = ls("nexo_vozn") || "", volV = ls("nexo_vol") === null ? 1 : lim(+ls("nexo_vol"), 0, 1), gv = null;
  function vocesEs() { return (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(function (x) { return /^es/i.test(x.lang); }); }
  function elegirVoz() {
    var vs = vocesEs(); if (!vs.length) return null;
    var s = vs.filter(function (x) { return x.voiceURI === vozNav; })[0]; if (s) return s;
    function pts(x) { var p = 0; if (/natural|neural|online/i.test(x.name)) p += 6; if (/google/i.test(x.name)) p += 3; if (/es[-_](CO|MX|US|419)/i.test(x.lang)) p += 2; else if (/es[-_]ES/i.test(x.lang)) p += 1; if (x.localService === false) p += 1; return p; }
    return vs.slice().sort(function (a2, b2) { return pts(b2) - pts(a2); })[0];
  }
  function frase(txt, cb) {
    if (!window.speechSynthesis || !txt.trim()) { if (cb) setTimeout(cb, 250); else setTimeout(fin, 300); return; }
    var u = new SpeechSynthesisUtterance(txt), mejor = elegirVoz(); if (mejor) u.voice = mejor; u.lang = mejor ? mejor.lang : "es-ES"; u.rate = 1.03; u.pitch = 1; u.volume = volV;
    var cerrado = false; function cerrar() { if (cerrado) return; cerrado = true; pendNav = Math.max(0, pendNav - 1); fin(); if (cb) cb(); }
    u.onboundary = function () { pulso = Math.max(pulso, .7); }; u.onend = u.onerror = cerrar; setTimeout(cerrar, 3500 + txt.length * 110);
    pendNav++; speechSynthesis.speak(u);
  }
  function hablarGemini(txt) {
    var a = audio();
    return fetch(API + TTS + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": clave }, body: JSON.stringify({ contents: [{ parts: [{ text: "Di de forma natural, cálida y fluida: " + txt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selVoz.value } } } } }) })
      .then(function (r) { return r.ok ? r.json() : errHTTP(r); })
      .then(function (j) {
        var d = j.candidates[0].content.parts[0].inlineData, f = b64Pcm(d.data), m = /rate=(\d+)/.exec(d.mimeType || ""), bf = a.createBuffer(1, f.length, m ? +m[1] : 24000);
        bf.copyToChannel(f, 0); var s = a.createBufferSource(); s.buffer = bf; s.connect(anS); hablando = true; s.onended = function () { hablando = false; fin(); }; fuente = s; s.start();
      }).catch(function (e) { console.warn("Voz de Gemini no disponible:", e.message); frase(txt); });
  }

  // ---------- Conversación ----------
  var chat = $("chat"), form = $("formulario"), entrada = $("entrada"), ocupado = false;
  function msg(clase, texto) { var d = document.createElement("div"); d.className = "m " + clase; d.textContent = texto; chat.appendChild(d); while (chat.children.length > 60) chat.removeChild(chat.firstChild); chat.scrollTop = chat.scrollHeight; return d; }
  function pedirClave() { var k = window.prompt("Pega tu clave de la API de Gemini. Se guarda solo en este navegador:", clave); if (k && k.trim()) { clave = k.trim(); ls("nexo_clave", clave); } return clave; }
  $("clave").addEventListener("click", pedirClave);
  function fotograma() {
    var vid = $("cam"); if (!camOn || !vid.videoWidth) return null;
    var c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * vid.videoHeight / vid.videoWidth);
    c.getContext("2d").drawImage(vid, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .7).split(",")[1];
  }
  function turno(partes, burbuja, ub) {
    var contents = hist.concat([{ role: "user", parts: partes }]), ronda = 0, total = "", buffer = "", usarNav = selVoz.value === "Navegador" && $("vozon").checked;
    function sacar(todo) {
      if (!usarNav) return;
      var m; while ((m = /^([\s\S]{8,}?[.!?…])\s/.exec(buffer))) { frase(m[1].replace(/[*_`#]/g, "")); buffer = buffer.slice(m[0].length); }
      if (buffer.length > 90 && (m = /^([\s\S]{50,}?[,;:])\s/.exec(buffer))) { frase(m[1].replace(/[*_`#]/g, "")); buffer = buffer.slice(m[0].length); }
      if (todo && buffer.trim()) { frase(buffer.replace(/[*_`#]/g, "")); buffer = ""; }
    }
    var tr = ub ? { buf: "", ok: false } : null;
    function alTexto(d) {
      if (tr && !tr.ok) {
        tr.buf += d; var s = tr.buf.replace(/^\s+/, "");
        if (s.length < 2) return;
        if (s.slice(0, 2) !== "[[") { tr.ok = true; d = tr.buf; }
        else { var ci = s.indexOf("]]"); if (ci < 0) { if (s.length < 500) return; tr.ok = true; d = tr.buf; } else { ultTrans = s.slice(2, ci).trim(); if (ultTrans) ub.textContent = ultTrans; tr.ok = true; d = s.slice(ci + 2).replace(/^\s+/, ""); if (!d) return; } }
      }
      if (!total) { fijar(emo || "respuesta"); } total += d; buffer += d; burbuja.textContent = total; chat.scrollTop = chat.scrollHeight; sacar(false); }
    function paso() {
      return stream(contents, alTexto).then(function (ps) {
        if (tr && !tr.ok) { tr.ok = true; if (tr.buf.trim()) alTexto(tr.buf); }
        var calls = ps.filter(function (p) { return p.functionCall; });
        if (!calls.length) { sacar(true); return total; }
        if (total) { total += "\n"; buffer += " "; }
        return Promise.all(calls.map(function (p) { return ejecutar(p.functionCall.name, p.functionCall.args); })).then(function (res) {
          var fallo = res.some(function (r) { return r && r.ok === false; }), datos = calls.some(function (p) { return NECESITA[p.functionCall.name]; });
          if ((fallo || datos) && ronda++ < 2) {
            contents.push({ role: "model", parts: ps });
            contents.push({ role: "user", parts: calls.map(function (p, i) { return { functionResponse: { name: p.functionCall.name, response: res[i] || { ok: false } } }; }) });
            return paso();
          }
          if (!total) { total = res.map(function (r) { return r && r.hecho; }).filter(Boolean).join(" ") || "Listo."; buffer = total; burbuja.textContent = total; }
          sacar(true); return total;
        });
      });
    }
    return paso();
  }
  function enviar(txt, aud, opt) {
    if (ocupado) return;
    if (txt && rapido(txt)) return;
    pararWake();
    if (!clave && !pedirClave()) { msg("e", "Necesito tu clave de Gemini para pensar."); return; }
    ocupado = true; emo = null; limpiarTm(); detenerVoz(); audio(); streaming = true; fijar("procesando"); pulso = 1.2;
    var ub = msg("u", txt || "🎤 …");
    var burbuja = msg("n", "…"), partes = [], img = fotograma();
    if (aud) partes.push({ inlineData: { mimeType: aud.mime, data: aud.data } });
    if (txt) partes.push({ text: txt });
    if (aud && !txt) partes.push({ text: "(Mensaje de voz del usuario. Empieza tu respuesta con la transcripción literal entre dobles corchetes, así: [[lo que dijo]], y a continuación respóndele normalmente.)" });
    if (img) partes.push({ inlineData: { mimeType: "image/jpeg", data: img } });
    ultTrans = ""; turno(partes, burbuja, aud && !txt ? ub : null).then(function (r) {
      ocupado = false; streaming = false; r = (r || "Listo.").trim(); burbuja.textContent = r;
      hist.push({ role: "user", parts: [{ text: txt || ultTrans || "(mensaje de voz)" }] }, { role: "model", parts: [{ text: r }] }); if (hist.length > 16) hist = hist.slice(-16); ls("nexo_hist", JSON.stringify(hist));
      if (!/^(respuesta|feliz|preocupado)$/.test(actual)) fijar(emo || "respuesta"); pulso = 1;
      if ($("vozon").checked && selVoz.value !== "Navegador") hablarGemini(r.replace(/[*_`#]/g, "")); else tm.push(setTimeout(fin, pendNav ? 20000 : 1500));
    }).catch(function (e) {
      ocupado = false; streaming = false; fijar("error"); pulso = 1; var m = e.message || String(e);
      if (/API key|API_KEY|permission|403|401/i.test(m)) { clave = ""; ls("nexo_clave", null); m = "La clave de Gemini no es válida. Pulsa Enviar para ponerla de nuevo."; }
      else if (e.status === 503 || /high demand|overloaded/i.test(m)) m = "Los modelos de Gemini están saturados ahora mismo. Inténtalo de nuevo en un minuto."
      else if (e.status === 429) m = "Se alcanzó el límite gratuito de Gemini. Espera un momento e inténtalo otra vez.";
      burbuja.className = "m e"; burbuja.textContent = m; tm.push(setTimeout(function () { fijar("reposo"); if (conv) programarEscucha(300); }, 5000));
    });
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault(); var s = entrada.value.trim(); if (!s) return; entrada.value = "";
    if (s.indexOf("/estado ") === 0) { limpiarTm(); var c = s.slice(8).trim().toLowerCase(); msg("n", fijar(c) ? "Estado: " + E[c].n + " (prueba manual)" : "Estado desconocido"); return; }
    enviar(s);
  });
  entrada.addEventListener("input", function () { pulso = Math.max(pulso, .6); if (entrada.value && actual === "reposo") fijar("escucha"); if (!entrada.value && actual === "escucha") fijar("reposo"); });
  msg("n", "Hola, " + NOMBRE + ". Escríbeme o pulsa el micrófono.");

  // ---------- Micrófono ----------
  function aWav(bufs, rate) {
    var n = 0; bufs.forEach(function (b) { n += b.length; }); var m = new Float32Array(n), o = 0; bufs.forEach(function (b) { m.set(b, o); o += b.length; });
    var r = rate / 16000, L = Math.floor(n / r), pcm = new Int16Array(L);
    for (var i = 0; i < L; i++) { var a = Math.floor(i * r), b = Math.min(n, Math.floor((i + 1) * r)), s = 0; for (var j = a; j < b; j++) s += m[j]; pcm[i] = lim(s / Math.max(1, b - a), -1, 1) * 32767; }
    var h = new DataView(new ArrayBuffer(44)); function w(p, s) { for (var q = 0; q < s.length; q++) h.setUint8(p + q, s.charCodeAt(q)); }
    w(0, "RIFF"); h.setUint32(4, 36 + L * 2, true); w(8, "WAVEfmt "); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true); h.setUint32(24, 16000, true); h.setUint32(28, 32000, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, "data"); h.setUint32(40, L * 2, true);
    var bytes = new Uint8Array(44 + L * 2); bytes.set(new Uint8Array(h.buffer), 0); bytes.set(new Uint8Array(pcm.buffer), 44);
    var bin = ""; for (var z = 0; z < bytes.length; z += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(z, z + 0x8000));
    return { mime: "audio/wav", data: btoa(bin) };
  }
  // ---- Motor 1: reconocimiento del navegador (rápido, con subtítulos en vivo)
  // ---- Motor 2: grabación + Gemini entiende el audio (si el motor 1 no existe o falla)
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var motorMic = (ls("nexo_mic") === "grab" || !SR) ? "grab" : "sr";
  var conv = false, escuchando = false, abriendo = false, sr = null, srCancel = false, sinVoz = 0, wl = null, tEsc = 0, ultTrans = "", piso = .01, umbral = .03;
  function marcarConv() { var b = $("bconv"); b.classList.toggle("on", conv); b.setAttribute("aria-pressed", conv ? "true" : "false"); }
  function pantalla(on) {
    try {
      if (on && navigator.wakeLock && !wl) navigator.wakeLock.request("screen").then(function (l) { wl = l; l.addEventListener("release", function () { wl = null; }); }).catch(function () {});
      if (!on && wl) { wl.release(); wl = null; }
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && conv) { pantalla(true); programarEscucha(500); } });
  function apagarConv(texto) { if (!conv) return; conv = false; clearTimeout(tEsc); marcarConv(); pantalla(false); if (texto) msg("n", texto); }
  function programarEscucha(ms) {
    clearTimeout(tEsc); if (!conv) return;
    tEsc = setTimeout(function () {
      if (!conv) return;
      if (document.hidden) return;
      if (!ocupado && !escuchando && !grabando && !abriendo && !hablando && !pendNav && actual === "reposo") escuchar(); else programarEscucha(500);
    }, ms || 600);
  }
  function sinEntrada() {
    fijar("reposo");
    if (conv) {
      if (document.hidden) return;
      if (++sinVoz >= 2) { apagarConv("No te oigo, así que apagué el modo conversación. Pulsa el ícono de ondas para retomarlo."); return; }
      programarEscucha(300); return;
    }
    if (wakeOn) { programarWake(600); return; }
    msg("e", "No te escuché. Acércate al micrófono e inténtalo de nuevo.");
  }
  function mensajeMic(e) {
    var n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return "Permiso de micrófono denegado. Actívalo en los ajustes del navegador para este sitio y vuelve a intentarlo.";
    if (n === "NotFoundError") return "No encuentro ningún micrófono en este dispositivo.";
    if (n === "NotReadableError") return "Otra aplicación está usando el micrófono. Ciérrala e inténtalo de nuevo.";
    return "No pude abrir el micrófono: " + ((e && e.message) || n || "error desconocido");
  }
  function iniciarSR() {
    var r = new SR(), fin_ = "", int_ = "", err = "";
    sr = r; srCancel = false;
    r.lang = /^es/i.test(navigator.language || "") ? navigator.language : "es-ES";
    r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onstart = function () { escuchando = true; fijar("escucha"); $("bmic").classList.add("on"); };
    r.onresult = function (ev) {
      fin_ = ""; int_ = "";
      for (var i = 0; i < ev.results.length; i++) { var t = ev.results[i][0].transcript; if (ev.results[i].isFinal) fin_ += t; else int_ += t; }
      pulso = Math.max(pulso, .8); etiqueta.textContent = "Escucho: " + (fin_ + int_).slice(-70);
    };
    r.onerror = function (ev) { err = (ev && ev.error) || "error"; };
    r.onend = function () {
      if (sr !== r) return; sr = null; escuchando = false; $("bmic").classList.remove("on");
      if (srCancel) { fijar("reposo"); return; }
      var txt = (fin_ + int_).trim();
      if (txt) { sinVoz = 0; enviar(txt, null, { voz: true }); return; }
      if (err === "not-allowed") { fijar("error"); apagarConv(); msg("e", mensajeMic({ name: "NotAllowedError" })); return; }
      if (err === "audio-capture") { fijar("error"); apagarConv(); msg("e", mensajeMic({ name: "NotFoundError" })); return; }
      if (err === "network" || err === "service-not-allowed" || err === "language-not-supported") {
        motorMic = "grab"; ls("nexo_mic", "grab"); fijar("reposo");
        msg("n", "El reconocimiento del navegador no está disponible aquí. Cambio a mi propia escucha con Gemini."); escuchar(); return;
      }
      sinEntrada();
    };
    r.start();
  }
  function iniciarGrabacion() {
    var a = audio(); abriendo = true;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (st) {
      abriendo = false;
      var s = a.createMediaStreamSource(st), pr = a.createScriptProcessor(4096, 1, 1), bufs = [];
      pr.onaudioprocess = function (e) { bufs.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      s.connect(anM); s.connect(pr); pr.connect(a.destination);
      grab = { st: st, src: s, pr: pr, bufs: bufs, rate: a.sampleRate }; grabando = true; hablo = false; piso = 0; t0 = performance.now(); fijar("escucha"); $("bmic").classList.add("on");
    }).catch(function (e) { abriendo = false; fijar("error"); apagarConv(); msg("e", mensajeMic(e)); });
  }
  function escuchar() {
    if (escuchando || grabando || abriendo || ocupado) return;
    if (!window.isSecureContext) { fijar("error"); apagarConv(); msg("e", "El micrófono solo funciona en una página segura (https o localhost). Abre NEXO desde su dirección de GitHub Pages."); return; }
    pararWake(); audio(); detenerVoz(); limpiarTm();
    if (motorMic === "sr" && SR) { try { iniciarSR(); return; } catch (er) { sr = null; escuchando = false; motorMic = "grab"; } }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fijar("error"); apagarConv(); msg("e", "Este navegador no permite usar el micrófono."); return; }
    iniciarGrabacion();
  }
  function detenerMic(env) {
    if (!grabando) return; grabando = false; $("bmic").classList.remove("on"); var g = grab; grab = null;
    try { g.pr.onaudioprocess = null; g.pr.disconnect(); g.src.disconnect(); } catch (er) {}
    g.st.getTracks().forEach(function (x) { x.stop(); });
    if (!env) { fijar("reposo"); return; }
    if (!hablo) { sinEntrada(); return; }
    sinVoz = 0; enviar("", aWav(g.bufs, g.rate), { voz: true });
  }
  $("bmic").addEventListener("click", function () {
    if (escuchando && sr) { try { sr.stop(); } catch (er) {} return; }
    if (grabando) { detenerMic(true); return; }
    if (ocupado || abriendo) return;
    escuchar();
  });
  $("bconv").addEventListener("click", function () {
    if (conv) {
      apagarConv("Modo conversación apagado.");
      if (sr) { srCancel = true; try { sr.abort(); } catch (er) {} } else if (grabando) detenerMic(false);
      return;
    }
    conv = true; sinVoz = 0; marcarConv(); pantalla(true); audio();
    msg("n", "Modo conversación activado. Habla cuando quieras; te respondo y sigo escuchando.");
    if (!ocupado) escuchar();
  });

  // ---------- Cámara ----------
  var camOn = false, camSt = null;
  $("bcam").addEventListener("click", function () {
    var vid = $("cam");
    if (camOn) { camSt.getTracks().forEach(function (x) { x.stop(); }); camOn = false; vid.style.display = "none"; $("bcam").classList.remove("on"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } } }).then(function (st) {
      camSt = st; vid.srcObject = st; vid.play(); vid.style.display = "block"; camOn = true; $("bcam").classList.add("on");
    }).catch(function (e) { fijar("error"); msg("e", "No pude abrir la cámara: " + (e.name === "NotAllowedError" ? "permiso denegado en el navegador" : e.message)); });
  });

  // ---------- Atajos locales (sin gastar una llamada a Gemini) ----------
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim(); }
  function decir(txt, cb) {
    if (!$("vozon").checked) { if (cb) setTimeout(cb, 300); else tm.push(setTimeout(fin, 1200)); return; }
    if (selVoz.value === "Navegador") frase(txt, cb); else { hablarGemini(txt); }
  }
  function mostrarResultado(j) {
    var t = (j && (j.hecho || j.error)) || "Listo."; msg(j && j.ok === false ? "e" : "n", t);
    fijar(j && j.ok === false ? "error" : "respuesta"); pulso = 1;
    if (j && j.ok === false) tm.push(setTimeout(function () { fijar("reposo"); }, 4000)); else decir(t);
  }
  function rapido(s) {
    var m = norm(s); if (m.length > 60) return false;
    if (/^(oye |nexo )?(por favor )?(que hora es|que horas son|que hora tienes|dime la hora|dame la hora|me dices la hora|muestrame la hora|muestra la hora|la hora|hora)( ahora| por favor| actual)?$/.test(m)) {
      msg("u", s); mostrarHora(); var t = horaHablada(); msg("n", t); fijar("respuesta"); pulso = 1; decir(t); return true;
    }
    var lin = /^(por favor )?(enciende|prende|activa|pon|prender|encender)( la| mi)? linterna( por favor)?$/.test(m) ? 1 : /^(por favor )?(apaga|desactiva|quita|apagar)( la| mi)? linterna( por favor)?$/.test(m) ? 0 : -1;
    if (lin >= 0) { msg("u", s); linterna(!!lin).then(mostrarResultado); return true; }
    if (/^(cuanta bateria (tengo|me queda)|nivel de bateria|cuanta carga (tengo|me queda)|bateria)$/.test(m)) { msg("u", s); bateria().then(mostrarResultado); return true; }
    return false;
  }

  // ---------- Celular: linterna, batería, ubicación, compartir, enlaces ----------
  var linSt = null;
  function linterna(on) {
    if (!on) { if (linSt) { linSt.getTracks().forEach(function (x) { x.stop(); }); linSt = null; } return Promise.resolve({ ok: true, hecho: "Linterna apagada." }); }
    if (linSt) return Promise.resolve({ ok: true, hecho: "La linterna ya estaba encendida." });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve({ ok: false, error: "Este navegador no permite usar la linterna." });
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } }).then(function (st) {
      var tr = st.getVideoTracks()[0], cap = (tr && tr.getCapabilities) ? tr.getCapabilities() : {};
      if (!cap.torch) { st.getTracks().forEach(function (x) { x.stop(); }); return { ok: false, error: "Este celular o navegador no deja controlar la linterna desde la web." }; }
      return tr.applyConstraints({ advanced: [{ torch: true }] }).then(function () { linSt = st; return { ok: true, hecho: "Linterna encendida." }; });
    }).catch(function (e) { return { ok: false, error: (e && e.name === "NotAllowedError") ? "Permiso de cámara denegado; la linterna lo necesita." : "No pude encender la linterna: " + ((e && (e.message || e.name)) || "error") }; });
  }
  function bateria() {
    if (!navigator.getBattery) return Promise.resolve({ ok: false, error: "Este navegador no informa la batería." });
    return navigator.getBattery().then(function (b) { var n = Math.round(b.level * 100); return { ok: true, nivel: n, cargando: !!b.charging, hecho: "Batería al " + n + " por ciento" + (b.charging ? " y cargando." : ".") }; }).catch(function () { return { ok: false, error: "No pude leer la batería." }; });
  }
  function ubicacion() {
    if (!navigator.geolocation) return Promise.resolve({ ok: false, error: "Este navegador no da la ubicación." });
    return new Promise(function (ok) {
      navigator.geolocation.getCurrentPosition(function (p) { ok({ ok: true, latitud: +p.coords.latitude.toFixed(5), longitud: +p.coords.longitude.toFixed(5), precision_metros: Math.round(p.coords.accuracy), hecho: "Ubicación obtenida." }); },
        function (e) { ok({ ok: false, error: e && e.code === 1 ? "Permiso de ubicación denegado." : "No pude obtener la ubicación." }); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });
  }
  function copiar(t) {
    t = String(t || ""); if (!t) return Promise.resolve({ ok: false, error: "No hay nada que copiar." });
    if (!navigator.clipboard) return Promise.resolve({ ok: false, error: "Este navegador no deja copiar." });
    return navigator.clipboard.writeText(t).then(function () { return { ok: true, hecho: "Copiado." }; }).catch(function () { return { ok: false, error: "El navegador bloqueó copiar; toca la pantalla e inténtalo de nuevo." }; });
  }
  function compartir(a) {
    if (!navigator.share) return copiar((a.texto || "") + (a.url ? " " + a.url : ""));
    return navigator.share({ text: a.texto || "", url: a.url || undefined }).then(function () { return { ok: true, hecho: "Listo." }; }).catch(function (e) { return e && e.name === "AbortError" ? { ok: true, hecho: "Cancelaste el menú de compartir." } : { ok: false, error: "El navegador bloqueó compartir; toca la pantalla e inténtalo de nuevo." }; });
  }
  function enlace(url, txt) {
    var d = document.createElement("div"); d.className = "m n"; var a2 = document.createElement("a"); a2.href = url; a2.target = "_blank"; a2.rel = "noopener noreferrer"; a2.textContent = txt; d.appendChild(a2); chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
  }
  function abrirMovil(app, texto) {
    var k = norm(app || ""), q = encodeURIComponent(String(texto || "")), num = String(texto || "").replace(/[^\d+]/g, ""), url = "", nom = k;
    var MAP = {
      youtube: q ? "https://www.youtube.com/results?search_query=" + q : "https://www.youtube.com/", maps: q ? "https://www.google.com/maps/search/?api=1&query=" + q : "https://www.google.com/maps",
      spotify: q ? "https://open.spotify.com/search/" + q : "https://open.spotify.com/", whatsapp: num.length >= 7 ? "https://wa.me/" + num.replace("+", "") : "https://wa.me/" + (q ? "?text=" + q : ""),
      telegram: "https://t.me/", instagram: "https://www.instagram.com/", tiktok: "https://www.tiktok.com/", facebook: "https://www.facebook.com/", x: "https://x.com/", twitter: "https://x.com/",
      gmail: "https://mail.google.com/", google: "https://www.google.com/search?q=" + q, netflix: "https://www.netflix.com/", llamada: num ? "tel:" + num : "", llamar: num ? "tel:" + num : "", sms: num ? "sms:" + num : "", mensaje: num ? "sms:" + num : ""
    };
    url = MAP[k]; if (url === undefined) { url = "https://www.google.com/search?q=" + encodeURIComponent((app || "") + " " + (texto || "")); nom = "Google"; }
    if (!url) return { ok: false, error: "Necesito un número de teléfono." };
    var w = null; try { w = window.open(url, "_blank", "noopener"); } catch (e) {}
    enlace(url, "Abrir " + nom + (texto ? ": " + texto : ""));
    return { ok: true, hecho: w ? "Abriendo " + nom + "." : "Toca el enlace del chat para abrir " + nom + "." };
  }
  function velo(n) { var v2 = $("velo"); if (v2) v2.style.opacity = String((1 - lim(n, 10, 100) / 100) * .85); }
  velo(ls("nexo_brillo") ? +ls("nexo_brillo") : 100);

  // ---------- Memoria ----------
  var mem = []; try { mem = JSON.parse(ls("nexo_mem") || "[]"); if (!Array.isArray(mem)) mem = []; } catch (er) { mem = []; }
  function guardarMem() { mem = mem.slice(-80); ls("nexo_mem", JSON.stringify(mem)); }
  function recordar(d) {
    d = String(d || "").trim().slice(0, 300); if (d.length < 3) return { ok: false, error: "No hay nada que recordar." };
    if (mem.some(function (x) { return norm(x) === norm(d); })) return { ok: true, hecho: "Ya lo tenía anotado." };
    mem.push(d); guardarMem(); return { ok: true, hecho: "Anotado." };
  }
  function olvidar(t) {
    var n0 = mem.length, k = norm(t || ""); if (!k) return { ok: false, error: "Dime qué debo olvidar." };
    mem = mem.filter(function (x) { return norm(x).indexOf(k) < 0; }); guardarMem();
    return mem.length < n0 ? { ok: true, hecho: "Olvidado." } : { ok: false, error: "No tenía nada sobre eso." };
  }
  function cargarHist() {
    try { var h = JSON.parse(ls("nexo_hist") || "[]"); if (!Array.isArray(h)) return []; h = h.filter(function (x) { return x && x.role && x.parts && x.parts[0] && typeof x.parts[0].text === "string"; }).slice(-16); while (h.length && h[0].role !== "user") h.shift(); return h; } catch (er) { return []; }
  }
  $("borrar").addEventListener("click", function () { if (!window.confirm("¿Borrar todo lo que recuerdo de ti y la conversación guardada?")) return; mem = []; hist = []; ls("nexo_mem", null); ls("nexo_hist", null); msg("n", "Listo, empecé de cero."); });

  // ---------- Voz del navegador (selector) ----------
  function llenarVoces() {
    var s = $("vozn"), vs = vocesEs(); s.innerHTML = ""; var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Automática (la mejor)"; s.appendChild(o0);
    vs.forEach(function (x) { var o = document.createElement("option"); o.value = x.voiceURI; o.textContent = x.name + " (" + x.lang + ")"; s.appendChild(o); });
    s.value = vozNav;
  }
  if (window.speechSynthesis) { llenarVoces(); speechSynthesis.onvoiceschanged = llenarVoces; }
  $("vozn").addEventListener("change", function (ev) { vozNav = ev.target.value; ls("nexo_vozn", vozNav); detenerVoz(); frase("Hola, soy Nexo. Así sueno."); });
  cv.addEventListener("pointerdown", function () { if (hablando || pendNav) { detenerVoz(); fin(); } });

  // ---------- Llamarlo por voz ("Nexo", como "Ok Google") ----------
  var wakeOn = ls("nexo_wake") === "1", wakeWord = ls("nexo_wp") || "nexo", wakeSR = null, wakeT = 0, wakeDec = 0, wakeFalla = 0;
  function reWake() {
    var w = norm(wakeWord).replace(/[^a-z0-9 ]/g, "").trim() || "nexo", alts = w === "nexo" ? "nexo|nexos|neso|necso|nekso|nexso" : w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[\\s,.¿?¡!:;])(" + alts + ")(?=$|[\\s,.¿?¡!:;])");
  }
  function campana() {
    try { var a2 = audio(), o = a2.createOscillator(), g = a2.createGain(), t0_ = a2.currentTime; o.type = "sine"; o.frequency.setValueAtTime(660, t0_); o.frequency.setValueAtTime(880, t0_ + .09);
      g.gain.setValueAtTime(.0001, t0_); g.gain.exponentialRampToValueAtTime(.05 + .2 * volV, t0_ + .02); g.gain.exponentialRampToValueAtTime(.0001, t0_ + .24); o.connect(g); g.connect(a2.destination); o.start(); o.stop(t0_ + .26); } catch (er) {}
  }
  function pararWake() { clearTimeout(wakeT); clearTimeout(wakeDec); if (wakeSR) { var r = wakeSR; wakeSR = null; try { r.onend = null; r.onresult = null; r.onerror = null; r.abort(); } catch (er) {} } }
  function programarWake(ms) {
    clearTimeout(wakeT); if (!wakeOn || !SR || motorMic !== "sr") return;
    wakeT = setTimeout(function () {
      if (!wakeOn) return;
      if (document.hidden || conv || ocupado || escuchando || grabando || abriendo || hablando || pendNav || streaming || actual !== "reposo") { programarWake(1000); return; }
      iniciarWake();
    }, ms || 400);
  }
  function despertar(texto) {
    var s = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), q = reWake().exec(s); if (!q) return;
    var cmd = texto.slice(q.index + q[0].length).replace(/^[\s,.:;¡!¿?]+/, "").trim();
    pararWake(); campana();
    if (cmd.length >= 3) { enviar(cmd, null, { voz: true }); return; }
    var resp = ["Dime.", "Te escucho.", "¿Sí?", "Aquí estoy.", "Dime, ¿qué necesitas?"][(R() * 5) | 0];
    fijar("escucha"); pulso = 1; etiqueta.textContent = resp;
    if (window.speechSynthesis && $("vozon").checked) frase(resp, function () { escuchar(); }); else setTimeout(escuchar, 350);
  }
  function iniciarWake() {
    if (wakeSR) return;
    var r = new SR(), err = "";
    wakeSR = r; r.lang = /^es/i.test(navigator.language || "") ? navigator.language : "es-ES"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = function (ev) {
      var tx = ""; for (var i = 0; i < ev.results.length; i++) tx += ev.results[i][0].transcript + " ";
      tx = tx.trim(); if (!reWake().test(tx.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))) return;
      clearTimeout(wakeDec); wakeDec = setTimeout(function () { despertar(tx); }, 1100);
    };
    r.onerror = function (ev) { err = (ev && ev.error) || "error"; };
    r.onend = function () {
      if (wakeSR !== r) return; wakeSR = null;
      if (err === "not-allowed" || err === "service-not-allowed") { apagarWake("No pude activar la palabra clave: " + (err === "not-allowed" ? "falta el permiso del micrófono." : "este navegador no ofrece reconocimiento de voz continuo.")); return; }
      wakeFalla = err === "network" ? wakeFalla + 1 : 0;
      if (wakeFalla >= 3) { apagarWake("La palabra clave necesita internet estable; la apagué."); return; }
      programarWake(err === "no-speech" ? 200 : 700);
    };
    try { r.start(); } catch (er) { wakeSR = null; programarWake(1500); }
  }
  function apagarWake(texto) { wakeOn = false; ls("nexo_wake", "0"); $("wake").checked = false; pararWake(); if (!conv) pantalla(false); if (texto) msg("e", texto); }
  function cambiarPalabra(p) {
    p = norm(p || "").replace(/[^a-z0-9 ]/g, "").trim(); if (p.length < 3 || p.length > 20) return { ok: false, error: "La palabra debe tener entre 3 y 20 letras." };
    wakeWord = p; ls("nexo_wp", p); $("wpal").textContent = p; if (wakeOn) { pararWake(); programarWake(300); } return { ok: true, hecho: "Ahora me llamas diciendo " + p + "." };
  }
  $("wpal").textContent = wakeWord; $("wake").checked = wakeOn;
  $("wake").addEventListener("change", function (ev) {
    if (!ev.target.checked) { apagarWake(); return; }
    if (!SR || motorMic !== "sr") { ev.target.checked = false; msg("e", "Tu navegador no ofrece reconocimiento de voz continuo. Usa el micrófono o el modo conversación."); return; }
    if (!window.isSecureContext) { ev.target.checked = false; msg("e", "Esto solo funciona en una página segura (https)."); return; }
    wakeOn = true; ls("nexo_wake", "1"); audio(); pantalla(true);
    msg("n", "Listo. Di «" + wakeWord + "» y te escucho. Mantén la pantalla encendida y esta página abierta."); programarWake(200);
  });
  if (wakeOn) { msg("n", "Palabra clave activada. Toca la pantalla una vez para empezar a escucharte."); document.addEventListener("pointerdown", function () { if (wakeOn) { pantalla(true); programarWake(200); } }, { once: true }); }

  // ---------- App instalable ----------
  var instalar = null;
  window.addEventListener("beforeinstallprompt", function (ev) { ev.preventDefault(); instalar = ev; $("inst").style.display = ""; });
  $("inst").addEventListener("click", function () { if (instalar) { instalar.prompt(); instalar = null; $("inst").style.display = "none"; } });
  window.addEventListener("appinstalled", function () { $("inst").style.display = "none"; msg("n", "NEXO quedó instalado como app."); });
  if ("serviceWorker" in navigator && /^https:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
