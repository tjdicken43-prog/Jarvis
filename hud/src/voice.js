/* ---------- Comms log ---------- */
function say(who, text) {
  const el = document.createElement("div");
  el.className = "msg " + who; el.textContent = text;
  $("log").append(el); el.scrollIntoView({ block: "end" });
  return el;
}

// A Jarvis reply is one spoken line, then the detail on screen (like the films: he says little, the HUD shows the rest).
function splitReply(text) {
  text = text.replace(/^JOB:.*$/gim, "").trim();
  const m = text.match(/^\s*SAY:\s*(.+)$/im);
  let line = m ? m[1].trim() : (text.match(/^[^.!?\n]+[.!?]?/) || [text])[0].trim();
  let detail = m ? text.replace(m[0], "").trim() : text.slice(line.length).trim();
  return { line, detail };
}
function renderReply(el, text) {
  const { line, detail } = splitReply(text);
  el.innerHTML = "";
  const l = document.createElement("div"); l.className = "line"; l.textContent = line; el.append(l);
  if (detail) {
    const d = document.createElement("details"), sm = document.createElement("summary"), body = document.createElement("div");
    sm.textContent = "Details"; body.className = "detail"; body.textContent = detail;
    d.open = detail.length < 280; d.append(sm, body); el.append(d);
  }
  el.scrollIntoView({ block: "end" });
  return line;
}

/* ---------- UI sounds: soft synth blips, made on the fly ---------- */
var actx = null;
function blip(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { listen: [880, 1320], done: [1320, 990], job: [660, 990, 1320] }[kind] || [990];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.07;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.14);
    });
  } catch {}
}

