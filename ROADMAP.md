# Mafia Role Distributor: Roadmap

A web-based role distribution platform for Mafia-style party games. One person hosts a room, everyone else joins from their own phone with a 4-letter code, and each player privately sees their role. Pixel-art look, no audio.

## Goals
- Host creates a room; players join with a 4-letter code and a username.
- Host controls: kick players, edit settings, edit roles, start the game.
- Fully customizable roles (add, remove, rename, edit description).
- Role cards stay private: tap to reveal, tap again to hide.
- Pixel-art UI, mobile-first, no audio.

## Non-goals (v1)
- No voting, night/day phases, or in-game moderation logic. This tool only distributes roles.
- No accounts, no database, no chat.
- No audio of any kind.

## Stack
- Server: Node.js + TypeScript + Socket.IO. Room state in memory.
- Client: Vite + TypeScript (plain DOM or Svelte).
- Shared: a `shared/` folder holding types for roles, rooms and socket events.
- Styling: CSS only. Font "Press Start 2P", `image-rendering: pixelated`, chunky borders.
- Deploy: any host with WebSocket support (Render, Railway, Fly.io).

## Core design decisions
1. **Role secrecy is server-enforced.** The server sends each player only their own role. No payload ever contains another player's role, including the host's view.
2. **Rejoin support.** Each player gets a session token stored in localStorage; reconnecting restores their seat and role.
3. **Room codes.** 4 letters, excluding look-alikes (O, I, L). Check for collisions. Expire idle rooms.
4. **Assignment.** Expand the role list into one slot per player, fill the remainder with Villagers, shuffle (Fisher-Yates), assign. Block start if roles exceed players.
5. **Reveal.** Tap to show, tap to hide, auto-hide after a few seconds as a safety net.
6. **Server is the source of truth.** The client only renders state and sends intents. The server validates that every host action comes from the host.

## Default roles
| Role | Required | Notes |
|------|----------|-------|
| Mafia | Yes | Count scales with player count |
| Villager | Yes | Fills all remaining slots |
| Sheriff | No | |
| Doctor | No | |
| Maniac | No | |
| Kamikaze | No | |
| Police | No | |

Each role has: id, name, description, team/colour tag, enabled flag, count, and `isDefault`. Defaults can be edited but Mafia and Villager cannot be disabled or deleted. Custom roles can be added and deleted.

## Phases

### Phase 0: Setup
- [x] Init repo, TypeScript config, client/server/shared layout
- [x] Dev script that runs client and server together
- [x] Shared types: `Role`, `Player`, `Room`, `Settings`, socket event names

### Phase 1: Rooms and lobby
- [x] Create room (host) and generate code
- [x] Join room with code + username; validate and reject duplicate or empty names
- [x] Live player list for everyone
- [x] Host can kick a player (kicked client returns to the home screen)
- [x] Player can leave
- [x] Host disconnect handling (grace period, then transfer host or close room)
- [x] Session token and rejoin on refresh
- [x] Idle room cleanup

### Phase 2: Roles and settings
- [x] Default role set with presets scaled to player count
- [x] Toggle optional roles and set per-role counts
- [x] Edit role name and description
- [x] Add and delete custom roles
- [x] Live validation: total roles vs. player count, at least one Mafia, and so on
- [x] Settings sync to all clients in real time (host edits, others see a read-only summary of enabled roles but not counts per hidden info, if the host chooses to hide it)

### Phase 3: Game flow
- [x] Host starts the game; the server assigns roles
- [x] Each player receives only their own role
- [x] Role card: tap to reveal, tap again to hide, auto-hide timer
- [x] Host can end the game and return to the lobby, or reshuffle with the same settings
- [x] Late join and mid-game leave handling

### Phase 4: Pixel UI polish
- [x] Pixel theme: palette, font, bordered panels, button press states
- [x] Role icons drawn in CSS or inline SVG pixel art
- [x] Mobile-first layout, large tap targets
- [x] Card flip animation (CSS only)
- [x] Empty, loading, error and disconnected states

### Phase 5: Hardening and deploy
- [x] Sanitize names and role text (length limits, no HTML injection)
- [x] Rate-limit joins and room creation
- [x] Basic tests for assignment logic and room lifecycle (`server/src/*.test.ts`, 63 tests)
- [ ] Deploy, set the WebSocket URL by env var, and smoke test with several real phones (ready: `render.yaml`, `Dockerfile`, `VITE_SERVER_URL`/`CORS_ORIGIN`, checklist in `DEPLOY.md`; needs your Render/GitHub account and real phones)

