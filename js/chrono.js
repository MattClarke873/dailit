/* Dial it: Chrono sessions. */
"use strict";

/* chrono */
function parseSpeeds(t) {
  return String(t || "")
    .split(/[\s,;]+/)
    .map(num)
    .filter(function (v) {
      return v > 0;
    });
}
function speedStats(v) {
  if (!v.length) return null;
  var n = v.length,
    avg =
      v.reduce(function (a, b) {
        return a + b;
      }, 0) / n;
  var es = Math.max.apply(null, v) - Math.min.apply(null, v),
    sd =
      n > 1
        ? Math.sqrt(
            v.reduce(function (a, b) {
              return a + (b - avg) * (b - avg);
            }, 0) /
              (n - 1),
          )
        : 0;
  return { n: n, avg: avg, es: es, sd: sd };
}
/* Air temperature now in °C, or "" when not known. */
function airTempC() {
  var s = L.air.use ? airState() : null;
  return s ? Math.round(s.tc * 10) / 10 : "";
}
/* Powder temperature change for a rifle from its chrono sessions: m/s per °C, or null.
   Needs two or more sessions with temperatures at least 5°C apart. */
function chronoSens(pid, sid) {
  var pts = [];
  live(DB.chrono).forEach(function (c) {
    if (c.pid !== pid || (sid && c.sid && c.sid !== sid) || !isFinite(num(c.tc)) || String(c.tc) === "") return;
    var st = speedStats(parseSpeeds(c.speeds));
    if (st) pts.push([num(c.tc), c.unit === "fps" ? st.avg * MS_PER_FPS : st.avg]);
  });
  if (pts.length < 2) return null;
  var mx = 0,
    my = 0;
  pts.forEach(function (q) {
    mx += q[0] / pts.length;
    my += q[1] / pts.length;
  });
  var sxx = 0,
    sxy = 0;
  pts.forEach(function (q) {
    sxx += (q[0] - mx) * (q[0] - mx);
    sxy += (q[0] - mx) * (q[1] - my);
  });
  var spread =
    Math.max.apply(
      null,
      pts.map(function (q) {
        return q[0];
      }),
    ) -
    Math.min.apply(
      null,
      pts.map(function (q) {
        return q[0];
      }),
    );
  if (spread < 5 || !sxx) return null;
  return { sens: sxy / sxx, n: pts.length };
}
function renderChrono() {
  var cs = live(DB.chrono).sort(function (a, b) {
    return a.when < b.when ? 1 : -1;
  });
  if (!cs.length) {
    $("chronoList").innerHTML = '<p class="empty">No chrono sessions yet.</p>';
    return;
  }
  var h = '<div class="items">';
  cs.forEach(function (c) {
    var st = speedStats(parseSpeeds(c.speeds)),
      p = byId("profiles", c.pid),
      am = byId("stock", c.sid);
    h +=
      '<div class="item"><button type="button" class="main" data-chrono="' +
      esc(c.id) +
      '"><div class="n">' +
      (st ? Math.round(st.avg) + " " + (c.unit === "fps" ? "fps" : "m/s") : "No speeds") +
      ' <span style="font-weight:600;font-size:15px;color:var(--muted)">' +
      esc([p ? p.name : "", am ? am.name : ""].filter(Boolean).join(", ")) +
      "</span></div>" +
      '<div class="s">' +
      esc(String(c.when).replace("T", " ")) +
      (st ? ", " + st.n + " shots, ES " + Math.round(st.es) + ", SD " + fmt(st.sd, 1) : "") +
      (c.note ? "<br>" + esc(c.note) : "") +
      "</div></button></div>";
  });
  $("chronoList").innerHTML = h + "</div>";
}
$("chronoList").addEventListener("click", function (e) {
  var b = e.target.closest("[data-chrono]");
  if (b) openChrono(b.getAttribute("data-chrono"));
});
var CH = null,
  chIsNew = false;
