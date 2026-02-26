(function () {
  'use strict';

  var appConfig = {
    questions_per_round: 10,
    wait_music_volume: 0.5,
    wait_music_duck_volume: 0.12,
    tts_speed: 0.9
  };

  var UNLOCK_CODE = '2';

  var screens, btnStart5, btnStart10, btnStart15, btnNext, btnSkipTts, btnRestart;
  var questionText, countdownEl, feedbackResult, feedbackAnswer, scoreText, progressText;
  var audioCountdown, bonusBadge, progressBarWrap, progressBarFill;
  var streakIndicator, streakCount, scorePop, feedbackIcon, micIndicator;
  var endIcon, endTitle, endStats, highScoreMsg, hintText, confettiCanvas;

  var storiesPerRound = 10;
  var storyMode = 'klas1';
  var storyVak = 'biologie';
  var currentIndex = 0;
  var score = 0;
  var bonusIndex = 0;
  var streak = 0;
  var maxStreak = 0;
  var correctCount = 0;
  var bonusPoints = 0;
  var currentStory = null;
  var storySkipped = false;
  var recognition = null;
  var micPermissionGranted = false;

  var audioCtx = null;
  var waitMusicBuffer = null;
  var waitMusicSource = null;
  var waitMusicGain = null;

  function getAudioContext() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function resumeAudioContext() {
    var ctx = getAudioContext();
    if (!ctx) return Promise.resolve();
    if (ctx.state === 'suspended') return ctx.resume().catch(function () {});
    return Promise.resolve();
  }

  function unlockCountdownAudio() {
    if (!audioCountdown || !audioCountdown.play) return;
    var p = audioCountdown.play();
    if (p && p.then) p.then(function () { audioCountdown.pause(); audioCountdown.currentTime = 0; }).catch(function () {});
    else audioCountdown.pause();
    audioCountdown.currentTime = 0;
  }

  function loadWaitMusic() {
    return new Promise(function (resolve) {
      if (waitMusicBuffer) { resolve(); return; }
      var ctx = getAudioContext();
      if (!ctx) { resolve(); return; }
      fetch('sounds/wait-music.wav')
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) { return ctx.decodeAudioData(buf); })
        .then(function (buffer) { waitMusicBuffer = buffer; resolve(); })
        .catch(function () { resolve(); });
    });
  }

  function startWaitMusicContinuous() {
    resumeAudioContext();
    if (!waitMusicBuffer) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    if (waitMusicSource) {
      try { waitMusicSource.stop(); } catch (e) {}
      waitMusicSource = null;
    }
    var source = ctx.createBufferSource();
    source.buffer = waitMusicBuffer;
    source.loop = true;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    gain.gain.linearRampToValueAtTime(appConfig.wait_music_volume || 0.5, ctx.currentTime + 0.8);
    waitMusicSource = source;
    waitMusicGain = gain;
  }

  function duckWaitMusic() {
    if (!waitMusicGain) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    waitMusicGain.gain.cancelScheduledValues(now);
    waitMusicGain.gain.setValueAtTime(waitMusicGain.gain.value, now);
    waitMusicGain.gain.linearRampToValueAtTime(appConfig.wait_music_duck_volume || 0.12, now + 0.2);
  }

  function restoreWaitMusic() {
    if (!waitMusicGain) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    waitMusicGain.gain.cancelScheduledValues(now);
    waitMusicGain.gain.setValueAtTime(waitMusicGain.gain.value, now);
    waitMusicGain.gain.linearRampToValueAtTime(appConfig.wait_music_volume || 0.5, now + 0.3);
  }

  function stopWaitMusic() {
    if (!waitMusicSource) return;
    try { waitMusicSource.stop(); } catch (e) {}
    waitMusicSource = null;
    waitMusicGain = null;
  }

  function showScreen(id) {
    var k;
    for (k in screens) {
      if (!screens[k] || !screens[k].classList) continue;
      screens[k].classList.toggle('active', k === id);
    }
  }

  function speak(text, rate) {
    if (!window.speechSynthesis) return Promise.resolve();
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'nl-NL';
      u.rate = rate || appConfig.tts_speed || 0.9;
      u.onend = resolve;
      u.onerror = resolve;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function playCountdownAudio() {
    return new Promise(function (resolve) {
      if (!audioCountdown || !audioCountdown.src) {
        setTimeout(resolve, 4000);
        return;
      }
      audioCountdown.currentTime = 0;
      audioCountdown.onended = function () {
        audioCountdown.onended = null;
        resolve();
      };
      audioCountdown.play().catch(function () {
        setTimeout(resolve, 4000);
      });
      setTimeout(resolve, 4500);
    });
  }

  function requestMicrophonePermission() {
    if (micPermissionGranted) return Promise.resolve(true);
    return new Promise(function (resolve) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resolve(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          micPermissionGranted = true;
          if (!recognition) recognition = initSpeechRecognition();
          resolve(true);
        })
        .catch(function () { resolve(false); });
    });
  }

  function initSpeechRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'nl-NL';
    return r;
  }

  function listenForAnswer(timeoutMs) {
    return new Promise(function (resolve) {
      if (!recognition) recognition = initSpeechRecognition();
      if (!recognition) {
        setTimeout(function () { resolve([]); }, timeoutMs || 8000);
        return;
      }
      var collected = [];
      var resolved = false;
      var done = function () {
        if (resolved) return;
        resolved = true;
        try { recognition.stop(); } catch (e) {}
        try { recognition.abort(); } catch (e) {}
        resolve(collected);
      };
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = function (e) {
        var i, r, t;
        for (i = 0; i < e.results.length; i++) {
          r = e.results[i];
          if (r.isFinal && r.length > 0) {
            t = (r[0].transcript || '').trim().toLowerCase();
            if (t) collected.push(t);
          }
        }
      };
      recognition.onend = function () { if (!resolved) done(); };
      recognition.onerror = function () { if (!resolved) done(); };
      try {
        recognition.start();
      } catch (err) {
        resolve([]);
        return;
      }
      setTimeout(function () { if (!resolved) done(); }, timeoutMs || 10000);
    });
  }

  function normalizeAnswer(s) {
    if (!s || typeof s !== 'string') return '';
    var t = s.replace(/\s+/g, ' ').replace(/[.,!?]/g, '').toLowerCase().trim();
    var articles = /^(het|de|een|deze|dit|dat|die|'t)\s*/i;
    var prev;
    do {
      prev = t;
      t = t.replace(articles, '').trim();
    } while (t !== prev && t.length > 0);
    return t;
  }

  function isCorrect(userAnswer, correctAnswer) {
    if (!userAnswer) return false;
    var u = normalizeAnswer(userAnswer);
    var c = normalizeAnswer(correctAnswer);
    if (!u || !c) return false;
    if (u === c) return true;
    if (u.indexOf(c) !== -1 || c.indexOf(u) !== -1) return true;
    var uWords = u.split(/\s+/);
    var cWords = c.split(/\s+/);
    var lastU = uWords[uWords.length - 1];
    var lastC = cWords[cWords.length - 1];
    if (lastU === lastC) return true;
    if (uWords.indexOf(c) !== -1 || cWords.indexOf(u) !== -1) return true;
    return false;
  }

  function cryptoShuffle(arr) {
    var a = arr.slice();
    var i, j, t;
    var buf = new Uint32Array(1);
    for (i = a.length - 1; i > 0; i--) {
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(buf);
        j = buf[0] % (i + 1);
      } else {
        j = Math.floor(Math.random() * (i + 1));
      }
      t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  var FALLBACK_STORIES = [
    { story: 'Er was eens een klein dier met acht poten dat een web spon. Het leefde in een hoek van de schuur. Welk dier was het?', answer: 'spin' },
    { story: 'Dit grote land ligt voor een groot deel in Azi\u00eb. De hoofdstad is Moskou. Welk land?', answer: 'Rusland' },
    { story: 'Een getal. Als je het deelt door 2 heb je 5. Welk getal?', answer: 'tien' },
    { story: 'Dit orgaan in je lichaam pompt bloed rond. Welk orgaan?', answer: 'hart' },
    { story: 'Een zoogdier dat in de zee leeft en heel groot kan worden. Welk dier?', answer: 'walvis' },
    { story: 'Deze stad staat bekend om de Eiffeltoren. Welke stad?', answer: 'Parijs' }
  ];
  var FALLBACK_STORIES_DIEREN = [
    { story: 'Er was eens een klein dier met acht poten dat een web spon. Het leefde in een hoek van de schuur. Welk dier was het?', answer: 'spin' },
    { story: 'Een zoogdier dat in de zee leeft en heel groot kan worden. Welk dier?', answer: 'walvis' },
    { story: 'Dit roofdier heeft een oranje vacht en zwarte strepen. Welk dier?', answer: 'tijger' },
    { story: 'Een vogel die niet kan vliegen en op de Zuidpool leeft. Welk dier?', answer: 'pingu\u00efn' },
    { story: 'Een groot grijs dier met een slurf. Welk dier?', answer: 'olifant' },
    { story: 'Een dier dat honing maakt en in een korf woont. Welk dier?', answer: 'bij' }
  ];

  function getFallbackStory() {
    if (storyMode === 'groep7') {
      return FALLBACK_STORIES_DIEREN[Math.floor(Math.random() * FALLBACK_STORIES_DIEREN.length)];
    }
    return FALLBACK_STORIES[Math.floor(Math.random() * FALLBACK_STORIES.length)];
  }

  function fetchStory(category) {
    var base = typeof location !== 'undefined' && location.origin ? location.origin : '';
    var url = base + '/.netlify/functions/generate-story';
    var cat = category || storyVak;
    var body = { category: cat, mode: storyMode };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('API error')); })
      .then(function (data) {
        if (data.story && data.answer) return { story: data.story, answer: data.answer };
        return Promise.reject(new Error('Invalid response'));
      })
      .catch(function () {
        return getFallbackStory();
      });
  }

  // --- Progress bar ---
  function updateProgress() {
    if (!progressText || !progressBarWrap || !progressBarFill) return;
    var pct = storiesPerRound > 0 ? ((currentIndex) / storiesPerRound) * 100 : 0;
    progressBarFill.style.width = Math.min(pct, 100) + '%';
    progressText.innerHTML =
      '<span>Verhaal ' + (currentIndex + 1) + '/' + storiesPerRound + '</span>' +
      '<span>Score: ' + score + '</span>';
    progressBarWrap.hidden = false;
  }

  // --- Streak display ---
  function updateStreakDisplay() {
    if (!streakIndicator || !streakCount) return;
    if (streak >= 2) {
      streakCount.textContent = streak + 'x streak!';
      streakIndicator.hidden = false;
    } else {
      streakIndicator.hidden = true;
    }
  }

  // --- Confetti ---
  function launchConfetti() {
    if (!confettiCanvas) return;
    var ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    var particles = [];
    var colors = ['#f472b6', '#c084fc', '#34d399', '#fbbf24', '#60a5fa', '#f87171'];
    var count = 80;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * 200,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        life: 1
      });
    }

    var startTime = Date.now();
    var duration = 2500;

    function draw() {
      var elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        return;
      }
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      var fade = Math.max(0, 1 - (elapsed - duration * 0.6) / (duration * 0.4));
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  function miniConfetti() {
    if (!confettiCanvas) return;
    var ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    var particles = [];
    var colors = ['#34d399', '#fbbf24', '#c084fc'];
    var cx = confettiCanvas.width / 2;
    var cy = confettiCanvas.height / 2 - 50;
    for (var i = 0; i < 20; i++) {
      var angle = (Math.random() * Math.PI * 2);
      var speed = 2 + Math.random() * 4;
      particles.push({
        x: cx, y: cy,
        w: 3 + Math.random() * 4,
        h: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1
      });
    }

    var startTime = Date.now();
    var duration = 1000;

    function draw() {
      var elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        return;
      }
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      var t = elapsed / duration;
      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // --- High score ---
  function getHighScoreKey() {
    return 'hs_' + storyMode + '_' + storyVak + '_' + storiesPerRound;
  }

  function getHighScore() {
    try {
      var val = localStorage.getItem(getHighScoreKey());
      return val ? parseInt(val, 10) : 0;
    } catch (e) { return 0; }
  }

  function setHighScore(s) {
    try { localStorage.setItem(getHighScoreKey(), String(s)); } catch (e) {}
  }

  function startQuiz() {
    showScreen('loading');
    if (countdownEl) countdownEl.textContent = '';
    unlockCountdownAudio();

    resumeAudioContext()
      .then(function () { return requestMicrophonePermission(); })
      .then(function () { return loadWaitMusic(); })
      .then(function () {
        beginRound();
      })
      .catch(function () {
        beginRound();
      });
  }

  function beginRound() {
    currentIndex = 0;
    score = 0;
    streak = 0;
    maxStreak = 0;
    correctCount = 0;
    bonusPoints = 0;
    bonusIndex = Math.floor(Math.random() * storiesPerRound);
    startWaitMusicContinuous();
    showScreen('question');
    nextStory();
  }

  function showMicIndicator(visible) {
    if (micIndicator) micIndicator.hidden = !visible;
    if (hintText) hintText.hidden = visible;
  }

  function runAfterStoryTTS(s) {
    if (btnSkipTts) btnSkipTts.hidden = true;
    stopSpeaking();
    restoreWaitMusic();
    if (countdownEl) {
      countdownEl.textContent = 'Antwoord!';
      countdownEl.setAttribute('aria-live', 'polite');
      if (countdownEl.classList) countdownEl.classList.add('listening');
    }
    showMicIndicator(true);
    var listeningLabel = setTimeout(function () {
      if (countdownEl) countdownEl.textContent = '';
    }, 1200);
    listenForAnswer(10000).then(function (answers) {
      clearTimeout(listeningLabel);
      if (countdownEl) {
        countdownEl.classList.remove('listening');
        countdownEl.textContent = '';
      }
      showMicIndicator(false);
      var someoneCorrect = false;
      var i;
      if (Array.isArray(answers) && answers.length > 0) {
        for (i = 0; i < answers.length; i++) {
          if (isCorrect(answers[i], s.answer)) {
            someoneCorrect = true;
            break;
          }
        }
      }
      var isBonus = currentIndex === bonusIndex;
      var earnedPoints = 0;
      if (someoneCorrect) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        correctCount++;
        var base = isBonus ? 2 : 1;
        var combo = streak >= 2 ? streak - 1 : 0;
        earnedPoints = base + combo;
        score += earnedPoints;
        if (isBonus) bonusPoints += 1;
        if (combo > 0) bonusPoints += combo;
      } else {
        streak = 0;
      }
      var comboPoints = someoneCorrect && streak >= 2 ? streak - 1 : 0;
      showFeedback(someoneCorrect, s.answer, answers.length, isBonus, comboPoints, earnedPoints);
    });
  }

  function useStory(s) {
    currentStory = s;
    if (bonusBadge) bonusBadge.hidden = currentIndex !== bonusIndex;
    if (questionText) questionText.textContent = s.story;
    if (countdownEl) countdownEl.textContent = '';
    showMicIndicator(false);
    updateStreakDisplay();
    if (btnSkipTts) {
      btnSkipTts.hidden = false;
      btnSkipTts.onclick = function () {
        storySkipped = true;
        runAfterStoryTTS(s);
      };
    }
    duckWaitMusic();
    speak(s.story).then(function () {
      if (storySkipped) return;
      runAfterStoryTTS(s);
    });
  }

  function isSameStory(a, b) {
    if (!a || !b) return false;
    var sameAnswer = a.answer && b.answer && normalizeAnswer(a.answer) === normalizeAnswer(b.answer);
    var sameStart = a.story && b.story && a.story.slice(0, 80) === b.story.slice(0, 80);
    return sameAnswer || sameStart;
  }

  function nextStory() {
    storySkipped = false;
    if (currentIndex >= storiesPerRound) {
      stopWaitMusic();
      endRound();
      return;
    }
    updateProgress();
    if (questionText) questionText.textContent = 'Verhaal laden\u2026';
    if (countdownEl) countdownEl.textContent = '';
    if (btnSkipTts) btnSkipTts.hidden = true;
    showMicIndicator(false);

    var category = storyVak;

    function tryFetch() {
      return fetchStory(category).then(function (s) {
        if (currentStory && isSameStory(s, currentStory)) return getFallbackStory();
        return s;
      });
    }

    tryFetch().then(function (s) {
      if (currentStory && isSameStory(s, currentStory)) s = getFallbackStory();
      useStory(s);
    }).catch(function () {
      currentStory = getFallbackStory();
      useStory(currentStory);
    });
  }

  function showFeedback(someoneCorrect, answer, answerCount, isBonus, comboPoints, earnedPoints) {
    duckWaitMusic();
    showScreen('feedback');
    updateProgress();
    if (btnNext && btnNext.focus) setTimeout(function () { btnNext.focus(); }, 100);

    var ttsText;
    var extra = [];
    if (someoneCorrect && isBonus) extra.push('Dubbele punten!');
    if (comboPoints > 0) extra.push('Combo! ' + comboPoints + ' extra.');
    var extraLine = extra.length > 0 ? ' ' + extra.join(' ') : '';

    if (someoneCorrect) {
      if (feedbackIcon) feedbackIcon.textContent = '\u2705';
      feedbackResult.textContent = 'Goed!' + extraLine;
      feedbackResult.className = 'feedback-result correct';
      feedbackAnswer.textContent = 'Het antwoord is: ' + answer;
      ttsText = 'Goed! Het antwoord is ' + answer + '.' + extraLine;
      if (scorePop && earnedPoints > 0) {
        scorePop.textContent = '+' + earnedPoints + ' punt' + (earnedPoints > 1 ? 'en' : '');
        scorePop.hidden = false;
      }
      miniConfetti();
    } else {
      if (feedbackIcon) feedbackIcon.textContent = '\u274C';
      feedbackResult.textContent = 'Helaas!';
      feedbackResult.className = 'feedback-result incorrect';
      if (scorePop) scorePop.hidden = true;
      if (answerCount === 0) {
        feedbackAnswer.textContent = 'We hoorden geen antwoord. Het is: ' + answer;
        ttsText = 'We hoorden geen antwoord. Het is ' + answer + '.';
      } else {
        feedbackAnswer.textContent = 'Het juiste antwoord is: ' + answer;
        ttsText = 'Helaas. Het juiste antwoord is ' + answer + '.';
      }
    }
    speak(ttsText).then(function () {
      restoreWaitMusic();
    });
  }

  function toNext() {
    stopSpeaking();
    if (scorePop) scorePop.hidden = true;
    currentIndex++;
    showScreen('question');
    nextStory();
  }

  function endRound() {
    if (progressBarWrap) progressBarWrap.hidden = true;
    showScreen('end');

    var pct = storiesPerRound > 0 ? Math.round((correctCount / storiesPerRound) * 100) : 0;
    var prevHigh = getHighScore();
    var isNewHigh = score > prevHigh && score > 0;
    if (isNewHigh) setHighScore(score);

    var endMsg, ttsMsg, iconText;
    if (pct === 100) {
      iconText = '\uD83C\uDFC6';
      endMsg = 'Kampioen!';
      ttsMsg = 'Kampioen! Alles goed. ' + score + ' punten.';
    } else if (pct >= 80) {
      iconText = '\u2B50';
      endMsg = 'Goed gedaan!';
      ttsMsg = 'Goed gedaan. ' + score + ' punten.';
    } else if (pct >= 50) {
      iconText = '\uD83D\uDC4D';
      endMsg = 'Niet slecht!';
      ttsMsg = 'Ronde afgerond. ' + score + ' punten.';
    } else {
      iconText = '\uD83D\uDCAA';
      endMsg = 'Volgende keer beter!';
      ttsMsg = 'Ronde afgerond. ' + score + ' punten. Volgende keer beter!';
    }

    if (endIcon) endIcon.textContent = iconText;
    if (endTitle) endTitle.textContent = endMsg;
    if (scoreText) scoreText.textContent = score + ' punten — ' + correctCount + ' van ' + storiesPerRound + ' goed (' + pct + '%)';

    if (endStats) {
      endStats.innerHTML =
        '<div class="stat-card"><span class="stat-value">' + correctCount + '/' + storiesPerRound + '</span><span class="stat-label">Goed</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + maxStreak + 'x</span><span class="stat-label">Beste streak</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + bonusPoints + '</span><span class="stat-label">Bonus punten</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + score + '</span><span class="stat-label">Totaal</span></div>';
    }

    if (highScoreMsg) {
      if (isNewHigh) {
        highScoreMsg.textContent = 'Nieuw record! Vorige: ' + prevHigh;
        highScoreMsg.hidden = false;
      } else if (prevHigh > 0) {
        highScoreMsg.textContent = 'Record: ' + prevHigh + ' punten';
        highScoreMsg.hidden = false;
      } else {
        highScoreMsg.hidden = true;
      }
    }

    if (pct >= 80) launchConfetti();

    speak(ttsMsg);
    if (btnRestart && btnRestart.focus) setTimeout(function () { btnRestart.focus(); }, 100);
  }

  function init() {
    try {
      screens = {
        unlock: document.getElementById('screen-unlock'),
        start: document.getElementById('screen-start'),
        loading: document.getElementById('screen-loading'),
        question: document.getElementById('screen-question'),
        feedback: document.getElementById('screen-feedback'),
        end: document.getElementById('screen-end')
      };

      btnStart5 = document.getElementById('btn-start-5');
      btnStart10 = document.getElementById('btn-start-10');
      btnStart15 = document.getElementById('btn-start-15');
      btnNext = document.getElementById('btn-next');
      btnSkipTts = document.getElementById('btn-skip-tts');
      btnRestart = document.getElementById('btn-restart');
      questionText = document.getElementById('question-text');
      countdownEl = document.getElementById('countdown');
      feedbackResult = document.getElementById('feedback-result');
      feedbackAnswer = document.getElementById('feedback-answer');
      scoreText = document.getElementById('score-text');
      progressText = document.getElementById('progress-text');
      audioCountdown = document.getElementById('audio-countdown');
      bonusBadge = document.getElementById('bonus-badge');
      progressBarWrap = document.getElementById('progress-bar-wrap');
      progressBarFill = document.getElementById('progress-bar-fill');
      streakIndicator = document.getElementById('streak-indicator');
      streakCount = document.getElementById('streak-count');
      scorePop = document.getElementById('score-pop');
      feedbackIcon = document.getElementById('feedback-icon');
      micIndicator = document.getElementById('mic-indicator');
      endIcon = document.getElementById('end-icon');
      endTitle = document.getElementById('end-title');
      endStats = document.getElementById('end-stats');
      highScoreMsg = document.getElementById('high-score-msg');
      hintText = document.getElementById('hint-text');
      confettiCanvas = document.getElementById('confetti-canvas');

      var hasUnlockScreen = screens.unlock != null;

      if (hasUnlockScreen && typeof sessionStorage !== 'undefined' && sessionStorage.getItem('unlocked') === 'true') {
        showScreen('start');
      } else if (hasUnlockScreen) {
        showScreen('unlock');
      } else {
        showScreen('start');
      }

      var unlockForm = document.getElementById('unlock-form');
      var unlockInput = document.getElementById('unlock-input');
      var unlockError = document.getElementById('unlock-error');

      if (unlockForm && unlockInput) {
        unlockForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var val = String(unlockInput.value).trim();
          if (val === UNLOCK_CODE) {
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('unlocked', 'true');
            if (unlockError) unlockError.hidden = true;
            showScreen('start');
          } else {
            if (unlockError) {
              unlockError.hidden = false;
              unlockError.textContent = 'Fout cijfer. Probeer opnieuw.';
            }
          }
        });
      }

      var btnModeKlas1 = document.getElementById('btn-mode-klas1');
      var btnModeGroep7 = document.getElementById('btn-mode-groep7');
      var vakKlas1 = document.getElementById('vak-klas1');
      var vakGroep7 = document.getElementById('vak-groep7');
      var vakLabel = document.getElementById('vak-label');
      var subtitleText = document.getElementById('subtitle-text');

      function setVakDefault(vak) {
        storyVak = vak;
        var all = document.querySelectorAll('.btn-vak');
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle('btn-vak-default', all[i].getAttribute('data-vak') === vak);
        }
      }

      if (btnModeKlas1) {
        btnModeKlas1.addEventListener('click', function () {
          storyMode = 'klas1';
          storyVak = 'biologie';
          btnModeKlas1.classList.add('btn-mode-default');
          if (btnModeGroep7) btnModeGroep7.classList.remove('btn-mode-default');
          if (vakKlas1) vakKlas1.hidden = false;
          if (vakGroep7) vakGroep7.hidden = true;
          if (vakLabel) vakLabel.innerHTML = '<span class="step-num">2</span> Vak (klas 1)';
          if (subtitleText) subtitleText.textContent = 'Klas 1 \u2014 Verhaal met verborgen antwoord, daarna raden';
          setVakDefault('biologie');
        });
      }
      if (btnModeGroep7) {
        btnModeGroep7.addEventListener('click', function () {
          storyMode = 'groep7';
          storyVak = 'dieren';
          btnModeGroep7.classList.add('btn-mode-default');
          if (btnModeKlas1) btnModeKlas1.classList.remove('btn-mode-default');
          if (vakKlas1) vakKlas1.hidden = true;
          if (vakGroep7) vakGroep7.hidden = false;
          if (vakLabel) vakLabel.innerHTML = '<span class="step-num">2</span> Vak (groep 7)';
          if (subtitleText) subtitleText.textContent = 'Groep 7 \u2014 Verhaal met verborgen antwoord, daarna raden';
          setVakDefault('dieren');
        });
      }

      var vakButtons = document.querySelectorAll('.btn-vak[data-vak]');
      for (var j = 0; j < vakButtons.length; j++) {
        vakButtons[j].addEventListener('click', function () {
          setVakDefault(this.getAttribute('data-vak'));
        });
      }
      setVakDefault('biologie');

      if (btnStart5) btnStart5.addEventListener('click', function () { storiesPerRound = 5; startQuiz(); });
      if (btnStart10) btnStart10.addEventListener('click', function () { storiesPerRound = 10; startQuiz(); });
      if (btnStart15) btnStart15.addEventListener('click', function () { storiesPerRound = 15; startQuiz(); });
      if (btnNext) btnNext.addEventListener('click', toNext);
      if (btnRestart) btnRestart.addEventListener('click', function () {
        if (progressBarWrap) progressBarWrap.hidden = true;
        showScreen('start');
      });
    } catch (err) {
      if (screens) showScreen('start');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
