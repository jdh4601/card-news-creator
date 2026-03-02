import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { BASE } from './set-manager.js';

export async function captureSet(setId, options = {}) {
  const outputDir = options.outputDir || join(BASE, 'output', setId);
  const waitTime = options.waitTime || 1500;
  
  if (!existsSync(outputDir)) {
    throw new Error(`Output directory not found: ${outputDir}. Build HTML first.`);
  }
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  
  const cards = ['card-01', 'card-02', 'card-03', 'card-04', 'card-05', 'card-06'];
  const saved = [];
  
  try {
    for (const name of cards) {
      const htmlPath = resolve(`${outputDir}/${name}.html`);
      const pngPath = `${outputDir}/${name}.png`;
      
      if (!existsSync(htmlPath)) {
        console.warn(`Skipping: ${name}.html not found`);
        continue;
      }
      
      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(waitTime);
      
      const card = page.locator('.card-container');
      await card.screenshot({ path: pngPath });
      saved.push(pngPath);
    }
    
    return saved;
  } finally {
    await browser.close();
  }
}
