# Peak moments: each fighter's top form + ultimate, played as a full cinematic now and then.
# Written from memory of the shows (not web-checked); "(check)" marks the shaky ones.
import json, sys
R = json.load(open(sys.argv[1]))
P = {  # name: (peak form, ultimate, quip after it, colors top/pants/hair)
 # Jarvis HQ
 "Ijichi": ("Driver mode", "Veil chant: 'Emerging from darkness, blacker than black...'", "Curtain's down. I'll bring the car around.", "#20232a #20232a #2a2a30"),
 "Yaga": ("Cursed Corpse master", "Cursed Corpse army + Panda on the line", "I made a panda. I can make a deadline.", "#2a2a2a #2a2a2a #3a2a1a"),
 "Shoko": ("Reverse Cursed Technique", "RCT output: rebuilds a body on the table", "Don't die. My paperwork is already late.", "#f2f2f2 #2a2a2a #5a3a2a"),
 "Gakuganji": ("Guitar solo (check)", "Amplified cursed-energy riff", "Respect your elders. And your morning brief.", "#3a3a4a #3a3a4a #e8e8e8"),
 "Utahime": ("Solo Forbidden Area", "Ritual dance that boosts Gojo's 200% Hollow Purple", "Never call me a weakling while I'm buffing you.", "#f2f2f2 #b03030 #2a2a30"),
 "Mei Mei": ("Black Bird Manipulation", "Bird Strike (kamikaze crow, no limit on cost)", "Money first. Then we talk loyalty.", "#1a1a1e #1a1a1e #e8e8f0"),
 "Kusakabe": ("New Shadow Style: Simple Domain", "Batto sword-draw inside Simple Domain", "Strongest non-technique user here. Budget's still no.", "#3a3a40 #3a3a40 #1a1a1e"),
 "Miwa": ("New Shadow Style: Simple Domain", "Batto (she lands one, for once)", "I'm saving up. That's why I check every line.", "#1d2340 #1d2340 #6ac0e8"),
 "Mechamaru": ("Ultimate Mechamaru: Mode Absolute", "Ultra Cannon at zero range", "Seven hundred bots watched that. All reported in.", "#5a6070 #5a6070 #2a2a30"),
 "Ui Ui": ("Teleportation", "Extraction: Mei Mei out of Shibuya in one blink", "Big sister said move it. It's moved.", "#1a1a1e #1a1a1e #e8e8f0"),
 # Sites by TJ
 "Toji": ("Heavenly Restriction", "Inverted Spear of Heaven through Infinity", "No cursed energy. No problem.", "#2b2b2b #3a3a3a #111111"),
 "Yuji": ("Soul-strike + Black Flash zone", "Four Black Flashes in a row, then Domain Expansion (check)", "I'm you. Except I go to class.", "#1d2340 #1d2340 #ff8fa0"),
 "Hanami": ("Domain Expansion", "Ceremonial Sea of Light", "The earth asked me to fix this layout.", "#5a6a3a #5a6a3a #e8e0cc"),
 "Yuta": ("Rika full manifestation", "Pure Love Cannon", "I love you, Rika. Also: draft two is done.", "#f2f2f2 #20232a #111111"),
 "Mahoraga": ("Wheel turned: adapted", "Adapts to Infinity, then the world-cutting slash", "*wheel clanks*", "#e8e0d0 #e8e0d0 #c9b88a"),
 "Todo": ("Boogie Woogie", "Vibraslap: clap with no hand, Black Flash", "What kind of women do you like? ... Wrong answer.", "#1d2340 #2a2a2a #2a2a2a"),
 "Gojo": ("Six Eyes, blindfold off", "200% Hollow Purple: 'Nine ropes. Polarized light. Crow and Shomyo...'", "Throughout heaven and earth, I alone am the honored one.", "#16171f #16171f #f4f6ff"),
 "Hakari": ("Jackpot (4:11 of immortality)", "Domain Expansion: Idle Death Gamble", "Fever mode. Reply sent in the bonus round.", "#2a2f3a #2a2f3a #cfd7e6"),
 "Nanami": ("Overtime", "Ratio Technique: Collapse", "It's 6:01. I'm now billing overtime.", "#d9c8a0 #d9c8a0 #e8d27a"),
 "Sukuna": ("Heian form, four arms", "Divine Flame: 'Open' + World-Cutting Slash", "Stand proud. You were a decent dummy.", "#f2f2f2 #2a2a2a #ff9ab0"),
 "Jogo": ("Disaster Flames", "Domain Expansion: Coffin of the Iron Mountain", "Pass the alarm. I'm the alarm.", "#e8e2d8 #e8e2d8 #2a2a30"),
 "Maki": ("Awakened Heavenly Restriction", "Zenin clan sweep with Split Soul Katana", "Mai built this sword. I finish the job.", "#1d2340 #1d2340 #2a3a2a"),
 "Mai": ("Construction", "Last Construction: her one sword for Maki", "Free tools. Not free energy.", "#1d2340 #1d2340 #2a2a30"),
 "Nobara": ("Straw Doll: Resonance", "Hairpin + Resonance on Eso", "Five stars or I nail it.", "#1d2340 #1d2340 #c06a3a"),
 "Inumaki": ("Cursed Speech", "'Don't move.' Then 'Blast away.' (check)", "Salmon. Bonito flakes. (Translation: done.)", "#1d2340 #1d2340 #e8e8f0"),
 "Panda": ("Gorilla Core", "Drumming Beat (punch that skips the guard)", "I'm a panda. My owner page has better SEO than me.", "#1d2340 #f2f2f2 #1a1a1e"),
 "Choso": ("Flowing Red Scale: Stack", "Piercing Blood at full pressure", "Big brother does the quotes. Always.", "#4a3a2a #2a2a2a #1a1a1e"),
 "Higuruma": ("Domain Expansion: Deadly Sentencing", "Executioner's Sword (sentence: death)", "Objection overruled. Opt-out honored.", "#2a2a30 #2a2a30 #1a1a1e"),
 "Takaba": ("Comedian", "Nothing hurts if he thinks it's funny", "Did you laugh? Then it counts as a lead.", "#f2f2f2 #2a2a2a #1a1a1e"),
 "Ino Takuma": ("Auspicious Beasts", "Ryu: rain-dragon cursed-energy beam", "Calendar synced. Kirin says no pain today.", "#1a1a1e #1a1a1e #2a2a30"),
 "Yuki": ("Star Rage + Garuda", "Black Hole", "Vapi's down? Fine. I bend gravity instead.", "#2a2a30 #2a2a30 #e8c87a"),
 "Kamo": ("Blood Manipulation", "Convergence into Piercing Blood", "Checked twice. Bloodline standards.", "#1d2340 #1d2340 #1a1a1e"),
 # Basis (Naruto)
 "Shikamaru": ("Shadow Possession", "Shadow Stitching + the buried-alive trap", "What a drag. Routine's done though.", "#4a5a3a #2a2f3a #1a1a22"),
 "Rock Lee": ("Eight Gates: Fifth Gate", "Hidden Lotus", "If I can't do 500 laps, I'll do 1000.", "#3fae5a #3fae5a #111111"),
 "Minato": ("Flying Raijin + Kurama Chakra Mode", "Teleport-chain Rasengan", "Run tracked. I was already at the finish.", "#f2f2f2 #1f2a4a #ffe66a"),
 "Choji": ("Butterfly Mode", "Butterfly Bullet Bombing", "Never call me fat. Call me macro-optimized.", "#b3423a #7a3a2a #8a5a2a"),
 "Sakura": ("Strength of a Hundred Seal", "CHA-NNARO!! ground-splitting punch", "Sleep eight hours or I heal you the hard way.", "#c83a4a #2a2a2a #ff9ac0"),
 "Kakashi": ("Perfect Susanoo (both eyes, once)", "Kamui Shuriken vs Kaguya", "I'm late because I got lost on the road of life.", "#3a5a3a #24283a #d8dde2"),
 "Guy": ("Eighth Gate: Gate of Death", "Night Guy", "The power of youth! Also: drink water.", "#3fae5a #3fae5a #111111"),
 "Neji": ("Byakugan", "Eight Trigrams: Sixty-Four Palms", "Fate said you'd skip leg day. I disagree.", "#e8e2d8 #3a3a4a #3a2a1a"),
 "Naruto": ("Baryon Mode", "Baryon Mode Rasengan (after Six Paths Planetary Rasenshuriken)", "I never go back on my word. That's my nindo, dattebayo!", "#f2862a #f2862a #ffd23a"),
 "Hinata": ("Byakugan", "Twin Lion Fists", "I won't run. That's my ninja way too.", "#e8e2f0 #2a2a3a #2a2a4a"),
 "Ino Yamanaka": ("Mind Transfer", "Mind Transfer: hold the whole field (war)", "Moderated. Nobody's being rude in my head.", "#7a3a8a #7a3a8a #f2e27a"),
 "Gaara": ("Shukaku", "Sand Burial (Desert Funeral)", "The paywall holds. Like sand.", "#8a3a3a #8a3a3a #c0402a"),
 "Tenten": ("Weapon scrolls", "Twin Rising Dragons", "Grocery list sealed in a scroll. 40 items.", "#f2e2d0 #8a2a2a #3a2a1a"),
 "Jiraiya": ("Sage Mode with the Two Great Sage Toads", "Sage Art: Goemon + Big Ball Rasengan", "The tale of the utterly gutsy digest.", "#5a8a5a #c03a3a #f2f2f2"),
 "Kiba": ("Beast Mimicry with Akamaru", "Fang Over Fang", "Two of us. Head to head. That's the point.", "#3a3a4a #2a2a3a #3a2a1a"),
 "Shino": ("Parasitic Insects", "Insect Sphere", "Why? Because a reminder was due.", "#4a5a4a #3a3a3a #2a2a2a"),
 "Sai": ("Super Beast Imitating Drawing", "Ink Dragon + ink lions", "I read a book on backdrops. Here's a nice one.", "#2a2a2a #2a2a2a #1a1a1e"),
 "Sasuke": ("Eternal Mangekyo + Rinnegan", "Perfect Susanoo: Indra's Arrow", "Short on time? Then don't blink.", "#2a2a3a #2a2a3a #1a1a2a"),
 # Gym-security (Death Note)
 "Ryuk": ("Shinigami", "Writes the name in his own notebook", "Humans... so interesting. Got an apple?", "#1a1a1e #1a1a1e #111111"),
 "Misa": ("Second Kira (Shinigami eyes)", "Reads the name off a face", "I saw who walked in. Eyes deal, remember?", "#1a1a1e #1a1a1e #f2d27a"),
 "L": ("World's greatest detective", "The capoeira kick on Light", "That's a kick for a kick.", "#f2f2f2 #6a7a9a #111111"),
 "Mello": ("Mafia mode", "Remote detonator", "Second place again? Not tonight.", "#1a1a1e #1a1a1e #e8d27a"),
 "Near": ("Successor of L", "Yellow Box: the fake-notebook reveal", "Shall we begin? I already finished the report.", "#f2f2f2 #f2f2f2 #f2f2f2"),
 "Rem": ("Shinigami", "Writes L and Watari (and turns to dust)", "For Misa. Always.", "#f2f2f2 #d8d8e2 #e8f0ff"),
 "Light": ("Kira", "'Just as planned' + the potato chip", "I'll take a potato chip... AND EAT IT!", "#c4b08a #3a3a40 #6a4a2a"),
 "Watari": ("Wammy's inventor", "L's emergency data wipe (check)", "Setup complete, young master.", "#2a2a30 #2a2a30 #d8d8d8"),
 "Soichiro": ("Shinigami-eyes deal", "The raid on Mello's hideout", "Justice keeps logs. 35 days.", "#4a4a50 #4a4a50 #2a2a2a"),
 "Matsuda": ("Rookie with a gun", "Warehouse shots: Matsuda shoots Light", "WHY? Hardware check. That's why.", "#3a4a6a #3a4a6a #2a2a2a"),
 # Etsy shop (DBZ)
 "Bulma": ("Capsule Corp genius", "Slaps Beerus at her own party", "Trend report's in. You're welcome.", "#3a6aaa #3a6aaa #3ac0c0"),
 "Goku": ("Ultra Instinct (mastered)", "Silver-hair dodge-and-counter that shakes the arena", "Didn't think. Just moved. Whis would be proud.", "#f07a24 #f07a24 #111111"),
 "Gohan": ("Beast", "Special Beam Cannon (Beast)", "Great Saiyaman, but for SEO.", "#5a3a8a #5a3a8a #111111"),
 "Piccolo": ("Orange Piccolo (giant)", "Giant form vs Cell Max", "Kakarot's kid trained by me. Obviously.", "#5a3a8a #5a3a8a #5aaa4a"),
 "Trunks": ("Super Saiyan Rage", "Sword of Hope", "I came back from the future. Ship the order.", "#2a3a5a #4a4a4a #b8a0d8"),
 "Vegeta": ("Ultra Ego", "Final Flash", "It's over. Not nine thousand. Just over.", "#2a3a8a #2a3a8a #111111"),
 "Dende": ("Guardian of Earth", "Instant full heal", "Refund? Healed it instead.", "#e8e2d8 #e8e2d8 #6ac05a"),
 "Whis": ("Angel", "Temporal Do-Over: three minutes back", "Ohoho. Let's try that listing again.", "#3a3a6a #3a3a6a #e8e8f0"),
}
FIX = {  # dummy corrections (canon opponents from the shows)
 "Rock Lee": ("Gaara", ["Sand Coffin", "Sand Shield", "Sand Shuriken", "Sand Burial"], False),
 "Guy": ("Madara (Ten-Tails jinchuriki)", ["Truth-Seeking Balls", "Limbo shadows", "Six Paths staff", "Rinnegan absorb", "Meteorite drop"], False),
 "Jiraiya": ("Pain (Six Paths)", ["Shinra Tensei", "Bansho Ten'in", "Summoning: Rhino and centipede", "Animal Path dog", "Asura Path missiles"], False),
 "L": ("Light Yagami", ["Return kick", "Alibi switch", "Potato-chip notebook", "Handcuff tug"], False),
 "Matsuda": ("Light Yagami (warehouse)", ["Hidden notebook scrap", "Watch-compartment write", "Monologue", "Crawling escape"], False),
 "Panda": ("Mechamaru (Goodwill Event)", ["Ultra Cannon", "Sword Mode", "Drop Cannon", "Blast Mode"], False),
 "Sai": ("Naruto (Team Kakashi tryout)", ["Shadow Clone rush", "Rasengan", "Nine-Tails cloak flare", "Sexy Jutsu"], True),
 "Bulma": ("Beerus (birthday party)", ["Hakai", "Single-finger block", "Planet destroyer orb", "Pudding tantrum"], True),
}
names = {f["name"] for w in R["wings"] for f in w["fighters"]}
basis = next(w for w in R["wings"] if w["id"] == "basis")
if "Sasuke" not in names:
    basis["fighters"].append({"id": "sasuke", "name": "Sasuke", "job": "Short-on-time workouts (basis-short.js)", "agent_source": "basis CLAUDE.md: short-on-time basis-short.js",
      "status": "built", "status_note": "built in Basis round 3; live only when Joseph deploys", "existing": False,
      "moves": ["Lion Combo", "Great Fireball Technique", "Chidori", "Chidori Nagashi", "Chidori Sharp Spear", "Kirin", "Amaterasu", "Blaze Release: Kagutsuchi", "Amenotejikara swap", "Susanoo: Yasaka Magatama", "Indra's Arrow", "Chibaku Tensei (Boruto)"],
      "forms": ["Curse Mark level 2", "Mangekyo Sharingan", "Eternal Mangekyo Sharingan", "Complete Susanoo", "Rinne-Sharingan"],
      "finisher": "Perfect Susanoo: Indra's Arrow",
      "dummy": {"name": "Itachi (Uchiha hideout)", "why": "Canon fight Sasuke won; Kirin was the finisher.", "moves": ["Tsukuyomi", "Amaterasu", "Susanoo: Totsuka Blade", "Yata Mirror", "Crow clone", "Great Fireball"], "honest": False},
      "quips": ["Short on time? Then don't blink.", "I've already seen your next rep.", "Kirin needs ten seconds. Your workout needs fifteen minutes.", "Still too slow. Superset it."], "confidence": "high"})
for w in R["wings"]:
    for f in w["fighters"]:
        p = P[f["name"]]; top, pants, hair = p[3].split()
        f["peak"] = {"form": p[0], "move": p[1], "quip": p[2]}; f["colors"] = {"top": top, "pants": pants, "hair": hair}
        if p[1] not in f["moves"]: f["moves"].append(p[1])
        if f["name"] in FIX: n, mv, h = FIX[f["name"]]; f["dummy"] = {"name": n, "why": "corrected to the canon fight", "moves": mv, "honest": h}
        if f["name"] == "Choji": f["forms"] = ["Partial Expansion", "Butterfly Mode"]
        if f["name"] == "Kusakabe": f["finisher"] = "Batto sword-draw in Simple Domain"
missing = names ^ set(P) - {"Sasuke"}
assert not missing, missing
json.dump(R, open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
print(sum(len(w["fighters"]) for w in R["wings"]), "fighters")
