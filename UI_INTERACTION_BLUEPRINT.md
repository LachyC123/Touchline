# TOUCHLINE! — detailed mobile UI and tactile feel blueprint

This file defines the **look, layout and input behaviour** expected from Claude. It is a specification, NOT a substitute for visual iteration. The app must look authored, not like a basic web admin dashboard or a literal Clash Royale clone.

## 1. Device and composition

Primary reference: portrait 390x844 CSS px, safe areas top/bottom. Design at 360px too. Single-thumb lower-screen actions, with text kept readable. Do not shrink an entire desktop dashboard to fit mobile. Interactions should work both via tapping and dragging; important actions are never gestures-only.

A consistent 8-point rhythm with 4-point subunits, chunky clickable items, characterful beveled buttons, typography hierarchy and roughly 44+ CSS px touch targets. Stadium-themed graphic overlays should support, not smother, football info. Use semantic DOM for menus, number labels and accessibility; game canvas remains an immersive focus area.

## 2. Visual wireframes (not pixel-perfect)

### Club hub

```
╭────────────────────────────────────╮
│ [crest] TOUCHLINE!     430 ●  L3  │  <= HUD resources
│  HARBOUR PARK · DIVISION FOUR      │
│                                    │
│     ^ banners  / floodlights       │
│   [🏟 layered stadium hero]         │
│  [Training]    [Scouts]            │  <= illustrated hotspots
│        [Clubhouse]                 │
│                                    │
│ ┏ NEXT MATCH ━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ VS IRONBRIDGE UTD        [>]  ┃ │  <= dominant CTA with rivalry
│ ┃ 6th place · local derby        ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│ LATEST: MILO SCORES ON HIS DEBUT   │
│ [Club] [Squad] [Play] [Scout] [⋯] │
╰────────────────────────────────────╯
```

The illustrated background responds to upgrades: a newly painted fence should be visually different from old chipped paint, not merely labelled “LEVEL 2”. Animate 2–4 environmental loops sparingly.

### Collection player card

```
╭─────────────────────────╮
│  61                FW ↗ │
│   ╭───────────────────╮ │
│   │  EXPRESSIVE        │ │
│   │    PLAYER         │ │
│   │   PORTRAIT        │ │
│   ╰───────────────────╯ │
│     MILO SERRANO        │
│     FEARLESS DRIBBLER   │
│  PAC 68   PAS 44        │
│  SHO 58   DEF 17        │
│ [Rocket Start] [★ x1]  │
╰─────────────────────────╯
```

Cards shouldn't all be a block of identical flat colour. Tier changes silhouette/embossed frame and secondary light; kits match the user's club colours; portrait is recognizable outside the card. For screen-readers use text label including name, OVR, position and trait. Provide favourite indicator that never covers stats.

### Player detail

```
[Back]       PLAYER PROFILE        [★]
    [large animated HERO CARD]
      GROWTH: LV 3  [████░░░] 71/120
[UPGRADE AVAILABLE]  [CUSTOMISE]
┌ OVERVIEW ─ TRAINING ─ STORY ─ STATS ┐
│  Big-game nerves  [short explanation]│
│  Confidence 74       Age 19         │
│  Dream: Score in a final           │
│  Recently: First senior goal!      │
└─────────────────────────────────────┘
```

The player card must never be buried among developer-y numeric tables. Provide expanded stats separately with why each matters. Upgrades show a preview of changed stats, potential, currency price and trained focus **before** committing.

### Squad / lineup

```
CLUB XI         TEAM POWER 56.8   [EDIT]
         [FW]        [FW]
         [MID]       [MID]
         [DEF]       [DEF]
                 [GK]
──── BENCH ──────────────────────────
[mini CARD] [mini CARD] [mini CARD]
[FORMATION 2-2-2 ∨]  [SAVE LINEUP]
```

Display on a miniature pitch (not plain lists) and animate selected card travelling to spot. Out-of-position option gets subtle warning flag and tooltip. A helpful auto-lineup exists, but player keeps agency. Formation changes transform positions elegantly rather than suddenly snapping unlabelled circles.

### Match

```
╭──────────────────────────────────╮
│ [HOM]  2  —  1  [AWY]      77'   │
│ Last chance to hold this lead!   │
│  ╭────────────────────────────╮  │
│  │      GREEN PITCH           │  │
│  │          ⚽              │  │
│  │       7v7 MINI PLAYERS     │  │
│  │     CONTINUOUS ACTION      │  │
│  │                            │  │
│  ╰────────────────────────────╯  │
│  [PRESS] [GO WIDE] [QUICK PASS]  │
│  [TACTICS]       [PAUSE / SKIP]  │
╰──────────────────────────────────╯
```

