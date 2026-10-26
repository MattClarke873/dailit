/* Dial it: Start up. */
"use strict";

/* ===== start ===== */
load();
applyTheme();
paintDial();
paintSync();
show("vIn");
sync(false);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
