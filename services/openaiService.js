const OpenAI = require('openai');

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

// Accepts a Buffer downloaded from R2 and the original filename (needed for MIME detection)
async function transcribeAudio(buffer, originalFileName) {
  const openai = getClient();
  const { toFile } = require('openai');
  const file = await toFile(buffer, originalFileName);
  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text',
  });
  return transcription;
}

const STRUCTURE_SYSTEM_PROMPT = `You are an expert sermon analyst and theological assistant for a Presbyterian church archive system.

Given a sermon transcript (or document text), extract and structure the content into a clean JSON format.

Return ONLY valid JSON with this exact structure:
{
  "titleSuggestions": ["Title 1", "Title 2", "Title 3"],
  "summary": "A 2–3 sentence summary of the sermon's core message.",
  "sections": [
    {
      "type": "introduction",
      "title": "Opening section title",
      "content": "The content of this section.",
      "scripture": ["John 3:16"]
    },
    {
      "type": "point",
      "title": "Main point title",
      "content": "Main point content.",
      "scripture": ["Romans 8:28", "Psalm 23:1"]
    },
    {
      "type": "conclusion",
      "title": "Closing section title",
      "content": "Concluding thoughts.",
      "scripture": []
    }
  ],
  "keyThemes": ["Grace", "Redemption", "Faith"],
  "keyVerses": ["John 3:16", "Romans 8:28"]
}

Rules:
- titleSuggestions: exactly 3 sermon titles that capture the main message
- sections[].type must be one of: "introduction", "point", "conclusion"
- Extract all Bible verse references accurately (Book Chapter:Verse format)
- keyThemes: 3–7 overarching spiritual/theological themes
- keyVerses: the most important 2–5 verses referenced
- If content is unclear or incomplete, do your best with what is available`;

async function generateSermonStructure(text, userPrompt = '') {
  const openai = getClient();

  const userContent = userPrompt
    ? `Additional context from the uploader: ${userPrompt}\n\n---\n\nSermon transcript:\n\n${text}`
    : `Sermon transcript:\n\n${text}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: STRUCTURE_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
    temperature: 0.3,
  });

  const raw = response.choices[0].message.content;
  return JSON.parse(raw);
}

module.exports = { transcribeAudio, generateSermonStructure };
