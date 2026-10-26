/* Dial it: Dial screen: target, angle, wind clock, where it hit, phone sensors. */
"use strict";

/* ===== theme: day, or night (red on black) ===== */
function applyTheme() {
  var night = L.theme === "night";
  document.documentElement.setAttribute("data-theme", night ? "night" : "day");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", night ? "#0a0303" : "#E4E7DC");
  $("themeBtn").setAttribute("aria-pressed", String(night));
}
$("themeBtn").addEventListener("click", function () {
  L.theme = L.theme === "night" ? "day" : "night";
  saveL();
  applyTheme();
});

/* ===== dial screen ===== */
function paintSegGroup(attr, src) {
  document.querySelectorAll(".seg[" + attr + "]").forEach(function (seg) {
    setSeg(seg, src[seg.getAttribute(attr)]);
  });
}
function rifleSummary(p) {
  return (
    "Zero " +
    p.zero +
    " " +
    p.zeroU +
    ", " +
    p.mv +
    " " +
    (p.mvU === "fps" ? "fps" : "m/s") +
    ", " +
    p.drag +
    " " +
    p.bc
  );
}
function paintDial() {
  var p = prof();
  $("rcName").textContent = p.name || "Unnamed rifle";
  $("rcSum").textContent = (p.load ? p.load + ". " : "") + rifleSummary(p);
  document.querySelectorAll("[data-sys]").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.getAttribute("data-sys") === p.sys));
  });
  paintSegGroup("data-lkey", L);
  ["dist", "missV", "missH", "ang", "windS"].forEach(function (id) {
    if (document.activeElement !== $(id)) $(id).value = L[id];
  });
  paintAirCard();
  paintPad();
  paintClock();
  check();
}
document.querySelectorAll(".seg[data-lkey]").forEach(function (seg) {
  var key = seg.getAttribute("data-lkey");
  segVal(seg, function (v) {
    if (key === "windU") {
      var s = num(L.windS);
      if (isFinite(s)) L.windS = round(windToMs(s, L.windU) / windToMs(1, v), 1);
    }
    L[key] = v;
    saveL();
    paintDial();
  });
});
document.querySelectorAll("[data-sys]").forEach(function (b) {
  b.addEventListener("click", function () {
    var p = prof();
    p.sys = b.getAttribute("data-sys");
    p.u = now();
    changed();
    paintDial();
  });
});
$("rifleCard").addEventListener("click", function () {
  openKit("rifles");
});
$("airCard").addEventListener("click", function () {
  openView("vAir");
});
$("openPhoto").addEventListener("click", function () {
  openPhoto();
});
["dist", "missV", "missH", "ang", "windS"].forEach(function (id) {
  $(id).addEventListener("input", function () {
    L[id] = $(id).value;
    saveL();
    paintPad();
    paintClock();
    check();
  });
});

var PAD = { in: { r: 4, step: 0.25 }, mm: { r: 100, step: 5 }, cm: { r: 10, step: 0.5 } };
function paintPad() {
  var p = PAD[L.missU] || PAD["in"];
  var v = num(L.missV),
    h = num(L.missH);
  if (!(v >= 0)) v = 0;
  if (!(h >= 0)) h = 0;
  var sx = (L.hDir === "right" ? 1 : -1) * h,
    sy = (L.vDir === "low" ? 1 : -1) * v,
    scale = 78 / p.r,
    len = Math.sqrt(sx * sx + sy * sy) * scale;
  var cx = 84 + sx * scale,
    cy = 84 + sy * scale;
  if (len > 78) {
    cx = 84 + ((cx - 84) * 78) / len;
    cy = 84 + ((cy - 84) * 78) / len;
  }
  $("hitDot").setAttribute("cx", cx.toFixed(1));
  $("hitDot").setAttribute("cy", cy.toFixed(1));
  $("hitLine").setAttribute("x2", cx.toFixed(1));
  $("hitLine").setAttribute("y2", cy.toFixed(1));
  $("padScale").textContent = "edge " + p.r + " " + L.missU;
}
$("pad").addEventListener("click", function (e) {
  if (e.detail === 0) return;
  var r = this.getBoundingClientRect(),
    px = ((e.clientX - r.left) / r.width) * 168 - 84,
    py = ((e.clientY - r.top) / r.height) * 168 - 84;
  var p = PAD[L.missU] || PAD["in"],
    scale = 78 / p.r;
  function snap(n) {
    return Math.round(n / p.step) * p.step;
  }
  L.hDir = px >= 0 ? "right" : "left";
  L.vDir = py >= 0 ? "low" : "high";
  L.missH = String(+snap(Math.abs(px) / scale).toFixed(2));
  L.missV = String(+snap(Math.abs(py) / scale).toFixed(2));
  saveL();
  paintDial();
});

