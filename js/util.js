/* Dial it: Small helpers shared by every screen. */
"use strict";

/* ===== helpers ===== */
var $ = function (id) {
  return document.getElementById(id);
};
function num(s) {
  if (s === undefined || s === null) return NaN;
  s = String(s).replace(",", ".").trim();
  if (s === "") return NaN;
  return Number(s);
}
function fmt(n, dp) {
  return (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp);
}
function sgn(n, dp) {
  var t = fmt(Math.abs(n), dp);
  return (+t === 0 ? "" : n < 0 ? "-" : "") + t;
}
function round(n, dp) {
  return String(+(+n).toFixed(dp));
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function now() {
  return Date.now();
}
function localISO(d) {
  d = d || new Date();
  var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}
function hhmm(t) {
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
var tt;
function toast(t) {
  var el = $("toast");
  el.textContent = t;
  el.classList.add("on");
  clearTimeout(tt);
  tt = setTimeout(function () {
    el.classList.remove("on");
  }, 1900);
}
function setSeg(el, val) {
  el.querySelectorAll("button").forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === String(val)));
  });
}
function segVal(el, cb) {
  el.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) cb(b.getAttribute("data-v"));
  });
}
var BACK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';

/* Hand a file to the phone: the share sheet where there is one, otherwise a download. */
function saveFile(name, text, type, title) {
  var blob = new Blob([text], { type: type });
  try {
    var file = new File([blob], name, { type: type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title }).then(
        function () {
          return true;
        },
        function (e) {
          return e && e.name === "AbortError" ? false : download();
        },
      );
    }
  } catch (e) {}
  return Promise.resolve(download());
  function download() {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }
}
/* One CSV cell, quoted when needed. */
function csvCell(v) {
  v = String(v == null ? "" : v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
