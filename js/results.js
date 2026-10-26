/* Dial it: Firing solution and the results screen. */
"use strict";

/* ===== maths ===== */
function inSys(rad, sys) {
  return sys === "MIL" ? rad * 1000 : rad / MOA_RAD;
}
function clickOf(p, sys) {
  return sys === "MIL" ? p.clkMIL : p.clkMOA;
}
function clkName(v) {
  return v === 0.25 ? "1/4" : v === 0.125 ? "1/8" : String(v);
}
function lenStr(m, u) {
  u = u || L.missU;
  var f = { in: 39.3701, mm: 1000, cm: 100 }[u],
    dp = u === "mm" ? 0 : 1;
  return fmt(Math.abs(m * f), dp) + " " + u;
}
/* Powder temperature change in m/s per °C, or 0 when off. */
function tempSens(p) {
  var s = num(p.tSens);
  if (!(s > 0) || !isFinite(num(p.mvT))) return 0;
  return s * (p.mvU === "fps" ? MS_PER_FPS : 1) * (p.mvTU === "F" ? 9 / 5 : 1);
}
function tempC(v, u) {
  return u === "F" ? ((v - 32) * 5) / 9 : v;
}
/* Rifle numbers in SI. With air given, the muzzle speed is moved for powder temperature (taken as the air temperature). */
function ballistics(p, air) {
  var v0 = num(p.mv) * (p.mvU === "fps" ? MS_PER_FPS : 1),
    nowC = air ? (isFinite(air.tc) ? air.tc : STD_AIR.tc) : NaN;
  return {
    v0: tempSpeed(v0, tempSens(p), tempC(num(p.mvT), p.mvTU), nowC),
    v00: v0,
    bc: num(p.bc),
    table: p.drag === "G7" ? G7 : G1,
    sh: num(p.sh) * (p.shU === "in" ? 0.0254 : 0.001),
    zm: num(p.zero) * (p.zeroU === "yd" ? M_PER_YD : 1),
  };
}
/* Firing solution at range dm. Returns hold (rad, + up), wind (rad, + = dial right, wind and spin drift together),
   windOnly and spinHold (the two parts), drop (m), spin (m, + = right), v0 (m/s used), at. */
function solve(p, dm, o) {
  var air = o.air || STD_AIR,
    b = ballistics(p, air);
  var za = o.za !== undefined ? o.za : zeroAngle(b.v0, b.bc, b.table, b.sh, b.zm, air);
  var at = fly(za, b.v0, b.bc, b.table, b.sh, dm, { air: air, wx: o.wx, wz: o.wz, inc: o.inc });
  if (!at) return { at: null, za: za, v0: b.v0 };
  var spin = spinDrift(at.t, num(p.sg) > 0 ? num(p.sg) : 1.5, p.twist),
    windOnly = -Math.atan(at.z / dm),
    spinHold = -Math.atan(spin / dm);
  return {
    at: at,
    za: za,
    v0: b.v0,
    hold: -Math.atan(at.y / dm),
    wind: -Math.atan((at.z + spin) / dm),
    windOnly: windOnly,
    spinHold: spinHold,
    spin: spin,
    drop: -at.y,
  };
}
function compute() {
  var p = prof(),
    air = airNow(),
    w = windParts();
  var dm = num(L.dist) * (L.distU === "yd" ? M_PER_YD : 1),
    inc = (num(L.ang) * Math.PI) / 180 || 0;
  var toM = { in: 0.0254, mm: 0.001, cm: 0.01 }[L.missU];
  var vM = (num(L.missV) || 0) * toM,
    hM = (num(L.missH) || 0) * toM;
  var s = solve(p, dm, { air: air, wx: w.wx, wz: w.wz, inc: inc });
  var flat = inc ? solve(p, dm, { air: air, za: s.za }) : s;
  return {
    p: p,
    air: air,
    dm: dm,
    inc: inc,
    s: s,
    flat: flat,
    corrE: Math.atan(vM / dm) * (L.vDir === "low" ? 1 : -1),
    corrW: Math.atan(hM / dm) * (L.hDir === "right" ? -1 : 1),
    hasMiss: vM > 0 || hM > 0,
  };
}

