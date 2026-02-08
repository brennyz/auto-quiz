/**
 * Netlify Function: genereert een kort verhaal met verborgen antwoord via Google Gemini 2.0 Flash.
 * API-key staat alleen in Netlify Environment Variables (GEMINI_API_KEY), nooit in code.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const CATEGORIES = ['biologie', 'aardrijkskunde', 'geschiedenis', 'wiskunde', 'dieren', 'algemeen'];

const SYSTEM_PROMPT = `Je bent een verhalenverteller voor een spel in de auto. Je verzin korte verhalen (maximaal 120 woorden) voor niveau middelbare school klas 1. In elk verhaal zit één antwoord verborgen: een ding, dier, getal, plaats of begrip dat de luisteraars moeten raden. Het verhaal moet leuk en spannend zijn om via TTS te horen. Geef je antwoord ALLEEN in dit formaat, verder niets:

VERHAAL:
[hier het verhaal, gewoon lopende tekst]

ANTWOORD:
[hier exact één woord of korte zin, het antwoord dat geraden moet worden]`;

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
  return `Verzin een kort verhaal met een verborgen antwoord. Thema: ${onderwerp}. Het antwoord moet eenduidig te raden zijn (één woord of korte zin).`;
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
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      if (body.category && CATEGORIES.includes(body.category)) category = body.category;
    } catch (e) {}
  } else if (event.queryStringParameters && event.queryStringParameters.category) {
    const c = event.queryStringParameters.category;
    if (CATEGORIES.includes(c)) category = c;
  }

  const prompt = getPrompt(category);

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
            parts: [{ text: SYSTEM_PROMPT + '\n\n' + prompt }]
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
