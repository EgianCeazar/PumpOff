# PumpOff

Live 1v1 exercise battles: see your opponent on video while the app counts both players' reps, then climb the leaderboard. Think FaceTime plus a rep counter.

PumpOff grew out of [FlexOff](https://github.com/EgianCeazar/Flex_Off), a bodybuilding pose practice app. Pose judging turned out to be unreliable with webcam pose models, while rep counting uses large joint movements those models track well.

## Platforms

1. **Android** (first)
2. **Web** (second)
3. **iOS** (later)

## Repo layout

```text
PumpOff/
├── packages/
│   └── core/          # Shared rep counting, form checks, recordings (web, Android, server)
└── apps/
    ├── web/           # Web app (planned)
    └── mobile/        # Android app with Expo + React Native (planned)
```

## Planned stack (free tiers only)

| Piece | Choice |
| --- | --- |
| Phone app | Expo + React Native, Android first |
| Camera and pose | VisionCamera + MediaPipe pose |
| Live video | Peer-to-peer WebRTC, free TURN relay as fallback |
| Accounts, leaderboards, signaling | Supabase free tier |
| Ranking | Elo rating |
| Builds | Android Studio + Gradle locally |

## Roadmap

1. **Web rep counter prototype**: push-ups and squats, tuned with recorded sets. *(in progress)*
2. **Android MVP**: one exercise, friend battle by invite link with live video, result screen, sign-in.
3. **Leaderboards**: personal bests, match history, friends and weekly boards.
4. **Ranked play**: Elo, matchmaking, server-side rep verification.
5. **Polish and growth**: more exercises, seasons, badges, iOS.

## Development

Requires Node.js LTS.

```bash
npm install
npm test
```

## How rep counting works

`@pumpoff/core` tracks one joint angle per exercise (elbow for push-ups, knee for squats) using the side of the body facing the camera. A rep counts when the angle drops from the top position, reaches the required depth, and returns to the top. Reps that are too shallow, too fast, or break a form rule are rejected with a reason.
