# RuyiHermesAgent desktop brand

## Product names

- Chinese display name: `如意 Agent`
- International display name: `RuyiHermesAgent`
- Desktop product name: `RuyiHermesAgent`
- Desktop executable: `RuyiHermesAgent` (`RuyiHermesAgent.exe` on Windows)
- Installer: `RuyiHermesAgent Setup`

The underlying `hermes` CLI, `HERMES_*` environment variables, `.hermes`
storage, IPC channel names, deep-link scheme, and application id stay intact.
Those identifiers are compatibility contracts, not visible product branding.

## Visual system

The primary mark is **如意云芯 / Ruyi Cloud Core**:

- deep-sea navy rounded tile;
- jade-cyan ruyi-cloud strokes;
- a small luminous AI core;
- dark overall composition with bright information-bearing details;
- no mascot, wings, caduceus, red seal, cyberpunk clutter, or decorative text.

Core palette:

| Role | Color |
| --- | --- |
| Deep navy | `#061426` |
| Sea blue | `#0B2E59` |
| Technology blue | `#2F8CFF` |
| Jade cyan | `#63E6D6` |
| Restrained warm gold | `#D9B76E` |

The desktop's default `ruyi` theme implements the same dark technology-blue
system. Warm gold is reserved for fine accents; it is not a surface color.

## Source and generated assets

The selected image-generation result is stored at:

`assets/brand/ruyi-agent-icon-keyed.png`

Regenerate all Electron and bootstrap-installer PNG/ICO/ICNS assets with:

```powershell
python apps/desktop/scripts/generate-brand-assets.py
```

The generator validates transparent corners, exact PNG dimensions, ICO size
representations, and real ICNS magic before succeeding.

## Generation prompt

The concept was generated with the built-in image generation tool using this
production brief:

```text
Use case: logo-brand
Asset type: production concept for a desktop application icon and in-app brand mark
Primary request: Create one original symbol for “如意 Agent” based on the concept “如意云芯”: a single elegant Chinese ruyi-cloud silhouette embracing a small AI core, expressing intelligent assistance, calm confidence, and modern Chinese identity.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background outside the icon tile for local background removal
Subject: one centered dark navy rounded-square app tile; inside it, a minimal symmetrical ruyi-cloud mark made from broad jade-cyan and electric-blue strokes, with a small bright cyan diamond/circle AI core at the center.
Style/medium: vector-friendly logo mark, crisp geometric curves, minimal, polished, strong silhouette
Composition/framing: centered; generous safe margin; recognizable at 16px, 32px, and 64px
Color palette: deep navy #07182F, dark blue #0B2E59, jade cyan #63E6D6, technology blue #2F8CFF, tiny restrained warm-gold accent #D9B76E only if essential
Constraints: exactly one icon; no text, Chinese characters, Latin letters, mascot, person, wings, caduceus, mockup, 3D extrusion, or watermark
Avoid: cyberpunk clutter, generic chat bubble, generic robot head, traditional red seal, excessive gold, ornate ancient decoration, tiny details, photographic rendering
```
