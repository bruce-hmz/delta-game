# TODOS

## P1 — Must do before launch

### Server-side monetization enforcement
- **What:** Move all ticket, booster, battle pass, and cosmetic logic from localStorage to server-side API + DB.
- **Why:** Current client-side enforcement is trivially exploitable. Any user can give themselves unlimited tickets via DevTools.
- **Effort:** M (human: 3 days / CC: ~30min)
- **Status:** PARTIAL — ticket enforcement, auth, and gacha API are server-side. Boosters, battle pass, and cosmetics remain TODO.

### Sound design overhaul for gacha pulls
- **What:** Frame-perfect sound timing matching CS:GO case opening rhythm (tick-tick-tick-BANG). Sound is 50% of the dopamine hit.
- **Why:** Current sound system is functional but not designed for the gacha rhythm. The viral thesis depends on the pull FEELING right, and sound is half of that.
- **Effort:** S-M (human: 2 days / CC: can't do this — needs human ears)
- **Status:** TODO

### Test suite — server-side pull logic
- **What:** Unit tests for drop rate calculation, ticket enforcement, pull deduplication, collection integrity. Integration test for full pull cycle.
- **Why:** Zero tests exist. Drop rate calculation is the core game logic. If it's wrong, the product is broken.
- **Effort:** S (human: 1 day / CC: ~15min)
- **Status:** DONE — 103 tests passing (60 gacha + 43 extraction game). Covers drop rates, pull logic, ticket enforcement, map generation, fog of war, move validation, evacuation, auth HMAC verification.

## P1 — Must do before launch

### Crate illustrations (3 crates)
- **What:** Create 3 distinctive crate illustrations: Military (standard), Supply Drop (premium), Black Market (high risk). Each visually distinct with tactical/military theme.
- **Why:** The crate is the main visual anchor and the tap target. Decision from design review: 2D illustrations chosen over CSS-only for brand differentiation.
- **Pros:** Professional feel, brand recognition, shareable imagery.
- **Cons:** Needs design work or AI generation + human curation.
- **Effort:** M (human: ~1 day / CC: ~15min AI-assisted + human curation)
- **Depends on:** Crate type finalization (3 types confirmed)
- **Status:** TODO

### Item illustrations (30 items)
- **What:** Create 30 unique item illustrations (6 per quality tier). White: ammo, medkits, vests. Blue: scopes, suppressors. Purple: nano-repair, exoskeletons. Red: quantum processors, plasma drives. Gold: ancient artifacts, stellar cores. Military/tactical theme.
- **Why:** Decision from design review: unique art per item. The loot card is the reward moment. Without art, cards are text-only, which undercuts the gacha dopamine hit.
- **Pros:** Every pull feels distinct. Collection gallery is visually rich. Share cards look professional.
- **Cons:** 30 illustrations is significant work. AI-assisted generation accelerates but needs curation.
- **Effort:** L (human: ~3 days / CC: ~1h AI generation + human curation)
- **Depends on:** Item name finalization (EQUIPMENT_NAMES in constants.ts)
- **Status:** TODO

## P2 — After launch, before scale

### Create DESIGN.md formal design system
- **What:** Extract theme tokens, quality colors, typography scale, spacing system, component inventory, and usage rules from the plan into a standalone DESIGN.md file.
- **Why:** Design specs are currently embedded in the implementation plan. Without a formal design system document, every new screen requires ad-hoc decisions and multiple implementers will apply the military theme inconsistently.
- **Pros:** Consistent visual language across all screens. Reusable reference for future features.
- **Cons:** ~30 min to write properly.
- **Effort:** S (human: ~2h / CC: ~30min)
- **Context:** Design review (2026-04-15) added detailed specs for 7 screens, interaction states, responsive breakpoints, and accessibility. These should be formalized.
- **Status:** TODO

### Frontend automated test strategy (Playwright)
- **What:** Set up Playwright for E2E testing of canvas animation, MediaRecorder clip capture, Safari PNG share card fallback, audio timing, and haptic patterns. Define visual regression strategy for loot reveal quality effects.
- **Why:** The plan only defines backend unit tests. Frontend critical paths (animation, sharing, haptics) have zero automated coverage. These are the core product, bugs here are visible to every user.
- **Pros:** Catch visual/audio regressions automatically. Prevent share pipeline breakage across browsers.
- **Cons:** Canvas and MediaRecorder testing requires browser emulation. ~1 day setup effort.
- **Effort:** M (human: ~1 day / CC: ~30min setup)
- **Context:** Outside voice (eng review re-run) flagged this as a gap. 5 E2E scenarios defined in test plan but no automated strategy for visual/audio testing.
- **Depends on:** Phase 3 frontend implementation
- **Status:** TODO

### Offline pull queue
- **What:** Queue failed pulls locally when network is unavailable. Auto-retry when back online. Show cached animation while waiting.
- **Why:** Chinese subway riders lose signal frequently. Without offline support, pulls fail silently and users leave.
- **Effort:** M (human: 1 day / CC: ~15min)
- **Depends on:** Server-side pull API
- **Status:** TODO

### WeChat mini-program wrapper
- **What:** Wrap the gacha loop in a WeChat mini-program shell for secondary distribution. Handle API restrictions (no MediaRecorder, no vibration, limited canvas).
- **Why:** WeChat is the secondary distribution channel per design doc. Need graceful degradation for restricted APIs.
- **Effort:** M (human: 3 days / CC: 30min boilerplate, human for WeChat SDK)
- **Depends on:** Core gacha loop
- **Status:** TODO

### Performance optimization for low-end Android
- **What:** Particle pooling, canvas resize debouncing, bundle size audit, lazy loading for non-critical components.
- **Why:** Target users are on mid-range Android phones. Current particle system creates new arrays every frame.
- **Effort:** S (human: 1 day / CC: ~15min)
- **Status:** TODO
