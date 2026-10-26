/* Dial it: Air screen: conditions, density altitude, weather lookup. */
"use strict";

/* ===== air ===== */
function airState() {
  var a = L.air,
    t = num(a.t),
    p = num(a.p),
    alt = num(a.alt),
    rh = num(a.rh);
  if (!(isFinite(t) && isFinite(p) && isFinite(alt))) return null;
  var tc = a.tU === "F" ? ((t - 32) * 5) / 9 : t,
    hpa = a.pU === "inHg" ? p * 33.8639 : p,
    altM = a.altU === "ft" ? alt * 0.3048 : alt;
  if (!isFinite(rh)) rh = 0;
  rh = Math.max(0, Math.min(100, rh));
  if (tc < -40 || tc > 55 || altM < -500 || altM > 6000) return null;
  var stn = a.pT === "qnh" ? hpa * Math.pow(1 - 2.25577e-5 * altM, 5.25588) : hpa;
  if (stn < 500 || stn > 1100) return null;
  var tk = tc + 273.15,
    es = 6.1078 * Math.pow(10, (7.5 * tc) / (tc + 237.3)),
    pv = (rh / 100) * es,
    pd = stn - pv;
  var rho = (pd * 100) / (287.058 * tk) + (pv * 100) / (461.495 * tk),
    c = Math.sqrt(1.4 * 287.05 * tk);
  return {
    rho: rho,
    c: c,
    tc: tc,
    stn: stn,
    altM: altM,
    rh: rh,
    daFt: (1 - Math.pow(rho / 1.225, 0.234969)) * 145442.16,
  };
}
function airNow() {
  if (!L.air.use) return { rho: STD_AIR.rho, c: STD_AIR.c, tc: STD_AIR.tc, std: true };
  var s = airState();
  if (!s) return { rho: STD_AIR.rho, c: STD_AIR.c, tc: STD_AIR.tc, std: true, bad: true };
  return s;
}
function daStr(ft) {
  return L.air.altU === "ft" ? Math.round(ft / 50) * 50 + " ft" : Math.round((ft * 0.3048) / 10) * 10 + " m";
}
function airShort() {
  var a = L.air,
    s = airNow();
  if (s.bad) return "Standard air (check air values)";
  if (s.std) return "Standard air";
  return (
    a.t +
    "°" +
    a.tU +
    ", " +
    a.p +
    " " +
    a.pU +
    (a.pT === "qnh" ? " QNH" : " here") +
    ", " +
    a.alt +
    " " +
    a.altU +
    ", " +
    Math.round(s.rh) +
    "% RH"
  );
}
function paintAirCard() {
  var s = airNow();
  $("acMain").textContent = airShort();
  if (s.bad) $("acSub").textContent = "Some air values are missing or off. Tap to fix.";
  else if (s.std) $("acSub").textContent = "15°C at sea level. Tap to use the real conditions.";
  else
    $("acSub").textContent =
      "Density altitude " + daStr(s.daFt) + (L.air.at ? ". Weather from " + hhmm(L.air.at) : ". Typed in");
}
function paintAir() {
  var a = L.air;
  setSeg($("airUse"), a.use ? "on" : "std");
  paintSegGroup("data-akey", a);
  [
    ["aT", "t"],
    ["aP", "p"],
    ["aAlt", "alt"],
    ["aRh", "rh"],
  ].forEach(function (f) {
    if (document.activeElement !== $(f[0])) $(f[0]).value = a[f[1]];
  });
  paintAirOut();
}
function paintAirOut() {
  var s = airState();
  ["aT", "aP", "aAlt"].forEach(function (id) {
    $(id).classList.toggle("bad", !s && !isFinite(num($(id).value)));
  });
  $("aDA").textContent = s ? daStr(s.daFt) : "–";
  $("aRho").textContent = s ? fmt(s.rho, 3) + " kg/m³" : "–";
  if (!s && !$("wxMsg").textContent)
    $("wxMsg").textContent = "Check the values. Temperature, pressure and altitude are all needed.";
}
segVal($("airUse"), function (v) {
  L.air.use = v === "on";
  saveL();
  paintAir();
});
[
  ["aT", "t"],
  ["aP", "p"],
  ["aAlt", "alt"],
  ["aRh", "rh"],
].forEach(function (f) {
  $(f[0]).addEventListener("input", function () {
    L.air[f[1]] = $(f[0]).value;
    L.air.at = 0;
    $("wxMsg").textContent = "";
    saveL();
    paintAirOut();
  });
});
document.querySelectorAll(".seg[data-akey]").forEach(function (seg) {
  var key = seg.getAttribute("data-akey");
  segVal(seg, function (v) {
    var a = L.air,
      x;
    if (a[key] === v) return;
    if (key === "tU" && isFinite((x = num(a.t)))) a.t = round(v === "F" ? (x * 9) / 5 + 32 : ((x - 32) * 5) / 9, 1);
    if (key === "pU" && isFinite((x = num(a.p))))
      a.p = round(v === "inHg" ? x / 33.8639 : x * 33.8639, v === "inHg" ? 2 : 0);
    if (key === "altU" && isFinite((x = num(a.alt)))) a.alt = round(v === "ft" ? x / 0.3048 : x * 0.3048, 0);
    a[key] = v;
    saveL();
    paintAir();
  });
});
$("getWx").addEventListener("click", function () {
  var msg = $("wxMsg"),
    btn = this;
  if (!navigator.geolocation) {
    msg.textContent = "This phone won't share location here. Type the values in.";
    return;
  }
  btn.disabled = true;
  msg.textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var c = pos.coords,
        a = L.air,
        gotAlt = c.altitude !== null && isFinite(c.altitude);
      if (gotAlt) a.alt = round(a.altU === "ft" ? c.altitude / 0.3048 : c.altitude, 0);
      if (!navigator.onLine) {
        btn.disabled = false;
        a.use = true;
        saveL();
        paintAir();
        msg.textContent = gotAlt
          ? "No signal. Altitude set from GPS. Type temperature and pressure in."
          : "No signal and no GPS altitude. Type the values in.";
        return;
      }
      msg.textContent = "Getting weather…";
      fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=" +
          c.latitude.toFixed(4) +
          "&longitude=" +
          c.longitude.toFixed(4) +
          "&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms",
      )
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(function (j) {
          var cur = j.current || {};
          if (!isFinite(cur.temperature_2m) || !isFinite(cur.pressure_msl)) throw new Error("no data");
          a.t = round(a.tU === "F" ? (cur.temperature_2m * 9) / 5 + 32 : cur.temperature_2m, 1);
          a.p = a.pU === "inHg" ? round(cur.pressure_msl / 33.8639, 2) : round(cur.pressure_msl, 0);
          a.pT = "qnh";
          if (isFinite(cur.relative_humidity_2m)) a.rh = round(cur.relative_humidity_2m, 0);
          if (!gotAlt && isFinite(j.elevation)) a.alt = round(a.altU === "ft" ? j.elevation / 0.3048 : j.elevation, 0);
          a.wMs = isFinite(cur.wind_speed_10m) ? cur.wind_speed_10m : null;
          a.wFrom = isFinite(cur.wind_direction_10m) ? cur.wind_direction_10m : null;
          a.use = true;
          a.at = now();
          a.src = c.latitude.toFixed(3) + ", " + c.longitude.toFixed(3);
          saveL();
          var wtxt =
            a.wMs !== null
              ? " Wind " +
                round(a.wMs / windToMs(1, L.windU), 0) +
                " " +
                L.windU +
                " from " +
                Math.round(a.wFrom) +
                "°."
              : "";
          msg.textContent =
            "Updated " +
            hhmm(now()) +
            " for " +
            a.src +
            ". Altitude from " +
            (gotAlt ? "GPS" : "map height") +
            "." +
            wtxt;
          paintAir();
        })
        .catch(function () {
          a.use = true;
          saveL();
          paintAir();
          msg.textContent =
            "Couldn't get the weather." +
            (gotAlt ? " Altitude set from GPS." : "") +
            " Type temperature and pressure in.";
        })
        .finally(function () {
          btn.disabled = false;
        });
    },
    function (err) {
      btn.disabled = false;
      msg.textContent =
        err.code === 1
          ? "Location is off for this app. Allow it in Settings, or type the values in."
          : "Couldn't find your location. Type the values in.";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
});
