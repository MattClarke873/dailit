/* Dial it: Dropbox sync. */
"use strict";

/* ===== Dropbox sync ===== */
var DBX_FILE = "/dialit.json";
function b64url(buf) {
  var s = "",
    b = new Uint8Array(buf);
  for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randStr(n) {
  var a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a).slice(0, n);
}
var PK = null;
function getPKCE() {
  if (PK) return Promise.resolve(PK);
  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("dialit.pkce") || "null");
  } catch (e) {}
  var make =
    saved && saved.v && saved.c
      ? Promise.resolve(saved)
      : (function () {
          var v = randStr(64);
          return crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)).then(function (h) {
            var o = { v: v, c: b64url(h) };
            try {
              localStorage.setItem("dialit.pkce", JSON.stringify(o));
            } catch (e) {}
            return o;
          });
        })();
  return make.then(function (o) {
    PK = o;
    return o;
  });
}
function paintGetCode() {
  var a = $("getCode"),
    key = $("appKey").value.trim();
  if (!key || !(window.crypto && crypto.subtle)) {
    a.setAttribute("aria-disabled", "true");
    a.href = "#";
    return;
  }
  getPKCE().then(function (pk) {
    a.href =
      "https://www.dropbox.com/oauth2/authorize?client_id=" +
      encodeURIComponent(key) +
      "&response_type=code&token_access_type=offline&code_challenge_method=S256&code_challenge=" +
      pk.c;
    a.removeAttribute("aria-disabled");
  });
}
$("appKey").addEventListener("input", function () {
  L.dbxKey = $("appKey").value.trim();
  saveL();
  paintGetCode();
});
$("getCode").addEventListener("click", function (e) {
  if (this.getAttribute("aria-disabled") === "true") {
    e.preventDefault();
    toast("Paste your App key first");
    return;
  }
  if (!navigator.onLine) {
    e.preventDefault();
    toast("Needs signal to get a code");
  }
});
$("connect").addEventListener("click", async function () {
  var key = $("appKey").value.trim(),
    code = $("authCode").value.trim();
  if (!key) {
    toast("Paste your App key first");
    $("appKey").focus();
    return;
  }
  if (!code) {
    toast("Paste the code from Dropbox");
    $("authCode").focus();
    return;
  }
  if (!navigator.onLine) {
    toast("Needs signal to link");
    return;
  }
  var btn = this;
  btn.disabled = true;
  try {
    var pk = await getPKCE();
    var r = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: code, grant_type: "authorization_code", code_verifier: pk.v, client_id: key }),
    });
    var j = await r.json().catch(function () {
      return {};
    });
    if (!r.ok || !j.refresh_token) {
      var why = j.error_description || j.error || "error " + r.status;
      if (/invalid_grant|code/i.test(why))
        why = "That code didn't work. Codes only work once and expire fast. Press Get code for a new one.";
      throw new Error(why);
    }
    L.dbxKey = key;
    L.dbx = { access: j.access_token, refresh: j.refresh_token, exp: now() + (j.expires_in || 14400) * 1000 };
    L.syncErr = "";
    saveL();
    localStorage.removeItem("dialit.pkce");
    PK = null;
    $("authCode").value = "";
    toast("Dropbox linked");
    paintSync();
    sync(false);
  } catch (e) {
    L.syncErr = e && e.message === "Failed to fetch" ? "Couldn't reach Dropbox." : e.message;
    saveL();
    paintSync();
    localStorage.removeItem("dialit.pkce");
    PK = null;
    paintGetCode();
  }
  btn.disabled = false;
});
async function token(force) {
  if (!L.dbx) throw new Error("Not connected");
  if (!force && L.dbx.access && L.dbx.exp > now() + 60000) return L.dbx.access;
  var r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: L.dbx.refresh, client_id: L.dbxKey }),
  });
  var j = await r.json().catch(function () {
    return {};
  });
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) {
      L.dbx = null;
      saveL();
      throw new Error("Dropbox access ended. Link again.");
    }
    throw new Error("Dropbox error " + r.status);
  }
  L.dbx.access = j.access_token;
  L.dbx.exp = now() + (j.expires_in || 14400) * 1000;
  saveL();
  return L.dbx.access;
}
async function dbxCall(url, opts, retry) {
  var t = await token(false);
  opts.headers = opts.headers || {};
  opts.headers.Authorization = "Bearer " + t;
  var r = await fetch(url, opts);
  if (r.status === 401 && !retry) {
    await token(true);
    return dbxCall(url, opts, true);
  }
  return r;
}
function merge(a, b) {
  var out = { v: 2 };
  COLL.forEach(function (k) {
    var m = {};
    (a[k] || []).concat((b && b[k]) || []).forEach(function (x) {
      if (!x || !x.id) return;
      if (!m[x.id] || (x.u || 0) > (m[x.id].u || 0)) m[x.id] = x;
    });
    out[k] = Object.keys(m).map(function (id) {
      return m[id];
    });
  });
  return out;
}
var syncing = false,
  again = false,
  syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(function () {
    sync(false);
  }, 2500);
}
async function sync(manual) {
  if (!L.dbx) {
    paintSync();
    return;
  }
  if (!navigator.onLine) {
    paintSync();
    if (manual) toast("No signal. Saved on phone.");
    return;
  }
  if (syncing) {
    again = true;
    return;
  }
  syncing = true;
  paintSync();
  try {
    var r = await dbxCall("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: { "Dropbox-API-Arg": JSON.stringify({ path: DBX_FILE }) },
    });
    var remote = null;
    if (r.ok) remote = JSON.parse(await r.text());
    else if (r.status !== 409) throw new Error("Dropbox error " + r.status);
    DB = merge(DB, remote);
    ensureProfile();
    saveDB();
    var u = await dbxCall("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ path: DBX_FILE, mode: "overwrite", mute: true }),
      },
      body: JSON.stringify(DB),
    });
    if (!u.ok) throw new Error("Dropbox error " + u.status);
    L.lastSync = now();
    L.syncErr = "";
    saveL();
    if (manual) toast("Synced with Dropbox");
    refreshOpenView();
  } catch (e) {
    L.syncErr =
      e && e.message === "Failed to fetch" ? "Couldn't reach Dropbox. Saved on phone." : e.message || "Sync failed";
    saveL();
    if (manual) toast("Sync failed. Saved on phone.");
  }
  syncing = false;
  paintSync();
  if (again) {
    again = false;
    sync(false);
  }
}
function refreshOpenView() {
  if (!$("vKit").hidden) renderKit();
  if (!$("vLog").hidden) renderLog();
  if (!$("vDope").hidden) renderDope();
  if (!$("vIn").hidden) paintDial();
}
function paintSync() {
  var t = "",
    s = "",
    cls = "";
  if (!L.dbx) {
    t = "Not connected";
    s = L.syncErr || "Saving on this phone only.";
  } else if (syncing) {
    t = "Syncing";
    s = "Copying to Dropbox";
    cls = "off";
  } else if (!navigator.onLine) {
    t = "No signal";
    s = "Saved on phone. Syncs when you have signal.";
    cls = "off";
  } else if (L.syncErr) {
    t = "Sync problem";
    s = L.syncErr;
    cls = "bad";
  } else {
    t = "Synced";
    s = L.lastSync
      ? "Last " +
        new Date(L.lastSync).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Ready";
    cls = "ok";
  }
  $("sDot").className = "dot " + cls;
  $("sT").textContent = t;
  $("sS").textContent = s;
  $("tabDot").style.background =
    cls === "ok" ? "var(--ok)" : cls === "bad" ? "var(--accent)" : cls === "off" ? "var(--wait)" : "transparent";
  if (document.activeElement !== $("appKey")) {
    $("appKey").value = L.dbxKey || "";
    if (!L.dbx) paintGetCode();
  }
  paintBackup();
  $("syncSetup").hidden = !!L.dbx;
  $("connect").hidden = !!L.dbx;
  $("syncNow").hidden = !L.dbx;
  $("disconnect").hidden = !L.dbx;
}
$("syncNow").addEventListener("click", function () {
  sync(true);
});
$("disconnect").addEventListener("click", function () {
  if (!confirm("Disconnect Dropbox? Your data stays on this phone and in Dropbox.")) return;
  L.dbx = null;
  L.syncErr = "";
  saveL();
  paintSync();
});
window.addEventListener("online", function () {
  paintSync();
  sync(false);
});
window.addEventListener("offline", paintSync);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") sync(false);
});
