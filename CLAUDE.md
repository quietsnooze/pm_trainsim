# pm_trainsim — a virtual model train set

## Vision

A 3D **miniature model train set** that runs in the browser, designed first for
Safari on iPhone and iPad (desktop browsers work too). The feel we're after is
a tiny physical set — think T-gauge — sitting on a baseboard: you're looking
*at a model*, not standing inside a life-size world. A small oval of track, an
LNER A4 **Mallard** (garter blue) pulling a couple of coaches, and simple
hands-on controls.

Near-term scope: basic train driving (throttle + direction) and points.
Longer-term: swappable track layouts and trains.

## Tech stack

- **Three.js** for rendering, **TypeScript** (strict) for everything, **Vite**
  for dev/build, **Vitest** for tests.
- **No UI framework.** The controller UI is plain DOM/CSS overlaying the
  canvas. Keep it that way unless the UI genuinely outgrows it.
- **Procedural geometry only** for now — trains, track, and scenery are built
  in code, no downloaded GLTF assets. Low-poly and charming beats
  photorealistic and heavy.

## Commands

```
npm run dev       # dev server (add -- --host to test from a phone on the LAN)
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build
npm test          # vitest (track geometry math, etc.)
```

## Architecture

Three layers, kept separate so each can evolve independently:

1. **Sim** (`src/sim/`) — no Three.js imports. The track is a *parametric
   path*: straights and arcs composed into a closed loop, addressed by
   arc-length `s`. Trains hold `s`, speed, and direction and advance along the
   path each tick. This abstraction is load-bearing: points/turnouts become a
   choice between path branches, and new layouts are just new segment lists.
2. **Scene** (`src/scene/`) — Three.js meshes built *from* sim data: baseboard,
   procedural rails/sleepers along the path, train bodies posed by sampling the
   path. Rendering reads sim state; it never owns it.
3. **UI** (`src/ui/`) — the controller (throttle, direction, point levers).
   Talks to the sim through small explicit interfaces, not by reaching into
   scene objects.

`src/main.ts` wires the three layers together and runs the render loop.

## Mobile-first rules

- Touch is the primary input; everything must be operable with one thumb.
- `viewport-fit=cover` and safe-area insets so the UI clears the notch/home bar.
- Cap `devicePixelRatio` at 2 when sizing the renderer — iPad GPUs will thank you.
- Target 60 fps on a mid-range iPhone; prefer fewer/merged meshes and cheap
  materials over post-processing.
- Test in real Safari when possible; it has quirks Chromium won't show.

## Conventions

- TypeScript strict mode; no `any` unless there's a comment earning it.
- Sim units are "tabletop metres" (the baseboard is ~1.2 × 0.8). Keep all
  magic dimensions as named constants.
- Unit-test the geometry/sim math (`src/sim/`); don't bother unit-testing
  Three.js scene code — verify that visually.

## Roadmap

- [x] v0 — hello diorama: baseboard, oval track, drivable placeholder Mallard,
      slider controls (play-tested and **locked** — the slider + direction
      toggle stay; see PRD issue #3)
- [ ] v1 — siding/passing loop with working tap-the-track points, proper
      Mallard 4468, sound + big mute
- [ ] later — train picker (Scotsman 4472, Azuma), smoke, more layouts,
      scenery, day/night, eye-level camera, PWA/offline

The full plan lives in PRD issue #3 and its 16 slice issues (#4–#19). The
primary user is a four-year-old: calm, predictable, icon-only, no fail states.
