# Briella Turns 6 — Interactive Invitation

Mobile-first Pokémon birthday invitation. Guests see the cover artwork first; tapping it (glowing "Tap to open" button) bursts light from the button's Poké Ball, flashes, and reveals the details page with RSVP, Directions and Calendar buttons.

- **Event:** Briella's 6th birthday · Wed, Oct 28, 2026 · 2:00–5:00 PM (Manila) · Timezone, Greenhills
- **Stack:** plain HTML/CSS/JS + a zero-dependency Node server (`server.js`). No build step, no `npm install` needed.

## Before you send it — 2-minute checklist

Open `public/app.js` and check the `CONFIG` block at the top:

| Setting | What to do |
|---|---|
| `rsvpPhone` | Set to 0917 820 2322 (`"639178202322"`). The **Text message** button sends the RSVP there. |
| `endUtc` | The party is set to end at **5:00 PM** (`20261028T090000Z`). Change it if the party ends at a different time. Also update `DTEND` in `server.js`. |
| `address` / `mapsQuery` | Set to *Greenhills Shopping Center, Ortigas Ave, San Juan City*. Tap **Directions** once after deploying and make sure the pin lands on the right Timezone branch. |

## Run locally

```bash
npm start          # → http://localhost:3000
```

## Deploy to Railway

### Option A: from GitHub (recommended)

1. Code lives at github.com/BBB820/briellainvitation (branch `main`).
2. Go to **railway.com → New Project → Deploy from GitHub repo** and pick **briellainvitation**.
3. Leave **Root Directory** empty and the branch on `main`.
4. Wait for the deploy to show **Active**.
5. Railway picks up `railway.json` automatically: Nixpacks build, `npm start`, health check on `/health`.
6. Go to **Settings → Networking → Generate Domain**. That gives you your public URL, e.g. `https://briella-turns-6.up.railway.app`.
7. Open the URL on your phone and test the whole flow: Ball → RSVP → Directions → Calendar → Share.

### Option B: Railway CLI

```bash
npm i -g @railway/cli
railway login
railway init                 # create a new project
railway up                   # upload and deploy this folder
railway domain               # generate the public URL
```

### Optional: custom domain

Go to **Settings → Networking → Custom Domain** and add the CNAME record Railway shows you at your DNS provider.

## RSVP guest list (all responses in one place)

Every RSVP is saved on the server. Open your private guest list at:

```
https://<your-railway-domain>/rsvps
```

It shows totals (families, kids, adults, can't make it), every response, and a
**Download spreadsheet (CSV)** button that opens in Excel or Google Sheets.
Every RSVP is listed; nothing is merged or hidden. The only rows combined are one
person changing their own answer (same phone and same name), shown once and tagged
"changed answer". Rows that share a name are flagged "same name as another" so you
can spot real duplicates.

Delivery never drops an RSVP: each submission has an id (retries can't
double-save), it is retried automatically, kept on the guest's phone until the
server confirms it, and resent the next time they open the invitation. If it still
can't be saved, the text/chat message the guest sends is marked
"⚠️ Not saved online yet" so you know to ask them to try the RSVP again.

One-time Railway setup:

1. **Keep the list safe across redeploys:** right-click the service (or press
   Ctrl/Cmd+K) → **Add Volume** → mount path `/data`. Without a Volume the list
   is erased on every redeploy; the guest list page warns you if one is missing.
2. *(Optional)* **Add a password:** service → **Variables** → `ADMIN_KEY` = a
   password. The list then opens at `/rsvps?key=<password>`. Without it, anyone
   who has the `/rsvps` link can view the list.

## Sound

All sound is synthesised in the browser (`Sfx` in `app.js`) in the style of
Game Boy-era music: pulse-wave leads with harmony and vibrato, octave-bounce
bass, noise drums, light echo. Every melody is an original composition; no
game soundtrack is copied and there are no audio files.

- **Opening (tap):** menu "bip-bip", rising Poké Ball-release arpeggio, pop at
  the flash, short "item get"-style fanfare.
- **RSVP page:** original adventure-route theme at 150 bpm (fanfare intro, then
  a 16-bar loop). Stops on "Back to cover" or mute, pauses when the tab is hidden.
- **RSVP form:** A-button select sound on open, level-up style chime on save.
- The speaker button (top-right) mutes everything; the choice is remembered.
  On iPhone, nothing plays while the ring/silent switch is on silent.

## How each button works

| Button | Behavior | Fallback |
|---|---|---|
| **RSVP** | Name, yes/no, kid and adult counts, optional note. **Send RSVP** saves it to your guest list, then offers optional **Chat apps** (share sheet: WhatsApp, Messenger, Viber…) and **Text message** (SMS to the host). | If saving fails, the guest is asked to send it by chat or text instead |
| **Directions** | Google Maps, Waze, and Apple Maps (iPhone only) | n/a |
| **Calendar** | iPhone: Apple Calendar first (`/briella-birthday.ics`, with reminders 1 day and 2 hours before). Android: Google Calendar first. | The other option sits right below |
| **Save invitation image** | Downloads a full-resolution JPG of the artwork | n/a |

Link previews in Messenger, Viber and iMessage show `assets/og.jpg`. The server makes those URLs absolute for whatever domain you deploy to.

## Files

```
briellainvitation/
├── server.js                 static server, RSVP API + guest list, /health, .ics
├── railway.json              Railway build/deploy config
├── package.json              "start": "node server.js"
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js                ← CONFIG lives here
    └── assets/
        ├── cover.webp/.jpg           page 1: static cover (first screen; "Tap to open" button is drawn by the page)
        ├── invite-details.webp/.jpg  page 2: date, time, venue (shown after the tap)
        ├── cover-ext.webp/.jpg       cover with painted sky/ground continuation (full-screen fill)
        ├── details-tail.webp/.jpg    street continuation below page 2 (behind the buttons)
        ├── cover-original.webp       your original cover upload, untouched
        ├── invitation-original.webp  your earlier two-panel upload (source of page 2)
        ├── briella-invitation.jpg    "Save image" download
        ├── og.jpg                    link-preview image
        ├── apple-touch-icon.png
        └── fonts/                    Luckiest Guy + Nunito (OFL), self-hosted
```

## Notes

- Page 1 is the static cover (the first screen); page 2 (details) has no image source until the tap, so it can't appear early. It preloads in the background so the reveal is instant. "Back to cover" returns to page 1.
- On phones both pages are full screen, edge to edge: where a screen is taller than the art, the sky continues above the cover and the ground/street continues below (soft painted extensions, no copied shapes). On tablets and computers the cover sits on a blurred copy of itself.
- The artwork isn't attached to the page until the ball is tapped. It preloads in the background, so the reveal is instant.
- `prefers-reduced-motion` skips the wobble, burst and flash and goes straight to the invitation.
