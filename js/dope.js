/* Dial it: Saved dope and the printable range card. */
"use strict";

/* ===== dope: saved + range card ===== */
$("saveDope").addEventListener("click", function () {
  if (!last || !last.flat || !last.flat.at) {
    toast("Nothing to save at this range");
    return;
  }
  var p = last.p,
    h = last.flat.hold,
    mil = h * 1000,
    moa = h / MOA_RAD;
  var e = {
    id: uid(),
    u: now(),
    del: false,
    pid: p.id,
    m: last.dm,
    label: L.dist + " " + L.distU,
    mil: fmt(Math.abs(mil), 2) + (mil >= 0 ? " up" : " down"),
    moa: fmt(Math.abs(moa), 2) + (moa >= 0 ? " up" : " down"),
  };
  DB.dope.forEach(function (d) {
    if (!d.del && d.pid === p.id && Math.abs(d.m - e.m) < 0.01) {
      d.del = true;
      d.u = now();
    }
  });
  DB.dope.push(e);
  changed();
  toast("Saved " + e.label + " to dope card");
});
segVal($("dopeSeg"), function (v) {
  L.dopeTab = v;
  saveL();
  renderDope();
});
function renderDope() {
  var p = prof();
  setSeg($("dopeSeg"), L.dopeTab);
  $("dCard").hidden = L.dopeTab !== "card";
  $("dSaved").hidden = L.dopeTab !== "saved";
  $("dopeFor").textContent = "For " + (p.name || "this rifle") + ". Change rifle in the Kit tab.";
  if (L.dopeTab === "card") renderCard();
  else renderSaved();
}
function renderSaved() {
  var p = prof(),
    rows = live(DB.dope)
      .filter(function (d) {
        return d.pid === p.id;
      })
      .sort(function (a, b) {
        return a.m - b.m;
      });
  if (!rows.length) {
    $("dopeBody").innerHTML =
      '<p class="empty">Nothing saved for this rifle yet. Work out a shot, then press Save to dope card.</p>';
    return;
  }
  var h = '<div class="dope"><div class="dope-row h"><div>Range</div><div>MIL</div><div>MOA</div><div></div></div>';
  rows.forEach(function (d) {
    h +=
      '<div class="dope-row"><div class="d">' +
      esc(d.label) +
      '</div><div class="c">' +
      esc(d.mil) +
      '</div><div class="c">' +
      esc(d.moa) +
      "</div>" +
      '<button type="button" class="icon-btn" data-deldope="' +
      esc(d.id) +
      '" aria-label="Remove ' +
      esc(d.label) +
      '">' +
      BACK_SVG +
      "</button></div>";
  });
  $("dopeBody").innerHTML = h + "</div>";
}
$("dopeBody").addEventListener("click", function (e) {
  var b = e.target.closest("[data-deldope]");
  if (!b) return;
  DB.dope.forEach(function (d) {
    if (d.id === b.getAttribute("data-deldope")) {
      d.del = true;
      d.u = now();
    }
  });
  changed();
  renderSaved();
});
[
  ["cFrom", "from"],
  ["cTo", "to"],
  ["cStep", "step"],
  ["cWind", "wind"],
].forEach(function (f) {
  $(f[0]).addEventListener("input", function () {
    L.card[f[1]] = $(f[0]).value;
    saveL();
    renderCard(true);
  });
});
document.querySelectorAll(".seg[data-ckey]").forEach(function (seg) {
  segVal(seg, function (v) {
    L.card[seg.getAttribute("data-ckey")] = v;
    saveL();
    renderCard();
  });
});
function renderCard(fromInput) {
  var p = prof(),
    c = L.card,
    sys = p.sys,
    clk = clickOf(p, sys);
  if (!fromInput) {
    $("cFrom").value = c.from;
    $("cTo").value = c.to;
    $("cStep").value = c.step;
    $("cWind").value = c.wind;
  }
  paintSegGroup("data-ckey", c);
  $("cWindU").textContent = L.windU;
  var fr = num(c.from),
    to = num(c.to),
    st = num(c.step),
    wv = num(c.wind) || 0,
    k = c.u === "yd" ? M_PER_YD : 1;
  if (profileProblem(p)) {
    $("cardTable").innerHTML = '<p class="empty">Fix the rifle in the Kit tab first.</p>';
    return;
  }
  if (!(fr > 0 && to >= fr && st > 0) || (to - fr) / st > 40 || to * k > 2000) {
    $("cardTable").innerHTML = '<p class="empty">Set From, To and Every. Up to 40 rows and 2000 m.</p>';
    return;
  }
  var air = airNow(),
    b = ballistics(p, air),
    za = zeroAngle(b.v0, b.bc, b.table, b.sh, b.zm, air),
    wz = -windToMs(wv, L.windU);
  var du = c.u === "yd" ? "in" : "cm",
    dk = du === "in" ? 39.3701 : 100;
  var h =
    '<table class="card"><thead><tr><th>' +
    c.u +
    "</th><th>Drop " +
    du +
    "</th><th>" +
    sys +
    "</th><th>Clicks</th><th>Wind " +
    (wv ? round(wv, 1) + " " + L.windU : "") +
    " " +
    sys +
    "</th>" +
    (p.twist ? "<th>Spin " + sys + "</th>" : "") +
    "</tr></thead><tbody>";
  var cols = p.twist ? 5 : 4,
    trans = false;
  for (var r = fr; r <= to + 1e-9; r += st) {
    var s = solve(p, r * k, { air: air, za: za, wz: wz });
    if (!s.at) {
      h += "<tr><td>" + round(r, 0) + '</td><td colspan="' + cols + '">Out of range</td></tr>';
      continue;
    }
    var hA = inSys(s.hold, sys),
      wA = inSys(s.windOnly, sys),
      spA = inSys(s.spinHold, sys),
      slow = s.at.mach < TRANSONIC,
      cl = Math.round(hA / clk);
    if (slow) trans = true;
    h +=
      "<tr" +
      (slow ? ' class="trans"' : "") +
      "><td>" +
      round(r, 0) +
      (slow ? "*" : "") +
      "</td><td>" +
      sgn(-s.drop * dk, 1) +
      "</td><td>" +
      sgn(hA, 1) +
      '</td><td class="cl">' +
      (cl > 0 ? "U" : cl < 0 ? "D" : "") +
      Math.abs(cl) +
      "</td><td>" +
      (wv ? fmt(Math.abs(wA), 1) + (wA > 0 ? " R" : " L") : "–") +
      "</td>" +
      (p.twist
        ? "<td>" + (Math.abs(spA) < 0.05 ? "0" : fmt(Math.abs(spA), 1) + (spA > 0 ? " R" : " L")) + "</td>"
        : "") +
      "</tr>";
  }
  $("cardTable").innerHTML =
    h +
    "</tbody></table>" +
    (trans ? '<p class="hint warn">* Near or below the speed of sound. Less certain; confirm with a shot.</p>' : "");
  $("pcTitle").textContent = (p.name || "Rifle") + " range card";
  $("pcSub").textContent = [
    p.load,
    rifleSummary(p),
    "Scope " + p.sh + " " + p.shU + ", " + clkName(clk) + " " + sys + " clicks",
    airShort(),
    tempSens(p)
      ? "Muzzle speed " + Math.round(b.v0 / (p.mvU === "fps" ? MS_PER_FPS : 1)) + " " + p.mvU + " for this temperature"
      : "",
    "Made " + new Date().toLocaleDateString("en-GB"),
  ]
    .filter(Boolean)
    .join(". ");
}
function printPart(id) {
  var el = $(id);
  el.classList.add("print-on");
  var done = function () {
    el.classList.remove("print-on");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 60000);
}
$("printCardBtn").addEventListener("click", function () {
  renderCard();
  printPart("printCard");
});