/* ---------- Voice out ---------- */
const synth = window.speechSynthesis;
// Jarvis's own voice: a British RP speech engine bundled with the page (works even where the phone
// browser has no speech), run through a light studio chain for the calm AI-butler sound.
const PERSONAS = {
  // Each is a speech-engine setting plus its own studio chain. Styles inspired by film characters, not copies of anyone's voice.
  butler: { label: "Butler: calm British AI (Jarvis)", voice: "en/en-rp", variant: "m3", pitch: 36, speed: 156,
    fx: { hp: 95, shelf: 3, air: 2.5, lp: 7200, chorus: 0.3, room: 0.14 } },
  agent: { label: "Agent: flat, clipped HQ radio (MIB-style)", voice: "en/en-us", variant: "m1", pitch: 30, speed: 172,
    fx: { hp: 320, shelf: 0, air: 5, lp: 3600, chorus: 0, room: 0.04, grit: 4 } },
  spy: { label: "Spy: low, smooth British (Bond-style)", voice: "en/en-rp", variant: "m6", pitch: 18, speed: 142,
    fx: { hp: 70, shelf: 6, air: 1, lp: 6200, chorus: 0.15, room: 0.22 } },
  hunter: { label: "Hunter: gravelly American (Bobby-style)", voice: "en/en-us", variant: "croak", pitch: 12, speed: 138,
    fx: { hp: 80, shelf: 5, air: 0, lp: 5200, chorus: 0, room: 0.1, grit: 14 } },
  robot: { label: "Robot: full machine", voice: "en/en-rp", variant: "klatt", pitch: 46, speed: 162,
    fx: { hp: 120, shelf: 0, air: 4, lp: 8000, chorus: 0.5, room: 0.12, ring: 52 } },
};
const OLD_VOICE = { "builtin:m3": "builtin:butler", "builtin:klatt3": "builtin:butler" };
const BUILTIN = Object.entries(PERSONAS).map(([k, p]) => ["builtin:" + k, p.label]);
let engine = null, master = null, analyser = null, playing = null;
const chains = {};
function loadEngine() {
  return engine || (engine = new Promise((ok, fail) => {
    const sc = document.createElement("script");
    sc.src = "vendor/jarvis-voice.js"; sc.onload = () => ok(window.meSpeak); sc.onerror = fail;
    document.head.append(sc);
  }));
}
function audio() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}
addEventListener("pointerdown", () => { try { audio(); } catch {} }, { passive: true });
setTimeout(() => loadEngine().catch(() => {}), 1200);
function buildChain(a, fx) {
  if (!master) {
    master = a.createDynamicsCompressor(); master.threshold.value = -20; master.ratio.value = 3;
    analyser = a.createAnalyser(); analyser.fftSize = 512;
    master.connect(analyser).connect(a.destination);
  }
  const input = a.createGain();
  let head = input;
  if (fx.ring) { // ring modulation: the classic movie-robot buzz
    const rm = a.createGain(); rm.gain.value = 0;
    const osc = a.createOscillator(); osc.frequency.value = fx.ring; osc.connect(rm.gain); osc.start();
    const mix = a.createGain(); const dryR = a.createGain(); dryR.gain.value = 0.45;
    head.connect(rm).connect(mix); head.connect(dryR).connect(mix); head = mix;
  }
  if (fx.grit) { // soft clipping for rasp or a radio edge
    const ws = a.createWaveShaper(), n = 1024, curve = new Float32Array(n), k = fx.grit;
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    ws.curve = curve; const pad = a.createGain(); pad.gain.value = 1 / (1 + k * 0.12);
    head.connect(ws).connect(pad); head = pad;
  }
  const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = fx.hp;
  const warm = a.createBiquadFilter(); warm.type = "lowshelf"; warm.frequency.value = 220; warm.gain.value = fx.shelf;
  const air = a.createBiquadFilter(); air.type = "peaking"; air.frequency.value = 3200; air.Q.value = 0.9; air.gain.value = fx.air;
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = fx.lp;
  head.connect(hp).connect(warm).connect(air).connect(lp);
  const dry = a.createGain(); dry.gain.value = 0.85; lp.connect(dry).connect(master);
  if (fx.chorus) { // a slow chorus gives the faint "synthetic" shimmer
    const dl = a.createDelay(); dl.delayTime.value = 0.012;
    const lfo = a.createOscillator(), depth = a.createGain(); lfo.frequency.value = 0.3; depth.gain.value = 0.0025;
    lfo.connect(depth).connect(dl.delayTime); lfo.start();
    const wet = a.createGain(); wet.gain.value = fx.chorus; lp.connect(dl).connect(wet).connect(master);
  }
  if (fx.room) { // a short room so the voice sits somewhere
    const len = Math.floor(a.sampleRate * 0.5), ir = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const verb = a.createConvolver(); verb.buffer = ir;
    const vg = a.createGain(); vg.gain.value = fx.room; lp.connect(verb).connect(vg).connect(master);
  }
  return input;
}
async function jarvisSpeak(text, persona) {
  const p = PERSONAS[persona] || PERSONAS.butler, a = audio();
  const me = await loadEngine();
  const wav = me.speak(text, { voice: p.voice, variant: p.variant, pitch: p.pitch, speed: p.speed, wordgap: 1, rawdata: "arraybuffer" });
  if (!wav) throw new Error("no audio");
  const buf = await a.decodeAudioData(wav);
  const chain = chains[persona] || (chains[persona] = buildChain(a, p.fx));
  stopVoice();
  const src = a.createBufferSource(); src.buffer = buf; src.connect(chain);
  src.onended = () => { if (playing === src) { playing = null; setMode("idle"); } };
  playing = src; setMode("speaking"); src.start();
}
function stopVoice() {
  if (synth) synth.cancel();
  if (playing) { try { playing.stop(); } catch {} playing = null; }
}
function voiceLevel() {
  if (!analyser || !playing) return null;
  const d = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(d);
  let sum = 0; for (const v of d) sum += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / d.length) * 4);
}
const voices = () => (synth ? synth.getVoices() : []);
function fillVoices() {
  const sel = $("voice"), list = voices().filter((v) => /^en/i.test(v.lang)), saved = store.get("voice", "");
  // A calm British butler voice. Ranked best first across Android (Google TTS), iPhone and desktop.
  const rank = [/en-gb-x-rjs/i, /en-gb-x-gbd/i, /en-gb-x-gbb/i, /UK English Male/i, /\b(Daniel|Arthur|George|Oliver|Ryan|Thomas)\b/i, /Male/i];
  const gb = list.filter((v) => /GB/i.test(v.lang));
  let best = null;
  for (const re of rank) { best = gb.find((v) => re.test(v.name)); if (best) break; }
  const pick = OLD_VOICE[saved] || saved || "builtin:butler";
  sel.innerHTML = "";
  for (const [val, label] of BUILTIN) {
    const o = document.createElement("option"); o.value = val; o.textContent = label; o.selected = val === pick; sel.append(o);
  }
  if (best) list.sort((a, b) => (b === best) - (a === best));
  for (const v of list) {
    const o = document.createElement("option");
    o.value = v.name; o.textContent = `${v.name} (${v.lang})`; o.selected = v.name === pick; sel.append(o);
  }
}
fillVoices();
if (synth) synth.onvoiceschanged = fillVoices;
function speak(text, force) {
  text = text.replace(/For the brain:.*$/is, "").replace(/^JOB:.*$/gim, "").replace(/^SAY:\s*/gim, "").replace(/[*_#`>\[\]]/g, "").trim();
  if (!text || (store.get("talkback", "1") !== "1" && !force)) { setMode("idle"); return; }
  const chosen = $("voice").value || "builtin:butler";
  if (chosen.startsWith("builtin:") || !synth) {
    jarvisSpeak(text, chosen.startsWith("builtin:") ? chosen.slice(8) : "butler").catch(() => setMode("idle"));
    return;
  }
  stopVoice();
  const u = new SpeechSynthesisUtterance(text);
  const v = voices().find((v) => v.name === $("voice").value);
  if (v) u.voice = v;
  u.lang = v ? v.lang : "en-GB";
  u.rate = 0.98; u.pitch = 0.88;
  u.onstart = () => setMode("speaking");
  u.onend = u.onerror = () => setMode("idle");
  synth.speak(u);
}

/* ---------- Voice in ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
const framed = (() => { try { return window.top !== window; } catch { return true; } })();
if (SR && !framed) { // a framed page (claude.ai) is never granted the mic, so skip straight to dictation
  rec = new SR();
  rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    $("q").value = r[0].transcript;
    if (r.isFinal) { rec.stop(); ask($("q").value); }
  };
  rec.onend = () => { if (mode === "listening") setMode("idle"); };
  rec.onerror = (e) => {
    setMode("idle");
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { rec = null; armDictation(); }
    else if (e.error !== "no-speech" && e.error !== "aborted") say("note", "Mic trouble: " + e.error);
  };
}
// Inside claude.ai the page runs in a locked frame that is never given the microphone, and Android's in-app
// browser has no speech recognition at all. The phone keyboard's own mic still works in any text box, so the
// mic button arms "dictation": it opens the keyboard, and once the dictated words stop arriving Jarvis sends them.
let dictArmed = false, dictTimer = 0, dictTipShown = false;
function armDictation() {
  if (dictArmed) { disarmDictation(); return; }
  dictArmed = true;
  stopVoice();
  $("q").value = ""; setMode("listening"); blip("listen");
  $("q").placeholder = "Tap the mic on your keyboard and talk";
  $("q").focus();
  if (!dictTipShown) { dictTipShown = true; say("note", "Tap the mic key on your keyboard and talk. I send it when you stop."); }
}
function disarmDictation() {
  dictArmed = false; clearTimeout(dictTimer);
  $("q").placeholder = "Talk to Jarvis";
  if (mode === "listening") setMode("idle");
}
$("q").addEventListener("input", () => {
  if (!dictArmed) return;
  clearTimeout(dictTimer);
  if ($("q").value.trim()) dictTimer = setTimeout(() => {
    const text = $("q").value;
    disarmDictation();
    $("q").blur();
    ask(text);
  }, 1800);
});
$("q").addEventListener("blur", () => { if (dictArmed && !$("q").value.trim()) disarmDictation(); });

function listen() {
  if (!rec) { armDictation(); return; }
  if (mode === "listening") { rec.stop(); return; }
  stopVoice();
  $("q").value = ""; setMode("listening"); blip("listen");
  try { rec.start(); } catch {}
}
$("mic").addEventListener("click", listen);
addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement === document.body) { e.preventDefault(); listen(); }
  if (e.key === "Escape") { stopVoice(); $("card").classList.remove("show"); }
});

