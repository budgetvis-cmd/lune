const STORAGE_KEY = "cycle-doux-state-v1";
const INSTALL_DISMISSED_KEY = "cycle-doux-install-dismissed";
const REMINDER_HISTORY_KEY = "cycle-doux-reminder-history";

const state = loadState();
let deferredInstallPrompt = null;

const els = {
  onboarding: document.querySelector("#onboarding"),
  appShell: document.querySelector("#appShell"),
  onboardingForm: document.querySelector("#onboardingForm"),
  onboardingPeriodInputs: [...document.querySelectorAll(".onboarding-period-date")],
  onboardingCycleLength: document.querySelector("#onboardingCycleLength"),
  onboardingPeriodLength: document.querySelector("#onboardingPeriodLength"),
  skipOnboardingButton: document.querySelector("#skipOnboardingButton"),
  restartOnboardingButton: document.querySelector("#restartOnboardingButton"),
  configurationPrompt: document.querySelector("#configurationPrompt"),
  configureNowButton: document.querySelector("#configureNowButton"),
  installPrompt: document.querySelector("#installPrompt"),
  installAppButton: document.querySelector("#installAppButton"),
  dismissInstallButton: document.querySelector("#dismissInstallButton"),
  todayLabel: document.querySelector("#todayLabel"),
  installPromptHint: document.querySelector("#installPromptHint"),
  cycleDay: document.querySelector("#cycleDay"),
  cyclePhase: document.querySelector("#cyclePhase"),
  nextPeriod: document.querySelector("#nextPeriod"),
  nextPeriodHint: document.querySelector("#nextPeriodHint"),
  fertileWindow: document.querySelector("#fertileWindow"),
  ovulationHint: document.querySelector("#ovulationHint"),
  babyChanceTitle: document.querySelector("#babyChanceTitle"),
  babyChanceHint: document.querySelector("#babyChanceHint"),
  cycleRecap: document.querySelector("#cycleRecap"),
  cycleRecapMeta: document.querySelector("#cycleRecapMeta"),
  recapFlowDays: document.querySelector("#recapFlowDays"),
  recapMucus: document.querySelector("#recapMucus"),
  recapIntercourse: document.querySelector("#recapIntercourse"),
  recapSymptoms: document.querySelector("#recapSymptoms"),
  cycleForm: document.querySelector("#cycleForm"),
  lastPeriodStart: document.querySelector("#lastPeriodStart"),
  cycleLength: document.querySelector("#cycleLength"),
  periodLength: document.querySelector("#periodLength"),
  addPeriodButton: document.querySelector("#addPeriodButton"),
  periodHistory: document.querySelector("#periodHistory"),
  historyTemplate: document.querySelector("#historyItemTemplate"),
  calendar: document.querySelector("#calendar"),
  journalDate: document.querySelector("#journalDate"),
  journalNotes: document.querySelector("#journalNotes"),
  saveJournalButton: document.querySelector("#saveJournalButton"),
  saveState: document.querySelector("#saveState"),
  exportButton: document.querySelector("#exportButton"),
  markPeriodStartButton: document.querySelector("#markPeriodStartButton"),
  reminderInputs: [...document.querySelectorAll("[data-reminder]")],
  remindersStatus: document.querySelector("#remindersStatus"),
  testNotificationButton: document.querySelector("#testNotificationButton"),
};

const formatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

init();

function init() {
  const today = startOfDay(new Date());
  const todayString = toDateInput(today);
  els.todayLabel.textContent = capitalize(formatter.format(today));
  els.journalDate.value = todayString;
  els.journalDate.max = todayString;
  els.lastPeriodStart.max = todayString;
  els.onboardingPeriodInputs.forEach((input) => {
    input.max = todayString;
  });
  hydrateForm();
  bindEvents();
  registerServiceWorker();
  scheduleMidnightRefresh();
  render();
}

function loadState() {
  const fallback = {
    schemaVersion: 3,
    settings: {
      lastPeriodStart: "",
      cycleLength: 28,
      periodLength: 5,
    },
    periods: [],
    journal: {},
    reminders: { period: false, fertile: false, ovulation: false },
    onboardingComplete: false,
    trackingGoal: "cycle",
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;

    const merged = {
      ...fallback,
      ...saved,
      settings: { ...fallback.settings, ...saved.settings },
      periods: Array.isArray(saved.periods) ? saved.periods : [],
      journal: saved.journal && typeof saved.journal === "object" ? saved.journal : {},
      reminders: { ...fallback.reminders, ...(saved.reminders || {}) },
    };

    if (!saved.schemaVersion || saved.schemaVersion < 2) {
      for (const [date, entry] of Object.entries(merged.journal)) {
        if (entry && typeof entry === "object") {
          if (!entry.mucus) entry.mucus = "none";
          if (!entry.intercourse) entry.intercourse = "none";
          merged.journal[date] = entry;
        }
      }
    }

    if (!saved.schemaVersion || saved.schemaVersion < 3) {
      for (const [date, entry] of Object.entries(merged.journal)) {
        if (entry && typeof entry === "object") {
          if (!entry.ovulationTest) entry.ovulationTest = "none";
          merged.journal[date] = entry;
        }
      }
    }

    merged.schemaVersion = 3;
    return merged;
  } catch {
    return fallback;
  }
}

let currentDayString = toDateInput(startOfDay(new Date()));

