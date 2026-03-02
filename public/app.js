const state = {
  setId: null,
  currentPage: 2,
  photos: [],
  text: '',
  content: null,
  approvedPages: []
};

const screens = {
  upload: document.getElementById('screen-upload'),
  titles: document.getElementById('screen-titles'),
  page: document.getElementById('screen-page'),
  progress: document.getElementById('screen-progress'),
  done: document.getElementById('screen-done')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

function showToast(message, type = 'error') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateProgress(message) {
  const log = document.getElementById('progress-log');
  log.innerHTML += `<p>${message}</p>`;
  log.scrollTop = log.scrollHeight;
}

function setLoading(loading) {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.id !== 'btn-new') {
      btn.disabled = loading;
    }
  });
}

async function apiPost(url, body = null) {
  const options = { method: 'POST' };
  if (body) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
  }
  
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 처리 중 오류가 발생했습니다');
  return data;
}

function initUploadScreen() {
  const slots = document.querySelectorAll('.photo-slot');
  const btnGenerate = document.getElementById('btn-generate');
  const textInput = document.getElementById('text-input');
  
  slots.forEach((slot, index) => {
    const input = slot.querySelector('.photo-input');
    const preview = slot.querySelector('.photo-preview');
    
    slot.addEventListener('click', () => input.click());
    
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('dragover');
    });
    
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('dragover');
    });
    
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handlePhoto(file, index, preview, slot);
      }
    });
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handlePhoto(file, index, preview, slot);
      }
    });
  });
  
  function handlePhoto(file, index, preview, slot) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('JPEG 또는 PNG 형식만 지원합니다');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('파일 크기는 10MB 이하여야 합니다');
      return;
    }
    
    state.photos[index] = file;
    const url = URL.createObjectURL(file);
    preview.style.backgroundImage = `url(${url})`;
    slot.classList.add('filled');
    checkReady();
  }
  
  textInput.addEventListener('input', (e) => {
    state.text = e.target.value;
    checkReady();
  });
  
  function checkReady() {
    const has6Photos = state.photos.filter(p => p).length === 6;
    const hasText = state.text.trim().length > 0;
    btnGenerate.disabled = !(has6Photos && hasText);
  }
  
  btnGenerate.addEventListener('click', startGeneration);
}

async function startGeneration() {
  setLoading(true);
  showScreen('progress');
  document.getElementById('progress-log').innerHTML = '';
  updateProgress('세트 생성 중...');
  
  try {
    const { id } = await apiPost('/api/sets');
    state.setId = id;
    
    updateProgress('파일 업로드 중...');
    const formData = new FormData();
    state.photos.forEach((photo, i) => {
      if (photo) {
        formData.append('images', photo, `photo-${i + 1}.jpg`);
      }
    });
    formData.append('text', state.text);
    
    await apiPost(`/api/sets/${id}/upload`, formData);
    
    updateProgress('AI 컨텐츠 생성 중... (30초~1분 소요)');
    const content = await apiPost(`/api/sets/${id}/generate`);
    state.content = content;
    
    setLoading(false);
    showTitlesScreen();
  } catch (err) {
    setLoading(false);
    showToast(err.message);
    showScreen('upload');
  }
}

function showTitlesScreen() {
  showScreen('titles');
  const list = document.getElementById('titles-list');
  list.innerHTML = '';
  
  const titleOption = document.createElement('div');
  titleOption.className = 'title-option selected';
  titleOption.innerHTML = `
    <h3>${state.content.title.line1}<br>${state.content.title.line2}<br>${state.content.title.line3}</h3>
  `;
  list.appendChild(titleOption);
  
  document.getElementById('btn-back-upload').onclick = () => {
    showScreen('upload');
  };
  
  setTimeout(() => showPageScreen(2), 800);
}

function showPageScreen(pageNum) {
  state.currentPage = pageNum;
  showScreen('page');
  
  const pageData = state.content.pages[pageNum - 2];
  document.getElementById('page-label').textContent = `${pageNum}페이지 검토 (${pageNum - 1}/4)`;
  
  const container = document.getElementById('page-content');
  container.innerHTML = `
    <h3 class="page-subtitle">${escapeHtml(pageData.subtitle)}</h3>
    ${pageData.paragraphs.map(para => `
      <div class="page-paragraph">
        ${para.sentences.map(s => `<p>${escapeHtml(s)}</p>`).join('')}
        ${para.highlight ? `<div class="page-highlight">"${escapeHtml(para.highlight)}"</div>` : ''}
      </div>
    `).join('')}
  `;
  
  const btnApprove = document.getElementById('btn-approve');
  const btnRegenerate = document.getElementById('btn-regenerate');
  
  btnApprove.textContent = pageNum < 5 ? '다음 페이지' : '완료 및 생성';
  btnApprove.onclick = () => approvePage(pageNum);
  btnRegenerate.onclick = () => regeneratePage(pageNum);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function approvePage(pageNum) {
  state.approvedPages.push(pageNum);
  
  if (pageNum < 5) {
    showPageScreen(pageNum + 1);
  } else {
    buildAndCapture();
  }
}

async function regeneratePage(pageNum) {
  showToast('페이지별 재생성은 현재 지원하지 않습니다. 전체 재생성을 원하시면 처음부터 다시 시작해주세요.', 'error');
}

async function buildAndCapture() {
  setLoading(true);
  showScreen('progress');
  document.getElementById('progress-log').innerHTML = '';
  
  try {
    updateProgress('HTML 빌드 중...');
    await apiPost(`/api/sets/${state.setId}/build`);
    
    updateProgress('PNG 캡처 중... (30초~1분 소요)');
    await apiPost(`/api/sets/${state.setId}/capture`);
    
    setLoading(false);
    showDoneScreen();
  } catch (err) {
    setLoading(false);
    showToast(err.message);
    showScreen('page');
  }
}

function showDoneScreen() {
  showScreen('done');
  
  const grid = document.getElementById('preview-grid');
  grid.innerHTML = '';
  
  for (let i = 1; i <= 6; i++) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    const img = document.createElement('img');
    img.src = `/output/${state.setId}/card-0${i}.png`;
    img.alt = `Card ${i}`;
    img.onerror = () => {
      item.innerHTML = '<p style="color:#666;text-align:center;padding:20px">이미지 로딩 실패</p>';
    };
    item.appendChild(img);
    grid.appendChild(item);
  }
  
  document.getElementById('btn-download').onclick = () => {
    window.location.href = `/api/sets/${state.setId}/download`;
  };
  
  document.getElementById('btn-new').onclick = resetApp;
}

function resetApp() {
  state.setId = null;
  state.currentPage = 2;
  state.photos = [];
  state.text = '';
  state.content = null;
  state.approvedPages = [];
  
  document.getElementById('text-input').value = '';
  document.getElementById('progress-log').innerHTML = '';
  
  document.querySelectorAll('.photo-slot').forEach(slot => {
    slot.classList.remove('filled');
    slot.querySelector('.photo-preview').style.backgroundImage = '';
    const input = slot.querySelector('.photo-input');
    if (input) input.value = '';
  });
  
  showScreen('upload');
}

document.addEventListener('DOMContentLoaded', () => {
  initUploadScreen();
});
