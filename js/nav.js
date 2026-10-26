/* Dial it: Moving between screens and tabs. */
"use strict";

/* ===== navigation ===== */
var TAB_OF = {
  vIn: "vIn",
  vRes: "vIn",
  vAir: "vIn",
  vPhoto: "vIn",
  vKit: "vKit",
  vRifleEd: "vKit",
  vAmmoEd: "vKit",
  vReport: "vKit",
  vChronoEd: "vKit",
  vLog: "vLog",
  vLogEd: "vLog",
  vDope: "vDope",
  vSync: "vSync",
};
function show(id) {
  Object.keys(TAB_OF).forEach(function (v) {
    $(v).hidden = v !== id;
  });
  document.querySelectorAll(".tab").forEach(function (t) {
    if (t.getAttribute("data-tab") === TAB_OF[id]) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}
function openView(v) {
  if (v === "vIn") paintDial();
  if (v === "vAir") paintAir();
  if (v === "vKit") renderKit();
  if (v === "vLog") renderLog();
  if (v === "vDope") renderDope();
  if (v === "vSync") paintSync();
  show(v);
}
function openKit(tab) {
  L.kitTab = tab;
  saveL();
  openView("vKit");
}
document.querySelectorAll(".tab").forEach(function (t) {
  t.addEventListener("click", function () {
    openView(t.getAttribute("data-tab"));
  });
});
document.querySelectorAll("[data-go]").forEach(function (b) {
  b.addEventListener("click", function () {
    openView(b.getAttribute("data-go"));
  });
});
document.querySelectorAll("[data-kit]").forEach(function (b) {
  b.addEventListener("click", function () {
    openKit(b.getAttribute("data-kit"));
  });
});