function turretSVG(clicks, clockwise) {
  var deg = Math.min(Math.abs(clicks) * 9, 340),
    a = ((deg * Math.PI) / 180) * (clockwise ? 1 : -1);
  var ex = 140 + 96 * Math.sin(a),
    ey = 140 - 96 * Math.cos(a);
  var arc =
    deg > 0.5
      ? '<path d="M140 44 A96 96 0 ' +
        (deg > 180 ? 1 : 0) +
        " " +
        (clockwise ? 1 : 0) +
        " " +
        ex.toFixed(1) +
        " " +
        ey.toFixed(1) +
        '" fill="none" stroke="#C24A0A" stroke-width="7" stroke-linecap="round"></path>'
      : "";
  return (
    '<svg viewBox="0 0 280 280" aria-hidden="true"><path d="M140 2 L130 18 L150 18 Z" fill="#C24A0A"></path>' +
    '<circle cx="140" cy="140" r="118" fill="#2B2E2B"></circle><circle cx="140" cy="140" r="118" fill="none" stroke="#4A4F49" stroke-width="10" stroke-dasharray="3 3"></circle>' +
    '<circle cx="140" cy="140" r="102" fill="#353935"></circle>' +
    '<circle cx="140" cy="140" r="96" fill="none" stroke="#C9CEC2" stroke-width="10" stroke-dasharray="1.5 13.58" transform="rotate(-90 140 140)"></circle>' +
    '<circle cx="140" cy="140" r="93" fill="none" stroke="#F2F4EE" stroke-width="16" stroke-dasharray="2.5 143.6" transform="rotate(-90 140 140)"></circle>' +
    arc +
    "</svg>"
  );
}
function setDial(el, clicks, word, clockwise, aria) {
  var w = Math.round(Math.abs(clicks));
  el.innerHTML =
    turretSVG(w, clockwise) +
    '<div class="face"><div class="n">' +
    w +
    '</div><div class="w">' +
    (w === 1 ? "click " : "clicks ") +
    word +
    "</div></div>";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", aria);
}
/* Reticle with the hold point. hx: + = hold right, hy: + = hold high. Units are the turret system. */
function reticleSVG(hx, hy, sys) {
  var span = Math.max(Math.abs(hx), Math.abs(hy)) * 1.25,
    unit = sys === "MIL" ? 1 : 2;
  span = Math.max(span, sys === "MIL" ? 2 : 6);
  var major = sys === "MIL" ? (span > 8 ? 2 : 1) : span > 24 ? 8 : span > 12 ? 4 : 2,
    minor = major / 2;
  var R = 110,
    c = 120,
    sc = R / span,
    h = '<svg viewBox="0 0 240 240" role="img" aria-label="Reticle showing where to hold">';
  h += '<circle cx="120" cy="120" r="118" fill="#F2F4EE" stroke="#1E2A1F" stroke-width="1.5"></circle>';
  h +=
    '<line x1="4" y1="120" x2="236" y2="120" stroke="#1E2A1F" stroke-width="1"></line><line x1="120" y1="4" x2="120" y2="236" stroke="#1E2A1F" stroke-width="1"></line>';
  for (var v = minor; v <= span + 1e-9; v += minor) {
    var isMaj = Math.abs(v / major - Math.round(v / major)) < 1e-6,
      len = isMaj ? 8 : 4,
      d = v * sc;
    [
      [c + d, c],
      [c - d, c],
    ].forEach(function (q) {
      h +=
        '<line x1="' +
        q[0].toFixed(1) +
        '" y1="' +
        (c - len) +
        '" x2="' +
        q[0].toFixed(1) +
        '" y2="' +
        (c + len) +
        '" stroke="#1E2A1F" stroke-width="1"></line>';
    });
    [
      [c, c + d],
      [c, c - d],
    ].forEach(function (q) {
      h +=
        '<line x1="' +
        (c - len) +
        '" y1="' +
        q[1].toFixed(1) +
        '" x2="' +
        (c + len) +
        '" y2="' +
        q[1].toFixed(1) +
        '" stroke="#1E2A1F" stroke-width="1"></line>';
    });
    if (isMaj && d < 104) {
      h +=
        '<text x="' +
        (c + d).toFixed(1) +
        '" y="' +
        (c + 20) +
        '" font-size="9" text-anchor="middle" fill="#4A5547" font-family="Archivo, sans-serif">' +
        round(v, 1) +
        "</text>";
      h +=
        '<text x="' +
        (c + 12) +
        '" y="' +
        (c + d + 3).toFixed(1) +
        '" font-size="9" fill="#4A5547" font-family="Archivo, sans-serif">' +
        round(v, 1) +
        "</text>";
    }
  }
  var px = c + hx * sc,
    py = c - hy * sc;
  h +=
    '<circle cx="' +
    px.toFixed(1) +
    '" cy="' +
    py.toFixed(1) +
    '" r="6" fill="#C24A0A"></circle><circle cx="' +
    px.toFixed(1) +
    '" cy="' +
    py.toFixed(1) +
    '" r="11" fill="none" stroke="#C24A0A" stroke-width="1.5"></circle>';
  return h + "</svg>";
}

