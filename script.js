// ===========================
// STATE
// ===========================
const TOPICS = ['arithmetic', 'algebra', 'geometry']
let mastery = { arithmetic: 0, algebra: 0, geometry: 0 }
let diff = { arithmetic: 'medium', algebra: 'medium', geometry: 'medium' }
let streak = { arithmetic: { c: 0, w: 0 }, algebra: { c: 0, w: 0 }, geometry: { c: 0, w: 0 } }
let diagQs = [], diagIdx = 0, diagScores = {}
// diagnostic timing state (20‑minute countdown)
let diagTimer = null
let diagSeconds = 0

// keep the last few diagnostic percentages for each topic so we can
// apply the "three in a row" rule with a sliding window
let diagHistory = { arithmetic: [], algebra: [], geometry: [] }
// this used to count straight 80%-plus passes; we still keep it for
// backwards compatibility with any code that referenced it, but the
// new mastery logic no longer relies solely on this value
let diagPasses = { arithmetic: 0, algebra: 0, geometry: 0 }
let hasDiag = false
let practiceTopic = null, currentAnswer = null

// ===========================
// PALETTE / THEME
// ===========================
// available palettes (css var overrides)
const PALETTES = {
  // ── Dark themes ──────────────────────────────────────────────
  default: {
    '--bg': '#0c0e16',
    '--surface': '#13151f',
    '--surface2': '#1c1f2e',
    '--surface3': '#242840',
    '--border': '#2a2d42',
    '--text': '#e4e6f0',
    '--text2': '#8289a8',
    '--text3': '#555d7a',
    '--accent': '#5b6ef5',
    '--accent-h': '#7c8fff',
    '--green': '#00d4aa',
    '--yellow': '#ffd166',
    '--red': '#ff6b6b'
  },
  ocean: {
    '--bg': '#05192d',
    '--surface': '#0a2540',
    '--surface2': '#0e2f50',
    '--surface3': '#133660',
    '--border': '#1a4270',
    '--text': '#d6eeff',
    '--text2': '#6ea8d0',
    '--text3': '#3a6a90',
    '--accent': '#00aaff',
    '--accent-h': '#44ccff',
    '--green': '#00e5a0',
    '--yellow': '#ffd166',
    '--red': '#ff6b6b'
  },
  sunset: {
    '--bg': '#1a0510',
    '--surface': '#26081c',
    '--surface2': '#330d26',
    '--surface3': '#401230',
    '--border': '#5a1a40',
    '--text': '#fce8f0',
    '--text2': '#c07090',
    '--text3': '#804060',
    '--accent': '#ff4d8c',
    '--accent-h': '#ff88b8',
    '--green': '#00e5a0',
    '--yellow': '#ffd166',
    '--red': '#ff6b6b'
  },
  forest: {
    '--bg': '#071510',
    '--surface': '#0e2218',
    '--surface2': '#152e20',
    '--surface3': '#1c3a28',
    '--border': '#234830',
    '--text': '#d4f0e0',
    '--text2': '#6aaa80',
    '--text3': '#3a7050',
    '--accent': '#00c86e',
    '--accent-h': '#40e890',
    '--green': '#00e5a0',
    '--yellow': '#ffd166',
    '--red': '#ff6b6b'
  },
  ember: {
    '--bg': '#150800',
    '--surface': '#221200',
    '--surface2': '#2e1a00',
    '--surface3': '#3a2200',
    '--border': '#4d2e00',
    '--text': '#fff0e0',
    '--text2': '#c08050',
    '--text3': '#805030',
    '--accent': '#ff8c00',
    '--accent-h': '#ffb84d',
    '--green': '#00d4aa',
    '--yellow': '#ffd166',
    '--red': '#ff6b6b'
  },
  violet: {
    '--bg': '#10081a',
    '--surface': '#1a1028',
    '--surface2': '#221838',
    '--surface3': '#2c2048',
    '--border': '#3a2860',
    '--text': '#ede0ff',
    '--text2': '#9070c0',
    '--text3': '#604880',
    '--accent': '#a855f7',
    '--accent-h': '#d088ff',
    '--green': '#00d4aa',
    '--yellow': '#ffd166',
    '--red': '#ff6b6b'
  },
  // ── Light themes ─────────────────────────────────────────────
  snow: {
    '--bg': '#f4f6fb',
    '--surface': '#ffffff',
    '--surface2': '#edf0f7',
    '--surface3': '#dde2ee',
    '--border': '#c8cfe0',
    '--text': '#1a1f36',
    '--text2': '#5a6480',
    '--text3': '#9aa0b8',
    '--accent': '#5b6ef5',
    '--accent-h': '#3a50e0',
    '--green': '#00a880',
    '--yellow': '#e09000',
    '--red': '#e03030'
  },
  rose: {
    '--bg': '#fdf4f7',
    '--surface': '#ffffff',
    '--surface2': '#fce8f0',
    '--surface3': '#f8d0e2',
    '--border': '#f0b0cc',
    '--text': '#2a1020',
    '--text2': '#804060',
    '--text3': '#c080a0',
    '--accent': '#e0306a',
    '--accent-h': '#c01850',
    '--green': '#00a880',
    '--yellow': '#e09000',
    '--red': '#cc1040'
  }
}

function applyPalette(name) {
  const vars = PALETTES[name] || PALETTES.default
  // First reset all possible theme vars to default values so switching from
  // a full-override palette back to a partial one doesn't leave stale values.
  const defaults = PALETTES.default
  Object.keys(defaults).forEach(k => {
    document.documentElement.style.setProperty(k, defaults[k])
  })
  Object.keys(vars).forEach(k => {
    document.documentElement.style.setProperty(k, vars[k])
  })
}

function initPalettePicker() {
  const container = document.getElementById('palette-picker')
  if (!container) return
  container.innerHTML = ''
  Object.keys(PALETTES).forEach(name => {
    const sw = document.createElement('div')
    sw.className = 'palette-swatch'
    sw.style.background = PALETTES[name]['--accent']
    sw.dataset.name = name
    sw.addEventListener('click', () => selectPalette(name))
    container.appendChild(sw)
  })
  markSelectedPalette()
  applyPalette(palette) // apply existing choice when picker created
}

function markSelectedPalette() {
  const sws = document.querySelectorAll('.palette-swatch')
  sws.forEach(s => s.classList.toggle('selected', s.dataset.name === palette))
}

function selectPalette(name) {
  palette = name
  applyPalette(name)
  markSelectedPalette()
  if (auth && auth.currentUser) saveProgress(auth.currentUser.uid)
}


// ===========================
// ROUTING
// ===========================
function saveLastState(state) {
  try { localStorage.setItem('lastState', JSON.stringify(state)) } catch {}
}

// practice/diagnostic session persistence (cleared when user leaves these screens)
function savePracticeState() {
  if (!practiceTopic) return
  const prob = {
    question: document.getElementById('prac-q')?.innerHTML || '',
    answer: currentAnswer,
  }
  const state = {
    topic: practiceTopic,
    difficulty: diff[practiceTopic],
    problem: prob,
    input: document.getElementById('prac-inp')?.value || '',
    feedback: document.getElementById('prac-fb')?.textContent || '',
    fbClass: document.getElementById('prac-fb')?.className.replace(/^feedback\s*/, '') || '',
    work: document.getElementById('work-area')?.value || ''
  }
  try { sessionStorage.setItem('practiceState', JSON.stringify(state)) } catch {}
}

