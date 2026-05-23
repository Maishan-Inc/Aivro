const form = document.querySelector('#generateForm');
const resultSection = document.querySelector('#resultSection');
const statusBadge = document.querySelector('#statusBadge');
const jobIdDisplay = document.querySelector('#jobIdDisplay');
const resultBody = document.querySelector('#resultBody');
const resultActions = document.querySelector('#resultActions');
const waitingCount = document.querySelector('#waitingCount');
const runningCount = document.querySelector('#runningCount');

let currentJobId = localStorage.getItem('efi_current_job_id');
let pollTimer = null;

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

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = form.querySelector('#prompt').value.trim();
  if (!prompt) return;

  const payload = {
    prompt,
    size: form.querySelector('#size').value,
    quality: form.querySelector('#quality').value,
    anonymousDeviceId: getDeviceId(),
  };

  setResult('submitting');
  try {
    const data = await api('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
    currentJobId = data.jobId;
    localStorage.setItem('efi_current_job_id', currentJobId);
    showResult('queued', { rank: data.rank });
    startPolling();
  } catch (err) {
    showResult('error', { message: err.message });
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

if (currentJobId) {
  startPolling();
}
