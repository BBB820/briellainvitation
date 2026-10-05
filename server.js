// Zero-dependency static server for Briella's invitation.
// Railway injects PORT; locally it falls back to 3000.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

// RSVPs are appended to one JSON-lines file. On Railway, attach a Volume and
// Railway sets RAILWAY_VOLUME_MOUNT_PATH; without one, the file is wiped on
// every redeploy.
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, "data");
const RSVP_FILE = path.join(DATA_DIR, "rsvps.jsonl");
// Password for the guest list page (/rsvps?key=...). Set it in Railway → Variables.
const ADMIN_KEY = process.env.ADMIN_KEY || "";
fs.mkdirSync(DATA_DIR, { recursive: true });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ics": "text/calendar; charset=utf-8",
};

// index.html is read once; {{ORIGIN}} is filled per request so link-preview
// tags (og:image, og:url) are absolute on whatever domain Railway assigns.
const indexTemplate = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function originOf(req) {
  const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function calendarFile(origin) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Briella Turns 6//Invitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:briella-6th-birthday-20261028@invite",
    "DTSTAMP:20261001T000000Z",
    "DTSTART:20261028T060000Z",
    "DTEND:20261028T090000Z",
    "SUMMARY:Briella's 6th Birthday Party",
    "LOCATION:Timezone\\, Greenhills Shopping Center\\, San Juan City\\, Metro Manila",
    `DESCRIPTION:Pokémon party at Timezone\\, Greenhills! Invitation: ${origin}/`,
    `URL:${origin}/`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Briella's party is tomorrow!",
    "TRIGGER:-P1D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Briella's party starts in 2 hours",
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// ---------- RSVP storage ----------

function readRsvps() {
  let raw = "";
  try { raw = fs.readFileSync(RSVP_FILE, "utf8"); } catch { return []; }
  return raw.split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

// One row per guest: a later RSVP under the same name replaces the earlier one.
function latestPerGuest(all) {
  const byName = new Map();
  for (const r of all) byName.set(r.name.trim().toLowerCase(), r);
  return [...byName.values()].sort((a, b) => a.at.localeCompare(b.at));
}

function cleanRsvp(body) {
  const str = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  const count = (v) => Math.min(10, Math.max(0, parseInt(v, 10) || 0));
  const name = str(body.name, 80);
  if (!name) return null;
  const attending = body.attending === "yes";
  return {
    at: new Date().toISOString(),
    name,
    attending,
    kids: attending ? count(body.kids) : 0,
    adults: attending ? count(body.adults) : 0,
    note: str(body.note, 500),
  };
}

// Light abuse guard: 10 submissions per IP per 10 minutes.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function handleRsvpPost(req, res) {
  if (rateLimited(clientIp(req))) return sendJson(res, 429, { ok: false, error: "Too many RSVPs, please try again later." });
  let rsvp;
  try {
    rsvp = cleanRsvp(JSON.parse(await readBody(req)));
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid RSVP." });
  }
  if (!rsvp) return sendJson(res, 400, { ok: false, error: "Please include your name." });
  try {
    fs.appendFileSync(RSVP_FILE, JSON.stringify(rsvp) + "\n");
  } catch (err) {
    console.error("Could not save RSVP:", err);
    return sendJson(res, 500, { ok: false, error: "Could not save RSVP." });
  }
  console.log(`RSVP: ${rsvp.name} (${rsvp.attending ? `yes, ${rsvp.kids} kids, ${rsvp.adults} adults` : "no"})`);
  sendJson(res, 200, { ok: true });
}

// ---------- Guest list (host only) ----------

function isAdmin(url) {
  const key = url.searchParams.get("key") || "";
  if (!ADMIN_KEY || key.length !== ADMIN_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_KEY));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const manila = (iso) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

function csvFile(rows) {
  // Leading quote neutralises formula injection when opened in Excel/Sheets.
  const cell = (v) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [["Submitted (Manila)", "Name", "Coming", "Kids", "Adults", "Message"].map(cell).join(",")];
  for (const r of rows) {
    lines.push([manila(r.at), r.name, r.attending ? "Yes" : "No", r.kids, r.adults, r.note].map(cell).join(","));
  }
  return "\ufeff" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 names correctly
}

function guestListPage(rows, key) {
  const yes = rows.filter((r) => r.attending);
  const kids = yes.reduce((n, r) => n + r.kids, 0);
  const adults = yes.reduce((n, r) => n + r.adults, 0);
  const persistent = Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR);
  const body = rows.length
    ? rows.slice().reverse().map((r) => `<tr class="${r.attending ? "" : "no"}">
        <td>${esc(r.name)}</td>
        <td>${r.attending ? "✅ Yes" : "❌ No"}</td>
        <td class="n">${r.attending ? r.kids : "–"}</td>
        <td class="n">${r.attending ? r.adults : "–"}</td>
        <td>${esc(r.note)}</td>
        <td class="t">${esc(manila(r.at))}</td></tr>`).join("")
    : `<tr><td colspan="6" class="empty">No RSVPs yet.</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Briella's RSVPs</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f3f5fb; color: #0b1f54; }
  main { max-width: 900px; margin: 0 auto; padding: 20px 16px 40px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  .sub { margin: 0 0 18px; color: #5a6a92; }
  .warn { background: #fff4d6; border: 1px solid #f0c419; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .stat { background: #fff; border-radius: 14px; padding: 14px; box-shadow: 0 1px 3px rgba(11,31,84,.08); }
  .stat b { display: block; font-size: 28px; font-variant-numeric: tabular-nums; }
  .stat span { color: #5a6a92; font-size: 14px; font-weight: 600; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .btn { display: inline-block; padding: 12px 16px; border-radius: 12px; background: #e3262f; color: #fff; font-weight: 700; text-decoration: none; }
  .btn.alt { background: #fff; color: #0b1f54; border: 1.5px solid #d5dbea; }
  .wrap { overflow-x: auto; background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(11,31,84,.08); }
  table { width: 100%; border-collapse: collapse; min-width: 620px; }
  th, td { padding: 11px 12px; text-align: left; border-bottom: 1px solid #eef1f8; vertical-align: top; }
  th { font-size: 13px; color: #5a6a92; text-transform: uppercase; letter-spacing: .04em; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  td.t { color: #5a6a92; white-space: nowrap; font-size: 14px; }
  tr.no td { color: #8090b0; }
  .empty { text-align: center; color: #5a6a92; padding: 30px; }
  @media (max-width: 560px) { .stats { grid-template-columns: repeat(2, 1fr); } }
</style></head><body><main>
  <h1>Briella's RSVPs</h1>
  <p class="sub">Party: Wed, Oct 28, 2026 · 2:00 PM · Timezone, Greenhills</p>
  ${persistent ? "" : `<p class="warn"><b>Heads up:</b> no Railway Volume is attached, so this list will be erased on the next redeploy. Attach a Volume to keep it.</p>`}
  <div class="stats">
    <div class="stat"><b>${yes.length}</b><span>Families coming</span></div>
    <div class="stat"><b>${kids}</b><span>Kids</span></div>
    <div class="stat"><b>${adults}</b><span>Adults</span></div>
    <div class="stat"><b>${rows.length - yes.length}</b><span>Can't make it</span></div>
  </div>
  <div class="actions">
    <a class="btn" href="/rsvps.csv?key=${encodeURIComponent(key)}">Download spreadsheet (CSV)</a>
    <a class="btn alt" href="/rsvps?key=${encodeURIComponent(key)}">Refresh</a>
  </div>
  <div class="wrap"><table>
    <thead><tr><th>Name</th><th>Coming</th><th>Kids</th><th>Adults</th><th>Message</th><th>Sent</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>
</main></body></html>`;
}

