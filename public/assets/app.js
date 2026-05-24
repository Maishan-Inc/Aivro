const form = document.querySelector('#generateForm');
const resultSection = document.querySelector('#resultSection');
const statusBadge = document.querySelector('#statusBadge');
const jobIdDisplay = document.querySelector('#jobIdDisplay');
const resultBody = document.querySelector('#resultBody');
const resultActions = document.querySelector('#resultActions');
const waitingCount = document.querySelector('#waitingCount');
const runningCount = document.querySelector('#runningCount');
const modelSelect = document.querySelector('#modelSelect');
const sizeSelect = document.querySelector('#size');
const qualitySelect = document.querySelector('#quality');

let currentJobId = localStorage.getItem('efi_current_job_id');
let pollTimer = null;
let captchaConfig = { enabled: false, provider: 'none', siteKey: '' };
let captchaWidgetId = null;
let modelsData = [];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message || 'Request failed');
  return json.data;
}

function getDeviceId() {
  let id = localStorage.getItem('efi_device_id');
  if (!id) {
    id = `dev_${crypto.randomUUID()}`;
    localStorage.setItem('efi_device_id', id);
  }
  return id;
}

async function loadModels() {
  try {
    const data = await api('/api/config/models');
    modelsData = data.models || [];
    if (!modelSelect) return;
    modelSelect.innerHTML = '';
    if (modelsData.length === 0) {
      modelSelect.innerHTML = '<option value="">暂无可用模型</option>';
      return;
    }
    for (const m of modelsData) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.displayName;
      if (m.isDefault) opt.selected = true;
      modelSelect.appendChild(opt);
    }
    updateSizeQualityOptions();
  } catch { /* models optional on load */ }
}

function updateSizeQualityOptions() {
  if (!modelSelect || !sizeSelect || !qualitySelect) return;
  const selectedId = modelSelect.value;
  const model = modelsData.find((m) => m.id === selectedId);
  if (!model) return;

  const currentSize = sizeSelect.value;
  const currentQuality = qualitySelect.value;

  sizeSelect.innerHTML = '';
  for (const s of model.supportedSizes) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s.replace('x', ' × ');
    if (s === currentSize || s === model.defaultSize) opt.selected = true;
    sizeSelect.appendChild(opt);
  }

  qualitySelect.innerHTML = '';
  for (const q of model.supportedQualities) {
    const opt = document.createElement('option');
    opt.value = q;
    opt.textContent = q;
    if (q === currentQuality || q === model.defaultQuality) opt.selected = true;
    qualitySelect.appendChild(opt);
  }
}

if (modelSelect) {
  modelSelect.addEventListener('change', updateSizeQualityOptions);
}

async function initCaptcha() {
  try {
    const config = await api('/api/config/public');
    const enabled = config.CAPTCHA_ENABLED === 'true';
    const provider = (config.CAPTCHA_PROVIDER || 'none').toLowerCase();
    const siteKey = config.CAPTCHA_SITE_KEY || '';
    if (!enabled || provider === 'none' || !siteKey) return;
    captchaConfig = { enabled: true, provider, siteKey };

    const container = document.querySelector('#captchaWidget');
    if (!container) return;

    if (provider === 'turnstile') {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onCaptchaLoad&render=explicit';
      script.async = true;
      document.head.appendChild(script);
      window.onCaptchaLoad = () => {
        captchaWidgetId = window.turnstile.render(container, { sitekey: siteKey, theme: 'light' });
      };
    } else if (provider === 'hcaptcha') {
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onCaptchaLoad&render=explicit';
      script.async = true;
      document.head.appendChild(script);
      window.onCaptchaLoad = () => {
        captchaWidgetId = window.hcaptcha.render(container, { sitekey: siteKey, theme: 'light' });
      };
    }
  } catch { /* captcha optional */ }
}

function getCaptchaToken() {
  if (!captchaConfig.enabled) return undefined;
  if (captchaConfig.provider === 'turnstile' && window.turnstile) {
    return window.turnstile.getResponse(captchaWidgetId) || undefined;
  }
  if (captchaConfig.provider === 'hcaptcha' && window.hcaptcha) {
    return window.hcaptcha.getResponse(captchaWidgetId) || undefined;
  }
  return undefined;
}

function resetCaptcha() {
  if (!captchaConfig.enabled) return;
  if (captchaConfig.provider === 'turnstile' && window.turnstile) {
    window.turnstile.reset(captchaWidgetId);
  } else if (captchaConfig.provider === 'hcaptcha' && window.hcaptcha) {
    window.hcaptcha.reset(captchaWidgetId);
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = form.querySelector('#prompt').value.trim();
  if (!prompt) return;

  const captchaToken = getCaptchaToken();
  if (captchaConfig.enabled && !captchaToken) {
    showResult('error', { message: '请完成人机验证。' });
    return;
  }

  const payload = {
    prompt,
    size: form.querySelector('#size').value,
    quality: form.querySelector('#quality').value,
    modelId: modelSelect ? modelSelect.value : undefined,
    anonymousDeviceId: getDeviceId(),
    captchaToken,
  };

  setResult('submitting');
  try {
    const data = await api('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
    currentJobId = data.jobId;
    localStorage.setItem('efi_current_job_id', currentJobId);
    showResult('queued', { rank: data.rank });
    startPolling();
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('已有一个') || msg.includes('生成中的任务')) {
      showResult('error', { message: '你或当前网络下已有一个生成中的任务，请等其完成。' });
    } else {
      showResult('error', { message: msg });
    }
  } finally {
    resetCaptcha();
  }
});

