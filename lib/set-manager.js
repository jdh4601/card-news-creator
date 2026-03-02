import fs from 'fs/promises';
import path from 'path';

const BASE = process.env.BASE_DIR || process.cwd();

function validateSetId(id) {
  if (!/^\d{4}$/.test(id)) {
    throw new Error(`Invalid set ID format: ${id}. Must be 4 digits.`);
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`Invalid set ID: ${id}. Path traversal detected.`);
  }
}

export async function nextSetId() {
  const inputDir = path.join(BASE, 'input');
  
  try {
    const entries = await fs.readdir(inputDir, { withFileTypes: true });
    const existing = entries
      .filter(d => d.isDirectory() && /^\d{4}$/.test(d.name))
      .map(d => parseInt(d.name, 10))
      .sort((a, b) => b - a);
    
    const next = existing.length > 0 ? existing[0] + 1 : 1;
    return String(next).padStart(4, '0');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return '0001';
    }
    throw err;
  }
}

export async function createSetDir(id) {
  validateSetId(id);
  
  const inputDir = path.join(BASE, 'input', id);
  const outputDir = path.join(BASE, 'output', id);
  
  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  
  return { inputDir, outputDir };
}

export async function readSession(id) {
  validateSetId(id);
  
  const filePath = path.join(BASE, 'input', id, 'session.json');
  
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeSession(id, data) {
  validateSetId(id);
  
  const filePath = path.join(BASE, 'input', id, 'session.json');
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function getImagePaths(id) {
  validateSetId(id);
  
  const dir = path.join(BASE, 'input', id);
  
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter(f => /\.(jpeg|jpg|png)$/i.test(f))
      .sort()
      .map(f => path.join(dir, f));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export { BASE, validateSetId };
