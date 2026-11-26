# Deploying Mafia

The app is one Node server that serves the web page **and** the live connection (Socket.IO) from the same address. Rooms live in memory, so a restart or redeploy ends any games in progress.

## Option A: play tonight on your Wi-Fi (no deploy)

1. In the project folder: `npm run build`, then `npm start`.
2. The terminal says `listening on :3001 (serving client)`.
3. Find your PC's local IP. On Windows run `ipconfig` and look for "IPv4 Address", e.g. `192.168.1.23`.
4. Everyone on the same Wi-Fi opens `http://192.168.1.23:3001` on their phone.
5. If Windows asks about the firewall for Node.js, click **Allow**. Phones can't connect without this.

## Option B: Render (free, online, a link anyone can open)

1. Put the project on GitHub. One-time setup, run in the project folder:
   ```
   git init
   git add .
   git commit -m "Mafia role distributor"
   ```
   Then create an empty repository on github.com and follow its "push an existing repository" commands.
2. Go to https://render.com, sign in with GitHub, choose **New → Blueprint**, and pick the repository. Render reads `render.yaml` and creates the service.
3. Wait for the build to finish (about 2–3 minutes). Your link looks like `https://mafia-xxxx.onrender.com`.
4. Open `https://<your-link>/healthz`. It should say `ok`.

The free plan sleeps after about 15 minutes with no visitors. The first visit afterwards takes 30–60 seconds to wake it, so open the link a minute before the game starts.

## Option C: Railway, Fly.io or any Docker host

Use the `Dockerfile`. The server listens on `PORT` (default 3001). Set `TRUST_PROXY=1` when running behind the host's proxy.

## Environment variables

| Variable | Where | Default | What it does |
|---|---|---|---|
| `PORT` | server | `3001` | Port to listen on (hosts set this automatically). |
| `TRUST_PROXY` | server | off | `1` behind a reverse proxy, so rate limits use the real client IP. |
| `CORS_ORIGIN` | server | none | Only if the page is hosted on a **different** site than the server: comma-separated allowed origins, e.g. `https://mafia.example.com`. |
| `VITE_SERVER_URL` | client, at build time | same origin | Only if the server is on a different address than the page, e.g. `https://mafia-api.onrender.com`. Set it before `npm run build`. |
| `CLIENT_DIR` | server | `dist/client` | Where the built page is. Rarely needed. |

With the normal setup (Options A–C), none of the optional ones are needed: page and connection share one address.

## Smoke test with real phones

Do this once after each deploy, ideally with 4 or more phones (iPhone and Android, both languages).

- [ ] Host creates a room on one phone. The 4-letter code appears.
- [ ] Others join with the code. Everyone sees the player list update live.
- [ ] Switch one phone to **AZ**: all text changes, including ə in "Vətəndaş".
- [ ] Host changes roles and settings. Players see "Roles in play" update (names only, no counts).
- [ ] Host taps **Start game**. Every card starts face-down.
- [ ] Tap to reveal, tap to hide. Leave one revealed: it hides itself after the timer.
- [ ] Lock a phone with its card revealed, then unlock: the card is hidden.
- [ ] Refresh a player's page mid-game: the card is face-down and shows the same role when tapped.
- [ ] Turn a phone's Wi-Fi off for 10 seconds and back on: it reconnects by itself.
- [ ] Someone joins mid-game: they see "next round". Host taps **Reshuffle**: they get a card.
- [ ] Host taps **End game**: everyone returns to the lobby.
- [ ] Host closes the app: after about 30 seconds another player becomes host.
- [ ] Rotate a phone to landscape: nothing is cut off.

## Limits (anti-abuse)

Per IP address (a whole party on one Wi-Fi shares one IP, so these are generous):
- 10 room creations a minute
- 60 joins a minute
- 60 rejoins a minute
- 80 open connections

Per connection: 60 actions per 10 seconds. Per server: 2000 rooms. When a limit is hit, players see "Too many attempts. Wait a minute and try again."
