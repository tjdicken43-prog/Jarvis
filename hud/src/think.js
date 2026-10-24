/* ---------- Thinking ---------- */
const history = [];
let sdk = null;
function systemPrompt() {
  const rules = byName.get("CLAUDE")?.text || "";
  const notes = BRAIN.notes.filter((n) => n.name !== "CLAUDE").map((n) => `<note name="${n.name}">\n${n.text}\n</note>`).join("\n");
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "full", timeStyle: "short" });
  return `You are Jarvis, TJ's personal assistant, speaking out loud through a voice interface. Work exactly the way Jarvis does in TJ's Claude project:
- Calm, dry wit, quietly confident, loyal, like Tony Stark's Jarvis. Call him "boss" now and then, not every line.
- Answer first, reason after. No lectures or disclaimers he didn't ask for.
- Give real numbers (prices, repair costs, odds, grams, sets and reps) and say how sure you are instead of refusing to guess.
- If something could hurt him (brakes, money traps, legal trouble, gluten), say it plainly once, then still help.
- When TJ brings an idea, run it through four voices: Believer (how it could work), Critic (why it might fail), Investor (does it make money), then Judge (decides, with a short "do next" list: first step today, then this week). Check it against Decisions, Ground rules and Pricing first. One or two sentences per voice.
- Training and food plans are detailed and science-based, and always gluten-free (TJ is celiac).
- Friendly, not personal: don't pry into his private life.
- Never say passwords, keys, gym codes or member info.
It is now ${now} where TJ is (US Central).
How to reply (always): the first line is "SAY: " plus one short spoken line in the manner of Jarvis in the Iron Man films, at most 18 words: the answer itself, or what you're about to do ("Running the numbers now, boss. Short version: about $40 a month."). Only that line is read out loud. Put any detail on the following lines for the screen: plain text, no markdown, no links. For a simple question the SAY line can be the whole reply. Ideas get the four voices in the detail, with the Judge's call in the SAY line.
You can't write code, push to GitHub, edit the notes, browse the web or touch his files from here, but Claude Code can. When TJ asks for something like that, say in one sentence that you're sending it to Claude Code, then end with one line: "JOB: " followed by a clear, self-contained instruction for Claude Code. The page queues it and the answer comes back here.
When TJ asks to be reminded of something at a time, say when in one sentence, then end with one line: "REMIND: YYYY-MM-DDTHH:MM | what to remind him" in his Central time (24-hour clock; "in 2 hours" means from now; no date given means the next time that clock time comes round). The page puts it on his Google Calendar with a pop-up at that minute. One REMIND line per reminder.
${todayCal ? "TJ's Google Calendar today: " + (todayCal.length ? todayCal.join("; ") : "nothing booked") + "\n" : ""}Whenever TJ tells you something new worth keeping (a fact, a preference, a decision, a to-do), end with one line starting "For the brain:" saying it in a few words. That line is saved and you will remember it next time.
${memoryText()}
Your rules:
${rules}

TJ's brain notes:
${notes}`;
}
async function viaAccount(sample, q) {
  const said = history.slice(-12).map((m) => (m.role === "user" ? "TJ: " : "Jarvis: ") + m.content).join("\n");
  const el = say("jarvis", "");
  const res = await sample(systemPrompt() + (said ? "\n\nConversation so far:\n" + said : "") + "\n\nTJ says: " + q, {
    cache: false,
    onText: ({ text }) => { renderReply(el, text); },
  });
  const text = (res.text || "").trim();
  renderReply(el, text);
  history.push({ role: "user", content: q }, { role: "assistant", content: text });
  return text;
}
async function viaKey(q) {
  if (!sdk) sdk = (await import("https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.134.0/+esm")).default;
  const client = new sdk({ apiKey: store.get("key"), dangerouslyAllowBrowser: true });
  history.push({ role: "user", content: q });
  const el = say("jarvis", "");
  const stream = client.beta.messages.stream({
    model: store.get("model", "claude-opus-5-5"),
    max_tokens: 2000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: history.slice(-20),
  });
  stream.on("text", (d) => { el.textContent += d; el.scrollIntoView({ block: "end" }); });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") el.textContent = "I can't help with that one, boss.";
  const text = el.textContent.trim();
  renderReply(el, text);
  history.push({ role: "assistant", content: text || "(no answer)" });
  return text;
}

async function ask(q) {
  if (dictArmed) disarmDictation();
  q = q.trim(); if (!q) return;
  document.querySelector(".chips")?.remove();
  $("q").value = "";
  say("you", q);
  showTab("comms");
  if ($("jobMode").getAttribute("aria-pressed") === "true") {
    $("jobMode").click();
    if (await queueJob(q)) speak("On it, boss. Sent to Claude Code.");
    aboutNote = null;
    return;
  }
  light(search(q, 3).map((n) => n.name));
  setMode("thinking");
  let text;
  try {
    const sample = await samplePromise;
    if (sample) text = await viaAccount(sample, q);
    else if (store.get("key")) text = await viaKey(q);
    else { text = offlineAnswer(q); say("jarvis", text); }
  } catch (err) {
    if (history.at(-1)?.role === "user") history.pop();
    say("note", "Couldn't reach Claude (" + (err?.message || err?.code || err) + "). Answering from the notes.");
    text = offlineAnswer(q); say("jarvis", text);
  }
  remember(q, text);
  const job = (text.match(/^JOB:\s*(.+)$/im) || [])[1];
  if (job) queueJob(job.trim());
  for (const m of text.matchAll(REMIND_RE)) setReminder(m[1], m[2].trim());
  blip("done");
  speak(splitReply(text.split("\n\nAlso see")[0]).line);
}
$("ask").addEventListener("submit", (e) => { e.preventDefault(); ask($("q").value); });

