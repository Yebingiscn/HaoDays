const navToggle = document.querySelector(".nav-toggle");
const menuDialog = document.querySelector("#site-menu");

if (navToggle && menuDialog && typeof menuDialog.showModal === "function") {
  document.querySelector(".site-header").dataset.menuReady = "";
  navToggle.addEventListener("click", () => {
    menuDialog.showModal();
    navToggle.setAttribute("aria-expanded", "true");
  });
  menuDialog.addEventListener("close", () => navToggle.setAttribute("aria-expanded", "false"));
  menuDialog.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => menuDialog.close());
  });
}

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      dialog.close();
    }
  });
});

const lessonDialog = document.querySelector("#lesson-dialog");
const lessonTrigger = document.querySelector("[data-open-lesson]");

if (lessonDialog && lessonTrigger) {
  const video = lessonDialog.querySelector("video");
  lessonTrigger.addEventListener("click", () => {
    lessonDialog.showModal();
    video.play().catch(() => {});
  });
  lessonDialog.addEventListener("close", () => {
    video.pause();
    video.currentTime = 0;
  });
}

const audioButtons = document.querySelectorAll("[data-audio]");

if (audioButtons.length) {
  const audio = new Audio();
  const status = document.querySelector("#audio-status");

  audioButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      audio.src = button.dataset.audio;
      status.textContent = "";
      try {
        await audio.play();
      } catch (error) {
        if (error.name !== "AbortError") status.textContent = "Audio could not play. Try the lesson video.";
      }
    });
  });
}

const checklist = document.querySelector(".checklist");

if (checklist) {
  const storageKey = "haodays.trip-checklist.v1";
  const boxes = [...checklist.querySelectorAll("input[type=checkbox]")];
  const status = document.querySelector("#checklist-status");
  const updateStatus = () => {
    const checked = boxes.filter((box) => box.checked);
    status.textContent = `${checked.length} of ${boxes.length} ready`;
    return checked.map((box) => box.value);
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(saved)) {
      boxes.forEach((box) => { box.checked = saved.includes(box.value); });
    }
  } catch {
    // A blocked or unavailable store should leave the checklist usable for this visit.
  }
  updateStatus();

  checklist.addEventListener("change", () => {
    const checked = updateStatus();
    try {
      localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // Keep the current checks when storage is unavailable.
    }
  });
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  const phrase = document.getElementById(button.dataset.copy);
  const status = document.querySelector("#copy-status");
  let reset;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(phrase.textContent.trim());
      button.textContent = "Copied";
      status.textContent = "Chinese phrase copied.";
      clearTimeout(reset);
      reset = setTimeout(() => { button.textContent = "Copy Chinese"; }, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(phrase);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Phrase selected. Use your device’s copy command.";
    }
  });
});

const printCard = document.querySelector("[data-print-card-button]");

if (printCard) {
  printCard.addEventListener("click", () => {
    document.body.dataset.printCard = "";
    window.print();
  });
  window.addEventListener("afterprint", () => { delete document.body.dataset.printCard; });
}

const motionButton = document.querySelector(".motion-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const silkScenes = [...document.querySelectorAll("svg.silk")];
let motionPreference = null;
let ribbonsStarted = false;

try {
  const savedMotion = localStorage.getItem("haodays.motion.v1");
  if (savedMotion === "paused" || savedMotion === "running") motionPreference = savedMotion;
} catch {
  // Motion controls also work for the current visit when storage is unavailable.
}

const motionPaused = () => motionPreference === "paused" || (motionPreference === null && reducedMotion.matches);
const syncMotion = () => {
  const paused = motionPaused() || document.hidden;
  document.body.dataset.motion = paused ? "paused" : "running";
  if (motionButton) {
    motionButton.setAttribute("aria-pressed", String(motionPaused()));
    motionButton.setAttribute("aria-label", motionPaused() ? "Play motion" : "Pause motion");
    motionButton.querySelector("span").textContent = motionPaused() ? "Play motion" : "Pause motion";
  }
  if (!paused && !ribbonsStarted) {
    document.querySelectorAll("svg.silk animate").forEach((animation) => animation.beginElement());
    ribbonsStarted = true;
  }
  silkScenes.forEach((svg) => {
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  });
  if (paused) {
    document.body.style.removeProperty("--pointer-x");
    document.body.style.removeProperty("--pointer-y");
  }
};

motionButton?.addEventListener("click", () => {
  motionPreference = motionPaused() ? "running" : "paused";
  try {
    localStorage.setItem("haodays.motion.v1", motionPreference);
  } catch {
    // The chosen setting still applies to the current page.
  }
  syncMotion();
});
reducedMotion.addEventListener("change", syncMotion);
document.addEventListener("visibilitychange", syncMotion);
syncMotion();

if ("IntersectionObserver" in window) {
  document.body.classList.add("motion-ready");
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.04 });
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
}

const hero = document.querySelector(".dream-cover");
if (hero && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  const updatePointer = () => {
    pointerFrame = 0;
    document.body.style.setProperty("--pointer-x", String(pointerX));
    document.body.style.setProperty("--pointer-y", String(pointerY));
  };
  hero.addEventListener("pointermove", (event) => {
    if (motionPaused()) return;
    const bounds = hero.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointer);
  });
  hero.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointer);
  });
}
