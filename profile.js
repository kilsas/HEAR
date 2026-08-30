(function () {
  const profileRaw = localStorage.getItem('hear_profile');
  const emptyState = document.getElementById('emptyState');
  const profileContent = document.getElementById('profileContent');

  if (!profileRaw) {
    emptyState.style.display = 'block';
    profileContent.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  profileContent.style.display = 'block';

  const p = JSON.parse(profileRaw);

  function metricCard(label, value, subLabel) {
    const v = value === null ? '—' : value + '%';
    const width = value === null ? 0 : value;
    return `
      <div class="metric-card">
        <div class="label">${label}</div>
        <div class="value">${v}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
        <div class="sub">${subLabel}</div>
      </div>`;
  }

  document.getElementById('metricsGrid').innerHTML = [
    metricCard('Sound Detection — Left', p.detectionLeft, `${p.detectionLeft !== null ? Math.round(p.detectionLeft / 20) : 0} of 5 tones detected`),
    metricCard('Sound Detection — Right', p.detectionRight, `${p.detectionRight !== null ? Math.round(p.detectionRight / 20) : 0} of 5 tones detected`),
    metricCard('Sound Localization', p.localization, 'Accuracy identifying direction'),
    metricCard('Speech — Quiet', p.speechQuiet, 'Word-level recognition accuracy'),
    metricCard('Speech — Background Noise', p.speechNoise, 'Word-level recognition accuracy')
  ].join('');

  // ---- narrative insights ----
  const scores = [
    { key: 'detectionLeft', label: 'sounds presented to the left channel', value: p.detectionLeft },
    { key: 'detectionRight', label: 'sounds presented to the right channel', value: p.detectionRight },
    { key: 'localization', label: 'identifying where sounds came from', value: p.localization },
    { key: 'speechQuiet', label: 'speech presented in a quiet environment', value: p.speechQuiet },
    { key: 'speechNoise', label: 'speech presented with background noise', value: p.speechNoise }
  ].filter((s) => s.value !== null);

  const sorted = [...scores].sort((a, b) => b.value - a.value);
  const strongest = sorted.slice(0, 2);
  const weakest = sorted.slice(-2).reverse();

  document.getElementById('strongestText').textContent =
    `You performed consistently well on ${strongest.map((s) => s.label).join(' and ')}.`;
  document.getElementById('challengeText').textContent =
    `Your responses were less consistent for ${weakest.map((s) => s.label).join(' and ')}.`;

  // ---- recommendations, chosen based on lowest scores ----
  const allRecs = {
    speechNoise: { icon: '🔇', title: 'Reduce background noise', body: 'When possible, move conversations to quieter spaces or turn down competing sound sources.' },
    detectionRight: { icon: '🪑', title: 'Choose your position strategically', body: 'Position yourself so your stronger side faces the speaker in group settings.' },
    detectionLeft: { icon: '🪑', title: 'Choose your position strategically', body: 'Position yourself so your stronger side faces the speaker in group settings.' },
    localization: { icon: '👀', title: 'Face the speaker', body: 'Visual information — lip movement, gestures, and expression — can support communication when locating sound is harder.' },
    speechQuiet: { icon: '📝', title: 'Use captions', body: 'For important conversations or instructions, live captions can add clarity even in easy listening conditions.' },
    default: { icon: '📝', title: 'Use captions', body: 'For important conversations or instructions, try HEAR\u2019s Live Hear captioning tool.' }
  };
  const recKeys = weakest.map((s) => s.key);
  if (!recKeys.length) recKeys.push('default');
  const recSet = new Set(recKeys.map((k) => allRecs[k] || allRecs.default));
  recSet.add(allRecs.default);
  document.getElementById('recsGrid').innerHTML = [...recSet].slice(0, 4).map((r) => `
    <div class="rec-card">
      <span class="icon">${r.icon}</span>
      <div><h4>${r.title}</h4><p>${r.body}</p></div>
    </div>
  `).join('');

  // ---- My Profile questionnaire ----
  const situations = ['Classroom', 'Restaurant', 'Group conversation', 'Phone calls', 'Public transportation', 'Meetings', 'Outdoor environments'];
  const helps = ['Captions', 'Facing the speaker', 'Quiet environment', 'Written instructions', 'Repetition', 'Seating position'];

  function renderCheckGroup(el, items, storeKey) {
    const saved = JSON.parse(localStorage.getItem(storeKey) || '[]');
    el.innerHTML = items.map((item) => `
      <li data-item="${item}" class="${saved.includes(item) ? 'checked' : ''}" style="cursor:pointer;">
        ${item}
      </li>`).join('');
    el.querySelectorAll('li').forEach((li) => {
      if (saved.includes(li.dataset.item)) li.style.setProperty('--checked', '1');
      li.addEventListener('click', () => {
        li.classList.toggle('checked');
        const current = [...el.querySelectorAll('li.checked')].map((x) => x.dataset.item);
        localStorage.setItem(storeKey, JSON.stringify(current));
        renderAccessibilitySummary();
      });
    });
  }

  const situationsEl = document.getElementById('situationsList');
  const helpsEl = document.getElementById('helpsList');
  renderCheckGroup(situationsEl, situations, 'hear_situations');
  renderCheckGroup(helpsEl, helps, 'hear_helps');

  function renderAccessibilitySummary() {
    const sits = JSON.parse(localStorage.getItem('hear_situations') || '[]');
    const summaryEl = document.getElementById('accessSummary');
    if (!sits.length) {
      summaryEl.textContent = 'Select the situations above to see a personalized summary.';
      return;
    }
    const list = sits.length > 1 ? sits.slice(0, -1).join(', ') + ' and ' + sits[sits.length - 1] : sits[0];
    summaryEl.textContent = `Your responses suggest that ${list.toLowerCase()} ${sits.length > 1 ? 'are' : 'is'} among your biggest communication challenges.`;
  }
  renderAccessibilitySummary();
})();
