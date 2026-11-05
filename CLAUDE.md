# PumpOff

Product facts live in [PRODUCT.md](PRODUCT.md). The visual system, once recorded, lives in `DESIGN.md`. For UI work, use the impeccable skill in `.claude/skills/impeccable`.

## Aesthetic rules (every UI change must follow these)

- **Typography:** never Inter, Roboto, Arial or default system stacks. Use a distinct, purposeful pairing.
- **Color and theme:** no purple-to-indigo gradients. Use a restrained, single-tinted neutral ramp, high-contrast text roles, and one accent used sparingly.
- **Layout:** no generic hero → 3 cards → testimonials pattern. Respect real dashboard proportions.
- **No decoration for its own sake:** no decorative blobs, glowing orbs or shadow-heavy cards. No emoji icons; use a uniform line-icon set (like Lucide) or pure typography.
- **Text:** tabular numbers and sentence case. No wide-tracked ALL-CAPS micro-labels.
- **Motion:** no `transition-all` and no bouncy loops. Animate only state changes or guidance.

## Working on the web app

- Must work at 375 px phone width; the phone is usually propped 1–2 m away during a set, so live numbers must read from a distance.
- Anything saved per device (like the theme) goes in localStorage wrapped in try/catch.
- Workout data is in localStorage under `pumpoff.log.v1`.
- Run `npm test` and `npm run build` before opening a PR. Pushes to `main` deploy to GitHub Pages.
- Work on a branch and open a PR; the owner approves each merge.
