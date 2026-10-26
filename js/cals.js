/* Dial it: calibres and their certificate limits (Settings tab). Ammo picks its calibre from this list. */
"use strict";

/* Compare calibre names loosely, so ".308 Win", "308 win" and ".308win" are the same. */
function calKey(c) {
  return String(c || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
/* The live calibre whose name matches the text, or null. */
function calMatch(text) {
  var k = calKey(text);
  if (!k) return null;
  return (
    live(DB.cals).filter(function (c) {
      return calKey(c.name) === k;
    })[0] || null
  );
}
/* The calibre of an ammo record, or null. Older records only have the typed name. */
function calOf(s) {
  var c = s && s.calId ? byId("cals", s.calId) : null;
  if (c && !c.del) return c;
  return s ? calMatch(s.cal) : null;
}
function calLimit(c) {
  return c ? parseInt(c.limit, 10) || 0 : 0;
}
/* Rounds held across every ammo in a calibre (null = ammo with no calibre). */
function calHeld(c) {
  return live(DB.stock).reduce(function (t, s) {
    var sc = calOf(s);
    return t + ((sc ? sc.id : "") === (c ? c.id : "") ? stockHeld(s.id) : 0);
  }, 0);
}

/* Older ammo had calibre and limit typed on each record. Make one calibre per name, with the highest limit typed,
   and point the ammo at it. Ids come from the name, so two phones doing this end up with the same calibre. */
function ensureCals() {
  var made = false;
  live(DB.stock).forEach(function (s) {
    if (s.calId && byId("cals", s.calId)) return;
    var k = calKey(s.cal);
    if (!k) return;
    var c = calMatch(s.cal);
    if (!c) {
      c = byId("cals", "cal-" + k);
      if (c) c.del = false;
      else {
        c = { id: "cal-" + k, u: 1, del: false, name: String(s.cal).trim(), limit: "" };
        DB.cals.push(c);
      }
    }
    var lim = parseInt(s.hold, 10);
    if (lim > calLimit(c)) c.limit = String(lim);
    s.calId = c.id;
    made = true;
  });
  return made;
}

/* ===== Settings: calibre list ===== */
function renderCals() {
  var cs = live(DB.cals).sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  if (!cs.length) {
    $("calList2").innerHTML =
      '<p class="empty" style="margin-top:4px">No calibres yet. Add each one on your certificate.</p>';
    return;
  }
  var h = '<div class="items">';
  cs.forEach(function (c) {
    var held = calHeld(c),
      lim = calLimit(c),
      n = live(DB.stock).filter(function (s) {
        return calOf(s) === c;
      }).length,
      over = lim > 0 && held > lim;
    h +=
      '<div class="item"><button type="button" class="main" data-cal="' +
      esc(c.id) +
      '"><div class="n">' +
      esc(c.name) +
      (over ? ' <span class="tag warn">Over limit</span>' : "") +
      '</div><div class="s">' +
      esc(
        [held + " held", lim ? "limit " + lim : "no limit set", n ? n + " ammo type" + (n === 1 ? "" : "s") : ""]
          .filter(Boolean)
          .join(", "),
      ) +
      "</div></button></div>";
  });
  $("calList2").innerHTML = h + "</div>";
}
$("calList2").addEventListener("click", function (e) {
  var b = e.target.closest("[data-cal]");
  if (b) openCal(b.getAttribute("data-cal"));
});
$("addCal").addEventListener("click", function () {
  openCal(null);
});

/* ===== calibre editor ===== */
var CE = null,
  ceIsNew = false,
  ceBack = null; // where Back and Save go: null = Settings, "ammo" = the ammo being edited
function openCal(id, name, back) {
  var src = id ? byId("cals", id) : null;
  ceIsNew = !src;
  ceBack = back || null;
  CE = src ? JSON.parse(JSON.stringify(src)) : { id: uid(), u: now(), del: false, name: name || "", limit: "" };
  $("ceTitle").textContent = ceIsNew ? "New calibre" : "Calibre";
  $("ceName").value = CE.name;
  $("ceLimit").value = CE.limit || "";
  $("ceErr").textContent = "";
  var n = ceIsNew
    ? 0
    : live(DB.stock).filter(function (s) {
        return calOf(s) && calOf(s).id === CE.id;
      }).length;
  $("ceInfo").textContent = ceIsNew
    ? "Type it as it is on your certificate. Ammo will pick it from your list."
    : calHeld(src) + " rounds held across " + n + " ammo type" + (n === 1 ? "" : "s") + ".";
  $("ceDel").hidden = ceIsNew;
  show("vCalEd");
  if (ceIsNew && !CE.name) $("ceName").focus();
}
function closeCal() {
  if (ceBack === "ammo") {
    show("vAmmoEd");
    paintAmmoCal();
    paintAmmoEd();
  } else openView("vSync");
}
$("calBack").addEventListener("click", closeCal);
$("ceSave").addEventListener("click", function () {
  var name = $("ceName").value.trim(),
    lim = $("ceLimit").value.trim();
  if (!name) {
    $("ceErr").textContent = "Type the calibre.";
    return;
  }
  var same = calMatch(name);
  if (same && same.id !== CE.id) {
    $("ceErr").textContent = "That is already in your list as " + same.name + ".";
    return;
  }
  if (lim && !(parseInt(lim, 10) >= 0)) {
    $("ceErr").textContent = "The limit must be a whole number of rounds.";
    return;
  }
  CE.name = name;
  CE.limit = lim;
  CE.u = now();
  if (ceIsNew) DB.cals.push(CE);
  else
    DB.cals = DB.cals.map(function (c) {
      return c.id === CE.id ? CE : c;
    });
  // keep each ammo's calibre name the same as the list
  DB.stock.forEach(function (s) {
    if (!s.del && calOf(s) && calOf(s).id === CE.id && (s.cal !== name || s.calId !== CE.id)) {
      s.cal = name;
      s.calId = CE.id;
      s.u = now();
    }
  });
  changed();
  toast(ceIsNew ? "Calibre added" : "Calibre saved");
  if (ceBack === "ammo") {
    $("amCal").value = name;
    AM.cal = name;
    AM.calId = CE.id;
  }
  closeCal();
});
$("ceDel").addEventListener("click", function () {
  var n = live(DB.stock).filter(function (s) {
    return calOf(s) && calOf(s).id === CE.id;
  }).length;
  if (n) {
    $("ceErr").textContent =
      n +
      " ammo type" +
      (n === 1 ? " uses" : "s use") +
      " this calibre. Move " +
      (n === 1 ? "it" : "them") +
      " to another calibre or delete " +
      (n === 1 ? "it" : "them") +
      " first.";
    return;
  }
  if (!confirm("Delete " + CE.name + "?")) return;
  DB.cals.forEach(function (c) {
    if (c.id === CE.id) {
      c.del = true;
      c.u = now();
    }
  });
  changed();
  toast("Calibre deleted");
  closeCal();
});

/* ===== typed autofill =====
   Calibre: the list of calibres. Load fields and places: what you have typed before, so the same thing is spelt the same. */
function fillList(id, values) {
  var seen = {},
    h = "";
  values.forEach(function (v) {
    v = String(v || "").trim();
    var k = v.toLowerCase();
    if (!v || seen[k]) return;
    seen[k] = true;
    h += '<option value="' + esc(v) + '"></option>';
  });
  $(id).innerHTML = h;
}
function fillAmmoLists() {
  fillList(
    "calList",
    live(DB.cals)
      .map(function (c) {
        return c.name;
      })
      .sort(),
  );
  var ss = live(DB.stock);
  [
    ["dlBullet", "bullet"],
    ["dlPowder", "powder"],
    ["dlPrimer", "primer"],
    ["dlCase", "case"],
  ].forEach(function (f) {
    fillList(
      f[0],
      ss.map(function (s) {
        return s[f[1]];
      }),
    );
  });
}
function fillPlaceList() {
  fillList(
    "dlPlace",
    live(DB.log)
      .sort(function (a, b) {
        return a.when < b.when ? 1 : -1;
      })
      .map(function (x) {
        return x.place;
      }),
  );
}

/* The calibre line under the ammo's Calibre box: what it matched, or how to fix it. */
function paintAmmoCal() {
  var text = $("amCal").value.trim(),
    c = calMatch(text);
  $("amCalAdd").hidden = !text || !!c;
  if (!text)
    $("amCalOut").textContent = live(DB.cals).length
      ? "Pick from your calibres."
      : "Add your calibres in Settings first.";
  else if (c) {
    var lim = calLimit(c);
    $("amCalOut").textContent =
      c.name + ": " + calHeld(c) + " held" + (lim ? ", limit " + lim : ", no limit set") + ".";
  } else $("amCalOut").textContent = "Not in your calibres. Pick one from the list, or add it.";
  $("amCalOut").className = text && !c ? "hint warn" : "hint";
}
$("amCal").addEventListener("change", function () {
  // tidy to the name in the list once picked
  var c = calMatch(this.value);
  if (c) this.value = c.name;
  paintAmmoCal();
  paintAmmoEd();
});
$("amCalAdd").addEventListener("click", function () {
  openCal(null, $("amCal").value.trim(), "ammo");
});
