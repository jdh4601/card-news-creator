#!/usr/bin/env node
/**
 * output/{ID}/*.html → output/{ID}/*.png 캡처
 * 사용법: node scripts/capture.mjs [세트ID]
 * 예시: node scripts/capture.mjs 0001
 *
 * prompt-pass: 캡처 결과를 컨텍스트에 붙이지 않고 경로만 출력
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';

async function captureCards(setNum) {
  const outDir = `output/${setNum}`;

  if (!existsSync(outDir)) {
    console.error(`❌ 오류: ${outDir} 폴더가 없습니다.`);
    console.error('   build-card-html 스킬을 먼저 실행하세요.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2  // 2160×2700px Retina 출력
  });
  const page = await context.newPage();

  const cards = ['card-01', 'card-02', 'card-03', 'card-04', 'card-05', 'card-06'];
  const saved = [];

  console.log(`📸 캡처 시작: ${outDir}/`);

  try {
    for (const name of cards) {
      const htmlPath = resolve(`${outDir}/${name}.html`);
      const pngPath = `${outDir}/${name}.png`;

      if (!existsSync(htmlPath)) {
        console.warn(`⚠️  건너뜀: ${name}.html 없음`);
        continue;
      }

      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // 폰트 + 배경 이미지 로딩 대기

      const card = page.locator('.card-container');
      await card.screenshot({ path: pngPath });
      console.log(`   ✅ ${name}.png`);
      saved.push(pngPath);
    }

    console.log('\n✅ 캡처 완료');
    console.log('📁 PROMPT-PASS 출력 경로:');
    saved.forEach(p => console.log(`   ${resolve(p)}`));
  } finally {
    await browser.close();
  }
}

const setNum = process.argv[2] || '0001';
captureCards(setNum).catch(err => {
  console.error(`\n❌ 오류: ${err.message}`);
  process.exit(1);
});
