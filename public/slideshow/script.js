const gsap = window.gsap;
const deck = document.querySelector(".deck");
const slides = Array.from(document.querySelectorAll(".slide"));
const dotsHost = document.querySelector(".slide-dots");
const progressFill = document.querySelector(".progress-fill");
const currentLabel = document.querySelector(".current");
const totalLabel = document.querySelector(".total");
const pauseLabel = document.querySelector(".pause-state");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const copyStorageKey = "public-insights-slideshow-copy-v1";

const visualTextBindings = [
  {
    stream1: ".stream-a span",
    stream1Meta: ".stream-a small",
    stream2: ".stream-b span",
    stream2Meta: ".stream-b small",
    stream3: ".stream-c span",
    stream3Meta: ".stream-c small",
    signal1: ".signal-one strong",
    signal1Meta: ".signal-one small",
    signal2: ".signal-two strong",
    signal2Meta: ".signal-two small",
    signal3: ".signal-three strong",
    signal3Meta: ".signal-three small",
  },
  {
    source1: ".source-news strong",
    source2: ".source-forum strong",
    source3: ".source-reddit strong",
    source4: ".source-social strong",
  },
  {
    comment1: ".raw-comments article:nth-child(1)",
    comment2: ".raw-comments article:nth-child(2)",
    comment3: ".raw-comments article:nth-child(3)",
    aiLabel: ".ai-coding strong",
    bucket1: ".bucket:nth-child(1)",
    bucket2: ".bucket:nth-child(2)",
    bucket3: ".bucket:nth-child(3)",
    bucket4: ".bucket:nth-child(4)",
    bucket5: ".bucket:nth-child(5)",
    bucket6: ".bucket:nth-child(6)",
  },
  {
    evidenceLabel: ".evidence-card p",
    insight: ".evidence-card h2",
    insightDetail: ".evidence-card small",
    proofLabel: ".evidence-card strong",
    proof: ".evidence-card span",
  },
  {
    pattern1: ".node-trust strong",
    pattern2: ".node-price strong",
    pattern3: ".node-humor strong",
    pattern4: ".node-irritation strong",
  },
  {
    segmentLabel: ".segment-card:not(.cep-card) p",
    segmentQuestion: ".segment-card:not(.cep-card) h2",
    segmentNote: ".segment-card:not(.cep-card) span",
    cepLabel: ".cep-card p",
    cepQuestion: ".cep-card h2",
    cepMoments: ".cep-card small",
  },
  {
    flow1: ".impact-node:nth-of-type(1) strong",
    flow2: ".impact-node:nth-of-type(2) strong",
    flow3: ".impact-node:nth-of-type(3) strong",
    flow4: ".impact-node:nth-of-type(4) strong",
    flow5: ".impact-node:nth-of-type(5) strong",
    flow6: ".impact-node:nth-of-type(6) strong",
    flow7: ".impact-node:nth-of-type(7) strong",
  },
];

let currentIndex = 0;
let isPaused = false;
let slideTimeline;
let progressTween;

const requestedSlide = Number(new URLSearchParams(window.location.search).get("slide"));
if (Number.isInteger(requestedSlide) && requestedSlide >= 1 && requestedSlide <= slides.length) {
  currentIndex = requestedSlide - 1;
}

function setTextKeepingIcon(element, value) {
  if (!element || typeof value !== "string") return;

  const svg = element.querySelector?.("svg");
  if (!svg) {
    element.textContent = value;
    return;
  }

  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });
  element.append(document.createTextNode(value));
}

function applyStoredCopy() {
  let stored;

  try {
    stored = JSON.parse(localStorage.getItem(copyStorageKey) || "null");
  } catch {
    stored = null;
  }

  const storedSlides = Array.isArray(stored?.slides) ? stored.slides : [];
  storedSlides.forEach((copy, index) => {
    const slide = slides[index];
    if (!slide || !copy) return;

    setTextKeepingIcon(slide.querySelector(".kicker"), copy.kicker);
    setTextKeepingIcon(slide.querySelector("h1"), copy.title);
    setTextKeepingIcon(slide.querySelector(".subline"), copy.subline);
    setTextKeepingIcon(slide.querySelector(".supportline"), copy.supportline);

    if (Array.isArray(copy.tags)) {
      slide.querySelectorAll(".tag-row span").forEach((tag, tagIndex) => {
        setTextKeepingIcon(tag, copy.tags[tagIndex]);
      });
    }

    const visual = copy.visual || {};
    const bindings = visualTextBindings[index - 1] || {};
    Object.entries(bindings).forEach(([key, selector]) => {
      setTextKeepingIcon(slide.querySelector(selector), visual[key]);
    });
  });
}