## Phase 5 decisions (for reference)
- Rate limits per IP, sized for a party sharing one Wi-Fi: 10 room creations/min, 60 joins/min, 60 rejoins/min, 80 open connections. Per connection: 60 actions per 10 s. Per server: 2000 rooms. Over the limit → `rateLimited` / `serverBusy` error, translated.
- `TRUST_PROXY=1` makes limits use X-Forwarded-For (set in `render.yaml` and the Dockerfile).
- Served pages carry a strict Content-Security-Policy (everything same-origin; fonts bundled), plus nosniff, no-referrer, frame-ancestors none. Path traversal and malformed URLs are rejected.
- The server serves the built client whenever `dist/client` exists (no NODE_ENV needed, which is awkward on Windows). `/healthz` returns `ok`.
- SIGTERM/SIGINT close sockets cleanly. Rooms are in memory, so a redeploy ends running games.
- Role cards look identical for every team (same frame and background), so a glance across the table gives nothing away.

## Phase 3 decisions (for reference)
- Deal: one slot per player in the round (special roles expanded by count, Villagers fill the rest), Fisher-Yates shuffle with `crypto.randomInt`, assigned in join order.
- Each client's state snapshot is built per viewer; it carries only that viewer's own role (`you`). No message ever holds another player's role.
- Exception, opt-in only: setting "Moderator sees roles" (default off). When on and the host is moderating, only the host's snapshot includes the full list. A host who plays, or a player who inherits host mid-game, never gets it.
- Roles and settings are locked during a game. Start is blocked while the setup has errors (server re-checks).
- Late joiners can join mid-game, wait without a role ("Next round"), and are dealt in on reshuffle. A player who leaves loses their role; a disconnected player keeps it and gets it back on rejoin.
- Reshuffle and End game use two-tap confirm. A reshuffle hides every card and shows a "New round!" banner.
- Card: face-down on every load (never stored), tap to show/hide, auto-hide after the room's timer, and hidden immediately when the page is hidden (phone locked or app switched). Role text exists in the DOM only while face-up.

## Languages and font
- UI in English and Azerbaijani, switchable on every screen (EN | AZ), remembered per device. The default follows the browser language (Azerbaijani browsers get AZ), otherwise English.
- The server sends error and close-reason codes (`shared/errors.ts`); each client translates them.
- Default role names/descriptions show in each viewer's language until the host renames them; then the host's text is shown to everyone.
- Font is bundled (no Google Fonts request). Press Start 2P has no ə/Ə, so `client/src/fonts/mafia-pixel-az.woff2` adds them on the same 8×8 grid (built by `make_az_font.py`, OFL; renamed per the Reserved Font Name clause). Font ligatures are off because the "fi" ligature drops the dot on i.

## Phase 2 decisions (for reference)
- Preset: Mafia ≈ players ÷ 4 (min 1). Doctor from 6 players, Sheriff from 7, Police from 9, Maniac from 11, Kamikaze from 13. Villagers fill the rest.
- Roles follow the preset automatically ("Auto") as players join/leave or host-plays changes, until the host edits a role. "Use preset" switches back to auto.
- Optional roles: the count stepper doubles as the toggle (0 = off). Mafia minimum 1. Villager count is always automatic.
- Mafia and Villager can be renamed and re-described but not turned off, deleted, or moved off their team.
- Validation: ≥ 4 players in game, ≥ 1 Mafia-team role, roles ≤ players (errors); warning when Mafia are half the table or more.
- Only the host's state includes role counts; everyone else gets role names/descriptions/teams only.
- Settings: host plays (default off), card auto-hide 2–15 s (default 5). Max 24 roles per room.

## Phase 1 decisions (for reference)
- Host grace period: 30 s. After it, host passes to the earliest-joined *connected* player; if nobody is connected the room closes. The old host can rejoin as a regular player.
- Host who leaves on purpose: host passes immediately (earliest connected player, else earliest player).
- Disconnected players keep their seat (shown as "Away") until they rejoin, leave, or get kicked.
- Idle cleanup: room closes after 4 h with no join/leave/kick/rejoin, or after 10 min with nobody connected.
- Opening the same seat in a second tab moves the seat to the new tab; the old tab is sent home.
- Kicked players can rejoin with a fresh join (no ban list in v1).
- `MAX_PLAYERS` = 30 (confirmed by the group-size decision below).

## Later ideas
- Save and load custom role sets (localStorage).
- Role images or colours per role.
- More languages (English and Azerbaijani ship now; add a dictionary in `client/src/i18n.ts`).

## Decisions (resolved open questions, 2026-11-26)
- **Host role:** a room setting. Default is **host moderates** (gets no role); the host can switch to playing. This replaces the "moderator mode" later idea.
- **Sheriff vs Police:** separate roles.
  - Sheriff: each night, checks one player and learns only **good or bad**, never the exact role.
  - Police: each round, may shoot one player.
  - If either one dies, the survivor gains both abilities (shoot + good/bad check).
  - The tool only hands out roles, so this lives in the role descriptions; nothing is enforced in-app.
- **Roles in play:** always shown to every player, as a list of role names with no counts and no owners.
- **Group size:** 4–30 players. Presets cover that range; `MAX_PLAYERS` stays 30, minimum 4 to start.
