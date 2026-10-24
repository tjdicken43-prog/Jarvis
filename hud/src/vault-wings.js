/* ---------- Vault 479 wings: who works in each business's wing (round 9, hud/DESIGN.md) ----------
   TJ, 2026-10-24: the agency keeps its Jujutsu Kaisen crew, Basis gets Naruto, Gym-security gets Death Note, the Etsy shop
   gets Dragon Ball Z. Each fighter is inspired by a character (look, palette, move), not a copy. Each room is dressed as
   where that character fought, and the dummy wears the costume of an opponent they beat. Where a character never won a fight
   on screen, the dummy is the closest fair pick and its card says so. Full list: /mnt/project-files/jarvis-hud/vault-redesign/ROSTER.md */
import { VK } from "./vault-kit.js";

export const WINGS = (() => {
  const { rig, spikes, mesh, mat, box, cyl, cone, ball, grp, glow, THREE } = VK;
  const band = (R, col = "#1d2440", y = 0.09) => { mesh(box(0.38, 0.07, 0.03), mat(col), R.head, 0, y, 0.155, false); mesh(box(0.14, 0.05, 0.02), mat("#9aa5ad", { m: 0.8, r: 0.3 }), R.head, 0, y, 0.17, false); };

  /* ---------- the agency's Jujutsu wing: rooms and dummies (its fighters and moves live in vault.js) ---------- */
  const agency = {
    rooms: {
      toji: { bd: "corridor", place: "Star Vessel corridor, Jujutsu High" }, yuji: { bd: "river", place: "Riverbank by Yasohachi Bridge" },
      hanami: { bd: "forest", place: "Goodwill Event forest" }, yuta: { bd: "temple", place: "Jujutsu High, Night Parade" },
      mahoraga: { bd: "shibuya", place: "Shibuya, Dogenzaka" }, throne: { place: "Your desk" },
      jogo: { bd: "shibuya", place: "Shibuya platform" }, sukuna: { bd: "shibuya", place: "Shibuya rooftops" }, nanami: { bd: "sewer", place: "Underground sewer" },
      hakari: { bd: "sea", place: "Tokyo No. 2 Colony seafront" }, gojo: { bd: "shibuya", place: "Shibuya Station B5F" }, todo: { bd: "shibuya", place: "Shibuya Station" },
    },
    floors: { toji: "#4a3a2c", yuji: "#3a3b2e", hanami: "#3e4a32", yuta: "#3a3530", mahoraga: "#2a2830", jogo: "#3a2a26", sukuna: "#3a2226", nanami: "#33352e", hakari: "#9a8a6a", gojo: "#26283a", todo: "#2e2a34" },
    dummies: {
      toji: { look: "gojoteen", name: "Teen Gojo", full: "Satoru Gojo as a student", who: "The one time anyone beat the strongest: Toji, the Star Vessel job, long before Gojo got serious.", breaks: "Pinned by the spear and flipped flat on its back" },
      yuji: { look: "eso", name: "Eso", full: "Eso of the Death Painting brothers", who: "Fought Yuji and Nobara by the river near Yasohachi Bridge, and lost.", breaks: "Black Flash blows it back in pieces" },
      hanami: { look: "corpse", name: "Cursed corpse", full: "one of Yaga's training corpses", who: "Hanami never won a fight on screen, so its dummy is a stitched-up training doll from the Goodwill Event grounds.", breaks: "Wrapped in roots and dragged under the floor", honest: true },
      yuta: { look: "geto", name: "Geto", full: "Suguru Geto", who: "Brought a hundred demons to Jujutsu High and met Yuta and Rika in the courtyard.", breaks: "Rika lands on it from above" },
      mahoraga: { look: "zenin", name: "Old Zenin summoner", full: "a Zenin clan sorcerer of old", who: "Mahoraga never won on its own in the story; the old tale is that it beat every Zenin who tried to tame it.", breaks: "The wheel turns, then one clean chop", honest: true },
      todo: { look: "mahito", name: "Mahito", full: "Mahito", who: "Beaten at Shibuya Station by Yuji with Todo clapping the swaps.", breaks: "Swapped into the air and dropped flat" },
      gojo: { look: "hanami", name: "Hanami", full: "Hanami", who: "Gojo finished it on the Shibuya platform in seconds.", breaks: "Frozen in the void, then gone to dust" },
      hakari: { look: "kashimo", name: "Kashimo", full: "Hajime Kashimo", who: "Lost to Hakari in the sea off Tokyo No. 2 Colony after an underwater brawl.", breaks: "Jackpot: it spins up and bursts into coins" },
      nanami: { look: "transfig", name: "Transfigured human", full: "one of Mahito's patchwork victims", who: "Nanami had no clean win against a named villain; he cut through Mahito's transfigured humans in the tunnels.", breaks: "Split at the 7:3 point", honest: true },
      sukuna: { look: "jogo", name: "Jogo", full: "Jogo", who: "Burned out against Sukuna over Shibuya and was told he was strong. Then he was gone.", breaks: "Diced into cubes by the Shrine" },
      jogo: { look: "naobito", name: "Naobito", full: "Naobito Zenin", who: "Caught in Jogo's blast on the Shibuya platform with Nanami and Maki.", breaks: "Burnt to ash where it stood" },
    },
  };

  /* ---------- Basis: the Leaf wing (Naruto). A member's day passes room to room ---------- */
  const basis = {
    id: "basis", name: "Basis", wing: "Leaf wing", accent: "#e07a2a", live: "Basis isn't sending events yet",
    chain: ["shikamaru", "lee", "minato", "choji", "sakura", "kakashi", "guy"], solo: ["neji", "naruto"],
    cast: [
      { id: "shikamaru", name: "Shikamaru", job: "Routines and habits", move: "Shadow bind", look: "Shikamaru Nara", kind: "shadow", color: "#1a1a22",
        who: "Says everything is a drag, then plans your whole day three moves ahead. Your morning routine starts in his room.", duty: "Builds the day plan, sets the habit timers and nudges you when one is due.", likes: "A plan with no wasted steps", hates: "Alarms with no reason",
        room: { bd: "forest", variant: 1, place: "Nara clan forest" }, dummy: { look: "hidan", name: "Hidan", full: "Hidan", who: "Shikamaru trapped him, blew him up and buried him in the Nara forest.", breaks: "Pinned by the shadow, then it sinks into a pit" } },
      { id: "lee", name: "Rock Lee", job: "Lifts and programs", move: "Leaf Hurricane", look: "Rock Lee", kind: "dash", color: "#7cff9c", kick: true,
        who: "No tricks, only training. Logs every set and won't let you skip leg day.", duty: "Runs the lift log: sets, reps, loadable weights, the short-on-time plan.", likes: "One more rep", hates: "Skipped warm-ups",
        room: { bd: "exam", place: "Chunin Exam hall" }, dummy: { look: "sasuke", name: "Sasuke", full: "Sasuke Uchiha", who: "Lee floored him in their sparring match before the Chunin Exams.", breaks: "Kicked into the air, then down hard" } },
      { id: "minato", name: "Minato", job: "Runs and rides", move: "Flying thunder flash", look: "Minato Namikaze", kind: "blink", color: "#ffe66a",
        who: "The fastest in the village. Times every run and ride to the second and maps the route.", duty: "Tracks runs, rides, routes and active minutes.", likes: "Negative splits", hates: "GPS drift",
        room: { bd: "village", place: "The Leaf, Nine-Tails night" }, dummy: { look: "masked", name: "Masked man", full: "the masked man of the Nine-Tails night", who: "Minato drove him off the night the Nine-Tails got loose.", breaks: "Hit from behind before it turns round" } },
      { id: "choji", name: "Choji", job: "Food and nutrition", move: "Expansion slam", look: "Choji Akimichi", kind: "smash", color: "#ffb04a", big: true,
        who: "Knows food better than anyone and never skips a meal. Logs yours, counts protein per meal and keeps it gluten-free where you ask.", duty: "Food search, label scan, water, protein per meal and the grocery list.", likes: "A good meal on time", hates: "Being called anything but big-boned",
        room: { bd: "forest", place: "Forest outside the Leaf" }, dummy: { look: "jirobo", name: "Jirobo", full: "Jirobo", who: "Choji beat him in the forest on the way to bring Sasuke back.", breaks: "Flattened by a giant fist" } },
      { id: "sakura", name: "Sakura", job: "Sleep and recovery", move: "Cherry blossom impact", look: "Sakura Haruno", kind: "smash", color: "#ff7ab8",
        who: "Medic first, puncher second. Reads your sleep and soreness and tells you when to rest.", duty: "Sleep, recovery scores, the morning check-in and rest days.", likes: "Eight hours", hates: "Training through an injury",
        room: { bd: "cave", place: "Akatsuki cave" }, dummy: { look: "sasori", name: "Sasori", full: "Sasori of the Red Sand", who: "Sakura and Lady Chiyo beat him in the Akatsuki cave.", breaks: "One punch and the ground cracks under it" } },
      { id: "kakashi", name: "Kakashi", job: "Progress and records", move: "Lightning blade", look: "Kakashi Hatake", kind: "dash", color: "#9fd0ff", chidori: true, impact: true,
        who: "Reads everything twice and never forgets a number. Spots your new record before you do.", duty: "Records, the e1RM rule, On this day, progress photos and charts.", likes: "A clean PR", hates: "Missing data",
        room: { bd: "bridge", place: "Great Naruto Bridge, Land of Waves" }, dummy: { look: "zabuza", name: "Zabuza", full: "Zabuza Momochi", who: "The Demon of the Hidden Mist, beaten by Kakashi on the bridge in the Land of Waves.", breaks: "Lightning blade punches through; the cleaver clangs to the boards" } },
      { id: "guy", name: "Guy", job: "Coach (Ask Basis)", move: "Dynamic entry", look: "Might Guy", kind: "dash", color: "#7cff9c", kick: true, impact: true,
        who: "Loud, kind, relentless. Answers your questions and turns them into a plan you'll actually do.", duty: "Ask Basis: answers, confirms actions, can undo them. Plain advice only, no PED talk.", likes: "Youthful effort", hates: "Giving up",
        room: { bd: "sea", place: "Shoreline" }, dummy: { look: "kisame", name: "Kisame", full: "Kisame Hoshigaki", who: "Guy beat him on the shore with the Morning Peacock.", breaks: "Kicked clean off its feet into the surf" } },
      { id: "neji", name: "Neji", job: "Safety rules", move: "Sixty-four palms", look: "Neji Hyuga", kind: "palms", color: "#e8e8ff",
        who: "Sees everything. Checks every answer and post against Basis's lines: no PED doses or sourcing, nothing adult for under-18s.", duty: "Rule checks on coach answers, posts and replies; flags anything over the line.", likes: "Clear rules", hates: "Loopholes",
        room: { bd: "forest", variant: 1, place: "Forest pass" }, dummy: { look: "kidomaru", name: "Kidomaru", full: "Kidomaru", who: "Neji beat him in the forest pass, blind spot and all.", breaks: "Sixty-four taps and it folds" } },
      { id: "naruto", name: "Naruto", job: "Friends, crews and invites", move: "Rasengan", look: "Naruto Uzumaki", kind: "orb", color: "#6ab8ff", impact: true,
        who: "Makes a friend out of everyone, eventually. Runs invites, crews, head-to-heads and the gym boards.", duty: "Social: profiles, replies, invites and QR, partners, gym boards.", likes: "New friends", hates: "Being left out",
        room: { bd: "crater", place: "Crater of the Leaf" }, dummy: { look: "pain", name: "Pain", full: "Pain", who: "Naruto beat him in the crater where the village used to stand.", breaks: "Spun into the air by the orb" } },
    ],
    build: {
      shikamaru: () => { const R = rig({ skin: "#e8c4a2", top: "#4f6b3e", sleeve: "#1d2a3a", bottom: "#1d2a3a", shoes: "#1d2a3a" }); spikes(R.head, "#141418", 0, {}); const t = mesh(cone(0.08, 0.22, 5), mat("#141418"), R.head, 0, 0.2, -0.08, false); t.rotation.x = -0.4; band(R, "#1d2a3a"); for (const sx of [-1, 1]) mesh(box(0.13, 0.14, 0.05), mat("#46603a"), R.torso, sx * 0.13, 0.42, 0.15); return R; },
      lee: () => { const R = rig({ skin: "#efc6a0", top: "#2e7a3a", bottom: "#2e7a3a", shin: "#e88a2a", shoes: "#2e7a3a" }); spikes(R.head, "#0f0f12", 0, { capA: 0.62 }); band(R, "#c42a2a", 0.0); for (const sx of [-1, 1]) mesh(box(0.06, 0.03, 0.02), mat("#141414"), R.head, sx * 0.065, 0.06, 0.17, false); return R; },
      minato: () => { const R = rig({ skin: "#efc9a6", top: "#2a3a5a", bottom: "#2a3a5a", shoes: "#2a3a5a" }); spikes(R.head, "#f2d23c", 20, { len: 0.2, r: 0.08, el0: 0.1, elr: 1.1, up: 0.1 }); band(R); mesh(box(0.6, 1.0, 0.04), mat("#f2f0ea"), R.torso, 0, 0.1, -0.16); for (let i = 0; i < 4; i++) mesh(box(0.14, 0.12, 0.01), mat("#e0482a"), R.torso, -0.22 + i * 0.15, -0.35, -0.185, false); return R; },
      choji: () => { const R = rig({ skin: "#e8c09a", top: "#9a2a2a", bottom: "#4a4a4a", shoes: "#4a4a4a", build: 1.55 }); spikes(R.head, "#a85a2a", 14, { len: 0.14, back: 0.6 }); for (const sx of [-1, 1]) mesh(box(0.04, 0.04, 0.01), mat("#c42a2a"), R.head, sx * 0.1, -0.04, 0.17, false); mesh(box(0.8, 0.5, 0.3), mat("#9a2a2a"), R.torso, 0, 0.3, 0); return R; },
      sakura: () => { const R = rig({ skin: "#f2d0b4", top: "#c42a3a", bottom: "#2a2a2e", shoes: "#2a2a2e" }); spikes(R.head, "#f29ac0", 18, { len: 0.12, el0: -0.3, elr: 1.2, capA: 0.55 }); band(R, "#c42a3a"); for (const L of [R.legL, R.legR]) mesh(box(0.2, 0.2, 0.22), mat("#e8e4d8"), L, 0, -0.1, 0); return R; },
      kakashi: () => { const R = rig({ skin: "#e8c8aa", top: "#4f6b3e", sleeve: "#1d2a3a", bottom: "#1d2a3a", shoes: "#1d2a3a", noMouth: true });
        spikes(R.head, "#d9dde2", 16, { len: 0.26, r: 0.075, el0: 0.5, elr: 0.7, side: 0.9, up: 0.3 }); mesh(cyl(0.183, 0.183, 0.17, 12), mat("#1d2a3a"), R.head, 0, -0.08, 0.005, false);
        const b = mesh(box(0.34, 0.07, 0.03), mat("#9aa5ad", { m: 0.8, r: 0.3 }), R.head, -0.02, 0.07, 0.165, false); b.rotation.z = 0.25; mesh(box(0.05, 0.03, 0.02), mat("#d93030", { e: "#d93030", ei: 0.6 }), R.head, -0.065, 0.0, 0.172, false);
        for (const sx of [-1, 1]) mesh(box(0.13, 0.14, 0.05), mat("#46603a"), R.torso, sx * 0.13, 0.42, 0.15); R.prop = mesh(box(0.12, 0.17, 0.03), mat("#d8a03a"), R.armL.fore, 0, -0.38, 0.08, false); return R; },
      guy: () => { const R = rig({ skin: "#e8c09a", top: "#2e7a3a", sleeve: "#2e7a3a", bottom: "#2e7a3a", shin: "#e88a2a", shoes: "#2e7a3a", build: 1.15 }); spikes(R.head, "#0f0f12", 0, { capA: 0.62 }); mesh(box(0.5, 0.3, 0.3), mat("#46603a"), R.torso, 0, 0.5, 0); band(R, "#c42a2a", 0.0); for (const sx of [-1, 1]) mesh(box(0.07, 0.035, 0.02), mat("#141414"), R.head, sx * 0.065, 0.06, 0.17, false); return R; },
      neji: () => { const R = rig({ skin: "#f2dcc4", top: "#e8e2d4", bottom: "#4a4a54", shoes: "#4a4a54", eyes: "#e8e8ff", eyeGlow: true }); spikes(R.head, "#2a2220", 10, { back: 1.2, len: 0.35, r: 0.08 }); band(R); return R; },
      naruto: () => { const R = rig({ skin: "#efc6a0", top: "#f07d1e", sleeve: "#f07d1e", bottom: "#f07d1e", shoes: "#1d3a6a" }); spikes(R.head, "#f2cc3c", 20, { len: 0.2, r: 0.08, el0: 0.2, elr: 1.0, up: 0.2 }); band(R);
        for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) mesh(box(0.06, 0.006, 0.01), mat("#7a4a2a"), R.head, sx * 0.12, -0.03 - i * 0.025, 0.15, false); mesh(box(0.5, 0.18, 0.285), mat("#1d2440"), R.torso, 0, 0.6, 0); return R; },
    },
  };

  /* ---------- Gym-security: the case room wing (Death Note). One night's entry passes room to room ---------- */
  const gym = {
    id: "gym", name: "Gym-security", wing: "Case room wing", accent: "#9aa0b0", live: "The gym agents aren't sending events yet",
    chain: ["ryuk", "misa", "l", "mello", "near"], solo: ["rem"],
    cast: [
      { id: "ryuk", name: "Ryuk", job: "Night door watch", move: "Name in the notebook", look: "Ryuk", kind: "write", color: "#ff3a2a", big: true,
        who: "Bored, always hungry, never sleeps. Watches the gym door from 9pm to 5am and counts every person through it.", duty: "Reads the door camera during watched hours: movement and head count per entry.", likes: "Apples, quiet nights", hates: "Boredom",
        room: { bd: "wharf", place: "Wharf warehouse stairs" }, dummy: { look: "light", name: "Light", full: "Light Yagami", who: "Ryuk wrote his name at the warehouse when it was over, as he'd said he would.", breaks: "The name goes in; it clutches its chest and drops" } },
      { id: "misa", name: "Misa", job: "Front-desk reader", move: "Shinigami eyes", look: "Misa Amane", kind: "glare", color: "#ff3a5a",
        who: "Sees every name at a glance. Reads each scan off the check-in screen without touching the gym's computer.", duty: "Reads the front-desk screen copy for each check-in; member numbers stay scrambled.", likes: "Being noticed", hates: "Being ignored",
        room: { bd: "studio", place: "TV station studio" }, dummy: { look: "ukita", name: "Ukita", full: "Hirokazu Ukita", who: "Ran into the TV station to stop the broadcast. Misa saw him first.", breaks: "Eyes lock on, a red name hangs over it, it topples" } },
      { id: "l", name: "L", job: "Matcher", move: "The kick", look: "L", kind: "dash", color: "#e8e8f0", kick: true, impact: true,
        who: "Sits like nobody else, thinks like nobody else. Lines each entry up with the scans; two people on one scan is a flag.", duty: "Matches door entries to desk scans and flags tailgates and shared codes.", likes: "Sugar cubes, a 5% chance", hates: "Coincidences",
        room: { bd: "highway", place: "Highway roadblock" }, dummy: { look: "higuchi", name: "Higuchi", full: "Kyosuke Higuchi", who: "Caught at the highway roadblock by L's task force, notebook and all.", breaks: "One kick and it's down" } },
      { id: "mello", name: "Mello", job: "Alerts", move: "Detonator", look: "Mello", kind: "blast", color: "#ff9a3a",
        who: "Loud, fast and never subtle. When L flags an entry he makes sure the gym hears about it, by email or phone.", duty: "Sends each flag to the gym by email or phone notification.", likes: "Chocolate, being first", hates: "Coming second",
        room: { bd: "hideout", place: "Mello's hideout" }, dummy: { look: "soichiro", name: "Soichiro", full: "Soichiro Yagami", who: "Led the raid on Mello's hideout and didn't walk out of it.", breaks: "The blast throws it across the room" } },
      { id: "near", name: "Near", job: "Morning and monthly reports", move: "Puzzle drop", look: "Near", kind: "puzzle", color: "#f2f2f2",
        who: "Builds the case one piece at a time. Writes the morning report and the monthly numbers from every flag and staff answer.", duty: "Morning report, problems first; the monthly report from staff answers.", likes: "Finished puzzles", hates: "Loose ends",
        room: { bd: "warehouse", place: "Yellow Box warehouse" }, dummy: { look: "mikami", name: "Mikami", full: "Teru Mikami", who: "Exposed at the Yellow Box warehouse when Near's swapped notebook didn't work.", breaks: "A tower of blocks topples onto it" } },
      { id: "rem", name: "Rem", job: "Privacy and uptime", move: "Final entry", look: "Rem", kind: "write", color: "#e8e0ff", big: true,
        who: "Quiet and protective. Deletes photos after 48 hours, keeps confirmed tailgates 35 days, and keeps the Pi running.", duty: "Runs the retention purge, checks the Pi's health and fixes what it can by itself.", likes: "Keeping her word", hates: "Anything kept too long",
        room: { bd: "hq", place: "Task force HQ" }, dummy: { look: "watari", name: "Watari", full: "Watari", who: "Rem wrote his name at the task force HQ to protect Misa.", breaks: "The name goes in and it crumbles to dust" } },
    ],
    build: {
      ryuk: () => { const R = rig({ skin: "#3e4a5c", top: "#141418", fore: "#3e4a5c", bottom: "#141418", shoes: "#141418", scale: 1.5, eyes: "#ff3a2a", eyeGlow: true, noMouth: true });
        spikes(R.head, "#0d0d10", 22, { len: 0.22, r: 0.07, el0: -0.2, elr: 1.3 }); mesh(box(0.2, 0.03, 0.02), mat("#d9d0b8"), R.head, 0, -0.08, 0.17, false);
        for (let i = 0; i < 7; i++) { const f = mesh(cone(0.07, 0.3, 4), mat("#101014"), R.torso, -0.25 + i * 0.08, 0.72, -0.12, false); f.rotation.x = -0.6; f.rotation.z = (i - 3) * 0.2; }
        for (const sx of [-1, 1]) { const w = grp(R.torso, sx * 0.2, 0.55, -0.2); for (let i = 0; i < 4; i++) { const p = mesh(box(0.5, 0.06, 0.02), mat("#1a1a20"), w, sx * (0.3 + i * 0.05), 0.15 - i * 0.12, 0, false); p.rotation.z = sx * (0.5 - i * 0.18); } }
        R.prop = mesh(box(0.16, 0.2, 0.03), mat("#121214"), R.armL.fore, 0, -0.42, 0.06, false); R.apple = mesh(ball(0.07, 1), mat("#c4161c", { r: 0.4 }), R.armR.fore, 0, -0.44, 0.04, false); return R; },
      misa: () => { const R = rig({ skin: "#f4e2d4", top: "#141416", bottom: "#141416", shoes: "#141416" }); spikes(R.head, "#f2dc8a", 18, { len: 0.14, el0: -0.4, elr: 1.4, capA: 0.55 }); for (const sx of [-1, 1]) mesh(ball(0.07, 0), mat("#f2dc8a"), R.head, sx * 0.16, 0.08, -0.06, false); mesh(box(0.04, 0.3, 0.02), mat("#c8c8d0", { m: 0.7 }), R.torso, 0, 0.42, 0.15, false); return R; },
      l: () => { const R = rig({ skin: "#f4e6dc", top: "#f2f1ec", bottom: "#46628a", shoes: "#f4e6dc" }); spikes(R.head, "#0f0f12", 26, { len: 0.17, r: 0.07, el0: -0.4, elr: 1.4 }); for (const sx of [-1, 1]) mesh(box(0.06, 0.03, 0.01), mat("#4a3e46"), R.head, sx * 0.065, -0.02, 0.172, false); return R; },
      mello: () => { const R = rig({ skin: "#f2dcc4", top: "#141416", bottom: "#141416", shoes: "#141416" }); spikes(R.head, "#f2dc8a", 18, { len: 0.12, el0: -0.5, elr: 1.4, capA: 0.6 }); mesh(box(0.06, 0.02, 0.01), mat("#7a4a3a"), R.head, -0.08, -0.04, 0.17, false); R.prop = mesh(box(0.05, 0.2, 0.03), mat("#5a3420"), R.armR.fore, 0, -0.42, 0.06, false); return R; },
      near: () => { const R = rig({ skin: "#f6ece4", top: "#f4f4f2", bottom: "#f4f4f2", shoes: "#f4f4f2" }); spikes(R.head, "#f2f2f4", 24, { len: 0.14, r: 0.075, el0: -0.3, elr: 1.4 }); return R; },
      rem: () => { const R = rig({ skin: "#e8e4f0", top: "#d8d4e8", bottom: "#d8d4e8", shoes: "#d8d4e8", scale: 1.55, eyes: "#e8c84a", eyeGlow: true, noMouth: true });
        for (let i = 0; i < 6; i++) { const b = mesh(cyl(0.02, 0.03, 0.25, 4), mat("#f2f0f8"), R.torso, -0.2 + i * 0.08, 0.6, 0.15, false); b.rotation.z = Math.PI / 2; }
        spikes(R.head, "#e8e4f0", 10, { len: 0.2, el0: 0.4, elr: 0.8 }); R.prop = mesh(box(0.16, 0.2, 0.03), mat("#121214"), R.armL.fore, 0, -0.42, 0.06, false); return R; },
    },
  };

  /* ---------- the Etsy shop: the capsule wing (Dragon Ball Z). Crew and jobs from money/lanes/etsy-digital/LANE.md ---------- */
  const etsy = {
    id: "etsy", name: "Etsy shop", wing: "Capsule wing", accent: "#3a8ad0", live: "The shop isn't open yet",
    chain: ["bulma", "goku", "gohan", "piccolo", "trunks", "vegeta"], solo: ["dende", "whis"],
    cast: [
      { id: "bulma", name: "Bulma", job: "Market research", move: "Dragon Radar", look: "Bulma", kind: "ping", color: "#4ae0a0",
        who: "Genius, impatient, always right about what's coming. Tracks what's selling now, what's rising and what's next.", duty: "Monday demand board, scored with two or more signals each; picks the week's products by the score rule.", likes: "Data with links", hates: "Hunches",
        room: { bd: "lab", place: "Capsule Corp lab" }, dummy: { look: "pilaf", name: "Pilaf", full: "Emperor Pilaf", who: "Bulma is a genius, not a fighter; she out-thought Pilaf back in the dragon-ball hunting days.", breaks: "A capsule pops and a machine bonks it flat", honest: true } },
      { id: "goku", name: "Goku", job: "Product designer", move: "Kamehameha", look: "Goku", kind: "beam", color: "#6ab8ff", impact: true,
        who: "Lives to train and to make the next thing better. Builds each product as a print-ready PDF in our premium look.", duty: "Builds the week's products (US Letter and A4) with five listing images each.", likes: "A stronger version", hates: "Sloppy work",
        room: { bd: "namek", place: "Planet Namek" }, dummy: { look: "frieza", name: "Frieza", full: "Frieza", who: "Goku beat him on Namek while the planet came apart.", breaks: "The beam blasts it apart" } },
      { id: "gohan", name: "Gohan", job: "Listing and SEO", move: "Masenko", look: "Gohan", kind: "beam", color: "#ffe66a", thin: true,
        who: "The scholar with a hidden temper. Writes titles, all 13 tags and the description, with the AI disclosure.", duty: "Listing copy, tags, price from the scout's range and the buyer's download note.", likes: "Good study notes", hates: "Keyword stuffing",
        room: { bd: "arena", place: "Cell Games arena" }, dummy: { look: "cell", name: "Cell", full: "Cell", who: "Gohan beat him at the Cell Games.", breaks: "Blown off the ring" } },
      { id: "piccolo", name: "Piccolo", job: "QA and compliance", move: "Special Beam Cannon", look: "Piccolo", kind: "beam", color: "#e8ff6a", spiral: true,
        who: "Stern, careful, always watching. Opens every file, checks Etsy's rules and trademarks, and can veto.", duty: "Checks 100% of the batch before TJ sees it; logs a trademark search per name.", likes: "Discipline", hates: "Shortcuts",
        room: { bd: "wasteland", place: "Raditz crash site" }, dummy: { look: "raditz", name: "Raditz", full: "Raditz", who: "Piccolo's beam went straight through him in the first big fight.", breaks: "One shot straight through" } },
      { id: "trunks", name: "Trunks", job: "Shop operator", move: "Sword rush", look: "Future Trunks", kind: "slash", color: "#bfe3ff",
        who: "Came from a bad future to keep this one tidy. Lists the approved batch and retires dead listings.", duty: "Lists through Etsy's API after TJ's weekly tap; retires listings with no views in 60 days.", likes: "A clean shelf", hates: "Listing anything TJ hasn't approved",
        room: { bd: "wasteland", variant: 1, place: "Rocky plateau" }, dummy: { look: "mecha", name: "Mecha Frieza", full: "Mecha Frieza", who: "Trunks sliced him up on the plateau the day he landed.", breaks: "Sliced into pieces" } },
      { id: "vegeta", name: "Vegeta", job: "Finance", move: "Final Flash", look: "Vegeta", kind: "beam", color: "#ffe9a0", impact: true,
        who: "Proud, exact and keeps score of everything. Logs sales, guards the wallet and writes the monthly verdict.", duty: "Daily sales log, the wallet check before every batch, the 1st-of-month verdict.", likes: "Being over 9000", hates: "Red numbers",
        room: { bd: "namek", variant: 1, place: "Namek, by the lake" }, dummy: { look: "zarbon", name: "Zarbon", full: "Zarbon", who: "Vegeta beat him on Namek on the second try.", breaks: "The flash knocks it into the water" } },
      { id: "dende", name: "Dende", job: "Customer care", move: "Healing hands", look: "Dende", kind: "heal", color: "#9aff9a",
        who: "Kind and patient. Reads order emails and drafts any reply a buyer needs within 12 hours.", duty: "Reads Etsy order and message emails, drafts replies, adds repeat questions to the FAQ.", likes: "Happy buyers", hates: "Unanswered messages",
        room: { bd: "lookout", place: "The Lookout" }, dummy: { look: "garlic", name: "Garlic Jr.", full: "Garlic Jr.", who: "Dende heals, he doesn't fight; Garlic Jr. was beaten at the Lookout with Dende there.", breaks: "Pushed back by a wall of light", honest: true } },
      { id: "whis", name: "Whis", job: "Quality and token auditor", move: "The tap", look: "Whis", kind: "blink", color: "#c8b8ff", tap: true,
        who: "Calm, polite, sees every mistake. Grades the crew every Sunday and sets each agent's token budget.", duty: "Weekly score: handoff failures, vetoes, products sent back, tokens and dollars per product.", likes: "Good food, good form", hates: "Wasted effort",
        room: { bd: "beerus", place: "Beerus's planet" }, dummy: { look: "beerus", name: "Beerus", full: "Beerus", who: "Whis's one-tap knockout of Beerus is a running joke on their planet.", breaks: "One tap to the neck and it's asleep" } },
    ],
    build: {
      bulma: () => { const R = rig({ skin: "#f2d6c0", top: "#e85a8a", bottom: "#3a5a8a", shoes: "#e8e4d8" }); spikes(R.head, "#4ac8c8", 16, { len: 0.14, el0: -0.3, elr: 1.3, capA: 0.55 }); R.prop = mesh(box(0.14, 0.14, 0.04), mat("#e8e4d8"), R.armL.fore, 0, -0.42, 0.06, false); mesh(box(0.1, 0.1, 0.01), mat("#0a2a1a", { e: "#4ae0a0", ei: 0.6 }), R.prop, 0, 0, 0.025, false); return R; },
      goku: () => { const R = rig({ skin: "#efc9a6", top: "#ef7d22", sleeve: "#ef7d22", fore: "#efc9a6", bottom: "#ef7d22", belt: "#2a4fa8", shoes: "#2a4fa8", build: 1.15 }); spikes(R.head, "#141416", 20, { len: 0.26, r: 0.085, el0: 0.2, elr: 1.0, up: 0.4 });
        mesh(box(0.22, 0.2, 0.02), mat("#2a4fa8"), R.torso, 0, 0.58, 0.142); for (const L of [R.legL, R.legR]) mesh(box(0.2, 0.14, 0.22), mat("#2a4fa8"), L.shin, 0, -0.33, 0); return R; },
      gohan: () => { const R = rig({ skin: "#efc9a6", top: "#6a3a8a", bottom: "#6a3a8a", belt: "#e8a02a", shoes: "#5a3a2a" }); spikes(R.head, "#141416", 16, { len: 0.18, el0: 0.3, elr: 0.9, up: 0.2 }); mesh(box(0.5, 0.12, 0.3), mat("#e8a02a"), R.torso, 0, 0.12, 0); return R; },
      piccolo: () => { const R = rig({ skin: "#6ab05a", top: "#6a3a8a", bottom: "#6a3a8a", belt: "#4ac8e8", shoes: "#6a3a2a", scale: 1.15 }); mesh(cyl(0.17, 0.19, 0.18, 10), mat("#f2f0ea"), R.head, 0, 0.14, 0, false); for (const sx of [-1, 1]) { const a = mesh(cyl(0.008, 0.008, 0.2, 4), mat("#6ab05a"), R.head, sx * 0.05, 0.16, 0.12, false); a.rotation.x = -0.6; } mesh(box(0.7, 1.1, 0.05), mat("#f2f0ea"), R.torso, 0, 0.1, -0.18); for (const sx of [-1, 1]) mesh(box(0.28, 0.14, 0.32), mat("#f2f0ea"), R.torso, sx * 0.3, 0.72, 0); return R; },
      trunks: () => { const R = rig({ skin: "#efd0b4", top: "#3a4a6a", sleeve: "#3a4a6a", bottom: "#2a2a30", shoes: "#e8c84a" }); spikes(R.head, "#c8a8e8", 18, { len: 0.12, el0: -0.4, elr: 1.4, capA: 0.55 }); const s = grp(R.torso, 0.1, 0.45, -0.18); s.rotation.z = 0.5; mesh(box(0.04, 1.1, 0.03), mat("#c8ccd4", { m: 0.85, r: 0.25 }), s); mesh(box(0.035, 0.24, 0.035), mat("#6a4a2a"), s, 0, 0.66, 0); R.sword = s; return R; },
      vegeta: () => { const R = rig({ skin: "#efc9a6", top: "#e8e4d8", sleeve: "#2a3a8a", fore: "#e8e4d8", bottom: "#2a3a8a", shoes: "#e8e4d8" }); spikes(R.head, "#141416", 18, { len: 0.3, r: 0.08, el0: 0.7, elr: 0.6, up: 1.2 }); mesh(box(0.56, 0.36, 0.32), mat("#e8e4d8"), R.torso, 0, 0.5, 0); for (const sx of [-1, 1]) mesh(box(0.2, 0.08, 0.3), mat("#e8c84a"), R.torso, sx * 0.3, 0.75, 0); return R; },
      dende: () => { const R = rig({ skin: "#6ab05a", top: "#f2f0ea", bottom: "#f2f0ea", shoes: "#6a3a2a", scale: 0.85 }); for (const sx of [-1, 1]) { const e = mesh(cone(0.05, 0.16, 4), mat("#6ab05a"), R.head, sx * 0.18, 0.04, 0, false); e.rotation.z = -sx * 1.2; } for (const sx of [-1, 1]) { const a = mesh(cyl(0.008, 0.008, 0.2, 4), mat("#6ab05a"), R.head, sx * 0.05, 0.22, 0.06, false); a.rotation.x = -0.4; } mesh(box(0.2, 0.2, 0.02), mat("#4a3a8a"), R.torso, 0, 0.45, 0.142); return R; },
      whis: () => { const R = rig({ skin: "#b8c8e8", top: "#6a2a5a", bottom: "#6a2a5a", shoes: "#141416", scale: 1.15 }); mesh(cyl(0.06, 0.1, 0.4, 8), mat("#f2f4f8"), R.head, 0, 0.3, -0.02, false); mesh(box(0.5, 0.2, 0.3), mat("#f2f0ea"), R.torso, 0, 0.6, 0); mesh(cyl(0.3, 0.3, 0.06, 16), mat("#5a6a8a", { m: 0.6 }), R.torso, 0, 0.55, 0, false); R.prop = mesh(cyl(0.012, 0.012, 1.4, 6), mat("#d8d8e8", { m: 0.7 }), R.armR.fore, 0, -0.1, 0.06, false); mesh(ball(0.06, 1), mat("#4ac8e8", { e: "#4ac8e8", ei: 0.6 }), R.prop, 0, 0.7, 0, false); return R; },
    },
  };

  return { agency, basis, gym, etsy, order: ["agency", "basis", "gym", "etsy"],
    labels: { agency: { name: "Sites by TJ", wing: "Jujutsu wing", accent: "#c9a24a" }, basis: { name: basis.name, wing: basis.wing, accent: basis.accent },
      gym: { name: gym.name, wing: gym.wing, accent: gym.accent }, etsy: { name: etsy.name, wing: etsy.wing, accent: etsy.accent } } };
})();