function clearPracticeState() {
  try { sessionStorage.removeItem('practiceState') } catch {}
}

function loadPracticeState() {
  try {
    const raw = sessionStorage.getItem('practiceState')
    if (!raw) return false
    const s = JSON.parse(raw)
    if (s.topic && TOPICS.includes(s.topic)) {
      practiceTopic = s.topic
      diff[s.topic] = s.difficulty || diff[s.topic]
      updatePracticeMeta()
      const qElem = document.getElementById('prac-q')
      if (qElem) qElem.innerHTML = s.problem.question || ''
      currentAnswer = s.problem.answer
      const inp = document.getElementById('prac-inp')
      if (inp) inp.value = s.input || ''
      setFeedback('prac-fb', s.feedback || '', s.fbClass || '')
      const work = document.getElementById('work-area')
      if (work) work.value = s.work || ''
      // ensure UI mode/reset
      toggleSolutionMode('text')
      return true
    }
  } catch(e) {}
  return false
}

function saveDiagState() {
  if (!diagQs || diagQs.length === 0) return
  const state = { diagQs, diagIdx, diagScores, diagSeconds }
  try { sessionStorage.setItem('diagState', JSON.stringify(state)) } catch {}
}

function clearDiagState() {
  try { sessionStorage.removeItem('diagState') } catch {}
}

function loadDiagState() {
  try {
    const raw = sessionStorage.getItem('diagState')
    if (!raw) return false
    const s = JSON.parse(raw)
    if (Array.isArray(s.diagQs)) {
      diagQs = s.diagQs
      diagIdx = s.diagIdx || 0
      diagScores = s.diagScores || { arithmetic:0, algebra:0, geometry:0 }
      diagSeconds = typeof s.diagSeconds === 'number' ? s.diagSeconds : 20*60
      // make sure the diagnostic screen is visible before updating
      showScreen('screen-diag')
      // re-render question and restart timer
      renderDiagQ()
      startDiagTimer()
      return true
    }
  } catch(e) {}
  return false
}

