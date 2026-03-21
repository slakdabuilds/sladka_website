/* ─────────────────────────────────────────────
   SLADKA — Landing Page JS
   Scroll-driven canvas + GSAP animations
───────────────────────────────────────────── */

const FRAME_COUNT = 121;
const FRAME_SPEED = 2.0; // product animation finishes at ~50% scroll

// DOM refs
const canvasEl    = document.getElementById('canvas');
const ctx         = canvasEl.getContext('2d');
const canvasWrap  = document.getElementById('canvas-wrap');
const scrollCont  = document.getElementById('scroll-container');
const heroEl      = document.getElementById('hero');
const loaderEl    = document.getElementById('loader');
const loaderBar   = document.getElementById('loader-bar');
const loaderPct   = document.getElementById('loader-percent');
const darkOverlay = document.getElementById('dark-overlay');
const marqueeWrap = document.getElementById('marquee');
const marqueeText = marqueeWrap.querySelector('.marquee-text');

const frames = new Array(FRAME_COUNT).fill(null);
let currentFrame  = 0;
let loadedCount   = 0;

// ─── CANVAS SETUP ───────────────────────────

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width  = window.innerWidth  * dpr;
  canvasEl.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFrame(currentFrame);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── FRAME DRAWING ──────────────────────────
// Video occupies the right 2/3 of the canvas; left 1/3 stays black for text

const VIDEO_START_X = 0.33; // left edge of video zone (33% from left)

function drawFrame(index) {
  const img = frames[index];
  if (!img) return;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const mirror = window.VIDEO_MIRROR === true;

  // Always fill entire canvas pure black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, cw, ch);

  // Mirror = video on LEFT 2/3 (Arabic), normal = video on RIGHT 2/3 (English)
  const zoneLeft  = mirror ? 0 : Math.floor(cw * VIDEO_START_X);
  const zoneWidth = mirror ? Math.floor(cw * (1 - VIDEO_START_X)) : cw - Math.floor(cw * VIDEO_START_X);
  const zoneRight = zoneLeft + zoneWidth;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(zoneWidth / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = zoneLeft + (zoneWidth - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(zoneLeft, 0, zoneWidth, ch);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();

  // Gradient fade on the edge that faces the text zone
  const fadeWidth = Math.floor(cw * 0.14);
  if (mirror) {
    // Fade right edge of video (video left, text right)
    const grad = ctx.createLinearGradient(zoneRight - fadeWidth, 0, zoneRight, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(zoneRight - fadeWidth, 0, fadeWidth, ch);
  } else {
    // Fade left edge of video (video right, text left)
    const grad = ctx.createLinearGradient(zoneLeft, 0, zoneLeft + fadeWidth, 0);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(zoneLeft, 0, fadeWidth, ch);
  }
}

// ─── FRAME LOADING ──────────────────────────

function loadFrame(index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      frames[index] = img;
      loadedCount++;
      const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
      loaderBar.style.width = pct + '%';
      loaderPct.textContent = pct + '%';
      resolve();
    };
    img.onerror = () => { loadedCount++; resolve(); };
    img.src = `${window.FRAMES_PATH || 'frames/'}frame_${String(index + 1).padStart(4, '0')}.webp`;
  });
}

async function preloadFrames() {
  // Phase 1: first 12 frames — fast first paint
  const phase1 = [];
  for (let i = 0; i < Math.min(12, FRAME_COUNT); i++) phase1.push(loadFrame(i));
  await Promise.all(phase1);
  drawFrame(0);

  // Phase 2: rest in background
  const phase2 = [];
  for (let i = 12; i < FRAME_COUNT; i++) phase2.push(loadFrame(i));
  await Promise.all(phase2);

  // Hide loader
  gsap.to(loaderEl, {
    opacity: 0,
    duration: 0.7,
    delay: 0.3,
    ease: 'power2.inOut',
    onComplete: () => {
      loaderEl.style.display = 'none';
      initAnimations();
    }
  });
}

// ─── LENIS SMOOTH SCROLL ────────────────────

function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ─── MAIN INIT ──────────────────────────────

function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);
  initLenis();

  // Hero entrance
  gsap.to('.hero-heading .word', {
    y: 0,
    opacity: 1,
    stagger: 0.14,
    duration: 1.1,
    ease: 'power4.out',
    delay: 0.1,
  });
  gsap.to(['.hero-label', '.hero-tagline', '.scroll-hint'], {
    opacity: 1,
    y: 0,
    stagger: 0.1,
    duration: 0.9,
    ease: 'power2.out',
    delay: 0.5,
  });

  // Frame scroll binding
  initFrameScroll();

  // Hero → canvas transition
  initHeroTransition();

  // Dark overlay (covers stats section range)
  initDarkOverlay(0.48, 0.68);

  // Marquee
  initMarquee();

  // All scroll sections
  document.querySelectorAll('.scroll-section').forEach(setupSectionAnimation);

  // Counter animations
  initCounters();
}

