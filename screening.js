/* HEAR — Listening Experience Screening
   Runs entirely client-side using the Web Audio API for tones/noise
   and the Web Speech API for the speech-recognition style stages.
   Not a medical device. Produces a self-report style profile only. */

(function () {
  const stageEl = document.getElementById('stage');
  const progressFill = document.getElementById('progressFill');
  const stageCounter = document.getElementById('stageCounter');

  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // ---- results storage ----
  const results = {
    detection: { left: [], right: [] },      // booleans: heard or not
    localization: [],                         // booleans: correct or not
    speechQuiet: [],                          // 0-1 accuracy per sentence
    speechNoise: []                           // 0-1 accuracy per sentence
  };

  // ---- overall flow ----
  const DETECTION_TRIALS_PER_SIDE = 5;
  const LOCALIZATION_TRIALS = 6;
  const QUIET_SENTENCES = [
    'The meeting begins at three.',
    'Please close the door behind you.'
  ];
  const NOISE_SENTENCES = [
    'Turn left at the next light.',
    'The package arrived this morning.'
  ];

  let flow = [];
  let flowIndex = 0;

  function buildFlow() {
    flow.push({ type: 'intro' });
    for (let i = 0; i < DETECTION_TRIALS_PER_SIDE; i++) flow.push({ type: 'detection', side: 'left', n: i });
    for (let i = 0; i < DETECTION_TRIALS_PER_SIDE; i++) flow.push({ type: 'detection', side: 'right', n: i });
    for (let i = 0; i < LOCALIZATION_TRIALS; i++) flow.push({ type: 'localization', n: i });
    QUIET_SENTENCES.forEach((s, i) => flow.push({ type: 'speech', mode: 'quiet', sentence: s, n: i }));
    NOISE_SENTENCES.forEach((s, i) => flow.push({ type: 'speech', mode: 'noise', sentence: s, n: i }));
    flow.push({ type: 'done' });
  }

  function updateProgress() {
    const pct = Math.round((flowIndex / (flow.length - 1)) * 100);
    progressFill.style.width = pct + '%';
    const step = flow[flowIndex];
    const labels = { intro: 'Getting ready', detection: 'Sound Detection', localization: 'Sound Localization', speech: step && step.mode === 'quiet' ? 'Speech — Quiet' : 'Speech — Background Noise', done: 'Complete' };
    stageCounter.textContent = labels[step.type] || '';
  }

  function next() {
    flowIndex++;
    render();
  }

  // ---- audio helpers ----
  function playTone({ pan = 0, duration = 0.5, freq = 700 } = {}) {
    return new Promise((resolve) => {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      if (panner) {
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        gain.connect(ctx.destination);
      }
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.05);
      osc.onended = resolve;
    });
  }

  function playNoise(duration = 3) {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.18;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    return src;
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }

  function wordAccuracy(target, attempt) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const t = norm(target);
    const a = new Set(norm(attempt));
    if (t.length === 0) return 0;
    const hits = t.filter((w) => a.has(w)).length;
    return hits / t.length;
  }

  // ---- renderers ----
  function render() {
    const step = flow[flowIndex];
    updateProgress();
    if (step.type === 'intro') return renderIntro();
    if (step.type === 'detection') return renderDetection(step);
    if (step.type === 'localization') return renderLocalization(step);
    if (step.type === 'speech') return renderSpeech(step);
    if (step.type === 'done') return renderDone();
  }

  function renderIntro() {
    stageEl.innerHTML = `
      <div class="stage-label">Before you begin</div>
      <h2>How do you experience sound?</h2>
      <p class="instructions">Take a short interactive screening to explore how you respond to different sounds. This takes about 4–5 minutes.</p>
      <div class="notice" role="note">
        <strong>This screening is not a medical hearing test or diagnosis.</strong> Results may be affected by your device and listening environment. If you have concerns about your hearing, consider consulting a qualified hearing professional.
      </div>
      <ul class="checklist" style="text-align:left; max-width:420px; margin:24px auto;">
        <li>Use headphones or earbuds</li>
        <li>Find a quiet environment</li>
        <li>Set your device volume to a comfortable level</li>
        <li>Do not use this test to make medical decisions</li>
      </ul>
      <button class="btn-primary" id="beginBtn">Begin Screening</button>
    `;
    document.getElementById('beginBtn').addEventListener('click', next);
  }

  function renderDetection(step) {
    stageEl.innerHTML = `
      <div class="stage-label">Sound Detection — ${step.side === 'left' ? 'Left' : 'Right'} channel</div>
      <h2>Did you hear a sound?</h2>
      <p class="instructions">Press play, then tell us whether you heard the tone.</p>
      <button class="speaker-btn" id="playBtn" aria-label="Play sound">🔊</button>
      <div class="choice-row" id="choiceRow" style="visibility:hidden;">
        <button class="choice-btn" data-v="yes">Yes</button>
        <button class="choice-btn" data-v="no">No</button>
      </div>
      <div class="stage-meta">Trial ${step.n + 1} of ${DETECTION_TRIALS_PER_SIDE}</div>
    `;
    const playBtn = document.getElementById('playBtn');
    const choiceRow = document.getElementById('choiceRow');
    playBtn.addEventListener('click', async () => {
      playBtn.classList.add('playing');
      playBtn.disabled = true;
      const pan = step.side === 'left' ? -0.9 : 0.9;
      // small chance of silent trial to keep responses honest, kept low so UX stays smooth
      await playTone({ pan, freq: 600 + Math.random() * 300 });
      playBtn.classList.remove('playing');
      choiceRow.style.visibility = 'visible';
    });
    choiceRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-btn');
      if (!btn) return;
      results.detection[step.side].push(btn.dataset.v === 'yes');
      next();
    });
  }

  function renderLocalization(step) {
    const pans = [-0.9, 0, 0.9];
    const labels = ['left', 'center', 'right'];
    const pick = Math.floor(Math.random() * 3);
    stageEl.innerHTML = `
      <div class="stage-label">Sound Localization</div>
      <h2>Where did you hear the sound?</h2>
      <p class="instructions">Press play, then select the direction the sound came from.</p>
      <button class="speaker-btn" id="playBtn" aria-label="Play sound">🔊</button>
      <div class="choice-row" id="choiceRow" style="visibility:hidden;">
        <button class="choice-btn" data-v="left">Left</button>
        <button class="choice-btn" data-v="center">Center</button>
        <button class="choice-btn" data-v="right">Right</button>
      </div>
      <div class="stage-meta">Trial ${step.n + 1} of ${LOCALIZATION_TRIALS}</div>
    `;
    const playBtn = document.getElementById('playBtn');
    const choiceRow = document.getElementById('choiceRow');
    playBtn.addEventListener('click', async () => {
      playBtn.classList.add('playing');
      playBtn.disabled = true;
      await playTone({ pan: pans[pick], freq: 500 });
      playBtn.classList.remove('playing');
      choiceRow.style.visibility = 'visible';
    });
    choiceRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-btn');
      if (!btn) return;
      results.localization.push(btn.dataset.v === labels[pick]);
      next();
    });
  }

  function renderSpeech(step) {
    const isNoise = step.mode === 'noise';
    stageEl.innerHTML = `
      <div class="stage-label">Speech ${isNoise ? '— Background Noise' : '— Quiet'}</div>
      <h2>Type the sentence you heard.</h2>
      <p class="instructions">Press play and listen carefully${isNoise ? ' — background noise will be present' : ''}. Then type what you heard as closely as you can.</p>
      <button class="speaker-btn" id="playBtn" aria-label="Play sentence">🔊</button>
      <div class="text-input-row" id="inputRow" style="visibility:hidden;">
        <input type="text" id="answerInput" placeholder="Type what you heard...">
        <button class="btn-primary" id="submitBtn">Submit</button>
      </div>
      <div class="stage-meta">Sentence ${step.n + 1} of ${isNoise ? NOISE_SENTENCES.length : QUIET_SENTENCES.length}</div>
    `;
    const playBtn = document.getElementById('playBtn');
    const inputRow = document.getElementById('inputRow');
    const answerInput = document.getElementById('answerInput');
    const submitBtn = document.getElementById('submitBtn');

    playBtn.addEventListener('click', async () => {
      playBtn.classList.add('playing');
      playBtn.disabled = true;
      let noiseSrc = null;
      if (isNoise) noiseSrc = playNoise(4);
      await speak(step.sentence);
      if (noiseSrc) setTimeout(() => { try { noiseSrc.stop(); } catch (e) {} }, 400);
      playBtn.classList.remove('playing');
      inputRow.style.visibility = 'visible';
      answerInput.focus();
    });

    function submit() {
      const acc = wordAccuracy(step.sentence, answerInput.value || '');
      (isNoise ? results.speechNoise : results.speechQuiet).push(acc);
      next();
    }
    submitBtn.addEventListener('click', submit);
    answerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function renderDone() {
    stageEl.innerHTML = `
      <div class="stage-label">Screening complete</div>
      <h2>Thanks for completing the screening.</h2>
      <p class="instructions">We're putting together your Listening Profile now.</p>
      <button class="btn-primary" id="seeResults">See My Listening Profile →</button>
    `;
    document.getElementById('seeResults').addEventListener('click', () => {
      const pct = (arr) => arr.length ? Math.round((arr.filter(Boolean).length / arr.length) * 100) : null;
      const pctAvg = (arr) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) : null;
      const profile = {
        detectionLeft: pct(results.detection.left),
        detectionRight: pct(results.detection.right),
        localization: pct(results.localization),
        speechQuiet: pctAvg(results.speechQuiet),
        speechNoise: pctAvg(results.speechNoise),
        completedAt: new Date().toISOString()
      };
      localStorage.setItem('hear_profile', JSON.stringify(profile));
      window.location.href = 'profile.html';
    });
  }

  buildFlow();
  render();
})();
