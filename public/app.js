(function () {
  'use strict';

  var appConfig = {
    questions_per_round: 10,
    wait_music_volume: 0.5,
    wait_music_duck_volume: 0.12,
    tts_speed: 0.9
  };

  var screens = {
    start: document.getElementById('screen-start'),
    loading: document.getElementById('screen-loading'),
    question: document.getElementById('screen-question'),
    feedback: document.getElementById('screen-feedback'),
    end: document.getElementById('screen-end')
  };
  var btnStart5 = document.getElementById('btn-start-5');
  var btnStart10 = document.getElementById('btn-start-10');
  var btnStart15 = document.getElementById('btn-start-15');
  var btnNext = document.getElementById('btn-next');
  var btnSkipTts = document.getElementById('btn-skip-tts');
  var btnRestart = document.getElementById('btn-restart');
  var questionText = document.getElementById('question-text');
  var countdownEl = document.getElementById('countdown');
  var feedbackResult = document.getElementById('feedback-result');
  var feedbackAnswer = document.getElementById('feedback-answer');
  var scoreText = document.getElementById('score-text');
  var progressText = document.getElementById('progress-text');
  var audioCountdown = document.getElementById('audio-countdown');

  var storiesPerRound = 10;
  var currentIndex = 0;
  var score = 0;
  var currentStory = null;
  var storySkipped = false;
  var recognition = null;
  var micPermissionGranted = false;

  // --- Wachtmuziek: altijd aan, duck bij stem/countdown ---
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
      if (waitMusicBuffer) {
        resolve();
        return;
      }
      var ctx = getAudioContext();
      if (!ctx) {
        resolve();
        return;
      }
      fetch('sounds/wait-music.wav')
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) { return ctx.decodeAudioData(buf); })
        .then(function (buffer) {
          waitMusicBuffer = buffer;
          resolve();
        })
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
      recognition.onend = function () {
        if (!resolved) done();
      };
      recognition.onerror = function () {
        if (!resolved) done();
      };
      try {
        recognition.start();
      } catch (err) {
        resolve([]);
        return;
      }
      setTimeout(function () {
        if (!resolved) done();
      }, timeoutMs || 10000);
    });
  }

  function normalizeAnswer(s) {
    if (!s || typeof s !== 'string') return '';
    var t = s.replace(/\s+/g, ' ').replace(/[.,!?]/g, '').toLowerCase().trim();
    var articles = /^(het|de|een|deze|dit|dat|die)\s+/i;
    t = t.replace(articles, '').trim();
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
    var i, j, t, tmp;
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

  var STORY_CATEGORIES = ['biologie', 'aardrijkskunde', 'geschiedenis', 'wiskunde', 'dieren', 'algemeen'];

  function getFallbackStory() {
    return {
      story: 'Er was eens een klein dier met acht poten dat een web spon. Het leefde in een hoek van de schuur. Welk dier was het?',
      answer: 'spin'
    };
  }

  function fetchStory(category) {
    var base = typeof location !== 'undefined' && location.origin ? location.origin : '';
    var url = base + '/.netlify/functions/generate-story';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: category || STORY_CATEGORIES[Math.floor(Math.random() * STORY_CATEGORIES.length)] })
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

  function startQuiz() {
    showScreen('loading');
    countdownEl.textContent = '';
    unlockCountdownAudio();

    resumeAudioContext()
      .then(function () { return requestMicrophonePermission(); })
      .then(function () { return loadWaitMusic(); })
      .then(function () {
        currentIndex = 0;
        score = 0;
        startWaitMusicContinuous();
        showScreen('question');
        nextStory();
      })
      .catch(function () {
        currentIndex = 0;
        score = 0;
        startWaitMusicContinuous();
        showScreen('question');
        nextStory();
      });
  }

  function updateProgress() {
    if (!progressText) return;
    progressText.textContent = 'Verhaal ' + (currentIndex + 1) + ' van ' + storiesPerRound + ' · Score: ' + score;
    progressText.hidden = false;
  }

  function runAfterStoryTTS(s) {
    if (btnSkipTts) btnSkipTts.hidden = true;
    stopSpeaking();
    countdownEl.textContent = '3… 2… 1…';
    playCountdownAudio().then(function () {
      restoreWaitMusic();
      countdownEl.textContent = 'Antwoord!';
      countdownEl.setAttribute('aria-live', 'polite');
      if (countdownEl.classList) countdownEl.classList.add('listening');
      var listeningLabel = setTimeout(function () {
        countdownEl.textContent = 'Luisteren…';
      }, 1500);
      listenForAnswer(10000).then(function (answers) {
        clearTimeout(listeningLabel);
        countdownEl.classList.remove('listening');
        countdownEl.textContent = '';
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
        if (someoneCorrect) score++;
        showFeedback(someoneCorrect, s.answer, answers.length);
      });
    });
  }

  function nextStory() {
    storySkipped = false;
    if (currentIndex >= storiesPerRound) {
      stopWaitMusic();
      endRound();
      return;
    }
    updateProgress();
    questionText.textContent = 'Verhaal laden…';
    countdownEl.textContent = '';
    if (btnSkipTts) btnSkipTts.hidden = true;

    var category = STORY_CATEGORIES[Math.floor(Math.random() * STORY_CATEGORIES.length)];
    fetchStory(category).then(function (s) {
      currentStory = s;
      questionText.textContent = s.story;
      countdownEl.textContent = '';
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
    }).catch(function () {
      currentStory = getFallbackStory();
      questionText.textContent = currentStory.story;
      if (btnSkipTts) {
        btnSkipTts.hidden = false;
        btnSkipTts.onclick = function () {
          storySkipped = true;
          runAfterStoryTTS(currentStory);
        };
      }
      duckWaitMusic();
      speak(currentStory.story).then(function () {
        if (storySkipped) return;
        runAfterStoryTTS(currentStory);
      });
    });
  }

  function showFeedback(someoneCorrect, answer, answerCount) {
    duckWaitMusic();
    showScreen('feedback');
    updateProgress();
    if (btnNext && btnNext.focus) setTimeout(function () { btnNext.focus(); }, 100);
    var ttsText;
    if (someoneCorrect) {
      feedbackResult.textContent = '\u2705 Iemand had het goed!';
      feedbackResult.className = 'feedback-result correct';
      feedbackAnswer.textContent = 'Niet iedereen had het goed, maar iemand wel. Het antwoord is namelijk ' + answer + '.';
      ttsText = 'Niet iedereen had het goed, maar iemand wel. Het antwoord is namelijk ' + answer + '.';
    } else {
      feedbackResult.textContent = '\u274C Niemand had het goed';
      feedbackResult.className = 'feedback-result incorrect';
      if (answerCount === 0) {
        feedbackAnswer.textContent = 'We hoorden geen antwoord. Het is namelijk ' + answer + '.';
        ttsText = 'We hoorden geen antwoord. Het is namelijk ' + answer + '.';
      } else {
        feedbackAnswer.textContent = 'Niemand had het juiste antwoord. Het is namelijk ' + answer + '.';
        ttsText = 'Niemand had het juiste antwoord. Het is namelijk ' + answer + '.';
      }
    }
    speak(ttsText).then(function () {
      restoreWaitMusic();
    });
  }

  function toNext() {
    stopSpeaking();
    currentIndex++;
    showScreen('question');
    nextStory();
  }

  function endRound() {
    if (progressText) progressText.hidden = true;
    showScreen('end');
    scoreText.textContent = 'Je had ' + score + ' van de ' + storiesPerRound + ' goed.';
    speak('Ronde afgerond. Je had ' + score + ' van de ' + storiesPerRound + ' goed.');
    if (btnRestart && btnRestart.focus) setTimeout(function () { btnRestart.focus(); }, 100);
  }

  function init() {
    if (btnStart5) btnStart5.addEventListener('click', function () { storiesPerRound = 5; startQuiz(); });
    if (btnStart10) btnStart10.addEventListener('click', function () { storiesPerRound = 10; startQuiz(); });
    if (btnStart15) btnStart15.addEventListener('click', function () { storiesPerRound = 15; startQuiz(); });
    if (btnNext) btnNext.addEventListener('click', toNext);
    if (btnRestart) btnRestart.addEventListener('click', function () {
      if (progressText) progressText.hidden = true;
      showScreen('start');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
