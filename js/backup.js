/* Dial it: backup file. Save everything to one file, and restore it by merging (newer changes win). */
"use strict";

/* Phone-only settings that go in a backup. Dropbox keys stay out. */
var BK_LOCAL = ["active", "distU", "missU", "windU", "card", "air", "theme"];

function paintBackup() {
  var t = "",
    s = "",
    cls = "",
    days = L.lastBackup ? (now() - L.lastBackup) / 86400000 : Infinity;
  if (!L.lastBackup) {
    t = "No backup yet";
    s = L.dbx ? "Dropbox has a copy. A file is a second one." : "Everything is on this phone only.";
    cls = L.dbx ? "" : "bad";
  } else {
    t =
      "Last backup " +
      new Date(L.lastBackup).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    s = days > 30 && !L.dbx ? "Over a month ago. Save a new one." : "";
    cls = days > 30 && !L.dbx ? "off" : "ok";
  }
  $("bkDot").className = "dot " + cls;
  $("bkT").textContent = t;
  $("bkS").textContent = s;
}

$("bkSave").addEventListener("click", function () {
  var local = {};
  BK_LOCAL.forEach(function (k) {
    local[k] = L[k];
  });
  var data = { app: "dialit", kind: "backup", v: DB.v, made: new Date().toISOString(), db: DB, local: local };
  var name = "dialit-backup-" + localISO().slice(0, 10) + ".json";
  saveFile(name, JSON.stringify(data), "application/json", "Dial it backup").then(function (ok) {
    if (!ok) return;
    L.lastBackup = now();
    saveL();
    paintBackup();
    toast("Backup saved");
  });
});

/* Count the items a restore adds or updates. */
function countNewer(before, after) {
  var n = 0;
  COLL.forEach(function (k) {
    var old = {};
    (before[k] || []).forEach(function (x) {
      old[x.id] = x.u || 0;
    });
    (after[k] || []).forEach(function (x) {
      if (!(x.id in old) || (x.u || 0) > old[x.id]) n++;
    });
  });
  return n;
}

$("bkIn").addEventListener("change", function () {
  var f = this.files && this.files[0];
  this.value = "";
  if (!f) return;
  f.text()
    .then(function (text) {
      var d = JSON.parse(text);
      // a backup file, or a raw dialit.json copied out of Dropbox
      var db = d && d.app === "dialit" ? d.db : d;
      if (
        !db ||
        !COLL.some(function (k) {
          return Array.isArray(db[k]);
        })
      )
        throw new Error("not a backup");
      var merged = merge(DB, db),
        n = countNewer(DB, merged);
      if (!n) {
        toast("Nothing new in that file");
        return;
      }
      if (!confirm("Add " + n + " new or newer items from " + f.name + "? Anything newer on this phone is kept."))
        return;
      DB = merged;
      ensureProfile();
      ensureCals();
      if (d.local && d.local.active && byId("profiles", d.local.active) && !byId("profiles", L.active))
        L.active = d.local.active;
      saveL();
      changed();
      refreshOpenView();
      toast("Restored " + n + " items");
    })
    .catch(function () {
      toast("That file isn't a Dial it backup");
    });
});
