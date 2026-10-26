/* Dial it: Group from a photo of the target. */
"use strict";

/* ===== group from photo ===== */
var PH = { img: null, pts: [], stage: "scale" };
function openPhoto() {
  show("vPhoto");
  paintPhoto();
}
$("photoIn").addEventListener("change", function () {
  var f = this.files && this.files[0];
  if (!f) return;
  var img = new Image();
  img.onload = function () {
    PH.img = img;
    PH.pts = [];
    PH.v = null;
    $("phBox").hidden = false;
    phFit();
    paintPhoto();
  };
  img.onerror = function () {
    toast("Couldn't open that photo");
  };
  img.src = URL.createObjectURL(f);
  this.value = "";
});
segVal($("phU"), function (v) {
  PH.u = v;
  paintPhoto();
});
$("phLen").addEventListener("input", function () {
  paintPhoto();
});
function phStage() {
  var n = PH.pts.length;
  if (!PH.img) return "none";
  if (n < 2) return "scale";
  if (!(num($("phLen").value) > 0)) return "len";
  if (n < 3) return "aim";
  return "holes";
}
function paintPhoto() {
  if (!PH.u) PH.u = L.missU === "in" ? "in" : L.missU;
  setSeg($("phU"), PH.u);
  var st = phStage(),
    msg = {
      none: "Take the photo square on to the target.",
      scale: "Step 1: tap two marks a known distance apart, like grid lines or ring edges.",
      len: "Step 2: type how far apart those two marks are.",
      aim: "Step 3: tap your aim point.",
      holes: "Step 4: tap each bullet hole. Tap Undo to take one back.",
    }[st];
  $("phStep").textContent = msg;
  $("phBox").hidden = !PH.img;
  $("phTools").hidden = !PH.img;
  $("phZoomHint").hidden = !PH.img;
  $("phScaleRow").hidden = PH.pts.length < 2;
  drawPhoto();
  var g = groupStats();
  $("phOut").hidden = !g;
  if (g) {
    $("phN").textContent = g.n;
    $("phES").textContent = g.n > 1 ? lenStr(g.es / 1000, PH.u) : "–";
    $("phMR").textContent = g.n > 1 ? lenStr(g.mr / 1000, PH.u) : "–";
    $("phC").textContent =
      (g.dy ? lenStr(Math.abs(g.dy) / 1000, PH.u) + (g.dy > 0 ? " low" : " high") : "") +
      (g.dx ? " " + lenStr(Math.abs(g.dx) / 1000, PH.u) + (g.dx > 0 ? " right" : " left") : "");
  }
}
function groupStats() {
  var len = num($("phLen").value);
  if (PH.pts.length < 4 || !(len > 0)) return null;
  var toMM = { mm: 1, in: 25.4, cm: 10 }[PH.u],
    a = PH.pts[0],
    b = PH.pts[1],
    pxd = Math.hypot(a.x - b.x, a.y - b.y);
  if (!pxd) return null;
  var mmPerPx = (len * toMM) / pxd,
    aim = PH.pts[2],
    holes = PH.pts.slice(3);
  var cx = 0,
    cy = 0;
  holes.forEach(function (h) {
    cx += h.x;
    cy += h.y;
  });
  cx /= holes.length;
  cy /= holes.length;
  var es = 0,
    mr = 0;
  holes.forEach(function (h, i) {
    mr += Math.hypot(h.x - cx, h.y - cy);
    for (var j = i + 1; j < holes.length; j++) es = Math.max(es, Math.hypot(h.x - holes[j].x, h.y - holes[j].y));
  });
  mr /= holes.length;
  return {
    n: holes.length,
    es: es * mmPerPx,
    mr: mr * mmPerPx,
    dx: (cx - aim.x) * mmPerPx,
    dy: (cy - aim.y) * mmPerPx,
    cx: cx,
    cy: cy,
  };
}
/* View: screen = (image - o) * s, in CSS px. Markers keep a fixed screen size so they stay precise when zoomed. */
function phSize() {
  var cv = $("phCanvas"),
    W = cv.parentNode.clientWidth || 350,
    iw = PH.img.naturalWidth,
    ih = PH.img.naturalHeight;
  var H = Math.round(Math.min((W * ih) / iw, window.innerHeight * 0.62));
  return { W: W, H: Math.max(H, 200), iw: iw, ih: ih };
}
function phFitScale() {
  var z = phSize();
  return Math.min(z.W / z.iw, z.H / z.ih);
}
function phFit() {
  var z = phSize(),
    s = phFitScale();
  PH.v = { s: s, ox: (z.iw - z.W / s) / 2, oy: (z.ih - z.H / s) / 2 };
}
function phClamp() {
  var z = phSize(),
    v = PH.v,
    fit = phFitScale();
  v.s = Math.max(fit, Math.min(fit * 16, v.s));
  var vw = z.W / v.s,
    vh = z.H / v.s;
  v.ox = vw >= z.iw ? (z.iw - vw) / 2 : Math.max(0, Math.min(z.iw - vw, v.ox));
  v.oy = vh >= z.ih ? (z.ih - vh) / 2 : Math.max(0, Math.min(z.ih - vh, v.oy));
}
function phZoomAt(f, sx, sy) {
  // keep the image point under (sx,sy) fixed
  var v = PH.v,
    ix = sx / v.s + v.ox,
    iy = sy / v.s + v.oy;
  v.s *= f;
  phClamp();
  v.ox = ix - sx / v.s;
  v.oy = iy - sy / v.s;
  phClamp();
  drawPhoto();
}
function toScreen(p) {
  var v = PH.v;
  return { x: (p.x - v.ox) * v.s, y: (p.y - v.oy) * v.s };
}
function toImage(sx, sy) {
  var v = PH.v;
  return { x: sx / v.s + v.ox, y: sy / v.s + v.oy };
}
function drawPhoto() {
  var cv = $("phCanvas");
  if (!PH.img) return;
  if (!PH.v) phFit();
  var z = phSize(),
    dpr = window.devicePixelRatio || 1,
    v = PH.v;
  cv.style.height = z.H + "px";
  if (cv.width !== Math.round(z.W * dpr) || cv.height !== Math.round(z.H * dpr)) {
    cv.width = Math.round(z.W * dpr);
    cv.height = Math.round(z.H * dpr);
  }
  var g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#2B2E2B";
  g.fillRect(0, 0, z.W, z.H);
  g.setTransform(dpr * v.s, 0, 0, dpr * v.s, -v.ox * v.s * dpr, -v.oy * v.s * dpr);
  g.imageSmoothingQuality = "high";
  g.drawImage(PH.img, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  function ring(p, r, col, w) {
    var q = toScreen(p);
    g.beginPath();
    g.arc(q.x, q.y, r, 0, 2 * Math.PI);
    g.lineWidth = w;
    g.strokeStyle = col;
    g.stroke();
  }
  function pin(p, col) {
    var q = toScreen(p);
    g.beginPath();
    g.arc(q.x, q.y, 1.6, 0, 2 * Math.PI);
    g.fillStyle = col;
    g.fill();
  }
  function halo(p, r) {
    var q = toScreen(p);
    g.beginPath();
    g.arc(q.x, q.y, r, 0, 2 * Math.PI);
    g.lineWidth = 4;
    g.strokeStyle = "rgba(255,255,255,.75)";
    g.stroke();
  }
  var P = PH.pts;
  if (P.length >= 2) {
    var a = toScreen(P[0]),
      b = toScreen(P[1]);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineWidth = 1.5;
    g.strokeStyle = "#2B5C8A";
    g.setLineDash([6, 4]);
    g.stroke();
    g.setLineDash([]);
  }
  P.slice(0, 2).forEach(function (p) {
    halo(p, 7);
    ring(p, 7, "#2B5C8A", 2);
    pin(p, "#2B5C8A");
  });
  if (P.length >= 3) {
    var q = toScreen(P[2]);
    g.beginPath();
    g.moveTo(q.x - 14, q.y);
    g.lineTo(q.x - 4, q.y);
    g.moveTo(q.x + 4, q.y);
    g.lineTo(q.x + 14, q.y);
    g.moveTo(q.x, q.y - 14);
    g.lineTo(q.x, q.y - 4);
    g.moveTo(q.x, q.y + 4);
    g.lineTo(q.x, q.y + 14);
    g.lineWidth = 4;
    g.strokeStyle = "rgba(255,255,255,.8)";
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = "#1E2A1F";
    g.stroke();
    pin(P[2], "#1E2A1F");
  }
  P.slice(3).forEach(function (h) {
    halo(h, 9);
    ring(h, 9, "#C24A0A", 2);
    pin(h, "#C24A0A");
  });
  if (PH.drag !== undefined && PH.drag !== null && P[PH.drag]) {
    halo(P[PH.drag], 16);
    ring(P[PH.drag], 16, "#1E2A1F", 1.5);
  }
  var st = groupStats();
  if (st) {
    var c = toScreen({ x: st.cx, y: st.cy });
    g.beginPath();
    g.moveTo(c.x - 7, c.y - 7);
    g.lineTo(c.x + 7, c.y + 7);
    g.moveTo(c.x + 7, c.y - 7);
    g.lineTo(c.x - 7, c.y + 7);
    g.lineWidth = 2.5;
    g.strokeStyle = "#C24A0A";
    g.stroke();
  }
  var zl = v.s / phFitScale();
  $("phZl").textContent = zl > 1.05 ? "×" + round(zl, 1) : "";
}
/* touch: one finger taps to place, drags to pan (or nudges a marker it started on), two fingers pinch */
var GP = { pts: {}, mode: null };
function evPos(e) {
  var r = $("phCanvas").getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function nearestPt(sp, lim) {
  var best = -1,
    bd = lim;
  PH.pts.forEach(function (p, i) {
    var q = toScreen(p),
      d = Math.hypot(q.x - sp.x, q.y - sp.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
$("phCanvas").addEventListener("pointerdown", function (e) {
  if (!PH.img) return;
  this.setPointerCapture(e.pointerId);
  GP.pts[e.pointerId] = evPos(e);
  var ids = Object.keys(GP.pts);
  if (ids.length === 1) {
    var sp = GP.pts[e.pointerId],
      hit = nearestPt(sp, e.pointerType === "mouse" ? 12 : 22);
    GP.start = sp;
    GP.t0 = Date.now();
    GP.v0 = { ox: PH.v.ox, oy: PH.v.oy };
    GP.moved = false;
    GP.multi = false;
    GP.mode = hit >= 0 ? "drag" : "tap";
    PH.drag = hit >= 0 ? hit : null;
    if (hit >= 0) {
      var q = toScreen(PH.pts[hit]);
      GP.grab = { dx: q.x - sp.x, dy: q.y - sp.y };
      drawPhoto();
    }
  } else if (ids.length === 2) {
    var a = GP.pts[ids[0]],
      b = GP.pts[ids[1]];
    GP.mode = "pinch";
    GP.multi = true;
    PH.drag = null;
    GP.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    GP.s0 = PH.v.s;
    GP.mid0 = toImage((a.x + b.x) / 2, (a.y + b.y) / 2);
  }
});
$("phCanvas").addEventListener("pointermove", function (e) {
  if (!GP.pts[e.pointerId]) return;
  GP.pts[e.pointerId] = evPos(e);
  var ids = Object.keys(GP.pts),
    v = PH.v;
  if (GP.mode === "pinch" && ids.length >= 2) {
    var a = GP.pts[ids[0]],
      b = GP.pts[ids[1]],
      d = Math.hypot(a.x - b.x, a.y - b.y),
      mx = (a.x + b.x) / 2,
      my = (a.y + b.y) / 2;
    v.s = (GP.s0 * d) / GP.d0;
    phClamp();
    v.ox = GP.mid0.x - mx / v.s;
    v.oy = GP.mid0.y - my / v.s;
    phClamp();
    drawPhoto();
    return;
  }
  var p = GP.pts[e.pointerId],
    dx = p.x - GP.start.x,
    dy = p.y - GP.start.y;
  if (Math.hypot(dx, dy) > 6) GP.moved = true;
  if (GP.mode === "drag" && GP.moved) {
    var ip = toImage(p.x + GP.grab.dx, p.y + GP.grab.dy);
    PH.pts[PH.drag] = ip;
    drawPhoto();
  } else if ((GP.mode === "tap" || GP.mode === "pan") && GP.moved) {
    GP.mode = "pan";
    v.ox = GP.v0.ox - dx / v.s;
    v.oy = GP.v0.oy - dy / v.s;
    phClamp();
    drawPhoto();
  }
});
function gpEnd(e) {
  if (!GP.pts[e.pointerId]) return;
  var p = GP.pts[e.pointerId];
  delete GP.pts[e.pointerId];
  var left = Object.keys(GP.pts).length;
  if (GP.mode === "pinch") {
    if (!left) {
      GP.mode = null;
    } else {
      GP.mode = "pan-wait";
    }
    return;
  }
  if (left) return;
  if ((GP.mode === "tap" || GP.mode === "drag") && !GP.moved && !GP.multi && e.type === "pointerup") {
    // a still press places a mark, even next to another
    var st = phStage();
    if (st === "len") {
      toast("Type the distance between the two marks first");
      $("phLen").focus();
    } else if (st !== "none") {
      PH.pts.push(toImage(p.x, p.y));
    }
  }
  GP.mode = null;
  PH.drag = null;
  paintPhoto();
}
$("phCanvas").addEventListener("pointerup", gpEnd);
$("phCanvas").addEventListener("pointercancel", gpEnd);
$("phCanvas").addEventListener(
  "wheel",
  function (e) {
    if (!PH.img) return;
    e.preventDefault();
    var sp = evPos(e);
    phZoomAt(Math.pow(1.0015, -e.deltaY), sp.x, sp.y);
  },
  { passive: false },
);
$("phIn1").addEventListener("click", function () {
  var z = phSize();
  phZoomAt(1.6, z.W / 2, z.H / 2);
});
$("phOut1").addEventListener("click", function () {
  var z = phSize();
  phZoomAt(1 / 1.6, z.W / 2, z.H / 2);
});
$("phFit").addEventListener("click", function () {
  phFit();
  drawPhoto();
});
window.addEventListener("resize", function () {
  if (PH.img && !$("vPhoto").hidden) {
    phClamp();
    drawPhoto();
  }
});
$("phUndo").addEventListener("click", function () {
  PH.pts.pop();
  paintPhoto();
});
$("phReset").addEventListener("click", function () {
  PH.pts = [];
  paintPhoto();
});
$("phUse").addEventListener("click", function () {
  var g = groupStats();
  if (!g) return;
  var f = { mm: 1, in: 25.4, cm: 10 }[PH.u];
  L.missU = PH.u;
  L.vDir = g.dy >= 0 ? "low" : "high";
  L.hDir = g.dx >= 0 ? "right" : "left";
  L.missV = round(Math.abs(g.dy) / f, PH.u === "mm" ? 0 : 2);
  L.missH = round(Math.abs(g.dx) / f, PH.u === "mm" ? 0 : 2);
  saveL();
  openView("vIn");
  toast("Group centre set as the miss");
});
$("phLog").addEventListener("click", function () {
  var g = groupStats();
  if (!g) return;
  var f = { mm: 1, in: 25.4, cm: 10 }[PH.u],
    gu = PH.u === "in" ? "in" : "mm";
  var size = gu === "in" ? round(g.es / 25.4, 2) : round(g.es, 0);
  openLog(null, { shots: String(g.n), group: size, groupU: gu, hit: "Group centre " + $("phC").textContent.trim() });
});
