const navToggle = document.querySelector(".nav-toggle");

if (navToggle) {
  const header = navToggle.closest(".site-header");
  const setMenu = (open) => {
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.querySelector("span").textContent = open ? "Close" : "Menu";
  };

  header.dataset.navReady = "";
  navToggle.addEventListener("click", () => {
    setMenu(navToggle.getAttribute("aria-expanded") !== "true");
  });
  header.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      navToggle.focus();
    }
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
