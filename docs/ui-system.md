# Lupen UI foundation

Step two establishes a shared interface language without forcing every screen
into the same information layout.

## Screen frame

- Desktop and laptop screens use a maximum 1200 x 700 frame.
- The frame always retains an outer viewport gutter.
- Journey, Trade, Bounty, Pilot, Forge, Store, and Hangar use
  `.lupen-app-screen`.
- Primary page headers use `.lupen-screen-header`.

## Hierarchy

1. Cyan uppercase eyebrow identifies the service or location.
2. Large white uppercase title identifies the current screen.
3. Muted uppercase subtitle supplies only necessary context.
4. The Back action occupies the upper-right position and has a consistent size.

## Shared colours

- Cyan: navigation, selection, focus, and system information.
- Blue: primary actions.
- Green: success, ready, owned, and active states.
- Amber: warnings, costs, cargo, and trade value.
- Red: danger, destructive consequences, and failed states.
- Purple: locked plans, exceptional quality, and future progression.

Ship statistics retain one accent language throughout the game:

- Hull: steel blue.
- Shield: cyan.
- Armor: slate.
- Cargo: amber.
- Jump: blue.
- Evasion: teal.

## Interaction rules

- Every keyboard-focusable control receives a visible cyan focus ring.
- Disabled controls retain their layout and label but lose saturation.
- Scrollable collections use the same compact cyan scrollbar.
- Screen-specific CSS controls information density; shared CSS controls visual
  identity.

## Adoption rule

New full-screen interfaces should use the shared frame and header classes
before adding screen-specific layout. Existing screens are migrated one at a
time to avoid broad regressions.