No tactical menu shall obscure the score without a clear close button. Inputs must feel instant even when waiting for the sim to apply them; an on-screen “PRESSING ↑ for 12'” banner confirms activation. Footballers animate passes/tackles with precise effect positions. Ball stays larger/brighter than tiny field markings, not floating off-screen.

### Pack opening

```
[ SCOUT'S DESK ]               [SKIP]
       ╭───────────────────╮
       │   CLUB CREST      │
       │   SCOUT PACK      │  <- physical envelope
       │   TEAR TAB  >>>   │
       ╰───────────────────╯
[Swipe or tap to open]
       [ reveal -> player card ]
[WELCOME TO THE CLUB]  [VIEW PLAYER]
```

Make the physical tear interaction feel good while supporting a one-tap open. Outcomes pre-committed to storage. Reveal animation does not block saving.

### Full time

```
             FULL TIME!
     HOME  3   —   2  AWAY
  [Cheers / crest / confetti]
     PLAYER OF THE MATCH
       [hero card + rating]
+120 COINS  +53 CLUB XP  +40 PLAYER XP
         [reward trackers]
 [TRAIN MILO]        [NEXT MATCH]
```

Score, winners, achievements and rewards must be real, not random counters. Trophy-level celebrations are restricted to milestone victories, otherwise a normal win gets a smaller satisfying scene.

## 3. Motion system (approximate initial values)

| Input/event | Duration | Principles |
|---|---:|---|
| Button down/up | 75/130 ms | Press in, release overshoot; never delay actual click |
| Card pick-up/snap | 120/180 ms | Lift + shadow, spring into slot; source/target highlight |
| Tab change | 160–230 ms | Subtle lateral slide with colour/state continuity |
| Stat +1 or +3 | 350–600 ms | Number count and one sparkle, respect reduced motion |
| Coin claim | 450–900 ms | Number moves up and small visual coin trail |
| Pack tear | 250–500 ms | Layer peel and sound; one-tap equivalent |
| Card reveal | 350–1200 ms/tier | Tier-specific but user-skippable |
| Goal | 800–1600 ms | Impact pause, goal banner, crowd surge, replay entry |
| Player celebration | 800–1300 ms | Expression/pose linked to identity |

Animations are measured *after* verifying usability: no tween should prevent another menu from being opened unless the state would become invalid. Use stable controls while animations complete.

## 4. State and feedback specifications

For each important interactive component implement **idle, pressed, focused, disabled with reason, loading if applicable, success, error and reduced-motion variants**.

**Upgrade button:** cost and attribute preview visible; disabled if funds insufficient and points to ways to earn, rather than a generic grey bar. On success, card number visibly changes, button reflects new cost, history logs exact upgrade.

**Player cards:** newly recruited has a discrete “NEW” sticker until inspected, favourite has a star, lineup member has a shirt icon, training-active has a cone, injured has a clear medical cross if injuries added later. Use at most 2–3 overlays simultaneously and keep name visible.

**Reward claim:** an interrupted transaction resumes with “Rewards secured” and a View button; repeated taps don't duplicate. Screen readers get a concise confirmation without announcing 15 particle objects.

**Offline warning:** small friendly indicator when service worker or storage unavailable. Explain offline saves; never obscure Play button needlessly.

## 5. Stadium and hub authored spatial composition

Hub world should look intentionally placed. Design a small plot in layers:
1. **Foreground access road** with club sign, kerb, lamp and bicycle/fan crossing occasionally.
2. **Stadium focal midground** central large silhouette, turnstiles and ticket board.
3. **Training pitch** behind left side, cones and 2-3 footballers practising.
4. **Scouting hut** nearer right, posters and noticeboard.
5. **Clubhouse/trophy room** beside stadium terrace; cafe table and banners.
6. **Background skyline** modest houses, trees, distant floodlights with consistent perspective.

Each hotspot has enough breathing room and a visible label on interaction. Upgrades change the actual site: dirt patch -> green lines -> floodlit mini pitch; ragged ticket hut -> signage -> sleek scouting office; small terrace -> roofed stand -> full local stadium. Crowd/flags respond to big match conditions. Use consistent shadow angles and authored colour balance. Avoid placing random prop assets without a purpose.

## 6. Visual testing storyboard

At every phase capture at least these reference states: ordinary hub; hero card at Street and Star tier; lineup; mid-match open play; in-match goal; full time; pack tear and rare card reveal; training success; first facility upgrade; empty packs; offline warning.

Review side-by-side for consistency: recognisable fonts, same light direction, same icon line weight, same card geometry and no inconsistent gradients. Ask whether a player would recognise the same character without reading their name.
