(function () {
  const captionBox = document.getElementById('captionBox');
  const startBtn = document.getElementById('startBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const unsupportedNotice = document.getElementById('unsupportedNotice');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let finalTranscript = '';
  let lang = 'en-US';
  let captionDelay = 0; // ms, controlled by caption speed setting

  if (!SpeechRecognition) {
    unsupportedNotice.style.display = 'block';
    startBtn.disabled = true;
  }

  function setStatus(isLive) {
    statusDot.classList.toggle('live', isLive);
    statusText.textContent = isLive ? 'Listening' : 'Not listening';
  }

  function renderCaption(text) {
    captionBox.textContent = text || 'Press "Start Listening" and begin speaking.';
  }

  function initRecognition() {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      const display = (finalTranscript + interim).trim();
      const words = display.split(/\s+/);
      const windowed = words.slice(Math.max(0, words.length - 40)).join(' ');
      setTimeout(() => renderCaption(windowed), captionDelay);
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        renderCaption('Microphone access was denied. Please allow microphone access to use Live Hear.');
        stopListening();
      }
    };

    recognition.onend = () => {
      if (listening) {
        // auto-restart to keep captions continuous
        try { recognition.start(); } catch (e) {}
      }
    };
  }

  function startListening() {
    if (!SpeechRecognition) return;
    if (!recognition) initRecognition();
    recognition.lang = lang;
    finalTranscript = '';
    try {
      recognition.start();
      listening = true;
      setStatus(true);
      startBtn.textContent = '⏹ Stop Listening';
      renderCaption('Listening…');
    } catch (e) {}
  }

  function stopListening() {
    listening = false;
    setStatus(false);
    startBtn.textContent = '🎙 Start Listening';
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
  }

  startBtn.addEventListener('click', () => {
    if (listening) stopListening(); else startListening();
  });

  // ---- settings ----
  function bindToggleGroup(groupId, onSelect) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onSelect(btn.dataset.v);
      });
    });
  }

  bindToggleGroup('sizeGroup', (v) => {
    captionBox.classList.remove('size-small', 'size-large');
    if (v === 'small') captionBox.classList.add('size-small');
    if (v === 'large') captionBox.classList.add('size-large');
  });

  bindToggleGroup('contrastGroup', (v) => {
    captionBox.classList.toggle('contrast-high', v === 'high');
  });

  bindToggleGroup('langGroup', (v) => {
    lang = v === 'ko' ? 'ko-KR' : 'en-US';
    if (recognition) recognition.lang = lang;
  });

  bindToggleGroup('speedGroup', (v) => {
    captionDelay = v === 'slow' ? 500 : v === 'fast' ? 0 : 150;
  });

  renderCaption('');
  setStatus(false);
})();
