# WebPoser

A **fully offline** 3D web app for posing artist mannequins (32-joint wooden-figure dolls), staging scenes, animating between keyframes, and exporting PNG stills and MP4 clips as drawing reference.

No accounts, no servers, no downloads at runtime. Everything — the figure geometry, the fonts, the icons, the dictionaries — is generated in code or bundled. Once installed as a PWA, it runs with the network off.

> **Language note:** the app ships bilingual (pt-BR by default, English available), and the project's own documentation is written in Portuguese. This README is the English entry point.

---

## What it does

### Pose

- **32-joint skeleton** modelled on human anatomy — spine, chest, upper chest, neck and head; clavicles, shoulders, elbows (with forearm pronation), wrists; an articulated thumb, a separate index finger and the remaining fingers bending together across three phalanx joints; hips, knees, ankles and foot balls. Every joint carries per-axis min/max limits, so anatomically impossible poses simply cannot be reached.
- **Direct manipulation:** click a joint, rotate it with a gizmo or numeric sliders, or **drag a joint through space** — a CCD chain solver walks up the hierarchy (and can rotate the root itself) to follow your pointer while respecting every limit.
- **Locks and pins.** A locked joint changes for *nothing* automatic — slider, gizmo, keyboard, IK, randomiser, mirror or "apply pose" all obey it. The root can be locked per axis. A **pinned** joint holds its world position: its ancestors and the figure's placement freeze while the joint itself stays free.
- **Live mirror**, sagittal reflection applied as you edit; **pose blending** between two poses; **copy/paste** whole poses or a single limb; **reset by group**; **seat on ground**; **random pose**.
- **A large preset catalogue** — standing, sitting, walking, running, expressive and action poses, martial-arts and dance sequences, plus paired poses that apply to two figures at once — and a **user pose library** saved into the workspace.
- **Up to 5 figures**, each with its own colour, name, visibility and height (scaled proportionally, in real metres).

### Stage

- **Scene props:** six primitives (box, cylinder, sphere, cone, plane, ramp), sized in **metres per axis** (never node scale), up to 20 per scene, with free per-vertex offsets, "rest on ground", hide-on-workbench and lock-from-picking.
- **Neutral environment** with configurable background, ground grid, soft shadows and a per-figure contact ellipse pinned to the floor.
- **A scene camera that is separate from the viewport camera.** The scene camera is an element of the scene, with its own Blender-style gizmo, focal length in millimetres, framing mask, named bookmarks and a "look through the camera" mode. Navigating your workbench never disturbs the shot.

### Export

