// ===========================
// STATE
// ===========================
const TOPICS = ['arithmetic', 'algebra', 'geometry']
let mastery = { arithmetic: 0, algebra: 0, geometry: 0 }
let diff = { arithmetic: 'medium', algebra: 'medium', geometry: 'medium' }
let streak = { arithmetic: { c: 0, w: 0 }, algebra: { c: 0, w: 0 }, geometry: { c: 0, w: 0 } }
let diagQs = [], diagIdx = 0, diagScores = {}
let diagPasses = { arithmetic: 0, algebra: 0, geometry: 0 } // count of successful (80%+) diagnostics
let hasDiag = false
let practiceTopic = null, currentAnswer = null

// ===========================
// PALETTE / THEME
// ===========================
// available palettes (css var overrides)
const PALETTES = {
  default: {
    '--bg': '#0c0e16',
    '--surface': '#13151f',
    '--accent': '#5b6ef5',
    '--accent-h': '#7c8fff'
  },
  ocean: {
    '--bg': '#06283d',
    '--surface': '#0a1f44',
    '--accent': '#256d85',
    '--accent-h': '#dff6ff'
  },
  sunset: {
    '--bg': '#2e001e',
    '--surface': '#3a002a',
    '--accent': '#ff6b6b',
    '--accent-h': '#ffc6c6'
  }
}

