# CLAUDE.md

## Project
Web-based Mafia role distribution platform. A host creates a room with a 4-letter code; players join from their phones with the code and a username. The host configures roles and settings, starts the game, and each player privately reveals their own role card. Pixel-art UI, no audio. See `ROADMAP.md` for scope and phases.

## Stack
- Server: Node.js + TypeScript + Socket.IO, in-memory room state (no database)
- Client: Vite + TypeScript
- Shared types in `shared/`
- CSS-only pixel styling, font "Press Start 2P"

## Rules that must not be broken
1. **Never send one player's role to another player.** Role assignment and delivery happen on the server only. No broadcast event may contain the full role-to-player mapping. The host does not see roles either, unless a moderator setting explicitly allows it.
2. **The server is authoritative.** Validate every host-only action (kick, edit settings, edit roles, start) against the host's socket/session on the server. Never trust client-supplied "isHost" flags.
3. **Mafia and Villager are mandatory.** They cannot be disabled or deleted. All other default roles are optional. Custom roles are fully editable and deletable.
4. **Room codes** are 4 uppercase letters, excluding look-alikes (O, I, L). Always check for collisions.
5. **No audio.** No sounds, no autoplay media, no audio libraries.
6. **Sanitize all user text** (usernames, role names, descriptions): enforce length limits and render as text, never as HTML.
7. **Role card reveal:** tap to show, tap again to hide, auto-hide after a few seconds. It must never be visible by default after a refresh or reconnect.

## Languages
- Every user-facing string goes through `t()` in `client/src/i18n.ts`. Add new keys to both `en` and `az` (the `az` object is type-checked against `en`).
- The server never sends user-facing text: return an `ErrorCode` (+ params) from `shared/errors.ts` and add `err.<code>` translations.
- Keep `<html lang>` in sync (done by `setLang`) so CSS uppercase handles Azerbaijani i → İ.

## UI direction
- Pixel-art, retro-game feel: chunky borders, limited palette, `image-rendering: pixelated`, pressed-button states.
- Mobile-first. Large tap targets, readable at arm's length.
- Draw icons and decoration with CSS or inline SVG. Avoid binary image assets where possible.

## Working agreements
- Work phase by phase following `ROADMAP.md`. Tick checkboxes as items are completed.
- Keep functions small and typed. Put socket event names and payload types in `shared/` so client and server cannot drift.
- Unit-test the role assignment logic (counts, filling with Villagers, rejecting too many roles) and the room lifecycle (join, kick, rejoin, host transfer).
- Before adding a dependency, say why it is needed. Prefer the standard library and small deps.
- Ask before making decisions listed under "Open questions" in `ROADMAP.md`.

## Layout
- `shared/` – `types.ts` (domain types), `events.ts` (socket event names + payloads), `errors.ts` (error/close codes), `limits.ts` (code alphabet, length limits, text cleaning), `roles.ts` (default roles, presets, summary/validation, roles in play)
- `server/src/` – `rateLimit.ts` (per-IP/per-socket limits), `rooms.ts` (RoomManager: pure lifecycle + host edits, unit-tested), `roleEdit.ts` (validated role edits), `deal.ts` (Fisher-Yates role assignment), `codes.ts`, `index.ts` (Socket.IO wiring), `static.ts` (serves the built client in production)
- `client/src/` – `main.ts` (screens), `roleViews.ts` (role editor, settings, roles in play), `gameViews.ts` (role card, moderator, host controls), `widgets.ts`, `i18n.ts` (EN/AZ strings), `actions.ts` (host intents), `ui.ts` (client-only state; never persisted), `dom.ts` (`h()` builder; strings always become text nodes), `net.ts`, `session.ts` (localStorage token), `pixel.ts` (inline-SVG pixel art + role icons), `styles.css`, `fonts/` (bundled pixel font + ə/Ə supplement, OFL)

## Commands
- `npm run dev`: run client (Vite, :5173, reachable on LAN) and server (:3001) together; Vite proxies `/socket.io`
- `npm run build`: typecheck, build client to `dist/client`, bundle server to `dist/server`
- `npm start`: run the production server; it serves `dist/client` automatically when built (port `PORT`, default 3001)
- `npm test`: run tests (Vitest)
- Deploy and environment variables: see `DEPLOY.md` (`render.yaml` for Render, `Dockerfile` for others)

## Dependencies (why)
- `socket.io` / `socket.io-client`: real-time rooms with reconnection and acks (stack choice)
- `vite`: client dev server and bundler (stack choice)
- `typescript`, `@types/node`: types
- `tsx`: run/watch the TS server in dev without a build step
- `esbuild`: bundle the server for production (already a Vite dependency)
- `concurrently`: run client and server from one `npm run dev`
- `vitest`: unit tests, shares Vite's TS handling
