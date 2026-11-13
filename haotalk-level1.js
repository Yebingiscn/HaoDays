(() => {
  "use strict";

  const page = document.querySelector(".lesson-page");
  if (!page) return;

  const data = JSON.parse(document.querySelector("#level1-data").textContent);
  const stepIds = ["watch", "dialogue", "learn", "listen", "speak", "review"];
  const practiceIds = stepIds.filter((step) => step !== "watch");
  const storageKey = "haodays.haotalk.scene01.level1.v1";
  const freshState = () => ({ done: [], mastery: [], answers: { listen: [], review: [] }, submitted: { listen: false, review: false } });
  const questions = { listen: data.listen, review: data.review_quiz };
  let state = freshState();
  let storageAvailable = true;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") {
      if (Array.isArray(saved.done)) state.done = [...new Set(saved.done.filter((step) => practiceIds.includes(step)))];
      if (Array.isArray(saved.mastery)) state.mastery = [...new Set(saved.mastery.filter((index) => Number.isInteger(index) && index >= 0 && index < data.recall.length))];
      for (const name of Object.keys(questions)) {
        const answers = saved.answers?.[name];
        if (Array.isArray(answers) && answers.length === questions[name].length && answers.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < questions[name][index].choices.length)) {
          state.answers[name] = answers;
          state.submitted[name] = saved.submitted?.[name] === true;
        }
      }
    }
  } catch {
    storageAvailable = false;
  }

  const progressStatus = page.querySelector("#lesson-progress-status");
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      storageAvailable = false;
    }
  };

  const score = (name) => questions[name].reduce((total, question, index) => total + Number(state.answers[name][index] === question.answer), 0);

  function renderProgress() {
    page.querySelector("#lesson-progress-text").textContent = `${state.done.length} / ${practiceIds.length}`;
    page.querySelector("#lesson-progress").value = state.done.length;
    page.querySelector(".lesson-progress-box p").textContent = storageAvailable ? "Progress is saved on this device." : "Progress is available for this visit.";
    page.querySelectorAll("[data-complete]").forEach((button) => {
      const done = state.done.includes(button.dataset.complete);
      button.setAttribute("aria-pressed", String(done));
      button.textContent = done ? "Practised ✓" : "Mark as practised";
    });
    page.querySelectorAll(".lesson-nav [data-step]").forEach((link) => {
      link.querySelector(".lesson-step-tick").textContent = state.done.includes(link.dataset.step) ? "✓" : "";
    });
    page.querySelectorAll("[data-mastery]").forEach((checkbox) => {
      checkbox.checked = state.mastery.includes(Number(checkbox.dataset.mastery));
    });
    page.querySelector("#result-listen").textContent = state.submitted.listen ? `${score("listen")} / ${questions.listen.length}` : "Not checked";
    page.querySelector("#result-review").textContent = state.submitted.review ? `${score("review")} / ${questions.review.length}` : "Not checked";
    page.querySelector("#result-mastery").textContent = `${state.mastery.length} / ${data.recall.length}`;
    page.querySelector("#result-speaking").textContent = state.done.includes("speak") ? "Practised aloud" : "Not marked yet";
  }

  function setComplete(step, complete) {
    if (!practiceIds.includes(step)) return;
    const completed = new Set(state.done);
    if (complete) completed.add(step);
    else completed.delete(step);
    state.done = [...completed];
    save();
    renderProgress();
    progressStatus.textContent = complete ? "Practice saved. You can revisit this step any time." : "This step is ready to practise again.";
  }

  page.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => setComplete(button.dataset.complete, !state.done.includes(button.dataset.complete)));
  });

  page.querySelectorAll("[data-mastery]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const mastered = new Set(state.mastery);
      const index = Number(checkbox.dataset.mastery);
      if (checkbox.checked) mastered.add(index);
      else mastered.delete(index);
      state.mastery = [...mastered];
      save();
      renderProgress();
    });
  });

  const audioStatus = page.querySelector("#lesson-audio-status");
  const stopButton = page.querySelector("#lesson-stop");
  const speed = page.querySelector("#lesson-speed");
  const synth = window.speechSynthesis;
  const speechSupported = Boolean(synth && typeof window.SpeechSynthesisUtterance === "function");
  let playbackToken = 0;
  let cancelCurrent = null;
  let currentStep = "watch";

  function clearSpeaking() {
    page.querySelectorAll(".is-speaking").forEach((line) => line.classList.remove("is-speaking"));
  }

  function stopSpeech(message = "") {
    playbackToken += 1;
    cancelCurrent?.();
    cancelCurrent = null;
    if (speechSupported) synth.cancel();
    clearSpeaking();
    stopButton.disabled = true;
    if (message) audioStatus.textContent = message;
  }

  function chooseVoice() {
    const voices = synth.getVoices();
    return voices.find((voice) => /^(zh[-_]CN|cmn)/i.test(voice.lang))
      || voices.find((voice) => /^zh[-_](TW|SG|Hans|Hant)/i.test(voice.lang))
      || voices.find((voice) => voice.lang.toLowerCase() === "zh");
  }

  async function getChineseVoice() {
    const ready = chooseVoice();
    if (ready || synth.getVoices().length) return ready;
    await new Promise((resolve) => {
      const finish = () => { clearTimeout(timeout); synth.removeEventListener("voiceschanged", finish); resolve(); };
      const timeout = setTimeout(finish, 1400);
      synth.addEventListener("voiceschanged", finish, { once: true });
    });
    return chooseVoice();
  }

  async function playLines(lines, dialogueIndexes = []) {
    stopSpeech();
    const token = playbackToken;
    if (!speechSupported) {
      audioStatus.textContent = "Audio is unavailable in this browser. You can still use the Chinese, pinyin and written prompts.";
      return;
    }
    const voice = await getChineseVoice();
    if (token !== playbackToken) return;
    if (!voice) {
      audioStatus.textContent = "A Chinese voice is not available on this device. Use the pinyin, or open ‘Read the line’ for a written prompt.";
      return;
    }
    stopButton.disabled = false;
    audioStatus.textContent = Number(speed.value) < 1 ? "Playing slowly. Listen, then repeat." : "Playing. Listen, then repeat.";
    let failed = false;
    for (let index = 0; index < lines.length; index += 1) {
      if (token !== playbackToken) return;
      clearSpeaking();
      const line = dialogueIndexes[index] === undefined ? null : page.querySelector(`[data-line="${dialogueIndexes[index]}"]`);
      line?.classList.add("is-speaking");
      if (line && lines.length > 1 && currentStep === "dialogue") {
        line.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
      const played = await new Promise((resolve) => {
        let finished = false;
        const finish = (success) => {
          if (finished) return;
          finished = true;
          if (cancelCurrent === cancel) cancelCurrent = null;
          resolve(success);
        };
        const cancel = () => finish(false);
        cancelCurrent = cancel;
        const utterance = new SpeechSynthesisUtterance(lines[index]);
        utterance.voice = voice;
        utterance.lang = voice.lang || "zh-CN";
        utterance.rate = Number(speed.value);
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        try { synth.speak(utterance); } catch { finish(false); }
      });
      if (token !== playbackToken) return;
      if (!played) { failed = true; break; }
    }
    if (token !== playbackToken) return;
    clearSpeaking();
    stopButton.disabled = true;
    audioStatus.textContent = failed ? "Audio could not play. Try again, or use the written prompt." : "Your turn: try saying it without the prompt.";
  }

  page.querySelectorAll("[data-say]").forEach((button) => {
    button.addEventListener("click", () => {
      const lineIndex = button.hasAttribute("data-dialogue-line") ? [Number(button.dataset.dialogueLine)] : [];
      playLines([button.dataset.say], lineIndex);
    });
  });
  page.querySelector("#dialogue-play-all").addEventListener("click", () => playLines(data.dialogue.map((line) => line[1]), data.dialogue.map((_, index) => index)));
  stopButton.addEventListener("click", () => stopSpeech("Audio stopped. Play any line when you are ready."));
  speed.addEventListener("change", () => stopSpeech("Speed changed. Play a line to hear it at the new speed."));
  window.addEventListener("pagehide", () => stopSpeech());
  if (!speechSupported) audioStatus.textContent = "Audio is unavailable in this browser. Written prompts are available in every step.";

  function showStep(requested, { push = false, move = false } = {}) {
    const step = stepIds.includes(requested) ? requested : "watch";
    if (step !== currentStep) stopSpeech("Listen, then try saying it yourself.");
    currentStep = step;
    page.querySelectorAll(".lesson-panel").forEach((panel) => { panel.hidden = panel.id !== step; });
    page.querySelectorAll(".lesson-nav [data-step]").forEach((link) => {
      if (link.dataset.step === step) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    });
    if (push) history.pushState(null, "", `#${step}`);
    if (move) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      page.querySelector("#lesson-content").scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      page.querySelector(`#${step} h2`).focus({ preventScroll: true });
    }
  }

  page.querySelectorAll("[data-step-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showStep(link.getAttribute("href").slice(1), { push: true, move: true });
    });
  });
  window.addEventListener("popstate", () => showStep(location.hash.slice(1), { move: true }));
  window.addEventListener("hashchange", () => showStep(location.hash.slice(1), { move: true }));

  for (const [checkboxId, attribute] of [["show-pinyin", "data-pinyin"], ["show-english", "data-english"]]) {
    const checkbox = page.querySelector(`#${checkboxId}`);
    checkbox.addEventListener("change", () => {
      page.querySelectorAll(`#dialogue [${attribute}]`).forEach((line) => { line.hidden = !checkbox.checked; });
    });
  }

  page.querySelector("#dialogue-copy-button").addEventListener("click", async () => {
    const text = data.dialogue.map((line) => `${line[0] === "staff" ? "空乘" : "Alex"}：${line[1]}\n${line[2]}\n${line[3]}`).join("\n\n");
    const status = page.querySelector("#dialogue-copy-status");
    const fallback = page.querySelector("#dialogue-copy-fallback");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      status.textContent = "Dialogue copied, including pinyin and English.";
    } catch {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = "Select and copy the dialogue from the box below.";
    }
  });

  function renderQuiz(name) {
    const form = page.querySelector(`#${name}-quiz`);
    const submitted = state.submitted[name];
    form.querySelectorAll("[data-question]").forEach((fieldset, index) => {
      const question = questions[name][index];
      const correct = state.answers[name][index] === question.answer;
      if (submitted) fieldset.dataset.result = correct ? "correct" : "incorrect";
      else delete fieldset.dataset.result;
      fieldset.querySelectorAll("input[type=radio]").forEach((input) => {
        const value = Number(input.value);
        input.checked = submitted && state.answers[name][index] === value;
        input.disabled = submitted;
        const option = input.closest(".lesson-option");
        option.classList.toggle("is-correct", submitted && value === question.answer);
        option.classList.toggle("is-wrong", submitted && input.checked && !correct);
      });
      const feedback = fieldset.querySelector(".lesson-feedback");
      feedback.hidden = !submitted;
      feedback.textContent = submitted ? `${correct ? "Correct." : "Not quite."} ${question.explanation}` : "";
    });
    form.querySelector("button[type=submit]").disabled = submitted;
    form.querySelector("[data-retry]").hidden = !submitted;
    form.querySelector("[data-quiz-status]").textContent = submitted ? `${score(name)} / ${questions[name].length} correct. Read the explanations, then try again whenever you like.` : "";
  }

  for (const name of Object.keys(questions)) {
    const form = page.querySelector(`#${name}-quiz`);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const choices = questions[name].map((_, index) => form.querySelector(`input[name="${name}-${index}"]:checked`));
      const missing = choices.findIndex((choice) => !choice);
      if (missing !== -1) {
        form.querySelector("[data-quiz-status]").textContent = "Choose an answer for each question before checking.";
        form.querySelector(`[data-question="${missing}"] input`).focus();
        return;
      }
      state.answers[name] = choices.map((choice) => Number(choice.value));
      state.submitted[name] = true;
      setComplete(name === "listen" ? "listen" : "review", true);
      renderQuiz(name);
    });
    form.querySelector("[data-retry]").addEventListener("click", () => {
      state.answers[name] = [];
      state.submitted[name] = false;
      save();
      renderQuiz(name);
      renderProgress();
    });
  }

  function updateBuilder() {
    const item = data.builder_items[Number(page.querySelector("#builder-item").value)];
    const ask = page.querySelector("#builder-pattern").value === "have";
    const zh = ask ? `有${item.zh}吗？` : `我要${item.zh}，谢谢。`;
    const py = ask ? `Yǒu ${item.py} ma?` : `Wǒ yào ${item.py}, xièxie.`;
    const english = ask ? `Do you have ${item.en}?` : `I'd like ${item.en}, thank you.`;
    const result = page.querySelector("#builder-result");
    result.querySelector(".lesson-zh").textContent = zh;
    result.querySelector(".lesson-pinyin").textContent = py;
    result.querySelector(".lesson-english").textContent = english;
    page.querySelector("#builder-listen").dataset.say = zh;
  }
  page.querySelector("#builder-pattern").addEventListener("change", updateBuilder);
  page.querySelector("#builder-item").addEventListener("change", updateBuilder);

  page.querySelector("#lesson-reset").addEventListener("click", () => {
    stopSpeech("Listen, then try saying it yourself.");
    state = freshState();
    save();
    for (const name of Object.keys(questions)) renderQuiz(name);
    renderProgress();
    progressStatus.textContent = "Lesson progress reset. Your next practice starts here.";
  });

  for (const name of Object.keys(questions)) renderQuiz(name);
  renderProgress();
  updateBuilder();
  showStep(location.hash.slice(1), { move: Boolean(location.hash) });
})();
