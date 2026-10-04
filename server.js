// Zero-dependency static server for Briella's invitation.
// Railway injects PORT; locally it falls back to 3000.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");

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
});
