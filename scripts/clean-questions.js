/**
 * Ruimt vragen op: verwijdert vragen met foute antwoorden
 * (adjectieven, losse woorden zoals "nationale" bij "nationele vogel").
 *
 * Gebruik: node scripts/clean-questions.js
 * Leest: public/data/questions.json
 * Schrijft: public/data/questions.json (overschreven)
 */

const fs = require('fs');
const path = require('path');

const QUESTIONS_PATH = path.join(__dirname, '..', 'public', 'data', 'questions.json');

// Antwoorden die geen goed quiz-antwoord zijn (adjectieven, lidwoorden, etc.)
const BAD_ANSWERS = new Set([
  'de', 'het', 'een', 'in', 'ex', 'en', 'of', 'op', 'van', 'tot', 'uit', 'na',
  'nationale', 'internationale', 'international', 'nederlandse', 'europese',
  'amerikaanse', 'britse', 'duitse', 'franse', 'belgische', 'culturele',
  'klinische', 'medische', 'moleculaire', 'experimentele', 'genetische',
  'chemische', 'biochemisch', 'bioanorganische', 'kunstmatige', 'mathematische',
  'bijzondere', 'levend', 'levende', 'andere', 'enkele', 'bepaalde',
  'nieuwe', 'oude', 'grote', 'kleine', 'eerste', 'tweede', 'derde',
  'nationale', 'regionale', 'lokale', 'globale', 'sociale', 'politieke',
  'economische', 'historische', 'geografische', 'natuurkundige', 'scheikundige',
  'data-', 'data', 'copley', 'generatio', 'leon', 'guttule', 'cuvet',
  'biologisch', 'fysisch', 'chemisch', 'electrisch', 'elektrisch',
  'theoretische', 'praktische', 'algemene', 'specifieke', 'moderne',
  'klassieke', 'traditionele', 'officiële', 'publieke', 'private',
  'marine', 'levende', 'bijzondere', 'bioanorganische', 'biochemisch',
  'culturele', 'experimentele', 'genetische', 'kunstmatige', 'mathematische',
  'tropische', 'noordelijke', 'zuidelijke', 'westelijke', 'oostelijke',
  'centrale', 'lokale', 'regionale', 'globale', 'sociale', 'politieke',
  'economische', 'historische', 'geografische', 'natuurkundige', 'scheikundige'
]);

// Antwoorden korter dan dit zijn vaak fout (tenzij getal)
const MIN_ANSWER_LENGTH = 3;

// Antwoorden die alleen cijfers zijn: oké
function isNumeric(s) {
  return /^\d+$/.test(s.replace(/\s/g, ''));
}

// Check of antwoord geen goed quiz-antwoord is (adjectief bij bv. "nationele vogel")
function isBadAnswer(answer, question) {
  const a = answer.toLowerCase().trim();
  if (BAD_ANSWERS.has(a)) return true;
  const q = question.toLowerCase();
  // Vraag over vogel/dier maar antwoord is alleen een bijvoeglijk naamwoord
  if ((q.includes('vogel') || q.includes('dier') || q.includes('dieren') || q.includes('vogels'))) {
    const badBirdAnswers = ['nationale', 'internationale', 'europese', 'nederlandse', 'amerikaanse', 'tropische', 'kleine', 'grote'];
    if (badBirdAnswers.includes(a)) return true;
  }
  // "Wat is een X Y?" waarbij antwoord alleen "X" is en X een adjectief
  const match = question.match(/Wat is (?:een?|de|het)?\s*([^\?]+)\??$/i);
  if (match) {
    const subject = match[1].trim().toLowerCase();
    const firstWord = subject.split(/\s+/)[0] || '';
    if (firstWord && a === firstWord && BAD_ANSWERS.has(firstWord)) return true;
  }
  return false;
}

function clean(questions) {
  const seen = new Set();
  const out = [];

  for (const q of questions) {
    const question = q.question_nl || '';
    const answer = (q.answer_nl || '').trim().toLowerCase();

    if (!question || !answer) continue;
    if (seen.has(question)) continue;
    if (answer.length < MIN_ANSWER_LENGTH && !isNumeric(answer)) continue;
    if (BAD_ANSWERS.has(answer)) continue;
    if (isBadAnswer(answer, question)) continue;

    seen.add(question);
    out.push(q);
  }

  return out;
}

function main() {
  const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : (data.questions || data.items || []);

  const before = list.length;
  const cleaned = clean(list);
  const removed = before - cleaned.length;

  fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(cleaned, null, 2), 'utf8');
  console.log('Opgeschoond: ' + before + ' -> ' + cleaned.length + ' vragen (' + removed + ' verwijderd).');
}

main();