function refreshDayContext() {
  const today = startOfDay(new Date());
  const todayString = toDateInput(today);
  if (todayString === currentDayString) return;

  currentDayString = todayString;
  els.todayLabel.textContent = capitalize(formatter.format(today));
  els.journalDate.max = todayString;
  els.lastPeriodStart.max = todayString;
  els.onboardingPeriodInputs.forEach((input) => {
    input.max = todayString;
  });
  render();
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const delay = Math.max(1000, tomorrow.getTime() - now.getTime());
  setTimeout(() => {
    refreshDayContext();
    scheduleMidnightRefresh();
  }, delay);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDayContext();
});

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // L'app reste utilisable si le navigateur bloque le mode hors ligne.
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateForm() {
  els.lastPeriodStart.value = state.settings.lastPeriodStart;
  els.cycleLength.value = state.settings.cycleLength;
  els.periodLength.value = state.settings.periodLength;
  hydrateOnboarding();
}

function hydrateOnboarding() {
  els.onboardingPeriodInputs.forEach((input, index) => {
    input.value = state.periods[index] || "";
  });
  els.onboardingCycleLength.value = state.settings.cycleLength;
  els.onboardingPeriodLength.value = state.settings.periodLength;
  document.querySelectorAll("[data-goal]").forEach((button) => {
    const isActive = button.dataset.goal === state.trackingGoal;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function bindEvents() {
  els.onboardingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    completeOnboarding();
  });

  els.skipOnboardingButton.addEventListener("click", () => {
    state.onboardingComplete = true;
    saveState();
    renderAppVisibility();
    render();
  });

  els.restartOnboardingButton.addEventListener("click", () => {
    openOnboarding();
  });

  els.configureNowButton.addEventListener("click", openOnboarding);
  els.installAppButton.addEventListener("click", installApp);
  els.dismissInstallButton.addEventListener("click", dismissInstallPrompt);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallPrompt();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    renderInstallPrompt();
  });

  document.querySelectorAll("[data-goal]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trackingGoal = button.dataset.goal;
      hydrateOnboarding();
    });
  });

  els.cycleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateSettings();
  });

  document.querySelectorAll("[data-step-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector(`#${button.dataset.stepTarget}`);
      const step = Number(button.dataset.step);
      const min = Number(input.min);
      const max = Number(input.max);
      input.value = clamp(Number(input.value) + step, min, max);
      updateSettings();
    });
  });

  els.addPeriodButton.addEventListener("click", () => {
    const value = els.lastPeriodStart.value || toDateInput(new Date());
    addPeriod(value);
  });

  els.periodHistory.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-period]");
    if (!button) return;
    state.periods = state.periods.filter((date) => date !== button.dataset.removePeriod);
    if (state.settings.lastPeriodStart === button.dataset.removePeriod) {
      state.settings.lastPeriodStart = state.periods[0] || "";
    }
    saveState();
    hydrateForm();
    render();
  });

  els.calendar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-date]");
    if (!button) return;
    els.journalDate.value = button.dataset.date;
    loadJournalEntry(button.dataset.date);
  });

  document.querySelectorAll("[data-flow]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveButton("[data-flow]", button);
      updateFlowMarkingHint();
    });
  });

  document.querySelectorAll("[data-symptom]").forEach((button) => {
    button.addEventListener("click", () => {
      const isActive = button.classList.toggle("is-active");
      button.setAttribute("aria-pressed", String(isActive));
    });
  });

  document.querySelectorAll("[data-mucus]").forEach((button) => {
    button.addEventListener("click", () => setActiveButton("[data-mucus]", button));
  });

  document.querySelectorAll("[data-intercourse]").forEach((button) => {
    button.addEventListener("click", () => setActiveButton("[data-intercourse]", button));
  });

  document.querySelectorAll("[data-ovutest]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveButton("[data-ovutest]", button);
      autoSaveOvulationTest(button.dataset.ovutest);
    });
  });

  els.markPeriodStartButton.addEventListener("click", togglePeriodStart);

  els.reminderInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.reminder;
      const wantsOn = input.checked;
      if (wantsOn) {
        ensureNotificationPermission().then((granted) => {
          state.reminders[key] = granted;
          input.checked = granted;
          saveState();
          renderReminders();
          if (granted) checkReminders();
        });
      } else {
        state.reminders[key] = false;
        saveState();
        renderReminders();
      }
    });
  });

  els.testNotificationButton.addEventListener("click", async () => {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      renderReminders();
      return;
    }
    showNotification("Lune", {
      body: "Les rappels fonctionnent. Tu recevras les prochains quand l'app est ouverte.",
      tag: "lune-test",
    });
  });

  els.journalDate.addEventListener("change", () => loadJournalEntry(els.journalDate.value));
  els.saveJournalButton.addEventListener("click", saveJournalEntry);
  els.exportButton.addEventListener("click", exportData);
}

function completeOnboarding() {
  const todayString = toDateInput(startOfDay(new Date()));
  const periodDates = uniqueDates(
    els.onboardingPeriodInputs
      .map((input) => input.value)
      .filter(isValidDateString)
      .filter((value) => value <= todayString),
  ).sort().reverse();
  const fallbackCycleLength = clamp(Number(els.onboardingCycleLength.value), 21, 45);
  const cycleStats = getCycleStats(periodDates, fallbackCycleLength);
  const periodLength = clamp(Number(els.onboardingPeriodLength.value), 2, 10);

  state.periods = periodDates;
  state.settings = {
    lastPeriodStart: periodDates[0] || "",
    cycleLength: cycleStats.average,
    periodLength,
  };
  state.onboardingComplete = true;

  saveState();
  hydrateForm();
  renderAppVisibility();
  render();
}

