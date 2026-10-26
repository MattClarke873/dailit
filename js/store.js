/* Dial it: Saved data: DB is synced, L stays on this phone. */
"use strict";

/* ===== storage =====
   DB (synced): profiles, log, dope, stock, stockEv, chrono. Every item: id, u (updated ms), del (tombstone).
   L (this phone only): active rifle, dial inputs, air, Dropbox tokens. */
var COLL = ["profiles", "log", "dope", "stock", "stockEv", "chrono"];
var DB = { v: 2 };
COLL.forEach(function (k) {
  DB[k] = [];
});
var L = {
  active: "",
  dist: "200",
  distU: "m",
  missV: "0",
  missH: "0",
  vDir: "low",
  hDir: "right",
  missU: "in",
  ang: "0",
  windS: "0",
  windU: "mph",
  windClock: 3,
  resMode: "",
  kitTab: "rifles",
  dopeTab: "card",
  card: { from: "50", to: "400", step: "50", u: "m", wind: "10" },
  theme: "day",
  dbxKey: "",
  dbx: null,
  lastSync: 0,
  lastBackup: 0,
  syncErr: "",
  air: {
    use: true,
    t: "15",
    tU: "C",
    p: "1013",
    pU: "hPa",
    pT: "qnh",
    alt: "0",
    altU: "m",
    rh: "60",
    src: "",
    at: 0,
    wMs: null,
    wFrom: null,
  },
};
function saveDB() {
  try {
    localStorage.setItem("dialit.db", JSON.stringify(DB));
  } catch (e) {}
}
function saveL() {
  try {
    localStorage.setItem("dialit.local", JSON.stringify(L));
  } catch (e) {}
}
function newProfile(o) {
  var p = {
    id: uid(),
    u: now(),
    del: false,
    name: "New rifle",
    gun: "",
    load: "",
    zero: "100",
    zeroU: "m",
    mv: "2700",
    mvU: "fps",
    bc: "0.450",
    drag: "G1",
    sh: "38",
    shU: "mm",
    sys: "MIL",
    clkMIL: 0.1,
    clkMOA: 0.25,
    stockId: "",
    r0: "0",
    cleanEvery: "",
    cleanAt: 0,
    barrelLife: "",
    // powder temperature: speed measured at mvT (in mvTU), changing by tSens (rifle speed unit per degree)
    mvT: "",
    mvTU: "C",
    tSens: "",
    // spin drift: twist "R", "L" or "" for off; sg = gyroscopic stability
    twist: "",
    sg: "1.5",
  };
  for (var k in o) if (o[k] !== undefined) p[k] = o[k];
  return p;
}
function live(a) {
  return a.filter(function (x) {
    return !x.del;
  });
}
function load() {
  try {
    var d = JSON.parse(localStorage.getItem("dialit.db") || "null");
    if (d && d.profiles) DB = d;
  } catch (e) {}
  try {
    var l = JSON.parse(localStorage.getItem("dialit.local") || "null");
    if (l)
      for (var k in l) {
        if (l[k] && typeof l[k] === "object" && !Array.isArray(l[k]) && L[k] && typeof L[k] === "object") {
          for (var k2 in l[k]) L[k][k2] = l[k][k2];
        } else L[k] = l[k];
      }
  } catch (e) {}
  COLL.forEach(function (k) {
    if (!Array.isArray(DB[k])) DB[k] = [];
  });
  try {
    // bring over data from the first version
    var old = JSON.parse(localStorage.getItem("dialit.state") || "null");
    if (old && !DB.profiles.length) {
      var p = newProfile({
        name: "My rifle",
        zero: old.zero,
        zeroU: old.zeroU,
        mv: old.mv,
        mvU: old.mvU,
        bc: old.bc,
        drag: old.drag,
        sh: old.sh,
        shU: old.shU,
        sys: old.sys,
        clkMIL: old.clkMIL,
        clkMOA: old.clkMOA,
      });
      DB.profiles.push(p);
      L.active = p.id;
      ["dist", "distU", "missV", "missH", "vDir", "hDir", "missU"].forEach(function (k) {
        if (old[k] !== undefined) L[k] = old[k];
      });
      var od = JSON.parse(localStorage.getItem("dialit.dope") || "[]");
      if (Array.isArray(od))
        od.forEach(function (e) {
          DB.dope.push({ id: uid(), u: now(), del: false, pid: p.id, m: e.m, label: e.label, mil: e.mil, moa: e.moa });
        });
      localStorage.removeItem("dialit.state");
      localStorage.removeItem("dialit.dope");
    }
  } catch (e) {}
  ensureProfile();
  saveDB();
  saveL();
}
/* There must always be one rifle. Sync can delete the last one if two phones each delete a different rifle. */
function ensureProfile() {
  if (live(DB.profiles).length) return false;
  var p = newProfile({ name: "My rifle" });
  DB.profiles.push(p);
  L.active = p.id;
  return true;
}
function prof() {
  if (ensureProfile()) {
    saveDB();
    saveL();
  }
  var ps = live(DB.profiles),
    p = ps.filter(function (x) {
      return x.id === L.active;
    })[0];
  if (!p) {
    p = ps[0];
    L.active = p.id;
    saveL();
  }
  return p;
}
function byId(coll, id) {
  return DB[coll].filter(function (x) {
    return x.id === id;
  })[0];
}
function changed() {
  saveDB();
  scheduleSync();
}
