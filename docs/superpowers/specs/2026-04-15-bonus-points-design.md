# Bonus Points — Patta Logo Design Spec

## Overview

A Patta logo scrolls across the screen at each level transition. If the ball overlaps the logo when the player kicks, they earn +10 bonus points. Bonus points add to the leaderboard score but don't affect difficulty.

## Trigger

The logo appears at each level transition (scores 30, 70, 120) — after the "NEXT LEVEL" banner fades out. One appearance per level-up, 3 possible per game.

## Movement

- Logo scrolls left-to-right at a fixed height near the hit zone center (`ZONE_CENTER_Y_BASE`)
- Takes ~3-4 seconds to cross the full screen width
- Fades in over 0.5s at the left edge
- Fades out over 0.5s at the right edge
- Uses the existing `assets/patta-logo.png` asset

## Hit Detection

On each kick (inside the `kick()` function when `state === "playing"`), check if the ball's bounding box overlaps the logo's bounding box. If yes:
- Add 10 to `bonusScore`
- Remove the logo immediately (set it inactive)
- Show visual feedback

## Score Separation

Two score concepts:
- **`baseScore`** — increments by 1 per kick. Used for difficulty calculations (zone shrink, bob speed, level thresholds, grace period check). Replaces the current `score` variable in all difficulty logic.
- **`displayScore`** — `baseScore + bonusScore`. Shown on screen during gameplay, shown on game over, submitted to the leaderboard.

The `score` variable becomes `displayScore` for display/submission purposes.

## Visual Feedback on Hit

- **"+10" text** — pops up at the ball's position, Patta orange color (#FF6B00), scales up from 1x to 1.5x and fades out over 0.8 seconds. Drawn on canvas.
- **Particle burst** — 12 particles in orange (#FF6B00) and blue (#0051E8) colors, same physics as existing kick particles but with bonus colors.

## State Variables

```
let bonusScore = 0;
let bonusLogo = { active: false, x: 0, y: 0, alpha: 0, hit: false };
let bonusText = { active: false, x: 0, y: 0, alpha: 0, scale: 1 };
```

## Files Modified

- `app.src.js` — all gameplay logic changes (score separation, logo rendering, hit detection, visual feedback)
- No HTML/CSS changes needed (all canvas-rendered)
- No API changes needed (`displayScore` is submitted as the score, server doesn't know about the split)

## Edge Cases

- If the player doesn't kick while the logo is on screen, it simply scrolls off — no penalty
- The logo only appears once per level transition, not repeatedly
- If the player dies before the logo finishes scrolling, it disappears with the game state reset
- `resetGame()` resets `bonusScore` to 0 and `bonusLogo.active` to false