/* ---------- Settings ---------- */
$("gear").addEventListener("click", async () => {
  $("key").value = store.get("key", "");
  $("model").value = store.get("model", "claude-opus-5-5");
  $("talkback").checked = store.get("talkback", "1") === "1";
  $("theme").value = store.get("theme", "arc");
  $("keyBox").hidden = !!(await samplePromise);
  $("setup").showModal();
});
$("done").addEventListener("click", () => {
  store.set("key", $("key").value.trim() || null);
  store.set("model", $("model").value);
  store.set("voice", $("voice").value);
  store.set("talkback", $("talkback").checked ? "1" : "0");
  $("setup").close();
});
const TEST_LINE = { butler: "At your service, boss. All systems online.", agent: "Agent online. Nothing to see here, boss.",
  spy: "Good evening, boss. Shall we get to work?", hunter: "Alright, boss. Let's go save some people.", robot: "Systems online. Awaiting orders, boss." };
$("testVoice").addEventListener("click", () => { store.set("voice", $("voice").value); speak(TEST_LINE[$("voice").value.replace("builtin:", "")] || TEST_LINE.butler); });
$("voice").addEventListener("change", () => $("testVoice").click());
$("theme").addEventListener("change", () => {
  setTheme($("theme").value); focus = null; tour.cap = null; tour.i = -1;
  if (SHOW()) { loadShowStats(); lastInput = t - 11; speak("Show mode. Sit back, boss. I'll fly you through the brain."); }
});
if (SHOW()) loadShowStats();
$("demoBtn").addEventListener("click", () => {
  $("setup").close();
  if (!SHOW()) { $("theme").value = "showoff"; setTheme("showoff"); loadShowStats(); }
  demo = true; demoSaid = new Set(); flight.on = false; lastInput = -99;
});
/* ---------- Night mode: a dark screen, a light to breathe with, and sound to sleep to ---------- */
// The sounds are made on the phone from noise (Web Audio), so there's nothing to download and nothing to pay for.
let nightCtx = null, nightNodes = null, nightSnd = "rain", nightMin = 60;
function noiseBuffer(ctx, brown) {
  const n = ctx.sampleRate * 6, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5; }
  return b;
}
function nightStop(sec = 0.4) {
  if (!nightNodes) return;
  const { src, gain, lfo } = nightNodes, now = nightCtx.currentTime;
  gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now); gain.gain.linearRampToValueAtTime(0, now + sec);
  setTimeout(() => { try { src.stop(); lfo?.stop(); } catch {} }, sec * 1000 + 100);
  nightNodes = null;
}
function nightPlay() {
  nightStop();
  document.querySelectorAll("#night [data-snd]").forEach((b) => b.classList.toggle("on", b.dataset.snd === nightSnd));
  document.querySelectorAll("#night [data-min]").forEach((b) => b.classList.toggle("on", +b.dataset.min === nightMin));
  if (nightSnd === "off") return;
  nightCtx ??= new (window.AudioContext || window.webkitAudioContext)(); nightCtx.resume();
  const ctx = nightCtx, now = ctx.currentTime, src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = noiseBuffer(ctx, nightSnd !== "rain"); src.loop = true;
  let out = src, lfo = null;
  if (nightSnd === "rain") { const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.35; src.connect(f); out = f; }
  if (nightSnd === "waves") { // brown noise swelling and falling like surf, about every 11 seconds
    const wg = ctx.createGain(), lg = ctx.createGain(); lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09; lg.gain.value = 0.42; wg.gain.value = 0.5; lfo.connect(lg).connect(wg.gain); src.connect(wg); out = wg; lfo.start();
  }
  const vol = nightSnd === "rain" ? 0.28 : 0.55;
  out.connect(gain).connect(ctx.destination);
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(vol, now + 5);
  if (nightMin) { const end = now + nightMin * 60; gain.gain.setValueAtTime(vol, end - 180); gain.gain.linearRampToValueAtTime(0, end); } // fades out over the last 3 minutes
  src.start(); nightNodes = { src, gain, lfo };
}
$("nightBtn").addEventListener("click", () => {
  $("setup").close(); stopVoice(); setMode("idle");
  $("night").hidden = false; $("night").classList.remove("calm"); nightPlay();
  setTimeout(() => $("night").classList.add("calm"), 12000);
});
$("night").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) { $("night").classList.toggle("calm"); return; }
  if (b.dataset.snd) { nightSnd = b.dataset.snd; nightPlay(); }
  else if (b.dataset.min) { nightMin = +b.dataset.min; nightPlay(); }
  else if (b.id === "nightExit") { nightStop(1.5); $("night").hidden = true; }
});
$("forget").addEventListener("click", () => { store.set("key", null); $("key").value = ""; });

samplePromise.then((sample) => {
  const online = !!(sample || store.get("key"));
  $("linkDot").classList.toggle("on", online);
  $("linkText").textContent = sample ? "Online" : online ? "Online · API key" : "Notes only";
  say("note", online ? "Good to see you, boss. Talk, type, or tap Job to hand me something big." : "Running on the notes only. Open the claude.ai copy for the full Jarvis.");
  // quick starts, so an empty screen still has somewhere to go
  if (turns.length) return; // a resumed chat already fills the screen
  const chips = document.createElement("div"); chips.className = "chips";
  for (const q of ["Brief me", "Remind me to stretch in 2 hours", "One idea to make money this week", "What did you learn about me?"]) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = q;
    b.addEventListener("click", () => (q === "Brief me" ? briefMe() : ask(q))); chips.append(b);
  }
  $("log").append(chips);
});
