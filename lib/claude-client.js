import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Kimi (Moonshot) API settings
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const MODEL = process.env.KIMI_MODEL || 'moonshot-v1-8k';

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateContent(text, retryCount = 0) {
  const maxRetries = 2;
  const promptPath = path.join(process.cwd(), 'prompts', 'content-generation.md');
  
  let systemPrompt;
  try {
    systemPrompt = await fs.readFile(promptPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read prompt template: ${err.message}`);
  }
  
  try {
    // Call Kimi (Moonshot) chat-completions API
    const resp = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `다음 원문을 바탕으로 카드뉴스 컨텐츠를 생성해주세요:\n\n${text}` }
        ],
        temperature: 0.7
      })
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const err = new Error(`Kimi API error: ${resp.status} ${resp.statusText}`);
      err.status = resp.status;
      err.body = body;
      throw err;
    }

    const data = await resp.json();
    const contentText = data?.choices?.[0]?.message?.content || '';
    let content;
    
    try {
      // 1) ```json fenced block 우선 추출
      const fenced = contentText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced && fenced[1]) {
        content = JSON.parse(fenced[1]);
      } else {
        // 2) 중괄호 블록 추출 시도
        const jsonMatch = contentText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          content = JSON.parse(jsonMatch[0]);
        } else {
          // 3) 전체를 JSON으로 시도
          content = JSON.parse(contentText);
        }
      }
    } catch (parseErr) {
      const err = new Error(`Failed to parse API response as JSON: ${parseErr.message}`);
      err.code = 'PARSE_FAILED';
      // include a small snippet for debugging (non-sensitive)
      try { err.snippet = String(contentText || '').slice(0, 300); } catch {}
      throw err;
    }
    
    try {
      const validated = ContentSchema.parse(content);
      return validated;
    } catch (zodErr) {
      const err = new Error(`Content validation failed: ${zodErr.message}`);
      err.code = 'VALIDATION_FAILED';
      // expose structured zod issues for callers to present helpful messages
      err.details = zodErr.issues || undefined;
      throw err;
    }
    
  } catch (err) {
    if (retryCount < maxRetries) {
      await sleep(1000 * (retryCount + 1));
      return generateContent(text, retryCount + 1);
    }
    throw err;
  }
}
