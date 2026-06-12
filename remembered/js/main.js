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
  // Recurring demo dates (month is 1-based). Countdown is computed from the
  // real current date, so the widgets genuinely tick.
  const PEOPLE = [
    { emoji: "🎂", name: "Mom", m: 3, d: 15 },
    { emoji: "🎂", name: "Alex Morgan", m: 6, d: 14 },
    { emoji: "🎂", name: "Jordan Lee", m: 8, d: 29 },
    { emoji: "💍", name: "Wedding Anniversary", m: 10, d: 9 },
    { emoji: "🎂", name: "Sam Chen", m: 12, d: 2 },
    { emoji: "🎂", name: "Riley Johnson", m: 1, d: 11 },
    { emoji: "🎂", name: "Casey Davis", m: 2, d: 21 },
    { emoji: "🎂", name: "Avery Martinez", m: 4, d: 30 },
  ];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const upcoming = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return PEOPLE.map((p) => {
      let next = new Date(today.getFullYear(), p.m - 1, p.d);
      if (next < today) next = new Date(today.getFullYear() + 1, p.m - 1, p.d);
      const days = Math.round((next - today) / 86400000);
      return { ...p, days, label: `${MONTHS[p.m - 1]} ${p.d}` };
    }).sort((a, b) => a.days - b.days);
  };

  const cd = (days) => (days === 0 ? "Today" : `${days}d`);

  const renderWidgets = () => {
    const items = upcoming();
    const small = document.querySelector("[data-widget-small]");
    const medium = document.querySelector("[data-widget-medium]");
    if (!small || !medium) return;

    const row = (it, mini) => `
      <div class="wrow">
        <span class="wrow-emoji" aria-hidden="true">${it.emoji}</span>
        <div class="wrow-text">
          <p class="wrow-name">${it.name}</p>
          <p class="wrow-meta">${mini ? `<b>${cd(it.days)}</b>` : `<span>${it.label}</span><b>${cd(it.days)}</b>`}</p>
        </div>
      </div>`;

    small.innerHTML =
      items.slice(0, 3).map((it) => row(it, true)).join("") +
      `<span class="widget-plus" aria-hidden="true">+</span>`;

    medium.innerHTML =
      `<div class="widget-col">${items.slice(0, 3).map((it) => row(it, false)).join("")}</div>` +
      `<div class="widget-col">${items.slice(3, 6).map((it) => row(it, false)).join("")}</div>` +
      `<span class="widget-plus" aria-hidden="true">+</span>`;
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
