(() => {
  "use strict";
  const D = window.HaoTripData;
  const page = document.body.dataset.trip;
  if (!D || !page) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const allGuides = [...D.guides, ...D.hongkong];
  const guideIds = new Set(allGuides.map((guide) => guide.id));
  const catalog = new Map();
  for (const day of D.shanghai.routeDays) for (const stop of day.stops) catalog.set(`stop:${stop.cn}`, { id: `stop:${stop.cn}`, name: stop.name, cn: stop.cn, type: "Itinerary stop" });
  for (const [key, type] of [["places", "Place"], ["activities", "Experience"], ["foods", "Local flavor"]]) for (const item of D.shanghai[key]) catalog.set(item.id, { id: item.id, name: item.name, cn: item.cn, type });
  let storageAvailable = true;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem("haodays.haotrip.v1") || "null"); } catch { storageAvailable = false; }
  const validArray = (value, predicate) => Array.isArray(value) ? [...new Set(value.filter(predicate))] : [];
  const state = {
    prep: validArray(stored?.prep, (index) => Number.isInteger(index) && index >= 0 && index < 8),
    read: validArray(stored?.read, (id) => guideIds.has(id)),
    saved: validArray(stored?.saved, (id) => catalog.has(id))
  };
  if (!stored && storageAvailable) {
    try {
      const oldChecks = JSON.parse(localStorage.getItem("haodays.trip-checklist.v1") || "[]");
      const migration = { passport: 0, payments: 2, maps: 3, power: 4, address: 6 };
      if (Array.isArray(oldChecks)) state.prep = [...new Set(oldChecks.filter((key) => Object.hasOwn(migration, key)).map((key) => migration[key]))];
    } catch { /* The new checklist remains usable without old progress. */ }
  }
  function persist() {
    try { localStorage.setItem("haodays.haotrip.v1", JSON.stringify(state)); } catch { storageAvailable = false; }
    $("#trip-storage-note").textContent = storageAvailable ? "Saved on this device." : "Your checks are kept for this visit. Storage is unavailable.";
  }
  let toastTimer;
  function toast(message) {
    const modal = $("dialog[open]");
    if (modal) {
      let status = $(".trip-dialog-status", modal);
      if (!status) { status = document.createElement("p"); status.className = "trip-dialog-status"; status.setAttribute("role", "status"); modal.append(status); }
      status.textContent = message;
      return;
    }
    const status = $("#trip-status");
    status.textContent = message;
    status.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => status.classList.remove("is-visible"), 3300);
  }
  async function copyText(text, trigger) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      toast("Copied. Keep a little Chinese close.");
    } catch {
      const area = document.createElement("textarea");
      area.className = "trip-copy-fallback";
      area.readOnly = true;
      area.rows = 3;
      area.setAttribute("aria-label", "Text to copy");
      area.value = text;
      const container = trigger.closest("dialog") || trigger.closest("section") || $(".trip-main");
      $(".trip-copy-fallback", container)?.remove();
      container.append(area);
      area.focus();
      area.select();
      toast("Select and copy the text in the box.");
    }
  }
  function openDialog(selector) {
    const dialog = $(selector);
    if (!dialog || dialog.open) return;
    $(".trip-dialog-status", dialog)?.remove();
    dialog.showModal();
  }
  function enter(element) {
    element.classList.remove("trip-is-entering");
    void element.offsetWidth;
    element.classList.add("trip-is-entering");
  }
  function updatePrep() {
    $$('[data-prep]').forEach((box) => { box.checked = state.prep.includes(Number(box.dataset.prep)); });
    $$('[data-prep-count]').forEach((item) => { item.textContent = `${state.prep.length} of 8 ready`; });
    $$('[data-prep-mini]').forEach((item) => { item.textContent = `${state.prep.length}/8`; });
    $("#prep-progress").value = state.prep.length;
    $("#trip-storage-note").textContent = storageAvailable ? "Saved on this device." : "Your checks are kept for this visit. Storage is unavailable.";
  }
  $$('[data-open-prep]').forEach((button) => button.addEventListener("click", () => openDialog("#trip-prep")));
  $$('[data-prep]').forEach((box) => box.addEventListener("change", () => {
    const index = Number(box.dataset.prep);
    state.prep = box.checked ? [...new Set([...state.prep, index])] : state.prep.filter((item) => item !== index);
    persist(); updatePrep();
  }));
  $$('[data-trip-copy]').forEach((button) => button.addEventListener("click", () => copyText(button.dataset.tripCopy, button)));
  updatePrep();

  function icon(kind) {
    const paths = {
      garden: '<path d="M8 25h32M12 25v16h24V25M18 41V29h12v12M4 24c8-2 13-7 20-17 7 10 12 15 20 17M10 16h28M24 7V3"/><path d="M9 41h30"/>',
      tree: '<path d="M24 42V19M24 31l-9-9M24 27l8-9"/><path d="M12 29C2 24 8 11 15 13c0-13 20-13 19-1 12-2 15 17 3 19"/>',
      skyline: '<path d="M5 42h38M10 42V22h10v20M28 42V12h10v30M15 22V9M33 12V4M29 21h8M29 28h8M13 29h4M13 35h4"/>',
      bridge: '<path d="M5 34h38M10 34V12M38 34V12M9 17h30M11 20c9 15 17 15 26 0M4 42c5-4 7 4 12 0s7 4 12 0 7 4 15 0M17 28v6M24 30v4M31 28v6"/>',
      cup: '<path d="M10 20h24v10c0 14-24 14-24 0zM34 22h4c9 0 7 12-4 12M6 42h33M16 14c-7-6 7-5 0-11M25 14c-7-6 7-5 0-11"/>',
      train: '<rect x="10" y="6" width="28" height="31" rx="8"/><path d="M12 23h24M24 7v16M16 32h2M30 32h2M16 37l-5 7M32 37l5 7"/>',
      shield: '<path d="M24 4L40 11v12c0 12-9 18-16 22C17 41 8 35 8 23V11zM24 16v16M16 24h16"/>',
      phone: '<rect x="12" y="3" width="24" height="42" rx="6"/><path d="M20 8h8M21 40h6M18 19h4v4h-4zM26 19h4v4h-4zM18 27h4v4h-4zM26 27h4v4h-4z"/>',
      battery: '<rect x="6" y="10" width="36" height="30" rx="6"/><path d="M18 10V5h12v5M26 16l-8 10h10l-6 9"/>',
      compass: '<circle cx="24" cy="24" r="19"/><path d="M31 17l-4 10-10 4 4-10zM24 2v5M24 41v5M2 24h5M41 24h5"/>',
      brush: '<path d="M12 34L35 5l8 7-27 26M8 33c-9 7 1 12-6 13 12 2 19-7 6-13z"/>',
      bowl: '<path d="M6 25h36c0 22-36 22-36 0zM4 25h40M17 44h14M16 19c-8-9 7-9 0-16M26 19c-8-9 7-9 0-16M36 19c-8-9 7-9 0-16"/>'
    };
    return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths.compass}</svg>`;
  }

  function setupHome() {
    let current = 0;
    function cityPreview(id) {
      const city = D.cities.find((item) => item.id === id);
      if (!city) return;
      $("#preview-image").src = D.images[city.id];
      $("#preview-image").alt = `${city.name} destination scene`;
      $("#preview-title").textContent = city.name;
      $("#preview-cn").textContent = city.cn;
      $("#preview-story").textContent = city.sub;
      $("#preview-days").textContent = `${city.days} · ${city.mood}`;
      $("#preview-activities").innerHTML = city.activities.map((activity) => `<li>${esc(activity)}</li>`).join("");
      const link = $("#preview-link");
      const isShanghai = city.id === "shanghai";
      const isHK = city.id === "hongkong";
      link.href = isShanghai ? "haotrip-shanghai.html" : `haotrip-essentials.html${isHK ? "?region=hk#atlas" : ""}`;
      link.textContent = isShanghai ? "Open Shanghai guide" : isHK ? "Explore Hong Kong essentials" : "Prepare for your trip";
      $("#preview-availability").textContent = isShanghai ? "Your complete Shanghai city guide is ready to explore." : "A first look at this destination. The detailed city guide is still to come.";
      openDialog("#city-preview");
    }
    function setCity(index) {
      current = (index + D.cities.length) % D.cities.length;
      const city = D.cities[current];
      $("#hero-city-photo").src = D.images[city.id];
      $("#hero-city-photo").alt = `${city.name} destination scene`;
      $("#hero-city-name").innerHTML = `${esc(city.name)} <span lang="zh-Hans">${esc(city.cn)}</span>`;
      $("#hero-city-story").textContent = city.sub;
      $("#hero-city-meta").textContent = `${city.days} · ${city.mood}`;
      $("#hero-city-link").hidden = city.id !== "shanghai";
      $("#hero-city-preview").hidden = city.id === "shanghai";
      $("#hero-city-preview").textContent = `Preview ${city.name}`;
      $$('[data-hero-city]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.heroCity) === current)));
      enter($(".trip-photo-shell"));
    }
    $$('[data-hero-city]').forEach((button) => button.addEventListener("click", () => setCity(Number(button.dataset.heroCity))));
    $("#hero-prev").addEventListener("click", () => setCity(current - 1));
    $("#hero-next").addEventListener("click", () => setCity(current + 1));
    $("#hero-city-preview").addEventListener("click", () => cityPreview(D.cities[current].id));
    $$('[data-city]').forEach((button) => button.addEventListener("click", () => cityPreview(button.dataset.city)));
    $$('[data-mood]').forEach((button) => button.addEventListener("click", () => {
      const mood = button.dataset.mood;
      let count = 0;
      $$('[data-mood]').forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      $$('.trip-destination').forEach((card) => {
        card.hidden = mood !== "all" && !card.dataset.cityTypes.split(" ").includes(mood);
        if (!card.hidden) { count += 1; enter(card); }
      });
      $("#destination-count").textContent = `${count} destinations`;
    }));
  }

  function setupEssentials() {
    const params = new URLSearchParams(location.search);
    const requested = allGuides.find((guide) => guide.id === params.get("topic"));
    let region = requested ? requested.id.startsWith("hk") ? "hk" : "mainland" : params.get("region") === "hk" ? "hk" : "mainland";
    let category = requested?.category || "everyday";
    let selected = requested?.id || (region === "hk" ? "hk1" : "g19");
    let query = "";
    const all = () => region === "hk" ? D.hongkong : D.guides;
    const visible = () => all().filter((guide) => (!query || [guide.title, guide.intro, guide.note, ...guide.steps].join(" ").toLowerCase().includes(query)) && (query || region === "hk" || guide.category === category));
    const updateURL = () => {
      const url = new URL(location.href);
      if (selected) url.searchParams.set("topic", selected);
      else url.searchParams.delete("topic");
      if (region === "hk") url.searchParams.set("region", "hk");
      else url.searchParams.delete("region");
      history.replaceState(null, "", url);
    };
    function renderCategories() {
      const categories = region === "hk" ? [{ id: "hk", name: "Hong Kong essentials" }] : D.categories;
      $("#guide-categories").innerHTML = categories.map((item) => `<button type="button" class="trip-category" data-category="${esc(item.id)}" aria-pressed="${region === "hk" || item.id === category}"><span>${esc(item.name)}</span><small>${region === "hk" ? 8 : D.guides.filter((guide) => guide.category === item.id).length}</small></button>`).join("");
    }
    function scene(guide) {
      const container = $("#guide-scene");
      if (guide.id === "g19") {
        const squat = '<svg viewBox="0 0 100 110" fill="none" aria-hidden="true"><path d="M18 17Q50 6 82 17L94 96Q50 110 6 96Z" fill="#dce9fa" stroke="#7594ba" stroke-width="3"/><ellipse cx="50" cy="58" rx="17" ry="34" fill="#91afd6"/><ellipse cx="50" cy="58" rx="9" ry="26" fill="#527db4"/><path d="M20 35h12M68 35h12M17 83h15M68 83h15" stroke="#7594ba" stroke-width="5" stroke-linecap="round"/></svg>';
        const seated = '<svg viewBox="0 0 100 110" fill="none" aria-hidden="true"><rect x="25" y="5" width="50" height="40" rx="8" fill="#f8fbff" stroke="#7594ba" stroke-width="3"/><path d="M20 59L30 98Q50 110 70 98L80 59" fill="#f8fbff" stroke="#7594ba" stroke-width="3"/><ellipse cx="50" cy="56" rx="37" ry="19" fill="#fff" stroke="#7594ba" stroke-width="3"/><ellipse cx="50" cy="56" rx="24" ry="10" fill="#b6cdec"/></svg>';
        container.innerHTML = `<div><div class="trip-scene-comparison"><button type="button" data-restroom="squat" aria-pressed="true">${squat}<span>Squat toilet</span></button><button type="button" data-restroom="seated" aria-pressed="false">${seated}<span>Seated toilet</span></button></div><p class="trip-scene-annotation" id="restroom-annotation">Common in some public facilities and older attractions.</p></div>`;
      } else {
        const art = ["before", "arrival", "transport", "smart"].includes(guide.category) ? "trip" : guide.category === "money" || ["g03", "g04", "g05", "g06", "g15", "hk2", "hk3"].includes(guide.id) ? "easy" : ["etiquette", "food"].includes(guide.category) ? "culture" : "talk";
        container.innerHTML = guide.id === "g08" ? `<div class="trip-battery-art">${icon("battery")}<strong>CCC / 3C</strong><span>Check the mark · Carry-on only</span></div>` : guide.category === "emergency" ? `<div class="trip-battery-art">${icon("shield")}<span>Keep the essentials close.</span></div>` : `<img src="assets/design/${art}.webp" alt="" width="512" height="512">`;
      }
    }
    function renderProgress() {
      $("#guide-read-count").textContent = state.read.length;
      $("#guide-read-progress").value = state.read.length;
    }
    function render() {
      const list = visible();
      if (!list.some((guide) => guide.id === selected)) selected = list[0]?.id || "";
      const guide = list.find((item) => item.id === selected);
      $$('[data-region]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.region === region)));
      $$('[data-category]').forEach((button) => button.setAttribute("aria-pressed", String(region === "hk" || button.dataset.category === category)));
      $("#guide-category-label").textContent = region === "hk" ? "Hong Kong essentials" : query ? "Search across all chapters" : D.categories.find((item) => item.id === category).name;
      $("#guide-search-count").textContent = `${list.length} ${list.length === 1 ? "moment" : "moments"}${query ? " found" : " in this chapter"}`;
      $("#guide-topics").innerHTML = list.map((item) => `<button type="button" class="trip-topic${state.read.includes(item.id) ? " is-read" : ""}" data-topic="${item.id}" aria-pressed="${item.id === selected}">${esc(item.title)}</button>`).join("");
      $("#guide-story").hidden = !guide;
      $("#guide-empty").hidden = Boolean(guide);
      $("#guide-prev").disabled = !guide || list.length < 2;
      $("#guide-next").disabled = !guide || list.length < 2;
      $("#guide-page-position").textContent = guide ? `${list.indexOf(guide) + 1} / ${list.length}` : "0 moments";
      if (guide) {
        $("#guide-position").textContent = `${region === "hk" ? "Hong Kong" : "Mainland China"} · Real-world moment`;
        $("#guide-story-title").textContent = guide.title;
        $("#guide-intro").textContent = guide.intro;
        $("#guide-steps").innerHTML = guide.steps.map((step) => `<li>${esc(step)}</li>`).join("");
        $("#guide-note").textContent = guide.note;
        if (guide.id === "g06") {
          const link = document.createElement("a");
          link.href = "haoeasy.html";
          link.textContent = "Open HaoEasy";
          $("#guide-note").append(" ", link);
        }
        $("#guide-read").setAttribute("aria-pressed", String(state.read.includes(guide.id)));
        $("#guide-read").textContent = state.read.includes(guide.id) ? "Read ✓ · Undo" : "Mark as read";
        scene(guide);
      }
      renderProgress(); updateURL();
    }
    function choose(id, move = false) {
      const guide = allGuides.find((item) => item.id === id);
      if (!guide) return;
      const nextRegion = id.startsWith("hk") ? "hk" : "mainland";
      const changedRegion = nextRegion !== region;
      region = nextRegion; category = guide.category || "hk"; selected = id; query = "";
      $("#guide-search").value = "";
      if (changedRegion) renderCategories();
      render(); enter($("#guide-story"));
      if (move) { $("#atlas").scrollIntoView({ behavior: document.body.dataset.motion === "paused" ? "auto" : "smooth" }); $("#guide-story-title").focus({ preventScroll: true }); }
    }
    $("#guide-categories").addEventListener("click", (event) => {
      const button = event.target.closest('[data-category]'); if (!button) return;
      category = button.dataset.category; query = ""; $("#guide-search").value = ""; selected = ""; render(); enter($("#guide-story"));
    });
    $("#guide-topics").addEventListener("click", (event) => {
      const button = event.target.closest('[data-topic]'); if (!button) return;
      selected = button.dataset.topic; render(); enter($("#guide-story"));
      $(`[data-topic="${selected}"]`).focus({ preventScroll: true });
    });
    $("#guide-search").addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); selected = ""; render(); });
    $$('[data-region]').forEach((button) => button.addEventListener("click", () => {
      region = button.dataset.region; category = region === "hk" ? "hk" : "everyday"; selected = region === "hk" ? "hk1" : "g19"; query = ""; $("#guide-search").value = ""; renderCategories(); render();
    }));
    $$('[data-quick-topic]').forEach((button) => button.addEventListener("click", () => choose(button.dataset.quickTopic, true)));
    $("#guide-surprise").addEventListener("click", () => { const list = all(); choose(list[Math.floor(Math.random() * list.length)].id); toast("A useful little discovery."); });
    for (const [id, direction] of [["guide-prev", -1], ["guide-next", 1]]) $("#" + id).addEventListener("click", () => {
      const list = visible(); if (!list.length) return;
      selected = list[(list.findIndex((guide) => guide.id === selected) + direction + list.length) % list.length].id;
      render(); enter($("#guide-story"));
    });
    $("#guide-read").addEventListener("click", () => {
      if (!selected) return;
      state.read = state.read.includes(selected) ? state.read.filter((id) => id !== selected) : [...state.read, selected];
      persist(); render(); toast(state.read.includes(selected) ? "One more moment explored." : "Marked unread. Revisit it any time.");
    });
    $("#guide-copy").addEventListener("click", (event) => { const guide = allGuides.find((item) => item.id === selected); if (guide) copyText([guide.title, guide.intro, ...guide.steps, guide.note].join("\n\n"), event.currentTarget); });
    $("#guide-scene").addEventListener("click", (event) => {
      const button = event.target.closest('[data-restroom]'); if (!button) return;
      $$('[data-restroom]').forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      $("#restroom-annotation").textContent = button.dataset.restroom === "squat" ? "Common in some public facilities and older attractions." : "Common in hotels and many modern facilities. Look for stall icons.";
    });
    $("#trip-quiz").addEventListener("click", (event) => {
      const button = event.target.closest('[data-quiz-answer]'); if (!button) return;
      $$('[data-quiz-answer]').forEach((item) => { item.classList.remove("is-correct", "is-wrong"); item.setAttribute("aria-pressed", String(item === button)); });
      const correct = button.dataset.quizAnswer === "0";
      button.classList.add(correct ? "is-correct" : "is-wrong");
      $("#quiz-feedback").textContent = correct ? "Exactly. Some restrooms have dispensers outside the cubicles. Carry a small pack of tissues too." : "Try again. Check outside the cubicles and carry tissues. Never flush wet wipes.";
    });
    $("#trip-print").addEventListener("click", () => window.print());
    renderCategories(); render();
  }

  function setupShanghai() {
    const S = D.shanghai;
    let length = 3, dayIndex = 0, stopIndex = 0, mode = "places", filter = "all", foodIndex = 0, stayIndex = 0;
    const stop = () => S.routeDays[dayIndex].stops[stopIndex];
    const kindFor = (name) => /garden|bazaar|zhangyuan/i.test(name) ? "garden" : /road|lane|walk/i.test(name) ? "tree" : /river|cruise|creek|bund/i.test(name) ? "bridge" : /tea/i.test(name) ? "cup" : /food|breakfast|lunch/i.test(name) ? "bowl" : /paint|museum/i.test(name) ? "brush" : "skyline";
    const configureSave = (button, id, label) => { button.dataset.save = id; button.dataset.saveLabel = label; };
    function updateSaved() {
      $$('[data-pocket-count]').forEach((item) => { item.textContent = state.saved.length; });
      $$('[data-save]').forEach((button) => {
        const saved = state.saved.includes(button.dataset.save);
        button.setAttribute("aria-pressed", String(saved));
        button.textContent = saved ? "Saved ✓" : button.dataset.saveLabel || "Save to My Trip";
        button.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${catalog.get(button.dataset.save)?.name || "item"}${saved ? " from My Trip" : " to My Trip"}`);
      });
    }
    function renderPocket() {
      $("#pocket-items").innerHTML = state.saved.length ? state.saved.map((id) => {
        const item = catalog.get(id);
        return `<article class="trip-pocket-item"><small>${esc(item.type)}</small><p>${esc(item.name)}</p><span lang="zh-Hans">${esc(item.cn)}</span><div class="trip-actions"><button type="button" class="trip-small-button" data-pocket-copy="${esc(id)}">Copy Chinese</button><button type="button" class="trip-small-button" data-remove="${esc(id)}" aria-label="Remove ${esc(item.name)}">Remove</button></div></article>`;
      }).join("") : '<p class="trip-empty">Your story starts with one place. Save a stop, a flavor or a discovery to collect it here.</p>';
      $("#pocket-download").disabled = state.saved.length === 0;
    }
    document.addEventListener("click", (event) => {
      const button = event.target.closest('[data-save]');
      if (!button || !catalog.has(button.dataset.save)) return;
      const id = button.dataset.save;
      const existed = state.saved.includes(id);
      state.saved = existed ? state.saved.filter((item) => item !== id) : [...state.saved, id];
      persist(); updateSaved();
      if ($("#trip-pocket").open) renderPocket();
      toast(existed ? "Removed from My Trip." : "Saved to your Shanghai pocket.");
    });
    $$('[data-open-pocket]').forEach((button) => button.addEventListener("click", () => { renderPocket(); openDialog("#trip-pocket"); }));
    $("#pocket-items").addEventListener("click", (event) => {
      const remove = event.target.closest('[data-remove]');
      const copy = event.target.closest('[data-pocket-copy]');
      if (remove) {
        state.saved = state.saved.filter((id) => id !== remove.dataset.remove);
        persist(); updateSaved(); renderPocket(); $("#pocket-title").focus({ preventScroll: true }); toast("Removed from My Trip.");
      } else if (copy && catalog.has(copy.dataset.pocketCopy)) copyText(catalog.get(copy.dataset.pocketCopy).cn, copy);
    });
    $("#pocket-download").addEventListener("click", () => {
      if (!state.saved.length) return;
      const text = "HaoDays · My Shanghai travel pocket\n\n" + state.saved.map((id) => { const item = catalog.get(id); return `${item.name} · ${item.cn}\n${item.type}`; }).join("\n\n") + "\n\nPlan before you go: check current opening days, tickets and transport.\nhttps://yebingiscn.github.io/HaoDays/haotrip-shanghai.html\n";
      const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "HaoDays-Shanghai-pocket.txt";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("Your travel pocket has been downloaded.");
    });

    function drawRoute() {
      const path = $("#route-path");
      path.classList.remove("is-drawing");
      void path.getBoundingClientRect();
      path.classList.add("is-drawing");
    }
    function renderDayButtons() {
      $("#route-days").innerHTML = S.routeDays.slice(0, length).map((day, index) => `<button type="button" class="trip-pill" data-route-day="${index}" aria-pressed="${index === dayIndex}">Day ${index + 1}</button>`).join("");
    }
    function updateStop() {
      const current = stop();
      $("#route-label").textContent = `Day ${dayIndex + 1} · Stop ${stopIndex + 1} of ${S.routeDays[dayIndex].stops.length}`;
      $("#route-day-title").textContent = S.routeDays[dayIndex].tag;
      $("#route-time").textContent = current.time;
      $("#route-stop-name").textContent = current.name;
      $("#route-stop-cn").textContent = current.cn;
      $("#route-stop-pinyin").textContent = current.pinyin;
      $("#route-stop-description").textContent = current.desc;
      $("#route-stop-tip").textContent = `Local tip · ${current.tip}`;
      $("#route-stop-icon").innerHTML = icon(kindFor(current.name));
      $("#route-real-map").href = `https://www.amap.com/search?query=${encodeURIComponent(current.cn + " 上海")}`;
      configureSave($("#route-save"), `stop:${current.cn}`, "Save stop");
      $$('[data-route-stop]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.routeStop) === stopIndex)));
      updateSaved();
    }
    function renderRoute() {
      const day = S.routeDays[dayIndex];
      $$('[data-trip-length]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.tripLength) === length)));
      $$('[data-route-day]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.routeDay) === dayIndex)));
      $("#route-path").setAttribute("d", day.path);
      $("#route-path-shadow").setAttribute("d", day.path);
      $("#route-pins").innerHTML = day.stops.map((item, index) => `<button type="button" class="trip-route-pin" data-route-stop="${index}" aria-pressed="${index === stopIndex}" aria-label="Stop ${index + 1}: ${esc(item.name)}" style="left:clamp(24px,${day.positions[index][0]}%,calc(100% - 24px));top:clamp(24px,${day.positions[index][1]}%,calc(100% - 24px))">${index + 1}</button>`).join("");
      $("#route-timeline").innerHTML = day.stops.map((item, index) => `<button type="button" data-route-stop="${index}" aria-pressed="${index === stopIndex}"><small>${item.time}</small><strong>${esc(item.name)}</strong></button>`).join("");
      $("#route-map").setAttribute("aria-label", day.title + ". Select one of four stops.");
      updateStop(); drawRoute();
    }
    $$('[data-trip-length]').forEach((button) => button.addEventListener("click", () => { length = Number(button.dataset.tripLength); dayIndex = Math.min(dayIndex, length - 1); stopIndex = 0; renderDayButtons(); renderRoute(); }));
    $("#route-days").addEventListener("click", (event) => { const button = event.target.closest('[data-route-day]'); if (button) { dayIndex = Number(button.dataset.routeDay); stopIndex = 0; renderRoute(); } });
    for (const id of ["route-pins", "route-timeline"]) $("#" + id).addEventListener("click", (event) => { const button = event.target.closest('[data-route-stop]'); if (button) { stopIndex = Number(button.dataset.routeStop); updateStop(); } });
    $("#route-replay").addEventListener("click", drawRoute);
    $("#route-copy").addEventListener("click", (event) => copyText(stop().cn, event.currentTarget));
    renderDayButtons(); renderRoute();

    function renderDiscoveries() {
      const list = S[mode].filter((item) => filter === "all" || item.type === filter);
      $$('[data-discovery-mode]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.discoveryMode === mode)));
      $$('[data-discovery-filter]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.discoveryFilter === filter)));
      $("#discover-grid").innerHTML = list.map((item) => `<article class="trip-discovery-card"><div class="trip-discovery-art">${icon(kindFor(item.name))}</div><p class="trip-overline">${esc(item.tag)}</p><h3>${esc(item.name)}</h3><p class="trip-chinese" lang="zh-Hans">${esc(item.cn)}</p><p>${esc(item.desc)}</p><div class="trip-actions"><button type="button" class="trip-small-button" data-discover="${item.id}" aria-label="Explore ${esc(item.name)}">Explore</button><button type="button" class="trip-button" data-save="${item.id}" data-save-label="Save" aria-pressed="false">Save</button></div></article>`).join("");
      $("#discovery-empty").hidden = list.length !== 0;
      updateSaved(); enter($("#discover-grid"));
    }
    function showDiscovery(id) {
      const item = [...S.places, ...S.activities].find((entry) => entry.id === id);
      if (!item) return;
      $("#discovery-art").innerHTML = icon(kindFor(item.name));
      $("#discovery-tag").textContent = item.tag;
      $("#discovery-title").textContent = item.name;
      $("#discovery-cn").textContent = item.cn;
      $("#discovery-description").textContent = item.desc;
      $("#discovery-tip").textContent = item.tip;
      configureSave($("#discovery-save"), id, "Save to My Trip");
      $("#discovery-copy").dataset.chinese = item.cn;
      updateSaved(); openDialog("#discovery-dialog");
    }
    $$('[data-discovery-mode]').forEach((button) => button.addEventListener("click", () => { mode = button.dataset.discoveryMode; filter = "all"; renderDiscoveries(); }));
    $$('[data-discovery-filter]').forEach((button) => button.addEventListener("click", () => { filter = button.dataset.discoveryFilter; renderDiscoveries(); }));
    $("#discover-grid").addEventListener("click", (event) => { const button = event.target.closest('[data-discover]'); if (button) showDiscovery(button.dataset.discover); });
    $("#discovery-copy").addEventListener("click", (event) => copyText(event.currentTarget.dataset.chinese, event.currentTarget));
    renderDiscoveries();

    function foodArt(id) {
      const noodle = id === "fd-noodle";
      const soup = id === "fd-wonton";
      const rice = id === "fd-rice";
      const pork = id === "fd-pork";
      const buns = [105, 195, 150].map((x, index) => {
        const y = index === 2 ? 196 : 153;
        return `<g transform="translate(${x} ${y})"><ellipse cy="14" rx="49" ry="36" fill="${id === "fd-sheng" ? "#c78f59" : "#e8ccad"}"/><path d="M-46 9C-44-26-15-26 0-44C15-26 44-26 46 9C40 44-40 44-46 9Z" fill="url(#trip-dough)"/><path d="M0-35C-6-19-21-7-23 17M0-35C7-18 22-9 25 17M0-35V18M0-35C-22-19-33-9-35 5M0-35C23-20 32-10 36 6" fill="none" stroke="#dcba94" stroke-width="2" opacity=".7"/><ellipse cy="-34" rx="8" ry="4" fill="#e1be9a"/></g>`;
      }).join("");
      let food = buns;
      if (noodle || soup) food = `<path d="M55 150H245C238 255 62 255 55 150Z" fill="url(#trip-bowl)"/><ellipse cx="150" cy="150" rx="96" ry="30" fill="#fff9ed"/><ellipse cx="150" cy="152" rx="80" ry="23" fill="${soup ? "#d7b783" : "#b78952"}"/>${noodle ? '<g fill="none" stroke="#e7c17e" stroke-width="4"><path d="M85 147C155 115 200 180 214 143M87 156C151 126 175 174 217 151M92 162C151 141 163 177 208 158M108 135C144 176 172 134 194 163M90 150C145 180 169 118 211 148"/></g><g stroke="#719766" stroke-width="3"><path d="M111 141l12 6M175 155l10-6M138 164l10-5M165 137l10 6"/></g>' : [105,150,195].map((x)=>`<path d="M${x-18} 149l18-20 22 21-20 19Z" fill="#f8e6cc" stroke="#ddbd8d" stroke-width="2"/>`).join("")}<path d="M100 227h100" stroke="#c1b0ce" stroke-width="5" stroke-linecap="round"/>`;
      if (pork) food = [90, 147, 200, 119, 176].map((x,i)=>`<rect x="${x-24}" y="${i<3?125:168}" width="51" height="49" rx="12" fill="${i%2?'#9a4833':'#b6633e'}" stroke="#edb888" stroke-width="3"/><path d="M${x-17} ${i<3?135:178}h31" stroke="#f3c593" stroke-width="5" stroke-linecap="round" opacity=".6"/>`).join("");
      if (rice) food = '<rect x="76" y="105" width="148" height="101" rx="48" fill="url(#trip-dough)" transform="rotate(-15 150 155)"/><g stroke="#d6c2a4" stroke-width="3" stroke-linecap="round"><path d="M103 139l7 6M125 128l5 7M146 132l6 7M174 124l6 6M188 145l7 6M104 165l8 4M128 160l7 7M152 158l7 5M177 166l6 4M134 185l6 4"/></g>';
      return `<svg viewBox="0 0 300 300" aria-hidden="true"><defs><radialGradient id="trip-dough" cx=".35" cy=".25"><stop stop-color="#fffef0"/><stop offset="1" stop-color="#efd7b3"/></radialGradient><linearGradient id="trip-bowl" x2="0" y2="1"><stop stop-color="#f4edff"/><stop offset="1" stop-color="#a9a7d3"/></linearGradient></defs><circle cx="150" cy="150" r="132" fill="#fff7"/><ellipse cx="150" cy="218" rx="122" ry="45" fill="#d6c7dc" opacity=".45"/><ellipse cx="150" cy="208" rx="120" ry="43" fill="#fffbf4"/><ellipse cx="150" cy="205" rx="101" ry="30" fill="#f0e5d4"/>${food}<path d="M117 82C105 68 131 64 119 49M154 73C140 56 168 54 155 36M190 82C177 66 202 62 190 47" fill="none" stroke="#fff" stroke-width="5" opacity=".75" stroke-linecap="round"/></svg>`;
    }
    $("#food-list").innerHTML = S.foods.map((food, index) => `<button type="button" class="trip-food-option" data-food="${index}" aria-pressed="${index === foodIndex}"><span>${esc(food.name)}</span><small lang="zh-Hans">${esc(food.cn)}</small></button>`).join("");
    function renderFood() {
      const food = S.foods[foodIndex];
      $("#food-name").textContent = food.name;
      $("#food-chinese").textContent = food.cn;
      $("#food-pinyin").textContent = food.py;
      $("#food-intro").textContent = food.intro;
      $("#food-phrase").textContent = food.phrase;
      $("#food-art").innerHTML = foodArt(food.id);
      configureSave($("#food-save"), food.id, "Save dish");
      $$('[data-food]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.food) === foodIndex)));
      updateSaved(); enter($("#food-art"));
    }
    $("#food-list").addEventListener("click", (event) => { const button = event.target.closest('[data-food]'); if (button) { foodIndex = Number(button.dataset.food); renderFood(); } });
    $("#food-copy").addEventListener("click", (event) => copyText(S.foods[foodIndex].phrase, event.currentTarget));
    renderFood();

    $("#stay-list").innerHTML = S.stays.map((stay, index) => `<button type="button" class="trip-stay-option" data-stay="${index}" aria-pressed="${index === stayIndex}"><strong>${esc(stay.name)}</strong><span>${esc(stay.best)}</span></button>`).join("");
    $("#stay-pins").innerHTML = S.stays.map((stay, index) => `<button type="button" class="trip-stay-pin" data-stay="${index}" style="left:${stay.pos[0]/6}%;top:${stay.pos[1]/4.2}%" aria-pressed="${index === stayIndex}" aria-label="Show ${esc(stay.name)} neighborhood">${index+1}</button>`).join("");
    function renderStay() {
      const stay = S.stays[stayIndex];
      $("#stay-name").textContent = stay.name;
      $("#stay-chinese").textContent = stay.cn;
      $("#stay-description").textContent = stay.desc;
      $("#stay-best").textContent = stay.best;
      $$('[data-stay]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.stay) === stayIndex)));
    }
    for (const id of ["stay-list", "stay-pins"]) $("#"+id).addEventListener("click", (event) => { const button = event.target.closest('[data-stay]'); if (button) { stayIndex = Number(button.dataset.stay); renderStay(); } });
    $("#stay-copy").addEventListener("click", (event) => copyText(S.stays[stayIndex].cn, event.currentTarget));
    renderStay();
    $$('[data-temperature]').forEach((button) => button.addEventListener("click", () => setOutfit(Number(button.dataset.temperature))));
    function setOutfit(temperature) {
      const outfit = S.outfitSets.find((item) => temperature <= item.max);
      $("#outfit-temperature").textContent = `${temperature}°C`;
      $("#outfit-label").textContent = outfit.label;
      $("#outfit-chips").innerHTML = outfit.chips.map((chip) => `<span>${esc(chip)}</span>`).join("");
      $("#outfit-image").src = D.images[temperature <= 13 ? "outfit-cold" : "outfit-mild"];
      $("#outfit-image").alt = temperature <= 13 ? "Illustrative cool-weather outfit" : "Illustrative lighter outfit";
      $$('[data-temperature]').forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.temperature) === temperature)));
      enter($("#outfit-image"));
    }
    setOutfit(10);
    $$('[data-open-phrases]').forEach((button) => button.addEventListener("click", () => openDialog("#trip-phrases")));
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        const active = entries.find((entry) => entry.isIntersecting);
        if (!active) return;
        $$(".trip-section-nav a").forEach((link) => {
          if (link.hash === "#" + active.target.id) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }, { rootMargin: "-15% 0px -55% 0px", threshold: 0 });
      $$("#journey, #discover, #food, #stay, #tools").forEach((section) => observer.observe(section));
    }
    updateSaved();
  }

  if (page === "home") setupHome();
  if (page === "essentials") setupEssentials();
  if (page === "shanghai") setupShanghai();
  document.body.classList.add("trip-ready");
})();