function handleAdmin(url, res, asCsv) {
  if (!ADMIN_KEY) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Guest list is locked. Set the ADMIN_KEY variable in Railway to open it.");
  }
  if (!isAdmin(url)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Wrong or missing key.");
  }
  const rows = latestPerGuest(readRsvps());
  if (asCsv) {
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="briella-rsvps.csv"',
      "Cache-Control": "no-store",
    });
    return res.end(csvFile(rows));
  }
  res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-store" });
  res.end(guestListPage(rows, url.searchParams.get("key")));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }

  if (pathname === "/api/rsvp") {
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }); return res.end(); }
    handleRsvpPost(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: "Server error." });
    });
    return;
  }

  if (pathname === "/rsvps") return handleAdmin(url, res, false);
  if (pathname === "/rsvps.csv") return handleAdmin(url, res, true);

  if (pathname === "/briella-birthday.ics") {
    res.writeHead(200, {
      "Content-Type": TYPES[".ics"],
      "Content-Disposition": 'inline; filename="briella-6th-birthday.ics"',
      "Cache-Control": "no-cache",
    });
    return res.end(calendarFile(originOf(req)));
  }

  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, {
      "Content-Type": TYPES[".html"],
      "Cache-Control": "no-cache",
    });
    return res.end(indexTemplate.replaceAll("{{ORIGIN}}", originOf(req)));
  }

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Unknown paths land on the invitation instead of a dead end.
      res.writeHead(302, { Location: "/" });
      return res.end();
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": pathname.startsWith("/assets/")
        ? "public, max-age=604800"
        : "public, max-age=300",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Briella's invitation is live on port ${PORT}`);
  console.log(`RSVPs are saved to ${RSVP_FILE}`);
  if (!process.env.RAILWAY_VOLUME_MOUNT_PATH && process.env.RAILWAY_ENVIRONMENT) {
    console.warn("No Railway Volume attached: RSVPs will be lost on redeploy.");
  }
  if (!ADMIN_KEY) console.warn("ADMIN_KEY is not set: the /rsvps guest list is locked.");
});
