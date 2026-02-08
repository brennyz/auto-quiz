(function () {
  'use strict';

  var SUPABASE_URL = window.ENV && window.ENV.SUPABASE_URL ? window.ENV.SUPABASE_URL : '';
  var SUPABASE_ANON_KEY = window.ENV && window.ENV.SUPABASE_ANON_KEY ? window.ENV.SUPABASE_ANON_KEY : '';
  var appConfig = {
    countdown_seconds: 4,
    wait_music_enabled: true,
    wait_music_segment_seconds: 20,
    wait_music_fade_seconds: 1.5,
    tts_speed: 0.9,
    questions_per_round: 10
  };

  var screens = {
    start: document.getElementById('screen-start'),
    loading: document.getElementById('screen-loading'),
    question: document.getElementById('screen-question'),
    feedback: document.getElementById('screen-feedback'),
    end: document.getElementById('screen-end')
  };
  var btnStart = document.getElementById('btn-start');
  var btnNext = document.getElementById('btn-next');
  var btnRestart = document.getElementById('btn-restart');
  var questionText = document.getElementById('question-text');
  var countdownEl = document.getElementById('countdown');
  var feedbackResult = document.getElementById('feedback-result');
  var feedbackAnswer = document.getElementById('feedback-answer');
  var scoreText = document.getElementById('score-text');
  var audioCountdown = document.getElementById('audio-countdown');

  var supabase = null;
  var questions = [];
  var currentIndex = 0;
  var score = 0;
  var countdownTimer = null;
  var recognition = null;
  var micPermissionGranted = false;

  // --- Wachtmuziek: Web Audio, 20s segmenten, fade-in/out ---
  var audioCtx = null;
  var waitMusicBuffer = null;
  var waitMusicSource = null;
  var waitMusicGain = null;
  var waitMusicFadeTimeout = null;
  var waitMusicStopTimeout = null;

  function getAudioContext() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function loadWaitMusic() {
    return new Promise(function (resolve, reject) {
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

  function playWaitMusicSegment() {
    if (!appConfig.wait_music_enabled || !waitMusicBuffer) return;
    var ctx = getAudioContext();
    if (!ctx) return;

    if (waitMusicSource) {
      try { waitMusicSource.stop(); } catch (e) {}
      waitMusicSource = null;
    }
    if (waitMusicFadeTimeout) clearTimeout(waitMusicFadeTimeout);
    if (waitMusicStopTimeout) clearTimeout(waitMusicStopTimeout);

    var duration = waitMusicBuffer.duration;
    var segmentLen = Math.min(appConfig.wait_music_segment_seconds || 20, duration - 1);
    var maxStart = Math.max(0, duration - segmentLen - 0.5);
    var startAt = maxStart > 0 ? Math.random() * maxStart : 0;
    var fadeLen = Math.min(appConfig.wait_music_fade_seconds || 1.5, segmentLen / 4);

    var source = ctx.createBufferSource();
    source.buffer = waitMusicBuffer;
    source.loop = false;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);

    var startTime = ctx.currentTime;
    source.start(startTime, startAt, startAt + segmentLen);

    gain.gain.linearRampToValueAtTime(0.6, startTime + fadeLen);
    gain.gain.setValueAtTime(0.6, startTime + fadeLen);
    var fadeOutStart = startTime + segmentLen - fadeLen;
    gain.gain.setValueAtTime(0.6, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.01, startTime + segmentLen);

    waitMusicSource = source;
    waitMusicGain = gain;
    waitMusicStopTimeout = setTimeout(function () {
      waitMusicSource = null;
      waitMusicGain = null;
    }, (segmentLen + 0.5) * 1000);
  }

  function stopWaitMusic() {
    if (waitMusicFadeTimeout) clearTimeout(waitMusicFadeTimeout);
    if (waitMusicStopTimeout) clearTimeout(waitMusicStopTimeout);
    waitMusicFadeTimeout = null;
    waitMusicStopTimeout = null;
    if (!waitMusicSource) {
      waitMusicGain = null;
      return;
    }
    var ctx = getAudioContext();
    if (!ctx || !waitMusicGain) {
      try { if (waitMusicSource) waitMusicSource.stop(); } catch (e) {}
      waitMusicSource = null;
      waitMusicGain = null;
      return;
    }
    var now = ctx.currentTime;
    waitMusicGain.gain.cancelScheduledValues(now);
    waitMusicGain.gain.setValueAtTime(0.6, now);
    waitMusicGain.gain.linearRampToValueAtTime(0.01, now + 0.8);
    waitMusicFadeTimeout = setTimeout(function () {
      try { if (waitMusicSource) waitMusicSource.stop(); } catch (e) {}
      waitMusicSource = null;
      waitMusicGain = null;
      waitMusicFadeTimeout = null;
    }, 900);
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
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'nl-NL';
    return r;
  }

  function listenForAnswer(timeoutMs) {
    return new Promise(function (resolve) {
      if (!recognition) recognition = initSpeechRecognition();
      if (!recognition) {
        setTimeout(function () { resolve(''); }, timeoutMs || 8000);
        return;
      }
      var resolved = false;
      var done = function (text) {
        if (resolved) return;
        resolved = true;
        try { recognition.stop(); } catch (e) {}
        try { recognition.abort(); } catch (e) {}
        resolve((text || '').trim().toLowerCase());
      };
      recognition.onresult = function (e) {
        var t = e.results[e.results.length - 1][0].transcript;
        done(t);
      };
      recognition.onend = function () {
        if (!resolved) done('');
      };
      recognition.onerror = function () {
        if (!resolved) done('');
      };
      try {
        recognition.start();
      } catch (err) {
        done('');
        return;
      }
      setTimeout(function () {
        if (!resolved) done('');
      }, timeoutMs || 8000);
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

  function loadConfig() {
    if (!supabase) return Promise.resolve();
    return supabase.from('app_config').select('key, value').then(function (r) {
      if (r.data) {
        r.data.forEach(function (row) {
          var v = row.value;
          if (row.key === 'countdown_seconds') appConfig.countdown_seconds = parseInt(v, 10) || 4;
          else if (row.key === 'wait_music_enabled') appConfig.wait_music_enabled = v === true || v === 'true';
          else if (row.key === 'tts_speed') appConfig.tts_speed = parseFloat(v) || 0.9;
          else if (row.key === 'questions_per_round') appConfig.questions_per_round = parseInt(v, 10) || 10;
        });
      }
    }).catch(function () {});
  }

  function loadQuestions() {
    if (!supabase) {
      questions = getFallbackQuestions();
      return Promise.resolve();
    }
    var perRound = Math.min(appConfig.questions_per_round || 10, 50);
    return supabase
      .from('questions')
      .select('id, question_nl, answer_nl, category')
      .limit(500)
      .then(function (r) {
        if (r.data && r.data.length) {
          questions = shuffle(r.data).slice(0, perRound);
        } else {
          questions = shuffle(getFallbackQuestions()).slice(0, perRound);
        }
      })
      .catch(function () {
        questions = shuffle(getFallbackQuestions()).slice(0, perRound);
      });
  }

  function shuffle(arr) {
    var a = arr.slice();
    var i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function getFallbackQuestions() {
    return [
      { question_nl: 'Hoeveel poten heeft een spin?', answer_nl: 'acht' },
      { question_nl: 'Wat is 7 maal 8?', answer_nl: '56' },
      { question_nl: 'Welk orgaan pompt het bloed rond?', answer_nl: 'hart' },
      { question_nl: 'Wat is de hoofdstad van Frankrijk?', answer_nl: 'Parijs' },
      { question_nl: 'Hoeveel graden heeft een rechte hoek?', answer_nl: '90' }
    ];
  }

  function startQuiz() {
    showScreen('loading');
    countdownEl.textContent = '';

    requestMicrophonePermission().then(function () {
      return loadWaitMusic();
    }).then(function () {
      return loadConfig();
    }).then(function () {
      return loadQuestions();
    }).then(function () {
      if (!questions.length) questions = getFallbackQuestions();
      currentIndex = 0;
      score = 0;
      showScreen('question');
      nextQuestion();
    }).catch(function () {
      questions = getFallbackQuestions();
      currentIndex = 0;
      score = 0;
      showScreen('question');
      nextQuestion();
    });
  }

  function nextQuestion() {
    if (currentIndex >= questions.length) {
      stopWaitMusic();
      endRound();
      return;
    }
    var q = questions[currentIndex];
    questionText.textContent = q.question_nl;
    countdownEl.textContent = '';

    speak(q.question_nl).then(function () {
      countdownEl.textContent = '3… 2… 1…';
      return playCountdownAudio();
    }).then(function () {
      countdownEl.textContent = 'Antwoord!';
      playWaitMusicSegment();
      listenForAnswer(10000).then(function (userAnswer) {
        stopWaitMusic();
        var correct = isCorrect(userAnswer, q.answer_nl);
        if (correct) score++;
        showFeedback(correct, q.answer_nl);
      });
    });
  }

  function showFeedback(correct, answer) {
    showScreen('feedback');
    feedbackResult.textContent = correct ? '\u2705 Goed!' : '\u274C Helaas';
    feedbackResult.className = 'feedback-result ' + (correct ? 'correct' : 'incorrect');
    feedbackAnswer.textContent = 'Het antwoord was: ' + answer;
    speak(correct ? 'Goed. Het antwoord was ' + answer : 'Helaas. Het antwoord was ' + answer).then(function () {});
  }

  function toNext() {
    currentIndex++;
    showScreen('question');
    nextQuestion();
  }

  function endRound() {
    showScreen('end');
    scoreText.textContent = 'Je had ' + score + ' van de ' + questions.length + ' goed.';
    speak('Ronde afgerond. Je had ' + score + ' van de ' + questions.length + ' goed.');
  }

  function init() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    btnStart.addEventListener('click', startQuiz);
    btnNext.addEventListener('click', toNext);
    btnRestart.addEventListener('click', function () {
      showScreen('start');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