var last = null;
function hitText() {
  var m = [];
  if (num(L.missV) > 0) m.push(L.missV + " " + L.missU + " " + L.vDir);
  if (num(L.missH) > 0) m.push(L.missH + " " + L.missU + " " + L.hDir);
  return m.length ? m.join(", ") : "On aim";
}
function dirWord(v, pos, neg) {
  return Math.abs(v) < 1e-9 ? "" : v > 0 ? pos : neg;
}
function showResults(mode) {
  var R = compute();
  last = R;
  var p = R.p,
    sys = p.sys,
    other = sys === "MIL" ? "MOA" : "MIL";
  if (!R.s.at) {
    toast("Out of range for this load");
    return;
  }
  mode = mode || (R.hasMiss ? "fix" : "sol");
  L.resMode = mode;
  setSeg($("resMode"), mode);
  var clk = clickOf(p, sys),
    oclk = clickOf(p, other);
  var eRad = mode === "fix" ? R.corrE : R.s.hold,
    wRad = mode === "fix" ? R.corrW : R.s.wind;
  var eA = inSys(eRad, sys),
    wA = inSys(wRad, sys),
    eC = eA / clk,
    wC = wA / clk;
  var eW = Math.round(Math.abs(eC)) < 1 ? "" : dirWord(eA, "up", "down"),
    wW = Math.round(Math.abs(wC)) < 1 ? "" : dirWord(wA, "right", "left");
  var wind = num(L.windS) > 0 ? ", wind " + L.windS + " " + L.windU + " from " + L.windClock : "";
  var angT = R.inc ? ", " + L.ang + "° " + (R.inc > 0 ? "up" : "down") : "";
  $("summary").textContent =
    (mode === "fix" ? hitText() + " at " : "") +
    L.dist +
    " " +
    L.distU +
    angT +
    wind +
    ". " +
    (p.name || "Rifle") +
    ", zero " +
    p.zero +
    " " +
    p.zeroU;
  setDial($("dialE"), eC, eW, eA >= 0, "Elevation: dial " + Math.round(Math.abs(eC)) + " clicks " + (eW || "none"));
  setDial($("dialW"), wC, wW, wA >= 0, "Windage: dial " + Math.round(Math.abs(wC)) + " clicks " + (wW || "none"));
  $("valE").textContent = fmt(Math.abs(eA), 2) + " " + sys;
  $("exE").textContent = fmt(Math.abs(eC), 1) + " clicks exact";
  $("valW").textContent = fmt(Math.abs(wA), 2) + " " + sys;
  $("exW").textContent = fmt(Math.abs(wC), 1) + " clicks exact";
  $("clkNote").textContent =
    (mode === "fix" ? "Correction from where it hit. " : "Dial from your zero. ") +
    "At " +
    clkName(clk) +
    " " +
    sys +
    " per click, rounded to whole clicks";
  // reticle hold: dialling right = holding right
  $("reticle").innerHTML =
    reticleSVG(wA, eA, sys) +
    "<p>Or hold " +
    (Math.abs(eA) < 0.005 ? "" : fmt(Math.abs(eA), 1) + " " + sys + " " + (eA > 0 ? "high" : "low")) +
    (Math.abs(eA) >= 0.005 && Math.abs(wA) >= 0.005 ? ", " : "") +
    (Math.abs(wA) < 0.005 ? "" : fmt(Math.abs(wA), 1) + " " + sys + " " + (wA > 0 ? "right" : "left")) +
    (Math.abs(eA) < 0.005 && Math.abs(wA) < 0.005 ? "on the crosshair" : "") +
    "</p>";
  var oE = Math.round(inSys(eRad, other) / oclk),
    oW = Math.round(inSys(wRad, other) / oclk),
    parts = [];
  if (oE) parts.push(Math.abs(oE) + " " + (oE > 0 ? "up" : "down"));
  if (oW) parts.push(Math.abs(oW) + " " + (oW > 0 ? "right" : "left"));
  $("otherK").textContent = "Same in " + other + " clicks";
  $("otherV").textContent = parts.length ? parts.join(", ") : "No change";
  var f = [];
  if (eW) f.push(Math.round(Math.abs(eC)) + " " + eW);
  if (wW) f.push(Math.round(Math.abs(wC)) + " " + wW);
  R.fixText = f.length ? (mode === "fix" ? "dialled " : "dial ") + f.join(", ") + " (" + sys + ")" : "";
  var mu = L.missU;
  $("dropV").textContent = lenStr(R.s.drop, mu) + (R.s.drop >= 0 ? " low" : " high");
  $("driftV").textContent =
    Math.abs(R.s.at.z) < 0.0005 ? "None" : lenStr(R.s.at.z, mu) + " " + (R.s.at.z > 0 ? "right" : "left");
  $("spinLi").hidden = !p.twist;
  $("spinV").textContent =
    Math.abs(R.s.spin) < 0.0005
      ? "None"
      : lenStr(R.s.spin, mu) + " " + (R.s.spin > 0 ? "right" : "left") + (mode === "fix" ? "" : ", in the windage");
  var su = p.mvU === "fps" ? MS_PER_FPS : 1,
    sUnit = p.mvU === "fps" ? "fps" : "m/s";
  $("mvLi").hidden = !tempSens(p);
  $("mvV").textContent =
    Math.round(R.s.v0 / su) + " " + sUnit + " (powder " + Math.round(R.air.tc) + "°C, set " + p.mv + ")";
  var mach = R.s.at.mach;
  $("transNote").hidden = mach >= TRANSONIC;
  $("transNote").textContent =
    mach < 1
      ? "The bullet is below the speed of sound here (Mach " +
        fmt(mach, 2) +
        "). It may tumble or spread; treat the dial as a guess and confirm with a shot."
      : "The bullet is close to the speed of sound here (Mach " +
        fmt(mach, 2) +
        "). Expect more spread, and confirm the dial with a shot.";
  if (R.inc) {
    var dh = inSys(R.flat.hold - R.s.hold, sys);
    $("angV").textContent = L.ang + "°, " + fmt(Math.abs(dh), 2) + " " + sys + " less than flat";
  } else $("angV").textContent = "Flat";
  $("velV").textContent =
    Math.round(R.s.at.v / su) + " " + sUnit + ", Mach " + fmt(mach, 2) + ", " + fmt(R.s.at.t, 2) + " s";
  var an = R.air;
  R.airText = airShort() + (an.std ? "" : ", DA " + daStr(an.daFt)) + (num(L.windS) > 0 ? ". " + windWords() : "");
  $("airV").textContent = an.std
    ? an.bad
      ? "Standard (check air)"
      : "Standard"
    : Math.round(an.tc) + "°C, DA " + daStr(an.daFt);
  saveL();
  show("vRes");
}
$("go").addEventListener("click", function () {
  if (check()) showResults();
});
segVal($("resMode"), function (v) {
  showResults(v);
});