/* wind clock: L.windClock = where the wind comes FROM, 1 to 12, 12 = from the target */
function windToMs(s, u) {
  return u === "mph" ? s * 0.44704 : u === "kmh" ? s / 3.6 : s;
}
function windParts() {
  var s = num(L.windS),
    ms = isFinite(s) && s > 0 ? windToMs(s, L.windU) : 0,
    th = ((L.windClock % 12) * Math.PI) / 6;
  return { ms: ms, cross: ms * Math.sin(th), head: ms * Math.cos(th), wz: -ms * Math.sin(th), wx: -ms * Math.cos(th) };
}
function windWords() {
  var s = num(L.windS);
  if (!(s > 0)) return "No wind";
  var w = windParts(),
    full = Math.abs(w.cross) / w.ms,
    val =
      full > 0.95 ? "full value" : full > 0.6 ? "most of it across" : full > 0.2 ? "partly across" : "along the shot";
  return L.windS + " " + L.windU + " from " + (L.windClock || 12) + " o'clock, " + val;
}
function paintClock() {
  var s = num(L.windS),
    g = $("windArrow");
  if (!(s > 0)) {
    g.innerHTML = "";
    $("windOut").textContent = "Tap the clock for where it comes from.";
    return;
  }
  var th = ((L.windClock % 12) * Math.PI) / 6,
    ox = 60 + 44 * Math.sin(th),
    oy = 60 - 44 * Math.cos(th),
    ix = 60 + 14 * Math.sin(th),
    iy = 60 - 14 * Math.cos(th);
  var ang = Math.atan2(iy - oy, ix - ox),
    h1x = ix - 9 * Math.cos(ang - 0.5),
    h1y = iy - 9 * Math.sin(ang - 0.5),
    h2x = ix - 9 * Math.cos(ang + 0.5),
    h2y = iy - 9 * Math.sin(ang + 0.5);
  g.innerHTML =
    '<line x1="' +
    ox.toFixed(1) +
    '" y1="' +
    oy.toFixed(1) +
    '" x2="' +
    ix.toFixed(1) +
    '" y2="' +
    iy.toFixed(1) +
    '" stroke="#C24A0A" stroke-width="3" stroke-linecap="round"></line>' +
    '<path d="M' +
    h1x.toFixed(1) +
    " " +
    h1y.toFixed(1) +
    " L" +
    ix.toFixed(1) +
    " " +
    iy.toFixed(1) +
    " L" +
    h2x.toFixed(1) +
    " " +
    h2y.toFixed(1) +
    '" fill="none" stroke="#C24A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>';
  $("windOut").textContent = windWords();
}
$("clock").addEventListener("click", function (e) {
  if (e.detail === 0) {
    L.windClock = (L.windClock % 12) + 1;
    saveL();
    paintClock();
    return;
  }
  var r = this.getBoundingClientRect(),
    dx = e.clientX - r.left - r.width / 2,
    dy = e.clientY - r.top - r.height / 2;
  var a = Math.atan2(dx, -dy);
  if (a < 0) a += 2 * Math.PI;
  var h = Math.round(a / (Math.PI / 6)) % 12;
  L.windClock = h === 0 ? 12 : h;
  saveL();
  paintClock();
});