function updateSettings() {
  const lastPeriodStart = els.lastPeriodStart.value;
  const cycleLength = clamp(els.cycleLength.value, 21, 45);
  const periodLength = clamp(els.periodLength.value, 2, 10);

  state.settings = { lastPeriodStart, cycleLength, periodLength };
  if (lastPeriodStart && isValidDateString(lastPeriodStart)) {
    state.periods = uniqueDates([lastPeriodStart, ...state.periods]).sort().reverse();
    state.settings.lastPeriodStart = state.periods[0];
  }

  saveState();
  hydrateForm();
  render();
}

function addPeriod(dateString, shouldRender = true) {
  if (!isValidDateString(dateString)) return;
  const todayString = toDateInput(startOfDay(new Date()));
  if (dateString > todayString) return;

  state.periods = uniqueDates([dateString, ...state.periods]).sort().reverse();
  state.settings.lastPeriodStart = state.periods[0];
  saveState();

  if (shouldRender) {
    hydrateForm();
    render();
  }
}

function render() {
  renderAppVisibility();
  renderSummary();
  renderCycleRecap();
  renderHistory();
  renderCalendar();
  renderReminders();
  loadJournalEntry(els.journalDate.value);
  checkReminders();
}

function renderCycleRecap() {
  const lastStart = getLastPeriodStart();
  if (!lastStart) {
    els.cycleRecap.classList.add("is-hidden");
    return;
  }

  const today = startOfDay(new Date());
  const cycleStart = lastStart;
  const cycleEnd = today;
  let flowDays = 0;
  let mucusDays = 0;
  let intercourseDays = 0;
  const symptomCounts = new Map();

  for (const [dateString, entry] of Object.entries(state.journal)) {
    if (!entry || !isValidDateString(dateString)) continue;
    const date = parseDate(dateString);
    if (diffDays(cycleStart, date) < 0) continue;
    if (diffDays(date, cycleEnd) < 0) continue;

    if (entry.flow && entry.flow !== "none") flowDays += 1;
    if (entry.mucus && entry.mucus !== "none") mucusDays += 1;
    if (entry.intercourse && entry.intercourse !== "none") intercourseDays += 1;
    if (Array.isArray(entry.symptoms)) {
      for (const symptom of entry.symptoms) {
        symptomCounts.set(symptom, (symptomCounts.get(symptom) || 0) + 1);
      }
    }
  }

  let dominantSymptom = "—";
  if (symptomCounts.size > 0) {
    const sorted = [...symptomCounts.entries()].sort((a, b) => b[1] - a[1]);
    dominantSymptom = capitalize(sorted[0][0]);
  }

  els.recapFlowDays.textContent = String(flowDays);
  els.recapMucus.textContent = String(mucusDays);
  els.recapIntercourse.textContent = String(intercourseDays);
  els.recapSymptoms.textContent = dominantSymptom;

  const dayInCycle = diffDays(cycleStart, today) + 1;
  els.cycleRecapMeta.textContent = dayInCycle > 0
    ? `Jour ${dayInCycle} · démarré le ${shortFormatter.format(cycleStart)}`
    : `Cycle estimé · ${shortFormatter.format(cycleStart)}`;
  els.cycleRecap.classList.remove("is-hidden");
}

function renderAppVisibility() {
  const shouldShowOnboarding = !state.onboardingComplete;
  els.onboarding.classList.toggle("is-hidden", !shouldShowOnboarding);
  els.appShell.classList.toggle("is-hidden", shouldShowOnboarding);
  els.configurationPrompt.classList.toggle("is-hidden", shouldShowOnboarding || Boolean(getLastPeriodStart()));
  renderInstallPrompt();
}

function openOnboarding() {
  state.onboardingComplete = false;
  saveState();
  hydrateOnboarding();
  renderAppVisibility();
}

async function installApp() {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  renderInstallPrompt();
}

function isIosDevice() {
  const ua = navigator.userAgent || "";
  const isIosUa = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIosUa || isIpadOs;
}

function dismissInstallPrompt() {
  localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  renderInstallPrompt();
}

function renderInstallPrompt() {
  const isDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const ios = isIosDevice();
  const canPrompt = Boolean(deferredInstallPrompt);
  const shouldShow = state.onboardingComplete && !isDismissed && !isStandalone && (canPrompt || ios);

  els.installPrompt.classList.toggle("is-hidden", !shouldShow);
  if (!shouldShow) return;

  if (canPrompt) {
    els.installAppButton.hidden = false;
    els.installAppButton.disabled = false;
    els.installAppButton.textContent = "Installer";
    els.installPromptHint.textContent =
      "Ajoute l'app à l'écran d'accueil pour l'ouvrir comme une vraie app, même hors ligne.";
  } else if (ios) {
    els.installAppButton.hidden = true;
    els.installPromptHint.textContent =
      "Sur iPhone : ouvre le menu Partager puis « Sur l'écran d'accueil » pour l'installer.";
  }
}

