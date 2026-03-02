import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { nextSetId, createSetDir, readSession, writeSession, BASE, validateSetId } from './lib/set-manager.js';
import { generateContent } from './lib/claude-client.js';
import { buildHtml } from './lib/html-builder.js';
import { captureSet } from './lib/capture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HAS_ANTHROPIC = Boolean(process.env.ANTHROPIC_API_KEY);
if (!HAS_ANTHROPIC) {
  console.warn('⚠️  ANTHROPIC_API_KEY is not set. /api/sets/:id/generate will be unavailable.');
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'output')));

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post('/api/sets', async (req, res) => {
  try {
    const id = await nextSetId();
    await createSetDir(id);
    await writeSession(id, { status: 'created', createdAt: new Date().toISOString() });
    res.json({ id });
  } catch (err) {
    console.error('Error creating set:', err);
    res.status(500).json({ error: '세트 생성 중 오류가 발생했습니다' });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = path.join(BASE, 'input', req.params.id);
      fs.mkdir(dir, { recursive: true })
        .then(() => cb(null, dir))
        .catch((err) => cb(err));
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `temp-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images') {
      const allowed = ['image/jpeg', 'image/png'];
      if (!allowed.includes(file.mimetype)) {
        return cb(new Error('JPEG 또는 PNG 이미지만 업로드 가능합니다'));
      }
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/sets/:id/upload', upload.fields([
  { name: 'images', maxCount: 6 },
  { name: 'text', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    try { validateSetId(id); } catch (e) { return res.status(400).json({ error: '잘못된 세트 ID 입니다' }); }
    
    if (!req.files || !req.files.images) {
      return res.status(400).json({ error: '사진 파일이 필요합니다' });
    }
    
    if (req.files.images.length !== 6) {
      return res.status(400).json({ error: `정확히 6장의 사진이 필요합니다 (현재 ${req.files.images.length}장)` });
    }
    
    const files = req.files.images;
    const finalNames = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const oldPath = file.path;
      const mime = file.mimetype || '';
      const orig = file.originalname || '';
      const matched = orig.match(/photo-(\d+)/i);
      const index = matched ? parseInt(matched[1], 10) : i + 1;
      const ext = mime.includes('png') ? '.png' : '.jpg';
      const newName = `photo-${index}${ext}`;
      const newPath = path.join(BASE, 'input', id, newName);
      await fs.rename(oldPath, newPath);
      finalNames.push(newName);
    }
    
    if (req.files.text && req.files.text[0]) {
      const textPath = path.join(BASE, 'input', id, 'text.md');
      if (req.files.text[0].mimetype === 'text/plain') {
        await fs.rename(req.files.text[0].path, textPath);
      } else {
        await fs.unlink(req.files.text[0].path);
        return res.status(400).json({ error: '텍스트 파일은 일반 텍스트 형식이어야 합니다' });
      }
    } else if (req.body.text) {
      const textPath = path.join(BASE, 'input', id, 'text.md');
      await fs.writeFile(textPath, req.body.text);
    } else {
      return res.status(400).json({ error: '텍스트 내용이 필요합니다' });
    }
    
    const session = await readSession(id);
    session.status = 'uploaded';
    session.uploadedAt = new Date().toISOString();
    await writeSession(id, session);
    
    res.json({
      status: 'uploaded',
      images: finalNames.sort((a, b) => {
        const ai = parseInt(a.match(/photo-(\d+)/)[1], 10) || 0;
        const bi = parseInt(b.match(/photo-(\d+)/)[1], 10) || 0;
        return ai - bi;
      })
    });
  } catch (err) {
    console.error('Error uploading files:', err);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다' });
  }
});

app.post('/api/sets/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    try { validateSetId(id); } catch (e) { return res.status(400).json({ error: '잘못된 세트 ID 입니다' }); }
    if (!HAS_ANTHROPIC) {
      return res.status(503).json({ error: 'AI 키가 설정되지 않아 컨텐츠 생성을 사용할 수 없습니다' });
    }
    const textPath = path.join(BASE, 'input', id, 'text.md');
    
    let text;
    try {
      text = await fs.readFile(textPath, 'utf8');
    } catch (err) {
      return res.status(400).json({ error: '텍스트 파일을 찾을 수 없습니다. 먼저 업로드해주세요.' });
    }
    
    if (text.length > 5000) {
      console.warn(`Text too long (${text.length} chars), truncating to 5000`);
      text = text.substring(0, 5000);
    }
    
    const content = await generateContent(text);
    
    const session = await readSession(id);
    session.status = 'generated';
    session.content = content;
    session.generatedAt = new Date().toISOString();
    await writeSession(id, session);
    
    res.json(content);
  } catch (err) {
    console.error('Error generating content:', err);
    res.status(500).json({ error: '컨텐츠 생성 중 오류가 발생했습니다. 다시 시도해주세요.' });
  }
});

app.get('/api/sets/:id/images/:filename', async (req, res) => {
  try {
    const { id, filename } = req.params;
    try { validateSetId(id); } catch (e) { return res.status(400).json({ error: '잘못된 세트 ID 입니다' }); }
    
    if (!filename.match(/\.(jpeg|jpg|png)$/i)) {
      return res.status(400).json({ error: '잘못된 이미지 형식입니다' });
    }
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: '잘못된 파일명입니다' });
    }
    
    const imagePath = path.join(BASE, 'input', id, filename);
    res.sendFile(imagePath, { root: '/' }, (err) => {
      if (err) {
        res.status(404).json({ error: '이미지를 찾을 수 없습니다' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: '이미지 로딩 중 오류가 발생했습니다' });
  }
});

app.post('/api/sets/:id/build', async (req, res) => {
  try {
    const { id } = req.params;
    try { validateSetId(id); } catch (e) { return res.status(400).json({ error: '잘못된 세트 ID 입니다' }); }
    const session = await readSession(id);
    
    if (!session.content) {
      return res.status(400).json({ error: '컨텐츠가 생성되지 않았습니다. 먼저 생성을 실행해주세요.' });
    }
    
    const files = await buildHtml(id, session.content, 'file');
    
    session.status = 'html_built';
    session.builtAt = new Date().toISOString();
    await writeSession(id, session);
    
    res.json({ status: 'html_built', files });
  } catch (err) {
    console.error('Error building HTML:', err);
    res.status(500).json({ error: 'HTML 생성 중 오류가 발생했습니다' });
  }
});

app.post('/api/sets/:id/capture', async (req, res) => {
  try {
    const { id } = req.params;
    try { validateSetId(id); } catch (e) { return res.status(400).json({ error: '잘못된 세트 ID 입니다' }); }
    
    const files = await captureSet(id);
    
    const session = await readSession(id);
    session.status = 'captured';
    session.capturedAt = new Date().toISOString();
    await writeSession(id, session);
    
    res.json({ status: 'captured', files });
  } catch (err) {
    console.error('Error capturing:', err);
    res.status(500).json({ error: 'PNG 캡처 중 오류가 발생했습니다' });
  }
});

app.get('/api/sets/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    try { validateSetId(id); } catch (e) { return res.status(400).json({ error: '잘못된 세트 ID 입니다' }); }
    const outputDir = path.join(BASE, 'output', id);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="cardnews-${id}.zip"`);
    
    const archive = archiver('zip');
    archive.pipe(res);
    archive.directory(outputDir, false);
    await archive.finalize();
  } catch (err) {
    console.error('Error creating ZIP:', err);
    res.status(500).json({ error: 'ZIP 파일 생성 중 오류가 발생했습니다' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
