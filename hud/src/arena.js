/* ---------- Arena (round 10, 2026-10-31, hud/DESIGN.md): the real brain at home, the Training grounds behind the factory card ----------
   Both live in hud/arena as their own pages (three.js, on the device, no Claude calls) and run in frames, so a problem there
   never breaks the HUD: until the brain says it is ready the old Workshop globe stays on. */
(function arena() {
  const slot = $("slot"), status = $("status");
  const fr = document.createElement("iframe");
  fr.id = "arenaBrain"; fr.title = "Jarvis brain"; fr.tabIndex = -1; fr.setAttribute("aria-hidden", "true"); fr.src = "arena/brain.html?embed";
  $("holo").after(fr);
  // the brain sits on #slot and grows with it; it works harder while Jarvis thinks or talks
  function send() {
    if (!fr.contentWindow) return;
    const r = slot.getBoundingClientRect(), s = Math.max(.42, Math.min(1.15, (r.height / innerHeight) * (innerWidth < 600 ? 2 : 1.2), (r.width / innerWidth) * 1.9));
    fr.contentWindow.postMessage({ slot: { cx: (r.left + r.width / 2) / innerWidth, cy: (r.top + r.height / 2) / innerHeight, s }, mode: status.dataset.mode || "idle" }, "*");
  }
  new ResizeObserver(send).observe(slot); addEventListener("resize", send);
  new MutationObserver(send).observe(status, { attributes: true, attributeFilter: ["data-mode"] });

  let grounds = null;
  function openGrounds() {
    if (grounds) return;
    grounds = document.createElement("iframe"); grounds.id = "arenaGrounds"; grounds.title = "Training grounds"; grounds.src = "arena/grounds.html";
    document.body.append(grounds); window.JarvisArena.open = true; grounds.focus();
  }
  function closeGrounds() { grounds?.remove(); grounds = null; window.JarvisArena.open = false; }
  addEventListener("message", (e) => {
    const d = e.data || {};
    if (e.source === fr.contentWindow && d.arena === "brain-ready") { document.documentElement.classList.add("arena-brain"); window.JarvisBrain = { on: true }; send(); }
    if (grounds && e.source === grounds.contentWindow && d.arena === "close") closeGrounds();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && grounds) closeGrounds(); });
  window.JarvisArena = { openGrounds, closeGrounds, open: false };
})();