function renderSummary() {
  const lastStart = getLastPeriodStart();

  if (!lastStart) {
    els.cycleDay.textContent = "--";
    els.cyclePhase.textContent = "Ajoute une date de début pour commencer.";
    els.nextPeriod.textContent = "--";
    els.fertileWindow.textContent = "--";
    els.babyChanceTitle.textContent = "Régulier";
    els.babyChanceHint.textContent = "Pendant la fenêtre fertile, faire l'amour souvent augmente les chances.";
    return;
  }

  const today = startOfDay(new Date());
  const cycleStats = getCycleStats();
  const anchoredCycle = {
    currentStart: lastStart,
    nextStart: addDays(lastStart, cycleStats.average),
  };
  const windows = getCycleWindows(anchoredCycle, cycleStats);
  const cycleDay = diffDays(lastStart, today) + 1;
  const daysToPeriod = diffDays(today, windows.nextStart);
  const recordedPeriodLength = getRecordedPeriodLength(toDateInput(lastStart));
  const isActualPeriod = cycleDay >= 1 && cycleDay <= recordedPeriodLength;
  const isOverdue = daysToPeriod < 0;

  els.cycleDay.textContent = cycleDay > 0 ? String(cycleDay) : "--";
  els.cyclePhase.textContent = phaseLabel(today, lastStart, windows, {
    isActualPeriod,
    isOverdue,
    daysToPeriod,
  });
  els.nextPeriod.textContent = formatNextPeriodValue(daysToPeriod, cycleStats, windows, today);
  els.nextPeriodHint.textContent = formatNextPeriodHint(cycleStats, windows, isOverdue, daysToPeriod);
  els.fertileWindow.textContent = formatDateRange(windows.fertileStart, windows.fertileEnd);
  els.ovulationHint.textContent = formatOvulationHint(cycleStats, windows);
  renderBabyChance(today, windows);
}

function formatNextPeriodValue(daysToPeriod, cycleStats, windows, today) {
  if (windows.refinedByMucus || !cycleStats.isVariable) {
    if (daysToPeriod === 0) return "Attendues aujourd'hui";
    if (daysToPeriod < 0) return `En retard de ${Math.abs(daysToPeriod)} j`;
    return relativeDays(daysToPeriod);
  }
  const earliest = diffDays(today, windows.nextStartEarliest);
  const latest = diffDays(today, windows.nextStartLatest);
  if (latest < 0) return `En retard de ${Math.abs(latest)} j`;
  return relativeRange(earliest, latest);
}

function formatNextPeriodHint(cycleStats, windows, isOverdue, daysToPeriod) {
  if (isOverdue) {
    return "Pense à enregistrer le début des règles si elles sont arrivées.";
  }
  if (windows.refinedByMucus) {
    return `${shortFormatter.format(windows.nextStart)} · Affiné par la glaire`;
  }
  if (cycleStats.isVariable) {
    return `${formatDateRange(windows.nextStartEarliest, windows.nextStartLatest)} · ${cycleStats.label}`;
  }
  return `${shortFormatter.format(windows.nextStart)} · ${cycleStats.label}`;
}

function formatOvulationHint(cycleStats, windows) {
  if (windows.refinedBy === "test-positive") {
    return `Test positif détecté · pic estimé ${shortFormatter.format(windows.ovulationPeak)}`;
  }
  if (windows.refinedBy === "test-negative") {
    return `Test négatif · pic repoussé au ${shortFormatter.format(windows.ovulationPeak)}`;
  }
  if (windows.refinedBy === "mucus+negative") {
    return `Glaire + test négatif · pic estimé ${shortFormatter.format(windows.ovulationPeak)}`;
  }
  if (windows.refinedByMucus) {
    return `Pic détecté par la glaire le ${shortFormatter.format(windows.ovulationPeak)}`;
  }
  const peakLabel = `Pic estimé ${shortFormatter.format(windows.ovulationPeak)}`;
  if (cycleStats.spread >= 7) {
    return `${peakLabel} · cycles variables, fie-toi à la glaire ou aux tests`;
  }
  if (cycleStats.isVariable) {
    return `${peakLabel} · zone ${formatDateRange(windows.ovulationStart, windows.ovulationEnd)}`;
  }
  return `Ovulation estimée le ${shortFormatter.format(windows.ovulationPeak)}`;
}

function renderBabyChance(today, windows) {
  const isFertileNow = isBetween(today, windows.fertileStart, windows.fertileEnd);
  const isClose = isBetween(today, addDays(windows.fertileStart, -3), windows.fertileEnd);

  if (isFertileNow) {
    els.babyChanceTitle.textContent = "C'est le moment";
    els.babyChanceHint.textContent = "Dans cette fenêtre, des rapports tous les jours ou un jour sur deux augmentent les chances.";
    return;
  }

  if (isClose) {
    els.babyChanceTitle.textContent = "Bientôt";
    els.babyChanceHint.textContent = `Autour du ${shortFormatter.format(windows.fertileStart)}, essayez régulièrement si vous en avez envie.`;
    return;
  }

  els.babyChanceTitle.textContent = "Régulier";
  els.babyChanceHint.textContent = "Le plus utile est de faire l'amour souvent pendant la fenêtre fertile, idéalement tous les jours ou un jour sur deux.";
}

function renderHistory() {
  els.periodHistory.textContent = "";

  if (!state.periods.length) {
    const empty = document.createElement("li");
    empty.textContent = "Aucune entrée pour le moment";
    els.periodHistory.append(empty);
    return;
  }

  state.periods.slice(0, 8).forEach((dateString) => {
    const item = els.historyTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector("span").textContent = shortFormatter.format(parseDate(dateString));
    const button = item.querySelector("button");
    button.dataset.removePeriod = dateString;
    els.periodHistory.append(item);
  });
}

function renderCalendar() {
  els.calendar.textContent = "";
  const today = startOfDay(new Date());
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let i = 0; i < 3; i += 1) {
    els.calendar.append(renderMonth(addMonths(startMonth, i)));
  }
}

