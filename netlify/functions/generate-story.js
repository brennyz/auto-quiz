/**
 * Netlify Function: genereert een kort verhaal met verborgen antwoord via Google Gemini 2.0 Flash.
 * API-key staat alleen in Netlify Environment Variables (GEMINI_API_KEY), nooit in code.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const CATEGORIES = ['biologie', 'aardrijkskunde', 'geschiedenis', 'wiskunde', 'dieren', 'algemeen'];

const SYSTEM_PROMPT = `Je bent een verhalenverteller voor een spel in de auto (niveau middelbare school klas 1). Korte verhalen: maximaal 50 woorden. In elk verhaal zit één antwoord verborgen: een ding, dier, getal, plaats of begrip dat de luisteraars moeten raden. Het antwoord moet een bekend, herkenbaar woord zijn — niet vergezocht. Wissel af: soms duidelijke hints (makkelijk te raden), soms iets meer nadenken. Geef je antwoord ALLEEN in dit formaat, verder niets:

VERHAAL:
[hier het verhaal, gewoon lopende tekst]

ANTWOORD:
[hier exact één woord of korte zin, het antwoord dat geraden moet worden]`;

const SYSTEM_PROMPT_GROEP7 = `Je bent een verhalenverteller voor een spel in de auto (niveau basisschool groep 7). Korte verhalen: maximaal 50 woorden. In elk verhaal zit één antwoord verborgen dat de luisteraars moeten raden. Het antwoord moet een bekend, herkenbaar woord zijn — niet vergezocht. Wissel af: soms duidelijke hints (makkelijk te raden), soms iets meer nadenken. Geef je antwoord ALLEEN in dit formaat, verder niets:

VERHAAL:
[hier het verhaal, gewoon lopende tekst]

ANTWOORD:
[hier exact één woord of korte zin, het antwoord dat geraden moet worden]`;

const LENGTH_HINTS = [
  'Schrijf een heel kort verhaal (ongeveer 20–35 woorden).',
  'Schrijf een kort verhaal (ongeveer 25–40 woorden).',
  'Schrijf een verhaal (ongeveer 30–50 woorden, niet langer).'
];

const DIFFICULTY_HINTS = [
  'Het antwoord moet makkelijk te raden zijn: duidelijke hints, bekend begrip.',
  'Het antwoord mag iets lastiger zijn: de luisteraars moeten even nadenken, maar het blijft een bekend woord.'
];

function getPrompt(category) {
  const onderwerpen = {
    biologie: 'onderwerp biologie of natuur (dieren, planten, lichaam, cellen)',
    aardrijkskunde: 'onderwerp aardrijkskunde (landen, steden, rivieren, continenten)',
    geschiedenis: 'onderwerp geschiedenis (een gebeurtenis, persoon of tijdperk)',
    wiskunde: 'onderwerp wiskunde (getal, vorm of begrip)',
    dieren: 'onderwerp dieren',
    algemeen: 'een algemeen onderwerp voor klas 1'
  };
  const onderwerp = onderwerpen[category] || onderwerpen.algemeen;
  const lengthHint = LENGTH_HINTS[Math.floor(Math.random() * LENGTH_HINTS.length)];
  const difficultyHint = DIFFICULTY_HINTS[Math.floor(Math.random() * DIFFICULTY_HINTS.length)];
  return `Verzin een verhaal met een verborgen antwoord. Thema: ${onderwerp}. ${lengthHint} ${difficultyHint} Het antwoord is één woord of korte zin, eenduidig en niet vergezocht.`;
}

const VAKKEN_GROEP7 = {
  dieren: 'alleen over dieren; het antwoord is een dier (zoogdier, vogel, insect, reptiel, enz.)',
  natuur: 'natuur en biologie (dieren, planten, lichaam, leefomgeving); het antwoord past bij groep 7 natuur',
  aardrijkskunde: 'aardrijkskunde (landen, steden, rivieren, continenten, kaart); het antwoord past bij groep 7'
};

function getPromptGroep7(category) {
  const onderwerp = VAKKEN_GROEP7[category] || VAKKEN_GROEP7.dieren;
  const lengthHint = LENGTH_HINTS[Math.floor(Math.random() * LENGTH_HINTS.length)];
  const difficultyHint = DIFFICULTY_HINTS[Math.floor(Math.random() * DIFFICULTY_HINTS.length)];
  return `Verzin een verhaal met een verborgen antwoord. Thema: ${onderwerp}. Niveau groep 7 basisschool. ${lengthHint} ${difficultyHint} Het antwoord is één woord of korte zin, eenduidig en niet vergezocht.`;
}

function parseResponse(text) {
  const storyMatch = text.match(/VERHAAL:\s*([\s\S]*?)(?=ANTWOORD:|$)/i);
  const answerMatch = text.match(/ANTWOORD:\s*([^\n]+)/i);
  const story = (storyMatch && storyMatch[1] ? storyMatch[1].trim() : text.trim()).replace(/\n+/g, ' ');
  const answer = answerMatch && answerMatch[1] ? answerMatch[1].trim() : '';
  return { story: story || text.trim(), answer: answer || '' };
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not set' }) };
  }

  let category = 'algemeen';
  let mode = '';
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      if (body.category) category = body.category;
      if (body.mode === 'groep7' || body.mode === 'dieren-groep7') mode = 'groep7';
    } catch (e) {}
  } else if (event.queryStringParameters && event.queryStringParameters.category) {
    category = event.queryStringParameters.category;
  }

  const useGroep7 = mode === 'groep7';
  const systemPrompt = useGroep7 ? SYSTEM_PROMPT_GROEP7 : SYSTEM_PROMPT;
  const prompt = useGroep7
    ? getPromptGroep7(category)
    : getPrompt(category);

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
          topP: 0.95
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: 'Gemini API error', details: err }) };
    }

    const data = await res.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : '';

    const { story, answer } = parseResponse(text);
    if (!story) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No story in response' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story, answer: answer || '?', category })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', message: err.message })
    };
  }
};
