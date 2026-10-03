const VALID_SECTION_TYPES = new Set(['introduction', 'point', 'conclusion']);

// Validates + normalizes a raw AI structuring response before it is saved
// to SermonJob.aiResult. Throws a descriptive error on invalid shape so
// the pipeline can mark the job failed with a useful message rather than
// persisting garbage.
function validateSermonStructure(aiResult) {
  if (!aiResult || typeof aiResult !== 'object') {
    throw new Error('AI response was not a JSON object');
  }

  if (!Array.isArray(aiResult.sections) || aiResult.sections.length === 0) {
    throw new Error('AI response is missing a non-empty "sections" array');
  }

  const invalidSection = aiResult.sections.find((s) => !s || typeof s.content !== 'string' || !s.content.trim());
  if (invalidSection) {
    throw new Error('AI response contains a section with no content');
  }

  return {
    titleSuggestions: Array.isArray(aiResult.titleSuggestions)
      ? aiResult.titleSuggestions.filter((t) => typeof t === 'string' && t.trim())
      : [],
    summary: typeof aiResult.summary === 'string' ? aiResult.summary : '',
    sections: aiResult.sections.map((s) => ({
      type: VALID_SECTION_TYPES.has(s.type) ? s.type : 'point',
      title: typeof s.title === 'string' ? s.title : '',
      content: s.content,
      scripture: Array.isArray(s.scripture) ? s.scripture.filter((v) => typeof v === 'string') : [],
    })),
    keyThemes: Array.isArray(aiResult.keyThemes) ? aiResult.keyThemes.filter((t) => typeof t === 'string') : [],
    keyVerses: Array.isArray(aiResult.keyVerses) ? aiResult.keyVerses.filter((v) => typeof v === 'string') : [],
    tags: Array.isArray(aiResult.tags) ? aiResult.tags.filter((t) => typeof t === 'string') : [],
    seriesSuggestion: typeof aiResult.seriesSuggestion === 'string' ? aiResult.seriesSuggestion : '',
  };
}

module.exports = { validateSermonStructure };
