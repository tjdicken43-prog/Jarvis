/* ---------- Vault 479 overlay: the full-screen factory, its bar, the move titles, the feed and the Mii cards ----------
   openVault({ rows }) opens it; rows() returns the agency's latest events (or [] while the agency is paused: demo loop). */
import { createVault } from "./vault.js";

const CSS = `
.vault{position:fixed;inset:0;z-index:60;background:#0b0e11;color:#ece7dc;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;touch-action:none}
.vault-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.vault-bar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:12px;padding:12px 16px;pointer-events:none;text-shadow:0 1px 8px #000}
.vault-bar>*{pointer-events:auto}
.vault-bar h2{margin:0;font-size:17px;font-weight:600;white-space:nowrap}
.vault-bar .st{min-width:0;font-size:13px;color:#a9a294;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vault-bar .st i{width:8px;height:8px;border-radius:50%;background:#e0b21c;flex:none}
.vault-bar .st i.live{background:#5fd38a}
.vault-bar .sp{flex:1}
.vault-btn{width:44px;height:44px;border-radius:6px;border:1px solid #ffffff1f;background:#14181bcc;color:#ece7dc;display:grid;place-items:center;cursor:pointer}
.vault-btn[aria-pressed=true]{border-color:#ffb54799;color:#ffb547}
.vault-btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.vault-move{position:absolute;left:50%;top:18%;transform:translate(-50%,0);text-align:center;pointer-events:none;opacity:0;transition:opacity .25s ease-out,transform .25s ease-out}
.vault-move.on{opacity:1;transform:translate(-50%,-6px)}
.vault-move b{display:block;font-size:clamp(28px,5vw,52px);font-weight:600;line-height:1.05;color:#fff;text-shadow:0 2px 18px #000c}
.vault-move span{display:block;margin-top:6px;font-size:15px;color:#e8dcc0;text-shadow:0 1px 8px #000}
.vault-feed{position:absolute;left:16px;bottom:16px;width:min(380px,calc(100% - 32px));display:flex;flex-direction:column;gap:4px;pointer-events:none}
.vault-feed div{font-size:13px;color:#cfc8b8;background:#101416d9;border:1px solid #ffffff14;border-radius:6px;padding:6px 10px;transition:opacity .4s}
.vault-feed div b{font-weight:600;color:#ece7dc}
.vault-cast{position:absolute;right:16px;bottom:16px;display:grid;grid-template-columns:repeat(6,44px);gap:6px}
.vault-cast button{width:44px;height:44px;border-radius:6px;border:1px solid #ffffff1f;background:#14181bcc;padding:0;cursor:pointer;overflow:hidden}
.vault-cast button img{width:100%;height:100%;object-fit:cover;display:block}
.vault-tag{position:absolute;left:0;top:0;font-size:12.5px;font-weight:500;color:#fff;background:#0d1012d9;border:1px solid #ffb54766;border-radius:6px;padding:3px 8px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}
.vault-tag.on{opacity:1}
.mii{position:absolute;right:16px;top:72px;width:min(340px,calc(100% - 32px));background:#f6f1e6;color:#2a2620;border-radius:12px;box-shadow:0 18px 50px #000a;overflow:hidden;transform:translateY(8px);opacity:0;pointer-events:none;transition:opacity .2s ease-out,transform .2s ease-out}
.mii.on{opacity:1;transform:none;pointer-events:auto}
.mii-top{display:flex;gap:14px;align-items:center;padding:16px 16px 12px;background:#e9e1cf}
.mii-pic{width:84px;height:84px;border-radius:50%;background:#dfe7ec;border:3px solid #fff;flex:none;overflow:hidden}
.mii-pic img{width:100%;height:100%;object-fit:cover}
.mii-top h3{margin:0;font-size:20px;font-weight:600}
.mii-top .job{font-size:14px;color:#6b6152}
.mii-top .look{font-size:12.5px;color:#8a806f;margin-top:2px}
.mii-x{position:absolute;right:8px;top:8px;width:44px;height:44px;border:0;background:none;color:#6b6152;font-size:22px;cursor:pointer;border-radius:6px}
.mii-body{padding:12px 16px 16px;display:grid;gap:10px}
.mii-body p{margin:0;font-size:14.5px}
.mii-row{display:grid;grid-template-columns:96px 1fr;gap:8px;font-size:13.5px}
.mii-row span:first-child{color:#8a806f}
.mii-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px}
.mii-stats div{background:#ece5d6;border-radius:8px;padding:8px 10px;font-size:12.5px;color:#6b6152}
.mii-stats b{display:block;font-size:17px;color:#2a2620;font-weight:600;font-variant-numeric:tabular-nums}
@media (max-width:760px){
  .vault-cast{left:16px;right:16px;bottom:16px;grid-template-columns:repeat(11,1fr);gap:4px}
  .vault-cast button{width:auto;height:auto;aspect-ratio:1}
  .vault-feed{bottom:76px}
  .vault-feed div:nth-child(n+3){display:none}
  .mii{left:16px;right:16px;width:auto;top:auto;bottom:16px}
  .vault-move{top:14%}
}
@media (prefers-reduced-motion:reduce){.vault-move,.mii,.vault-tag{transition:none}}
`;
const ICON = {
  cam: '<svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8H4z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function openVault(o = {}) {
  if (!document.getElementById("vault-css")) { const s = document.createElement("style"); s.id = "vault-css"; s.textContent = CSS; document.head.append(s); }
  const el = document.createElement("div"); el.className = "vault"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Vault 479 factory");
  el.innerHTML = `<div class="vault-bar"><h2>Vault 479</h2><div class="st"><i></i><span>Demo loop · agency paused</span></div><div class="sp"></div>
    <button class="vault-btn" data-a="dir" aria-pressed="true" title="Director camera">${ICON.cam}</button>
    <button class="vault-btn" data-a="home" title="Whole floor">${ICON.home}</button>
    <button class="vault-btn" data-a="x" title="Close">${ICON.x}</button></div>
    <div class="vault-move"><b></b><span></span></div><div class="vault-feed"></div><div class="vault-cast"></div>
    <div class="mii" aria-live="polite"><button class="mii-x" aria-label="Close card">×</button><div class="mii-top"><div class="mii-pic"><img alt=""></div><div><h3></h3><div class="job"></div><div class="look"></div></div></div>
    <div class="mii-body"><p class="who"></p><div class="mii-row"><span>The job</span><span class="duty"></span></div><div class="mii-row"><span>Signature move</span><span class="mv"></span></div>
    <div class="mii-row"><span>Likes</span><span class="likes"></span></div><div class="mii-row"><span>Can't stand</span><span class="hates"></span></div>
    <div class="mii-stats"><div><b class="ct">0</b>this visit</div><div><b class="lt">Waiting</b>last thing done</div></div></div></div>`;
  (o.host || document.body).append(el);
  const $ = (s) => el.querySelector(s);
  let moveT = 0, open = null;
  const v = createVault(el, {
    phone: o.phone,
    onMove(t, sub) { $(".vault-move b").textContent = t; $(".vault-move span").textContent = sub || ""; $(".vault-move").classList.add("on"); clearTimeout(moveT); moveT = setTimeout(() => $(".vault-move").classList.remove("on"), 2600); },
    onEvent(id, line) { const c = v.CAST.find((x) => x.id === id); const d = document.createElement("div"); d.innerHTML = `<b>${c.name}</b> · ${line}`; $(".vault-feed").append(d); const all = $(".vault-feed").children; while (all.length > 4) all[0].remove(); if (open === id) card(v.profile(id)); },
    onPick: (p) => card(p),
  });
  const card = (p, pic = true) => {
    open = p.id; const m = $(".mii");
    $(".mii h3").textContent = p.name; $(".mii .job").textContent = p.job; $(".mii .look").textContent = `Look inspired by ${p.look}`;
    $(".mii .who").textContent = p.who; $(".mii .duty").textContent = p.duty; $(".mii .mv").textContent = p.move; $(".mii .likes").textContent = p.likes; $(".mii .hates").textContent = p.hates;
    $(".mii .ct").textContent = p.count; $(".mii .lt").textContent = p.lastLine || "Waiting";
    if (pic) { const img = $(".mii-pic img"); img.src = portraits[p.id] ||= p.portrait(); }
    m.classList.add("on");
  };
  const portraits = {};
  v.CAST.forEach((c) => { const b = document.createElement("button"); b.title = `${c.name} · ${c.job}`; b.innerHTML = `<img alt="${c.name}">`; b.onclick = () => { v.focus(c.id); card(v.profile(c.id)); }; $(".vault-cast").append(b);
    setTimeout(() => (b.querySelector("img").src = portraits[c.id] ||= v.portrait(c.id)), 400 + v.CAST.indexOf(c) * 160); }); // one portrait at a time: each is a GPU read, so they never stall the first frames
  $(".mii-x").onclick = () => { $(".mii").classList.remove("on"); open = null; v.home(); };
  el.querySelector('[data-a="dir"]').onclick = (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", on); v.setDirector(on); };
  el.querySelector('[data-a="home"]').onclick = () => { $(".mii").classList.remove("on"); open = null; v.home(); };
  el.querySelector('[data-a="x"]').onclick = () => close();
  const onKey = (e) => e.key === "Escape" && close();
  addEventListener("keydown", onKey);
  // live rows: poll the host's reader once a minute while open (the Render read is the host's, not Claude's)
  let pollT = 0;
  const poll = async () => { try { const rows = (await o.rows?.()) || []; v.feed(rows); const live = v.mode === "live"; $(".st i").classList.toggle("live", live); $(".st span").textContent = live ? "Live · the agency's real event log" : "Demo loop · agency paused"; } catch {} pollT = setTimeout(poll, 60000); };
  poll();
  const close = () => { clearTimeout(pollT); removeEventListener("keydown", onKey); v.dispose(); el.remove(); o.onClose?.(); };
  return { el, vault: v, close, card };
}
window.JarvisVault = { open: (o) => (window.JarvisVault.current = openVault(o)) };
