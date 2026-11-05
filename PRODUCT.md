# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The web app (`apps/web`) ships today as a phone-first site. An Android app (Expo + React Native, `apps/mobile`) is planned and will share this product record; iOS comes later.

## Users

- **Primary: competitive people.** They care about rankings, beating others and their own personal bests. They want a count they can trust and numbers they can compare.
- **Close behind: the owner's friends** who train at home and will battle each other once 1v1 battles exist.
- **Also important: home-workout beginners** doing bodyweight training who want honest rep counts and simple feedback on form.

The job: do a set of push-ups, squats, lunges, sit-ups or a plank, have the camera count it honestly, save it, and see whether they are getting better.

## Product Purpose

PumpOff is equal parts fitness tracker and ranked exercise battles. Today the solo tracker exists: the camera counts reps live, rejects reps that are too shallow, too fast or break a form rule (with the reason), and logs every set offline. History lists past workouts; Progress shows streak, weekly totals, clean-rep rate, personal bests, a weekly chart per exercise, the most common mistakes, and backup/restore.

Later: live 1v1 video battles with friends (peer-to-peer WebRTC), leaderboards, and ranked play with Elo and server-side rep verification.

Success: people trust the count enough to compete on it, come back to beat their bests, and eventually challenge each other.

## Positioning

The count is strict and explained. A rep only counts when the tracked joint goes from the top position to the required depth and back; every rejected rep says why. That honesty is what makes rankings and battles fair, and it is the thing a generic workout timer or log cannot claim.

## Operating Context

- **The phone is propped up 1–2 m away** (against a wall or a bag, on the floor) during a set. The person glances at it mid-rep, so the live count, timer and feedback must read from a distance and at a glance. Hands are busy; taps happen between sets.
- Between sets the person is close to the phone: they save the set, start a 60 s timed set, check today's workout, and finish the workout.
- History and Progress are read up close, usually after a workout.
- Mostly tested on an Android phone through the live site (https://egianceazar.github.io/PumpOff/). Desktop use exists but is secondary.
- Lighting varies (home rooms, evenings), and the camera feed fills much of the Workout screen.

## Capabilities and Constraints

- Exercises: push-ups, squats, lunges, sit-ups (rep counted) and plank (hold timer). Free sets, 60 s timed sets with a 3 s countdown, reset, front/back camera switch, and "Record a set for tuning" (exports body-tracking frames, not video).
- Pose tracking runs on the device with MediaPipe in the browser. No video is uploaded; this is a promise to keep.
- Workouts are stored offline in the browser (localStorage key `pumpoff.log.v1`). Backup is a downloadable JSON file; restore merges and never deletes.
- Shared logic lives in `packages/core` (rep counter, plank timer, workout log, stats) and is reused by the future Android app and server.
- Budget is $0: free tiers only (GitHub Pages, Supabase free tier, free TURN relay), no paid fonts, assets or services.
- Must work at 375 px phone width.
- Undecided: account sign-in, battle flow, ranking display, and leaderboard design (planned, not built).

## Brand Commitments

- Name: **PumpOff** (grew out of FlexOff, a bodybuilding pose practice app).
- Voice: **a plain, direct coach.** Short, honest feedback with the reason ("Not counted: go lower"). No hype, no exclamation-heavy cheerleading, no trash talk.
- Sentence case everywhere.

## Evidence on Hand

- Working rep counter, workout log and progress stats in the live web app.
- 54 node tests in `packages/core`, including recorded-set fixtures in `packages/core/test/fixtures`.
- No users, testimonials, rankings, press or usage numbers exist yet. Do not invent any.

## Product Principles

1. **The count is the product.** Anything that makes the live count, timer or rejection reason harder to read from 2 m away is wrong.
2. **Honest over flattering.** Show rejected reps and their reasons as plainly as counted ones; never inflate numbers.
3. **Numbers you can compare.** Bests, weekly totals and clean-rep rate are presented so they can be compared week to week and, later, person to person.
4. **Private by default.** Tracking stays on the device; nothing leaves it unless the person exports it or, later, joins a battle.
5. **Free to run.** Every choice must fit a $0 budget.

## Accessibility & Inclusion

- Live feedback must be legible at a distance and over a busy camera image: large, high-contrast numerals and short messages.
- A high-contrast theme is required alongside dark and light.
- Respect reduced-motion preferences; motion only for state changes and guidance.
