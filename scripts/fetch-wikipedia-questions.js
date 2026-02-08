/**
 * Haalt ~500 quizvragen op uit de Nederlandse Wikipedia.
 * Output: data/wikipedia-questions.json + optioneel SQL voor Supabase.
 *
 * Gebruik: node scripts/fetch-wikipedia-questions.js
 * Vereist: Node 18+ (fetch) of npm install node-fetch
 */

const fs = require('fs');
const path = require('path');

const WIKI_API = 'https://nl.wikipedia.org/w/api.php';
const TARGET = parseInt(process.env.TARGET, 10) || 500;
const PER_CATEGORY = 90;
const DELAY_MS = 200;

const CATEGORIES = [
  { wiki: 'Category:Biologie', app: 'biologie' },
  { wiki: 'Category:Dieren', app: 'dieren' },
  { wiki: 'Category:Wiskunde', app: 'wiskunde' },
  { wiki: 'Category:Aardrijkskunde', app: 'aardrijkskunde' },
  { wiki: 'Category:Geschiedenis', app: 'geschiedenis' },
  { wiki: 'Category:Natuur', app: 'algemeen' },
  { wiki: 'Category:Zoogdieren', app: 'dieren' },
  { wiki: 'Category:Vogels', app: 'dieren' },
  { wiki: 'Category:Planten', app: 'biologie' },
  { wiki: 'Category:Landen', app: 'aardrijkskunde' },
  { wiki: 'Category:Steden', app: 'aardrijkskunde' },
  { wiki: 'Category:Natuurkunde', app: 'algemeen' },
  { wiki: 'Category:Scheikunde', app: 'algemeen' },
  { wiki: 'Category:Taal', app: 'taal' }
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url) {
  return fetch(url, { headers: { 'User-Agent': 'Auto-Quiz/1.0 (nl.wikipedia quiz)' } })
    .then(r => r.json());
}

function getCategoryMembers(categoryTitle, limit, continueToken) {
  let url = WIKI_API + '?action=query&list=categorymembers&cmtitle=' +
    encodeURIComponent(categoryTitle) + '&cmlimit=' + Math.min(limit, 500) +
    '&cmtype=page&format=json&origin=*';
  if (continueToken) url += '&cmcontinue=' + encodeURIComponent(continueToken);
  return fetchJson(url);
}

function getExtracts(pageIds) {
  if (!pageIds.length) return Promise.resolve({});
  const ids = pageIds.join('|');
  const url = WIKI_API + '?action=query&pageids=' + ids +
    '&prop=extracts&exintro&explaintext&exsentences=1&format=json&origin=*';
  return fetchJson(url).then(data => data.query?.pages || {});
}

function simplifyTitle(title) {
  let t = title.trim();
  const paren = t.indexOf('(');
  if (paren > 0) t = t.slice(0, paren).trim();
  const comma = t.indexOf(',');
  if (comma > 0) t = t.slice(0, comma).trim();
  if (t.length > 40) t = t.slice(0, 40).trim();
  return t;
}

function shortAnswer(title) {
  const simplified = simplifyTitle(title);
  const first = simplified.split(/\s+/)[0] || simplified;
  return first.toLowerCase();
}

async function fetchCategoryPages(category, maxItems) {
  const pages = [];
  let cmcontinue = null;
  do {
    const data = await getCategoryMembers(category.wiki, 100, cmcontinue);
    await sleep(DELAY_MS);
    const members = data.query?.categorymembers || [];
    for (const m of members) {
      if (m.ns === 0 && m.title && !m.title.startsWith('Lijst van') && !m.title.includes(' van A tot Z')) {
        pages.push({ pageid: m.pageid, title: m.title });
        if (pages.length >= maxItems) break;
      }
    }
    cmcontinue = data.continue?.cmcontinue || null;
    if (pages.length >= maxItems) break;
  } while (cmcontinue);
  return pages.slice(0, maxItems);
}

async function main() {
  const all = [];
  const seenTitles = new Set();

  for (const cat of CATEGORIES) {
    console.log('Fetching category:', cat.wiki);
    const pages = await fetchCategoryPages(cat, Math.max(PER_CATEGORY, 120));
    const batchSize = 50;
    for (let i = 0; i < pages.length; i += batchSize) {
      const batchPages = pages.slice(i, i + batchSize);
      const batchIds = batchPages.map(p => p.pageid);
      const extracts = await getExtracts(batchIds);
      await sleep(DELAY_MS);
      for (const p of batchPages) {
        if (p.pageid < 0) continue;
        const page = extracts[p.pageid];
        if (!page || !page.title || page.missing) continue;
        const title = page.title;
        if (seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());
        const extract = (page.extract || '').trim();
        if (extract.length > 800) continue;
        const answer = shortAnswer(title);
        if (answer.length < 2) continue;
        all.push({
          category: cat.app,
          question_nl: 'Wat is ' + simplifyTitle(title) + '?',
          answer_nl: answer,
          difficulty: 1,
          source_url: 'https://nl.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/\s/g, '_'))
        });
      }
    }
  }

  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'wikipedia-questions.json');
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2), 'utf8');
  console.log('Written', all.length, 'questions to', jsonPath);

  if (all.length < TARGET) {
    console.log('Filling to', TARGET, 'with random pages...');
    let attempts = 0;
    while (all.length < TARGET && attempts < 100) {
      attempts++;
      const url = WIKI_API + '?action=query&generator=random&grnnamespace=0&grnlimit=50&prop=extracts&exintro&explaintext&exsentences=1&format=json&origin=*';
      const data = await fetchJson(url);
      await sleep(DELAY_MS);
      const pages = data.query?.pages ? Object.values(data.query.pages) : [];
      for (const page of pages) {
        if (!page.title || page.missing) continue;
        const title = page.title;
        if (seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());
        const extract = (page.extract || '').trim();
        if (extract.length > 800) continue;
        const answer = shortAnswer(title);
        if (answer.length < 2) continue;
        const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].app;
        all.push({
          category: cat,
          question_nl: 'Wat is ' + simplifyTitle(title) + '?',
          answer_nl: answer,
          difficulty: 1,
          source_url: 'https://nl.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/\s/g, '_'))
        });
        if (all.length >= TARGET) break;
      }
      if (attempts % 10 === 0) console.log('  ', all.length, '/', TARGET);
    }
  }
  console.log('Total questions:', all.length);

  const sqlPath = path.join(outDir, 'wikipedia-questions.sql');
  const lines = [
    '-- Gegenereerd door scripts/fetch-wikipedia-questions.js',
    '-- Voer uit in Supabase SQL Editor (na de eerste migratie).',
    ''
  ];
  for (const q of all) {
    const qEsc = (q.question_nl || '').replace(/'/g, "''");
    const aEsc = (q.answer_nl || '').replace(/'/g, "''");
    const urlEsc = (q.source_url || '').replace(/'/g, "''");
    lines.push("insert into public.questions (category, question_nl, answer_nl, difficulty, source_url) values ('" +
      q.category + "', '" + qEsc + "', '" + aEsc + "', 1, '" + urlEsc + "');");
  }
  fs.writeFileSync(sqlPath, lines.join('\n'), 'utf8');
  console.log('Written SQL to', sqlPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