function renderMonth(monthDate) {
  const month = document.createElement("section");
  month.className = "month";
  const heading = document.createElement("h3");
  heading.textContent = capitalize(monthFormatter.format(monthDate));
  month.append(heading);

  const weekdays = document.createElement("div");
  weekdays.className = "weekdays";
  ["L", "M", "M", "J", "V", "S", "D"].forEach((day) => {
    const span = document.createElement("span");
    span.textContent = day;
    weekdays.append(span);
  });
  month.append(weekdays);

  const days = document.createElement("div");
  days.className = "days";
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -startOffset);

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const dateString = toDateInput(date);
    const button = document.createElement("button");
    button.type = "button";
    const journalEntry = state.journal[dateString];
    const flow = getPeriodFlow(date);
    const isFertileMucus = Boolean(
      journalEntry && mucusFertilityScore(journalEntry.mucus) > 0,
    );
    const ovutest = journalEntry ? journalEntry.ovulationTest : "none";
    button.className = classNames("day", {
      "is-muted": date.getMonth() !== monthDate.getMonth(),
      "is-today": sameDate(date, new Date()),
      "is-period": flow !== null,
      "is-period-light": flow === "light",
      "is-period-medium": flow === "medium",
      "is-period-heavy": flow === "heavy",
      "is-period-estimated": flow === "estimated",
      "is-fertile": isFertileDay(date),
      "is-ovulation": isOvulationDay(date),
      "has-journal": Boolean(journalEntry),
      "has-fertile-mucus": isFertileMucus,
      "has-intercourse": Boolean(
        journalEntry && journalEntry.intercourse && journalEntry.intercourse !== "none",
      ),
      "has-test": ovutest && ovutest !== "none",
      "has-test-positive": ovutest === "positive",
      "has-test-negative": ovutest === "negative",
    });
    button.dataset.date = dateString;
    button.textContent = String(date.getDate());
    button.title = formatter.format(date);
    days.append(button);
  }

  month.append(days);
  return month;
}

