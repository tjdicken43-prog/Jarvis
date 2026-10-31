# Where round 3b stopped (2026-10-31 05:30Z, Tj at 93% usage; resume after ~3:40 reset)

Tj's asks this round: mix in Demon Slayer / Solo Leveling for thin side characters (DONE), cross-check moves against the shows (DONE, partial: fandom wikis blocked, Wikipedia used; 18 yes / 50 partial, `sources`+`verified`+`note` per fighter in roster3.json), give 5 more mains a Goku-style peak cutaway (DONE as cine.html ?c=sasuke|gojo|jinwoo|light|vegeta; mp4s rendering via scratchpad recall.sh -> mock/peak-*.mp4), then "build everything else in" = Tj's go to build into the Jarvis page.

Files here: roster3.json (68 fighters), cine.html (peak engine, needs chars.js), factory3.html (floorplan, roster inlined), brain3.html + brain-mesh-90.js (brain from a 4.2 MB packed mesh instead of the 12 MB GLB; pack.py makes it), peak.py / swap.py (roster generators).

Next steps:
1. brain3.html throws "Cannot access 'T' before initialization": the loader now runs synchronously, before the tract table `T` is declared. Fix: call the IIFE after build() helpers are defined (move it to the end of the module).
2. Build into Jarvis (branch claude/project-thread-u8qgir): hud/src/brain-mesh.js, hud/src/grounds.js (factory3 as the FACTORY overlay, peak cutaway played live from cine.html logic when a fighter hits their peak), home ball -> brain (scene.js). Extend build_brain.py write_artifact to inline the new modules (same import-stripping as the vault). Page size check: brain mesh 4.2 MB, keep total under 16 MB.
3. Test, PR, merge, republish the Jarvis page (same link), tell Tj.
