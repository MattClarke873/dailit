/* Dial it: Ammo stock, certificate limits and the stock report. */
"use strict";

/* ammo stock */
/* Which ammo a log entry used: its own pick, or for older entries, the rifle's default. */
function logAmmo(x) {
  if ("sid" in x) return x.sid;
  var p = byId("profiles", x.pid);
  return p ? p.stockId : "";
}
function stockUsed(sid) {
  return live(DB.log).reduce(function (t, x) {
    return t + (logAmmo(x) === sid ? parseInt(x.shots, 10) || 0 : 0);
  }, 0);
}
var HL_FIELDS = ["bullet", "wt", "powder", "charge", "primer", "case", "coal", "cbto", "batch", "notes"];
function ammoRecipe(s) {
  if (!s || s.type !== "home") return "";
  var u = s.lenU || "in";
  return [
    [s.wt ? s.wt + "gr" : "", s.bullet].filter(Boolean).join(" "),
    [s.charge ? s.charge + "gr" : "", s.powder].filter(Boolean).join(" "),
    s.primer,
    s.case,
    s.coal ? "COAL " + s.coal + " " + u : "",
    s.cbto ? "CBTO " + s.cbto + " " + u : "",
    s.batch,
  ]
    .filter(Boolean)
    .join(", ");
}
function fillAmmoSelect(el, val, fallbackName) {
  var h = '<option value="">Not set</option>',
    ss = live(DB.stock).filter(function (s) {
      return !s.retired || s.id === val;
    });
  ss.forEach(function (s) {
    h +=
      '<option value="' +
      esc(s.id) +
      '">' +
      esc(s.name) +
      (s.type === "home" ? " (home load)" : "") +
      (s.retired ? " (retired)" : "") +
      "</option>";
  });
  if (
    val &&
    !ss.some(function (s) {
      return s.id === val;
    })
  )
    h += '<option value="' + esc(val) + '">' + esc(fallbackName || "Deleted ammo") + "</option>";
  el.innerHTML = h;
  el.value = val || "";
}
/* Stock changes carry a kind: buy (bought or loaded), use (fired or used outside the log), set (count fix).
   Older changes without a kind are read from their sign and note. */