function loadJournalEntry(dateString) {
  const entry = state.journal[dateString] || {
    flow: "none",
    symptoms: [],
    notes: "",
    mucus: "none",
    intercourse: "none",
    ovulationTest: "none",
  };
  const symptoms = Array.isArray(entry.symptoms) ? entry.symptoms : [];

  setActiveButton("[data-flow]", document.querySelector(`[data-flow="${entry.flow || "none"}"]`));
  setActiveButton("[data-mucus]", document.querySelector(`[data-mucus="${entry.mucus || "none"}"]`));
  setActiveButton(
    "[data-intercourse]",
    document.querySelector(`[data-intercourse="${entry.intercourse || "none"}"]`),
  );
  setActiveButton(
    "[data-ovutest]",
    document.querySelector(`[data-ovutest="${entry.ovulationTest || "none"}"]`),
  );
  document.querySelectorAll("[data-symptom]").forEach((button) => {
    const isActive = symptoms.includes(button.dataset.symptom);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  els.journalNotes.value = entry.notes || "";
  els.saveState.textContent = "";
  renderMarkPeriodStartButton(dateString);
  updateFlowMarkingHint();
}

function updateFlowMarkingHint() {
  const active = document.querySelector("[data-flow].is-active");
  const isMarking = Boolean(active && active.dataset.flow !== "none");
  const group = document.querySelector("[data-flow]")?.closest(".journal-group");
  if (!group) return;
  group.classList.toggle("is-marking-period", isMarking);
}

function renderMarkPeriodStartButton(dateString) {
  if (!dateString) {
    els.markPeriodStartButton.disabled = true;
    els.markPeriodStartButton.textContent = "Marquer comme début de règles";
    els.markPeriodStartButton.classList.remove("is-active");
    return;
  }
  const isStart = state.periods.includes(dateString);
  els.markPeriodStartButton.disabled = false;
  els.markPeriodStartButton.classList.toggle("is-active", isStart);
  els.markPeriodStartButton.textContent = isStart
    ? "Retirer ce début de règles"
    : "Marquer comme début de règles";
}

function autoSaveOvulationTest(value) {
  const dateString = els.journalDate.value;
  if (!dateString || !isValidDateString(dateString)) return;
  const todayString = toDateInput(startOfDay(new Date()));
  if (dateString > todayString) {
    els.saveState.textContent = "Pas de test sur une date future";
    return;
  }

  const existing = state.journal[dateString] || {
    flow: "none",
    mucus: "none",
    intercourse: "none",
    ovulationTest: "none",
    symptoms: [],
    notes: "",
  };

  state.journal[dateString] = {
    flow: existing.flow || "none",
    mucus: existing.mucus || "none",
    intercourse: existing.intercourse || "none",
    symptoms: Array.isArray(existing.symptoms) ? existing.symptoms : [],
    notes: existing.notes || "",
    ovulationTest: value,
  };

  saveState();
  renderSummary();
  renderCalendar();
  renderCycleRecap();

  const label = value === "none" ? "Test effacé" : `Test ${OVUTEST_LABELS[value] || value} · estimations mises à jour`;
  els.saveState.textContent = label;
}

function togglePeriodStart() {
  const dateString = els.journalDate.value;
  if (!dateString || !isValidDateString(dateString)) return;
  const todayString = toDateInput(startOfDay(new Date()));
  if (dateString > todayString) return;

  if (state.periods.includes(dateString)) {
    state.periods = state.periods.filter((value) => value !== dateString);
    if (state.settings.lastPeriodStart === dateString) {
      state.settings.lastPeriodStart = state.periods[0] || "";
    }
    saveState();
    hydrateForm();
    render();
    return;
  }

  addPeriod(dateString);
}

function saveJournalEntry() {
  const dateString = els.journalDate.value;
  if (!dateString) return;

  const activeFlow = document.querySelector("[data-flow].is-active");
  const activeMucus = document.querySelector("[data-mucus].is-active");
  const activeIntercourse = document.querySelector("[data-intercourse].is-active");
  const activeOvutest = document.querySelector("[data-ovutest].is-active");
  const symptoms = [...document.querySelectorAll("[data-symptom].is-active")].map(
    (button) => button.dataset.symptom,
  );

  const flow = activeFlow ? activeFlow.dataset.flow : "none";
  const mucus = activeMucus ? activeMucus.dataset.mucus : "none";
  const intercourse = activeIntercourse ? activeIntercourse.dataset.intercourse : "none";
  const ovulationTest = activeOvutest ? activeOvutest.dataset.ovutest : "none";

  state.journal[dateString] = {
    flow,
    mucus,
    intercourse,
    ovulationTest,
    symptoms,
    notes: els.journalNotes.value.trim(),
  };
  saveState();
  render();
  els.saveState.textContent = formatSaveSummary({ flow, mucus, intercourse, ovulationTest, symptoms });
}

const FLOW_LABELS = { none: "aucun", light: "léger", medium: "moyen", heavy: "fort" };
const MUCUS_LABELS = {
  none: "rien", dry: "sèche", sticky: "collante", creamy: "crémeuse", watery: "aqueuse", eggwhite: "blanc d'œuf",
};
const INTERCOURSE_LABELS = { none: "aucun", unprotected: "sans préservatif", protected: "avec préservatif" };
const OVUTEST_LABELS = { none: "non testé", negative: "négatif", positive: "positif" };

function formatSaveSummary({ flow, mucus, intercourse, ovulationTest, symptoms }) {
  const parts = [];
  if (flow !== "none") parts.push(`flux ${FLOW_LABELS[flow] || flow}`);
  if (mucus !== "none") parts.push(`glaire ${MUCUS_LABELS[mucus] || mucus}`);
  if (intercourse !== "none") parts.push(`rapport ${INTERCOURSE_LABELS[intercourse] || intercourse}`);
  if (ovulationTest && ovulationTest !== "none") parts.push(`test ${OVUTEST_LABELS[ovulationTest] || ovulationTest}`);
  if (symptoms.length) parts.push(`${symptoms.length} ressenti${symptoms.length > 1 ? "s" : ""}`);
  if (parts.length === 0) return "Enregistré (rien de particulier)";
  return `Enregistré · ${parts.join(", ")}`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cycle-doux-${toDateInput(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderReminders() {
  els.reminderInputs.forEach((input) => {
    input.checked = Boolean(state.reminders[input.dataset.reminder]);
  });

  if (!("Notification" in window)) {
    els.reminderInputs.forEach((input) => {
      input.disabled = true;
    });
    els.testNotificationButton.disabled = true;
    els.remindersStatus.textContent = "Ce navigateur ne gère pas les notifications.";
    els.remindersStatus.classList.add("is-warning");
    return;
  }

  const permission = Notification.permission;
  els.testNotificationButton.disabled = permission === "denied";

  if (permission === "denied") {
    els.reminderInputs.forEach((input) => {
      input.disabled = true;
    });
    els.remindersStatus.textContent =
      "Les notifications sont bloquées dans le navigateur. Autorise-les dans les réglages du site.";
    els.remindersStatus.classList.add("is-warning");
    return;
  }

  els.reminderInputs.forEach((input) => {
    input.disabled = false;
  });
  els.remindersStatus.classList.remove("is-warning");
  if (permission === "default") {
    els.remindersStatus.textContent = "Active un rappel pour autoriser les notifications.";
  } else {
    els.remindersStatus.textContent = "";
  }
}

async function ensureNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

function showNotification(title, options) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const payload = { icon: "icons/icon.svg", badge: "icons/icon.svg", ...options };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, payload))
      .catch(() => {
        try {
          new Notification(title, payload);
        } catch {
          // Ignored — Notification constructor may be blocked on Android.
        }
      });
    return;
  }
  try {
    new Notification(title, payload);
  } catch {
    // Ignored.
  }
}

function loadReminderHistory() {
  try {
    const raw = localStorage.getItem(REMINDER_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveReminderHistory(history) {
  localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify(history));
}

function markReminderShown(key, dateString) {
  const history = loadReminderHistory();
  history[key] = dateString;
  saveReminderHistory(history);
}

function wasReminderShownToday(key, todayString) {
  const history = loadReminderHistory();
  return history[key] === todayString;
}

function checkReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const lastStart = getLastPeriodStart();
  if (!lastStart) return;

  const anyEnabled = Object.values(state.reminders).some(Boolean);
  if (!anyEnabled) return;

  const today = startOfDay(new Date());
  const todayString = toDateInput(today);
  const stats = getCycleStats();
  const anchoredCycle = {
    currentStart: lastStart,
    nextStart: addDays(lastStart, stats.average),
  };
  const windows = getCycleWindows(anchoredCycle, stats);

  if (state.reminders.period && !wasReminderShownToday("period", todayString)) {
    const target = windows.nextStartEarliest || windows.nextStart;
    const days = diffDays(today, target);
    if (days === 2) {
      showNotification("Lune", {
        body: "Note attendue dans environ 2 jours.",
        tag: "lune-period",
      });
      markReminderShown("period", todayString);
    }
  }

  if (state.reminders.fertile && !wasReminderShownToday("fertile", todayString)) {
    if (sameDate(today, windows.fertileStart)) {
      showNotification("Lune", {
        body: "Phase active commence aujourd'hui.",
        tag: "lune-fertile",
      });
      markReminderShown("fertile", todayString);
    }
  }

  if (state.reminders.ovulation && !wasReminderShownToday("ovulation", todayString)) {
    if (sameDate(today, windows.ovulationPeak)) {
      showNotification("Lune", {
        body: "Pic estimé aujourd'hui.",
        tag: "lune-ovulation",
      });
      markReminderShown("ovulation", todayString);
    }
  }
}

function getLastPeriodStart() {
  const dateString = state.periods[0] || state.settings.lastPeriodStart;
  return dateString ? parseDate(dateString) : null;
}

function isPeriodDay(date) {
  const entry = state.journal[toDateInput(date)];
  if (entry && entry.flow && entry.flow !== "none") return true;

  const withinRecorded = state.periods.some((startString) => {
    const start = parseDate(startString);
    const length = getRecordedPeriodLength(startString);
    return diffDays(start, date) >= 0 && diffDays(start, date) < length;
  });
  if (withinRecorded) return true;

  const today = startOfDay(new Date());
  if (diffDays(today, date) < 1) return false;

  const cycle = getCycleForDate(date);
  if (!cycle) return false;
  return (
    diffDays(cycle.currentStart, date) >= 0 &&
    diffDays(cycle.currentStart, date) < state.settings.periodLength
  );
}

function getRecordedPeriodLength(startString) {
  const start = parseDate(startString);
  let length = 0;
  for (let offset = 0; offset < 12; offset += 1) {
    const date = addDays(start, offset);
    const entry = state.journal[toDateInput(date)];
    if (entry && entry.flow && entry.flow !== "none") {
      length = offset + 1;
    } else if (length > 0) {
      break;
    } else if (offset >= state.settings.periodLength) {
      break;
    }
  }
  return length || state.settings.periodLength;
}

function getPeriodFlow(date) {
  const entry = state.journal[toDateInput(date)];
  if (entry && entry.flow && entry.flow !== "none") return entry.flow;
  if (isPeriodDay(date)) return "estimated";
  return null;
}

function isFertileDay(date) {
  const cycle = getCycleForDate(date);
  if (!cycle) return false;

  const windows = getCycleWindows(cycle, getCycleStats());
  return isBetween(date, windows.fertileStart, windows.fertileEnd);
}

function isOvulationDay(date) {
  const cycle = getCycleForDate(date);
  if (!cycle) return false;

  const windows = getCycleWindows(cycle, getCycleStats());
  return isBetween(date, windows.ovulationStart, windows.ovulationEnd);
}

function phaseLabel(today, lastStart, windows, flags) {
  const todayEntry = state.journal[toDateInput(today)];
  const todayHasFlow = Boolean(todayEntry && todayEntry.flow && todayEntry.flow !== "none");

  if (todayHasFlow) return "Règles en cours";
  if (flags && flags.isActualPeriod) return "Règles en cours";

  if (isBetween(today, windows.ovulationStart, windows.ovulationEnd)) {
    return windows.refinedByMucus ? "Ovulation détectée par la glaire" : "Ovulation possible aujourd'hui";
  }
  if (isBetween(today, windows.fertileStart, windows.fertileEnd)) {
    return windows.refinedByMucus ? "Fenêtre fertile (glaire détectée)" : "Dans la fenêtre fertile possible";
  }

  if (flags && flags.isOverdue) {
    return `Règles en retard de ${Math.abs(flags.daysToPeriod)} j`;
  }
  if (flags && flags.daysToPeriod >= 0 && flags.daysToPeriod <= 2) {
    return "Règles attendues bientôt";
  }
  return "Suivi calme du cycle";
}

function getCycleForDate(date) {
  const anchor = getCycleAnchor(date);
  if (!anchor) return null;

  const cycleLength = getCycleStats().average;
  const elapsed = diffDays(anchor, date);
  const cyclesPassed = Math.floor(elapsed / cycleLength);
  const currentStart = addDays(anchor, cyclesPassed * cycleLength);
  return {
    currentStart,
    nextStart: addDays(currentStart, cycleLength),
  };
}

function getCycleAnchor(date) {
  const periods = uniqueDates(state.periods).filter(isValidDateString).sort().map(parseDate);
  if (!periods.length) {
    return getLastPeriodStart();
  }
  if (!date) return periods[periods.length - 1];

  let bestBefore = null;
  for (const start of periods) {
    if (diffDays(start, date) >= 0) bestBefore = start;
  }
  return bestBefore || periods[0];
}

function getCycleWindows(cycle, stats) {
  const ovulationUncertainty = stats.isVariable ? 2 : 1;
  const periodUncertainty = Math.min(Math.max(Math.round(stats.spread / 2), 1), 5);

  let ovulationPeak = addDays(cycle.currentStart, stats.average - 14);
  let ovulationStart = addDays(ovulationPeak, -ovulationUncertainty);
  let ovulationEnd = addDays(ovulationPeak, ovulationUncertainty);
  let nextStart = addDays(cycle.currentStart, stats.average);
  let nextStartEarliest = addDays(nextStart, -periodUncertainty);
  let nextStartLatest = addDays(nextStart, periodUncertainty);
  let refinedBy = null;

  const positiveTest = getLastOvulationTestInCycle(cycle, "positive");
  if (positiveTest) {
    ovulationPeak = addDays(positiveTest, 1);
    refinedBy = "test-positive";
  } else {
    const mucusPeak = getMucusPeakInCycle(cycle);
    if (mucusPeak) {
      ovulationPeak = mucusPeak;
      refinedBy = "mucus";
    }
    const lastNegative = getLastOvulationTestInCycle(cycle, "negative");
    if (lastNegative && diffDays(lastNegative, ovulationPeak) >= 0) {
      ovulationPeak = addDays(lastNegative, 1);
      refinedBy = refinedBy === "mucus" ? "mucus+negative" : "test-negative";
    }
  }

  if (refinedBy) {
    ovulationStart = addDays(ovulationPeak, -1);
    ovulationEnd = addDays(ovulationPeak, 1);
    nextStart = addDays(ovulationPeak, 14);
    nextStartEarliest = addDays(ovulationPeak, 13);
    nextStartLatest = addDays(ovulationPeak, 15);
  }

  return {
    nextStart,
    nextStartEarliest,
    nextStartLatest,
    ovulationStart,
    ovulationEnd,
    ovulationPeak,
    fertileStart: addDays(ovulationPeak, -5),
    fertileEnd: addDays(ovulationPeak, 1),
    refinedBy,
    refinedByMucus: refinedBy === "mucus" || refinedBy === "mucus+negative",
    refinedByTest: refinedBy === "test-positive" || refinedBy === "test-negative" || refinedBy === "mucus+negative",
  };
}

function getLastOvulationTestInCycle(cycle, kind) {
  const cycleStart = cycle.currentStart;
  const cycleEnd = cycle.nextStart;
  let bestDate = null;
  for (const [dateString, entry] of Object.entries(state.journal)) {
    if (!entry || entry.ovulationTest !== kind) continue;
    if (!isValidDateString(dateString)) continue;
    const date = parseDate(dateString);
    if (diffDays(cycleStart, date) < 0) continue;
    if (diffDays(date, cycleEnd) <= 0) continue;
    if (!bestDate || diffDays(bestDate, date) > 0) bestDate = date;
  }
  return bestDate;
}

function getMucusPeakInCycle(cycle) {
  const cycleStart = cycle.currentStart;
  const cycleEnd = cycle.nextStart;
  let bestDate = null;
  let bestScore = 0;

  for (const [dateString, entry] of Object.entries(state.journal)) {
    if (!entry || !entry.mucus || entry.mucus === "none") continue;
    if (!isValidDateString(dateString)) continue;
    const date = parseDate(dateString);
    if (diffDays(cycleStart, date) < 0) continue;
    if (diffDays(date, cycleEnd) <= 0) continue;

    const score = mucusFertilityScore(entry.mucus);
    if (score <= 0) continue;
    if (score > bestScore || (score === bestScore && bestDate && diffDays(bestDate, date) > 0)) {
      bestScore = score;
      bestDate = date;
    }
  }

  return bestDate;
}

function mucusFertilityScore(type) {
  if (type === "eggwhite") return 3;
  if (type === "watery") return 2;
  return 0;
}

function getCycleStats(periods = state.periods, fallbackLength = state.settings.cycleLength) {
  const sortedAsc = uniqueDates(periods)
    .filter(isValidDateString)
    .sort()
    .map(parseDate);
  const intervals = [];

  for (let index = 1; index < sortedAsc.length; index += 1) {
    const interval = diffDays(sortedAsc[index - 1], sortedAsc[index]);
    if (interval >= 21 && interval <= 45) intervals.push(interval);
  }

  if (!intervals.length) {
    const average = clamp(Number(fallbackLength), 21, 45);
    return {
      average,
      min: average,
      max: average,
      spread: 0,
      samples: 0,
      isVariable: false,
      label: `Base manuelle ${average} j`,
    };
  }

  const average = clamp(
    Math.round(intervals.reduce((total, value) => total + value, 0) / intervals.length),
    21,
    45,
  );
  const min = Math.min(...intervals);
  const max = Math.max(...intervals);
  const spread = max - min;
  const isVariable = intervals.length >= 2 && spread >= 7;
  const confidence = intervals.length >= 4 ? "bonne base" : "base en cours";

  return {
    average,
    min,
    max,
    spread,
    samples: intervals.length,
    isVariable,
    label: isVariable
      ? `Cycles variables ${min}-${max} j · moyenne ${average} j`
      : `Moyenne ${average} j · ${intervals.length} cycle${intervals.length > 1 ? "s" : ""}, ${confidence}`,
  };
}

function isBetween(date, start, end) {
  return diffDays(start, date) >= 0 && diffDays(date, end) >= 0;
}

function isValidDateString(dateString) {
  return Boolean(dateString) && !Number.isNaN(parseDate(dateString).getTime());
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function diffDays(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(end) - startOfDay(start)) / msPerDay);
}

function sameDate(left, right) {
  return toDateInput(left) === toDateInput(right);
}

function relativeDays(days) {
  if (days > 0) return `Dans ${days} j`;
  return `Il y a ${Math.abs(days)} j`;
}

function relativeRange(startDays, endDays) {
  if (startDays === endDays) return startDays === 0 ? "Aujourd'hui" : relativeDays(startDays);
  if (startDays >= 0 && endDays >= 0) return `Dans ${startDays}-${endDays} j`;
  if (startDays < 0 && endDays < 0) return `Il y a ${Math.abs(endDays)}-${Math.abs(startDays)} j`;
  return "Autour de ces jours";
}

function formatDateRange(start, end) {
  if (sameDate(start, end)) return shortFormatter.format(start);
  return `${shortFormatter.format(start)} - ${shortFormatter.format(end)}`;
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(numeric, min), max);
}

function uniqueDates(dates) {
  return [...new Set(dates.filter(Boolean))];
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setActiveButton(selector, activeButton) {
  document.querySelectorAll(selector).forEach((button) => {
    const isActive = button === activeButton;
    button.classList.toggle("is-active", isActive);
    if (button.hasAttribute("aria-pressed")) {
      button.setAttribute("aria-pressed", String(isActive));
    }
  });
}

function classNames(base, flags) {
  return [
    base,
    ...Object.entries(flags)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
  ].join(" ");
}
