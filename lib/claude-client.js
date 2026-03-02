import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `다음 원문을 바탕으로 카드뉴스 컨텐츠를 생성해주세요:\n\n${text}`
      }]
    });
    
    const contentText = response.content[0].text;
    let content;
    
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        content = JSON.parse(contentText);
      }
    } catch (parseErr) {
      throw new Error(`Failed to parse API response as JSON: ${parseErr.message}`);
    }
    
    const validated = ContentSchema.parse(content);
    return validated;
    
  } catch (err) {
    if (retryCount < maxRetries) {
      await sleep(1000 * (retryCount + 1));
      return generateContent(text, retryCount + 1);
    }
    throw err;
  }
}
