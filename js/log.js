/* Dial it: Shooting log. */
"use strict";

/* ===== log ===== */
var LE = null,
  leIsNew = false;
function fillRifleSelect(sel) {
  var ps = live(DB.profiles),
    h = "";
  ps.forEach(function (p) {
    h += '<option value="' + esc(p.id) + '">' + esc(p.name || "Unnamed rifle") + "</option>";
  });
  if (
    sel &&
    !ps.some(function (p) {
      return p.id === sel;
    })
  )
    h += '<option value="' + esc(sel) + '">' + esc(LE.rifleName || "Deleted rifle") + "</option>";
  $("leRifle").innerHTML = h;
  $("leRifle").value = sel || L.active;
}
function openLog(id, prefill) {
  var src = id ? byId("log", id) : null;
  leIsNew = !src;
  LE = src
    ? JSON.parse(JSON.stringify(src))
    : {
        id: uid(),
        u: now(),
        del: false,
        when: localISO(),
        place: "",
        pid: L.active,
        rifleName: "",
        dist: L.dist,
        distU: L.distU,
        shots: "",
        group: "",
        groupU: L.missU === "in" ? "in" : "mm",
        hit: "",
        air: L.air.use ? airShort() : "",
        notes: "",
      };
  if (prefill) for (var k in prefill) LE[k] = prefill[k];
  if (leIsNew && !LE.place) {
    var lastE = live(DB.log).sort(function (a, b) {
      return a.when < b.when ? 1 : -1;
    })[0];
    if (lastE) LE.place = lastE.place;
  }
  $("leTitle").textContent = leIsNew ? "New entry" : "Edit entry";
  if (leIsNew && !("sid" in LE)) {
    var dp = byId("profiles", LE.pid);
    LE.sid = dp ? dp.stockId || "" : "";
  }
  $("leWhen").value = LE.when;
  $("lePlace").value = LE.place;
  fillRifleSelect(LE.pid);
  fillAmmoSelect($("leAmmo"), logAmmo(LE), LE.ammoName);
  $("leDist").value = LE.dist;
  $("leShots").value = LE.shots;
  $("leGroup").value = LE.group;
  $("leHit").value = LE.hit;
  $("leAir").value = LE.air || "";
  $("leNotes").value = LE.notes;
  paintSegGroup("data-ekey", LE);
  $("leDel").hidden = leIsNew;
  show("vLogEd");
}
document.querySelectorAll(".seg[data-ekey]").forEach(function (seg) {
  segVal(seg, function (v) {
    if (!LE) return;
    LE[seg.getAttribute("data-ekey")] = v;
    paintSegGroup("data-ekey", LE);
  });
});
$("addLog").addEventListener("click", function () {
  openLog(null);
});
$("leRifle").addEventListener("change", function () {
  var p = byId("profiles", this.value);
  if (p && p.stockId) $("leAmmo").value = p.stockId;
});
$("logShot").addEventListener("click", function () {
  openLog(null, {
    hit:
      (last && last.hasMiss ? hitText() : "") + (last && last.fixText ? (last.hasMiss ? ", " : "") + last.fixText : ""),
    air: (last && last.airText) || "",
    dist: L.dist,
    distU: L.distU,
    pid: L.active,
    shots: "1",
  });
});
$("leSave").addEventListener("click", function () {
  LE.when = $("leWhen").value || localISO();
  LE.place = $("lePlace").value.trim();
  LE.pid = $("leRifle").value;
  var rp = byId("profiles", LE.pid);
  LE.rifleName = rp ? rp.name : LE.rifleName;
  LE.sid = $("leAmmo").value;
  var sa = byId("stock", LE.sid);
  LE.ammoName = sa ? sa.name : LE.sid ? LE.ammoName : "";
  LE.dist = $("leDist").value.trim();
  LE.shots = $("leShots").value.trim();
  LE.group = $("leGroup").value.trim();
  LE.hit = $("leHit").value.trim();
  LE.air = $("leAir").value.trim();
  LE.notes = $("leNotes").value.trim();
  LE.u = now();
  if (leIsNew) DB.log.push(LE);
  else
    DB.log = DB.log.map(function (x) {
      return x.id === LE.id ? LE : x;
    });
  changed();
  toast(leIsNew ? "Entry saved" : "Entry updated");
  openView("vLog");
});
$("leDel").addEventListener("click", function () {
  if (!confirm("Delete this log entry?")) return;
  DB.log.forEach(function (x) {
    if (x.id === LE.id) {
      x.del = true;
      x.u = now();
    }
  });
  changed();
  toast("Entry deleted");
  openView("vLog");
});
function dayLabel(w) {
  var d = new Date(w);
  if (isNaN(d)) return w;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function renderLog() {
  var rows = live(DB.log).sort(function (a, b) {
    return a.when < b.when ? 1 : -1;
  });
  if (!rows.length) {
    $("logList").innerHTML =
      '<p class="empty">No entries yet. Press + to log a session, or use Log this shot after working out clicks.</p>';
    return;
  }
  var h = "",
    cur = "";
  rows.forEach(function (x) {
    var day = dayLabel(x.when);
    if (day !== cur) {
      if (cur) h += "</div>";
      h += '<div class="day">' + esc(day) + '</div><div class="items">';
      cur = day;
    }
    var bits = [];
    if (x.shots) bits.push(x.shots + " shot" + (x.shots === "1" ? "" : "s"));
    if (x.group) bits.push(x.group + " " + x.groupU + " group");
    if (x.place) bits.push(x.place);
    var am = byId("stock", logAmmo(x)),
      amName = am ? am.name : x.ammoName;
    if (amName) bits.push(amName);
    var t = x.when && x.when.length >= 16 ? x.when.slice(11, 16) + "  " : "";
    h +=
      '<div class="item"><button type="button" class="main log-main" data-log="' +
      esc(x.id) +
      '">' +
      '<div class="n"><span class="d">' +
      esc(x.dist ? x.dist + " " + x.distU : "") +
      "</span> " +
      esc(x.rifleName || "") +
      "</div>" +
      '<div class="s">' +
      esc(t + bits.join(", ")) +
      (x.hit ? "<br>" + esc(x.hit) : "") +
      (x.air ? "<br>" + esc(x.air) : "") +
      (x.notes ? "<br>" + esc(x.notes) : "") +
      "</div></button></div>";
  });
  $("logList").innerHTML = h + "</div>";
}
$("logList").addEventListener("click", function (e) {
  var b = e.target.closest("[data-log]");
  if (b) openLog(b.getAttribute("data-log"));
});
$("exportLog").addEventListener("click", function () {
  var rows = live(DB.log).sort(function (a, b) {
    return a.when < b.when ? -1 : 1;
  });
  if (!rows.length) {
    toast("Log is empty");
    return;
  }
  var csv =
    "When,Where,Rifle,Ammo,Load recipe,Distance,Unit,Shots,Group,Group unit,Hit and correction,Air and wind,Notes\n";
  rows.forEach(function (x) {
    var am = byId("stock", logAmmo(x));
    csv +=
      [
        String(x.when).replace("T", " "),
        x.place,
        x.rifleName,
        am ? am.name : x.ammoName || "",
        ammoRecipe(am),
        x.dist,
        x.distU,
        x.shots,
        x.group,
        x.groupU,
        x.hit,
        x.air,
        x.notes,
      ]
        .map(csvCell)
        .join(",") + "\n";
  });
  var name = "dialit-log-" + localISO().slice(0, 10) + ".csv";
  saveFile(name, csv, "text/csv", "Shooting log");
});