- **PNG snapshots** at a configurable resolution, written straight into a folder you pick once (File System Access API) with automatic sequential naming (`scene_snap001.png`) whose counter travels with the scene.
- **MP4 video** rendered deterministically frame by frame — not a real-time screen recording — through [`mediabunny`](https://mediabunny.dev) (H.264, falling back to AV1/VP9). Progress and cancellation are real, because the loop yields between frames.
- **Depth-map output** from the scene camera (near light, far dark, linear ramp) as an independent choice per output: screen, PNG and MP4 each decide for themselves.
- Gizmos, ruler, grid and the selected-joint highlight are hidden in every export, so the image and the video show exactly the same thing.

### Animate

- **Keyframes** capture the whole cast (pose, placement, height, colour, visibility) plus the live camera, with the duration in milliseconds of the transition *arriving* at that keyframe.
- Interpolation reuses the existing pose-blend and camera-move maths; non-interpolable properties (name, colour, visibility, height) step rather than blend.
- Timeline scrubbing, playback, onion skinning, a global speed multiplier, a library of ready-made motion clips (solo and paired), and animation import/export as JSON with **cast remapping**.

### Two shells, one core

| Shell | For | Highlights |
|---|---|---|
| **Desktop** | mouse and keyboard, large screen | the full collapsible-column workbench: figures (with the props subsection), properties, camera, animation, snapshots and scenes |
| **Poses module** | finger and small screen | one full-screen viewport at a time across five orthographic editing views (front, back, left, right, top) plus a free navigation view; tabbed control panel that sits at the bottom in portrait and on the right in landscape |

The poses module keeps its own session. Moving work between the two is either a **"bring the other shell's session"** button (same device) or a **QR-code relay** — the session is deflated, chunked and cycled as a sequence of QR frames on the desktop, read by the phone's camera. No network, no cable, no third-party app.

---

## Getting started

```bash
npm install
npm run dev        # development server
```

Then open the printed URL. For a production check:

```bash
npm run build      # tsc -b && vite build
npm run preview    # serves dist/
```

A plain Vite build does not open by double-clicking `index.html` (`file://` blocks ES modules), which is why the app ships as a **PWA**: visit the local server once, install it, and from then on it runs 100% offline in its own window — which also frees up the keyboard shortcuts a browser tab would otherwise reserve.

### Browser support

| Feature | Chromium (Chrome/Edge) | Firefox / Safari |
|---|---|---|
| Posing, scenes, animation preview | ✅ | ✅ |
| Folder picker for snapshots and workspaces (File System Access API) | ✅ | falls back to regular downloads / multi-file selection |
| MP4 export (WebCodecs) | ✅ | detected at runtime; the button is disabled with an explanation if unavailable |
| QR camera capture (`BarcodeDetector`) | ✅ | falls back to the bundled `jsQR` decoder |

Chromium is the recommended target; everything degrades explicitly rather than failing mid-flow.

---

## Commands

```bash
npx vitest run            # the test suite — there is NO `npm test` script
npx vitest run <pattern>  # a single file
npm run build             # tsc -b && vite build
npm run lint              # eslint .
npm run dev               # development server
npm run preview           # built bundle, for browser checks
npm run test:e2e          # Playwright smoke tests for the poses module (separate from the suite)
npm run pose:preset       # converts a saved library pose into a preset block
npm run poses:folha       # contact sheet of the pose catalogue
```

**Nothing is considered done until `npx vitest run`, `npm run build` and `npm run lint` are all clean.** The suite currently sits at **~2,491 tests**, plus 4 Playwright smokes; every delivery records the delta.

---

## Tech stack

- **Vite + React 19 + TypeScript** — static build, relative paths (`base: './'`)
- **three** + **@react-three/fiber v9** + **@react-three/drei** — declarative rendering, `OrbitControls`, `TransformControls`, axis gizmo
- **zustand** (+ **zundo** for undo/redo) — global state
- **react-i18next** — pt-BR (default) and English, both dictionaries bundled; key parity between them is enforced by a test
- **mediabunny** (MPL-2.0) — MP4 muxing and encoding
- **qrcode** / **jsqr** — session relay between devices
- **vite-plugin-pwa** — installable, fully precached offline app
- **Vitest** + **React Testing Library** + **@react-three/test-renderer**, and **Playwright** for the touch-drag paths unit tests cannot reach

---

## Project layout

```
src/figure/       the mannequin: skeleton.ts (32 joints + limits), poses, drag solver,
                  mirror, locks, pins, figureFormat.ts (the single figure reader)
src/animation/    keyframes, sampler, ready-made clips, cast remapping, MP4 export
src/props/        scene objects (6 primitives, metres, free vertices)
src/scene/        viewport, camera rig, gizmos, rendering, depth-map pass
src/layout/       the desktop panels — most of the visible surface lives here
src/poses/        the touch shell: shell choice, orthographic views, tabbed panel,
                  its own session, QR receive
src/store/        zustand slices — figuresStore (with undo), animation, camera, ui…
src/persistence/  workspace files, autosave, serialisation, QR transfer protocol
src/i18n/         pt-BR and en dictionaries
```

---

## Files and persistence

Everything is **JSON**, human-readable and hand-editable, with a `version` field, an embedded `leiame` (readme) block and full sanitisation on read. A workspace is a **folder** you pick, containing one `.json` per scene plus a `workspace.json` manifest. Autosave runs continuously into `localStorage` using the exact same schema.

- **Reserved filenames** in a workspace folder: `workspace.json`, `poses.json`, `joint-limits.json`, `animations.json`, `clips.json`. A scene named "Poses" is written as `poses-2.json` so it can never overwrite your pose library.
- **Units are metres.** The figure is modelled at human scale (1.70 m by default).
- **Persistence is additive** — a new field never bumps the version, and files written by older builds keep opening.
- **A single figure encoding**, read by one module (`src/figure/figureFormat.ts`). Scenes, animations, clips, standalone poses and the pose library all write joints as `{x, y, z}`; the older tuple form is still read, forever.
- **A single path for a figure in a file:** "Pose in a file", in the Properties panel. Its reader accepts the whole family — a pose file, a bare figure, a loose keyframe, an animation, a workspace `animations.json` or a full `scene.json`.
- **Tool state stays out of the file and out of undo:** locks, pins, onion skin, figure shell, ruler, framing mask, panel preferences and depth-map settings.

---

## Non-negotiable rules

These are the constraints the whole codebase is built around. Breaking one by accident undoes work that has already been paid for:

1. **Zero network at runtime.** No font, texture, icon or datum arrives over the wire. External images and data enter only through a local file the user picks.
2. **No external assets for geometry.** The figure and the props are generated in code from 3D primitives — no `.glb`, no `.fbx`, no third-party mesh library.
3. **TDD.** Failing test first, minimum implementation, green. Panel UI included.
4. **No hardcoded UI strings.** Every string is born as an i18n key in both `pt-BR.json` and `en.json`; an automated test enforces parity.
5. **Documentation and code comments are written in Portuguese.** It is the project's working language.

---

## Documentation

The three canonical documents are all in Portuguese, and all three are project record:

| File | What it is |
|---|---|
| [PLANO.md](PLANO.md) | What the app is, its architecture, the figure model, and the single numbered list of improvement proposals (items 1–65, groups A–J) |
| [DECISOES.md](DECISOES.md) | The 106 numbered decisions, each with the narrative of *why*. Indexed at the top |
| [HISTORICO.md](HISTORICO.md) | The delivery log — 89 entries, one per working session, chronological. Indexed at the top |
| [CLAUDE.md](CLAUDE.md) | The agent guide: commands, rules, code map and hard-won invariants |
| [CRIACAO-PRESETS.md](CRIACAO-PRESETS.md) | How pose presets are authored |

Decisions are cited by number (`DECISOES.md` #86); the documents cross-reference each other that way.

---

## Status

Phases 1–13 are complete: foundation, figure, FK posing, camera, snapshots, persistence and PWA, IK, polish, UX refinements, the mini animator, the separate scene camera, animation files, and the depth map — followed by the touch **poses module** and its finishing work (items 43–65). `PLANO.md` holds the open proposals; nothing there is a commitment, it is a menu.