function applyPalette(name) {
  const vars = PALETTES[name] || PALETTES.default
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
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

function goHome() {
  if (auth && auth.currentUser) {
    // optionally load fresh progress
    loadProgress(auth.currentUser.uid)
      .then(() => {
        showScreen('screen-home'); renderDashboard(); initPalettePicker()
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
// ===========================
function startDiagnostic() {
  const bank = getBank()
  diagScores = { arithmetic: 0, algebra: 0, geometry: 0 }
  diagIdx = 0

  // ensure geometry set always includes a couple of 'impossible' perimeter questions
  const geoItems = [...bank.geometry]
  const impossible = geoItems.filter(q => q.impossible)
  const normal = geoItems.filter(q => !q.impossible)

  const geoSlice = shuffle(normal).slice(0, 14)
  // if not enough impossible in bank, just proceed normally
  if (impossible.length > 0) {
    geoSlice.push(...shuffle(impossible).slice(0, Math.min(2, impossible.length)))
  }
  const geoSet = shuffle(geoSlice).map(q => ({ ...q, topic: 'geometry' }))

  const sets = TOPICS.map(t => {
    if (t === 'geometry') return geoSet
    return shuffle([...bank[t]]).slice(0, 16).map(q => ({ ...q, topic: t }))
  })

  diagQs = shuffle(sets.flat())
  showScreen('screen-diag')
  renderDiagQ()
}

function renderDiagQ() {
  const tot = diagQs.length
  document.getElementById('diag-counter').textContent = `${diagIdx + 1} / ${tot}`
  document.getElementById('diag-prog').style.width = (diagIdx / tot * 100) + '%'

  // render question text; algebra/geometry use stacked fractions instead of ÷ or /
  const qElem = document.getElementById('diag-q')
  const qText = diagQs[diagIdx].q
  const topic = diagQs[diagIdx].topic
  qElem.innerHTML = formatQuestion(qText, topic)

  document.getElementById('diag-inp').value = ''
  setFeedback('diag-fb', '', '')
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

function finishDiag() {
  hasDiag = true
  TOPICS.forEach(t => {
    const correct = diagScores[t]
    const percent = Math.round((correct / 16) * 100)
    if (percent >= 80) {
      // each strong show adds to mastery gradually
      mastery[t] = Math.min(100, mastery[t] + 10)
      diagPasses[t]++
    } else {
      // don't lower existing mastery, but reflect if current percent is higher
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
  nextQ()
  showScreen('screen-practice')

  // calculator is shown only for algebra/geometry
  if (topic === 'arithmetic') hideCalc()
  else showCalcPanel()
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
}

function submitPractice() {
  const ans = document.getElementById('prac-inp').value.trim()
  const ok = checkAns(ans, currentAnswer)
  const t = practiceTopic

  setFeedback('prac-fb', ok ? '✓  Correct!' : '✗  Answer: ' + currentAnswer, ok ? 'correct' : 'incorrect')

  // Update mastery based on correct/wrong and streak bonus
  if (ok) {
    // Determine streak bonus: 1st correct +4%, 2nd +8%, 3rd+ +10%
    let masteryGain = 2 // base gain
    if (streak[t].c === 0) masteryGain += 2 // 1st correct: +4% total
    else if (streak[t].c === 1) masteryGain += 6 // 2nd correct: +8% total
    else masteryGain += 8 // 3rd+ correct: +10% total
    mastery[t] = Math.min(100, mastery[t] + masteryGain)
    streak[t].c++
    streak[t].w = 0
  } else {
    mastery[t] = Math.max(0, mastery[t] - 1)
    streak[t].w++
    streak[t].c = 0
  }

  if (streak[t].c >= 3) {
    if (diff[t] === 'easy') diff[t] = 'medium'
    else if (diff[t] === 'medium') diff[t] = 'hard'
    else if (diff[t] === 'hard') diff[t] = 'impossible'
    streak[t].c = 0
  }
  if (streak[t].w >= 2) {
    if (diff[t] === 'impossible') diff[t] = 'hard'
    else if (diff[t] === 'hard') diff[t] = 'medium'
    else if (diff[t] === 'medium') diff[t] = 'easy'
    streak[t].w = 0
  }

  updatePracticeMeta()
  if (auth && auth.currentUser) saveProgress(auth.currentUser.uid)
  setTimeout(nextQ, 950)
}

// ===========================
// CALCULATOR TOGGLE
// ===========================
function hideCalc() {
  const panel = document.getElementById('calc-panel')
  if (!panel) return
  panel.classList.add('calc-min')
  panel.classList.remove('calc-off')
  // make sure opacity button remains visible even when minimized
  const opbtn = document.getElementById('calc-opacity-tog')
  if (opbtn) opbtn.style.display = 'block'
}

function showCalcPanel() {
  const panel = document.getElementById('calc-panel')
  panel.classList.remove('calc-min')
  // ensure opacity full when displayed
  panel.style.opacity = '1'
  calcOpaque = true
  // reset opacity button icon
  const opbtn = document.getElementById('calc-opacity-tog')
  if (opbtn) {
    opbtn.style.display = ''
    opbtn.textContent = '👁‍🗨'
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
  panel.style.opacity = calcOpaque ? '1' : '0'
  // update button icon to indicate state
  const btn = document.getElementById('calc-opacity-tog')
  if (btn) btn.textContent = calcOpaque ? '👁‍🗨' : '👁'
}

// enable dragging of calculator panel like a chat bubble
let calcDrag = { active: false, offsetX: 0, offsetY: 0 }
function initCalcDrag() {
  const panel = document.getElementById('calc-panel')
  panel.addEventListener('mousedown', startCalcDrag)
  document.addEventListener('mousemove', moveCalc)
  document.addEventListener('mouseup', endCalcDrag)
  panel.addEventListener('touchstart', startCalcDrag)
  document.addEventListener('touchmove', moveCalc)
  document.addEventListener('touchend', endCalcDrag)
}

function startCalcDrag(e) {
  const panel = document.getElementById('calc-panel')
  if (panel.classList.contains('calc-off')) return
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

function clearWork() {
  const workArea = document.getElementById('work-area')
  if (workArea) workArea.value = ''
  
  const canvas = document.getElementById('draw-canvas')
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
}

let isDrawing = false
let lastX = 0
let lastY = 0

function initCanvas() {
  const canvas = document.getElementById('draw-canvas')
  if (!canvas) return
  
  const rect = canvas.parentElement.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  canvas.addEventListener('mousedown', startDraw)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', stopDraw)
  canvas.addEventListener('mouseleave', stopDraw)
  canvas.addEventListener('touchstart', handleTouch)
  canvas.addEventListener('touchmove', handleTouch)
  canvas.addEventListener('touchend', stopDraw)
}

// resize listener: if the canvas is visible, reinitialize when the window changes
window.addEventListener('resize', () => {
  const canvas = document.getElementById('draw-canvas')
  if (canvas && canvas.parentElement.classList.contains('active-mode')) {
    initCanvas()
  }
})

function startDraw(e) {
  isDrawing = true
  const canvas = document.getElementById('draw-canvas')
  const rect = canvas.getBoundingClientRect()
  lastX = e.clientX - rect.left
  lastY = e.clientY - rect.top
}

function draw(e) {
  if (!isDrawing) return
  
  const canvas = document.getElementById('draw-canvas')
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
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

function handleTouch(e) {
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  document.getElementById('draw-canvas').dispatchEvent(mouseEvent)
}

function toggleSolutionMode(mode) {
  const textContainer = document.getElementById('text-container')
  const canvasContainer = document.getElementById('canvas-container')
  const btnText = document.getElementById('btn-text-mode')
  const btnDraw = document.getElementById('btn-draw-mode')
  
  if (mode === 'text') {
    textContainer.classList.add('active-mode')
    canvasContainer.classList.remove('active-mode')
    btnText.classList.add('active')
    btnDraw.classList.remove('active')
  } else if (mode === 'draw') {
    textContainer.classList.remove('active-mode')
    canvasContainer.classList.add('active-mode')
    btnText.classList.remove('active')
    btnDraw.classList.add('active')
    setTimeout(() => initCanvas(), 50)
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
function generateProblem(topic, difficulty) {
  if (topic === 'arithmetic') return genArith(difficulty)
  if (topic === 'algebra')    return genAlgebra(difficulty)
  if (topic === 'geometry')   return genGeo(difficulty)
}

function genArith(d) {
  const easy = [1, 2, 3], med = [2, 3, 4, 5], hard = [4, 5, 6, 7]
  const pool = d === 'easy' ? easy : d === 'medium' ? med : hard
  const type = pool[rand(0, pool.length - 1)]
  let A = rand(2, 15), B = rand(2, 15), C = rand(2, 10), D = rand(2, 8)

  if (type === 1) {
    const ops = [['+', A + B], ['−', A - B], ['×', A * B]]
    const [op, ans] = ops[rand(0, 2)]
    return { question: `Evaluate:   ${fmt(A)}  ${op}  ${fmt(B)}`, answer: ans }
  }
  if (type === 2) {
    const ans = A + B * C
    return { question: `Evaluate:   ${fmt(A)} + ${fmt(B)} × ${fmt(C)}`, answer: ans }
  }
  if (type === 3) {
    const ans = (A + B) * C
    return { question: `Evaluate:   (${fmt(A)} + ${fmt(B)}) × ${fmt(C)}`, answer: ans }
  }
  if (type === 4) {
    const ans = A + B * (C + D)
    return { question: `Evaluate:   ${fmt(A)} + ${fmt(B)} × (${fmt(C)} + ${fmt(D)})`, answer: ans }
  }
  if (type === 5) {
    const ans = (A + B) * (C - D < 1 ? C : C - D)
    const sub = C - D < 1 ? C : C - D
    return { question: `Evaluate:   (${fmt(A)} + ${fmt(B)}) × (${fmt(C)} − ${fmt(C - sub)})`, answer: (A + B) * sub }
  }
  if (type === 6) {
    const sq = rand(2, 8)
    const ans = A + B * (C + sq * sq)
    return { question: `Evaluate:   ${fmt(A)} + ${fmt(B)} × (${fmt(C)} + ${fmt(sq)}²)`, answer: ans }
  }
  if (type === 7) {
    const base = rand(2, 9)
    const ans = A * base * base - B * C
    return { question: `Evaluate:   ${fmt(A)} × ${fmt(base)}² − ${fmt(B)} × ${fmt(C)}`, answer: ans }
  }
}

function genAlgebra(d) {
  const easy = [1, 2], med = [1, 2, 3, 4], hard = [3, 4, 5, 6]
  const pool = d === 'easy' ? easy : d === 'medium' ? med : hard
  const type = pool[rand(0, pool.length - 1)]
  let x = rand(1, 12), a = rand(2, 9), b = rand(1, 15), c = rand(2, 6)

  if (type === 1) {
    const result = a * x + b
    return { question: `Solve for x:   ${a}x + ${fmt(b)} = ${fmt(result)}`, answer: x }
  }
  if (type === 2) {
    const result = x + b
    return { question: `Solve for x:   x + ${fmt(b)} = ${fmt(result)}`, answer: x }
  }
  if (type === 3) {
    // ax + b = cx + d
    const extra = rand(1, 8)
    const d = (a - c) * x + b
    if (a === c) return genAlgebra(d)
    return { question: `Solve for x:   ${a}x + ${fmt(b)} = ${c}x + ${fmt(d)}`, answer: x }
  }
  if (type === 4) {
    const result = a * (x + b)
    return { question: `Solve for x:   ${a}(x + ${b}) = ${fmt(result)}`, answer: x }
  }
  if (type === 5) {
    const result = (a * x + b)
    if (result % c !== 0) return genAlgebra(d)
    return { question: `Solve for x:   (${a}x + ${b}) ÷ ${c} = ${fmt(result / c)}`, answer: x }
  }
  if (type === 6) {
    const k = x * x
    return { question: `Solve for x:   x² = ${fmt(k)}   (positive root only)`, answer: x }
  }
}

function genGeo(d) {
  if (d === 'impossible') {
    // extremely large or decimal sides, perimeter questions only
    const L = (Math.random() * 200 + 50).toFixed(2)
    const W = (Math.random() * 150 + 30).toFixed(2)
    const per = (2 * (parseFloat(L) + parseFloat(W))).toFixed(2)
    return { question: `Find the perimeter of a rectangle.\n  Length = ${L},   Width = ${W}`, answer: per }
  }

  const easy = [1, 2, 3], med = [1, 2, 3, 4, 5], hard = [3, 4, 5, 6, 7]
  const pool = d === 'easy' ? easy : d === 'medium' ? med : hard
  const type = pool[rand(0, pool.length - 1)]

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
  if (type === 7) {
    const a1 = rand(30, 80), a2 = rand(30, 80)
    if (a1 + a2 >= 180) return genGeo(d)
    return { question: `A triangle has angles of ${a1}° and ${a2}°.\n  Find the third angle.`, answer: 180 - a1 - a2 }
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