// ─── FRAME SCROLL ───────────────────────────

function initFrameScroll() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const idx = Math.min(
        Math.floor(accelerated * FRAME_COUNT),
        FRAME_COUNT - 1
      );
      if (idx !== currentFrame) {
        currentFrame = idx;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    },
  });
}

// ─── HERO → CANVAS WIPE ─────────────────────

function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;

      // Hero fades out fast as scroll starts
      heroEl.style.opacity = Math.max(0, 1 - p * 30).toString();

      // Canvas expands from circle — completes quickly (by p=0.04)
      const wipe = Math.min(1, Math.max(0, p / 0.04));
      const radius = wipe * 80;
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    },
  });
}

// ─── DARK OVERLAY ───────────────────────────

function initDarkOverlay(enter, leave) {
  const fade = 0.04;
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= enter - fade && p <= enter) {
        opacity = (p - (enter - fade)) / fade;
      } else if (p > enter && p < leave) {
        opacity = 1;
      } else if (p >= leave && p <= leave + fade) {
        opacity = 1 - (p - leave) / fade;
      }
      darkOverlay.style.opacity = opacity.toString();
    },
  });
}

// ─── MARQUEE ────────────────────────────────

function initMarquee() {
  // Slide on scroll
  gsap.to(marqueeText, {
    xPercent: -28,
    ease: 'none',
    scrollTrigger: {
      trigger: scrollCont,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  });

  // Fade in/out
  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= 0.36 && p <= 0.40) opacity = (p - 0.36) / 0.04;
      else if (p > 0.40 && p < 0.58) opacity = 1;
      else if (p >= 0.58 && p <= 0.62) opacity = 1 - (p - 0.58) / 0.04;
      marqueeWrap.style.opacity = opacity.toString();
    },
  });
}

// ─── SECTION ANIMATIONS ─────────────────────

function setupSectionAnimation(section) {
  const type    = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter   = parseFloat(section.dataset.enter) / 100;
  const leave   = parseFloat(section.dataset.leave) / 100;

  const children = Array.from(
    section.querySelectorAll(
      '.section-label, .section-heading, .section-body, ' +
      '.cta-button, .stat, .stat-divider'
    )
  );
  if (!children.length) return;

  // Hide section and children until their scroll range is reached
  gsap.set(section, { opacity: 0 });
  gsap.set(children, getInitialState(type));

  const tl = gsap.timeline({ paused: true });

  switch (type) {
    case 'fade-up':
      tl.to(children, { y: 0, opacity: 1, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-left':
      tl.to(children, { x: 0, opacity: 1, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.to(children, { x: 0, opacity: 1, stagger: 0.14, duration: 0.9, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.to(children, { scale: 1, opacity: 1, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'stagger-up':
      tl.to(children, { y: 0, opacity: 1, stagger: 0.16, duration: 0.85, ease: 'power3.out' });
      break;
  }

  ScrollTrigger.create({
    trigger: scrollCont,
    start: 'top top',
    end: 'bottom bottom',
    scrub: false,
    onUpdate: (self) => {
      const p = self.progress;
      const inRange   = p >= enter && p <= leave;
      const pastLeave = p > leave;

      if (inRange) {
        section.style.opacity = '1';
        section.style.pointerEvents = persist ? 'auto' : 'none';
        const sectionProgress = (p - enter) / (leave - enter);
        tl.progress(Math.min(sectionProgress * 4, 1));
      } else if (pastLeave && persist) {
        section.style.opacity = '1';
        section.style.pointerEvents = 'auto';
        tl.progress(1);
      } else {
        section.style.opacity = '0';
        section.style.pointerEvents = 'none';
        tl.progress(0);
      }
    },
  });
}

function getInitialState(type) {
  switch (type) {
    case 'fade-up':    return { y: 50,  opacity: 0 };
    case 'slide-left': return { x: -80, opacity: 0 };
    case 'slide-right':return { x: 80,  opacity: 0 };
    case 'scale-up':   return { scale: 0.84, opacity: 0 };
    case 'stagger-up': return { y: 60,  opacity: 0 };
    default:           return { opacity: 0 };
  }
}

// ─── COUNTER ANIMATIONS ─────────────────────

function initCounters() {
  document.querySelectorAll('.stat-number').forEach((el) => {
    const target   = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const obj = { val: 0 };

    // triggered when the dark overlay brings this section into view
    ScrollTrigger.create({
      trigger: scrollCont,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const p = self.progress;
        // stats section: enter 0.50, leave 0.66
        if (p >= 0.50 && p <= 0.66 && parseFloat(el.textContent) < target && !el.dataset.counted) {
          el.dataset.counted = 'true';
          gsap.to(obj, {
            val: target,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => { el.textContent = obj.val.toFixed(decimals); },
          });
        }
      },
    });
  });
}

// ─── BOOT ───────────────────────────────────

preloadFrames();