function startPolling() {
  stopPolling();
  pollJob();
  pollTimer = setInterval(pollJob, 3000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollJob() {
  if (!currentJobId) { stopPolling(); return; }
  try {
    const data = await api(`/api/queue/status/${currentJobId}`);
    const job = data.job || {};
    const mem = data.memoryStatus || {};
    const status = job.status || mem.status || 'queued';

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      stopPolling();
    }

    showResult(status, {
      rank: mem.rank || job.rank,
      ahead: mem.ahead,
      resultKey: job.result_r2_key,
      errorMessage: job.error_message,
    });
  } catch {
    // Silently retry on next interval
  }
}

function setResult(state) {
  resultSection.hidden = false;
  if (state === 'submitting') {
    statusBadge.className = 'badge';
    statusBadge.textContent = '提交中...';
    jobIdDisplay.textContent = '-';
    resultBody.innerHTML = '';
    resultActions.innerHTML = '';
  }
}

function showResult(status, opts = {}) {
  resultSection.hidden = false;
  jobIdDisplay.textContent = currentJobId || '-';

  const labels = { queued: '排队中', running: '生成中', completed: '已完成', failed: '失败', cancelled: '已取消' };
  statusBadge.className = `badge badge--${status}`;
  statusBadge.textContent = labels[status] || status;

  if (status === 'queued') {
    resultBody.innerHTML = `
      <div class="result-waiting">
        <span class="spinner"></span>
        <span>当前排名 #${opts.rank ?? '-'}，前方 ${opts.ahead ?? '-'} 人</span>
      </div>`;
    resultActions.innerHTML = `<button class="btn-secondary" id="cancelBtn">取消任务</button>`;
    document.querySelector('#cancelBtn')?.addEventListener('click', cancelJob);
  } else if (status === 'running') {
    resultBody.innerHTML = `
      <div class="result-waiting">
        <span class="spinner"></span>
        <span>正在生成图片...</span>
      </div>`;
    resultActions.innerHTML = '';
  } else if (status === 'completed' && opts.resultKey) {
    resultBody.innerHTML = `<img class="result-image" src="/api/images/${currentJobId}" alt="Generated image" />`;
    resultActions.innerHTML = `
      <a class="btn-primary" href="/api/images/${currentJobId}" download="image.png">下载图片</a>
      <button class="btn-secondary" id="newJobBtn">生成新图片</button>`;
    document.querySelector('#newJobBtn')?.addEventListener('click', clearJob);
  } else if (status === 'failed') {
    resultBody.innerHTML = `<p class="result-error">${escapeHtml(opts.errorMessage || '生成失败')}</p>`;
    resultActions.innerHTML = `<button class="btn-subtle" id="retryBtn">重新填写</button>`;
    document.querySelector('#retryBtn')?.addEventListener('click', () => {
      clearJob();
      form.querySelector('#prompt')?.focus();
    });
  } else if (status === 'cancelled') {
    resultBody.innerHTML = `<p class="result-error">任务已取消</p>`;
    resultActions.innerHTML = `<button class="btn-subtle" id="newJobBtn2">关闭</button>`;
    document.querySelector('#newJobBtn2')?.addEventListener('click', clearJob);
  } else if (status === 'error') {
    resultBody.innerHTML = `<p class="result-error">${escapeHtml(opts.message || '请求失败')}</p>`;
    resultActions.innerHTML = '';
  } else {
    resultBody.innerHTML = '';
    resultActions.innerHTML = '';
  }
}

async function cancelJob() {
  if (!currentJobId) return;
  try {
    await api(`/api/queue/cancel/${currentJobId}`, { method: 'POST' });
  } catch { /* ignore */ }
  clearJob();
}

function clearJob() {
  currentJobId = null;
  localStorage.removeItem('efi_current_job_id');
  stopPolling();
  resultSection.hidden = true;
}

async function refreshOverview() {
  try {
    const data = await api('/api/queue/overview');
    waitingCount.textContent = data.waiting ?? '--';
    runningCount.textContent = data.running ?? '--';
  } catch {
    waitingCount.textContent = '--';
    runningCount.textContent = '--';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

refreshOverview();
setInterval(refreshOverview, 5000);
loadModels();
initCaptcha();
initAuthUI();

if (currentJobId) {
  startPolling();
}

async function initAuthUI() {
  try {
    const data = await api('/api/auth/me');
    const user = data.user;
    if (!user) return;
    const nav = document.querySelector('#navActions');
    const loginLinuxdo = document.querySelector('#loginLinuxdo');
    const loginGoogle = document.querySelector('#loginGoogle');
    if (loginLinuxdo) loginLinuxdo.style.display = 'none';
    if (loginGoogle) loginGoogle.style.display = 'none';

    const avatar = user.avatarUrl
      ? `<img src="${escapeHtml(user.avatarUrl)}" style="width:28px;height:28px;border-radius:50%;vertical-align:middle" />`
      : '';
    const name = escapeHtml(user.name || user.email || 'User');
    const frag = document.createElement('div');
    frag.style.cssText = 'display:flex;align-items:center;gap:8px';
    frag.innerHTML = `${avatar}<span style="font-size:14px;font-weight:500">${name}</span><button id="logoutBtn" class="btn-subtle" style="font-size:13px;padding:6px 12px">登出</button>`;
    nav.prepend(frag);

    document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      location.reload();
    });
  } catch { /* not logged in */ }
}
