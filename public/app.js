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

  // ---------- Sound (synthesised in the style of Game Boy-era music) ----------
  // Pulse-wave leads, wave-channel bass and noise drums, like the original
  // handheld sound chip. All melodies are original compositions; nothing is
  // copied from any game soundtrack.
  const Sfx = (() => {
    let ctx = null;
    let master = null;
    let muted = false;
    const LEVEL = 0.9;
    try { muted = localStorage.getItem("briella-muted") === "1"; } catch { /* private mode */ }

    const waves = {};
    let noiseBuf = null;

    function audio() {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = LEVEL;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 3;
        master.connect(comp).connect(ctx.destination);
        // Pulse waves at the chip's duty cycles (12.5%, 25%, 50%).
        [0.125, 0.25, 0.5].forEach((duty) => {
          const n = 48;
          const real = new Float32Array(n);
          const imag = new Float32Array(n);
          for (let k = 1; k < n; k++) real[k] = (4 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
          waves[duty] = ctx.createPeriodicWave(real, imag);
        });
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    // One chip voice. `wave` is a duty (0.125/0.25/0.5) or an oscillator type.
    function note(dest, freq, at, dur, { wave = 0.25, vol = 0.1, slideTo, vibrato = false, release = 0.03 } = {}) {
      const o = ctx.createOscillator();
      if (typeof wave === "number") o.setPeriodicWave(waves[wave]); else o.type = wave;
      o.frequency.setValueAtTime(freq, at);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
      if (vibrato && dur > 0.28) {
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 5.6;
        depth.gain.setValueAtTime(0, at);
        depth.gain.linearRampToValueAtTime(freq * 0.012, at + 0.22);
        lfo.connect(depth).connect(o.frequency);
        lfo.start(at);
        lfo.stop(at + dur + release);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, at);
      g.gain.setValueAtTime(vol, at + Math.max(0.005, dur - release));
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(dest);
      o.start(at);
      o.stop(at + dur + 0.02);
    }

    function noise(dest, at, dur, { vol = 0.1, type = "highpass", freq = 6000, q = 0.7, sweepTo } = {}) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, at);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f).connect(g).connect(dest);
      src.start(at, Math.random() * 0.5);
      src.stop(at + dur + 0.02);
    }

    const kick = (dest, at) => {
      note(dest, 150, at, 0.12, { wave: "sine", vol: 0.5, slideTo: 45, release: 0.08 });
      noise(dest, at, 0.03, { vol: 0.12, type: "lowpass", freq: 1500 });
    };
    const snare = (dest, at, vol = 0.2) => {
      noise(dest, at, 0.13, { vol, type: "bandpass", freq: 2600, q: 0.6 });
      note(dest, 220, at, 0.06, { wave: "triangle", vol: 0.12, slideTo: 140 });
    };
    const hat = (dest, at, vol = 0.05) => noise(dest, at, 0.035, { vol, freq: 8000 });

    // ---------------- Music: original adventure-route theme ----------------
    const STEP = 60 / 150 / 4;          // 16th note at 150 bpm
    // [step, midi, length in steps] per bar (16 steps).
    const A = [
      [[0, 67, 2], [2, 72, 2], [4, 76, 2], [6, 79, 6], [12, 76, 2], [14, 79, 2]],
      [[0, 77, 4], [4, 74, 2], [6, 77, 2], [8, 82, 6], [14, 81, 2]],
      [[0, 81, 4], [4, 79, 2], [6, 77, 2], [8, 76, 4], [12, 77, 2], [14, 79, 2]],
      [[0, 79, 6], [6, 76, 2], [8, 74, 6], [14, 71, 2]],
      [[0, 67, 2], [2, 72, 2], [4, 76, 2], [6, 79, 4], [10, 84, 4], [14, 83, 2]],
      [[0, 82, 6], [6, 81, 2], [8, 79, 4], [12, 77, 4]],
      [[0, 77, 2], [2, 79, 2], [4, 81, 4], [8, 84, 4], [12, 81, 2], [14, 79, 2]],
      [[0, 79, 8], [8, 74, 2], [10, 79, 2], [12, 83, 4]],
    ];
    const B = [
      [[0, 76, 4], [4, 72, 2], [6, 76, 2], [8, 81, 6], [14, 79, 2]],
      [[0, 77, 4], [4, 81, 4], [8, 84, 6], [14, 81, 2]],
      [[0, 83, 4], [4, 79, 2], [6, 83, 2], [8, 86, 4], [12, 83, 2], [14, 79, 2]],
      [[0, 84, 8], [8, 79, 4], [12, 76, 4]],
      [[0, 81, 2], [2, 84, 2], [4, 81, 2], [6, 76, 2], [8, 72, 4], [12, 76, 4]],
      [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2], [8, 84, 4], [12, 86, 4]],
      [[0, 86, 4], [4, 83, 4], [8, 79, 4], [12, 74, 2], [14, 79, 2]],
      [[0, 77, 2], [2, 79, 2], [4, 83, 2], [6, 86, 2], [8, 83, 4], [12, 79, 4]],
    ];
    const SONG = [...A, ...B];
    // Chord root per bar (bass), and whether the bar uses B-flat (for harmony).
    const ROOTS = [36, 34, 41, 43, 36, 34, 41, 43, 33, 41, 43, 36, 33, 41, 43, 43];
    const FLAT_B = [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Diatonic third below (C major / C mixolydian on B-flat bars).
    function thirdBelow(m, flatB) {
      const scale = flatB ? [0, 2, 4, 5, 7, 9, 10] : [0, 2, 4, 5, 7, 9, 11];
      const pc = ((m % 12) + 12) % 12;
      let i = scale.indexOf(pc);
      if (i < 0) return m - 3;
      const j = (i + 5) % 7;
      let down = pc - scale[j];
      if (down <= 0) down += 12;
      return m - down;
    }

    let bus = null;
    let musicOn = false;
    let nextAt = 0;
    let step = 0;
    let timer = null;

    function scheduleBar(bar, at, intro) {
      const melody = intro
        ? [[0, 72, 1], [1, 76, 1], [2, 79, 1], [3, 84, 5], [8, 82, 2], [10, 84, 6]]
        : SONG[bar];
      const root = intro ? 36 : ROOTS[bar];
      const flat = intro ? 0 : FLAT_B[bar];
      melody.forEach(([s, m, len]) => {
        const t = at + s * STEP;
        const d = len * STEP;
        note(bus, hz(m), t, d * 0.94, { wave: 0.25, vol: 0.085, vibrato: true });
        note(bus, hz(thirdBelow(m, flat)), t, d * 0.9, { wave: 0.125, vol: 0.045 });
      });
      for (let s = 0; s < 16; s += 2) {                 // octave-bounce bass
        const m = root + (s % 4 === 2 ? 12 : 0);
        note(bus, hz(m), at + s * STEP, STEP * 1.8, { wave: "triangle", vol: 0.24 });
      }
      for (let s = 0; s < 16; s++) {                    // drums
        const t = at + s * STEP;
        if (s === 0 || s === 8 || (s === 10 && bar % 2)) kick(bus, t);
        if (s === 4 || s === 12) snare(bus, t);
        if (s % 2 === 0) hat(bus, t, s % 4 === 2 ? 0.06 : 0.035);
      }
      if (intro) [12, 13, 14, 15].forEach((s, i) => snare(bus, at + s * STEP, 0.08 + i * 0.04));
      else if (bar === 7 || bar === 15) [14, 15].forEach((s) => snare(bus, at + s * STEP, 0.14));
    }

    function schedule() {
      while (nextAt < ctx.currentTime + 0.25) {
        if (step === 0) scheduleBar(0, nextAt, true);
        else scheduleBar((step - 1) % SONG.length, nextAt, false);
        nextAt += 16 * STEP;
        step++;
      }
    }

    function startMusic(delay = 0) {
      if (musicOn || muted || !audio()) return;
      musicOn = true;
      bus = ctx.createGain();
      // light echo, like the stereo-delay trick on the handheld
      const echo = ctx.createDelay(1);
      echo.delayTime.value = STEP * 3;
      const fb = ctx.createGain();
      fb.gain.value = 0.22;
      const wet = ctx.createGain();
      wet.gain.value = 0.18;
      bus.connect(master);
      bus.connect(echo);
      echo.connect(fb).connect(echo);
      echo.connect(wet).connect(master);
      const t = ctx.currentTime + delay;
      bus.gain.setValueAtTime(0.0001, ctx.currentTime);
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.linearRampToValueAtTime(0.5, t + 0.4);
      nextAt = t;
      step = 0;
      timer = setInterval(schedule, 40);
      schedule();
      bus._echo = [echo, fb, wet];
    }

    function stopMusic() {
      if (!musicOn) return;
      musicOn = false;
      clearInterval(timer);
      const old = bus;
      old.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => { old.disconnect(); old._echo.forEach((n) => n.disconnect()); }, 900);
    }

    // Don't play in a background tab or on a locked phone.
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else if (!muted) ctx.resume();
    });

    return {
      get muted() { return muted; },
      get musicOn() { return musicOn; },
      setMuted(m) {
        muted = m;
        try { localStorage.setItem("briella-muted", m ? "1" : "0"); } catch { /* ignore */ }
        if (master) master.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.02);
        if (m) stopMusic();
      },
      startMusic,
      stopMusic,

      // Timed to the opening: press → burst (~0.18s) → flash (~0.7s) → reveal.
      open(short) {
        if (muted || !audio()) return;
        const t = ctx.currentTime + 0.02;
        // menu "bip-bip"
        note(master, hz(91), t, 0.05, { wave: 0.5, vol: 0.12 });
        note(master, hz(96), t + 0.06, 0.07, { wave: 0.5, vol: 0.12 });
        let p = t + 0.14;
        if (!short) {
          // Poké Ball release: fast rising arpeggio sweep with sparkle
          const run = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96];
          run.forEach((m, i) => note(master, hz(m), p + i * 0.045, 0.06, { wave: 0.125, vol: 0.1 }));
          note(master, hz(48), p, 0.5, { wave: 0.5, vol: 0.05, slideTo: hz(84) });
          noise(master, p, 0.5, { vol: 0.08, type: "bandpass", freq: 800, sweepTo: 9000, q: 1.5 });
          p = t + 0.72;
        }
        // pop at the flash
        noise(master, p, 0.3, { vol: 0.22, type: "lowpass", freq: 9000, sweepTo: 600 });
        note(master, hz(84), p, 0.22, { wave: 0.25, vol: 0.12, slideTo: hz(60) });
        [96, 100, 103, 108].forEach((m, i) => note(master, hz(m), p + 0.05 + i * 0.04, 0.12, { wave: "sine", vol: 0.06 }));
        // "item get"-style fanfare (original)
        const f = p + 0.3;
        const S = 0.11;
        [[72, 0, 1], [72, 1, 1], [72, 2, 1], [76, 3, 3], [74, 6, 1], [76, 7, 1], [79, 8, 6]].forEach(([m, s, l]) => {
          note(master, hz(m), f + s * S, l * S * 0.92, { wave: 0.25, vol: 0.1, vibrato: l > 2 });
          note(master, hz(m - (m === 79 ? 3 : 4)), f + s * S, l * S * 0.9, { wave: 0.125, vol: 0.05 });
        });
        [[48, 0, 3], [53, 3, 3], [55, 6, 2], [48, 8, 6]].forEach(([m, s, l]) =>
          note(master, hz(m), f + s * S, l * S * 0.95, { wave: "triangle", vol: 0.22 }));
        snare(master, f + 8 * S, 0.12);
        kick(master, f + 8 * S);
      },

      // A-button style select sound (RSVP form opens).
      blip() {
        if (muted || !audio()) return;
        const t = ctx.currentTime + 0.01;
        note(master, hz(88), t, 0.045, { wave: 0.5, vol: 0.11 });
        note(master, hz(95), t + 0.05, 0.06, { wave: 0.5, vol: 0.11 });
      },

      // Level-up style chime (RSVP saved).
      success() {
        if (muted || !audio()) return;
        const t = ctx.currentTime + 0.02;
        const S = 0.085;
        [[79, 0, 1], [83, 1, 1], [86, 2, 1], [91, 3, 2], [88, 5, 1], [91, 6, 5]].forEach(([m, s, l]) => {
          note(master, hz(m), t + s * S, l * S * 0.92, { wave: 0.25, vol: 0.1, vibrato: l > 2 });
          note(master, hz(m - 4), t + s * S, l * S * 0.9, { wave: 0.125, vol: 0.045 });
        });
        note(master, hz(55), t, 3 * S, { wave: "triangle", vol: 0.2 });
        note(master, hz(43), t + 3 * S, 8 * S, { wave: "triangle", vol: 0.2 });
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
      Sfx.startMusic(1.9);
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
    Sfx.startMusic(1.75); // right after the opening fanfare
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

  let rsvpNotSaved = false; // true when the RSVP is still waiting to reach the server

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
    if (rsvpNotSaved) lines.push("", "⚠️ Not saved online yet. Please add me to the guest list.");
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

  // ---- Delivery that never drops an RSVP ----
  // Each submission gets an id; the server ignores repeats of the same id, so
  // retrying is always safe. Failed submissions wait on the phone and are
  // resent automatically the next time the invitation is opened.
  const PENDING_KEY = "briella-rsvp-pending";

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  function deviceId() {
    try {
      let id = localStorage.getItem("briella-device");
      if (!id) { id = randomId(); localStorage.setItem("briella-device", id); }
      return id;
    } catch { return ""; }
  }
  function readPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
  }
  function writePending(list) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
  }

  async function postOnce(payload, timeoutMs) {
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined,
        keepalive: true,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return "ok";
      if (res.status === 400) return "invalid";
      return "retry";
    } catch {
      return "retry";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function deliver(payload) {
    const waits = [0, 1000, 2500, 5000];
    for (const w of waits) {
      if (w) await wait(w);
      const r = await postOnce(payload, 10000);
      if (r !== "retry") return r;
    }
    return "retry";
  }

  async function flushPending() {
    const list = readPending();
    if (!list.length) return;
    const left = [];
    for (const p of list) {
      const r = await deliver(p);
      if (r === "retry") left.push(p);
    }
    writePending(left);
  }
  flushPending();
  window.addEventListener("online", flushPending);

  async function saveRsvp() {
    const payload = {
      rid: randomId(),
      did: deviceId(),
      name: nameInput.value.trim(),
      attending: attending() ? "yes" : "no",
      kids: counts.kids,
      adults: counts.adults,
      note: $("#rsvp-note").value.trim(),
    };
    // Keep a copy on the phone until the server confirms it.
    writePending([...readPending(), payload]);
    const r = await deliver(payload);
    if (r === "ok" || r === "invalid") writePending(readPending().filter((p) => p.rid !== payload.rid));
    if (r !== "ok") throw new Error(r);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validName()) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending… please wait";
    submitErr.hidden = true;
    const first = nameInput.value.trim().split(/\s+/)[0];
    try {
      await saveRsvp();
      rsvpNotSaved = false;
      Sfx.success();
      $("#rsvp-done-title").textContent = attending() ? `Got it, ${first}! See you there!` : `Thanks for letting us know, ${first}.`;
      $("#rsvp-done-sub").textContent = attending()
        ? "Briella's family has your RSVP."
        : "Briella's family has your RSVP. You'll be missed!";
      $("#rsvp-extra-label").innerHTML = "Want to message them too? <em>(optional)</em>";
      $("#rsvp-done-emoji").textContent = attending() ? "🎉" : "💙";
    } catch (err) {
      // Still not saved after several tries: it stays on this phone and is
      // resent automatically next visit. Meanwhile ask for a text, marked so
      // the host knows to add it.
      rsvpNotSaved = true;
      $("#rsvp-done-title").textContent = "Almost there!";
      $("#rsvp-done-emoji").textContent = "📨";
      $("#rsvp-done-sub").textContent = "Your connection dropped, so we couldn't save your RSVP yet. We'll retry automatically. To be safe, please also send it by chat or text below.";
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
