const deck = document.querySelector(".deck");
const slides = Array.from(document.querySelectorAll(".slide"));
const dotsHost = document.querySelector(".slide-dots");
const progressFill = document.querySelector(".progress-fill");
const currentLabel = document.querySelector(".current");
const totalLabel = document.querySelector(".total");
const pauseLabel = document.querySelector(".pause-state");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let currentIndex = 0;
let isPaused = false;
let slideStartedAt = performance.now();
let pausedAt = 0;
let rafId = 0;

totalLabel.textContent = String(slides.length).padStart(2, "0");

const dots = slides.map((_, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Ga naar slide ${index + 1}`);
  button.addEventListener("click", () => goToSlide(index));
  dotsHost.appendChild(button);
  return button;
});

function getDuration(index) {
  const configured = Number(slides[index].dataset.duration);
  return Number.isFinite(configured) ? configured : 8500;
}

function setActiveSlide(nextIndex) {
  slides.forEach((slide, index) => {
    const active = index === nextIndex;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", active ? "false" : "true");
  });

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === nextIndex);
  });

  currentLabel.textContent = String(nextIndex + 1).padStart(2, "0");
}

function goToSlide(nextIndex) {
  currentIndex = (nextIndex + slides.length) % slides.length;
  slideStartedAt = performance.now();
  setActiveSlide(currentIndex);
  updateProgress(0);
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
    pausedAt = performance.now();
    return;
  }

  const pausedDuration = performance.now() - pausedAt;
  slideStartedAt += pausedDuration;
}

function updateProgress(progress) {
  progressFill.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
}

function frame(now) {
  if (!isPaused) {
    const duration = reducedMotion ? Math.max(getDuration(currentIndex), 10000) : getDuration(currentIndex);
    const progress = (now - slideStartedAt) / duration;

    updateProgress(progress);

    if (progress >= 1) {
      nextSlide();
    }
  }

  rafId = window.requestAnimationFrame(frame);
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
  if (document.hidden) {
    setPaused(true);
  }
});

setActiveSlide(currentIndex);
rafId = window.requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(rafId);
});
