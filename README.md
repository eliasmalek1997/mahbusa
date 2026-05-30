# Mahbusa

Play Lebanese backgammon (Mahbusa) together from anywhere — no sign-up required.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the app runs in **local mock mode** — open the game link in a second browser tab to play both sides on one machine.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

If both variables are empty the app silently falls back to mock mode (no persistence).

## Supabase setup

1. Create a free project at https://supabase.com
2. Open the SQL Editor and run `supabase-schema.sql`
3. Go to **Database → Replication** and enable the `games` table for realtime
4. Copy your project URL and anon key into `.env.local`

## Local testing (two-player on one machine)

1. `npm run dev`
2. Open http://localhost:3000 → Create Game
3. Copy the game URL from the waiting screen
4. Open that URL in a **private/incognito window** or a second browser profile
5. Enter a name and join — the game starts

## Running tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

## Vercel deployment

1. Push this repo to GitHub
2. Import the repo in Vercel
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project settings
4. Deploy

## Project structure

```
app/
  page.tsx                  Landing / create-game page
  game/[roomCode]/page.tsx  Game room

components/
  Board.tsx       Main board + interaction logic
  Point.tsx       Single board point with checkers
  Checker.tsx     Individual checker token
  Dice.tsx        Dice face rendering
  MoveLog.tsx     Scrollable move history
  PlayerPanel.tsx Player name + turn indicator

lib/game/
  types.ts        All types + RULESET config object
  initialState.ts initializeGame, serializeGameState, validateGameState
  rules.ts        rollDice, getLegalMoves, applyMove, canBearOff, endTurn, …
  scoring.ts      computeScore, getCheckersRemaining

lib/supabase/
  client.ts           Supabase client (mock-aware)
  gameRepository.ts   createGame, getGame, joinGame, updateGameState, subscribeToGame

tests/
  rules.test.ts   31 unit tests for the rules engine
```

## TODO / future improvements

- **Family rule variants** — different starting positions, no-pinning mode, enter-from-bar
- **Rematch** — restart with the same players
- **Match score to 31** — full match play across multiple games
- **Spectator mode** — watch a live game
- **Chat / voice notes** — in-game communication
- **Animated checker movement** — smooth slide transitions
- **PWA install** — Add to Home Screen on iPad
- **Sound effects** — subtle dice roll and checker sounds
- **Reconnect indicator** — show when opponent drops
- **Turn timer** — optional countdown per turn
