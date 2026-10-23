// NEXO AI v2.0 — holograma estilo Jarvis con IA (Gemini en streaming), voz, micrófono, cámara y agente local del PC.
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

  // ---------- Diagnóstico (medidas) ----------
  var M = { txt: [], aud: [], ttsMs: [], ttsOk: 0, ttsFail: 0, t0: 0, gotTxt: false, gotAud: false, live: { estado: "apagado", setupMs: 0, audioMs: [], cierres: 0, ultimo: "", modo: 0 } }, DL = [];
  function dlog(s) { DL.push(new Date().toLocaleTimeString("es-CO") + " " + String(s).slice(0, 240)); if (DL.length > 14) DL.shift(); }
  window.addEventListener("error", function (e) { dlog("Error JS: " + (e.message || "") + (e.lineno ? " (línea " + e.lineno + ")" : "")); });
  window.addEventListener("unhandledrejection", function (e) { dlog("Promesa rechazada: " + ((e.reason && e.reason.message) || e.reason)); });
  var FT = new Float32Array(300), fti = 0, ftN = 0, tIni = 0, cal = { fase: 0, n: 0, suma: 0 };
  function medir(dt, now) {
    FT[fti++ % 300] = dt * 1000; if (ftN < 300) ftN++;
    if (cal.fase === 0) {
      if (calidad !== "auto" || ls("nexo_q")) { cal.fase = 2; return; }
      if (!tIni) tIni = now; if (now - tIni > 3000) { cal.fase = 1; cal.n = 0; cal.suma = 0; }
    } else if (cal.fase === 1 && dt < .1) {
      cal.suma += dt * 1000;
      if (++cal.n >= 120) {
        cal.fase = 2; var avg = cal.suma / cal.n, nq = avg > 20.5 ? "bajo" : "medio";
        ls("nexo_q", nq); ls("nexo_qms", avg.toFixed(1)); nivelQ = nq; aplicarCalidad(); dlog("Calibración: " + avg.toFixed(1) + " ms por cuadro, calidad " + nq);
      }
    }
  }

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
    "uniform float uT,uAsp,uScale,uAmp,uRad,uWave,uPulse,uDPR,uSwap,uPS,uGlitch,uMorph,uRough,uOff,uCrisp,uSwirl,uLite;",
    "uniform vec2 uRot,uPtr,uFlip,uMS;uniform vec3 uC1,uC2,uC3,uMV;uniform vec4 uMA;uniform float uPh;",
    "varying vec3 vC;varying float vA;",
    "void main(){",
    " float t=uT;",
    " float m=smoothstep(0.,1.,clamp(uMorph*1.5-aR.x*.5,0.,1.));",
    " vec3 d0=mix(aS,aT,m);",
    " float sw=t*(.25+.3*uAmp)*(1.3-length(d0.xz))*uSwirl;float cs=cos(sw),sn=sin(sw);",
    " vec3 d=vec3(cs*d0.x-sn*d0.z,d0.y,sn*d0.x+cs*d0.z);",
    " float lw=smoothstep(.05,-.55,d.y);",
    " d.x+=uMA.x*lw*sin(uPh+d.x*4.)*.2;",
    " d.y+=uMA.x*lw*max(0.,cos(uPh+d.x*4.))*.06;",
    " d.y+=uMA.y*abs(sin(uPh))*.1;",
    " float fl=max(smoothstep(.1,.7,abs(d.x)),smoothstep(.1,.6,d.y)*.7);",
    " d.y+=uMA.z*sin(uPh)*.22*fl;",
    " d.y+=uMA.w*sin(uPh+d.x*5.)*.1*(.4+.6*abs(d.x));",
    " vec3 w=vec3(0.);if(uLite<.5)w=vec3(sin(d.y*2.6+t*.55+aR.y*6.283),sin(d.z*2.4-t*.47+aR.y*4.),sin(d.x*2.8+t*.4+aR.y*5.))",
    "  +.5*vec3(sin(d.z*5.1+t*.9),sin(d.x*4.7-t*.8),sin(d.y*5.3+t*.7));",
    " float shell=.82+uRough*.5*aR.x*aR.x*aR.x+(1.-uRough)*.1*aR.x;",
    " shell=mix(shell,.95,uCrisp);",
    " float pulse=1.+uPulse*.1+uWave*.05*sin(t*6.5+d.y*4.+aR.y*2.);",
    " vec3 p=d*uRad*shell*pulse+w*.07*uAmp*(1.-.8*uCrisp);",
    " p+=normalize(d+vec3(.001))*uPulse*.45*step(.965,aR.y);",
    " p.xy*=uMS;",
    " float cz=cos(uMV.z),sz=sin(uMV.z);p.xy=vec2(p.x*cz-p.y*sz,p.x*sz+p.y*cz);",
    " float cy=cos(uRot.x),sy=sin(uRot.x),cx=cos(uRot.y),sx=sin(uRot.y);",
    " p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);",
    " p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);",
    " float pe=1.7/(2.4-p.z);",
    " vec2 s=p.xy*pe*uScale+vec2(uMV.x,uOff+uMV.y);",
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
  var QUAL = { bajo: { n: 4500, dpr: 1, lite: 1, vd: .75, vs: 2 }, medio: { n: 8000, dpr: 1.25, lite: 0, vd: 1, vs: 1 }, alto: { n: 12000, dpr: 2, lite: 0, vd: 1.5, vs: 1 } };
  var calidad = ls("nexo_cal") || "auto", nivelQ = ls("nexo_q") || "medio";
  if (!QUAL[nivelQ]) nivelQ = "medio"; if (calidad !== "auto" && !QUAL[calidad]) calidad = "auto";
  function Q() { return QUAL[calidad === "auto" ? nivelQ : calidad]; }
  var cv = $("lienzo"), U = {}, listo = false, buf = null;
  var gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "high-performance" });
  function compilar(tipo, s) { var h = gl.createShader(tipo); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(h)); return null; } return h; }
  function subir() {
    var d = new Float32Array(MAX * 8);
    for (var i = 0; i < MAX; i++) { d[i * 8] = rnd[i * 2]; d[i * 8 + 1] = rnd[i * 2 + 1]; d.set(src.subarray(i * 3, i * 3 + 3), i * 8 + 2); d.set(tgt.subarray(i * 3, i * 3 + 3), i * 8 + 5); }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); cpu = d; gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
  }
  function iniciar() {
    var vs = compilar(gl.VERTEX_SHADER, VS), fs = compilar(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(pr)); return false; }
    gl.useProgram(pr); buf = gl.createBuffer(); subir();
    [["aR", 2, 0], ["aS", 3, 8], ["aT", 3, 20]].forEach(function (a) { var l = gl.getAttribLocation(pr, a[0]); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, a[1], gl.FLOAT, false, 32, a[2]); });
    ["uT","uAsp","uScale","uAmp","uRad","uWave","uPulse","uDPR","uSwap","uPS","uGlitch","uMorph","uRough","uOff","uCrisp","uSwirl","uLite","uMA","uMV","uMS","uPh","uRot","uPtr","uFlip","uC1","uC2","uC3","uBr","uInt"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clearColor(0, 0, 0, 0);
    return true;
  }
  if (!gl) etiqueta.textContent = "Este navegador no admite WebGL: no se puede dibujar el holograma";
  else if (!(listo = iniciar())) etiqueta.textContent = "Error al compilar el shader: abre la consola (F12)";
  var asp = 1, dpr = 1;
  function ajustar() { if (!gl) return; dpr = Math.min(window.devicePixelRatio || 1, Q().dpr); cv.width = Math.max(2, Math.round(cv.clientWidth * dpr)); cv.height = Math.max(2, Math.round(cv.clientHeight * dpr)); asp = cv.width / cv.height; gl.viewport(0, 0, cv.width, cv.height); }
  window.addEventListener("resize", ajustar); ajustar();
  var mo = { tipo: "", vel: 1, dir: 1, mira: -1, t: 0 }, mc = { tx: 0, ty: 0, rz: 0, sx: 1, sy: 1, w: 0, b: 0, f: 0, v: 0, ph: 0 }, mtimer = 0;
  var MOVS = { caminar: 1, correr: 1, volar: 1, nadar: 1, cruzar: 1, saltar: 1, rebotar: 1, girar: 1, latir: 1, flotar: 1, bailar: 1, balancear: 1, orbitar: 1, temblar: 1 };
  function iniciarMov(o) {
    o = o || {}; var k = norm(o.movimiento || "");
    clearTimeout(mtimer);
    if (!k || k === "ninguno" || k === "detener" || k === "parar" || k === "quieto") { mo.tipo = ""; return { ok: true, hecho: "Detuve el movimiento." }; }
    if (!MOVS[k]) return { ok: false, error: "Movimiento no disponible. Opciones: " + Object.keys(MOVS).join(", ") + ", ninguno." };
    mo.tipo = k; mo.vel = lim(o.velocidad || 1, .3, 3); mo.dir = /izq/.test(norm(o.direccion || "")) ? -1 : 1; mo.mira = /der/.test(norm(o.mira || "")) ? 1 : -1; mo.t = 0; mo.esc = +o.escala || 0;
    if (o.segundos > 0) mtimer = setTimeout(function () { mo.tipo = ""; }, Math.min(o.segundos, 600) * 1000);
    return { ok: true };
  }
  function pasoMov(dt, k, rango) {
    var T = mo.tipo, t = mo.t += dt * mo.vel, o = { tx: 0, ty: 0, rz: 0, sx: 1, sy: 1, w: 0, b: 0, f: 0, v: 0 }, u;
    var volt = mo.dir === mo.mira ? 1 : -1;
    function X(rate) { return mo.dir * (((t * rate) % 1) * 2 - 1) * rango; }
    if (T === "caminar") { o.tx = X(.17); o.sx = .55 * volt; o.sy = .55; o.w = 1; o.b = 1; mc.ph = t * 7; }
    else if (T === "correr") { o.tx = X(.32); o.sx = .55 * volt; o.sy = .55; o.w = 1.5; o.b = 1.6; mc.ph = t * 11; }
    else if (T === "volar") { o.tx = X(.2); o.ty = Math.sin(t * 1.3) * .14 + .05; o.sx = .5 * volt; o.sy = .5; o.f = 1; o.rz = -mo.dir * Math.sin(t * 1.3) * .06; mc.ph = t * 9; }
    else if (T === "nadar") { o.tx = X(.16); o.ty = Math.sin(t * .9) * .08; o.sx = .5 * volt; o.sy = .5; o.v = 1; mc.ph = t * 6; }
    else if (T === "cruzar") { o.tx = X(.22); o.sx = (mo.esc || .6) * volt; o.sy = mo.esc || .6; }
    else if (T === "saltar") { u = Math.abs(Math.sin(t * 3)); o.ty = u * .38; o.sx = .85 * (1.12 - .12 * u); o.sy = .85 * (.88 + .2 * u); mc.ph = t * 3; }
    else if (T === "rebotar") { u = Math.abs(Math.sin(t * 3.4)); o.tx = Math.sin(t * .55) * (rango - .6) * .6; o.ty = u * .5 - .15; o.sx = .45 * (1.1 - .1 * u); o.sy = .45 * (.9 + .1 * u); o.rz = t * 2; }
    else if (T === "girar") { o.rz = t * 2.2; }
    else if (T === "latir") { u = Math.max(0, Math.sin(t * 5)); u = 1 + .13 * u * u * u + .07 * Math.pow(Math.max(0, Math.sin(t * 5 + 1.2)), 3); o.sx = u; o.sy = u; }
    else if (T === "flotar") { o.ty = Math.sin(t * 1.2) * .08; o.rz = Math.sin(t * .9) * .05; o.b = .3; mc.ph = t * 2; }
    else if (T === "bailar") { o.rz = Math.sin(t * 4) * .22; o.ty = Math.abs(Math.sin(t * 4)) * .07; o.sx = 1 + .06 * Math.sin(t * 8); o.w = .6; o.b = .8; mc.ph = t * 5; }
    else if (T === "balancear") { o.rz = Math.sin(t * 2.4) * .55; }
    else if (T === "orbitar") { o.tx = Math.cos(t * 1.1) * (rango - .6) * .5; o.ty = Math.sin(t * 1.1) * .28; o.sx = .42; o.sy = .42; o.rz = t * .8; }
    else if (T === "temblar") { o.tx = Math.sin(t * 70) * .012; o.ty = Math.cos(t * 83) * .012; }
    if (T) { mc.tx = o.tx; mc.ty = o.ty; mc.rz = o.rz; } else { mc.tx += (0 - mc.tx) * k; mc.ty += (0 - mc.ty) * k; mc.rz += (0 - mc.rz) * k; }
    mc.sx += (o.sx - mc.sx) * k; mc.sy += (o.sy - mc.sy) * k; mc.w += (o.w - mc.w) * k; mc.b += (o.b - mc.b) * k; mc.f += (o.f - mc.f) * k; mc.v += (o.v - mc.v) * k;
  }
  function conMov(a, r, que) {
    if (a && a.movimiento) { var m = iniciarMov(a); if (!m.ok) return m; r.hecho = que + " y la puse en movimiento: " + a.movimiento + "."; } else r.hecho = que + ".";
    return r;
  }
  function aplicar(g, rg, cr, opt) {
    opt = opt || {};
    if (rig) detenerRig();
    if (!opt.reloj) { relojOn = false; clearTimeout(retorno); mo.tipo = ""; clearTimeout(mtimer); }
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

  // ---------- Figuras animadas: partes articuladas que se mueven de verdad ----------
  var rig, cpu, TAU = Math.PI * 2;
  function nums(v, n, def) { var o = []; for (var i = 0; i < n; i++) { var x = Array.isArray(v) ? +v[i] : NaN; o.push(isFinite(x) ? x : def[i]); } return o; }
  function normParte(p) {
    if (!p || typeof p !== "object") return null;
    var tipo = String(p.tipo || (p.d ? "path" : "")).toLowerCase(), n = (Array.isArray(p.n) ? p.n : []).map(Number).filter(isFinite).slice(0, 80);
    if (tipo === "elipse" && n.length < 4) return null;
    if (tipo === "linea" && n.length < 4) return null;
    if (tipo === "poligono" && (n.length < 6)) return null;
    if (tipo === "path" && !String(p.d || "").trim()) return null;
    if (["elipse", "linea", "poligono", "path"].indexOf(tipo) < 0) return null;
    var piv = Array.isArray(p.pivote) && p.pivote.length >= 2 && isFinite(+p.pivote[0]) && isFinite(+p.pivote[1]) ? [+p.pivote[0], +p.pivote[1]] : null;
    if (!piv) { if (tipo === "elipse") piv = [n[0], n[1]]; else if (tipo === "linea") piv = [n[0], n[1]]; else if (tipo === "poligono") { var sx = 0, sy = 0, c = 0; for (var i = 0; i + 1 < n.length; i += 2) { sx += n[i]; sy += n[i + 1]; c++; } piv = [sx / c, sy / c]; } else piv = [50, 50]; }
    return { tipo: tipo, n: n, d: String(p.d || "").slice(0, 2000), g: lim(+p.grosor || 0, 0, 30), rel: p.relleno !== false, piv: piv, pad: Number.isInteger(+p.padre) && p.padre != null ? +p.padre : -1,
      rot: p.rot ? nums(p.rot, 3, [0, 1, 0]) : null, mov: p.mov ? nums(p.mov, 4, [0, 0, 1, 0]) : null, giro: +p.giro || 0, esc: p.esc ? nums(p.esc, 6, [1, 1, 1, 1, 1, 0]) : null };
  }
  function dibujaParte(x, o) {
    x.fillStyle = "#fff"; x.strokeStyle = "#fff"; x.lineJoin = "round"; x.lineCap = "round"; x.save(); x.scale(4, 4); x.beginPath();
    if (o.tipo === "linea") { x.lineWidth = o.g || 4; x.moveTo(o.n[0], o.n[1]); x.lineTo(o.n[2], o.n[3]); x.stroke(); }
    else if (o.tipo === "elipse") { x.ellipse(o.n[0], o.n[1], Math.abs(o.n[2]) || 1, Math.abs(o.n[3]) || 1, 0, 0, TAU); if (o.rel) x.fill(); x.lineWidth = o.g || 1.2; x.stroke(); }
    else if (o.tipo === "poligono") { x.moveTo(o.n[0], o.n[1]); for (var i = 2; i + 1 < o.n.length; i += 2) x.lineTo(o.n[i], o.n[i + 1]); x.closePath(); if (o.rel) x.fill(); x.lineWidth = o.g || 1.2; x.stroke(); }
    else { var p; try { p = new Path2D(o.d); } catch (er) { x.restore(); return; } if (o.rel) x.fill(p); x.lineWidth = o.g || 1.2; x.stroke(p); }
    x.restore();
  }
  function muestrasParte(o) {
    var W = 400, c = document.createElement("canvas"); c.width = W; c.height = W; var x = c.getContext("2d", { willReadFrequently: true }); dibujaParte(x, o);
    var d = x.getImageData(0, 0, W, W).data, F = [], B = [], px, py;
    function on(a2, b2) { return a2 >= 0 && b2 >= 0 && a2 < W && b2 < W && d[(b2 * W + a2) * 4 + 3] > 110; }
    for (py = 0; py < W; py++) for (px = 0; px < W; px++) if (on(px, py)) { F.push(px, py); if (!on(px - 1, py) || !on(px + 1, py) || !on(px, py - 1) || !on(px, py + 1)) B.push(px, py); }
    return F.length >= 8 ? { F: F, B: B } : null;
  }
  function crearRig(def) {
    var P = (Array.isArray(def.partes) ? def.partes : []).slice(0, 20).map(normParte).filter(Boolean);
    if (!P.length) return null;
    P.forEach(function (o, j) { o.mu = muestrasParte(o); o.w = o.mu ? Math.pow(o.mu.F.length / 2, .8) : 0; if (o.pad >= j || o.pad < -1) o.pad = -1; });
    var tot = 0; P.forEach(function (o) { tot += o.w; }); if (!tot) return null;
    var pi = new Uint8Array(MAX), lx = new Float32Array(MAX), ly = new Float32Array(MAX), zj = new Float32Array(MAX);
    for (var i = 0; i < MAX; i++) {
      var r = R() * tot, j = 0; for (; j < P.length - 1; j++) { if (r < P[j].w) break; r -= P[j].w; }
      while (!P[j].mu) j = (j + 1) % P.length;
      var m = P[j].mu, useB = m.B.length && R() < .3, L = useB ? m.B : m.F, q = ((R() * (L.length / 2)) | 0) * 2;
      pi[i] = j; lx[i] = (L[q] + R() - .5) / 4; ly[i] = (L[q + 1] + R() - .5) / 4; zj[i] = (R() - .5) * .05;
    }
    var rb = nums(def.rebote, 2, [0, 1]);
    return { P: P, pi: pi, lx: lx, ly: ly, zj: zj, M: new Float64Array(P.length * 6), t: 0, acc: 0, viaje: lim(+def.viaje || 0, -60, 60), reb: rb, vel: lim(+def.velocidad || 1, .2, 3), esp: !!def.espejo };
  }
  function posRig(r, t, out, stride, off) {
    var P = r.P, M = r.M, j, o, gx = 0, gy = 0;
    if (r.viaje) gx = (((r.viaje * t + 85) % 170) + 170) % 170 - 85;
    if (r.reb[0]) gy = r.reb[0] * Math.sin(TAU * r.reb[1] * t);
    for (j = 0; j < P.length; j++) {
      o = P[j]; var ang = (o.rot ? o.rot[0] * Math.sin(TAU * o.rot[1] * t + o.rot[2]) : 0) + (o.giro ? o.giro * t : 0); ang *= Math.PI / 180;
      var dx = o.mov ? o.mov[0] * Math.sin(TAU * o.mov[2] * t + o.mov[3]) : 0, dy = o.mov ? o.mov[1] * Math.sin(TAU * o.mov[2] * t + o.mov[3]) : 0, sx = 1, sy = 1;
      if (o.esc) { var u = .5 + .5 * Math.sin(TAU * o.esc[4] * t + o.esc[5]); sx = o.esc[0] + (o.esc[1] - o.esc[0]) * u; sy = o.esc[2] + (o.esc[3] - o.esc[2]) * u; }
      var cs = Math.cos(ang), sn = Math.sin(ang), la = cs * sx, lb = sn * sx, lc = -sn * sy, ld = cs * sy, px = o.piv[0], py = o.piv[1], le = px + dx - (la * px + lc * py), lf = py + dy - (lb * px + ld * py), b6 = j * 6;
      if (o.pad >= 0) { var pb = o.pad * 6, pa = M[pb], pb2 = M[pb + 1], pc = M[pb + 2], pd = M[pb + 3], pe = M[pb + 4], pf = M[pb + 5];
        M[b6] = pa * la + pc * lb; M[b6 + 1] = pb2 * la + pd * lb; M[b6 + 2] = pa * lc + pc * ld; M[b6 + 3] = pb2 * lc + pd * ld; M[b6 + 4] = pa * le + pc * lf + pe; M[b6 + 5] = pb2 * le + pd * lf + pf; }
      else { M[b6] = la; M[b6 + 1] = lb; M[b6 + 2] = lc; M[b6 + 3] = ld; M[b6 + 4] = le; M[b6 + 5] = lf; }
    }
    var flip = r.esp !== (r.viaje < 0), pi = r.pi, lx = r.lx, ly = r.ly, zj = r.zj;
    for (var i = 0; i < MAX; i++) {
      var m6 = pi[i] * 6, x = M[m6] * lx[i] + M[m6 + 2] * ly[i] + M[m6 + 4], y = M[m6 + 1] * lx[i] + M[m6 + 3] * ly[i] + M[m6 + 5];
      if (flip) x = 100 - x; x += gx; y += gy; var q = i * stride + off;
      out[q] = (x - 50) * .018; out[q + 1] = -(y - 50) * .018; out[q + 2] = zj[i];
    }
  }
  function animarRig(dt) {
    var r = rig; r.t += dt * r.vel; r.acc += dt; if (r.acc < 1 / 30) return; r.acc = 0;
    posRig(r, r.t, cpu, 8, 5); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cpu.subarray(0, Math.min(MAX, cuenta) * 8));
  }
  function detenerRig() {
    if (!rig) return; var tg = new Float32Array(MAX * 3); for (var i = 0; i < MAX; i++) { tg[i * 3] = cpu[i * 8 + 5]; tg[i * 3 + 1] = cpu[i * 8 + 6]; tg[i * 3 + 2] = cpu[i * 8 + 7]; } tgt = tg; rig = null;
  }
  function iniciarRig(def) {
    var r = crearRig(def); if (!r) return false;
    var tg = new Float32Array(MAX * 3); posRig(r, 0, tg, 3, 0);
    if (rig) detenerRig(); relojOn = false; clearTimeout(retorno);
    src = tgt; tgt = tg; subir(); morph = 0; roughT = .3; crispT = .85; swirlT = 0; rotT = .1; rig = r; return true;
  }
  var Ef = function (cx, cy, rx, ry, x) { return Object.assign({ tipo: "elipse", n: [cx, cy, rx, ry] }, x); };
  var Lf = function (x1, y1, x2, y2, g, x) { return Object.assign({ tipo: "linea", n: [x1, y1, x2, y2], grosor: g }, x); };
  var Gf = function (pts, x) { return Object.assign({ tipo: "poligono", n: [].concat.apply([], pts) }, x); };
  function cuadrupedo(perro) {
    var P = []; P.push(Ef(46, 50, perro ? 24 : 22, perro ? 12 : 11, { mov: [0, 1.4, 3.2, 0] }));
    P.push(Ef(perro ? 74 : 72, 40, 10, 9, { padre: 0, pivote: [66, 46], rot: [5, 1.6, 1] }));
    if (!perro) { P.push(Gf([[66, 34], [68, 21], [75, 32]], { padre: 1 })); P.push(Gf([[74, 32], [80, 22], [81, 37]], { padre: 1 })); }
    else { P.push(Ef(67, 46, 4, 9, { padre: 1, pivote: [67, 38], rot: [12, 3.2, 0] })); P.push(Gf([[76, 33], [80, 24], [83, 35]], { padre: 1 })); P.push(Ef(84, 44, 6.5, 4.5, { padre: 1 })); }
    var t0 = P.length;
    if (!perro) { P.push(Lf(26, 47, 14, 40, 4, { padre: 0, pivote: [26, 47], rot: [8, 1.6, 0] })); P.push(Lf(14, 40, 10, 22, 3.4, { padre: t0, pivote: [14, 40], rot: [22, 1.6, 1.2] })); }
    else P.push(Lf(24, 45, 13, 30, 4, { padre: 0, pivote: [24, 45], rot: [22, 4.5, 0] }));
    [[62, 0], [54, Math.PI], [34, Math.PI], [26, 0]].forEach(function (pa) { var x = pa[0], f = pa[1], up = P.length; P.push(Lf(x, 58, x, 70, 5.4, { padre: 0, pivote: [x, 58], rot: [26, 1.6, f] })); P.push(Lf(x, 70, x, 83, 4.6, { padre: up, pivote: [x, 70], rot: [22, 1.6, f + 1.4] })); });
    return { partes: P, viaje: 12, rebote: [.7, 3.2] };
  }
  function trio(cx, cy, r, aOff) { var b = []; for (var k = 0; k < 3; k++) { var a = aOff + k * TAU / 3; b.push([Math.cos(a), Math.sin(a)]); } return b; }
  var FIGURAS = {
    gato: function () { return cuadrupedo(false); },
    perro: function () { return cuadrupedo(true); },
    pajaro: function () { return { partes: [Ef(50, 50, 17, 9, { mov: [0, 1.5, 2.2, 0] }), Ef(69, 43, 6.5, 6, { padre: 0 }), Gf([[74, 41], [86, 45], [74, 48]], { padre: 1 }), Gf([[34, 50], [14, 42], [14, 58]], { padre: 0, pivote: [34, 50], rot: [8, 2.2, 1] }),
      Gf([[44, 47], [20, 16], [40, 9], [60, 45]], { padre: 0, pivote: [50, 47], rot: [48, 2.2, 0] }), Gf([[46, 49], [28, 24], [44, 17], [58, 49]], { padre: 0, pivote: [50, 48], rot: [48, 2.2, .5] })], rebote: [2.5, 2.2], viaje: 6 }; },
    pez: function () { return { partes: [Ef(52, 50, 25, 13, { mov: [0, 1.5, 1, 0] }), Gf([[28, 50], [8, 33], [14, 50], [8, 67]], { padre: 0, pivote: [28, 50], rot: [22, 2.4, 0] }), Gf([[46, 38], [56, 23], [66, 38]], { padre: 0, pivote: [56, 38], rot: [8, 2.4, 1] }), Gf([[50, 62], [56, 73], [62, 62]], { padre: 0, pivote: [56, 62], rot: [10, 2.4, 2] })], viaje: 9, rebote: [2, .7] }; },
    mariposa: function () { var e = [.15, 1, 1, 1, 1.8, 0]; return { partes: [Lf(50, 34, 50, 70, 5), Ef(50, 29, 4.5, 4.5), Lf(50, 27, 43, 14, 1.8), Lf(50, 27, 57, 14, 1.8), Ef(33, 40, 18, 15, { pivote: [50, 48], esc: e }), Ef(67, 40, 18, 15, { pivote: [50, 48], esc: e }), Ef(37, 62, 13, 11, { pivote: [50, 56], esc: e }), Ef(63, 62, 13, 11, { pivote: [50, 56], esc: e })], rebote: [4, .9], viaje: 5 }; },
    persona: function () { var P = [Lf(50, 32, 50, 58, 11, { mov: [0, 1.3, 2.8, 0] }), Ef(50, 19, 8.5, 9, { padre: 0 })], h = Math.PI;
      [[0, 0], [1, h]].forEach(function (z) { var f = z[1], u = P.length; P.push(Lf(50, 35, 50, 50, 5, { padre: 0, pivote: [50, 35], rot: [32, 1.4, f] })); P.push(Lf(50, 50, 50, 62, 4.4, { padre: u, pivote: [50, 50], rot: [22, 1.4, f + 1.2] })); });
      [[0, h], [1, 0]].forEach(function (z) { var f = z[1], u = P.length; P.push(Lf(50, 58, 50, 76, 6.5, { padre: 0, pivote: [50, 58], rot: [30, 1.4, f] })); P.push(Lf(50, 76, 50, 93, 5.5, { padre: u, pivote: [50, 76], rot: [26, 1.4, f + 1.5] })); });
      return { partes: P, viaje: 9 }; },
    coche: function () { var rueda = function (cx) { return { tipo: "path", d: "M" + (cx - 9) + " 68 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M" + (cx - 9) + " 68 L" + (cx + 9) + " 68 M" + cx + " 59 L" + cx + " 77", relleno: false, grosor: 2.4, pivote: [cx, 68], giro: 520, padre: 0 }; };
      return { partes: [Gf([[12, 66], [12, 54], [26, 50], [34, 36], [66, 36], [76, 50], [90, 54], [90, 66]], { mov: [0, .7, 7, 0] }), rueda(30), rueda(72)], viaje: 22 }; },
    corazon: function () { var pts = []; for (var i = 0; i < 48; i++) { var t = i / 48 * TAU; pts.push([50 + 2.6 * 16 * Math.pow(Math.sin(t), 3) / 1, 48 - 2.6 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
      return { partes: [Gf(pts, { pivote: [50, 50], esc: [.86, 1.14, .86, 1.14, 1.4, 0] })] }; },
    luna: function () { return { partes: [Ef(50, 50, 14, 14), Ef(50, 50, 31, 31, { relleno: false, grosor: .7 }), Ef(81, 50, 5, 5, { pivote: [50, 50], giro: 70 })] }; },
    helice: function () { var P = [Ef(50, 50, 4.5, 4.5)]; trio(0, 0, 0, 0).forEach(function (v) { var a = Math.atan2(v[1], v[0]), p1 = function (r, w) { return [50 + Math.cos(a + w) * r, 50 + Math.sin(a + w) * r]; }; P.push(Gf([[50, 50], p1(34, -.32), p1(34, .32)], { pivote: [50, 50], giro: 260 })); }); return { partes: P }; },
    cohete: function () { return { partes: [Ef(50, 48, 10, 24, { mov: [.8, 0, 9, 0] }), Gf([[41, 32], [50, 8], [59, 32]], { padre: 0 }), Gf([[40, 60], [28, 80], [41, 70]], { padre: 0 }), Gf([[60, 60], [72, 80], [59, 70]], { padre: 0 }), Gf([[43, 72], [50, 100], [57, 72]], { padre: 0, pivote: [50, 72], esc: [.7, 1.2, .5, 1.3, 7, 0] })], rebote: [1.2, 6] }; }
  };
  var ALIAS_FIG = [[/gat|minin|felin/, "gato"], [/perr|cachorr|\bcan\b/, "perro"], [/pajar|\bave\b|aves|palom|golondr|aguila|colibr/, "pajaro"], [/\bpez|peces|pescad|tiburon|delfin/, "pez"], [/mariposa/, "mariposa"], [/person|hombre|mujer|humano|gente|caminante|figura humana/, "persona"], [/coche|carro|auto|vehicul|camion/, "coche"], [/coraz|latido/, "corazon"], [/luna|orbit|tierra|planeta|satelit/, "luna"], [/helice|ventilador|molino|aspa|turbina/, "helice"], [/cohete|nave|rocket|misil/, "cohete"]];
  function figuraAnimada(a) {
    var def = null, nom = String(a.nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (Array.isArray(a.partes) && a.partes.length) def = { partes: a.partes, viaje: a.viaje, rebote: a.rebote, velocidad: a.velocidad, espejo: a.espejo };
    else { for (var i = 0; i < ALIAS_FIG.length; i++) if (ALIAS_FIG[i][0].test(nom)) { def = FIGURAS[ALIAS_FIG[i][1]](); break; } if (def) { if (a.viaje != null) def.viaje = a.viaje; if (a.velocidad != null) def.velocidad = a.velocidad; if (a.espejo != null) def.espejo = a.espejo; } }
    if (!def) return { ok: false, error: "No tengo esa figura hecha. Constrúyela tú con el parámetro partes (elipses, líneas y polígonos con sus movimientos)." };
    if (!iniciarRig(def)) return { ok: false, error: "No pude armar esa figura; revisa que las partes tengan formas válidas." };
    return { ok: true, hecho: "La figura «" + (a.nombre || "personalizada") + "» ya está en movimiento." };
  }

  // ---------- Bucle de dibujo ----------
  var ptr = [0, 0], pos = [9, 9], pS = [0, 0], pulso = 0;
  window.addEventListener("pointermove", function (e) { ptr[0] = e.clientX / innerWidth * 2 - 1; ptr[1] = e.clientY / innerHeight * 2 - 1; pos[0] = ptr[0] * asp; pos[1] = -ptr[1]; });
  window.addEventListener("pointerdown", function () { pulso = 1; });
  var reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var holo = false, inv = false, inten = +ls("nexo_inten") || 2.4, tam = .3, dist = .04, cuenta = Q().n, velU = 1, escU = 1;
  var ult = 0, t = 0, ang = 0, acum = 0, cuadros = 0, pp = [9, 9], glitch = 0, sigG = 5, sigP = 2, fr = 0, raiz = document.documentElement;
  var VISTAS = [[0, 1, -1, 1, 0], [0, -1, 1, -1, 0], [1, 0, 1, 1, 1], [-1, 0, -1, -1, 1]];
  var ac = null, anS = null, anM = null, b1 = new Uint8Array(256), b2 = new Uint8Array(256), hablando = false, grabando = false, hablo = false, ultV = 0, t0 = 0, grab = null, fuente = null, pendNav = 0, streaming = false;
  function audio() { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); anS = ac.createAnalyser(); anS.fftSize = 256; gv = ac.createGain(); gv.gain.value = volV; anS.connect(gv); gv.connect(ac.destination); anM = ac.createAnalyser(); anM.fftSize = 256; } if (ac.state === "suspended") ac.resume(); return ac; }
  function nv(an, b) { an.getByteTimeDomainData(b); var s = 0; for (var i = 0; i < b.length; i++) { var x = (b[i] - 128) / 128; s += x * x; } return Math.sqrt(s / b.length); }

  function dibujar(now) {
    requestAnimationFrame(dibujar);
    if (!listo || document.hidden) return;
    var dt = Math.min((now - ult) / 1000, .1); ult = now;
    medir(dt, now);
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
    if (++fr % 24 === 0) raiz.style.setProperty("--rgb", Math.round(v.c[3] * 255) + "," + Math.round(v.c[4] * 255) + "," + Math.round(v.c[5] * 255));
    sigG -= dt; if (sigG < 0) { glitch = reducido ? 0 : 1; sigG = 4 + R() * 5; }
    glitch -= glitch * 7 * dt; if (glitch < .02) glitch = 0;
    if (rig) animarRig(dt * velU);
    pasoMov(dt, k, holo ? 1.4 : asp + .6);
    limpioV += (limpioT - limpioV) * k; if (gm) gm.gain.value += (((escuchando || grabando || ocupado || hablando || pendNav > 0) ? .22 : 1) - gm.gain.value) * Math.min(1, dt * 5);
    crisp += (crispT - crisp) * k; swirl += (swirlT - swirl) * k; rotK += (rotT - rotK) * k;
    var wS = lim((rough - .3) / .7, 0, 1), rx = (ang * wS + Math.sin(ang * .8) * .75 * (1 - wS)) * rotK;
    gl.uniform1f(U.uLite, Q().lite); gl.uniform1f(U.uT, t); gl.uniform1f(U.uAmp, v.amp); gl.uniform1f(U.uRad, v.rad); gl.uniform1f(U.uWave, v.wave * f);
    gl.uniform1f(U.uPulse, pulso); gl.uniform1f(U.uDPR, dpr); gl.uniform1f(U.uBr, v.br * (1 + .04 * Math.sin(t * 40)));
    gl.uniform4f(U.uMA, mc.w, mc.b, mc.f, mc.v); gl.uniform3f(U.uMV, mc.tx, mc.ty, mc.rz); gl.uniform2f(U.uMS, mc.sx, mc.sy); gl.uniform1f(U.uPh, mc.ph); gl.uniform1f(U.uCrisp, crisp); gl.uniform1f(U.uSwirl, swirl); gl.uniform1f(U.uInt, (holo ? inten * 1.35 : inten) * (1 + .15 * crisp) * (.55 + .45 * Math.min(1, (Math.abs(mc.sx) + mc.sy) / 2))); gl.uniform1f(U.uGlitch, glitch); gl.uniform1f(U.uMorph, morph); gl.uniform1f(U.uRough, rough);
    gl.uniform2f(U.uRot, rx + pS[0] * .6 * (1 - .7 * crisp), pS[1] * .4 * (1 - .7 * crisp));
    gl.uniform3f(U.uC1, v.c[0], v.c[1], v.c[2]); gl.uniform3f(U.uC2, v.c[3], v.c[4], v.c[5]); gl.uniform3f(U.uC3, v.c[6], v.c[7], v.c[8]);
    var tp = 1 + .25 * (inten - 1);
    gl.disable(gl.SCISSOR_TEST); gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!holo) {
      gl.uniform1f(U.uAsp, asp); gl.uniform1f(U.uScale, Math.min(.55, asp * .9) * escU * (1 - .3 * limpioV)); gl.uniform1f(U.uOff, .44 - .2 * limpioV); gl.uniform2f(U.uPtr, pp[0], pp[1]);
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
    try { dibujarViz(dt, now); } catch (er) {}
  }
  requestAnimationFrame(dibujar);

  // ---------- Controles ----------
  var bHolo = $("holo"), selVoz = $("voz"), raizEl = document.documentElement;
  function ponerHolo(on) {
    holo = on; document.body.classList.toggle("holo", on); bHolo.textContent = on ? "Salir del modo holograma (H)" : "Modo holograma (H)"; aplicarUI();
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
    if (n === "cambiar_forma") { var rcf = setForma(a.nombre, a.puntos); return rcf.ok ? conMov(a, rcf, "Cambié la forma a " + a.nombre) : rcf; }
    if (n === "ajustar") {
      if (a.restablecer) { tinte = null; velU = 1; escU = 1; inten = 2.4; cuenta = Q().n; $("inten").value = 2.4; $("cant").value = cuenta; setForma("esfera"); return { ok: true }; }
      if (isFinite(a.brillo)) { inten = lim(a.brillo, .6, 4); $("inten").value = inten; }
      if (isFinite(a.velocidad)) velU = lim(a.velocidad, .2, 3);
      if (isFinite(a.tamano)) escU = lim(a.tamano, .5, 1.5);
      if (isFinite(a.particulas)) { cuenta = Math.round(lim(a.particulas, 2000, MAX)); $("cant").value = cuenta; }
      return { ok: true };
    }
    if (n === "escribir_con_particulas") { var gt = textoGen(a.texto); if (!gt) return { ok: false, error: "No pude dibujar ese texto" }; return conMov(Object.assign({}, a, { mira: a.direccion || "derecha", escala: .95 }), aplicar(gt, .3, 1, { segundos: +a.segundos || 0 }), "Escribí «" + String(a.texto).replace(/\n/g, " ") + "» con las partículas"); }
    if (n === "mostrar_hora") { if (!mostrarHora()) return { ok: false, error: "No pude dibujar la hora" }; return { ok: true, hecho: horaHablada() }; }
    if (n === "forma_con_emoji") { var ge = emojiGen(a.emoji); if (!ge) return { ok: false, error: "Ese emoji no se pudo dibujar en este dispositivo. Prueba otro o usa forma_con_trazo." }; return conMov(a, aplicar(ge, .3, .85), "Formé la silueta de " + a.emoji); }
    if (n === "forma_con_trazo") { var gz = trazoGen(a.trazo, a.relleno); if (!gz) return { ok: false, error: "El trazo SVG no es válido. Envía solo los datos d de un path en una caja de 0 a 100." }; return conMov(a, aplicar(gz, .3, .85), "Dibujé la forma con un trazo"); }
    if (n === "figura_animada") return figuraAnimada(a);
    if (n === "animar") { var ra = iniciarMov(a); if (ra.ok && !ra.hecho) ra.hecho = "La forma ahora está en movimiento: " + a.movimiento + "."; return ra; }
    if (n === "linterna") return linterna(a.estado !== "apagar");
    if (n === "bateria") return bateria();
    if (n === "vibrar") { if (!navigator.vibrate) return { ok: false, error: "Este navegador no permite vibrar." }; navigator.vibrate(lim(a.ms || 300, 20, 2000)); return { ok: true, hecho: "Hice vibrar el celular." }; }
    if (n === "ubicacion") return ubicacion();
    if (n === "compartir") return compartir(a);
    if (n === "copiar") return copiar(a.texto);
    if (n === "abrir_app_movil") return abrirMovil(a.app, a.texto);
    if (n === "volumen_voz") { volV = lim((+a.nivel) / 100, 0, 1); ls("nexo_vol", String(volV)); if (gv) gv.gain.value = volV; return { ok: true, hecho: "Mi voz quedó al " + Math.round(volV * 100) + " por ciento." }; }
    if (n === "brillo_app") { var nb = lim(+a.nivel, 10, 100); ls("nexo_brillo", String(nb)); velo(nb); return { ok: true, hecho: "Brillo de la app al " + Math.round(nb) + " por ciento." }; }
    if (n === "recordar") return recordar(a.dato);
    if (n === "olvidar") return olvidar(a.texto);
    if (n === "palabra_clave") return cambiarPalabra(a.palabra);
    if (n === "temporizador") return crearTm(a);
    if (n === "temporizadores") return gestionarTm(a);
    if (n === "nota_guardar") return notaGuardar(a);
    if (n === "nota_leer") return notaLeer(a);
    if (n === "nota_borrar") return notaBorrar(a);
    if (n === "contacto") return contacto(a);
    if (n === "musica") return mediaCtl(a);
    if (n === "pedir_archivo") return pedirArchivo(a);
    if (n.indexOf("roku_") === 0) return rokuHerr(n, a);
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
    { name: "figura_animada", description: "Muestra una figura que se MUEVE de verdad (patas que caminan, alas que aletean, ruedas que giran). Figuras ya hechas, solo con nombre: gato, perro, pájaro, pez, mariposa, persona caminando, coche, corazón latiendo, luna orbitando, hélice, cohete. Para cualquier otra cosa en movimiento (dragón, robot bailando, bicicleta, reloj) construye la figura con partes en una caja de 0 a 100 (y hacia abajo, mirando a la derecha). Cada parte: tipo (elipse con n=[cx,cy,rx,ry]; linea con n=[x1,y1,x2,y2] y grosor; poligono con n=[x1,y1,x2,y2,...]; path con d), pivote [x,y] (punto sobre el que gira), padre (índice de otra parte anterior a la que va unida y de la que hereda el movimiento), rot [grados, ciclos por segundo, fase en radianes] (balanceo), giro (grados por segundo, rotación continua), mov [dx, dy, hz, fase] (vaivén), esc [xmin,xmax,ymin,ymax,hz,fase] (aleteo o latido). Ejemplo de una pata articulada: {tipo:'linea',n:[60,58,60,70],grosor:5,padre:0,pivote:[60,58],rot:[26,1.6,0]}. Globales: viaje (unidades por segundo para cruzar la pantalla, negativo va a la izquierda), rebote [amplitud, hz], velocidad.", parameters: P({ nombre: { type: "string" }, partes: { type: "array", items: { type: "object", properties: { tipo: { type: "string" }, n: { type: "array", items: { type: "number" } }, d: { type: "string" }, grosor: { type: "number" }, relleno: { type: "boolean" }, pivote: { type: "array", items: { type: "number" } }, padre: { type: "number" }, rot: { type: "array", items: { type: "number" } }, giro: { type: "number" }, mov: { type: "array", items: { type: "number" } }, esc: { type: "array", items: { type: "number" } } } } }, viaje: { type: "number" }, rebote: { type: "array", items: { type: "number" } }, velocidad: { type: "number" }, espejo: { type: "boolean" } }, ["nombre"]) },
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
  TOOLS[0].functionDeclarations.push({ name: "animar", description: "Pone en movimiento la forma que ya está en pantalla, o la detiene con ninguno. movimiento: caminar, correr, volar, nadar, cruzar, saltar, rebotar, girar, latir, flotar, bailar, balancear, orbitar, temblar, ninguno.", parameters: P({ movimiento: { type: "string" }, velocidad: { type: "number" }, direccion: { type: "string", enum: ["derecha", "izquierda"] }, mira: { type: "string", enum: ["izquierda", "derecha"] }, segundos: { type: "number" } }, ["movimiento"]) });
  TOOLS[0].functionDeclarations.forEach(function (f) {
    if (["cambiar_forma", "escribir_con_particulas", "forma_con_emoji", "forma_con_trazo"].indexOf(f.name) < 0) return;
    var pr = f.parameters.properties;
    pr.movimiento = { type: "string", description: "Opcional: caminar, correr, volar, nadar, cruzar, saltar, rebotar, girar, latir, flotar, bailar, balancear, orbitar o temblar." };
    pr.velocidad = { type: "number", description: "0.3 a 3, por defecto 1" };
    pr.direccion = { type: "string", enum: ["derecha", "izquierda"], description: "Hacia dónde avanza" };
    pr.mira = { type: "string", enum: ["izquierda", "derecha"], description: "Hacia dónde mira el emoji; casi todos los animales y vehículos miran a la izquierda (por defecto)" };
  });
  TOOLS[0].functionDeclarations.push(
    { name: "temporizador", description: "Pone un temporizador (horas, minutos, segundos) o una alarma a una hora concreta (hora en 24 h, formato HH:MM).", parameters: P({ horas: { type: "number" }, minutos: { type: "number" }, segundos: { type: "number" }, hora: { type: "string" }, nombre: { type: "string" } }) },
    { name: "temporizadores", description: "Lista o cancela los temporizadores y alarmas activos.", parameters: P({ accion: { type: "string", enum: ["listar", "cancelar"] }, nombre: { type: "string" } }, ["accion"]) },
    { name: "nota_guardar", description: "Anota algo (idea, recado, elemento de una lista de compras o tareas). lista = nombre opcional de la lista.", parameters: P({ texto: { type: "string" }, lista: { type: "string" } }, ["texto"]) },
    { name: "nota_leer", description: "Lee las notas guardadas, opcionalmente solo las de una lista.", parameters: P({ lista: { type: "string" } }) },
    { name: "nota_borrar", description: "Borra notas que contengan un texto, de una lista, o todas.", parameters: P({ texto: { type: "string" }, todo: { type: "boolean" } }) },
    { name: "contacto", description: "Llama, escribe por SMS o por WhatsApp a un contacto guardado, o inicia la importación de contactos. NEXO deja un botón en pantalla para confirmar con un toque.", parameters: P({ accion: { type: "string", enum: ["llamar", "sms", "whatsapp", "buscar", "importar"] }, nombre: { type: "string" }, texto: { type: "string", description: "Mensaje para sms o whatsapp" } }, ["accion"]) },
    { name: "musica", description: "Controla la música y los videos del celular que el usuario elige (elegir abre el selector de archivos).", parameters: P({ accion: { type: "string", enum: ["elegir", "reproducir", "pausar", "continuar", "siguiente", "anterior", "detener", "volumen", "que_suena"] }, busqueda: { type: "string" }, nivel: { type: "number" } }, ["accion"]) },
    { name: "pedir_archivo", description: "Pide al usuario que elija un archivo (foto, PDF, audio o texto) para que lo veas. motivo = lo que debes hacer con él.", parameters: P({ motivo: { type: "string" } }) }
  );
  TOOLS[0].functionDeclarations.push(
    { name: "roku_tecla", description: "Envía una tecla del control remoto de la TV Roku: home, atras, ok, arriba, abajo, izquierda, derecha, info, play, pausa, adelante, atrasar, repetir, canal+, canal-, hdmi1 a hdmi4, antena.", parameters: P({ tecla: { type: "string" } }, ["tecla"]) },
    { name: "roku_app", description: "Abre una app en la TV Roku por su nombre: youtube, netflix, disney, prime, max, spotify u otra instalada.", parameters: P({ nombre: { type: "string" } }, ["nombre"]) },
    { name: "roku_volumen", description: "Cambia el volumen de la TV Roku por pasos (no por porcentaje): subir, bajar o mute. veces de 1 a 25.", parameters: P({ accion: { type: "string", enum: ["subir", "bajar", "mute"] }, veces: { type: "number" } }, ["accion"]) },
    { name: "roku_buscar", description: "Busca en la búsqueda global de la TV Roku (películas, series, canales). No busca dentro de una app concreta.", parameters: P({ texto: { type: "string" } }, ["texto"]) },
    { name: "roku_escribir", description: "Escribe un texto letra por letra en el campo activo de la TV Roku, por ejemplo el buscador de YouTube.", parameters: P({ texto: { type: "string" } }, ["texto"]) },
    { name: "roku_estado", description: "Consulta la TV Roku: si está encendida, qué app está abierta y qué se reproduce." },
    { name: "roku_energia", description: "Enciende o apaga la TV Roku. Para apagar, NEXO pide confirmación: pregunta al usuario y solo envía confirmado=true cuando haya dicho que sí.", parameters: P({ accion: { type: "string", enum: ["encender", "apagar"] }, confirmado: { type: "boolean" } }, ["accion"]) }
  );
  SYS.parts[0].text += " TV Roku: la controlas con roku_tecla, roku_app, roku_volumen, roku_buscar, roku_escribir, roku_estado y roku_energia. El volumen va por pasos, no por porcentaje, y no ves la pantalla de la TV, solo la app activa y lo que se reproduce. Para apagar la TV pregunta primero y usa confirmado=true solo cuando el usuario diga que sí. Si una herramienta de la TV dice que no llega al puente, díselo en una frase: inicia el puente en Termux con ./start_bridge.sh. Para abrir algo en la TV usa roku_app; para abrir una app en el celular usa abrir_app_movil.";
  NECESITA.roku_estado = 1; NECESITA.roku_energia = 1; NECESITA.bateria = 1; NECESITA.ubicacion = 1; NECESITA.nota_leer = 1; NECESITA.temporizadores = 1;
  SYS.parts[0].text += " Respondes como asistente de voz cálido y con personalidad: una o dos frases cortas y naturales (tres como máximo), sin listas, markdown ni emojis, porque se leen en voz alta; empieza por la respuesta, sin rodeos. Después de usar herramientas cuenta en una frase lo que hiciste; nunca respondas solo «Listo». Tus partículas forman cualquier cosa: palabras, números y la hora con escribir_con_particulas o mostrar_hora; objetos y animales con forma_con_emoji; dibujos propios con forma_con_trazo; cosas que se mueven (un gato caminando, un pájaro volando, un coche) con figura_animada, o con el parámetro movimiento y la herramienta animar. Del celular puedes: linterna, bateria, vibrar, ubicacion, compartir, copiar, abrir_app_movil, volumen_voz, brillo_app, temporizador (también alarmas a una hora), temporizadores (listar o cancelar), notas (nota_guardar, nota_leer, nota_borrar: listas de compras, ideas, apuntes), contacto (llamar, sms, whatsapp; NEXO deja un botón en pantalla y el usuario confirma con un toque), musica (archivos del celular que el usuario elige: elegir, reproducir, pausar, continuar, siguiente, anterior, detener, volumen) y pedir_archivo para que te muestre una foto, PDF, audio o texto. Para música en internet usa abrir_app_movil con youtube o spotify. Si piden el brillo o el volumen del sistema, o abrir el administrador de archivos, explica que desde una web no es posible y ofrece lo que sí puedes. Usa recordar para datos duraderos del usuario (gustos, nombre, rutinas) y las notas para apuntes y listas.";
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
  var acActual = null, cancelado = false;
  var clave = ls("nexo_clave") || "", modeloIdx = 0, hist = cargarHist(), pensar = true;
  function errHTTP(r) { return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error((j.error && j.error.message) || ("HTTP " + r.status)); e.status = r.status; throw e; }); }
  function stream(contents, alTexto, k) {
    k = k || 0; var mi = (modeloIdx + k) % MODELOS.length;
    var g = { temperature: .8, maxOutputTokens: 700 }; if (pensar) g.thinkingConfig = { thinkingLevel: "minimal" };
    var ac = new AbortController(), idle = null; acActual = ac;
    function vivo(ms) { clearTimeout(idle); idle = setTimeout(function () { ac.abort(); }, ms); }
    vivo(9000);
    return fetch(API + MODELOS[mi] + ":streamGenerateContent?alt=sse", { method: "POST", signal: ac.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": clave }, body: JSON.stringify({ systemInstruction: sysAhora(), contents: contents, tools: TOOLS, generationConfig: g }) })
      .then(function (r) {
        vivo(10000);
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
            vivo(10000);
            if (x.done) { clearTimeout(idle); procesar(bf + "\n\n"); if (!partes.length) throw new Error("Sin respuesta del modelo"); return partes; }
            bf += dec.decode(x.value, { stream: true }).replace(/\r\n/g, "\n"); var i;
            while ((i = bf.indexOf("\n\n")) >= 0) { procesar(bf.slice(0, i)); bf = bf.slice(i + 2); }
            return leer();
          });
        }
        return leer();
      })
      .catch(function (e) {
        clearTimeout(idle);
        if (cancelado) { var ec = new Error("Cancelado"); ec.cancelado = true; throw ec; }
        if (e.name === "AbortError" || /Failed to fetch|NetworkError|Load failed|network/i.test(e.message || "")) { var e2 = new Error("La conexión con Gemini se cortó o tardó demasiado."); e2.status = 504; e = e2; }
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
  function detenerVoz() { genG++; colaG = []; tocandoG = false; if (fuente) { try { fuente.onended = null; fuente.stop(); } catch (e) {} fuente = null; } hablando = false; pendNav = 0; if (window.speechSynthesis) speechSynthesis.cancel(); }
  function fin() { if (pendNav > 0 || hablando || streaming || grabando || escuchando || actual === "procesando") return; fijar("reposo"); if (conv) programarEscucha(700); else if (esperaConf && !live) { clearTimeout(tConf2); tConf2 = setTimeout(function () { if (esperaConf && !ocupado && !escuchando && !grabando && !abriendo && !hablando && !pendNav && actual === "reposo") escuchar(); }, 500); } else if (wakeOn) programarWake(900); }
  var vozNav = ls("nexo_vozn") || "", volV = ls("nexo_vol") === null ? 1 : lim(+ls("nexo_vol"), 0, 1), gv = null;
  function vocesEs() { return (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(function (x) { return /^es/i.test(x.lang); }); }
  function elegirVoz() {
    var vs = vocesEs(); if (!vs.length) return null;
    var s = vs.filter(function (x) { return x.voiceURI === vozNav; })[0]; if (s) return s;
    function pts(x) { var p = 0; if (/natural|neural|online/i.test(x.name)) p += 6; if (/google/i.test(x.name)) p += 3; if (/es[-_](CO|MX|US|419)/i.test(x.lang)) p += 2; else if (/es[-_]ES/i.test(x.lang)) p += 1; if (x.localService === true) p += 5; return p; }
    return vs.slice().sort(function (a2, b2) { return pts(b2) - pts(a2); })[0];
  }
  function frase(txt, cb) {
    if (!window.speechSynthesis || !txt.trim()) { if (cb) setTimeout(cb, 250); else setTimeout(fin, 300); return; }
    var u = new SpeechSynthesisUtterance(txt), mejor = elegirVoz(); if (mejor) u.voice = mejor; u.lang = mejor ? mejor.lang : "es-ES"; u.rate = 1.03; u.pitch = 1; u.volume = volV;
    var cerrado = false; function cerrar() { if (cerrado) return; cerrado = true; pendNav = Math.max(0, pendNav - 1); fin(); if (cb) cb(); }
    u.onboundary = function () { pulso = Math.max(pulso, .7); }; u.onend = u.onerror = cerrar; setTimeout(cerrar, 3500 + txt.length * 110);
    pendNav++; try { speechSynthesis.resume(); } catch (er) {} speechSynthesis.speak(u);
  }
  var colaG = [], tocandoG = false, genG = 0, ttsMalo = 0;
  function pedirTTS(txt) {
    var ctl = new AbortController(), tt = setTimeout(function () { ctl.abort(); }, 12000), tI = performance.now();
    return fetch(API + TTS + ":generateContent", { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": clave }, body: JSON.stringify({ contents: [{ parts: [{ text: "Habla con tono cálido y natural, a ritmo constante y siempre con el mismo estilo de voz: " + txt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selVoz.value } } } } }) })
      .then(function (r) { clearTimeout(tt); return r.ok ? r.json() : errHTTP(r); })
      .then(function (j) {
        var d = j.candidates[0].content.parts[0].inlineData, f = b64Pcm(d.data), m = /rate=(\d+)/.exec(d.mimeType || ""), a = audio(), bf = a.createBuffer(1, f.length, m ? +m[1] : 24000);
        bf.copyToChannel(f, 0); M.ttsOk++; M.ttsMs.push(Math.round(performance.now() - tI)); if (M.ttsMs.length > 20) M.ttsMs.shift(); return bf;
      }).catch(function (e) { clearTimeout(tt); throw e; });
  }
  function encolarG(txt) {
    txt = String(txt || "").trim(); if (!txt) return;
    var nav = Date.now() - ttsMalo < 300000, p = nav ? null : pedirTTS(txt); if (p) p.catch(function () {});
    pendNav++; colaG.push({ txt: txt, g: genG, p: p, nav: nav }); if (!tocandoG) siguienteG();
  }
  function siguienteG() {
    var it = colaG.shift(); if (!it) { tocandoG = false; hablando = false; fin(); return; }
    tocandoG = true;
    if (it.nav) { pendNav = Math.max(0, pendNav - 1); frase(it.txt, function () { if (it.g === genG) siguienteG(); }); return; }
    it.p.then(function (bf) {
      if (it.g !== genG) return;
      if (!M.gotAud && M.t0) { M.gotAud = true; M.aud.push(Math.round(performance.now() - M.t0)); if (M.aud.length > 20) M.aud.shift(); }
      var a = audio(), s = a.createBufferSource(); s.buffer = bf; s.connect(anS); hablando = true; fuente = s;
      s.onended = function () { if (it.g !== genG) return; hablando = false; pendNav = Math.max(0, pendNav - 1); siguienteG(); }; s.start();
    }).catch(function (e) {
      if (it.g !== genG) return; console.warn("Voz de Gemini no disponible:", e && e.message); M.ttsFail++; ttsMalo = Date.now(); dlog("TTS Gemini falló: " + (e && e.message) + " (uso la voz del navegador 5 min para no mezclar voces)"); pendNav = Math.max(0, pendNav - 1);
      frase(it.txt, function () { if (it.g === genG) siguienteG(); });
    });
  }
  function hablarGemini(txt) { encolarG(txt); }

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
    var contents = hist.concat([{ role: "user", parts: partes }]), ronda = 0, total = "", buffer = "", usarVoz = $("vozon").checked, hablado = false;
    function emitir(x) { x = String(x).replace(/[*_`#]/g, ""); if (!x.trim()) return; if (selVoz.value === "Navegador") frase(x); else encolarG(x); }
    function sacar(todo) {
      if (!usarVoz) return;
      var m, re1 = hablado ? /^([\s\S]{8,}?[.!?…])\s/ : /^([\s\S]{12,}?[.!?…:;,])\s/, gem = selVoz.value !== "Navegador";
      function espera() { return gem && hablado && !todo && buffer.length < 280; }
      if (gem && hablado && todo) { if (buffer.trim()) emitir(buffer); buffer = ""; return; }
      while (!espera() && (m = re1.exec(buffer))) { emitir(m[1]); hablado = true; buffer = buffer.slice(m[0].length); re1 = /^([\s\S]{8,}?[.!?…])\s/; }
      if (!espera() && !hablado && buffer.length >= 64 && (m = /^([\s\S]{44,}?)\s(?=\S)/.exec(buffer))) { emitir(m[1]); hablado = true; buffer = buffer.slice(m[0].length); }
      else if (!gem && hablado && buffer.length > 90 && (m = /^([\s\S]{50,}?[,;:])\s/.exec(buffer))) { emitir(m[1]); buffer = buffer.slice(m[0].length); }
      if (todo && buffer.trim()) { emitir(buffer); hablado = true; buffer = ""; }
    }
    var tr = ub ? { buf: "", ok: false } : null;
    function alTexto(d) {
      if (tr && !tr.ok) {
        tr.buf += d; var s = tr.buf.replace(/^\s+/, "");
        if (s.length < 2) return;
        if (s.slice(0, 2) !== "[[") { tr.ok = true; d = tr.buf; }
        else { var ci = s.indexOf("]]"); if (ci < 0) { if (s.length < 500) return; tr.ok = true; d = tr.buf; } else { ultTrans = s.slice(2, ci).trim(); if (ultTrans) ub.textContent = ultTrans; tr.ok = true; d = s.slice(ci + 2).replace(/^\s+/, ""); if (!d) return; } }
      }
      if (!total) { fijar(emo || "respuesta"); if (!M.gotTxt && M.t0) { M.gotTxt = true; M.txt.push(Math.round(performance.now() - M.t0)); if (M.txt.length > 20) M.txt.shift(); } } total += d; buffer += d; burbuja.textContent = total; chat.scrollTop = chat.scrollHeight; sacar(false); }
    function paso() {
      return stream(contents, alTexto).then(function (ps) {
        if (tr && !tr.ok) { tr.ok = true; if (tr.buf.trim()) alTexto(tr.buf); }
        var calls = ps.filter(function (p) { return p.functionCall; });
        if (!calls.length) { sacar(true); return total; }
        if (total) { total += "\n"; buffer += " "; }
        return Promise.all(calls.map(function (p) { return ejecutar(p.functionCall.name, p.functionCall.args); })).then(function (res) {
          var fallo = res.some(function (r) { return r && r.ok === false; }), datos = calls.some(function (p) { return NECESITA[p.functionCall.name]; });
          if ((fallo || datos || !total) && ronda++ < 2) {
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
  function cancelar() { cancelado = true; if (acActual) { try { acActual.abort(); } catch (e) {} } }
  function enviar(txt, aud, opt) {
    if (ocupado) return;
    if (txt && rapido(txt)) return;
    pararWake();
    if (!clave && !pedirClave()) { msg("e", "Necesito tu clave de Gemini para pensar."); return; }
    M.t0 = performance.now(); M.gotTxt = false; M.gotAud = false; ocupado = true; cancelado = false; emo = null; limpiarTm(); detenerVoz(); audio(); streaming = true; fijar("procesando"); pulso = 1.2;
    var vig = setTimeout(cancelar, 75000);
    var ub = msg("u", txt || "🎤 …");
    var burbuja = msg("n", "…"), partes = [], img = fotograma();
    if (aud) partes.push({ inlineData: { mimeType: aud.mime, data: aud.data } });
    if (txt) partes.push({ text: txt });
    if (aud && !txt) partes.push({ text: "(Mensaje de voz del usuario. Empieza tu respuesta con la transcripción literal entre dobles corchetes, así: [[lo que dijo]], y a continuación respóndele normalmente.)" });
    if (img) partes.push({ inlineData: { mimeType: "image/jpeg", data: img } });
    if (adjunto) { adjunto.partes.forEach(function (x) { partes.push(x); }); adjunto = null; marcarAdj(); }
    ultTrans = ""; turno(partes, burbuja, aud && !txt ? ub : null).then(function (r) {
      clearTimeout(vig); ocupado = false; streaming = false; r = (r || "Listo.").trim(); burbuja.textContent = r;
      hist.push({ role: "user", parts: [{ text: txt || ultTrans || "(mensaje de voz)" }] }, { role: "model", parts: [{ text: r }] }); if (hist.length > 16) hist = hist.slice(-16); ls("nexo_hist", JSON.stringify(hist));
      if (!/^(respuesta|feliz|preocupado)$/.test(actual)) fijar(emo || "respuesta"); pulso = 1;
      tm.push(setTimeout(fin, (pendNav || hablando) ? 20000 : 1500));
    }).catch(function (e) {
      clearTimeout(vig); ocupado = false; streaming = false; fijar("error"); pulso = 1; var m = e.message || String(e);
      if (e.cancelado) m = "Cancelado. Dime de nuevo qué necesitas.";
      if (/API key|API_KEY|permission|403|401/i.test(m)) { clave = ""; ls("nexo_clave", null); m = "La clave de Gemini no es válida. Pulsa Enviar para ponerla de nuevo."; }
      else if (e.status === 503 || /high demand|overloaded/i.test(m)) m = "Los modelos de Gemini están saturados ahora mismo. Inténtalo de nuevo en un minuto."
      else if (e.status === 504) m = "La conexión con Gemini se cortó o tardó demasiado. Inténtalo de nuevo.";
      else if (e.status === 429) m = "Se alcanzó el límite gratuito de Gemini. Espera un momento e inténtalo otra vez.";
      burbuja.className = "m e"; burbuja.textContent = m; tm.push(setTimeout(function () { fijar("reposo"); if (conv) programarEscucha(300); }, 5000));
    });
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault(); var s = entrada.value.trim(); if (!s) { if (ocupado) cancelar(); return; } entrada.value = "";
    if (live && live.ok && live.ws && live.ws.readyState === 1) { msg("u", s); live.nb = null; live.ub = null; try { live.ws.send(JSON.stringify({ realtimeInput: { text: s } })); } catch (er) { dlog("No pude enviar texto al modo en vivo: " + er.message); } return; }
    if (s.indexOf("/estado ") === 0) { limpiarTm(); var c = s.slice(8).trim().toLowerCase(); msg("n", fijar(c) ? "Estado: " + E[c].n + " (prueba manual)" : "Estado desconocido"); return; }
    enviar(s);
  });
  entrada.addEventListener("input", function () { pulso = Math.max(pulso, .6); if (entrada.value && actual === "reposo") fijar("escucha"); if (!entrada.value && actual === "escucha") fijar("reposo"); });
  msg("n", ls("nexo_limpio") !== "0" ? "Hola, " + NOMBRE + ". Toca el círculo de abajo y háblame, o di «nexo»." : "Hola, " + NOMBRE + ". Escríbeme o pulsa el micrófono.");

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
  var conv = false, convWake = false, escuchando = false, abriendo = false, sr = null, srCancel = false, sinVoz = 0, wl = null, tEsc = 0, ultTrans = "", piso = .01, umbral = .03;
  function marcarConv() { var b = $("bconv"); $("orbe").classList.toggle("on", conv); b.classList.toggle("on", conv); b.setAttribute("aria-pressed", conv ? "true" : "false"); }
  function pantalla(on) {
    try {
      if (on && navigator.wakeLock && !wl) navigator.wakeLock.request("screen").then(function (l) { wl = l; l.addEventListener("release", function () { wl = null; }); }).catch(function () {});
      if (!on && wl) { wl.release(); wl = null; }
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && conv) { pantalla(true); programarEscucha(500); } });
  function apagarConv(texto) { if (!conv) return; conv = false; convWake = false; clearTimeout(tEsc); marcarConv(); pantalla(wakeOn); if (texto) msg("n", texto); if (wakeOn) programarWake(900); }
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
      if (++sinVoz >= 2) { apagarConv(convWake || wakeOn ? "" : "No te oigo, así que apagué el modo conversación. Toca el micrófono para retomarlo."); return; }
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
    if (liveOn) { audio(); liveToggle(); return; }
    if (escuchando && sr) { try { sr.stop(); } catch (er) {} return; }
    if (grabando) { detenerMic(true); return; }
    if (ocupado || abriendo) return;
    escuchar();
  });
  $("bconv").addEventListener("click", function () {
    if (liveOn) { audio(); liveToggle(); return; }
    if (conv) {
      apagarConv("Modo conversación apagado.");
      if (sr) { srCancel = true; try { sr.abort(); } catch (er) {} } else if (grabando) detenerMic(false);
      return;
    }
    conv = true; convWake = false; sinVoz = 0; marcarConv(); pantalla(true); audio();
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
    if (rokuRapido(s, m)) return true;
    if (/^(oye |nexo )?(por favor )?(que hora es|que horas son|que hora tienes|dime la hora|dame la hora|me dices la hora|muestrame la hora|muestra la hora|la hora|hora)( ahora| por favor| actual)?$/.test(m)) {
      msg("u", s); mostrarHora(); var t = horaHablada(); msg("n", t); fijar("respuesta"); pulso = 1; decir(t); return true;
    }
    var lin = /^(por favor )?(enciende|prende|activa|pon|prender|encender)( la| mi)? linterna( por favor)?$/.test(m) ? 1 : /^(por favor )?(apaga|desactiva|quita|apagar)( la| mi)? linterna( por favor)?$/.test(m) ? 0 : -1;
    if (lin >= 0) { msg("u", s); linterna(!!lin).then(mostrarResultado); return true; }
    if (/^(cuanta bateria (tengo|me queda)|nivel de bateria|cuanta carga (tengo|me queda)|bateria)$/.test(m)) { msg("u", s); bateria().then(mostrarResultado); return true; }
    if (conv && /^(oye |nexo )?(adios|hasta luego|chao|chau|nos vemos|nada mas|eso es todo|eso seria todo|ya no|gracias nada mas)( nexo| gracias| por ahora)*$/.test(m)) { msg("u", s); apagarConv(); var dsp = "Hasta luego, " + NOMBRE + "."; msg("n", dsp); decir(dsp); return true; }
    var NUMW = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, media: .5, medio: .5 };
    var tq = /^(?:oye |nexo |por favor )*(?:ponme |pon |programa |activa |inicia |crea |configura |hazme |dame )?(?:un |una |el )?(?:temporizador|timer|cuenta regresiva) (?:de |por |para |en )?(\d+|[a-z]+)(?: y (media|medio))? ?(segundos?|minutos?|min|horas?)(?: por favor)?$/.exec(m);
    if (tq && (/^\d+$/.test(tq[1]) || NUMW[tq[1]] !== undefined)) {
      var cant = (/^\d+$/.test(tq[1]) ? +tq[1] : NUMW[tq[1]]) + (tq[2] ? .5 : 0), un = /^seg/.test(tq[3]) ? 1 : /^h/.test(tq[3]) ? 3600 : 60;
      msg("u", s); mostrarResultado(crearTm({ segundos: Math.round(cant * un) })); return true;
    }
    var mm = /^(?:oye |nexo |por favor )*(pausa|pausar|continua|continuar|reanuda|reanudar|siguiente|proxima|anterior|detener|deten)(?: la| el| esta| este)?(?: cancion| musica| video| tema)?(?: por favor)?$/.exec(m);
    if (mm && lista.length) {
      var AC = { pausa: "pausar", pausar: "pausar", continua: "continuar", continuar: "continuar", reanuda: "continuar", reanudar: "continuar", siguiente: "siguiente", proxima: "siguiente", anterior: "anterior", detener: "detener", deten: "detener" };
      msg("u", s); var rm = mediaCtl({ accion: AC[mm[1]] }); msg(rm.ok === false ? "e" : "n", rm.hecho || rm.error); return true;
    }
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
  var wakeOn = (ls("nexo_wake") === null ? !!(SR && motorMic === "sr" && window.isSecureContext) : ls("nexo_wake") === "1"), wakeWord = ls("nexo_wp") || "nexo", wakeSR = null, wakeT = 0, wakeDec = 0, wakeFalla = 0;
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
    pararWake(); campana(); conv = true; convWake = true; sinVoz = 0; marcarConv(); pantalla(true);
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
  document.addEventListener("pointerdown", function () { audio(); if (wakeOn || conv) pantalla(true); }, { once: true });
  if (wakeOn) {
    var arrancarWake = function () { if (wakeOn) { pantalla(true); audio(); programarWake(200); } }, pedirTocar = function () { msg("n", "Para llamarme con «" + wakeWord + "», toca la pantalla una vez y acepta el permiso del micrófono."); document.addEventListener("pointerdown", arrancarWake, { once: true }); };
    try { if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: "microphone" }).then(function (p) { if (p.state === "granted") arrancarWake(); else pedirTocar(); }).catch(pedirTocar); else pedirTocar(); } catch (er) { pedirTocar(); }
  }

  // =====================================================================
  // v1.2 — Pantalla limpia, visualizador, voz en cola, temporizadores,
  // notas, contactos, música/video y archivos
  // =====================================================================
  var limpio = ls("nexo_limpio") !== "0", teclado = false, limpioV = 0, limpioT = 0, uiVis = false;
  var cvz = $("viz"), cz = cvz.getContext("2d"), cvo = $("orb"), co = cvo.getContext("2d");
  var esp = new Float32Array(64), fz = new Uint8Array(128), rgbCss = "255,160,60", anMed = null, gm = null, ultViz = 0;

  function aplicarUI() {
    var ui = limpio || holo;
    document.body.classList.toggle("limpio", ui);
    document.body.classList.toggle("teclado", teclado);
    uiVis = ui && !teclado;
    limpioT = (limpio && !holo && !teclado) ? 1 : 0;
    var slot = uiVis ? $("slotU") : $("slotF"); if (etiqueta.parentNode !== slot) slot.appendChild(etiqueta);
    $("limp").checked = limpio; $("bkb").classList.toggle("on", teclado);
    if (uiVis) refrescarSub();
  }
  function tamViz() {
    var d = Math.min(window.devicePixelRatio || 1, Q().vd);
    cvz.width = Math.max(2, Math.round(innerWidth * d)); cvz.height = Math.max(2, Math.round(innerHeight * d));
    cvo.width = cvo.height = Math.round(150 * d);
  }
  window.addEventListener("resize", tamViz); tamViz();

  // Espectro: real si suena música o la voz de Gemini; si no, sintético a partir del pulso y del estado
  function espectro(dt, tt) {
    var N = esp.length, src = null, i, L;
    if (med && !med.paused && anMed) { anMed.getByteFrequencyData(fz); src = fz; }
    else if (hablando && anS) { anS.getByteFrequencyData(fz); src = fz; }
    if (actual === "escucha") L = .2 + .1 * Math.sin(tt * 3) + Math.min(.6, pulso * .5);
    else if (actual === "procesando") L = .1;
    else if (pendNav > 0 || streaming) L = .26 + Math.min(.65, pulso * .8);
    else L = .05 + .02 * Math.sin(tt * 1.5);
    for (i = 0; i < N; i++) {
      var tg;
      if (src) { tg = Math.min(1, (src[1 + Math.floor(i * 1.4)] / 255) * (1 + i / N * .9)); }
      else { var ns = .5 + .5 * Math.sin(i * 1.9 + tt * (4 + (i % 7) * .9)) * Math.cos(i * .7 - tt * 2.3); tg = L * (.35 + .65 * ns) * (1 - i / N * .5); }
      esp[i] += (tg - esp[i]) * Math.min(1, dt * (tg > esp[i] ? 22 : 7));
    }
  }
  // Barras radiales simétricas (graves arriba, agudos abajo), dos pasadas para el resplandor
  function barras(ctx, cx, cy, r0, rmax, n, lw, rot, alfa, hacia) {
    var N = esp.length, pasada, i, j, e, len, a, c, s;
    ctx.lineCap = "round";
    for (pasada = 0; pasada < 2; pasada++) {
      ctx.lineWidth = pasada ? lw : lw * 3.2; ctx.strokeStyle = "rgba(" + rgbCss + "," + (pasada ? .95 : .16) * alfa + ")";
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        j = i < n / 2 ? i : n - 1 - i; e = esp[Math.min(N - 1, Math.floor(j / (n / 2) * N))];
        len = 2 + e * rmax; a = rot + i / n * 6.28318 - 1.5708; c = Math.cos(a); s = Math.sin(a);
        ctx.moveTo(cx + c * r0, cy + s * r0); ctx.lineTo(cx + c * (r0 + len * hacia), cy + s * (r0 + len * hacia));
      }
      ctx.stroke();
    }
  }
  var vfr = 0, vskip = 0;
  function dibujarViz(dt, now) {
    if (Q().vs > 1 && (++vskip & 1)) return;
    var W = cvz.width, H = cvz.height, d = W / innerWidth, sec = now / 1000;
    if (++vfr % 6 === 0) rgbCss = Math.round(v.c[3] * 255) + "," + Math.round(v.c[4] * 255) + "," + Math.round(v.c[5] * 255);
    cz.clearRect(0, 0, W, H);
    if (!uiVis) { if (limpioV < .02) return; }
    espectro(dt, t);
    var proc = actual === "procesando";
    if (limpioV > .02 && !holo) {
      var cx = W / 2, cy = H * (1 - (.44 - .2 * limpioV)) / 2, rs = Math.min(.55, asp * .9) * escU * (1 - .3 * limpioV) * H / 2;
      var r0 = Math.min(rs * 1.32, W * .36), rmax = r0 * .3, al = limpioV;
      cz.globalCompositeOperation = "lighter";
      cz.strokeStyle = "rgba(" + rgbCss + "," + .3 * al + ")"; cz.lineWidth = d; cz.beginPath(); cz.arc(cx, cy, r0 - 7 * d, 0, 6.28318); cz.stroke();
      cz.setLineDash([2 * d, 11 * d]); cz.lineDashOffset = -sec * 14 * d; cz.strokeStyle = "rgba(" + rgbCss + "," + .22 * al + ")"; cz.beginPath(); cz.arc(cx, cy, r0 + rmax + 12 * d, 0, 6.28318); cz.stroke(); cz.setLineDash([]);
      barras(cz, cx, cy, r0, rmax, 112, 2.6 * d, 0, al * (proc ? .55 : 1), 1);
      barras(cz, cx, cy, r0 - 10 * d, rmax * .28, 112, 1.6 * d, 0, al * .5, -1);
      if (proc) {
        cz.lineCap = "round"; cz.lineWidth = 3.2 * d; cz.strokeStyle = "rgba(" + rgbCss + "," + .9 * al + ")";
        for (var k = 0; k < 3; k++) { var a0 = sec * 2.2 + k * 2.0944; cz.beginPath(); cz.arc(cx, cy, r0 + 4 * d, a0, a0 + .9); cz.stroke(); }
      }
      cz.globalCompositeOperation = "source-over";
    }
    if (uiVis) {
      var D = cvo.width, cc = D / 2, od = D / 150;
      co.clearRect(0, 0, D, D); co.globalCompositeOperation = "lighter";
      barras(co, cc, cc, 33 * od, 28 * od, 48, 2.4 * od, 0, proc ? .55 : 1, 1);
      if (proc) { co.lineCap = "round"; co.lineWidth = 3 * od; co.strokeStyle = "rgba(" + rgbCss + ",.9)"; for (var q = 0; q < 2; q++) { var a1 = sec * 3 + q * 3.1416; co.beginPath(); co.arc(cc, cc, 36 * od, a1, a1 + 1.1); co.stroke(); } }
      co.globalCompositeOperation = "source-over";
    }
  }

  // Subtítulos grandes: reflejan la última respuesta y lo último que dijiste
  var tSubR = 0, tFade = 0;
  function recorte(s) { s = String(s || "").replace(/\s+/g, " ").trim(); if (s === "…") return s; return s.length > 230 ? "…" + s.slice(-210) : s; }
  function refrescarSub() {
    var kids = chat.children, i = kids.length - 1, u = null, n = null, ultimoU = false;
    for (; i >= 0 && (!u || !n); i--) {
      var c = kids[i];
      if (c.classList.contains("u")) { if (!u) { u = c; if (!n) ultimoU = true; } } else if (!n) n = c;
    }
    $("subu").textContent = u ? recorte(u.textContent) : "";
    $("subn").textContent = (n && !ultimoU) ? recorte(n.textContent) : "";
    $("sub").classList.add("vis");
    clearTimeout(tFade);
    tFade = setTimeout(function f() { if (ocupado || hablando || pendNav > 0) { tFade = setTimeout(f, 1500); return; } $("sub").classList.remove("vis"); }, 9000);
  }
  new MutationObserver(function () { clearTimeout(tSubR); tSubR = setTimeout(refrescarSub, 30); }).observe(chat, { childList: true, subtree: true, characterData: true });

  // Botones sueltos que aparecen cuando hace falta un toque (llamar, elegir archivo...)
  function chip(texto, fn, id) {
    var acc = $("acc"), b = document.createElement("button");
    if (id) { var v0 = acc.querySelector('[data-id="' + id + '"]'); if (v0) v0.remove(); b.setAttribute("data-id", id); }
    b.type = "button"; b.className = "chip"; b.textContent = texto;
    b.addEventListener("click", function () { b.remove(); try { fn(); } catch (e) { msg("e", "No pude hacerlo: " + e.message); } });
    acc.appendChild(b); while (acc.children.length > 3) acc.removeChild(acc.firstChild);
    var tt = setTimeout(function () { if (b.parentNode) b.remove(); }, 90000); b.addEventListener("click", function () { clearTimeout(tt); });
    return b;
  }

  // Teclado y pantalla limpia
  $("bkb").addEventListener("click", function () { teclado = !teclado; aplicarUI(); if (teclado) setTimeout(function () { entrada.focus(); }, 120); });
  $("limp").addEventListener("change", function (ev) { limpio = ev.target.checked; ls("nexo_limpio", limpio ? "1" : "0"); aplicarUI(); });
  $("orbe").addEventListener("click", function () {
    audio(); if (liveOn) { liveToggle(); return; }
    if (ocupado) { cancelar(); return; }
    if (hablando || pendNav > 0) { detenerVoz(); fijar("reposo"); if (conv) programarEscucha(150); else escuchar(); return; }
    if ((escuchando || grabando) && conv) { $("bconv").click(); return; }
    if (escuchando && sr) { try { sr.stop(); } catch (er) {} return; }
    if (grabando) { detenerMic(true); return; }
    $("bconv").click();
  });

  // Menú "+"
  function menu(abrir) { $("hoja").classList.toggle("abierta", abrir); }
  $("bmas").addEventListener("click", function () { audio(); menu(true); });
  $("hoja").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-a]") : null;
    if (!b && ev.target !== $("hoja")) return; menu(false); if (!b) return;
    var a = b.getAttribute("data-a");
    if (a === "teclado") { teclado = true; aplicarUI(); setTimeout(function () { entrada.focus(); }, 120); }
    else if (a === "archivo") $("fArch").click();
    else if (a === "media") $("fMedia").click();
    else if (a === "contactos") importarContactos();
    else if (a === "tm") msg("n", textoTm());
    else if (a === "notas") msg("n", textoNotas());
    else if (a === "piramide") ponerHolo(!holo);
    else if (a === "controles") { $("pruebas").open = true; }
    else if (a === "diag") abrirDiag();
    else if (a === "live") { $("liveon").checked = !liveOn; $("liveon").dispatchEvent(new Event("change")); if (liveOn && !live) liveToggle(); }
  });

  // ---------- Temporizadores y alarmas ----------
  var tms = []; try { tms = JSON.parse(ls("nexo_tm") || "[]"); if (!Array.isArray(tms)) tms = []; } catch (er) { tms = []; }
  var tickT = 0, sonando = null;
  function guardarTm() { ls("nexo_tm", JSON.stringify(tms)); }
  function fmtDur(ms) {
    var s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60, p = [];
    if (h) p.push(h + (h === 1 ? " hora" : " horas")); if (m) p.push(m + (m === 1 ? " minuto" : " minutos")); if (ss && !h) p.push(ss + (ss === 1 ? " segundo" : " segundos"));
    return p.join(" y ") || "0 segundos";
  }
  function crearTm(a) {
    var ms = 0, hh = "";
    if (a.hora) {
      var q = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(a.hora).trim()); if (!q || +q[1] > 23 || +(q[2] || 0) > 59) return { ok: false, error: "La hora debe ser como 07:30 o 18:45 (24 horas)." };
      var d = new Date(); d.setHours(+q[1], +(q[2] || 0), 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); ms = d.getTime() - Date.now(); hh = ("0" + q[1]).slice(-2) + ":" + ("0" + (q[2] || "00")).slice(-2);
    } else ms = ((+a.horas || 0) * 3600 + (+a.minutos || 0) * 60 + (+a.segundos || 0)) * 1000;
    if (!(ms >= 1000) || ms > 172800000) return { ok: false, error: "Dime una duración válida, por ejemplo 5 minutos." };
    var it = { id: Date.now() + Math.floor(R() * 1000), fin: Date.now() + ms, nombre: String(a.nombre || "").slice(0, 40), alarma: !!a.hora };
    tms.push(it); guardarTm(); asegurarTick();
    return { ok: true, hecho: (a.hora ? "Alarma puesta a las " + hh : "Temporizador de " + fmtDur(ms)) + (it.nombre ? " (" + it.nombre + ")" : "") + ". Deja NEXO abierto para que suene." };
  }
  function asegurarTick() {
    if (tickT) return;
    tickT = setInterval(function () {
      var ahora = Date.now(), venc = tms.filter(function (x) { return x.fin <= ahora; });
      if (!venc.length) { if (!tms.length) { clearInterval(tickT); tickT = 0; } return; }
      tms = tms.filter(function (x) { return x.fin > ahora; }); guardarTm(); venc.forEach(sonarTm);
    }, 1000);
  }
  function sonarTm(it) {
    var txt = it.alarma ? "Es la hora de tu alarma" + (it.nombre ? ": " + it.nombre : "") + "." : "Tu temporizador" + (it.nombre ? " de " + it.nombre : "") + " terminó.";
    msg("n", "⏰ " + txt); fijar("feliz"); pulso = 1.2;
    var veces = 0; clearInterval(sonando);
    function toca() { campana(); try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {} if (++veces >= 6) { clearInterval(sonando); sonando = null; } }
    toca(); sonando = setInterval(toca, 1800);
    decir(txt);
    chip("⏹ Detener", function () { clearInterval(sonando); sonando = null; try { navigator.vibrate(0); } catch (e) {} }, "alarma");
  }
  function textoTm() {
    if (!tms.length) return "No tienes temporizadores ni alarmas activos.";
    var ahora = Date.now(); return "Activos: " + tms.map(function (x) { return (x.nombre || (x.alarma ? "alarma" : "temporizador")) + " (faltan " + fmtDur(Math.max(0, x.fin - ahora)) + ")"; }).join("; ") + ".";
  }
  function gestionarTm(a) {
    if (a.accion === "cancelar") {
      var k = norm(a.nombre || ""), n0 = tms.length; tms = k ? tms.filter(function (x) { return norm(x.nombre).indexOf(k) < 0; }) : [];
      guardarTm(); if (sonando) { clearInterval(sonando); sonando = null; }
      return tms.length < n0 ? { ok: true, hecho: "Cancelé " + (n0 - tms.length === 1 ? "el temporizador" : "los temporizadores") + "." } : { ok: false, error: "No encontré ese temporizador." };
    }
    return { ok: true, hecho: textoTm() };
  }
  if (tms.length) asegurarTick();

  // ---------- Notas y listas ----------
  var notas = []; try { notas = JSON.parse(ls("nexo_notas") || "[]"); if (!Array.isArray(notas)) notas = []; } catch (er) { notas = []; }
  function guardarNotas() { notas = notas.slice(-120); ls("nexo_notas", JSON.stringify(notas)); }
  function notaGuardar(a) {
    var tx = String(a.texto || "").trim().slice(0, 400); if (tx.length < 2) return { ok: false, error: "¿Qué anoto?" };
    notas.push({ t: tx, l: String(a.lista || "").trim().toLowerCase().slice(0, 30), f: Date.now() }); guardarNotas();
    return { ok: true, hecho: "Anotado" + (a.lista ? " en tu lista de " + a.lista : "") + "." };
  }
  function filtrarNotas(l) { l = norm(l || ""); return notas.filter(function (n) { return !l || norm(n.l).indexOf(l) >= 0 || norm(n.t).indexOf(l) >= 0; }); }
  function notaLeer(a) {
    var xs = filtrarNotas(a.lista).slice(-15);
    if (!xs.length) return { ok: true, hecho: "No tienes notas" + (a.lista ? " sobre eso" : "") + "." };
    return { ok: true, notas: xs.map(function (n) { return (n.l ? "[" + n.l + "] " : "") + n.t; }), hecho: "Tienes " + xs.length + (xs.length === 1 ? " nota." : " notas.") };
  }
  function notaBorrar(a) {
    var k = norm(a.texto || ""), n0 = notas.length;
    if (a.todo) notas = []; else if (!k) return { ok: false, error: "Dime cuál nota borrar." }; else notas = notas.filter(function (n) { return norm(n.t).indexOf(k) < 0 && norm(n.l) !== k; });
    guardarNotas(); return notas.length < n0 ? { ok: true, hecho: "Borrado." } : { ok: false, error: "No encontré esa nota." };
  }
  function textoNotas() { var xs = filtrarNotas("").slice(-12); return xs.length ? "Tus notas:\n" + xs.map(function (n) { return "• " + (n.l ? n.l + ": " : "") + n.t; }).join("\n") : "Todavía no tienes notas."; }

  // ---------- Contactos (se eligen una vez y quedan solo en este celular) ----------
  var cts = []; try { cts = JSON.parse(ls("nexo_contactos") || "[]"); if (!Array.isArray(cts)) cts = []; } catch (er) { cts = []; }
  function importarContactos() {
    if (!(navigator.contacts && navigator.contacts.select)) { var m0 = "Este navegador no permite leer contactos. Funciona en Chrome para Android con la página en https."; msg("e", m0); return Promise.resolve({ ok: false, error: m0 }); }
    return navigator.contacts.select(["name", "tel"], { multiple: true }).then(function (r) {
      cts = (r || []).map(function (x) { return { n: (x.name && x.name[0]) || "", t: ((x.tel && x.tel[0]) || "").replace(/[^\d+]/g, "") }; }).filter(function (x) { return x.n && x.t.length >= 6; });
      ls("nexo_contactos", JSON.stringify(cts));
      var t0_ = cts.length ? "Guardé " + cts.length + " contactos solo en este celular. Ya puedo llamarlos o escribirles por voz." : "No elegiste ningún contacto."; msg("n", t0_); return { ok: true, hecho: t0_ };
    }).catch(function (e) { var m1 = "No pude abrir tus contactos: " + ((e && (e.message || e.name)) || "error"); msg("e", m1); return { ok: false, error: m1 }; });
  }
  function buscarContacto(nombre) {
    var k = norm(nombre); if (!k) return [];
    var ex = cts.filter(function (c) { return norm(c.n) === k; }); if (ex.length) return ex;
    var toks = k.split(" "), sc = cts.map(function (c) { var cn = norm(c.n), ps = cn.split(" "), s = 0; toks.forEach(function (x) { if (ps.indexOf(x) >= 0) s += 2; else if (cn.indexOf(x) >= 0) s += 1; }); return { c: c, s: s }; }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    if (!sc.length) return []; var mx = sc[0].s; return sc.filter(function (x) { return x.s === mx; }).map(function (x) { return x.c; });
  }
  function contacto(a) {
    var ac = a.accion || "llamar";
    if (ac === "importar" || !cts.length) {
      chip("👤 Elegir contactos", importarContactos, "contactos");
      return ac === "importar" ? { ok: true, hecho: "Toca el botón «Elegir contactos» y selecciónalos; puedes marcar todos." } : { ok: false, error: "Aún no tengo tus contactos. Toca el botón «Elegir contactos» en pantalla, selecciónalos y vuelve a pedírmelo." };
    }
    var r = buscarContacto(a.nombre);
    if (!r.length) return { ok: false, error: "No encuentro a «" + (a.nombre || "") + "» entre tus contactos." };
    if (r.length > 1 && norm(r[0].n) !== norm(a.nombre)) return { ok: false, error: "Hay varios que coinciden: " + r.slice(0, 4).map(function (c) { return c.n; }).join(", ") + ". ¿A cuál te refieres?" };
    var c = r[0], num = c.t, tx = encodeURIComponent(String(a.texto || "")), url, rot;
    if (ac === "buscar") return { ok: true, hecho: c.n + " está en tus contactos." };
    if (ac === "whatsapp") { var wn = num.replace("+", ""); if (num.charAt(0) !== "+" && wn.length === 10 && wn.charAt(0) === "3") wn = "57" + wn; url = "https://wa.me/" + wn + (tx ? "?text=" + tx : ""); rot = "💬 WhatsApp a " + c.n; }
    else if (ac === "sms") { url = "sms:" + num + (tx ? "?body=" + tx : ""); rot = "✉️ Mensaje a " + c.n; }
    else { url = "tel:" + num; rot = "📞 Llamar a " + c.n; }
    chip(rot, function () { location.href = url; }, "contacto");
    setTimeout(function () { try { location.href = url; } catch (e) {} }, 900);
    return { ok: true, hecho: "Preparé " + (ac === "llamar" ? "la llamada a " : ac === "sms" ? "el mensaje para " : "WhatsApp para ") + c.n + ". Si no se abre sola, toca el botón de la pantalla." };
  }

  // ---------- Música y video del celular ----------
  var med = $("med"), lista = [], mIdx = -1, vMed = 1;
  function cadenaMed() {
    if (gm) return; var a = audio(), src = a.createMediaElementSource(med);
    anMed = a.createAnalyser(); anMed.fftSize = 256; gm = a.createGain(); src.connect(anMed); anMed.connect(gm); gm.connect(a.destination);
  }
  function esVideo(f) { return /^video\//.test(f.type) || /\.(mp4|webm|mkv|mov|3gp)$/i.test(f.name); }
  function cargarMedia(files) {
    var xs = Array.prototype.slice.call(files || []).filter(function (f) { return /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|opus|flac|mp4|webm|mkv|mov|3gp)$/i.test(f.name); });
    if (!xs.length) { msg("e", "Eso no parece música ni video."); return; }
    lista.forEach(function (it) { try { URL.revokeObjectURL(it.u); } catch (e) {} });
    lista = xs.map(function (f) { return { n: f.name.replace(/\.[^.]+$/, ""), u: URL.createObjectURL(f), v: esVideo(f) }; });
    var r = tocar(0); msg("n", "Cargué " + lista.length + (lista.length === 1 ? " archivo. " : " archivos. ") + r.hecho);
  }
  function tocar(i) {
    if (!lista.length) return { ok: false, error: "No hay música cargada." };
    mIdx = (i + lista.length) % lista.length; var it = lista[mIdx]; cadenaMed(); audio();
    med.src = it.u; med.classList.toggle("video", it.v); med.volume = vMed;
    var p = med.play(); if (p && p.catch) p.catch(function (e) { msg("e", "No pude reproducir: " + ((e && (e.message || e.name)) || "error")); });
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: it.n, artist: "NEXO" });
        [["play", function () { med.play(); }], ["pause", function () { med.pause(); }], ["nexttrack", function () { tocar(mIdx + 1); }], ["previoustrack", function () { tocar(mIdx - 1); }]].forEach(function (h) { navigator.mediaSession.setActionHandler(h[0], h[1]); });
      }
    } catch (e) {}
    return { ok: true, hecho: "Reproduciendo " + it.n + "." };
  }
  ["play", "pause", "ended"].forEach(function (ev) { med.addEventListener(ev, function () { med.classList.toggle("on", med.classList.contains("video") && !med.paused && !med.ended); }); });
  med.addEventListener("ended", function () { if (lista.length > 1) tocar(mIdx + 1); });
  med.addEventListener("click", function () { try { if (med.requestFullscreen) med.requestFullscreen(); } catch (e) {} });
  function pedirMedia() { chip("🎵 Elegir música o video", function () { $("fMedia").click(); }, "media"); return { ok: true, hecho: "Toca el botón «Elegir música o video» y escoge uno o varios archivos de tu celular." }; }
  function mediaCtl(a) {
    var ac = a.accion;
    if (ac === "elegir") return pedirMedia();
    if (ac === "reproducir") {
      if (!lista.length) { pedirMedia(); return { ok: false, error: "Aún no hay música cargada. Toca el botón «Elegir música o video» en pantalla." }; }
      if (a.busqueda) { var k = norm(a.busqueda), i = -1; lista.forEach(function (x, j) { if (i < 0 && norm(x.n).indexOf(k) >= 0) i = j; }); if (i < 0) return { ok: false, error: "No encuentro «" + a.busqueda + "» entre lo cargado: " + lista.slice(0, 6).map(function (x) { return x.n; }).join(", ") + "." }; return tocar(i); }
      if (med.paused && med.src) { cadenaMed(); audio(); med.play(); return { ok: true, hecho: "Sigo con " + lista[mIdx].n + "." }; }
      return tocar(mIdx < 0 ? 0 : mIdx);
    }
    if (!lista.length) return { ok: false, error: "No hay música cargada." };
    if (ac === "pausar") { med.pause(); return { ok: true, hecho: "En pausa." }; }
    if (ac === "continuar") { cadenaMed(); audio(); med.play(); return { ok: true, hecho: "Continúo." }; }
    if (ac === "siguiente") return tocar(mIdx + 1);
    if (ac === "anterior") return tocar(mIdx - 1);
    if (ac === "detener") { med.pause(); med.currentTime = 0; med.classList.remove("on"); return { ok: true, hecho: "Detenida." }; }
    if (ac === "volumen") { vMed = lim((+a.nivel) / 100, 0, 1); med.volume = vMed; return { ok: true, hecho: "Volumen de la música al " + Math.round(vMed * 100) + " por ciento." }; }
    if (ac === "que_suena") return { ok: true, hecho: med.paused ? "Ahora no suena nada." : "Suena " + lista[mIdx].n + "." };
    return { ok: false, error: "No entendí esa acción de música." };
  }
  $("fMedia").addEventListener("change", function (ev) { cargarMedia(ev.target.files); ev.target.value = ""; });

  // ---------- Archivos para que NEXO los vea ----------
  var adjunto = null, pedirArch = "";
  function marcarAdj() {
    if (!adjunto) { var v0 = $("acc").querySelector('[data-id="adj"]'); if (v0) v0.remove(); return; }
    var b = chip("📎 " + adjunto.nombre.slice(0, 24) + " ✕", function () { adjunto = null; }, "adj"); b.title = "Toca para quitar el archivo";
  }
  function leerArchivo(f) {
    if (!f) return;
    if (f.size > 12 * 1048576) { msg("e", "Ese archivo pesa demasiado (máximo 12 MB)."); return; }
    var esTxt = /^text\//.test(f.type) || /\.(txt|md|csv|json|log|js|py|html|css|xml|ini|yaml|yml)$/i.test(f.name), rd = new FileReader();
    rd.onerror = function () { msg("e", "No pude leer ese archivo."); };
    rd.onload = function () {
      var partes;
      if (esTxt) partes = [{ text: "Contenido del archivo «" + f.name + "»:\n" + String(rd.result).slice(0, 40000) }];
      else if (/^(image|audio)\//.test(f.type) || f.type === "application/pdf") partes = [{ inlineData: { mimeType: f.type, data: String(rd.result).split(",")[1] } }, { text: "(Archivo adjunto: «" + f.name + "»)" }];
      else { msg("e", "Todavía no sé leer ese tipo de archivo (" + (f.type || "desconocido") + "). Prueba con foto, PDF, audio o texto."); return; }
      adjunto = { nombre: f.name, partes: partes };
      if (pedirArch) { var t1 = pedirArch; pedirArch = ""; enviar(t1); }
      else { marcarAdj(); msg("n", "Recibí «" + f.name + "». Dime qué quieres que haga con él."); }
    };
    if (esTxt) rd.readAsText(f); else rd.readAsDataURL(f);
  }
  $("fArch").addEventListener("change", function (ev) { leerArchivo(ev.target.files && ev.target.files[0]); ev.target.value = ""; });
  function pedirArchivo(a) { pedirArch = String(a.motivo || "Mira este archivo y cuéntame qué es."); chip("📎 Elegir archivo", function () { $("fArch").click(); }, "arch"); return { ok: true, hecho: "Toca el botón «Elegir archivo» y escoge una foto, PDF, audio o texto." }; }

  aplicarUI();

  // ---------- App instalable ----------
  var instalar = null;
  window.addEventListener("beforeinstallprompt", function (ev) { ev.preventDefault(); instalar = ev; $("inst").style.display = ""; });
  $("inst").addEventListener("click", function () { if (instalar) { instalar.prompt(); instalar = null; $("inst").style.display = "none"; } });
  window.addEventListener("appinstalled", function () { $("inst").style.display = "none"; msg("n", "NEXO quedó instalado como app."); });
  if ("serviceWorker" in navigator && /^https:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(function () {});

  // ================= v2.0: calidad, diagnóstico y modo en vivo =================
  function aplicarCalidad() { cuenta = Q().n; $("cant").value = cuenta; ajustar(); tamViz(); $("calsel").value = calidad; }
  $("calsel").value = calidad; $("cant").value = cuenta;
  $("calsel").addEventListener("change", function (ev) { calidad = ev.target.value; ls("nexo_cal", calidad); aplicarCalidad(); });
  $("recal").addEventListener("click", function () { ls("nexo_q", null); calidad = "auto"; ls("nexo_cal", "auto"); nivelQ = "medio"; cal.fase = 0; tIni = 0; aplicarCalidad(); dlog("Recalibrando…"); });

  var gpuTxt = "?";
  try { var dbg = gl && gl.getExtension("WEBGL_debug_renderer_info"); gpuTxt = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "(oculto)"; } catch (er) {}
  function est(a) { if (!a.length) return "—"; var s = a.slice().sort(function (x, y) { return x - y; }), md = s[Math.floor(s.length / 2)]; return "mediana " + md + " ms, peor " + s[s.length - 1] + " ms (" + a.length + " medidas)"; }
  function reporte() {
    var n = ftN, a = Array.prototype.slice.call(FT, 0, n).sort(function (x, y) { return x - y; }), avg = 0, i;
    for (i = 0; i < n; i++) avg += a[i]; avg = n ? avg / n : 0;
    var p95 = n ? a[Math.min(n - 1, Math.floor(n * .95))] : 0, p99 = n ? a[Math.min(n - 1, Math.floor(n * .99))] : 0;
    var L = [
      "NEXO v2.0 · reporte " + new Date().toLocaleString("es-CO"),
      "— Rendimiento —",
      "FPS promedio: " + (avg ? (1000 / avg).toFixed(1) : "—") + " · cuadro medio " + avg.toFixed(1) + " ms · p95 " + p95.toFixed(1) + " ms · 1% peor " + (p99 ? (1000 / p99).toFixed(1) + " fps" : "—"),
      "Calidad: " + calidad + (calidad === "auto" ? " → " + nivelQ + " (calibrado: " + (ls("nexo_qms") || "pendiente") + " ms)" : "") + " · partículas " + cuenta + " · shader " + (Q().lite ? "ligero" : "completo"),
      "Pantalla: " + innerWidth + "×" + innerHeight + " css · DPR dispositivo " + (window.devicePixelRatio || 1) + " · DPR usado " + dpr.toFixed(2) + " · lienzo " + cv.width + "×" + cv.height + " · visualizador x" + Q().vd,
      "GPU: " + gpuTxt,
      "Memoria: " + (navigator.deviceMemory || "?") + " GB · núcleos: " + (navigator.hardwareConcurrency || "?"),
      "Modo holograma: " + (holo ? "sí" : "no") + " · pantalla limpia: " + (limpio ? "sí" : "no"),
      "— Voz y respuesta —",
      "Hasta el primer texto: " + est(M.txt),
      "Hasta que empieza la voz (modo normal): " + est(M.aud),
      "Voz de Gemini (TTS): ok " + M.ttsOk + " · fallos " + M.ttsFail + " · tiempo " + est(M.ttsMs) + (Date.now() - ttsMalo < 300000 ? " · USANDO VOZ DEL NAVEGADOR por fallo reciente" : ""),
      "Voz elegida: " + selVoz.value + " · motor de micrófono: " + motorMic,
      "Modo en vivo: " + (liveOn ? "activado" : "apagado") + " · estado: " + M.live.estado + " · conexión: " + (M.live.setupMs ? M.live.setupMs + " ms" : "—") + " · 1er audio tras tu última palabra: " + est(M.live.audioMs) + " · cierres: " + M.live.cierres + (M.live.ultimo ? " · último cierre: " + M.live.ultimo : ""),
      "Puente de la TV: " + (rokuVivo ? "ha respondido antes" : "nunca ha respondido") + " · " + ROKU_URL + " · último: " + (M.rokuUlt || "—"),
      "— Últimos avisos —"
    ].concat(DL.length ? DL : ["(ninguno)"]).concat(["", "Navegador: " + navigator.userAgent]);
    return L.join("\n");
  }
  var diagT = 0;
  function abrirDiag() { $("diag").classList.add("abierta"); $("diagt").textContent = reporte(); clearInterval(diagT); diagT = setInterval(function () { $("diagt").textContent = reporte(); }, 1000); }
  function cerrarDiag() { $("diag").classList.remove("abierta"); clearInterval(diagT); }
  $("diagx").addEventListener("click", cerrarDiag);
  $("diagc").addEventListener("click", function () {
    var t = reporte(), b = $("diagc");
    function ok() { b.textContent = "¡Copiado!"; setTimeout(function () { b.textContent = "Copiar reporte"; }, 1800); }
    try { navigator.clipboard.writeText(t).then(ok, function () { window.prompt("Copia este reporte:", t); }); } catch (er) { window.prompt("Copia este reporte:", t); }
  });

  // ---------- Modo en vivo: Gemini Live (voz a voz por WebSocket) ----------
  var LIVE_MODEL = "models/gemini-3.1-flash-live-preview";
  var LIVE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=";
  var liveOn = ls("nexo_live") === "1", live = null, liveInt = ls("nexo_liveint") === "1", liveHid = 0;
  $("liveon").checked = liveOn; $("liveint").checked = liveInt;
  $("liveon").addEventListener("change", function (ev) { liveOn = ev.target.checked; ls("nexo_live", liveOn ? "1" : "0"); if (!liveOn && live) liveStop("Modo en vivo apagado."); else if (liveOn) msg("n", "Modo en vivo activado. Toca el círculo para empezar a hablar; vuelve a tocarlo para terminar."); });
  $("liveint").addEventListener("change", function (ev) { liveInt = ev.target.checked; ls("nexo_liveint", liveInt ? "1" : "0"); });
  function marcarLive() { $("orbe").classList.toggle("on", !!live); $("bconv").classList.toggle("on", !!live); }
  function liveToggle() { if (live) liveStop("Modo en vivo detenido."); else liveStart(); }
  function liveStart() {
    if (live) return;
    if (!clave && !pedirClave()) { msg("e", "Necesito tu clave de Gemini."); return; }
    if (!window.isSecureContext || !navigator.mediaDevices || !window.WebSocket) { msg("e", "El modo en vivo necesita una página segura (https) y micrófono."); return; }
    audio(); pararWake(); detenerVoz(); limpiarTm(); if (conv) apagarConv(); if (sr) { srCancel = true; try { sr.abort(); } catch (er) {} } if (grabando) detenerMic(false);
    var L = live = { ws: null, st: null, src: null, pr: null, mute: null, ok: false, tNext: 0, srcs: [], ub: null, nb: null, uT: "", nT: "", hand: null, cerrado: false, tIni: performance.now(), tIn: 0, gateHasta: 0, turnoFin: false, modo: 0, tmo: 0, reconn: false };
    M.live.estado = "conectando"; fijar("procesando"); etiqueta.textContent = "Conectando…"; marcarLive(); pantalla(true);
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (st) {
      if (live !== L) { st.getTracks().forEach(function (x) { x.stop(); }); return; }
      L.st = st; liveAbrir(L);
    }).catch(function (e) { if (live === L) liveStop(mensajeMic(e), true); });
  }
  function liveSetup(L) {
    var voz = selVoz.value === "Navegador" ? "Kore" : selVoz.value;
    var sys = sysAhora(); sys.parts[0].text += " Estás en una conversación de voz en vivo con el usuario: responde en una o dos frases, con voz natural y fluida, siempre con el mismo tono.";
    var st = { model: LIVE_MODEL, generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } } }, systemInstruction: sys, tools: TOOLS };
    if (L.modo === 0) { st.inputAudioTranscription = {}; st.outputAudioTranscription = {}; st.sessionResumption = L.hand ? { handle: L.hand } : {}; st.contextWindowCompression = { slidingWindow: {} }; }
    return { setup: st };
  }
  function liveAbrir(L) {
    var ws; L.ok = false; clearTimeout(L.tmo);
    try { ws = new WebSocket(LIVE_URL + encodeURIComponent(clave)); } catch (er) { liveFallo(L, er.message); return; }
    ws.binaryType = "arraybuffer"; L.ws = ws; var dec = new TextDecoder();
    L.tmo = setTimeout(function () { if (live === L && !L.ok) { dlog("Live: sin respuesta al conectar (10 s)"); try { ws.close(); } catch (er) {} } }, 10000);
    ws.onopen = function () { try { ws.send(JSON.stringify(liveSetup(L))); } catch (er) { liveFallo(L, er.message); } };
    ws.onmessage = function (ev) { var j; try { j = JSON.parse(typeof ev.data === "string" ? ev.data : dec.decode(ev.data)); } catch (er) { return; } try { liveMsg(L, j); } catch (er2) { dlog("Live msg: " + er2.message); } };
    ws.onerror = function () { dlog("Live: error de conexión"); };
    ws.onclose = function (ev) {
      if (live !== L || L.ws !== ws) return; clearTimeout(L.tmo);
      var motivo = (ev.code || "") + " " + (ev.reason || ""); M.live.cierres++; M.live.ultimo = motivo.trim() || "sin motivo"; dlog("Live cerrado: " + motivo);
      if (L.reconn) { L.reconn = false; liveAbrir(L); return; }
      if (!L.ok) { if (L.modo === 0 && !/API key|permission|401|403/i.test(motivo)) { L.modo = 1; M.live.modo = 1; dlog("Live: reintento con configuración mínima"); liveAbrir(L); return; } liveFallo(L, motivo); return; }
      liveStop("Se cortó la conversación en vivo (" + (ev.reason || ev.code || "sin motivo") + "). Tócame para reconectar.", true);
    };
  }
  function liveFallo(L, motivo) {
    if (live !== L) return; liveOn = false; ls("nexo_live", "0"); $("liveon").checked = false;
    liveStop("El modo en vivo no pudo conectar (" + (String(motivo).trim() || "sin detalle") + "). Lo apagué y sigo con el modo normal; el motivo queda en Diagnóstico.", true);
  }
  function b64Int16(pcm) { var u = new Uint8Array(pcm.buffer), s = ""; for (var i = 0; i < u.length; i += 0x2000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x2000)); return btoa(s); }
  function liveMic(L) {
    if (L.pr) return; var a = ac, ratio = a.sampleRate / 16000;
    L.src = a.createMediaStreamSource(L.st); L.pr = a.createScriptProcessor(2048, 1, 1); L.mute = a.createGain(); L.mute.gain.value = 0;
    L.pr.onaudioprocess = function (e) {
      if (live !== L || !L.ok || !L.ws || L.ws.readyState !== 1) return;
      var inp = e.inputBuffer.getChannelData(0), n = Math.floor(inp.length / ratio), pcm = new Int16Array(n), gate = !liveInt && (hablando || performance.now() < L.gateHasta), i, j, s, rms = 0;
      if (!gate) for (i = 0; i < n; i++) { var a0 = Math.floor(i * ratio), b0 = Math.min(inp.length, Math.floor((i + 1) * ratio)); s = 0; for (j = a0; j < b0; j++) s += inp[j]; s /= Math.max(1, b0 - a0); rms += s * s; pcm[i] = lim(s, -1, 1) * 32767; }
      if (!gate) { rms = Math.sqrt(rms / n); if (rms > .02) pulso = Math.max(pulso, Math.min(1.1, rms * 7)); }
      try { L.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64Int16(pcm), mimeType: "audio/pcm;rate=16000" } } })); } catch (er) {}
    };
    L.src.connect(anM); L.src.connect(L.pr); L.pr.connect(L.mute); L.mute.connect(a.destination);
  }
  function liveCortar(L) { L.srcs.forEach(function (s) { try { s.onended = null; s.stop(); } catch (er) {} }); L.srcs = []; L.tNext = 0; hablando = false; L.gateHasta = performance.now() + 300; }
  function liveAudio(L, d) {
    var a = ac, f = b64Pcm(d.data), m = /rate=(\d+)/.exec(d.mimeType || ""), bf = a.createBuffer(1, f.length, m ? +m[1] : 24000);
    bf.copyToChannel(f, 0);
    if (!L.nb) { L.nb = msg("n", "🔊"); L.nT = ""; if (L.tIn) { M.live.audioMs.push(Math.round(performance.now() - L.tIn)); if (M.live.audioMs.length > 20) M.live.audioMs.shift(); } fijar(emo || "respuesta"); L.turnoFin = false; }
    var s = a.createBufferSource(); s.buffer = bf; s.connect(anS); var t0 = Math.max(a.currentTime + .04, L.tNext); s.start(t0); L.tNext = t0 + bf.duration; L.srcs.push(s); hablando = true;
    s.onended = function () { var i = L.srcs.indexOf(s); if (i >= 0) L.srcs.splice(i, 1); if (!L.srcs.length && live === L) { hablando = false; L.gateHasta = performance.now() + 350; if (L.turnoFin) liveFinTurno(L); } };
  }
  function liveFinTurno(L) {
    if (L.uT || L.nT) { hist.push({ role: "user", parts: [{ text: L.uT || "(voz)" }] }, { role: "model", parts: [{ text: L.nT || "(respuesta en voz)" }] }); if (hist.length > 16) hist = hist.slice(-16); ls("nexo_hist", JSON.stringify(hist)); }
    L.ub = null; L.nb = null; L.uT = ""; L.nT = ""; L.turnoFin = false; L.tIn = 0; if (actual !== "error") fijar("escucha");
  }
  function liveMsg(L, j) {
    if (j.setupComplete !== undefined) {
      L.ok = true; clearTimeout(L.tmo); M.live.estado = "en vivo"; M.live.setupMs = Math.round(performance.now() - L.tIni); M.live.modo = L.modo; liveMic(L); fijar("escucha"); pulso = 1;
      if (!L.avisado) { L.avisado = true; msg("n", "En vivo. Háblame con naturalidad." + (liveInt ? "" : " (Espera a que termine de hablar; para cortarme, toca el círculo.)")); }
      return;
    }
    if (j.sessionResumptionUpdate && j.sessionResumptionUpdate.newHandle) L.hand = j.sessionResumptionUpdate.newHandle;
    if (j.goAway) { dlog("Live: el servidor pidió reconectar"); if (!L.reconn && L.ok) { L.reconn = true; L.ok = false; setTimeout(function () { if (live === L && L.ws) { try { L.ws.close(); } catch (er) {} } }, 400); } return; }
    if (j.toolCall && j.toolCall.functionCalls) {
      var fc = j.toolCall.functionCalls; fijar("procesando");
      Promise.all(fc.map(function (c) { return ejecutar(c.name, c.args || {}).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; }); })).then(function (res) {
        if (live !== L || !L.ws || L.ws.readyState !== 1) return;
        L.ws.send(JSON.stringify({ toolResponse: { functionResponses: fc.map(function (c, i) { return { id: c.id, name: c.name, response: { output: res[i] || { ok: false } } }; }) } }));
        if (!hablando) fijar("escucha");
      });
      return;
    }
    var sc = j.serverContent; if (!sc) return;
    if (sc.interrupted) { liveCortar(L); L.nb = null; L.nT = ""; fijar("escucha"); }
    if (sc.inputTranscription && sc.inputTranscription.text) {
      if (L.turnoFin || (L.nb && !hablando)) liveFinTurno(L);
      if (!L.ub) { L.ub = msg("u", "🎤 …"); L.uT = ""; }
      L.uT += sc.inputTranscription.text; L.ub.textContent = L.uT.trim() || "🎤 …"; L.tIn = performance.now(); if (!hablando) fijar("escucha"); pulso = Math.max(pulso, .7);
    }
    if (sc.modelTurn && sc.modelTurn.parts) sc.modelTurn.parts.forEach(function (p) { if (p.inlineData && p.inlineData.data) liveAudio(L, p.inlineData); });
    if (sc.outputTranscription && sc.outputTranscription.text) {
      if (!L.nb) { L.nb = msg("n", ""); L.nT = ""; }
      L.nT += sc.outputTranscription.text; L.nb.textContent = L.nT.trim();
    }
    if (sc.turnComplete) { L.turnoFin = true; if (!L.srcs.length) liveFinTurno(L); }
  }
  function liveStop(texto, err) {
    var L = live; if (!L) return; live = null; clearTimeout(L.tmo); L.cerrado = true; M.live.estado = "apagado";
    try { L.ws.onclose = null; L.ws.onmessage = null; L.ws.close(); } catch (er) {}
    liveCortar(L); try { L.pr.onaudioprocess = null; L.pr.disconnect(); L.src.disconnect(); L.mute.disconnect(); } catch (er2) {}
    if (L.st) L.st.getTracks().forEach(function (x) { x.stop(); });
    hablando = false; marcarLive(); fijar(err ? "error" : "reposo"); if (texto) msg(err ? "e" : "n", texto);
    if (err) tm.push(setTimeout(function () { if (!live) fijar("reposo"); }, 4000));
    if (!conv) pantalla(wakeOn); if (wakeOn) programarWake(900);
  }
  document.addEventListener("visibilitychange", function () {
    clearTimeout(liveHid); if (document.hidden && live) liveHid = setTimeout(function () { liveStop("Detuve el modo en vivo porque la app pasó a segundo plano. Tócame para volver."); }, 25000);
  });


  // ================= v2.1: TV Roku (puente local en Termux) =================
  var ROKU_URL = ls("nexo_roku_url") || "http://127.0.0.1:8765", rokuVivo = ls("nexo_roku_ok") === "1";
  var MSG_PUENTE = "No llego al puente de la TV. Inicia el puente en Termux con ./start_bridge.sh";
  var pendConf = null, esperaConf = false, tConf = 0, tConf2 = 0;
  // Llamada al puente: siempre devuelve un objeto {ok, hecho|error}; si el puente no está, lo dice con una frase clara
  function rokuLlamar(ruta, cuerpo) {
    var ctl = new AbortController(), tt = setTimeout(function () { ctl.abort(); }, 9000), op = { signal: ctl.signal };
    if (cuerpo) { op.method = "POST"; op.headers = { "Content-Type": "application/json" }; op.body = JSON.stringify(cuerpo); }
    return fetch(ROKU_URL + ruta, op).then(function (r) { clearTimeout(tt); return r.json(); }).then(function (j) {
      if (j && typeof j === "object") { rokuVivo = true; ls("nexo_roku_ok", "1"); M.rokuUlt = ruta + " → " + (j.ok === false ? j.error : "ok"); if (j.ok === false) dlog("Roku " + ruta + ": " + j.error); return j; }
      throw new Error("respuesta no válida");
    }).catch(function (e) { clearTimeout(tt); M.rokuUlt = ruta + " → sin puente (" + (e && e.message) + ")"; dlog("Roku: no llego al puente (" + (e && e.message) + ")"); return { ok: false, puente: false, error: MSG_PUENTE }; });
  }
  var roku = {
    estado: function () { return rokuLlamar("/estado"); },
    tecla: function (t) { return rokuLlamar("/tecla", { tecla: t }); },
    volumen: function (accion, veces) { return rokuLlamar("/volumen", { accion: accion, veces: veces || 1 }); },
    app: function (nombre) { return rokuLlamar("/app", { nombre: nombre }); },
    buscar: function (texto) { return rokuLlamar("/buscar", { texto: texto }); },
    escribir: function (texto) { return rokuLlamar("/escribir", { texto: texto }); },
    reproduccion: function (accion) { return rokuLlamar("/reproduccion", { accion: accion }); },
    energia: function (accion) { return rokuLlamar("/energia", { accion: accion }); }
  };
  // El holograma reacciona: texto corto con partículas y emoción de confirmado o error
  function rokuEfecto(j, txt) {
    var bien = !(j && j.ok === false); emo = bien ? "feliz" : "preocupado"; pulso = Math.max(pulso, 1);
    if (bien && txt) { try { local("escribir_con_particulas", { texto: txt, segundos: 2.5 }); } catch (er) {} }
  }
  function rokuMostrar(j) {
    if (j && j.ok === false) { msg("e", j.error); fijar("error"); pulso = 1; decir(j.error); tm.push(setTimeout(function () { fijar("reposo"); }, 4500)); }
    else mostrarResultado(j);
  }
  function txtVol(accion, j) { var n = (j && j.veces) || 1; return /^(sub|up|mas|\+)/i.test(accion) ? "VOL +" + n : /^(baj|down|menos|-)/i.test(accion) ? "VOL -" + n : "MUTE"; }
  // ---- confirmación (voz, texto o botones) antes de acciones sensibles
  function limpiarConf() {
    pendConf = null; esperaConf = false; clearTimeout(tConf); clearTimeout(tConf2);
    ["confs", "confn"].forEach(function (id) { var v = $("acc").querySelector('[data-id="' + id + '"]'); if (v) v.remove(); });
  }
  function pedirConfirmacion(fn) {
    limpiarConf(); pendConf = fn; esperaConf = true; tConf = setTimeout(limpiarConf, 25000);
    chip("✔ Sí, apagar", function () { var f = pendConf; limpiarConf(); if (f) f(); }, "confs");
    chip("✖ No", function () { limpiarConf(); }, "confn");
  }
  function apagarTV() { return roku.energia("apagar").then(function (j) { rokuEfecto(j, "OFF"); return j; }); }
  // ---- herramientas para la IA (mismo mecanismo que las demás)
  function rokuHerr(n, a) {
    if (n === "roku_estado") return roku.estado().then(function (j) { if (j && j.ok !== false) rokuEfecto(j, ""); return j; });
    if (n === "roku_tecla") return roku.tecla(a.tecla).then(function (j) { rokuEfecto(j, /^(play|pausa)$/i.test(a.tecla || "") ? String(a.tecla).toUpperCase() : ""); return j; });
    if (n === "roku_app") return roku.app(a.nombre).then(function (j) { rokuEfecto(j, j && j.app ? String(j.app).toUpperCase().slice(0, 12) : ""); return j; });
    if (n === "roku_volumen") return roku.volumen(a.accion, a.veces).then(function (j) { rokuEfecto(j, txtVol(String(a.accion || ""), j)); return j; });
    if (n === "roku_buscar") return roku.buscar(a.texto).then(function (j) { rokuEfecto(j, "BUSCAR"); return j; });
    if (n === "roku_escribir") return roku.escribir(a.texto).then(function (j) { rokuEfecto(j, ""); return j; });
    if (n === "roku_energia") {
      if (/^(apag|off)/i.test(norm(a.accion || ""))) {
        if (a.confirmado === true) { limpiarConf(); return apagarTV(); }
        pedirConfirmacion(function () { apagarTV().then(rokuMostrar); });
        return { ok: true, pendiente: true, hecho: "Falta confirmar. Pregunta al usuario si quiere apagar la TV y no la apagues hasta que diga que sí." };
      }
      return roku.energia("encender").then(function (j) { rokuEfecto(j, "ON"); return j; });
    }
    return { ok: false, error: "Herramienta desconocida" };
  }
  // ---- comandos instantáneos, sin IA
  var NUMR = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  var TELE = "(?:tele|tv|television|televisor|roku)", PRE = "^(?:oye |nexo |por favor )*";
  var RX_VOL = new RegExp(PRE + "(sube|subele|aumenta|aumentale|baja|bajale|reduce|disminuye)(?: un poco| mas| otro poco)?(?: el| al| a la)? ?volumen(?: (?:de|a) la " + TELE + "| del televisor)?(?: (\\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)(?: veces| pasos| niveles| rayitas| puntos)?)?(?: por favor)?$");
  var RX_VOL2 = new RegExp(PRE + "(mas|menos) volumen(?: (?:de|a) la " + TELE + ")?$");
  var RX_MUTE = new RegExp(PRE + "(?:silencia|mutea|silenciar|mutear|mute|silencio|sin sonido|quita el sonido|quitale el sonido)(?: (?:a |de )?(?:la |el )?" + TELE + ")?(?: por favor)?$");
  var RX_PAUSA = new RegExp(PRE + "(?:pausa|pausar|pausalo|pausala|pon pausa|detenlo|para el video|pausa el video)(?: (?:a |de )?(?:la |el )?" + TELE + ")?(?: por favor)?$");
  var RX_PLAY = new RegExp(PRE + "(?:play|dale play|pon play|reanuda|reanudar|continua|continuar|sigue|reproduce|reproducir|quita la pausa)(?: (?:a |de )?(?:la |el )?" + TELE + "| el video)?(?: por favor)?$");
  var RX_HOME = new RegExp(PRE + "(?:ve |ir |regresa |vuelve |llevame )?(?:al |a )?(?:inicio|home|menu principal|pantalla principal)(?: de la " + TELE + ")?$");
  var RX_APP = new RegExp(PRE + "(?:abre|abrir|pon|ponme|ponla|prende|lanza|inicia|ve a|enciende)(?: la app de| la aplicacion de| la app| el| la)? ?(youtube|netflix|disney(?: plus| \\+|\\+)?|prime(?: video)?|amazon prime|amazon|hbo(?: max)?|max|spotify)(?: (?:en|de) (?:la )?" + TELE + ")?(?: por favor)?$");
  var RX_OFF = new RegExp(PRE + "(?:apaga|apagar|desactiva|apagame)(?: la| el)? ?" + TELE + "(?: por favor)?$");
  var RX_ON = new RegExp(PRE + "(?:enciende|encender|prende|prender|activa|enciendeme)(?: la| el)? ?" + TELE + "(?: por favor)?$");
  function rokuRapido(s, m) {
    if (pendConf) {
      if (/^(si|claro|dale|ok|okay|vale|confirmo|confirmado|hazlo|adelante|afirmativo|apagala|apagalo|si apagala|si apagalo|si por favor|si apaga)( por favor| gracias)?$/.test(m)) { msg("u", s); var f = pendConf; limpiarConf(); f(); return true; }
      if (/^(no|nel|cancela|cancelar|cancelalo|mejor no|no gracias|detente|olvidalo|negativo|no la apagues|no apagues)( gracias| por favor)?$/.test(m)) { msg("u", s); limpiarConf(); mostrarResultado({ ok: true, hecho: "De acuerdo, no la apago." }); return true; }
      limpiarConf();
    }
    var tele = new RegExp("\\b" + TELE + "\\b").test(m), base = tele || (rokuVivo && !(med && !med.paused && !med.ended)), r;
    function ir(prom, viz) { msg("u", s); fijar("procesando"); prom.then(function (j) { rokuEfecto(j, viz ? viz(j) : ""); rokuMostrar(j); }); return true; }
    if (RX_OFF.test(m)) {
      msg("u", s); var q = "¿Apago la tele? Dime sí o no.";
      pedirConfirmacion(function () { fijar("procesando"); apagarTV().then(rokuMostrar); }); msg("n", q); fijar("respuesta"); pulso = 1; decir(q); return true;
    }
    if (RX_ON.test(m)) return ir(roku.energia("encender"), function () { return "ON"; });
    if (!base) return false;
    if ((r = RX_VOL.exec(m))) {
      var n = r[2] ? (/^\d+$/.test(r[2]) ? +r[2] : NUMR[r[2]]) : 3, acc = /^(sube|subele|aumenta|aumentale)$/.test(r[1]) ? "subir" : "bajar";
      return ir(roku.volumen(acc, n), function (j) { return txtVol(acc, j); });
    }
    if ((r = RX_VOL2.exec(m))) { var ac2 = r[1] === "mas" ? "subir" : "bajar"; return ir(roku.volumen(ac2, 3), function (j) { return txtVol(ac2, j); }); }
    if (RX_MUTE.test(m)) return ir(roku.volumen("mute", 1), function () { return "MUTE"; });
    if (RX_PAUSA.test(m)) return ir(roku.reproduccion("pausa"), function () { return "PAUSA"; });
    if (RX_PLAY.test(m)) return ir(roku.reproduccion("play"), function () { return "PLAY"; });
    if (RX_HOME.test(m)) return ir(roku.tecla("home"), function () { return ""; });
    if ((r = RX_APP.exec(m))) return ir(roku.app(r[1]), function (j) { return j && j.app ? String(j.app).toUpperCase().slice(0, 12) : ""; });
    return false;
  }
  // Botón del menú: probar la conexión con la TV
  $("hoja").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-a=roku]") : null; if (!b) return;
    msg("n", "Probando la conexión con la TV…"); roku.estado().then(function (j) { if (j && j.ok !== false) { rokuEfecto(j, "TV OK"); mostrarResultado({ ok: true, hecho: j.hecho }); } else rokuMostrar(j); });
  });

})();
