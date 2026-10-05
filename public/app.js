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

  // ---------- Sound effects (synthesised: no audio files, nothing copyrighted) ----------
  const Sfx = (() => {
    let ctx = null;
    let master = null;
    let muted = false;
    try { muted = localStorage.getItem("briella-muted") === "1"; } catch { /* private mode */ }

    function audio() {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = 1.6;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone(freq, at, dur, { type = "square", vol = 0.15, slideTo } = {}) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(master);
      o.start(at);
      o.stop(at + dur + 0.05);
    }

    function whoosh(at, dur, { from = 300, to = 5000, vol = 0.2, swell = true } = {}) {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(from, at);
      f.frequency.exponentialRampToValueAtTime(to, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + (swell ? dur * 0.85 : 0.02));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f).connect(g).connect(master);
      src.start(at);
      src.stop(at + dur);
    }

    // ---- Background music for the RSVP page: an original 8-bar chiptune loop
    // (I–vi–IV–V in C, 120 bpm, eighth-note grid), scheduled just ahead of time.
    const STEP = 0.25; // one eighth note at 120 bpm
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const MELODY = [
      76, 79, 84, 79, 76, 74, 72, 0,   69, 72, 76, 72, 74, 76, 0, 0,
      77, 76, 74, 72, 69, 72, 74, 0,   74, 79, 77, 76, 74, 71, 67, 0,
      72, 76, 79, 84, 83, 84, 79, 0,   81, 79, 76, 79, 81, 84, 0, 0,
      77, 81, 84, 81, 79, 77, 76, 74,  79, 77, 76, 74, 71, 74, 79, 0,
    ];
    const ROOTS = [48, 45, 41, 43, 48, 45, 41, 43]; // C Am F G ×2
    let bus = null;
    let musicOn = false;
    let nextAt = 0;
    let step = 0;
    let timer = null;

    function schedule() {
      while (nextAt < ctx.currentTime + 0.12) {
        const bar = Math.floor(step / 8) % 8;
        const beat = step % 8;
        const note = MELODY[step % 64];
        if (note) voice(midi(note), nextAt, STEP * 0.9, "square", 0.05);
        const root = ROOTS[bar];
        if (beat % 2 === 0) voice(midi(beat % 4 === 0 ? root : root + 7), nextAt, STEP * 1.6, "triangle", 0.11);
        else hat(nextAt);
        if (beat === 0) [0, 4, 7].forEach((i) => voice(midi(root + 24 + i), nextAt, STEP * 3.5, "sine", 0.018));
        nextAt += STEP;
        step++;
      }
    }
    function voice(freq, at, dur, type, vol) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(bus);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
    let hatBuf = null;
    function hat(at) {
      if (!hatBuf) {
        hatBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
        const d = hatBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      }
      const src = ctx.createBufferSource();
      src.buffer = hatBuf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.value = 0.025;
      src.connect(f).connect(g).connect(bus);
      src.start(at);
    }
    function startMusic(delay = 0) {
      if (musicOn || muted || !audio()) return;
      musicOn = true;
      bus = ctx.createGain();
      bus.connect(master);
      const t = ctx.currentTime + delay;
      bus.gain.setValueAtTime(0.0001, ctx.currentTime);
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(1, t + 1.2);
      nextAt = t;
      step = 0;
      timer = setInterval(schedule, 25);
      schedule();
    }
    function stopMusic() {
      if (!musicOn) return;
      musicOn = false;
      clearInterval(timer);
      const old = bus;
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => old.disconnect(), 800);
    }
    // Don't play in a background tab or a locked phone.
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else if (!muted) ctx.resume();
    });

    return {
      get muted() { return muted; },
      setMuted(m) {
        muted = m;
        try { localStorage.setItem("briella-muted", m ? "1" : "0"); } catch { /* ignore */ }
        if (master) master.gain.setTargetAtTime(m ? 0 : 1.6, ctx.currentTime, 0.02);
        if (m) stopMusic();
      },
      startMusic,
      stopMusic,
      get musicOn() { return musicOn; },
      // Soft blip when the RSVP form opens.
      blip() {
        if (muted || !audio()) return;
        const t = ctx.currentTime + 0.01;
        tone(880, t, 0.07, { type: "triangle", vol: 0.12 });
        tone(1320, t + 0.06, 0.09, { type: "triangle", vol: 0.1 });
      },
      // Little fanfare when an RSVP is saved.
      success() {
        if (muted || !audio()) return;
        const t = ctx.currentTime + 0.02;
        [[784, 0], [988, 0.09], [1175, 0.18], [1568, 0.27]].forEach(([f, o]) =>
          tone(f, t + o, o === 0.27 ? 0.45 : 0.1, { vol: 0.09 }));
        [2637, 3136, 3951].forEach((f, i) => tone(f, t + 0.32 + i * 0.05, 0.3, { type: "sine", vol: 0.05 }));
      },
      // Timed to the opening animation: press → burst (~0.18s) → flash (~0.7s) → reveal.
      open(short) {
        if (muted || !audio()) return;
        const t = ctx.currentTime + 0.02;
        tone(1900, t, 0.035, { vol: 0.1 });                      // button click
        tone(950, t + 0.03, 0.05, { vol: 0.08 });
        if (!short) {
          whoosh(t + 0.16, 0.56, { from: 260, to: 5200, vol: 0.2 }); // rising whoosh
          tone(196, t + 0.16, 0.56, { type: "sawtooth", vol: 0.035, slideTo: 880 });
        }
        const p = t + (short ? 0.08 : 0.72);
        tone(1320, p, 0.28, { type: "triangle", vol: 0.22, slideTo: 330 }); // pop
        whoosh(p, 0.4, { from: 7000, to: 1400, vol: 0.14, swell: false });
        [2093, 2637, 3136, 4186, 3520].forEach((f, i) =>             // sparkles
          tone(f, p + 0.07 + i * 0.055, 0.32, { type: "sine", vol: 0.07 }));
        // Short original victory jingle.
        const j = p + 0.34;
        [[523, 0, 0.1], [659, 0.11, 0.1], [784, 0.22, 0.1], [1047, 0.33, 0.16],
         [880, 0.52, 0.1], [988, 0.63, 0.1], [1047, 0.74, 0.5]].forEach(([f, o, d]) =>
          tone(f, j + o, d, { vol: 0.085 }));
        tone(262, j, 0.42, { type: "triangle", vol: 0.13 });
        tone(349, j + 0.52, 0.2, { type: "triangle", vol: 0.12 });
        tone(392, j + 0.74, 0.55, { type: "triangle", vol: 0.13 });
      },
    };
  })();

  const soundBtn = $("#sound-toggle");
  function renderSound() {
    soundBtn.setAttribute("aria-pressed", String(!Sfx.muted));
    soundBtn.setAttribute("aria-label", Sfx.muted ? "Sound off. Tap to turn sound on" : "Sound on. Tap to turn sound off");
    soundBtn.classList.toggle("is-muted", Sfx.muted);
  }
  soundBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Sfx.setMuted(!Sfx.muted);
    if (!Sfx.muted && !invite.hidden) Sfx.startMusic(0.1);
    renderSound();
  });
  renderSound();

  const intro = $("#intro");
  const ball = $("#ball");
  const flash = $("#flash");
  const invite = $("#invite");
  const slides = $$(".slide");

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
  // The details page has no src until reveal, so it can't flash early.
  const supportsWebp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  const artReady = Promise.all(slides.map((slide) => {
    const url = supportsWebp ? $("source", slide).dataset.srcset : $("img", slide).dataset.src;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
  }));

  function mountArt() {
    slides.forEach((slide) => {
      const img = $("img", slide);
      if (img.getAttribute("src")) return;
      const source = $("source", slide);
      source.srcset = source.dataset.srcset;
      img.src = img.dataset.src;
    });
  }

  // ---------- "RSVP & party info" cue while the buttons are below the fold ----------
  const cue = $("#scroll-cue");
  const panelEl = $(".panel");
  let panelSeen = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      panelSeen = entries.some((e) => e.isIntersecting);
      cue.hidden = panelSeen || invite.hidden;
    }, { threshold: 0.01, rootMargin: "0px 0px -40px 0px" }).observe($("#btn-rsvp"));
  }
  cue.addEventListener("click", () => {
    panelEl.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  });

  // ---------- Opening sequence ----------
  let opening = false;

  async function openBall() {
    if (opening) return;
    opening = true;
    // Must run synchronously inside the tap so mobile browsers allow audio.
    Sfx.open(reduceMotion());
    if (navigator.vibrate) navigator.vibrate(30);

    if (reduceMotion()) {
      await Promise.race([artReady, wait(2500)]);
      showInvite(false);
      Sfx.startMusic(1.4);
      return;
    }

    ball.classList.add("is-pressed");
    await wait(180);
    ball.classList.add("is-open");
    if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
    await wait(520);

    // Don't flash into an empty page on a slow connection.
    await Promise.race([artReady, wait(2500)]);
    flash.classList.remove("is-off");
    flash.classList.add("is-on");
    await wait(200);

    showInvite(true);
    flash.classList.remove("is-on");
    flash.classList.add("is-off");
    Sfx.startMusic(1.5); // after the opening jingle finishes
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
    requestAnimationFrame(() => { cue.hidden = panelSeen; });
    $("#invite-heading").focus({ preventScroll: true });
  }

  function replay() {
    Sfx.stopMusic();
    opening = false;
    cue.hidden = true;
    invite.hidden = true;
    invite.classList.remove("is-revealing");
    document.body.classList.remove("is-revealed");
    ball.classList.remove("is-pressed", "is-open");
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

  // "share" = chat apps (WhatsApp, Messenger, Viber…) via the phone's share
  // sheet; "sms" = text message to CONFIG.rsvpPhone; "copy" = clipboard.
  async function sendVia(channel) {
    if (!validName()) return;
    const text = rsvpMessage();
    if (channel === "sms") { location.href = smsLink(text); return; }
    if (channel === "share" && navigator.share) {
      try {
        await navigator.share({ text });
        toast("Thanks! Briella can't wait to see you.");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    // No share sheet (e.g. desktop browsers): copy so they can paste it.
    const ok = await copyText(text);
    toast(ok
      ? "RSVP copied — paste it in WhatsApp, Messenger or Viber."
      : "Couldn't copy. Please long-press the message to copy it.");
  }

  // ---------- Save RSVP to the host's guest list ----------
  const stepForm = $("#rsvp-step-form");
  const stepDone = $("#rsvp-step-done");
  const submitBtn = $("#rsvp-submit");
  const submitErr = $("#rsvp-submit-err");

  function showStep(done) {
    stepForm.hidden = done;
    stepDone.hidden = !done;
    $("#dlg-rsvp").scrollTop = 0;
  }

  async function saveRsvp() {
    const res = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput.value.trim(),
        attending: attending() ? "yes" : "no",
        kids: counts.kids,
        adults: counts.adults,
        note: $("#rsvp-note").value.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validName()) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    submitErr.hidden = true;
    const first = nameInput.value.trim().split(/\s+/)[0];
    try {
      await saveRsvp();
      Sfx.success();
      $("#rsvp-done-title").textContent = attending() ? `Got it, ${first}! See you there!` : `Thanks for letting us know, ${first}.`;
      $("#rsvp-done-sub").textContent = attending()
        ? "Briella's family has your RSVP."
        : "Briella's family has your RSVP. You'll be missed!";
      $("#rsvp-extra-label").innerHTML = "Want to message them too? <em>(optional)</em>";
      $("#rsvp-done-emoji").textContent = attending() ? "🎉" : "💙";
    } catch (err) {
      // Saving failed: the chat/text options become the way to RSVP.
      $("#rsvp-done-title").textContent = "Almost there!";
      $("#rsvp-done-emoji").textContent = "📨";
      $("#rsvp-done-sub").textContent = "We couldn't save your RSVP online. Please send it by chat or text below.";
      $("#rsvp-extra-label").textContent = "Send your RSVP by…";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send RSVP";
    }
    renderRsvp();
    showStep(true);
    $("#rsvp-done-title").focus({ preventScroll: true });
  });

  $("#rsvp-edit").addEventListener("click", () => {
    showStep(false);
    nameInput.focus();
  });
  if (CONFIG.rsvpPhone) {
    const local = "0" + CONFIG.rsvpPhone.slice(2);
    $("#rsvp-sms-to").textContent = `SMS to ${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  $$("[data-rsvp]").forEach((b) => b.addEventListener("click", () => sendVia(b.dataset.rsvp)));

  $("#btn-rsvp").addEventListener("click", () => {
    Sfx.blip();
    showStep(false);
    renderRsvp();
    openSheet($("#dlg-rsvp"));
  });

  renderRsvp();
})();
