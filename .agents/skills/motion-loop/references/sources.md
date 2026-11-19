# Where this comes from

The loop is a translation: the practices people worked out for making code-rendered motion graphics with Claude (late 2026), carried over to an animated game that runs live. The claims below are the sources' own; the numbers in [numbers.md](numbers.md) are the ones several of them agree on.

## The two posts this started from

- **Rexan Wong, "how to generate pro level motion graphic videos w/ opus"** (x.com/rexan_wong/status/2103707054108299437). Six steps: direct from a reference instead of describing a style; give the model a renderer so every frame is exact; use real components instead of invented ones; hand over the brand, real screenshots and a brain-dump and ask for three storyboard variants; approve one still per scene before anything moves; then give notes like a director, in camera words. "Everyone has the same model. The context you give it is what makes it look pro."
  - *Here:* the brief names a reference; three variants for hero moments; poses and the rest frame before motion; director's notes ([brief.md](brief.md)).
- **rivvian, a list of 20 motion tools** (x.com/0xrivvian/status/2123019268933493062): LottieFiles' motion design skill, Motion's AI kit, Remotion's skills, Hairline, Anatomy, Blender agents, Three.js, React Three Rapier, React Postprocessing, three.quarks, Tweakpane, GSAP, Remotion, Manim, Lottie, Openverse, librosa, WhisperX, FFmpeg. "Easing → 3D → physics → sound → captions → export."
  - *Here:* the three that are about craft rather than video plumbing were read in full and folded in (below). The rest are tools for rendered video and 3D; NShapes needs none of them, because its renderer is the game itself.

## What those posts point to

- **clayo, "Opus 5.5 Motion Design: The Complete Playbook"** (x.com/0xclayo/status/2111079749342675440). The backbone of this skill. Its twelve rules, in this repo's terms:

  | Playbook rule | Here |
  |---------------|------|
  | Ask for a program that draws frames, not a video | The game already is one; the capture tool turns it into frames |
  | Every frame is a pure function of time | A virtual clock: the capture decides what time it is |
  | Replace adjectives with numbers | The brief and the feelings-into-numbers table |
  | Ban the defaults by name | The banned list in [critique.md](critique.md), which grows with each review |
  | Give it a reference | REFERENCE line of the brief |
  | Name the engine and the canvas first | Fixed here: Reanimated, a 390 × 844 phone |
  | Count in frames | 16 ms frames in every report and note |
  | Use springs, not linear moves | `SPRING` tokens read by damping ratio; the LINEAR hint |
  | One hero move per shot | Staging score; HERO line of the brief |
  | Render stills and look before the full render | Contact sheet and strip before any claim; the rest frame first |
  | Write follow-ups in frames, not feelings | The note format |
  | Loops: frame N−1 must flow into frame 0 | The loop seam check |

  Also from the playbook: the critique prompt and what an 8 out of 10 means, the principles-as-numbers table, the symptom → fix table, "a sound lands on its frame or one after, never before", "effort and direction substitute for each other", and the receipts (the pieces that went viral took 3 prompts to 163 model calls: "iteration isn't a failure of the method, it is the method").
- **seeco, "What the viral one-prompt videos are hiding"** (x.com/seeconvm/status/2106096193235259564): judge only the rendered frames; list the three worst defects with a timestamp, the evidence and a local fix; give each class of object its own motion rule; keep the decisions in files so the next run starts from them; gates for long unattended runs; "wrap all of this into a skill and the course shrinks to one line".
- **Florence, "Opus 5.5 Motion Lab"** (x.com/flxrnc/status/2105311836190978392): every follow-up printed. The note pattern (what it reads as + measured evidence + exact numeric change), onion skins and speed graphs, changing one number at a time, adding each fix that works to the house rules.
- **zero (@twoclipping), the UI-morph prompt** (x.com/twoclipping/status/2103273003555402193): a state list instead of a description; springs as closed-form functions of time; text inside a changing container gets its own enter and exit timing.
- **Thariq** (x.com/trq212/status/2102870353781641416): "the post: 'Claude one-shot this'. the prompt: 10k characters with good takes plus skills, examples and API keys."

## The skills and kits that were read

- **LottieFiles motion-design-skill** (github.com/LottieFiles/motion-design-skill, MIT): durations by element, overshoot by meaning, distance scaling, the one-third rules, the three layers (primary, secondary, ambient), the quality checklist by severity.
- **Motion ai-kit** (github.com/motiondivision/ai-kit): springs for anything that can be interrupted; describe a spring by bounce and felt duration; time neighbours off the duration you asked for; "do not add animation only for decoration"; reduced motion keeps opacity and colour.
- **Remotion skills** (github.com/remotion-dev/skills): no CSS transitions in frame-driven animation; clamp every interpolation.
- **HeyGen HyperFrames** (github.com/heygen-com/hyperframes): the checks worth copying: effects start on the frame that causes them, a pause before the climax, matched-speed hand-offs and no crossfades, liveness and dead-stretch detection, text hold times, "a passing check does not show how it looks".

## What was left out, on purpose

Rules that only make sense for a rendered file: the one-HTML render contract, GIF frame delays, export sizes, LUFS mastering, motion blur from subframes, camera lenses. And two that conflict with a game: HyperFrames bans idle breathing as filler (in a game a quiet idle is life; it is only banned as a way to hide an empty beat), and video durations (400 ms moves, 750 ms heroes) are too slow for something seen forty times a fight.
