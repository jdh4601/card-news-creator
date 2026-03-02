import fs from 'fs/promises';
import path from 'path';
import { BASE } from './set-manager.js';

export async function buildHtml(setId, content, pathMode = 'file') {
  const inputDir = path.join(BASE, 'input', setId);
  const outputDir = path.join(BASE, 'output', setId);
  
  await fs.mkdir(outputDir, { recursive: true });
  
  const images = await getImages(inputDir, setId, pathMode);
  
  const template1 = await fs.readFile(path.join(BASE, 'template_page1.html'), 'utf8');
  const template2 = await fs.readFile(path.join(BASE, 'template_page2to5.html'), 'utf8');
  const template6 = await fs.readFile(path.join(BASE, 'template_page6.html'), 'utf8');
  
  const card1 = buildCard1(template1, images[0], content.title);
  await fs.writeFile(path.join(outputDir, 'card-01.html'), card1);
  
  for (let i = 0; i < 4; i++) {
    const pageNum = i + 2;
    const pageContent = content.pages[i];
    const card = buildCard2to5(template2, images[i + 1], pageContent, pageNum);
    await fs.writeFile(path.join(outputDir, `card-0${pageNum}.html`), card);
  }
  
  const card6 = buildCard6(template6, images[5]);
  await fs.writeFile(path.join(outputDir, 'card-06.html'), card6);
  
  return [
    path.join(outputDir, 'card-01.html'),
    path.join(outputDir, 'card-02.html'),
    path.join(outputDir, 'card-03.html'),
    path.join(outputDir, 'card-04.html'),
    path.join(outputDir, 'card-05.html'),
    path.join(outputDir, 'card-06.html')
  ];
}

async function getImages(inputDir, setId, pathMode) {
  const entries = await fs.readdir(inputDir).catch(() => []);
  const imageFiles = entries
    .filter(f => /\.(jpeg|jpg|png)$/i.test(f))
    .sort();
  
  return imageFiles.map((f, i) => {
    if (pathMode === 'file') {
      return `file://${path.join(inputDir, f)}`;
    } else {
      return `/api/sets/${setId}/images/${f}`;
    }
  });
}

function buildCard1(template, imageUrl, title) {
  const titleHtml = [title.line1, title.line2, title.line3]
    .filter(line => line)
    .join('<br>');
  
  return template
    .replace(/background-image: url\('[^']+'\)/, `background-image: url('${imageUrl}')`)
    .replace(/<h1>[^<]*<\/h1>/, `<h1>${titleHtml}</h1>`);
}

function buildCard2to5(template, imageUrl, page, pageNum) {
  const paragraphsHtml = page.paragraphs.map(para => {
    const sentences = para.sentences
      .map(s => `<p>${s}</p>`)
      .join('\n                ');
    
    const highlight = para.highlight
      ? `\n                <div><span class="highlight">"${para.highlight}"</span></div>`
      : '';
    
    return `\n            <div class="paragraph">\n                ${sentences}${highlight}\n            </div>`;
  }).join('\n');
  
  let result = template
    .replace(/background-image: url\('[^']+'\)/, `background-image: url('${imageUrl}')`)
    .replace(/<h2 class="title">[^<]*<\/h2>/, `<h2 class="title">${page.subtitle}</h2>`);
  
  const contentMatch = result.match(/(<div class="content">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/body>)/);
  if (contentMatch) {
    result = result.replace(
      contentMatch[0],
      `${contentMatch[1]}\n            <h2 class="title">${page.subtitle}</h2>${paragraphsHtml}\n        </div>\n    </div>\n</body>`
    );
  }
  
  return result;
}

function buildCard6(template, imageUrl) {
  return template.replace(/background-image: url\('[^']+'\)/, `background-image: url('${imageUrl}')`);
}
