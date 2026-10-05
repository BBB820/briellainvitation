(() => {
  "use strict";

  // ---------------------------------------------------------------
  // Party settings. Phone numbers use international format, digits
  // only (e.g. "639171234567"). A blank number lets guests pick the
  // recipient themselves.
  // ---------------------------------------------------------------
  const CONFIG = {
    celebrant: "Briella",
    title: "Briella's 6th Birthday Party",
    rsvpPhone: "639178202322", // 0917 820 2322: Text RSVPs go here
    whatsappPhone: "",          // blank: guests pick the WhatsApp chat
    venue: "Timezone, Greenhills",
    address: "Greenhills Shopping Center, Ortigas Ave, San Juan City, Metro Manila",
    mapsQuery: "Timezone Greenhills, San Juan City, Metro Manila",
    // 2:00–5:00 PM Manila time (UTC+8), stored in UTC for calendar links.
    startUtc: "20261028T060000Z",
    endUtc: "20261028T090000Z",
    startIso: "2026-10-28T14:00:00+08:00",
    dateLabel: "Wed, Oct 28, 2026 · 2:00 PM",
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const intro = $("#intro");
  const ball = $("#ball");
  const flash = $("#flash");
  const invite = $("#invite");
  const artImg = $("#art-img");
  const artSource = $(".art source");

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Older WebViews (e.g. some in-app browsers) lack the async clipboard.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  // ---------- Artwork: preload while the guest looks at the ball ----------
  // The <img> has no src until reveal, so the artwork can't flash early.
  const supportsWebp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  const artUrl = supportsWebp ? artSource.dataset.srcset : artImg.dataset.src;
  const preload = new Image();
  preload.decoding = "async";
  preload.src = artUrl;
  const artReady = (preload.decode ? preload.decode() : Promise.resolve()).catch(() => {});

  function mountArt() {
    if (artImg.getAttribute("src")) return;
    artSource.srcset = artSource.dataset.srcset;
    artImg.src = artImg.dataset.src;
  }

  // ---------- Opening sequence ----------
  let opening = false;

  async function openBall() {
    if (opening) return;
    opening = true;
    if (navigator.vibrate) navigator.vibrate(30);

    if (reduceMotion()) {
      await artReady;
      showInvite(false);
      return;
    }

    ball.classList.add("is-pressed");
    await wait(160);
    ball.classList.add("is-wobbling");
    intro.classList.add("is-leaving");
    await wait(560);
    ball.classList.remove("is-wobbling");
    ball.classList.add("is-open");
    if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
    await wait(380);

    // Don't flash into an empty page on a slow connection.
    await Promise.race([artReady, wait(2500)]);
    flash.classList.remove("is-off");
    flash.classList.add("is-on");
    await wait(200);

    showInvite(true);
    flash.classList.remove("is-on");
    flash.classList.add("is-off");
  }

  function showInvite(animated) {
    mountArt();
    intro.hidden = true;
    invite.hidden = false;
    document.body.classList.add("is-revealed");
    window.scrollTo(0, 0);
    if (animated) {
      invite.classList.add("is-revealing");
    }
    $("#invite-heading").focus({ preventScroll: true });
  }

  function replay() {
    opening = false;
    invite.hidden = true;
    invite.classList.remove("is-revealing");
    document.body.classList.remove("is-revealed");
    ball.classList.remove("is-pressed", "is-wobbling", "is-open");
    intro.classList.remove("is-leaving");
    flash.classList.remove("is-on", "is-off");
    intro.hidden = false;
    window.scrollTo(0, 0);
    ball.focus({ preventScroll: true });
  }

  ball.addEventListener("click", openBall);
  $("#btn-replay").addEventListener("click", replay);

  // ---------- Countdown (Manila calendar days) ----------
  function renderCountdown() {
    const manilaDay = (d) => {
      const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(d).split("-").map(Number);
      return Date.UTC(y, m - 1, day);
    };
    const days = Math.round((manilaDay(new Date(CONFIG.startIso)) - manilaDay(new Date())) / 86400000);
    const el = $("#countdown");
    if (days > 1) el.textContent = `${days} days to go!`;
    else if (days === 1) el.textContent = "Party is tomorrow!";
    else if (days === 0) el.textContent = "It's party day!";
    else el.textContent = "Thank you for celebrating with Briella!";
  }
  renderCountdown();

  // ---------- Sheets (dialogs) ----------
  function openSheet(dlg) {
    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
    document.body.classList.add("is-locked");
  }
  function closeSheet(dlg) {
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }
  $$("dialog").forEach((dlg) => {
    dlg.addEventListener("close", () => document.body.classList.remove("is-locked"));
    // Tap on the dimmed backdrop closes the sheet.
    dlg.addEventListener("click", (e) => { if (e.target === dlg) closeSheet(dlg); });
    $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", () => closeSheet(dlg)));
  });

  // ---------- Directions ----------
  const q = encodeURIComponent(CONFIG.mapsQuery);
  $("#map-address").textContent = CONFIG.address;
  $("#map-google").href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  $("#map-waze").href = `https://waze.com/ul?q=${q}&navigate=yes`;
  $("#map-apple").href = `https://maps.apple.com/?q=${q}`;
  if (isAndroid) $("#map-apple").remove();
  $("#btn-map").addEventListener("click", () => openSheet($("#dlg-map")));

  // ---------- Calendar ----------
  const details = `Pokémon party at ${CONFIG.venue}! Trainers of all ages welcome.\n\nInvitation: ${location.origin}/`;
  $("#cal-google").href =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(CONFIG.title)}` +
    `&dates=${CONFIG.startUtc}/${CONFIG.endUtc}` +
    `&ctz=Asia/Manila` +
    `&location=${encodeURIComponent(`${CONFIG.venue}, ${CONFIG.address}`)}` +
    `&details=${encodeURIComponent(details)}`;
  // iPhone guests usually want Apple Calendar first.
  if (isIOS) {
    const opts = $("#cal-options");
    const ics = $("#cal-ics");
    ics.className = "btn btn-primary";
    ics.textContent = "Apple Calendar";
    $("#cal-google").className = "btn btn-secondary";
    opts.prepend(ics);
  }
  $("#btn-cal").addEventListener("click", () => openSheet($("#dlg-cal")));

  // ---------- Share ----------
  $("#btn-share").addEventListener("click", async () => {
    const url = `${location.origin}/`;
    const data = {
      title: "Briella Turns 6!",
      text: `You're invited to Briella's Pokémon birthday party! ${CONFIG.dateLabel} at ${CONFIG.venue}. Tap the Poké Ball to open:`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // guest cancelled
      }
    }
    const ok = await copyText(`${data.text} ${url}`);
    toast(ok ? "Invitation link copied — paste it anywhere!" : url);
  });

  // ---------- RSVP ----------
  const form = $("#rsvp-form");
  const nameInput = $("#rsvp-name");
  const counts = { kids: 1, adults: 1 };

  function attending() {
    return form.elements.attending.value === "yes";
  }

  function rsvpMessage() {
    const name = nameInput.value.trim() || "[your name]";
    const note = $("#rsvp-note").value.trim();
    const lines = [`Hi! RSVP for ${CONFIG.title} 🎉`, "", `Name: ${name}`];
    if (attending()) {
      const parts = [];
      if (counts.kids) parts.push(`${counts.kids} kid${counts.kids > 1 ? "s" : ""}`);
      if (counts.adults) parts.push(`${counts.adults} adult${counts.adults > 1 ? "s" : ""}`);
      lines.push("✅ Yes, we'll be there!");
      if (parts.length) lines.push(`Guests: ${parts.join(", ")}`);
    } else {
      lines.push("😢 Sorry, we can't make it.");
    }
    if (note) lines.push(`Message: ${note}`);
    lines.push("", `📅 ${CONFIG.dateLabel}`, `📍 ${CONFIG.venue}`);
    return lines.join("\n");
  }

  function renderRsvp() {
    $("#rsvp-counts").hidden = !attending();
    $$(".stepper").forEach((s) => { $("output", s).textContent = counts[s.dataset.field]; });
    $("#rsvp-preview").textContent = rsvpMessage();
  }

  function validName() {
    const ok = nameInput.value.trim().length > 0;
    nameInput.setAttribute("aria-invalid", String(!ok));
    $("#rsvp-name-err").hidden = ok;
    if (!ok) nameInput.focus();
    return ok;
  }

  form.addEventListener("input", () => {
    if (nameInput.value.trim()) {
      nameInput.removeAttribute("aria-invalid");
      $("#rsvp-name-err").hidden = true;
    }
    renderRsvp();
  });
  form.addEventListener("change", renderRsvp);

  $$(".stepper").forEach((s) => {
    $$("button", s).forEach((b) => b.addEventListener("click", () => {
      const f = s.dataset.field;
      counts[f] = Math.min(10, Math.max(0, counts[f] + Number(b.dataset.step)));
      renderRsvp();
    }));
  });

  function smsLink(text) {
    // iOS wants "&body=", Android wants "?body=".
    const sep = isIOS ? "&" : "?";
    return `sms:${CONFIG.rsvpPhone ? "+" + CONFIG.rsvpPhone : ""}${sep}body=${encodeURIComponent(text)}`;
  }
  function waLink(text) {
    return `https://wa.me/${CONFIG.whatsappPhone}?text=${encodeURIComponent(text)}`;
  }

  async function sendVia(channel) {
    if (!validName()) return;
    const text = rsvpMessage();
    if (channel === "share" && navigator.share) {
      try {
        await navigator.share({ text });
        toast("Thanks! Briella can't wait to see you.");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
      channel = "copy";
    }
    if (channel === "share") channel = CONFIG.rsvpPhone ? "sms" : "copy";
    if (channel === "sms") { location.href = smsLink(text); return; }
    if (channel === "whatsapp") { window.open(waLink(text), "_blank", "noopener"); return; }
    const ok = await copyText(text);
    toast(ok ? "RSVP copied — paste it in your chat with Briella's family." : "Couldn't copy. Please long-press the message to copy it.");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendVia("share");
  });
  $$("[data-rsvp]").forEach((b) => b.addEventListener("click", () => sendVia(b.dataset.rsvp)));

  $("#btn-rsvp").addEventListener("click", () => {
    renderRsvp();
    openSheet($("#dlg-rsvp"));
  });

  renderRsvp();
})();
