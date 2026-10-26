/* Dial it: drag tables and the point-mass flight model.
   No page code here, so it can be tested on its own (node: load this file and call fly / zeroAngle). */
"use strict";

/* ===== drag tables (Mach, Cd) ===== */
// prettier-ignore
var G1 = [
  [0,.2629],[.05,.2558],[.1,.2487],[.15,.2413],[.2,.2344],[.25,.2278],[.3,.2214],[.35,.2155],[.4,.2104],[.45,.2061],
  [.5,.2032],[.55,.202],[.6,.2034],[.7,.2165],[.725,.223],[.75,.2313],[.775,.2417],[.8,.2546],[.825,.2706],[.85,.2901],
  [.875,.3136],[.9,.3415],[.925,.3734],[.95,.4084],[.975,.4448],[1,.4805],[1.025,.5136],[1.05,.5427],[1.075,.5677],
  [1.1,.5883],[1.125,.6053],[1.15,.6191],[1.2,.6393],[1.25,.6518],[1.3,.6589],[1.35,.6621],[1.4,.6625],[1.45,.6607],
  [1.5,.6573],[1.55,.6528],[1.6,.6474],[1.65,.6413],[1.7,.6347],[1.75,.628],[1.8,.621],[1.85,.6141],[1.9,.6072],
  [1.95,.6003],[2,.5934],[2.05,.5867],[2.1,.5804],[2.15,.5743],[2.2,.5685],[2.25,.563],[2.3,.5577],[2.35,.5527],
  [2.4,.5481],[2.45,.5438],[2.5,.5397],[2.6,.5325],[2.7,.5264],[2.8,.5211],[2.9,.5168],[3,.5133],[3.2,.5084],
  [3.4,.5054],[3.6,.503],[3.8,.5016],[4,.5006],[4.4,.4995],[5,.4988]
];
// prettier-ignore
var G7 = [
  [0,.1198],[.05,.1197],[.1,.1196],[.15,.1194],[.2,.1193],[.25,.1194],[.3,.1194],[.35,.1194],[.4,.1193],[.45,.1193],
  [.5,.1194],[.55,.1193],[.6,.1194],[.65,.1197],[.7,.1202],[.725,.1207],[.75,.1215],[.775,.1226],[.8,.1242],
  [.825,.1266],[.85,.1306],[.875,.1368],[.9,.1464],[.925,.166],[.95,.2054],[.975,.2993],[1,.3803],[1.025,.4015],
  [1.05,.4043],[1.075,.4034],[1.1,.4014],[1.125,.3987],[1.15,.3955],[1.2,.3884],[1.25,.381],[1.3,.3732],[1.35,.3657],
  [1.4,.358],[1.5,.344],[1.55,.3376],[1.6,.3315],[1.65,.326],[1.7,.3209],[1.75,.316],[1.8,.3117],[1.85,.3078],
  [1.9,.3042],[1.95,.301],[2,.298],[2.1,.2922],[2.2,.2864],[2.3,.2807],[2.4,.2752],[2.5,.2697],[2.6,.2643],
  [2.7,.2588],[2.8,.2533],[2.9,.2479],[3,.2424],[3.2,.2313],[3.4,.2205],[3.6,.2106],[3.8,.2017],[4,.1935],
  [4.4,.1793],[5,.1618]
];
function cdAt(t, m) {
  if (m <= t[0][0]) return t[0][1];
  for (var i = 1; i < t.length; i++) {
    if (m <= t[i][0]) {
      var a = t[i - 1],
        b = t[i];
      return a[1] + ((b[1] - a[1]) * (m - a[0])) / (b[0] - a[0]);
    }
  }
  return t[t.length - 1][1];
}

var GRAV = 9.80665,
  M_PER_YD = 0.9144,
  MS_PER_FPS = 0.3048,
  MOA_RAD = Math.PI / 180 / 60;
/* Standard air: 15°C, 1013.25 hPa, sea level, dry (ICAO). */
var STD_AIR = { rho: 1.225, c: 340.29, tc: 15 };
/* Below this Mach at the target the bullet is near the sound barrier and predictions get less certain. */
var TRANSONIC = 1.2;

/* Point-mass flight along the line of sight.
   x = down the line of sight, y = up from it, z = right.
   o.air {rho,c}; o.wx head(-)/tail(+) wind m/s; o.wz wind toward the right m/s; o.inc slope angle in radians (+ uphill).
   Returns at range X: y, z (m), v (m/s), t (s), mach. */
function fly(angle, v0, bc, table, sightH, X, o) {
  o = o || {};
  var air = o.air || STD_AIR,
    wx = o.wx || 0,
    wz = o.wz || 0,
    inc = o.inc || 0;
  var k = (air.rho * Math.PI) / (8 * bc * 703.0696),
    c = air.c,
    gx = -GRAV * Math.sin(inc),
    gy = -GRAV * Math.cos(inc);
  var x = 0,
    y = -sightH,
    z = 0,
    vx = v0 * Math.cos(angle),
    vy = v0 * Math.sin(angle),
    vz = 0,
    t = 0,
    dt = 0.0005;
  var px, py, pz, pv, pt;
  for (var i = 0; i < 60000; i++) {
    px = x;
    py = y;
    pz = z;
    pt = t;
    pv = Math.sqrt(vx * vx + vy * vy + vz * vz);
    var rx = vx - wx,
      ry = vy,
      rz = vz - wz,
      vr = Math.sqrt(rx * rx + ry * ry + rz * rz);
    var a = k * cdAt(table, vr / c) * vr;
    vx += (-a * rx + gx) * dt;
    vy += (-a * ry + gy) * dt;
    vz += -a * rz * dt;
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    t += dt;
    if (x >= X) {
      var f = (X - px) / (x - px),
        vN = Math.sqrt(vx * vx + vy * vy + vz * vz),
        v = pv + (vN - pv) * f;
      return { y: py + (y - py) * f, z: pz + (z - pz) * f, v: v, t: pt + (t - pt) * f, mach: v / c };
    }
    if (vx < 30) break;
  }
  return null;
}
function zeroAngle(v0, bc, table, sightH, Z, air) {
  var lo = -0.02,
    hi = 0.08;
  for (var i = 0; i < 50; i++) {
    var mid = (lo + hi) / 2,
      r = fly(mid, v0, bc, table, sightH, Z, { air: air });
    if (!r || r.y < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* Spin drift (Litz): inches = 1.25 * (Sg + 1.2) * t^1.83, toward the twist. Returns metres, + = right. */
function spinDrift(t, sg, twist) {
  if (twist !== "R" && twist !== "L") return 0;
  var m = 1.25 * (sg + 1.2) * Math.pow(t, 1.83) * 0.0254;
  return twist === "R" ? m : -m;
}

/* Muzzle speed (m/s) after powder temperature: speed changes by sens (m/s per °C) away from the temperature it was measured at. */
function tempSpeed(v0, sens, atC, nowC) {
  if (!(sens > 0) || !isFinite(atC) || !isFinite(nowC)) return v0;
  return v0 + sens * (nowC - atC);
}

if (typeof module !== "undefined")
  module.exports = {
    G1: G1,
    G7: G7,
    fly: fly,
    zeroAngle: zeroAngle,
    spinDrift: spinDrift,
    tempSpeed: tempSpeed,
    STD_AIR: STD_AIR,
  };
