/* Remembered — scroll choreography, live widgets, typing demo.
   No dependencies. Everything degrades gracefully without JS or with
   prefers-reduced-motion. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- reveals */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ------------------------------------------------------------------- nav */
  const nav = document.querySelector("[data-nav]");
  const setNav = () => nav.classList.toggle("is-solid", window.scrollY > 24);
  setNav();
  window.addEventListener("scroll", setNav, { passive: true });

  /* -------------------------------------------- scroll-linked transforms */
  const heroDevice = document.querySelector("[data-hero-device] .device");
  const parallaxEls = Array.from(document.querySelectorAll("[data-parallax]"));

  if (!reduceMotion && (heroDevice || parallaxEls.length)) {
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;

      if (heroDevice) {
        // 0 → resting tilt, 1 → flat: the phone "stands up" as you scroll
        const p = Math.min(1, Math.max(0, window.scrollY / (vh * 0.55)));
        const ease = 1 - Math.pow(1 - p, 2);
        heroDevice.style.transform =
          `rotateX(${32 * (1 - ease)}deg) scale(${0.94 + 0.06 * ease}) translateY(${-14 * ease}px)`;
      }

      for (const el of parallaxEls) {
        const max = parseFloat(el.dataset.parallax) || 20;
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const offset = (r.top + r.height / 2 - vh / 2) / vh; // -0.5..0.5-ish
        el.style.transform = `translateY(${(-offset * max).toFixed(2)}px)`;
      }
    };

    const requestTick = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick, { passive: true });
    update();
  }

  /* -------------------------------------------------------- typing demo */
  const pill = document.querySelector("[data-typing]");
  if (pill) {
    const typed = pill.querySelector("[data-typed]");
    const chip = pill.querySelector("[data-chip]");
    const send = document.querySelector("[data-send]");
    const PHRASE = "Mom bday 3/15";
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (reduceMotion) {
      // static final state: chip + parsed text
      pill.classList.remove("is-empty");
      chip.classList.add("is-on");
      typed.textContent = "bday 3/15";
    } else {
      let running = false;
      let inView = false;

      const loop = async () => {
        if (running) return;
        running = true;
        while (inView) {
          pill.classList.add("is-empty");
          chip.classList.remove("is-on");
          send.classList.remove("is-armed");
          typed.textContent = "";
          await sleep(1100);
          if (!inView) break;

          pill.classList.remove("is-empty");
          for (const ch of PHRASE) {
            typed.textContent += ch;
            await sleep(48 + Math.random() * 70);
          }
          await sleep(650);
          if (!inView) break;

          // "Mom " collapses into a chip — the parsing moment
          chip.classList.add("is-on");
          typed.textContent = "bday 3/15";
          await sleep(550);

          send.classList.add("is-armed");
          await sleep(1700);
        }
        running = false;
      };

      const pillIO = new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting;
          if (inView) loop();
        },
        { threshold: 0.4 }
      );
      pillIO.observe(pill);
    }
  }

  /* ------------------------------------------------------- live widgets */
  // Demo cast (the same one the App Store shots use). Each person's recurring
  // date is anchored relative to page-load day so the cascade always shows its
  // proximity ramp; countdowns are then computed live from the real date, so
  // they genuinely tick over midnight.
  const CAST = [
    { name: "Alex Morgan", off: 2 },
    { name: "Jordan Lee", off: 5 },
    { name: "Wedding Anniversary", off: 8 },
    { name: "Sam Chen", off: 8 },
    { name: "Riley Johnson", off: 12 },
    { name: "Casey Davis", off: 18 },
    { name: "Morgan Kim", off: 25 },
    { name: "Avery Martinez", off: 32 },
  ];
  const loadDay = new Date();
  const PEOPLE = CAST.map((p) => {
    const dt = new Date(loadDay.getFullYear(), loadDay.getMonth(), loadDay.getDate() + p.off);
    return { name: p.name, m: dt.getMonth() + 1, d: dt.getDate() };
  });

  const upcoming = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return PEOPLE.map((p) => {
      let next = new Date(today.getFullYear(), p.m - 1, p.d);
      if (next < today) next = new Date(today.getFullYear() + 1, p.m - 1, p.d);
      const days = Math.round((next - today) / 86400000);
      return { ...p, days };
    }).sort((a, b) => a.days - b.days);
  };

  // The cascade, ported from the shipping widget (WidgetPortraitKit.swift):
  // the nearest name IS the countdown — type size falls off with distance,
  // depth color recedes with rank, day numerals go gold inside a week.
  const TIER = { small: { max: 29, mid: 12, min: 11 }, medium: { max: 31, mid: 12.5, min: 11.5 } };
  const rawSize = (days, t) =>
    days <= 3 ? t.max : days <= 7 ? t.max * 0.66 : days <= 30 ? t.max * 0.44 : days <= 60 ? t.mid : t.min;
  const weight = (days) => (days <= 3 ? 800 : days <= 30 ? 700 : 600);
  const DEPTH = [
    "var(--text-1)",
    "rgba(242, 237, 230, 0.94)",
    "rgba(217, 212, 201, 0.92)",
    "rgba(189, 184, 173, 0.9)",
    "rgba(184, 179, 168, 0.85)",
  ];
  const depth = (rank) => DEPTH[Math.min(rank, DEPTH.length - 1)];
  const firstName = (name) => name.split(" ")[0];

  const numeral = (days) =>
    days === 0
      ? `<span class="crow-days crow-days--today">Today</span>`
      : `<span class="crow-days${days <= 7 ? " crow-days--near" : ""}">${days}<i>d</i></span>`;

  const crow = (it, rank, t, narrow) => {
    const size = rawSize(it.days, t);
    // Like FittedName: big ramp rows fit the first name; small rows keep the
    // full title unless the column is too narrow for it.
    const label = size > t.max * 0.5 || (narrow && it.name.length > 14) ? firstName(it.name) : it.name;
    return `<div class="crow" style="font-size:${size}px">` +
      `<span class="crow-name" style="font-weight:${weight(it.days)};color:${depth(rank)}">${label}</span>` +
      numeral(it.days) + `</div>`;
  };

  const renderWidgets = () => {
    const items = upcoming();
    const small = document.querySelector("[data-widget-small]");
    const medium = document.querySelector("[data-widget-medium]");
    if (!small || !medium) return;

    // Small: a fitted stack of the nearest three, then the agate tail line.
    const agate = items.slice(3, 6).map((it) => `${firstName(it.name)} ${it.days}`).join(" · ");
    small.innerHTML =
      items.slice(0, 3).map((it, r) => crow(it, r, TIER.small, true)).join("") +
      `<p class="crow-agate">${agate}</p>`;

    // Medium: greedy column flow like ColumnCascade — fill the left column at
    // each name's proximity size, spill the rest into the right.
    const H = 146; // usable height inside the 176px card
    const cols = [[], []];
    let used = 0, col = 0;
    for (let i = 0; i < items.length && col < 2; i++) {
      const rowH = rawSize(items[i].days, TIER.medium) * 1.18 + (cols[col].length ? 6 : 0);
      if (used + rowH > H && cols[col].length) {
        col++; used = 0;
        if (col >= 2) break;
      }
      cols[col].push(crow(items[i], i, TIER.medium));
      used += rowH;
    }
    medium.innerHTML =
      `<div class="widget-col">${cols[0].join("")}</div>` +
      `<div class="widget-divider" aria-hidden="true"></div>` +
      `<div class="widget-col">${cols[1].join("")}</div>`;
  };

  renderWidgets();
  setInterval(renderWidgets, 60000); // tick over midnight

  /* ------------------------------------------------------------- cake art */
  const cakeHost = document.querySelector("[data-cake]");
  if (cakeHost) {
    fetch("assets/cake.svg")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((svg) => { cakeHost.innerHTML = svg; })
      .catch(() => { /* decorative only */ });
  }
})();
