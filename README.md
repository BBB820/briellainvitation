# Briella Turns 6 — Interactive Invitation

Mobile-first Pokémon birthday invitation. Guests see a Poké Ball first; tapping it opens the ball, flashes, and reveals the invitation artwork with RSVP, Directions, Calendar and Share buttons.

- **Event:** Briella's 6th birthday · Wed, Oct 28, 2026 · 2:00–5:00 PM (Manila) · Timezone, Greenhills
- **Stack:** plain HTML/CSS/JS + a zero-dependency Node server (`server.js`). No build step, no `npm install` needed.

## Before you send it — 2-minute checklist

Open `public/app.js` and check the `CONFIG` block at the top:

| Setting | What to do |
|---|---|
| `rsvpPhone` | Put your mobile number in international format, digits only (e.g. `"639171234567"`). The **Text** and **WhatsApp** RSVP buttons then go straight to you. If you leave it blank, guests choose who to send it to. |
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

## How each button works

| Button | Behavior | Fallback |
|---|---|---|
| **RSVP** | Name, yes/no, kid and adult counts, and an optional note build a message. **Send RSVP** opens the phone's share sheet (Messenger, Viber, WhatsApp, SMS…). | **Text** (SMS), **WhatsApp**, or **Copy** to the clipboard |
| **Directions** | Google Maps, Waze, and Apple Maps (iPhone only) | n/a |
| **Calendar** | iPhone: Apple Calendar first (`/briella-birthday.ics`, with reminders 1 day and 2 hours before). Android: Google Calendar first. | The other option sits right below |
| **Share** | Native share sheet with the link | Copies the link and shows a confirmation |
| **Save invitation image** | Downloads a full-resolution JPG of the artwork | n/a |

Link previews in Messenger, Viber and iMessage show `assets/og.jpg`. The server makes those URLs absolute for whatever domain you deploy to.

## Files

```
briellainvitation/
├── server.js                 static server, /health, dynamic .ics, OG origin
├── railway.json              Railway build/deploy config
├── package.json              "start": "node server.js"
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js                ← CONFIG lives here
    └── assets/
        ├── invitation.webp           main artwork (transparent, 400 KB)
        ├── invitation.png            fallback for old browsers
        ├── invitation-original.png   your original upload, untouched
        ├── briella-invitation.jpg    "Save image" download
        ├── og.jpg                    link-preview image
        ├── apple-touch-icon.png
        └── fonts/                    Luckiest Guy + Nunito (OFL), self-hosted
```

## Notes

- Your original PNG had a grey checkerboard baked into the pixels (fake transparency). The site uses a cleaned copy with real transparency. The untouched original is kept as `invitation-original.png`.
- The artwork isn't attached to the page until the ball is tapped. It preloads in the background, so the reveal is instant.
- `prefers-reduced-motion` skips the wobble, burst and flash and goes straight to the invitation.
