import { z } from 'zod';

// Reuse the same content shape to ensure compatibility
const ContentSchema = z.object({
  title: z.object({
    line1: z.string().min(1).max(15),
    line2: z.string().min(1).max(15),
    line3: z.string().min(1).max(15)
  }),
  pages: z.array(z.object({
    subtitle: z.string().min(1).max(20),
    paragraphs: z.array(z.object({
      sentences: z.array(z.string()).min(1).max(2),
      highlight: z.string().max(45).optional()
    })).min(1).max(3)
  })).length(4)
});

function splitSentences(text) {
  const parts = String(text)
    .replace(/\r/g, ' ')
    .split(/(?<=[.!?]|\n)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function clamp(str, max) {
  const s = String(str || '').trim();
  return s.length <= max ? s : s.slice(0, max);
}

function pickTitleLines(text) {
  const tokens = splitSentences(text).slice(0, 6);
  const [a = '주제 정리', b = '핵심만 간단히', c = '지금부터 시작해요'] = tokens;
  return {
    line1: clamp(a.replace(/[.!?]$/,'') || '주제 정리', 15),
    line2: clamp(b.replace(/[.!?]$/,'') || '핵심만 간단히', 15),
    line3: clamp(c.replace(/[.!?]$/,'') || '지금부터 시작해요', 15)
  };
}

function buildPages(text) {
  const sentences = splitSentences(text);
  // Chunk sentences into 4 groups for 4 pages
  const perPage = Math.max(1, Math.ceil(sentences.length / 4));
  const groups = [0,1,2,3].map(i => sentences.slice(i * perPage, (i + 1) * perPage));

  return groups.map((group, idx) => {
    const safeGroup = group.length ? group : ['내용을 간단히 정리해요.'];
    // Create 1-3 paragraphs, each with 1-2 sentences
    const paras = [];
    let cursor = 0;
    const paraCount = Math.min(3, Math.max(1, Math.ceil(safeGroup.length / 2)));
    for (let p = 0; p < paraCount; p++) {
      const s1 = safeGroup[cursor++] || safeGroup[0];
      const s2 = safeGroup[cursor++] || '';
      const sentencesOut = [s1, s2].filter(Boolean).slice(0, 2).map(s => clamp(s, 60));
      const highlight = sentencesOut[1] || sentencesOut[0] || '';
      paras.push({
        sentences: sentencesOut,
        highlight: clamp(highlight, 45)
      });
    }
    const subtitleSeed = safeGroup[0] || `페이지 ${idx + 2}`;
    return {
      subtitle: clamp(subtitleSeed.replace(/[.!?]$/,''), 20) || `페이지 ${idx + 2}`,
      paragraphs: paras
    };
  });
}

export function generateLocalContent(text) {
  const content = {
    title: pickTitleLines(text),
    pages: buildPages(text)
  };
  // Ensure it matches the schema strictly
  return ContentSchema.parse(content);
}