function showScreen(id) {
  // record the screen in case user reloads
  const state = { screen: id };
  if (id === 'screen-practice' && practiceTopic) state.topic = practiceTopic;
  if (id === 'screen-diag') state.screen = 'screen-diag';
  saveLastState(state);

  // hide any open hint panel when navigating screens
  const panel = document.getElementById('hint-panel')
  if (panel && panel.classList.contains('open')) panel.classList.remove('open')
  // hide slider portion of calculator for wide screens
  const calc = document.getElementById('calc-panel')
  if (calc) {
    if (calc.classList.contains('slide-open')) calc.classList.remove('slide-open')
    // on phones we keep the calculator hidden until user taps "Calc"
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

function resetCalculator() {
  // clear input, result, and history rows so the calculator starts fresh
  const inp = document.getElementById('calc-input')
  if (inp) inp.value = ''
  const res = document.getElementById('calc-result')
  if (res) res.textContent = ''
  const hist = document.getElementById('calc-hist')
  if (hist) hist.innerHTML = ''
}

function restoreLastState() {
  try {
    const raw = localStorage.getItem('lastState')
    if (!raw) return false
    const s = JSON.parse(raw)
    if (s.screen === 'screen-practice' && s.topic && TOPICS.includes(s.topic)) {
      goToPractice(s.topic)
      return true
    }
    if (s.screen === 'screen-diag') {
      // try sessionStorage first (covers simple refresh)
      if (loadDiagState()) {
        return true
      }
      // if Firestore already populated diagQs (from loadProgress), resume it
      if (diagQs && diagQs.length > 0) {
        showScreen('screen-diag')
        renderDiagQ()
        startDiagTimer()
        return true
      }
      // otherwise start a brand new diagnostic
      startDiagnostic()
      return true
    }
  } catch(e) {
    // ignore parse errors
  }
  return false
}

function goHome() {
  // stop diagnostic timer in case we were on that screen
  stopDiagTimer()

  // clear any transient session storage from practice / diagnostic
  clearPracticeState()
  clearDiagState()

  // reset calculator state whenever we return to the dashboard
  resetCalculator()
  // ensure panel is closed/minimized (if visible on wide screens)
  hideCalc()

  if (auth && auth.currentUser) {
    // optionally load fresh progress
    loadProgress(auth.currentUser.uid)
      .then(() => {
        // try to resume the last screen; fall back to home dashboard
        if (!restoreLastState()) {
          showScreen('screen-home'); renderDashboard(); initPalettePicker()
        }
      })
  } else {
    showScreen('screen-home'); renderDashboard(); initPalettePicker()
  }
}

// ===========================
// DASHBOARD
// ===========================
function renderDashboard() {
  TOPICS.forEach(t => {
    const val = mastery[t]
    const bar = document.getElementById('bar-' + t)
    const pct = document.getElementById('pct-' + t)
    if (bar) {
      bar.style.width = val + '%'
      bar.style.background = val >= 90
        ? 'linear-gradient(90deg,#00d4aa,#00b894)'
        : val >= 55
        ? 'linear-gradient(90deg,#ffd166,#f4a261)'
        : 'linear-gradient(90deg,#7c8fff,#5b6ef5)'
    }
    if (pct) pct.textContent = val + '%'
  })
  const btn = document.getElementById('diag-btn')
  if (btn) btn.textContent = hasDiag ? '↺  Retake Diagnostic' : '▶  Take Diagnostic Test'
}

// ===========================
// DIAGNOSTIC

// timer utilities for the 20‑minute diagnostic session
function updateDiagTimerDisplay() {
  const el = document.getElementById('diag-timer')
  if (!el) return
  const m = Math.floor(diagSeconds / 60)
  const s = diagSeconds % 60
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`
}

function startDiagTimer() {
  // if diagSeconds already set (from session) use it, otherwise default
  if (typeof diagSeconds !== 'number' || diagSeconds <= 0) diagSeconds = 20 * 60
  updateDiagTimerDisplay()
  diagTimer = setInterval(() => {
    diagSeconds--
    saveDiagState()
    if (diagSeconds <= 0) {
      clearInterval(diagTimer)
      diagTimer = null
      alert('Time is up – submitting your responses.')
      finishDiag()
    } else {
      updateDiagTimerDisplay()
    }
  }, 1000)
}

function stopDiagTimer() {
  if (diagTimer) {
    clearInterval(diagTimer)
    diagTimer = null
  }
}

// ===========================
// choose `count` items from the end of an array (assuming later
// entries are harder), then shuffle that subset.  used to make
// diagnostics start with more challenging problems.
function pickDiagItems(arr, count) {
  const reversed = arr.slice().reverse()
  return shuffle(reversed).slice(0, count)
}

function startDiagnostic() {
  // ensure any prior timer is cleared before we begin a new one
  stopDiagTimer()
  const bank = getBank()
  diagScores = { arithmetic: 0, algebra: 0, geometry: 0 }
  diagIdx = 0

  // geometry diagnostics still include a couple of impossible items
  const geoItems = [...bank.geometry]
  const impossible = geoItems.filter(q => q.impossible)
  const normal = geoItems.filter(q => !q.impossible)

  const geoSlice = pickDiagItems(normal, 14)
  if (impossible.length > 0) {
    geoSlice.push(...shuffle(impossible).slice(0, Math.min(2, impossible.length)))
  }
  const geoSet = geoSlice.map(q => ({ ...q, topic: 'geometry' }))

  const sets = TOPICS.map(t => {
    if (t === 'geometry') return geoSet
    const items = pickDiagItems(bank[t], 16)
    return items.map(q => ({ ...q, topic: t }))
  })

  // don't globally reshuffle; order reflects the harder-biased selection
  diagQs = sets.flat()
  showScreen('screen-diag')
  // clear any previous work and set up sheet
  clearWork('diag-')
  toggleSolutionMode('text','diag-')
  initCanvas('diag-')
  renderDiagQ()

  // start the countdown timer
  startDiagTimer()
}

function renderDiagQ() {
  const tot = diagQs.length
  saveDiagState()
  document.getElementById('diag-counter').textContent = `${diagIdx + 1} / ${tot}`
  document.getElementById('diag-prog').style.width = (diagIdx / tot * 100) + '%'

  // render question text; algebra/geometry use stacked fractions instead of ÷ or /
  const qElem = document.getElementById('diag-q')
  const qText = diagQs[diagIdx].q
  const topic = diagQs[diagIdx].topic
  qElem.innerHTML = formatQuestion(qText, topic)

  document.getElementById('diag-inp').value = ''
  setFeedback('diag-fb', '', '')
  clearWork('diag-')
  document.getElementById('diag-inp').focus()
}

function submitDiag() {
  const ans = document.getElementById('diag-inp').value.trim()
  const q = diagQs[diagIdx]
  const ok = checkAns(ans, q.a)
  if (ok) diagScores[q.topic]++
  setFeedback('diag-fb', ok ? '✓  Correct!' : '✗  Answer: ' + q.a, ok ? 'correct' : 'incorrect')
  diagIdx++
  if (diagIdx < diagQs.length) setTimeout(renderDiagQ, 950)
  else setTimeout(finishDiag, 950)
}

// record the most recent score for a topic, keeping only the last
// three diagnostics. this lets us evaluate the "three-in-a-row" rule
function recordDiagScore(topic, percent) {
  const hist = diagHistory[topic]
  hist.push(percent)
  if (hist.length > 3) hist.shift()
}

// decide whether the learner has satisfied the mastery condition for a
// topic. the basic requirement is three consecutive diagnostics at 80% or
// higher, but if two of those three are perfect (100%) the third score may
// fall as low as 60% and still count. (the 60 value comes from taking the
// 80 baseline and subtracting 10 for each prior perfect; you can adjust the
// formula if you prefer a different curve.)
function checkMasteryCondition(topic) {
  const hist = diagHistory[topic]
  if (hist.length < 3) return false

  const last3 = hist.slice(-3)
  const perfects = last3.filter(p => p === 100).length
  let threshold = 80
  if (perfects >= 2) threshold = 60

  // all three of the most recent scores must clear the threshold
  return last3.every(p => p >= threshold)
}

function finishDiag() {
  // clear timer as soon as we finish
  stopDiagTimer()

  // diagnostic complete; drop any stored session state
  clearDiagState()
  if (auth && auth.currentUser) saveProgress(auth.currentUser.uid)

  hasDiag = true
  TOPICS.forEach(t => {
    const correct = diagScores[t]
    const percent = Math.round((correct / 16) * 100)

    recordDiagScore(t, percent)

    // keep the old "pass" counter for reference; a pass is still defined
    // as 80% or better on a single attempt
    if (percent >= 80) diagPasses[t]++

    if (checkMasteryCondition(t)) {
      mastery[t] = 100
    } else {
      // until mastery is reached, show the highest percentage they've
      // achieved so far so they can see progress
      mastery[t] = Math.max(mastery[t], percent)
    }
  })
  goHome()
  if (auth && auth.currentUser) saveProgress(auth.currentUser.uid)
}

// ===========================
// PRACTICE
// ===========================
function goToPractice(topic) {
  practiceTopic = topic
  const labels = { arithmetic: 'Arithmetic', algebra: 'Algebra', geometry: 'Geometry' }
  document.getElementById('prac-title').textContent = labels[topic]
  updatePracticeMeta()
  // attempt to restore session before generating new question
  if (!loadPracticeState()) {
    nextQ()
  }
  showScreen('screen-practice')

  // show/hide Calc mode button based on topic
  const calcModeBtn = document.getElementById('btn-calc-mode')
  if (calcModeBtn) {
    calcModeBtn.style.display = (topic === 'arithmetic') ? 'none' : ''
  }

  // always start with calculator hidden; for arithmetic don't show at all
  hideCalc()
  if (topic === 'arithmetic') {
    const panel = document.getElementById('calc-panel')
    if (panel) {
      panel.classList.add('calc-off')
      panel.classList.remove('slide-open')
    }
  }
}

function updatePracticeMeta() {
  const t = practiceTopic, val = mastery[t]
  const bar = document.getElementById('prac-bar')
  const pct = document.getElementById('prac-pct')
  if (bar) {
    bar.style.width = val + '%'
    bar.style.background = val >= 90
      ? 'linear-gradient(90deg,#00d4aa,#00b894)'
      : val >= 55
      ? 'linear-gradient(90deg,#ffd166,#f4a261)'
      : 'linear-gradient(90deg,#7c8fff,#5b6ef5)'
  }
  if (pct) pct.textContent = val + '%'
  const badge = document.getElementById('diff-badge')
  if (badge) {
    const d = diff[t]
    badge.textContent = d[0].toUpperCase() + d.slice(1)
    badge.className = 'diff-badge badge-' + d
  }
}

function nextQ() {
  const prob = generateProblem(practiceTopic, diff[practiceTopic])
  currentAnswer = prob.answer
  const qElem = document.getElementById('prac-q')
  qElem.innerHTML = formatQuestion(prob.question, practiceTopic)
  document.getElementById('prac-inp').value = ''
  setFeedback('prac-fb', '', '')
  clearWork()
  toggleSolutionMode('text')
  document.getElementById('prac-inp').focus()
  savePracticeState()
}

function submitPractice() {
  const ans = document.getElementById('prac-inp').value.trim()
  const ok = checkAns(ans, currentAnswer)
  const t = practiceTopic

  setFeedback('prac-fb', ok ? '✓  Correct!' : '✗  Answer: ' + currentAnswer, ok ? 'correct' : 'incorrect')

  // save in case user reloads before next question
  savePracticeState()

  // === adaptive difficulty support ===
  // maintain a simple streak counter that increments on correct answers
  // and resets when the student gets one wrong; a few corrects in a row
  // bump difficulty, while a single wrong drops it.
  if (ok) {
    streak[t].c++
    streak[t].w = 0
  } else {
    streak[t].w++
    streak[t].c = 0
  }

  adjustDifficulty(t)          // possibly change diff[t]
  updatePracticeMeta()

  if (auth && auth.currentUser) saveProgress(auth.currentUser.uid)
  setTimeout(nextQ, 950)
}

// change difficulty for a topic to the given value and save
function setDifficulty(topic, level) {
  const order = ['easy','medium','hard','impossible']
  if (!order.includes(level)) return
  diff[topic] = level
  if (auth && auth.currentUser) saveProgress(auth.currentUser.uid)
}

// examine the streaks and bump/drop difficulty as appropriate. simple
// rule: three correct in a row → go up one level; any wrong answer → go
// down one level (but not below easy) and clear the streak.
function adjustDifficulty(topic) {
  const order = ['easy','medium','hard','impossible']
  const current = diff[topic]
  const idx = order.indexOf(current)
  if (streak[topic].c >= 3 && idx < order.length - 1) {
    setDifficulty(topic, order[idx + 1])
    streak[topic].c = 0 // start new streak at higher level
  }
  if (streak[topic].w >= 1 && idx > 0) {
    setDifficulty(topic, order[idx - 1])
    streak[topic].w = 0
  }
}

// ===========================
// CALCULATOR TOGGLE
// ===========================
function hideCalc() {
  // do nothing on narrow phones – calc should always be visible there
  if (window.innerWidth <= 767) return;
  const panel = document.getElementById('calc-panel')
  if (!panel) return
  // slide panel off-screen if slide logic is in effect
  panel.classList.remove('slide-open')
  // only minimize the calculator; avoid toggling an "off" state
  panel.classList.add('calc-min')
  panel.classList.remove('calc-off')
  // ensure opacity button remains visible
  const opbtn = document.getElementById('calc-opacity-tog')
  if (opbtn) {
    opbtn.style.display = 'block'
    opbtn.textContent = '👁‍🗨'
  }
}

function showCalcPanel() {
  const panel = document.getElementById('calc-panel')
  panel.classList.remove('calc-min', 'calc-off')
  // restore normal visuals
  panel.style.opacity = ''
  panel.style.background = ''
  panel.style.borderColor = ''
  calcOpaque = true
  // reset opacity button icon and make sure it's visible
  const opbtn = document.getElementById('calc-opacity-tog')
  if (opbtn) {
    opbtn.style.display = ''
    opbtn.textContent = '👁‍🗨'
    opbtn.style.opacity = ''
  }
  // reset to default position when first opened
  if (!panel.dataset.dragInitialized) {
    panel.style.top = '10%'
    panel.style.right = '5%'
    panel.dataset.dragInitialized = '1'
  }
}

// opacity toggle state: true means opaque
let calcOpaque = true
function toggleCalcOpacity() {
  const panel = document.getElementById('calc-panel')
  if (!panel) return
  // if minimized, unminimize instead of toggling opacity
  if (panel.classList.contains('calc-min')) {
    showCalcPanel()
    return
  }
  calcOpaque = !calcOpaque
  const inner = panel.querySelector('.calc-inner')
  if (inner) inner.style.opacity = calcOpaque ? '1' : '0'

  // when hiding inner we also remove the panel's visual frame so the
  // whole calculator block disappears – only the eye button remains
  if (!calcOpaque) {
    panel.style.background = 'transparent'
    panel.style.borderColor = 'transparent'
  } else {
    panel.style.background = ''
    panel.style.borderColor = ''
  }

  const btn = document.getElementById('calc-opacity-tog')
  if (btn) btn.textContent = calcOpaque ? '👁‍🗨' : '👁'
}

// enable dragging of calculator panel like a chat bubble
let calcDrag = { active: false, offsetX: 0, offsetY: 0 }
function initCalcDrag() {
  // attach handlers regardless of screen size; startCalcDrag will
  // immediately bail on phones so listeners don't do anything there.
  const panel = document.getElementById('calc-panel')
  if (!panel) return
  panel.addEventListener('mousedown', startCalcDrag)
  document.addEventListener('mousemove', moveCalc)
  document.addEventListener('mouseup', endCalcDrag)
  panel.addEventListener('touchstart', startCalcDrag)
  document.addEventListener('touchmove', moveCalc)
  document.addEventListener('touchend', endCalcDrag)
}

function startCalcDrag(e) {
  // on phones we do not allow dragging; panel is fixed bottom
  if (window.innerWidth <= 767) return

  const panel = document.getElementById('calc-panel')
  calcDrag.active = true
  let clientX = e.clientX || (e.touches && e.touches[0].clientX)
  let clientY = e.clientY || (e.touches && e.touches[0].clientY)
  calcDrag.offsetX = clientX - panel.offsetLeft
  calcDrag.offsetY = clientY - panel.offsetTop
  panel.style.transition = 'none'
}

function moveCalc(e) {
  if (!calcDrag.active) return
  let clientX = e.clientX || (e.touches && e.touches[0].clientX)
  let clientY = e.clientY || (e.touches && e.touches[0].clientY)
  const panel = document.getElementById('calc-panel')
  panel.style.left = (clientX - calcDrag.offsetX) + 'px'
  panel.style.top = (clientY - calcDrag.offsetY) + 'px'
  panel.style.right = 'auto'
}

function endCalcDrag() {
  if (!calcDrag.active) return
  calcDrag.active = false
  const panel = document.getElementById('calc-panel')
  panel.style.transition = ''
}

// initialize drag behavior after load
window.addEventListener('load', () => {
  initCalcDrag()
  initPalettePicker()
  // start with calculator hidden until a non-arithmetic topic is selected
  hideCalc()
})

// ===========================
// ANSWER CHECK
// ===========================
function checkAns(user, correct) {
  const u = String(user).trim().toLowerCase().replace(/\s/g, '')
  const c = String(correct).trim().toLowerCase().replace(/\s/g, '')
  if (u === c) return true
  const un = parseFloat(u), cn = parseFloat(c)
  if (!isNaN(un) && !isNaN(cn)) return Math.abs(un - cn) < 0.02
  return false
}

function setFeedback(id, msg, cls) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = 'feedback' + (cls ? ' ' + cls : '')
}

// utility to update the enabled/disabled state of undo button
function updateUndoButton(prefix = '') {
  let btn
  if (prefix === 'diag-') {
    btn = document.getElementById('btn-undo-diag')
  } else {
    btn = document.getElementById('btn-undo')
  }
  if (!btn) return
  const stack = drawHistories[prefix] || []
  btn.disabled = stack.length === 0
}

// clear whichever workspace is active (practice or diag)
// prefix is an optional id fragment like 'diag-'; omit for practice.
function clearWork(prefix = '') {
  const workArea = document.getElementById(prefix + 'work-area')
  if (workArea) workArea.value = ''
  
  const canvas = document.getElementById(prefix + 'draw-canvas')
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  // reset undo history for this canvas
  if (drawHistories[prefix]) drawHistories[prefix] = []
  updateUndoButton(prefix)
}

let isDrawing = false
let lastX = 0
let lastY = 0

// keep a stack of image snapshots for each canvas prefix so we can undo
const drawHistories = { '': [], 'diag-': [] }

// initialize a drawing canvas; prefix allows reusing for diag
function initCanvas(prefix = '') {
  const canvas = document.getElementById(prefix + 'draw-canvas')
  if (!canvas) return

  const parent = canvas.parentElement
  if (!parent) return

  const rect = parent.getBoundingClientRect()
  // if parent has zero size (it may be hidden when called), wait a bit
  if (rect.width === 0 || rect.height === 0) {
    requestAnimationFrame(() => initCanvas(prefix))
    return
  }

  // whenever we install a fresh canvas (either first time or resized)
  // clear the undo stack for that prefix; previous snapshots will be
  // invalid due to size changes or manual clearing
  if (drawHistories[prefix]) drawHistories[prefix] = []
  updateUndoButton(prefix)

  canvas.width = rect.width
  canvas.height = rect.height

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // attach pointer/touch handlers (duplicates are harmless)
  canvas.addEventListener('mousedown', startDraw)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', stopDraw)
  canvas.addEventListener('mouseleave', stopDraw)
  canvas.addEventListener('touchstart', handleTouch)
  canvas.addEventListener('touchmove', handleTouch)
  canvas.addEventListener('touchend', stopDraw)
}

// resize listener: if either canvas is visible, reinitialize it when the window changes
function resizeCanvases() {
  ['','diag-'].forEach(prefix => {
    const canvas = document.getElementById(prefix + 'draw-canvas')
    if (canvas && canvas.parentElement.classList.contains('active-mode')) {
      initCanvas(prefix)
    }
  })
  adjustCanvasPadding()
}

// adjust bottom padding of canvas so fixed bottom calculator doesn't hide it
function adjustCanvasPadding() {
  if (window.innerWidth > 767) return
  const calc = document.getElementById('calc-panel')
  const canvasContainer = document.getElementById('canvas-container')
  if (canvasContainer && calc) {
    const h = calc.getBoundingClientRect().height || 0
    canvasContainer.style.paddingBottom = (h + 16) + 'px'
  }
}

// ensure padding recalculated on load
window.addEventListener('load', adjustCanvasPadding)
window.addEventListener('resize', resizeCanvases)
window.addEventListener('orientationchange', resizeCanvases)

// if available, observe container size changes (e.g. keyboard popups)
if (window.ResizeObserver) {
  ['','diag-'].forEach(prefix => {
    const container = document.getElementById(prefix + 'canvas-container')
    if (container) {
      const obs = new ResizeObserver(() => initCanvas(prefix))
      obs.observe(container)
    }
  })
}

function startDraw(e) {
  isDrawing = true
  const canvas = e.currentTarget || e.target
  const prefix = canvas.id.startsWith('diag-') ? 'diag-' : ''
  // save current state so we can undo this stroke later
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    drawHistories[prefix].push(snapshot)
    updateUndoButton(prefix)
  }

  const rect = canvas.getBoundingClientRect()
  lastX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
  lastY = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
}

function draw(e) {
  if (!isDrawing) return
  
  const canvas = e.currentTarget || e.target
  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
  const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
  
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(x, y)
  ctx.stroke()
  
  lastX = x
  lastY = y
}

function stopDraw() {
  isDrawing = false
}

// undo the last drawing stroke on the given workspace
function undoWork(prefix = '') {
  const canvas = document.getElementById(prefix + 'draw-canvas')
  if (!canvas) return
  const stack = drawHistories[prefix]
  if (!stack || stack.length === 0) return
  const ctx = canvas.getContext('2d')
  const img = stack.pop()
  ctx.putImageData(img, 0, 0)
  updateUndoButton(prefix)
}

function handleTouch(e) {
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  // dispatch to whichever canvas triggered the touch
  const canvas = e.currentTarget || e.target || document.getElementById('draw-canvas')
  canvas.dispatchEvent(mouseEvent)
}

function toggleSolutionMode(mode, prefix = '') {
  // block calc mode entirely for arithmetic
  if (mode === 'calc' && practiceTopic === 'arithmetic') return
  // hide/minimize calculator whenever we leave calc mode; on phones
  // this is a no‑op because hideCalc returns early
  if (mode !== 'calc') hideCalc()
  // when switching modes we should also reset undo state for canvas if
  // we're about to clear/re-init it; not strictly required but keeps the
  // stacks from growing wildly
  if (mode === 'draw') {
    // don't clear history here; handled by initCanvas/clearWork when
    // appropriate
  }
  const textContainer = document.getElementById(prefix + 'text-container')
  const canvasContainer = document.getElementById(prefix + 'canvas-container')
  const calcWrap = document.getElementById('mobile-calc-wrapper')
  const btnText = document.getElementById(prefix + 'btn-text-mode')
  const btnDraw = document.getElementById(prefix + 'btn-draw-mode')
  const btnCalc = document.getElementById(prefix + 'btn-calc-mode')
  
  if (mode === 'text') {
    textContainer.classList.add('active-mode')
    canvasContainer.classList.remove('active-mode')
    if (calcWrap) calcWrap.classList.remove('active-mode')
    btnText.classList.add('active')
    btnDraw.classList.remove('active')
    if (btnCalc) btnCalc.classList.remove('active')
  } else if (mode === 'draw') {
    textContainer.classList.remove('active-mode')
    canvasContainer.classList.add('active-mode')
    if (calcWrap) calcWrap.classList.remove('active-mode')
    btnText.classList.remove('active')
    btnDraw.classList.add('active')
    if (btnCalc) btnCalc.classList.remove('active')
    setTimeout(() => initCanvas(prefix), 50)
  } else if (mode === 'calc') {
    textContainer.classList.remove('active-mode')
    canvasContainer.classList.remove('active-mode')
    if (calcWrap) calcWrap.classList.add('active-mode')
    btnText.classList.remove('active')
    btnDraw.classList.remove('active')
    if (btnCalc) btnCalc.classList.add('active')
    // ensure calculator is repositioned into wrapper
    repositionCalc()
    // make sure the panel is visible (clearing any off/min state)
    showCalcPanel()
  }
}

// ===========================
// FRACTION FORMATTING
// ===========================
// convert plain text expression into HTML with stacked fractions
function formatFractions(str) {
  // replace any token1 ÷ token2 or token1/token2 with a styled fraction
  return str.replace(/([^\s÷\/]+)\s*(?:÷|\/)\s*([^\s÷\/]+)/g, function(_, a, b) {
    return `<span class="frac"><span class="num">${a}</span><span class="den">${b}</span></span>`
  });
}

function formatQuestion(text, topic) {
  if (topic === 'arithmetic') {
    // leave division symbols alone for arithmetic items
    return text
  }
  return formatFractions(text)
}


// ===========================
// UTILS
// ===========================
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5) }
function fmt(n) { return Math.abs(n) >= 1000 ? n.toLocaleString() : String(n) }

// ---------- hint panel logic ----------
// static hint pools per category
const hintPools = {
  general: [
    "Break the problem into smaller steps.",
    "Read the question carefully and identify what it is asking.",
    "Estimate the answer first to check if your result makes sense.",
    "Look for patterns in the numbers.",
    "Try rewriting the problem in a simpler way.",
    "Double-check your calculations before moving on."
  ],
  arithmetic: [
    "Remember the order of operations: PEMDAS (Parentheses, Exponents, Multiplication/Division, Addition/Subtraction).",
    "Think of PEMDAS as P → E → MD → AS; multiplication and division happen together, then addition and subtraction.",
    "Perform multiplication and division from left to right.",
    "Perform addition and subtraction from left to right.",
    "Simplify expressions step by step instead of trying to do everything at once.",
    "Reduce fractions whenever possible.",
    "Convert fractions, decimals, or percentages into the same form before comparing them.",
    "Watch out for negative signs when adding or subtracting numbers.",
    "If numbers look complicated, check if they share a common factor."
  ],
  algebra: [
    "Identify the variable you are trying to solve for.",
    "Simplify both sides of the equation before solving.",
    "Combine like terms whenever possible.",
    "Perform the same operation on both sides of the equation.",
    "Move constants away from the variable step by step.",
    "Check your signs when moving terms across the equals sign.",
    "If an equation looks complicated, try rewriting it in a simpler form.",
    "Substitute your answer back into the equation to verify it works.",
    "Look for opportunities to factor expressions.",
    "If you see a pattern, test it with simple numbers."
  ],
  geometry: [
    "Draw a quick sketch of the figure if one is not provided.",
    "Label all known sides, angles, and variables.",
    "Break complex shapes into simpler shapes.",
    "Check if the figure contains triangles, rectangles, or circles you recognize.",
    "Remember that the angles in a triangle add up to 180 degrees.",
    "Look for right angles or perpendicular lines.",
    "Check for parallel lines which may create equal angles.",
    "Use symmetry when shapes appear balanced or mirrored.",
    "Look for similar triangles or congruent shapes.",
    "Always check what measurement the question is asking for (length, angle, area, or perimeter)."
  ]
};

let currentHints = [];
let currentHintIdx = 0;

function generateHints(topic) {
  // topic may be 'arithmetic','algebra','geometry' or null for general/diag
  let pool = hintPools.general.slice();
  if (topic && hintPools[topic]) {
    pool = pool.concat(hintPools[topic]);
  }
  // optionally add a couple of small example hints each time
  pool.push("Example: isolate x by subtracting 3 from both sides.");
  pool.push("Work step‑by‑step rather than trying to do everything at once.");
  pool = shuffle(pool);
  // limit size to keep navigation manageable
  return pool.slice(0, Math.min(10, pool.length));
}

function showHint(idx) {
  const el = document.getElementById('hint-text');
  if (!el) return;
  // fade effect
  el.classList.add('fade');
  setTimeout(() => {
    el.textContent = currentHints[idx] || '';
    el.classList.remove('fade');
  }, 200);
}

function nextHint() {
  if (currentHints.length === 0) return;
  currentHintIdx = (currentHintIdx + 1) % currentHints.length;
  showHint(currentHintIdx);
}

function prevHint() {
  if (currentHints.length === 0) return;
  currentHintIdx = (currentHintIdx - 1 + currentHints.length) % currentHints.length;
  showHint(currentHintIdx);
}

function toggleHints() {
  const panel = document.getElementById('hint-panel');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (open) {
    const topic = practiceTopic || null; // use current practice topic if available
    currentHints = generateHints(topic);
    currentHintIdx = 0;
    showHint(currentHintIdx);
  }
}

// close if clicking outside panel (optional)
document.addEventListener('click', e => {
  const panel = document.getElementById('hint-panel');
  const btn1 = document.getElementById('hints-btn');
  const btn2 = document.getElementById('hints-btn-diag');
  if (!panel) return;
  if (panel.contains(e.target)) return;
  if ((btn1 && btn1.contains(e.target)) || (btn2 && btn2.contains(e.target))) return;
  if (panel.classList.contains('open')) toggleHints();
});

// move calculator element into mobile wrapper when needed
function repositionCalc() {
  const panel = document.getElementById('calc-panel');
  const wrapper = document.getElementById('mobile-calc-wrapper');
  if (!panel || !wrapper) return;
  if (window.innerWidth <= 767) {
    if (panel.parentElement !== wrapper) {
      // move panel in - preserve inline styles
      wrapper.appendChild(panel);
      panel.style.position = 'static';
      panel.style.width = '100%';
      panel.style.cursor = 'default';
    }
  } else {
    // on larger screens move back to body and restore defaults
    if (panel.parentElement === wrapper) {
      document.body.appendChild(panel);
      panel.style.position = 'absolute';
      panel.style.top = '10%';
      panel.style.right = '5%';
      panel.style.width = '';
      panel.style.cursor = 'move';
    }
    // make sure mobile wrapper is no longer flagged active so it stays
    // hidden if we later shrink the window again
    if (wrapper) wrapper.classList.remove('active-mode');
  }
}

// ensure reposition happens when orientation/resize occurs
window.addEventListener('resize', repositionCalc);
window.addEventListener('orientationchange', repositionCalc);
// call once early
window.addEventListener('load', repositionCalc);

// toggle calculator visibility by sliding on small phones
function toggleCalcSlider() {
  // no calculator for arithmetic
  if (practiceTopic === 'arithmetic') return
  const panel = document.getElementById('calc-panel');
  if (!panel) return;
  // always slide on phones (<=767px)
  const open = panel.classList.toggle('slide-open');
  if (!open) {
    // when sliding back out we may want to mark off state (optional)
    panel.classList.add('calc-off');
  } else {
    panel.classList.remove('calc-off', 'calc-min');
  }
}

// end hint panel logic

// ===========================
// DIAGNOSTIC BANK
// ===========================
function getBank() {
  return {
    arithmetic: [
      { q: 'Evaluate:   8 + 6 ÷ 3', a: '10' },
      { q: 'Evaluate:   7 × (5 + 3)', a: '56' },
      { q: 'Evaluate:   20 − 4 × 2', a: '12' },
      { q: 'Evaluate:   (9 − 5) + 6', a: '10' },
      { q: 'Evaluate:   18 ÷ 3 + 4', a: '10' },
      { q: 'Evaluate:   6 + 4 × (10 − 3)', a: '34' },
      { q: 'Evaluate:   (12 − 4)² ÷ 4', a: '16' },
      { q: 'Evaluate:   5² + 3 × 4', a: '37' },
      { q: 'Evaluate:   (15 − 5) × 2 + 8 ÷ 4', a: '22' },
      { q: 'Evaluate:   30 ÷ (5 + 1) + 7', a: '12' },
      { q: 'Evaluate:   2 + 3 × 4', a: '14' },
      { q: 'Evaluate:   (8 + 4) ÷ 3 + 1', a: '5' },
      { q: 'Evaluate:   10 − 2 + 5', a: '13' },
      { q: 'Evaluate:   16 ÷ 2 × 3', a: '24' },
      { q: 'Evaluate:   9 + 8 ÷ 4 − 2', a: '9' },
      { q: 'Evaluate:   3² + 4²', a: '25' },
      { q: 'Evaluate:   (6 + 2) × (5 − 3)', a: '16' },
      { q: 'Evaluate:   100 ÷ 5 − 10', a: '10' },
      { q: 'Evaluate:   12 + 18 ÷ 6', a: '15' },
      { q: 'Evaluate:   15 × 2 ÷ 3 + 5', a: '15' },
    ],
    algebra: [
      { q: 'Solve for x:   x + 7 = 15', a: '8' },
      { q: 'Solve for x:   3x = 18', a: '6' },
      { q: 'Solve for x:   x − 5 = 9', a: '14' },
      { q: 'Solve for x:   4x + 2 = 10', a: '2' },
      { q: 'Evaluate 2x + 3  when x = 4', a: '11' },
      { q: 'Solve for x:   2x + 5 = 17', a: '6' },
      { q: 'Solve for x:   5x − 3 = 2x + 9', a: '4' },
      { q: 'Solve for x:   x/3 + 4 = 10', a: '18' },
      { q: 'Expand:   3(x + 5)', a: '3x+15' },
      { q: 'Factor:   x² + 5x', a: 'x(x+5)' },
      { q: 'Solve for x:   6x = 30', a: '5' },
      { q: 'Solve for x:   x + 12 = 20', a: '8' },
      { q: 'Solve for x:   3x − 7 = 8', a: '5' },
      { q: 'Evaluate 5x − 2  when x = 3', a: '13' },
      { q: 'Solve for x:   x/2 + 5 = 12', a: '14' },
      { q: 'Expand:   2(x − 3)', a: '2x-6' },
      { q: 'Solve for x:   10x + 5 = 25', a: '2' },
      { q: 'Factor:   2x² + 8x', a: '2x(x+4)' },
      { q: 'Evaluate x² + 2x  when x = 3', a: '15' },
      { q: 'Solve for x:   7 − x = 2', a: '5' },
    ],
    geometry: [
      { q: 'Perimeter of a rectangle:   length = 8,  width = 5', a: '26' },
      { q: 'Area of a square with side 6', a: '36' },
      { q: 'A triangle has angles of 50° and 60°.  Find the third angle.', a: '70' },
      { q: 'Area of a triangle:   base = 10,  height = 4', a: '20' },
      { q: 'Circumference of a circle with radius 7  (π = 3.14)', a: '43.96' },
      { q: 'Area of a circle with radius 5  (π = 3.14)', a: '78.5' },
      { q: 'Right triangle legs: 6 and 8.  Find the hypotenuse.', a: '10' },
      { q: 'Rectangle:   area = 48,  width = 6.  Find the length.', a: '8' },
      { q: 'Right triangle:   hypotenuse = 13,  one leg = 5.  Find the other leg.', a: '12' },
      { q: 'Triangle:   base = 12,  height = 9.  Find the area.', a: '54' },
      { q: 'Perimeter of a square with side 7', a: '28' },
      { q: 'Area of a rectangle with length 12 and width 4', a: '48' },
      { q: 'Circumference of a circle with diameter 10  (π = 3.14)', a: '31.4' },
      { q: 'A triangle has angles of 45° and 45°.  Find the third angle.', a: '90' },
      { q: 'Area of a triangle with base 8 and height 6', a: '24' },
      { q: 'Right triangle legs: 3 and 4.  Find the hypotenuse.', a: '5' },
      { q: 'Area of a circle with radius 3  (π = 3.14)', a: '28.26' },
      { q: 'Perimeter of a rectangle with length 10 and width 3', a: '26' },
      { q: 'Right triangle:   hypotenuse = 10,  one leg = 6.  Find the other leg.', a: '8' },
      { q: 'A triangle has angles of 30° and 70°.  Find the third angle.', a: '80' },
      // special problems added for curriculum sequence
      { q: 'Circumference of a circle with radius 7 (π = 3.14)', a: '43.96', level: 'easy' },
      { q: 'A right triangle has one leg twice as long as the other. Hypotenuse = 10 cm. Find the legs (simplest radical form).', a: '√20 and 2√20', level: 'medium' },
      { q: 'Semicircle on base of isosceles triangle (apex angle 90°, sides 10 cm). Area of region inside semicircle but outside triangle (in terms of π).', a: '25π-50', level: 'hard' },
      { q: 'Two circles diameters 6 cm and 10 cm sit on a line. A 60° tangent touches each. Horizontal distance between tangency points?', a: '2√3', impossible: true, level: 'impossible' },
    ]
  }
}

// inject a few generated 'impossible' perimeter questions every time the bank is built
function generateImpossibleGeo() {
  const arr = []
  for (let i = 0; i < 4; i++) {
    // include decimals to make mental math harder
    const L = (rand(80, 250) + Math.random()).toFixed(2)
    const W = (rand(60, 200) + Math.random()).toFixed(2)
    const per = (2 * (parseFloat(L) + parseFloat(W))).toFixed(2)
    arr.push({
      q: `Perimeter of a rectangle:   length = ${L},  width = ${W}`,
      a: per,
      impossible: true
    })
  }
  return arr
}

// modify getBank to append impossibles dynamically
const _origGetBank = getBank
getBank = function() {
  const bank = _origGetBank()
  bank.geometry.push(...generateImpossibleGeo())
  return bank
}

// ===========================
// PROBLEM GENERATOR
// ===========================

// special, hand‑crafted geometry items that correspond to the
// easy/medium/hard/impossible sequence described by the user.
const SPECIAL_GEO = {
  easy: {
    question: 'Circumference of a circle with radius 7 (π = 3.14)',
    answer: '43.96'
  },
  medium: {
    question: 'A right triangle has one leg twice as long as the other. Hypotenuse = 10 cm. Find the legs (simplest radical form).',
    answer: '√20 and 2√20'
  },
  hard: {
    question: 'Semicircle on base of isosceles triangle (apex angle 90°, sides 10 cm). Area of region inside semicircle but outside triangle (in terms of π).',
    answer: '25π-50'
  },
  impossible: {
    question: 'Two circles diameters 6 cm and 10 cm sit on a line. A 60° tangent touches each. Horizontal distance between tangency points?',
    answer: '2√3'
  }
}

function generateProblem(topic, difficulty) {
  if (topic === 'arithmetic') return genArith(difficulty)
  if (topic === 'algebra')    return genAlgebra(difficulty)
  if (topic === 'geometry')   return genGeo(difficulty)
}

function genArith(d) {
  // pool index corresponds to a template in arithTemplates below
  const poolMap = {
    easy: [0, 1, 2],
    medium: [1, 2, 3, 4],
    hard: [3, 4, 5, 6]
  }
  const pool = poolMap[d] || poolMap.medium
  const idx = pool[rand(0, pool.length - 1)]
  return arithTemplates[idx]()
}

// generators for the arithmetic templates used above
const arithTemplates = [
  // simple two‑number operation
  () => {
    const A = rand(2, 15), B = rand(2, 15)
    const ops = [['+', A + B], ['−', A - B], ['×', A * B]]
    const [op, ans] = ops[rand(0, ops.length - 1)]
    return { question: `Evaluate:   ${fmt(A)}  ${op}  ${fmt(B)}`, answer: ans }
  },
  // A + B × C
  () => {
    const A = rand(2, 15), B = rand(2, 15), C = rand(2, 10)
    return { question: `Evaluate:   ${fmt(A)} + ${fmt(B)} × ${fmt(C)}`, answer: A + B * C }
  },
  // (A + B) × C
  () => {
    const A = rand(2, 15), B = rand(2, 15), C = rand(2, 10)
    return { question: `Evaluate:   (${fmt(A)} + ${fmt(B)}) × ${fmt(C)}`, answer: (A + B) * C }
  },
  // A + B × (C + D)
  () => {
    const A = rand(2, 15), B = rand(2, 15), C = rand(2, 10), D = rand(2, 8)
    return { question: `Evaluate:   ${fmt(A)} + ${fmt(B)} × (${fmt(C)} + ${fmt(D)})`,
             answer: A + B * (C + D) }
  },
  // (A+B)×(C−E) where E chosen so expression stays positive
  () => {
    const A = rand(2, 15), B = rand(2, 15), C = rand(2, 10), D = rand(2, 8)
    const sub = C - D < 1 ? C : C - D
    return { question: `Evaluate:   (${fmt(A)} + ${fmt(B)}) × (${fmt(C)} − ${fmt(C - sub)})`,
             answer: (A + B) * sub }
  },
  // A + B × (C + sq²)
  () => {
    const A = rand(2, 15), B = rand(2, 15), C = rand(2, 10)
    const sq = rand(2, 8)
    return { question: `Evaluate:   ${fmt(A)} + ${fmt(B)} × (${fmt(C)} + ${fmt(sq)}²)`,
             answer: A + B * (C + sq * sq) }
  },
  // A × base² − B × C
  () => {
    const A = rand(2, 15), B = rand(2, 15), C = rand(2, 10)
    const base = rand(2, 9)
    return { question: `Evaluate:   ${fmt(A)} × ${fmt(base)}² − ${fmt(B)} × ${fmt(C)}`,
             answer: A * base * base - B * C }
  }
];

function genAlgebra(d) {
  const easyPool = [1, 2]
  const medPool = [1, 2, 3, 4]
  const hardPool = [3, 4, 5, 6]
  const pool = d === 'easy' ? easyPool : d === 'medium' ? medPool : hardPool

  // parameters for the chosen problem; regenerate until valid
  let type, x, a, b, c, valid
  do {
    type = pool[rand(0, pool.length - 1)]
    x = rand(1, 12)
    a = rand(2, 9)
    b = rand(1, 15)
    c = rand(2, 6)
    valid = true
    if (type === 3 && a === c) valid = false  // avoid canceling x
    if (type === 5) {
      const result = a * x + b
      if (result % c !== 0) valid = false     // need integer division
    }
  } while (!valid)

  if (type === 1) {
    const result = a * x + b
    return { question: `Solve for x:   ${a}x + ${fmt(b)} = ${fmt(result)}`, answer: x }
  }
  if (type === 2) {
    const result = x + b
    return { question: `Solve for x:   x + ${fmt(b)} = ${fmt(result)}`, answer: x }
  }
  if (type === 3) {
    const d = (a - c) * x + b
    return { question: `Solve for x:   ${a}x + ${fmt(b)} = ${c}x + ${fmt(d)}`, answer: x }
  }
  if (type === 4) {
    const result = a * (x + b)
    return { question: `Solve for x:   ${a}(x + ${b}) = ${fmt(result)}`, answer: x }
  }
  if (type === 5) {
    const result = (a * x + b) / c
    return { question: `Solve for x:   (${a}x + ${b}) ÷ ${c} = ${fmt(result)}`, answer: x }
  }
  if (type === 6) {
    const k = x * x
    return { question: `Solve for x:   x² = ${fmt(k)}   (positive root only)`, answer: x }
  }
}

function genGeo(d) {
  // first, maybe hand‑picked special item
  if (SPECIAL_GEO[d] && (d === 'impossible' || Math.random() < 0.3)) {
    return { question: SPECIAL_GEO[d].question, answer: SPECIAL_GEO[d].answer }
  }

  // impossible difficulty gets its own perimeter routine
  if (d === 'impossible') {
    const L = (Math.random() * 200 + 50).toFixed(2)
    const W = (Math.random() * 150 + 30).toFixed(2)
    const per = (2 * (parseFloat(L) + parseFloat(W))).toFixed(2)
    return { question: `Find the perimeter of a rectangle.\n  Length = ${L},   Width = ${W}`, answer: per }
  }

  const easyPool = [1, 2, 3]
  const medPool = [1, 2, 3, 4, 5]
  const hardPool = [3, 4, 5, 6, 7]
  const pool = d === 'easy' ? easyPool : d === 'medium' ? medPool : hardPool

  // some choices need to reroll until they meet constraints
  let type
  while (true) {
    type = pool[rand(0, pool.length - 1)]
    if (type === 7) {
      const a1 = rand(30, 80), a2 = rand(30, 80)
      if (a1 + a2 < 180) {
        return { question: `A triangle has angles of ${a1}° and ${a2}°.\n  Find the third angle.`, answer: 180 - a1 - a2 }
      }
      // otherwise reroll type entirely
      continue
    }
    break
  }

  if (type === 1) {
    const L = rand(3, 25), W = rand(3, 25)
    return { question: `Find the perimeter of a rectangle.\n  Length = ${L},   Width = ${W}`, answer: 2 * (L + W) }
  }
  if (type === 2) {
    const L = rand(3, 20), W = rand(3, 20)
    return { question: `Find the area of a rectangle.\n  Length = ${L},   Width = ${W}`, answer: L * W }
  }
  if (type === 3) {
    const base = rand(4, 24), height = rand(4, 20)
    return { question: `Find the area of a triangle.\n  Base = ${base},   Height = ${height}`, answer: 0.5 * base * height }
  }
  if (type === 4) {
    const r = rand(3, 15)
    return { question: `Find the circumference of a circle.\n  Radius = ${r}   (Use π = 3.14)`, answer: parseFloat((2 * 3.14 * r).toFixed(2)) }
  }
  if (type === 5) {
    const r = rand(3, 15)
    return { question: `Find the area of a circle.\n  Radius = ${r}   (Use π = 3.14)`, answer: parseFloat((3.14 * r * r).toFixed(2)) }
  }
  if (type === 6) {
    const triples = [[3,4,5],[5,12,13],[8,15,17],[6,8,10],[9,12,15],[7,24,25]]
    const [a, b, c] = triples[rand(0, triples.length - 1)]
    return { question: `Right triangle with legs ${a} and ${b}.\n  Find the hypotenuse.`, answer: c }
  }
}

// ===========================
// CALCULATOR
// ===========================
function cIns(v) {
  const inp = document.getElementById('calc-input')
  const pos = inp.selectionStart ?? inp.value.length
  inp.value = inp.value.slice(0, pos) + v + inp.value.slice(pos)
  inp.focus()
  inp.setSelectionRange(pos + v.length, pos + v.length)
}

function cClear() {
  document.getElementById('calc-input').value = ''
  document.getElementById('calc-result').textContent = ''
}

function cBack() {
  const inp = document.getElementById('calc-input')
  inp.value = inp.value.slice(0, -1)
  inp.focus()
}

function cCalc() {
  const inp = document.getElementById('calc-input')
  const raw = inp.value.trim()
  if (!raw) return
  try {
    let e = raw
      .replace(/sin\(/g, '_sin(').replace(/cos\(/g, '_cos(').replace(/tan\(/g, '_tan(')
      .replace(/asin\(/g, '_asin(').replace(/acos\(/g, '_acos(').replace(/atan\(/g, '_atan(')
      .replace(/sqrt\(/g, 'Math.sqrt(').replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(').replace(/abs\(/g, 'Math.abs(')
      .replace(/\^/g, '**').replace(/π/g, 'Math.PI').replace(/e(?!\d)/g, 'Math.E')
    // auto-close parens
    const opens = (e.match(/\(/g)||[]).length, closes = (e.match(/\)/g)||[]).length
    for (let i = 0; i < opens - closes; i++) e += ')'
    const res = eval(e)
    const rounded = Math.round(res * 1e10) / 1e10
    const hist = document.getElementById('calc-hist')
    if (hist) {
      const row = document.createElement('div')
      row.className = 'hist-row'
      row.innerHTML = `<span class="he">${raw}</span><span class="hr">= ${rounded}</span>`
      hist.prepend(row)
      while (hist.children.length > 5) hist.removeChild(hist.lastChild)
    }
    document.getElementById('calc-result').textContent = rounded
    inp.value = String(rounded)
  } catch { document.getElementById('calc-result').textContent = 'Error' }
}

function _sin(x) { return Math.sin(x * Math.PI / 180) }
function _cos(x) { return Math.cos(x * Math.PI / 180) }
function _tan(x) { return Math.tan(x * Math.PI / 180) }
function _asin(x) { return Math.asin(x) * 180 / Math.PI }
function _acos(x) { return Math.acos(x) * 180 / Math.PI }
function _atan(x) { return Math.atan(x) * 180 / Math.PI }


function showNotification(msg, isError = false) {
  const notif = document.createElement('div')
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${isError ? 'rgba(255, 107, 107, 0.9)' : 'rgba(0, 212, 170, 0.9)'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    font-family: 'DM Sans', sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `
  notif.textContent = msg
  document.body.appendChild(notif)
  setTimeout(() => {
    notif.style.animation = 'slideOut 0.3s ease'
    notif.style.opacity = '0'
    setTimeout(() => document.body.removeChild(notif), 300)
  }, 3000)
}

// Add animations
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`
document.head.appendChild(style)


// ===========================
// KEYBOARD
// ===========================
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return
  const id = document.activeElement?.id
  if (id === 'diag-inp') submitDiag()
  else if (id === 'prac-inp') submitPractice()
  else if (id === 'calc-input') cCalc()
})