/* ===== phone sensors ===== */
function needMotionPermission() {
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    return DeviceOrientationEvent.requestPermission().then(function (s) {
      if (s !== "granted") throw new Error("denied");
    });
  }
  if (typeof DeviceOrientationEvent === "undefined") return Promise.reject(new Error("none"));
  return Promise.resolve();
}
function sampleOrientation(ms, pick) {
  return new Promise(function (res, rej) {
    var vals = [],
      h = function (e) {
        var v = pick(e);
        if (v !== null && isFinite(v)) vals.push(v);
      };
    window.addEventListener("deviceorientation", h);
    setTimeout(function () {
      window.removeEventListener("deviceorientation", h);
      if (!vals.length) rej(new Error("no data"));
      else res(vals);
    }, ms);
  });
}
$("measAng").addEventListener("click", function () {
  var b = this;
  b.disabled = true;
  toast("Hold still…");
  needMotionPermission()
    .then(function () {
      return sampleOrientation(900, function (e) {
        return e.beta;
      });
    })
    .then(function (v) {
      var m =
        v.reduce(function (a, b) {
          return a + b;
        }, 0) / v.length;
      m = Math.max(-60, Math.min(60, m));
      L.ang = round(m, 0);
      saveL();
      paintDial();
      toast("Angle " + L.ang + "°");
    })
    .catch(function (e) {
      toast(e.message === "denied" ? "Motion access is off for this app" : "No tilt sensor here. Type the angle.");
    })
    .finally(function () {
      b.disabled = false;
    });
});
function circMean(v) {
  var s = 0,
    c = 0;
  v.forEach(function (d) {
    s += Math.sin((d * Math.PI) / 180);
    c += Math.cos((d * Math.PI) / 180);
  });
  var m = (Math.atan2(s, c) * 180) / Math.PI;
  return (m + 360) % 360;
}
$("windFx").addEventListener("click", function () {
  var a = L.air;
  if (a.wMs === null || a.wMs === undefined || !a.at) {
    toast("Get weather on the Air screen first");
    openView("vAir");
    return;
  }
  var b = this;
  b.disabled = true;
  L.windS = round(a.wMs / windToMs(1, L.windU), 1);
  saveL();
  toast("Point the top of the phone at the target");
  needMotionPermission()
    .then(function () {
      return new Promise(function (r) {
        setTimeout(r, 1200);
      }).then(function () {
        return sampleOrientation(800, function (e) {
          if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;
          if (e.absolute && e.alpha !== null) return (360 - e.alpha) % 360;
          return null;
        });
      });
    })
    .then(function (v) {
      var head = circMean(v),
        rel = (((a.wFrom - head) % 360) + 360) % 360,
        h = Math.round(rel / 30) % 12;
      L.windClock = h === 0 ? 12 : h;
      saveL();
      paintDial();
      toast("Wind from " + L.windClock + " o'clock");
    })
    .catch(function () {
      paintDial();
      toast("No compass reading. Speed set; tap the clock for direction.");
    })
    .finally(function () {
      b.disabled = false;
    });
});

function profileProblem(p) {
  var z = num(p.zero),
    mv = num(p.mv),
    bc = num(p.bc),
    sh = num(p.sh);
  var zm = z * (p.zeroU === "yd" ? M_PER_YD : 1),
    ms = mv * (p.mvU === "fps" ? MS_PER_FPS : 1);
  if (!(z > 0)) return "Enter the distance you zeroed at.";
  if (!(mv > 0)) return "Enter the muzzle speed.";
  if (!(bc > 0 && bc < 2)) return "Enter the BC from the bullet box, like 0.450.";
  if (!(sh >= 0)) return "Enter the scope height above the bore.";
  if (zm > 2000) return "Keep the zero under 2000 m.";
  if (ms < 150 || ms > 1500) return "Muzzle speed looks wrong. Check the unit.";
  var ts = String(p.tSens || "").trim();
  if (ts && !(num(ts) >= 0)) return "Powder temperature change must be 0 or more.";
  if (num(ts) > 0 && !isFinite(num(p.mvT))) return "Enter the temperature the muzzle speed was measured at.";
  if (p.twist && String(p.sg || "").trim() && !(num(p.sg) > 0 && num(p.sg) < 10))
    return "Stability (Sg) looks wrong. 1.5 is typical.";
  return "";
}
function check() {
  var d = num(L.dist),
    mV = num(L.missV),
    mH = num(L.missH),
    an = num(L.ang),
    ws = num(L.windS),
    msg = "";
  if (!isFinite(an) && String(L.ang).trim() === "") an = 0;
  if (!isFinite(ws) && String(L.windS).trim() === "") ws = 0;
  if (String(L.missV).trim() === "") mV = 0;
  if (String(L.missH).trim() === "") mH = 0;
  $("dist").classList.toggle("bad", !(d > 0));
  $("missV").classList.toggle("bad", !(mV >= 0));
  $("missH").classList.toggle("bad", !(mH >= 0));
  $("ang").classList.toggle("bad", !(Math.abs(an) <= 60));
  $("windS").classList.toggle("bad", !(ws >= 0));
  var pp = profileProblem(prof());
  if (pp) msg = "Fix the rifle in the Kit tab. " + pp;
  else if (!(d > 0)) msg = "Enter the target distance.";
  else if (d * (L.distU === "yd" ? M_PER_YD : 1) > 2000) msg = "Keep the target under 2000 m.";
  else if (!(Math.abs(an) <= 60)) msg = "Angle must be between -60 and 60 degrees.";
  else if (!(ws >= 0) || windToMs(ws, L.windU) > 40) msg = "Wind speed looks wrong.";
  else if (!(mV >= 0) || !(mH >= 0)) msg = "Miss amounts must be 0 or more.";
  $("err").textContent = msg;
  $("go").disabled = !!msg;
  return !msg;
}
