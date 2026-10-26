/* Dial it: Kit tab and rifle profiles. */
"use strict";

/* ===== kit ===== */
segVal($("kitSeg"), function (v) {
  L.kitTab = v;
  saveL();
  renderKit();
});
function renderKit() {
  setSeg($("kitSeg"), L.kitTab);
  $("kRifles").hidden = L.kitTab !== "rifles";
  $("kAmmo").hidden = L.kitTab !== "ammo";
  $("kChrono").hidden = L.kitTab !== "chrono";
  if (L.kitTab === "rifles") renderRifles();
  if (L.kitTab === "ammo") renderAmmo();
  if (L.kitTab === "chrono") renderChrono();
}
function shotsLogged(pid) {
  return live(DB.log).reduce(function (t, x) {
    return t + (x.pid === pid ? parseInt(x.shots, 10) || 0 : 0);
  }, 0);
}
function roundsFor(p) {
  return (parseInt(p.r0, 10) || 0) + shotsLogged(p.id);
}
function roundsLine(p) {
  var n = roundsFor(p),
    since = n - (p.cleanAt || parseInt(p.r0, 10) || 0),
    ce = parseInt(p.cleanEvery, 10),
    bl = parseInt(p.barrelLife, 10);
  var t = n + " rounds",
    due = ce > 0 && since >= ce;
  if (ce > 0) t += ", " + since + " since clean";
  if (bl > 0) t += ", " + Math.max(0, Math.round(100 - (n / bl) * 100)) + "% barrel left";
  return { text: t, due: due, worn: bl > 0 && n >= bl * 0.9 };
}
function renderRifles() {
  var ps = live(DB.profiles).sort(function (a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
  var h = '<div class="items">';
  ps.forEach(function (p) {
    var act = p.id === L.active,
      sub = [p.gun, p.load].filter(Boolean).join(". "),
      rl = roundsLine(p);
    h +=
      '<div class="item"><button type="button" class="main" data-use="' +
      esc(p.id) +
      '" aria-pressed="' +
      act +
      '">' +
      '<div class="n">' +
      esc(p.name || "Unnamed rifle") +
      (act ? ' <span class="tag">In use</span>' : "") +
      (rl.due ? ' <span class="tag warn">Clean due</span>' : "") +
      (rl.worn ? ' <span class="tag warn">Barrel near end</span>' : "") +
      "</div>" +
      '<div class="s">' +
      (sub ? esc(sub) + "<br>" : "") +
      esc(rifleSummary(p)) +
      "<br>" +
      esc(rl.text) +
      "</div></button>" +
      '<button type="button" class="icon-btn" data-edit="' +
      esc(p.id) +
      '" aria-label="Edit ' +
      esc(p.name) +
      '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg></button></div>';
  });
  $("rifleList").innerHTML = h + "</div>";
}
$("rifleList").addEventListener("click", function (e) {
  var u = e.target.closest("[data-use]"),
    ed = e.target.closest("[data-edit]");
  if (u) {
    L.active = u.getAttribute("data-use");
    saveL();
    renderRifles();
    toast("Using " + (prof().name || "rifle"));
  }
  if (ed) openRifle(ed.getAttribute("data-edit"));
});
var RE = null,
  reIsNew = false,
  tMv = null;
function openRifle(id) {
  var src = id ? byId("profiles", id) : null;
  reIsNew = !src;
  RE = JSON.parse(JSON.stringify(src || newProfile({ name: "" })));
  $("reTitle").textContent = reIsNew ? "New rifle" : "Edit rifle";
  $("reName").value = RE.name;
  $("reGun").value = RE.gun;
  $("reLoad").value = RE.load;
  $("reZero").value = RE.zero;
  $("reMv").value = RE.mv;
  $("reBc").value = RE.bc;
  $("reSh").value = RE.sh;
  $("reR0").value = RE.r0 || "";
  $("reCE").value = RE.cleanEvery || "";
  $("reBL").value = RE.barrelLife || "";
  $("reMvT").value = RE.mvT || "";
  $("reTS").value = RE.tSens || "";
  $("reSg").value = RE.sg || "1.5";
  if (!RE.mvTU) RE.mvTU = "C";
  var h = '<option value="">None</option>';
  live(DB.stock).forEach(function (s) {
    h += '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>";
  });
  $("reStock").innerHTML = h;
  $("reStock").value = RE.stockId || "";
  $("tDist").value = "";
  $("tObs").value = "";
  $("tOut").textContent = "";
  $("tUse").hidden = true;
  tMv = null;
  RE.tU = RE.tU || RE.zeroU;
  $("reDel").hidden = reIsNew || live(DB.profiles).length < 2;
  $("reErr").textContent = "";
  paintRE();
  show("vRifleEd");
}
function paintRE() {
  paintSegGroup("data-pkey", RE);
  var opts = RE.sys === "MIL" ? [0.1, 0.05] : [0.25, 0.125],
    cur = clickOf(RE, RE.sys),
    seg = $("reClk");
  seg.innerHTML = "";
  opts.forEach(function (o) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = clkName(o);
    b.setAttribute("aria-pressed", String(o === cur));
    b.addEventListener("click", function () {
      if (RE.sys === "MIL") RE.clkMIL = o;
      else RE.clkMOA = o;
      paintRE();
    });
    seg.appendChild(b);
  });
  $("reClkLbl").textContent = "Click value (" + RE.sys + ")";
  $("tObsLbl").textContent = "Real dial up (" + RE.sys + ")";
  setSeg($("tDistU"), RE.tU);
  RE.r0 = $("reR0").value;
  var rl = roundsLine(RE);
  $("reRounds").textContent = reIsNew ? "" : rl.text + (rl.due ? ". Cleaning due." : "");
  $("reCleaned").hidden = reIsNew;
  paintTempSens();
}
var tsSuggest = null;
function paintTempSens() {
  var su = RE.mvU === "fps" ? "fps" : "m/s",
    perMs = (RE.mvU === "fps" ? MS_PER_FPS : 1) * (RE.mvTU === "F" ? 9 / 5 : 1);
  $("reTSLbl").textContent = "Changes by (" + su + " per °" + RE.mvTU + ")";
  $("reSgRow").hidden = !RE.twist;
  var cs = reIsNew ? null : chronoSens(RE.id, RE.stockId);
  tsSuggest = cs && cs.sens > 0 ? String(round(cs.sens / perMs, 2)) : null;
  $("reTSOut").innerHTML = "";
  if (cs)
    $("reTSOut").append(
      "Your " +
        cs.n +
        " chrono sessions show " +
        (cs.sens > 0
          ? "about " + round(cs.sens / perMs, 2) + " " + su + " per °" + RE.mvTU + ". "
          : "no rise with temperature. "),
    );
  if (tsSuggest) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "linkish";
    b.style.padding = "0";
    b.textContent = "Use this";
    b.addEventListener("click", function () {
      $("reTS").value = tsSuggest;
      toast("Press Save rifle to keep it.");
    });
    $("reTSOut").append(b);
  }
}
document.querySelectorAll(".seg[data-pkey]").forEach(function (seg) {
  segVal(seg, function (v) {
    if (!RE) return;
    var key = seg.getAttribute("data-pkey");
    if (key === "mvTU" && RE.mvTU !== v) {
      // keep the same real temperature and change per degree when the unit changes
      var t = num($("reMvT").value),
        s = num($("reTS").value);
      if (isFinite(t)) $("reMvT").value = round(v === "F" ? (t * 9) / 5 + 32 : ((t - 32) * 5) / 9, 0);
      if (isFinite(s)) $("reTS").value = round(v === "F" ? (s * 5) / 9 : (s * 9) / 5, 2);
    }
    RE[key] = v;
    paintRE();
  });
});
segVal($("tDistU"), function (v) {
  RE.tU = v;
  paintRE();
});
$("reR0").addEventListener("input", paintRE);
function readRE() {
  RE.name = $("reName").value.trim();
  RE.gun = $("reGun").value.trim();
  RE.load = $("reLoad").value.trim();
  RE.zero = $("reZero").value.trim();
  RE.mv = $("reMv").value.trim();
  RE.bc = $("reBc").value.trim();
  RE.sh = $("reSh").value.trim();
  RE.stockId = $("reStock").value;
  RE.r0 = $("reR0").value.trim();
  RE.cleanEvery = $("reCE").value.trim();
  RE.barrelLife = $("reBL").value.trim();
  RE.mvT = $("reMvT").value.trim();
  RE.tSens = $("reTS").value.trim();
  RE.sg = $("reSg").value.trim();
}
$("tRun").addEventListener("click", function () {
  readRE();
  var pr = profileProblem(RE);
  if (pr) {
    $("tOut").textContent = pr;
    return;
  }
  var d = num($("tDist").value),
    obs = num($("tObs").value);
  if (!(d > 0) || !isFinite(obs)) {
    $("tOut").textContent = "Enter the range and the dial that really hit.";
    return;
  }
  var dm = d * (RE.tU === "yd" ? M_PER_YD : 1),
    air = airNow(),
    b = ballistics(RE, air),
    v0 = b.v0;
  function holdAt(v) {
    var q = JSON.parse(JSON.stringify(RE));
    q.mv = String(v / (RE.mvU === "fps" ? MS_PER_FPS : 1));
    q.tSens = ""; // v is already the speed for today's temperature
    var s = solve(q, dm, { air: air });
    return s.at ? inSys(s.hold, RE.sys) : null;
  }
  var lo = v0 * 0.7,
    hi = v0 * 1.3,
    hl = holdAt(lo),
    hh = holdAt(hi);
  if (hl === null || hh === null || obs > hl || obs < hh) {
    $("tOut").textContent =
      "That dial is too far from the app's figure to fix with speed alone. Check the zero, range and BC.";
    $("tUse").hidden = true;
    return;
  }
  for (var i = 0; i < 40; i++) {
    var mid = (lo + hi) / 2,
      hm = holdAt(mid);
    if (hm > obs) lo = mid;
    else hi = mid;
  }
  var v = (lo + hi) / 2,
    show = Math.round(v / (RE.mvU === "fps" ? MS_PER_FPS : 1));
  tMv = String(show);
  $("tOut").textContent =
    "Speed that matches: " +
    show +
    " " +
    (RE.mvU === "fps" ? "fps" : "m/s") +
    " today (the app had " +
    Math.round(v0 / (RE.mvU === "fps" ? MS_PER_FPS : 1)) +
    "). Was " +
    fmt(holdAt(v0), 2) +
    " " +
    RE.sys +
    " at that range.";
  $("tUse").hidden = false;
});
$("tUse").addEventListener("click", function () {
  if (tMv) {
    $("reMv").value = tMv;
    RE.mv = tMv;
    // the matched speed is for today's air, so powder temperature now works from today's temperature
    var tc = airNow().tc;
    RE.mvT = String(round(RE.mvTU === "F" ? (tc * 9) / 5 + 32 : tc, 0));
    $("reMvT").value = RE.mvT;
    toast("Speed updated. Press Save rifle.");
    $("tUse").hidden = true;
  }
});
$("reCleaned").addEventListener("click", function () {
  readRE();
  RE.cleanAt = roundsFor(RE);
  paintRE();
  toast("Marked clean at " + RE.cleanAt + " rounds. Press Save rifle.");
});
$("addRifle").addEventListener("click", function () {
  openRifle(null);
});
$("reSave").addEventListener("click", function () {
  readRE();
  if (!RE.name) {
    $("reErr").textContent = "Give the rifle a name.";
    return;
  }
  var pr = profileProblem(RE);
  if (pr) {
    $("reErr").textContent = pr;
    return;
  }
  RE.u = now();
  delete RE.tU;
  if (reIsNew) {
    DB.profiles.push(RE);
    L.active = RE.id;
    saveL();
  } else
    DB.profiles = DB.profiles.map(function (p) {
      return p.id === RE.id ? RE : p;
    });
  changed();
  toast(reIsNew ? "Rifle added and in use" : "Rifle saved");
  openKit("rifles");
});
$("reDel").addEventListener("click", function () {
  if (!confirm("Delete " + (RE.name || "this rifle") + "? Its dope card goes too. Log entries stay.")) return;
  DB.profiles.forEach(function (p) {
    if (p.id === RE.id) {
      p.del = true;
      p.u = now();
    }
  });
  DB.dope.forEach(function (d) {
    if (d.pid === RE.id && !d.del) {
      d.del = true;
      d.u = now();
    }
  });
  if (L.active === RE.id) {
    L.active = "";
    prof();
  }
  changed();
  toast("Rifle deleted");
  openKit("rifles");
});
