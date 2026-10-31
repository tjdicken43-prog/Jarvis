# Swap thin side characters for Demon Slayer / Solo Leveling fighters (same agent job, same status).
import json
R = json.load(open('roster3.json'))
S = {  # old: (new name, show, moves, forms, peak (form, move, quip), dummy (name, moves), quips, colors top pants hair)
 "Mechamaru": ("Sung Jinwoo", "Solo Leveling", ["Dagger rush (Kasaka's Venom Fang)", "Demon King's Daggers", "Stealth", "Bloodlust", "Shadow Exchange", "Ruler's Authority", "Dragon's Fear", "Arise", "Shadow Extraction", "Mutilation"],
   ["E-rank hunter", "Player (System)", "Job change: Necromancer", "Shadow Monarch"], ("Shadow Monarch", "ARISE: the whole shadow army stands up", "Every agent reported in. Arise."),
   ("Igris (job-change dungeon)", ["Red knight sword rush", "Shoulder charge", "Guard break", "Cape feint", "Kneel... then rise"]), ["Leveled up. Again.", "System says: quest cleared.", "I alone level up. You just get checked.", "Arise. Back to work."], "#1a1a22 #1a1a22 #141418"),
 "Ui Ui": ("Igris", "Solo Leveling", ["Blood-red sword strike", "Knight's charge", "Parry", "Cape sweep", "Shadow step", "Kneel to the Monarch"],
   ["Blood-Red Commander", "Marshal grade"], ("Marshal grade", "Commander's cleave", "Costs counted, my liege."), ("Cerberus (Demon's Castle gate)", ["Triple bite", "Hellfire breath", "Leash yank", "Pounce"]),
   ["...", "*kneels* Cost per client logged.", "My liege, the numbers are in.", "One knight. Every receipt."], "#6a1a1a #2a1a1a #8a1a1a"),
 "Miwa": ("Shinobu Kocho", "Demon Slayer", ["Insect Breathing: Butterfly Dance, Caprice", "Dance of the Bee Sting: True Flutter", "Dragonfly Dance: Compound Eye Hexagon", "Centipede Dance: Hundred-Legged Zigzag", "Wisteria poison dose", "Thrust-only sword style"],
   ["Insect Hashira"], ("Insect Hashira", "Dragonfly Dance: Compound Eye Hexagon", "Exact dose. Twenty-five percent, set aside."), ("Doma (Upper Moon Two)", ["Frozen Clouds", "Lotus Vines", "Cold White Princesses", "Wintry Icicles", "Barren Hanging Garden"]),
   ["Ara ara. You're short on tax again?", "Poison doesn't need strength. Neither do spreadsheets.", "I'm smiling. That's the scary part.", "Measured to the milligram."], "#1a1a22 #1a1a22 #3a1a4a"),
 "Mai": ("Zenitsu Agatsuma", "Demon Slayer", ["Thunder Breathing First Form: Thunderclap and Flash", "Thunderclap and Flash: Sixfold", "Thunderclap and Flash: Eightfold", "Thunderclap and Flash: Godspeed", "Sleep-fighting", "Seventh Form: Honoikazuchi no Kami"],
   ["Asleep (actually good)", "Seventh Form"], ("Seventh Form (his own)", "Honoikazuchi no Kami: Flaming Thunder God", "...Wait, did I do that? The free tools are live?"), ("Kaigaku (Upper Moon Six)", ["Blood Demon Art: black lightning", "Thunder Breathing (corrupted)", "Jealousy slash", "Chain flash"]),
   ["I'M GONNA DIE. ...oh. I won.", "One form. Perfected. Like one good tool.", "Nezuko-chan, look at the traffic!", "*snoring* Thunderclap and... ship."], "#e8c83a #2a2a30 #ffd23a"),
 "Takaba": ("Kyojuro Rengoku", "Demon Slayer", ["Flame Breathing First Form: Unknowing Fire", "Second Form: Rising Scorching Sun", "Third Form: Blazing Universe", "Fourth Form: Blooming Flame Undulation", "Fifth Form: Flame Tiger", "Ninth Form: Rengoku"],
   ["Flame Hashira"], ("Flame Hashira", "Ninth Form: Rengoku", "Set your heart ablaze! And your ad budget, within cap."), ("Akaza (Upper Moon Three)", ["Destructive Death: Air Type", "Annihilation Type", "Compass Needle", "Disorder", "Chaotic Type"]),
   ["UMAI! Leads are coming!", "Set your heart ablaze!", "I will fulfill my duty! Fifteen percent of spend!", "Go beyond your limits. Not the budget's."], "#f2f2f2 #2a2a30 #ffb02a"),
 "Ino Takuma": ("Muichiro Tokito", "Demon Slayer", ["Mist Breathing First Form: Low Clouds, Distant Haze", "Second Form: Eight-Layered Mist", "Third Form: Scattering Mist Splash", "Fourth Form: Shifting Flow Slash", "Fifth Form: Sea of Clouds and Haze", "Sixth Form: Lunar Dispersing Mist", "Seventh Form: Obscuring Clouds"],
   ["Mist Hashira", "Demon Slayer Mark"], ("Demon Slayer Mark", "Seventh Form: Obscuring Clouds", "I forgot what day it was. The calendar didn't."), ("Gyokko (Upper Moon Five)", ["Thousand Needle Fish Kill", "Water Prison Pot", "Writhing Slaughter Fish", "Jar warp", "Perfect Beauty form"]),
   ["I'll forget this fight in a minute. The calendar won't.", "Your schedule is in the mist. I cleared it.", "Sync done. Can I go stare at clouds?", "Everything's in its slot."], "#1a1a22 #1a1a22 #2a3a5a"),
 "Yuki": ("Gyomei Himejima", "Demon Slayer", ["Stone Breathing First Form: Serpentinite Bipolar", "Second Form: Upper Smash", "Third Form: Stone Skin", "Fourth Form: Volcanic Rock, Rapid Conquest", "Fifth Form: Arcs of Justice", "Flail-and-axe chain throw"],
   ["Stone Hashira", "Demon Slayer Mark", "Red Nichirin (grip heat)"], ("Stone Hashira with the Mark", "Fifth Form: Arcs of Justice", "Namu Amida Butsu. The line is back up."), ("Kokushibo (Upper Moon One)", ["Moon Breathing First Form", "Moon Breathing Tenth Form", "Crescent blade storm", "Six-eyed glare", "Flesh-sword extension"]),
   ["*weeping* Namu Amida Butsu.", "The strongest Hashira holds the fallback line.", "Pity the outage. Not the dummy.", "Steady as stone."], "#4a3a2a #2a2a2a #1a1a1e"),
 "Kamo": ("Giyu Tomioka", "Demon Slayer", ["Water Breathing First Form: Water Surface Slash", "Third Form: Flowing Dance", "Sixth Form: Whirlpool", "Eighth Form: Waterfall Basin", "Tenth Form: Constant Flux", "Eleventh Form: Dead Calm"],
   ["Water Hashira", "Demon Slayer Mark"], ("Water Hashira", "Eleventh Form: Dead Calm", "I'm not hated. I just reject bad leads."), ("Rui (Lower Moon Five)", ["Cutting Thread Cage", "Blood Steel Threads", "Thread puppet family", "Spider web snare"]),
   ["...I'm not disliked.", "Checked. Rejected. Calmly.", "Dead Calm. Nothing gets through unchecked.", "Don't give others the power to waste your leads."], "#8a2a2a #1a1a22 #141418"),
 "Watari": ("Cha Hae-In", "Solo Leveling", ["Sword Dance", "Light-step dash", "Gale-blade combo", "Mana sense", "S-rank finishing thrust"],
   ["S-rank hunter"], ("S-rank", "Sword Dance at full speed", "Setup's done. And it doesn't smell bad in here."), ("Beru (Jeju Island ant king)", ["Claw flurry", "Roar paralysis", "Healing absorb", "Wing dash"]),
   ["Installed. Clean.", "You smell like... no mana. Good.", "One pass. No second setup needed.", "S-rank install, D-rank effort."], "#e8e8f0 #2a2a3a #f2d27a"),
 "Soichiro": ("Tengen Uzui", "Demon Slayer", ["Sound Breathing First Form: Roar", "Fourth Form: Constant Resounding Slashes", "Fifth Form: String Performance", "Musical Score", "Explosive dual cleavers", "Ninja shuriken"],
   ["Sound Hashira", "Musical Score complete"], ("Musical Score complete", "Constant Resounding Slashes", "Thirty-five days. Flamboyantly logged."), ("Gyutaro (Upper Moon Six)", ["Flying Blood Sickles", "Rampaging Blood Sickles", "Poisoned sickles", "Swap with Daki", "Rotating Circular Slashes"]),
   ["Flamboyant!", "Logs kept. Flamboyantly.", "I'm a god. A god of retention.", "Forty-eight hours, then gone. Like a ninja."], "#2a2a30 #2a2a30 #f2f2f2"),
 "Sai": ("Mitsuri Kanroji", "Demon Slayer", ["Love Breathing First Form: Shivers of First Love", "Second Form: Love Pangs", "Third Form: Catlove Shower", "Fifth Form: Swaying Love, Wildclaw", "Sixth Form: Cat-Legged Winds of Love", "Whip-sword"],
   ["Love Hashira", "Demon Slayer Mark"], ("Demon Slayer Mark", "Catlove Shower", "Ooh, this backdrop is SO pretty!"), ("Hantengu clones (Upper Moon Four)", ["Sekido lightning", "Karaku fan gust", "Aizetsu spear", "Urogi sonic", "Zohakuten wood dragons"]),
   ["Kyaa! New theme!", "Strong and cute. Pick both.", "Five backdrops? Make it six!", "That color makes my heart race."], "#2a2a30 #3a8a3a #ff8ac0"),
}
for w in R['wings']:
    for i, f in enumerate(w['fighters']):
        if f['name'] not in S: continue
        n, show, mv, forms, pk, dm, qs, col = S[f['name']]; top, pants, hair = col.split()
        w['fighters'][i] = {**f, "id": n.lower().replace(" ", "_"), "name": n, "show": show, "replaces": f['name'], "moves": mv + ([pk[1]] if pk[1] not in mv else []), "forms": forms, "finisher": pk[1],
            "peak": {"form": pk[0], "move": pk[1], "quip": pk[2]}, "dummy": {"name": dm[0], "why": "canon opponent", "moves": dm[1], "honest": False}, "quips": qs, "confidence": "high",
            "colors": {"top": top, "pants": pants, "hair": hair}}
json.dump(R, open('roster3.json', 'w'), indent=1, ensure_ascii=False)
print(sum(1 for w in R['wings'] for f in w['fighters'] if f.get('replaces')), "swapped")