function openChrono(id) {
  var src = id ? byId("chrono", id) : null;
  chIsNew = !src;
  CH = src
    ? JSON.parse(JSON.stringify(src))
    : {
        id: uid(),
        u: now(),
        del: false,
        when: localISO(),
        pid: L.active,
        sid: prof().stockId || "",
        unit: prof().mvU === "ms" ? "ms" : "fps",
        speeds: "",
        note: "",
        tc: airTempC(),
      };
  $("chTitle").textContent = chIsNew ? "New session" : "Chrono session";
  $("chWhen").value = CH.when;
  $("chSpeeds").value = CH.speeds;
  $("chNote").value = CH.note;
  $("chTempLbl").textContent = "Temperature °" + L.air.tU;
  $("chTemp").value = isFinite(num(CH.tc)) ? round(L.air.tU === "F" ? (CH.tc * 9) / 5 + 32 : CH.tc, 0) : "";
  var h = "";
  live(DB.profiles).forEach(function (p) {
    h += '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>";
  });
  $("chRifle").innerHTML = h;
  $("chRifle").value = CH.pid;
  fillAmmoSelect($("chAmmo"), CH.sid || "");
  $("chDel").hidden = chIsNew;
  paintChrono();
  show("vChronoEd");
}
function paintChrono() {
  setSeg($("chU"), CH.unit);
  var st = speedStats(parseSpeeds($("chSpeeds").value));
  $("chN").textContent = st ? st.n : 0;
  $("chAvg").textContent = st ? Math.round(st.avg) : "–";
  $("chES").textContent = st ? Math.round(st.es) : "–";
  $("chSD").textContent = st ? fmt(st.sd, 1) : "–";
  $("chApply").disabled = !st;
}
segVal($("chU"), function (v) {
  CH.unit = v;
  paintChrono();
});
$("chSpeeds").addEventListener("input", paintChrono);
$("chRifle").addEventListener("change", function () {
  var p = byId("profiles", this.value);
  if (p && p.stockId) $("chAmmo").value = p.stockId;
});
function readCH() {
  CH.when = $("chWhen").value || localISO();
  CH.pid = $("chRifle").value;
  CH.sid = $("chAmmo").value;
  CH.speeds = $("chSpeeds").value.trim();
  CH.note = $("chNote").value.trim();
  var t = num($("chTemp").value);
  CH.tc = isFinite(t) ? tempC(t, L.air.tU) : "";
  CH.u = now();
}
function saveCH() {
  readCH();
  if (chIsNew) {
    DB.chrono.push(CH);
    chIsNew = false;
  } else
    DB.chrono = DB.chrono.map(function (c) {
      return c.id === CH.id ? CH : c;
    });
  changed();
}
$("chSave").addEventListener("click", function () {
  saveCH();
  toast("Session saved");
  openKit("chrono");
});
$("chApply").addEventListener("click", function () {
  var st = speedStats(parseSpeeds($("chSpeeds").value)),
    p = byId("profiles", $("chRifle").value);
  if (!st || !p) return;
  var ms = CH.unit === "fps" ? st.avg * MS_PER_FPS : st.avg,
    val = Math.round(p.mvU === "fps" ? ms / MS_PER_FPS : ms);
  if (!confirm("Set " + p.name + " muzzle speed to " + val + " " + (p.mvU === "fps" ? "fps" : "m/s") + "?")) return;
  p.mv = String(val);
  var t = num($("chTemp").value);
  if (isFinite(t)) {
    // the speed was measured at this temperature, so powder temperature works from here
    p.mvTU = L.air.tU;
    p.mvT = String(round(t, 0));
  }
  p.u = now();
  saveCH();
  toast(p.name + " now " + val + " " + (p.mvU === "fps" ? "fps" : "m/s"));
});
$("addChrono").addEventListener("click", function () {
  openChrono(null);
});
$("chDel").addEventListener("click", function () {
  if (!confirm("Delete this chrono session?")) return;
  DB.chrono.forEach(function (c) {
    if (c.id === CH.id) {
      c.del = true;
      c.u = now();
    }
  });
  changed();
  openKit("chrono");
});
