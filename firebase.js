// Firebase-related utilities separated for easy tinkering

// ===========================
// FIREBASE SETUP
// ===========================
// replace the config below with your own Firebase project's
const firebaseConfig = {
  apiKey: "AIzaSyCEb1ZnFmYDNuAlShIGjOTHNBP_T0u1-fw",
  authDomain: "mathpat-b8695.firebaseapp.com",
  projectId: "mathpat-b8695",
  storageBucket: "mathpat-b8695.firebasestorage.app",
  messagingSenderId: "676457174517",
  appId: "1:676457174517:web:ec39f616cb925c4ffa3cbc"
}

let db, auth
function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig)
    auth = firebase.auth()
    db = firebase.firestore()
    // listen for auth state changes
    auth.onAuthStateChanged(user => {
      const infoEls = document.querySelectorAll('.user-info')
      const logoutBtns = document.querySelectorAll('.logout-btn')
      if (user) {
        if (infoEls.length) infoEls.forEach(el => {
          el.textContent = '✓';
          el.title = user.email;            // hover shows address if needed
          el.classList.add('logged-in');
        })
        logoutBtns.forEach(b => b.style.display = 'inline-block')

        loadProgress(user.uid).then(() => goHome())
      } else {
        if (infoEls.length) infoEls.forEach(el => {
          el.textContent = 'Not logged in';
          el.title = '';
          el.classList.remove('logged-in');
        })
        logoutBtns.forEach(b => b.style.display = 'none')
        showScreen('screen-login')
      }
    })
  } catch(e) {
    console.warn('Firebase initialization failed', e)
  }
}

async function saveProgress(uid) {
  if (!db || !uid) return
  const data = { mastery, diff, streak, hasDiag, diagPasses, lastUpdated: Date.now() }
  try { await db.collection('users').doc(uid).set(data) } catch(e) { console.warn(e) }
}

async function loadProgress(uid) {
  if (!db || !uid) return
  try {
    const doc = await db.collection('users').doc(uid).get()
    if (doc.exists) {
      const data = doc.data()
      mastery = data.mastery || mastery
      diff = data.diff || diff
      streak = data.streak || streak
      hasDiag = data.hasDiag || hasDiag
      diagPasses = data.diagPasses || diagPasses
      renderDashboard()
    }
  } catch(e) { console.warn(e) }
}

// ===========================
// AUTH HELPERS (login/register)
// ===========================
function doLogin() {
  const email = document.getElementById('login-email').value
  const pass = document.getElementById('login-password').value
  const err = document.getElementById('login-error')
  auth.signInWithEmailAndPassword(email, pass)
    .catch(e => { if (err) err.textContent = e.message })
}
function doRegister() {
  const email = document.getElementById('login-email').value
  const pass = document.getElementById('login-password').value
  const err = document.getElementById('login-error')
  auth.createUserWithEmailAndPassword(email, pass)
    .catch(e => { if (err) err.textContent = e.message })
}

// wire up buttons and initialise
window.addEventListener('load', () => {
  const loginBtn = document.getElementById('login-btn')
  const regBtn = document.getElementById('register-btn')
  const logoutBtns = document.querySelectorAll('.logout-btn')
  if (loginBtn) loginBtn.addEventListener('click', doLogin)
  if (regBtn) regBtn.addEventListener('click', doRegister)
  logoutBtns.forEach(b => b.addEventListener('click', () => auth.signOut()))
  initFirebase()
})