applyStoredCopy();
totalLabel.textContent = String(slides.length).padStart(2, "0");

const dots = slides.map((_, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Ga naar slide ${index + 1}`);
  button.addEventListener("click", () => goToSlide(index));
  dotsHost.appendChild(button);
  return button;
});

function wrapReveal(element) {
  if (element.querySelector(".reveal-inner")) return;

  const text = element.textContent;
  element.textContent = "";

  const clip = document.createElement("span");
  clip.className = "reveal-clip";

  const inner = document.createElement("span");
  inner.className = "reveal-inner";
  inner.textContent = text;

  clip.appendChild(inner);
  element.appendChild(clip);
}

function prepareSlides() {
  slides.forEach((slide, index) => {
    slide.querySelectorAll("[data-reveal]").forEach(wrapReveal);

    slide.querySelectorAll("[data-typewriter]").forEach((element) => {
      element.dataset.fullText = element.textContent.trim();
      element.textContent = "";
    });

    slide.querySelectorAll(".draw").forEach((path) => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
    });

    gsap.set(slide, { autoAlpha: index === 0 ? 1 : 0 });
  });

  gsap.set(".reveal-inner", { yPercent: 112 });
  gsap.set("[data-stagger] span", { autoAlpha: 0, y: 18 });
  gsap.set(".build", {
    autoAlpha: 0,
    clipPath: "inset(0 0 100% 0 round 22px)",
    scale: 0.96,
    y: 26,
  });
  gsap.set(".draw", { strokeDashoffset: (index, path) => path.getTotalLength() });

  if (!reducedMotion) {
    gsap.to("[data-orbit]", {
      duration: 12,
      ease: "sine.inOut",
      repeat: -1,
      stagger: 1.2,
      x: (index) => [36, -28, 22][index] ?? 24,
      y: (index) => [-20, 24, -16][index] ?? -18,
      yoyo: true,
    });

    gsap.to(".scanline", {
      duration: 7,
      ease: "none",
      repeat: -1,
      top: "112vh",
    });
  }
}

function getDuration(index) {
  const configured = Number(slides[index].dataset.duration);
  return Number.isFinite(configured) ? configured / 1000 : 8.5;
}

function addTypewriter(timeline, element, position, speed = 0.021) {
  const text = element.dataset.fullText ?? "";
  const proxy = { chars: 0 };

  timeline.call(
    () => {
      proxy.chars = 0;
      element.textContent = "";
      element.classList.add("typing");
    },
    undefined,
    position,
  );

  timeline.to(
    proxy,
    {
    chars: text.length,
    duration: Math.max(0.65, text.length * speed),
    ease: "none",
    onComplete: () => element.classList.remove("typing"),
    onUpdate: () => {
      element.textContent = text.slice(0, Math.round(proxy.chars));
    },
    snap: { chars: 1 },
    },
    position,
  );
}

function resetSlide(slide) {
  gsap.set(slide.querySelectorAll(".reveal-inner"), { yPercent: 112 });
  gsap.set(slide.querySelectorAll("[data-stagger] span"), { autoAlpha: 0, y: 18 });
  gsap.set(slide.querySelectorAll("[data-typewriter]"), { clearProps: "all" });
  slide.querySelectorAll("[data-typewriter]").forEach((element) => {
    element.textContent = "";
    element.classList.remove("typing");
  });
  gsap.set(slide.querySelectorAll(".build"), {
    autoAlpha: 0,
    clipPath: "inset(0 0 100% 0 round 22px)",
    scale: 0.96,
    y: 26,
  });
  slide.querySelectorAll(".draw").forEach((path) => {
    path.style.strokeDashoffset = path.getTotalLength();
  });
}

function showReducedSlide(slide) {
  gsap.set(slide.querySelectorAll(".reveal-inner"), { yPercent: 0 });
  slide.querySelectorAll("[data-typewriter]").forEach((element) => {
    element.textContent = element.dataset.fullText ?? "";
    element.classList.remove("typing");
  });
  gsap.set(slide.querySelectorAll("[data-stagger] span"), { autoAlpha: 1, y: 0 });
  gsap.set(slide.querySelectorAll(".build"), {
    autoAlpha: 1,
    clipPath: "inset(0 0 0% 0 round 22px)",
    scale: 1,
    y: 0,
  });
  slide.querySelectorAll(".draw").forEach((path) => {
    path.style.strokeDashoffset = 0;
  });
}

function buildSlideTimeline(slide) {
  const tl = gsap.timeline({ paused: true });
  const revealInner = slide.querySelectorAll(".reveal-inner");
  const copyTypeTargets = slide.querySelectorAll(".copy [data-typewriter]");
  const visualTypeTargets = slide.querySelectorAll(".visual [data-typewriter]");
  const tags = slide.querySelectorAll("[data-stagger] span");
  const builds = slide.querySelectorAll(".build");
  const drawPaths = slide.querySelectorAll(".draw");

  if (revealInner.length) {
    tl.to(revealInner, {
      duration: 0.82,
      ease: "expo.out",
      stagger: 0.16,
      yPercent: 0,
    }, 0.28);
  }

  copyTypeTargets.forEach((element) => {
    addTypewriter(tl, element, 1.08, 0.019);
  });

  if (tags.length) {
    tl.to(
      tags,
      {
        autoAlpha: 1,
        duration: 0.58,
        ease: "power3.out",
        stagger: 0.09,
        y: 0,
      },
      1.55,
    );
  }

  if (builds.length) {
    tl.to(
      builds,
      {
        autoAlpha: 1,
        clipPath: "inset(0 0 0% 0 round 22px)",
        duration: 0.78,
        ease: "expo.out",
        scale: 1,
        stagger: 0.075,
        y: 0,
      },
      1.72,
    );
  }

  if (drawPaths.length) {
    tl.to(
      drawPaths,
      {
        duration: 1.35,
        ease: "power2.inOut",
        stagger: 0.08,
        strokeDashoffset: 0,
      },
      2.08,
    );
  }

  visualTypeTargets.forEach((element, index) => {
    addTypewriter(tl, element, 2.12 + index * 0.28, 0.017);
  });

  const floaties = slide.querySelectorAll(".floaty");
  if (floaties.length) {
    tl.to(
      floaties,
      {
        duration: 8,
        ease: "sine.inOut",
        repeat: -1,
        stagger: 0.55,
        y: "-=7",
        yoyo: true,
      },
      3.05,
    );
  }

  const pulseTargets = slide.querySelectorAll(".target, .speech-core, .insight-card");
  if (pulseTargets.length) {
    tl.to(
      pulseTargets,
      {
        duration: 4.2,
        ease: "sine.inOut",
        repeat: -1,
        scale: 1.012,
        yoyo: true,
      },
      3.05,
    );
  }

  return tl;
}

function setActiveSlide(nextIndex) {
  slides.forEach((slide, index) => {
    const active = index === nextIndex;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", active ? "false" : "true");
    gsap.set(slide, { autoAlpha: active ? 1 : 0 });
  });

  dots.forEach((dot, index) => dot.classList.toggle("active", index === nextIndex));
  currentLabel.textContent = String(nextIndex + 1).padStart(2, "0");
}

function playProgress(duration) {
  progressTween?.kill();
  gsap.set(progressFill, { scaleX: 0 });
  progressTween = gsap.to(progressFill, {
    duration: reducedMotion ? Math.max(duration, 10) : duration,
    ease: "none",
    onComplete: nextSlide,
    scaleX: 1,
  });

  if (isPaused) progressTween.pause();
}

function playSlide(index) {
  const slide = slides[index];
  const duration = getDuration(index);

  slideTimeline?.kill();
  slides.forEach(resetSlide);
  setActiveSlide(index);

  if (reducedMotion) {
    showReducedSlide(slide);
  } else {
    slideTimeline = buildSlideTimeline(slide);
    slideTimeline.play(0);
    if (isPaused) slideTimeline.pause();
  }

  playProgress(duration);
}

function goToSlide(nextIndex) {
  currentIndex = (nextIndex + slides.length) % slides.length;
  playSlide(currentIndex);
}

function nextSlide() {
  goToSlide(currentIndex + 1);
}

function previousSlide() {
  goToSlide(currentIndex - 1);
}

function setPaused(nextPaused) {
  if (isPaused === nextPaused) return;

  isPaused = nextPaused;
  deck.classList.toggle("paused", isPaused);
  pauseLabel.textContent = isPaused ? "PAUZE" : "AUTOPLAY";

  if (isPaused) {
    slideTimeline?.pause();
    progressTween?.pause();
    return;
  }

  slideTimeline?.play();
  progressTween?.play();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    nextSlide();
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    previousSlide();
  }

  if (event.code === "Space") {
    event.preventDefault();
    setPaused(!isPaused);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPaused(true);
});

if (!gsap) {
  throw new Error("GSAP kon niet geladen worden.");
}

gsap.config({ nullTargetWarn: false });
prepareSlides();
playSlide(currentIndex);

window.piSlideshow = {
  goToSlide,
  nextSlide,
  previousSlide,
  setPaused,
};