function evKind(e) {
  if (e.kind) return e.kind;
  if (e.qty < 0) return "use";
  return e.note === "Counted" ? "set" : "buy";
}
function stockHeld(sid) {
  return (
    live(DB.stockEv).reduce(function (t, e) {
      return t + (e.sid === sid ? e.qty || 0 : 0);
    }, 0) - stockUsed(sid)
  );
}
function inRange(when, from, to) {
  var w = String(when || "");
  return (!from || w >= from) && (!to || w <= to);
}
/* Totals for one ammo between two local ISO dates (either can be empty). */
function ammoTotals(sid, from, to) {
  var t = { inn: 0, fired: 0, adj: 0 };
  live(DB.stockEv).forEach(function (e) {
    if (e.sid !== sid || !inRange(e.when, from, to)) return;
    var k = evKind(e);
    if (k === "buy") t.inn += e.qty;
    else if (k === "use") t.fired += -e.qty;
    else t.adj += e.qty;
  });
  live(DB.log).forEach(function (x) {
    if (logAmmo(x) === sid && inRange(x.when, from, to)) t.fired += parseInt(x.shots, 10) || 0;
  });
  return t;
}
/* calKey, calOf, calLimit and calHeld are in cals.js. */
function stockWarn(s, held) {
  var c = calOf(s),
    lim = calLimit(c),
    tot = calHeld(c),
    label = c ? c.name + " in total" : "In total";
  if (lim > 0 && tot > lim) return label + ": " + tot + ", over the certificate limit of " + lim + ".";
  if (lim > 0 && tot >= lim * 0.9) return label + ": " + tot + ", close to the certificate limit of " + lim + ".";
  if (held < 0) return "Below zero. Add what you bought or loaded, or set the count.";
  if (s.retired && held > 0) return "Retired but " + held + " still in stock.";
  return "";
}
function renderAmmo() {
  var all = live(DB.stock).sort(function (a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
  if (!all.length) {
    $("ammoList").innerHTML =
      '<p class="empty">No ammo yet. Add your calibres and limits in Settings, then add each ammo you hold.</p>';
    return;
  }
  function list(ss) {
    var h = '<div class="items">';
    ss.forEach(function (s) {
      var held = stockHeld(s.id),
        c = calOf(s),
        w = stockWarn(s, held),
        rec = ammoRecipe(s);
      h +=
        '<div class="item"><button type="button" class="main" data-ammo="' +
        esc(s.id) +
        '"><div class="n">' +
        esc(s.name) +
        (s.type === "home" ? ' <span class="tag">Home load</span>' : "") +
        (w ? ' <span class="tag warn">Check</span>' : "") +
        "</div>" +
        '<div class="s">' +
        (rec ? esc(rec) + "<br>" : "") +
        esc(
          [c ? c.name : s.cal, held + " in stock", calLimit(c) ? "certificate limit " + calLimit(c) : ""]
            .filter(Boolean)
            .join(", "),
        ) +
        (w ? '<br><span class="warn">' + esc(w) + "</span>" : "") +
        "</div></button></div>";
    });
    return h + "</div>";
  }
  var act = all.filter(function (s) {
      return !s.retired;
    }),
    ret = all.filter(function (s) {
      return s.retired;
    });
  $("ammoList").innerHTML =
    (act.length ? list(act) : '<p class="empty">Nothing in use.</p>') +
    (ret.length ? '<div class="day" style="margin-top:20px">Retired</div>' + list(ret) : "");
}
$("ammoList").addEventListener("click", function (e) {
  var b = e.target.closest("[data-ammo]");
  if (b) openAmmo(b.getAttribute("data-ammo"));
});
var AM = null,
  amIsNew = false,
  amKind = "buy";
function openAmmo(id) {
  var src = id ? byId("stock", id) : null;
  amIsNew = !src;
  AM = src
    ? JSON.parse(JSON.stringify(src))
    : {
        id: uid(),
        u: now(),
        del: false,
        name: "",
        cal: "",
        calId: "",
        type: "factory",
        lenU: "in",
        retired: false,
      };
  if (!AM.type) AM.type = "factory";
  if (!AM.lenU) AM.lenU = "in";
  $("amTitle").textContent = amIsNew ? "New ammo" : "Ammo";
  $("amName").value = AM.name;
  var ac = calOf(AM);
  $("amCal").value = ac ? ac.name : AM.cal || "";
  fillAmmoLists();
  paintAmmoCal();
  HL_FIELDS.forEach(function (k) {
    $("hl" + k.charAt(0).toUpperCase() + k.slice(1)).value = AM[k] || "";
  });
  $("amQty").value = "";
  $("amNote").value = "";
  amKind = "buy";
  $("amErr").textContent = "";
  paintAmmoEd();
  show("vAmmoEd");
}
function paintAmmoEd() {
  var home = AM.type === "home";
  setSeg($("amType"), AM.type);
  setSeg($("hlLenU"), AM.lenU);
  $("hlBlock").hidden = !home;
  $("amKindBuy").textContent = home ? "Loaded" : "Bought";
  $("amName").placeholder = home ? "168 SMK, 43.0 Varget" : "Federal 150gr SP";
  $("amNote").placeholder = home ? "Batch, brass lot" : "Shop, batch, lot number";
  $("amInK").textContent = home ? "Loaded ever" : "Bought ever";
  $("amRetire").textContent = AM.retired ? "Bring back" : "Retire";
  $("amRetire").hidden = amIsNew;
  $("amDel").hidden = amIsNew;
  setSeg($("amKind"), amKind);
  var held = stockHeld(AM.id),
    tot = ammoTotals(AM.id);
  $("amHeld").textContent = held;
  $("amIn").textContent = tot.inn;
  $("amUsed").textContent = tot.fired;
  $("amAdj").textContent = (tot.adj > 0 ? "+" : "") + tot.adj;
  var ac = calMatch($("amCal").value);
  AM.cal = ac ? ac.name : $("amCal").value.trim();
  AM.calId = ac ? ac.id : "";
  var w = stockWarn(AM, held),
    lim = calLimit(ac),
    q = parseInt($("amQty").value, 10),
    after = calHeld(ac) + (amKind === "buy" ? q : amKind === "set" ? q - held : 0);
  if (amKind !== "use" && lim > 0 && q > 0 && after > lim)
    w =
      (w ? w + " " : "") +
      "That would take " +
      (ac ? ac.name : "this calibre") +
      " to " +
      after +
      ", over the certificate limit of " +
      lim +
      ".";
  $("amWarn").textContent = w;
  $("amWarn").className = w ? "hint warn" : "hint";
  var ev = live(DB.stockEv)
    .filter(function (e) {
      return e.sid === AM.id;
    })
    .sort(function (a, b) {
      return a.when < b.when ? 1 : -1;
    });
  if (!ev.length) {
    $("amHist").innerHTML =
      '<p class="hint" style="margin:0">No changes yet. Shots from the log show in the stock report.</p>';
    return;
  }
  var name = { buy: home ? "Loaded" : "Bought", use: "Used", set: "Count fix" },
    h = '<div class="items">';
  ev.forEach(function (e) {
    h +=
      '<div class="item"><div class="main" style="cursor:default"><div class="n" style="font-size:16px">' +
      name[evKind(e)] +
      " " +
      (e.qty > 0 ? "+" : "") +
      e.qty +
      '</div><div class="s">' +
      esc(String(e.when).replace("T", " ") + (e.note && e.note !== "Counted" ? ", " + e.note : "")) +
      "</div></div>" +
      '<button type="button" class="icon-btn" data-delev="' +
      esc(e.id) +
      '" aria-label="Remove this change">' +
      BACK_SVG +
      "</button></div>";
  });
  $("amHist").innerHTML = h + "</div>";
}
segVal($("amKind"), function (v) {
  amKind = v;
  paintAmmoEd();
});
segVal($("amType"), function (v) {
  AM.type = v;
  paintAmmoEd();
});
segVal($("hlLenU"), function (v) {
  AM.lenU = v;
  paintAmmoEd();
});
$("amQty").addEventListener("input", paintAmmoEd);
$("amCal").addEventListener("input", function () {
  paintAmmoCal();
  paintAmmoEd();
});
function saveAmmoRecord() {
  AM.name = $("amName").value.trim();
  var ac = calMatch($("amCal").value);
  HL_FIELDS.forEach(function (k) {
    AM[k] = $("hl" + k.charAt(0).toUpperCase() + k.slice(1)).value.trim();
  });
  if (!AM.name) {
    $("amErr").textContent = "Give the ammo a name.";
    return false;
  }
  if (!ac) {
    $("amErr").textContent = $("amCal").value.trim()
      ? "Pick the calibre from your list, or add it as a new calibre."
      : "Pick the calibre.";
    $("amCal").focus();
    return false;
  }
  AM.cal = ac.name;
  AM.calId = ac.id;
  AM.u = now();
  if (amIsNew) {
    DB.stock.push(AM);
    amIsNew = false;
  } else
    DB.stock = DB.stock.map(function (s) {
      return s.id === AM.id ? AM : s;
    });
  $("amErr").textContent = "";
  return true;
}
$("amAdd").addEventListener("click", function () {
  var q = parseInt($("amQty").value, 10);
  if (!(q >= 0)) {
    toast("Enter the number of rounds");
    return;
  }
  if (!saveAmmoRecord()) return;
  var delta = amKind === "buy" ? q : amKind === "use" ? -q : q - stockHeld(AM.id);
  if (!delta) {
    toast("No change");
    return;
  }
  DB.stockEv.push({
    id: uid(),
    u: now(),
    del: false,
    sid: AM.id,
    when: localISO(),
    qty: delta,
    kind: amKind,
    note: $("amNote").value.trim(),
  });
  $("amQty").value = "";
  $("amNote").value = "";
  changed();
  paintAmmoEd();
  toast("Change added");
});
$("amHist").addEventListener("click", function (e) {
  var b = e.target.closest("[data-delev]");
  if (!b) return;
  if (!confirm("Remove this change from the history?")) return;
  DB.stockEv.forEach(function (x) {
    if (x.id === b.getAttribute("data-delev")) {
      x.del = true;
      x.u = now();
    }
  });
  changed();
  paintAmmoEd();
});
$("addAmmo").addEventListener("click", function () {
  openAmmo(null);
});
$("amSave").addEventListener("click", function () {
  if (saveAmmoRecord()) {
    changed();
    toast("Ammo saved");
    openKit("ammo");
  }
});
$("amRetire").addEventListener("click", function () {
  if (!saveAmmoRecord()) return;
  AM.retired = !AM.retired;
  AM.u = now();
  DB.stock = DB.stock.map(function (s) {
    return s.id === AM.id ? AM : s;
  });
  if (AM.retired)
    DB.profiles.forEach(function (p) {
      if (p.stockId === AM.id) {
        p.stockId = "";
        p.u = now();
      }
    });
  changed();
  toast(AM.retired ? "Retired. History kept." : "Back in use");
  openKit("ammo");
});
$("amDel").addEventListener("click", function () {
  if (
    !confirm(
      "Delete " +
        (AM.name || "this ammo") +
        " and its history? It will also drop out of the stock report. Retire keeps it.",
    )
  )
    return;
  DB.stock.forEach(function (s) {
    if (s.id === AM.id) {
      s.del = true;
      s.u = now();
    }
  });
  DB.stockEv.forEach(function (e) {
    if (e.sid === AM.id && !e.del) {
      e.del = true;
      e.u = now();
    }
  });
  DB.profiles.forEach(function (p) {
    if (p.stockId === AM.id) {
      p.stockId = "";
      p.u = now();
    }
  });
  changed();
  toast("Ammo deleted");
  openKit("ammo");
});

/* stock report for the firearms enquiry officer */
function rpRange() {
  var p = L.rpPeriod || "year",
    d = new Date();
  if (p === "year") return { from: d.getFullYear() + "-01-01T00:00", label: "1 Jan " + d.getFullYear() + " to today" };
  if (p === "12m") {
    var f = new Date(d.getTime());
    f.setFullYear(f.getFullYear() - 1);
    return { from: localISO(f), label: f.toLocaleDateString("en-GB") + " to today" };
  }
  return { from: "", label: "All records" };
}
function rpMoves(from) {
  var mv = [];
  live(DB.stockEv).forEach(function (e) {
    if (!inRange(e.when, from, "")) return;
    var s = byId("stock", e.sid);
    if (!s || s.del) return;
    var k = evKind(e);
    mv.push({
      when: e.when,
      ammo: s.name,
      cal: calOf(s) ? calOf(s).name : s.cal || "",
      what: k === "buy" ? (s.type === "home" ? "Loaded" : "Bought") : k === "use" ? "Used" : "Count fix",
      qty: e.qty,
      note: e.note || "",
    });
  });
  live(DB.log).forEach(function (x) {
    var n = parseInt(x.shots, 10) || 0;
    if (!n || !inRange(x.when, from, "")) return;
    var sid = logAmmo(x),
      s = byId("stock", sid);
    mv.push({
      when: x.when,
      ammo: s ? s.name : x.ammoName || "Ammo not picked",
      cal: s && calOf(s) ? calOf(s).name : s ? s.cal || "" : "",
      what: "Fired",
      qty: -n,
      note: [x.place, x.rifleName].filter(Boolean).join(", "),
      noAmmo: !s,
    });
  });
  return mv.sort(function (a, b) {
    return a.when < b.when ? 1 : -1;
  });
}
function renderReport() {
  setSeg($("rpPeriod"), L.rpPeriod || "year");
  var r = rpRange(),
    ss = live(DB.stock),
    cals = {};
  ss.forEach(function (s) {
    var c = calOf(s),
      k = c ? c.name.toLowerCase() : "~";
    (cals[k] = cals[k] || { cal: c, label: c ? c.name : "No calibre", items: [] }).items.push(s);
  });
  $("rpHeadP").textContent =
    "Made " +
    new Date().toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) +
    ". Period: " +
    r.label +
    ".";
  $("rpWhen").textContent =
    "Made " + new Date().toLocaleDateString("en-GB") + ". Period for In and out: " + r.label + ".";
  var keys = Object.keys(cals).sort();
  if (!keys.length) {
    $("rpHeld").innerHTML = '<p class="empty">No ammo recorded.</p>';
    $("rpAct").innerHTML = "";
    $("rpMoves").innerHTML = "";
    return;
  }
  var h =
    '<table class="card"><thead><tr><th class="l">Calibre / ammo</th><th>In stock</th><th>Limit</th></tr></thead><tbody>';
  keys.forEach(function (k) {
    var c = cals[k],
      tot = calHeld(c.cal),
      lim = calLimit(c.cal);
    h +=
      '<tr class="tot"><td class="l">' +
      esc(c.label) +
      "</td><td>" +
      tot +
      "</td><td>" +
      (lim || "–") +
      (lim && tot > lim ? ' <span class="warn">over</span>' : "") +
      "</td></tr>";
    c.items.forEach(function (s) {
      var hd = stockHeld(s.id);
      if (!hd && s.retired) return;
      h +=
        '<tr><td class="l" style="font-weight:400">' +
        esc(s.name) +
        (s.type === "home" ? " (home load)" : "") +
        (s.retired ? " (retired)" : "") +
        "</td><td>" +
        hd +
        "</td><td></td></tr>";
    });
  });
  $("rpHeld").innerHTML = h + "</tbody></table>";
  var a =
    '<table class="card"><thead><tr><th class="l">Calibre / ammo</th><th>Bought</th><th>Loaded</th><th>Fired or used</th><th>Fixes</th></tr></thead><tbody>';
  keys.forEach(function (k) {
    var c = cals[k],
      sum = { b: 0, l: 0, f: 0, x: 0 },
      rows = "";
    c.items.forEach(function (s) {
      var t = ammoTotals(s.id, r.from, ""),
        b = s.type === "home" ? 0 : t.inn,
        l = s.type === "home" ? t.inn : 0;
      sum.b += b;
      sum.l += l;
      sum.f += t.fired;
      sum.x += t.adj;
      if (t.inn || t.fired || t.adj)
        rows +=
          '<tr><td class="l" style="font-weight:400">' +
          esc(s.name) +
          "</td><td>" +
          (b || "") +
          "</td><td>" +
          (l || "") +
          "</td><td>" +
          (t.fired || "") +
          "</td><td>" +
          (t.adj ? (t.adj > 0 ? "+" : "") + t.adj : "") +
          "</td></tr>";
    });
    a +=
      '<tr class="tot"><td class="l">' +
      esc(c.label) +
      "</td><td>" +
      sum.b +
      "</td><td>" +
      sum.l +
      "</td><td>" +
      sum.f +
      "</td><td>" +
      (sum.x > 0 ? "+" : "") +
      sum.x +
      "</td></tr>" +
      rows;
  });
  $("rpAct").innerHTML = a + "</tbody></table>";
  var mv = rpMoves(r.from),
    noAmmo = mv
      .filter(function (m) {
        return m.noAmmo;
      })
      .reduce(function (t, m) {
        return t - m.qty;
      }, 0);
  if (!mv.length) $("rpMoves").innerHTML = '<p class="hint" style="margin:0">Nothing in this period.</p>';
  else {
    var m =
      '<div class="moves-wrap"><table class="card"><thead><tr><th class="l">Date</th><th class="l">Ammo</th><th class="l">What</th><th>Rounds</th></tr></thead><tbody>';
    mv.forEach(function (x) {
      m +=
        '<tr><td class="l" style="font-weight:400;white-space:nowrap">' +
        esc(String(x.when).slice(0, 10).split("-").reverse().join("/")) +
        '</td><td class="l">' +
        esc(x.ammo) +
        (x.cal ? '<br><span style="color:var(--muted);font-size:12px">' + esc(x.cal) + "</span>" : "") +
        '</td><td class="l">' +
        esc(x.what) +
        (x.note ? '<br><span style="color:var(--muted);font-size:12px">' + esc(x.note) + "</span>" : "") +
        "</td><td>" +
        (x.qty > 0 ? "+" : "") +
        x.qty +
        "</td></tr>";
    });
    $("rpMoves").innerHTML = m + "</tbody></table></div>";
  }
  $("rpNote").textContent =
    (noAmmo
      ? noAmmo +
        " rounds in the log have no ammo picked, so they are not counted against any stock. Open those log entries and pick the ammo. "
      : "") + "Fired comes from the log. Count fixes are corrections made with Count is.";
  $("rpNote").className = noAmmo ? "hint warn" : "hint";
}
$("openReport").addEventListener("click", function () {
  renderReport();
  show("vReport");
});
segVal($("rpPeriod"), function (v) {
  L.rpPeriod = v;
  saveL();
  renderReport();
});
$("rpPrint").addEventListener("click", function () {
  renderReport();
  printPart("printReport");
});
$("rpCsv").addEventListener("click", function () {
  var r = rpRange();
  var csv = "Held now\nCalibre,Ammo,Kind,In stock,Certificate limit\n";
  live(DB.stock).forEach(function (s) {
    csv +=
      [
        calOf(s) ? calOf(s).name : s.cal,
        s.name,
        s.type === "home" ? "Home load" : "Factory",
        stockHeld(s.id),
        calLimit(calOf(s)) || "",
      ]
        .map(csvCell)
        .join(",") + "\n";
  });
  csv += "\nMovements (" + r.label + ")\nDate,Calibre,Ammo,What,Rounds,Note\n";
  rpMoves(r.from).forEach(function (m) {
    csv += [String(m.when).replace("T", " "), m.cal, m.ammo, m.what, m.qty, m.note].map(csvCell).join(",") + "\n";
  });
  var name = "dialit-stock-" + localISO().slice(0, 10) + ".csv";
  saveFile(name, csv, "text/csv", "Ammo stock report");
});
