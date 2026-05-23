async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message || 'Request failed');
  return json.data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function showToast(message, type = 'error') {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.className = `toast toast--${type} visible`;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function fmtTime(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
}

function openModal(id) { document.querySelector(`#${id}`).classList.add('visible'); }
function closeModal(id) { document.querySelector(`#${id}`).classList.remove('visible'); }

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('.modal-backdrop').classList.remove('visible'));
});
document.querySelectorAll('.modal-backdrop').forEach((el) => {
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('visible'); });
});

// Queue controls
document.querySelector('#pauseBtn')?.addEventListener('click', async () => {
  try {
    await api('/api/admin/queue/pause', { method: 'POST' });
    document.querySelector('#queueStatus').textContent = 'paused';
    showToast('队列已暂停', 'success');
  } catch (e) { showToast(e.message); }
});

document.querySelector('#resumeBtn')?.addEventListener('click', async () => {
  try {
    await api('/api/admin/queue/resume', { method: 'POST' });
    document.querySelector('#queueStatus').textContent = 'running';
    showToast('队列已恢复', 'success');
  } catch (e) { showToast(e.message); }
});

// Jobs
async function loadJobs() {
  const container = document.querySelector('#jobsContainer');
  try {
    const data = await api('/api/admin/jobs?limit=50');
    const jobs = data.jobs || [];
    if (!jobs.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无任务</p>'; return; }
    let html = `<table class="data-table"><thead><tr>
      <th></th><th>ID</th><th>用户</th><th>Provider</th><th>Status</th><th>Model</th><th>Created</th>
    </tr></thead><tbody>`;
    for (const j of jobs) {
      const thumb = j.result_r2_key
        ? `<img class="thumb" src="/api/images/${escapeHtml(j.id)}" alt="" loading="lazy" />`
        : '<span class="thumb-placeholder"></span>';
      const user = j.user_name || j.user_email || j.anonymous_device_id?.slice(0, 12) || '-';
      html += `<tr class="row-link" data-job-id="${escapeHtml(j.id)}">
        <td>${thumb}</td>
        <td><code>${escapeHtml(j.id)}</code></td>
        <td>${escapeHtml(user)}</td>
        <td>${escapeHtml(j.provider)}</td>
        <td><span class="badge badge--${j.status}">${j.status}</span></td>
        <td>${escapeHtml(j.model || '-')}</td>
        <td>${fmtTime(j.created_at)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('.row-link').forEach((row) => {
      row.addEventListener('click', () => openJobDetail(row.dataset.jobId));
    });
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

async function openJobDetail(jobId) {
  const body = document.querySelector('#jobModalBody');
  const actions = document.querySelector('#jobModalActions');
  body.innerHTML = '<p style="color:var(--color-mute)">加载中...</p>';
  actions.innerHTML = '';
  openModal('jobModal');
  try {
    const data = await api(`/api/admin/jobs/${jobId}`);
    const j = data.job;
    const events = data.events || [];
    const img = j.result_r2_key ? `<img class="result-image" src="/api/images/${escapeHtml(j.id)}" alt="" style="max-width:320px;margin-bottom:var(--space-lg)" />` : '';
    let html = `${img}
      <p><strong>ID:</strong> <code>${escapeHtml(j.id)}</code></p>
      <p><strong>用户:</strong> ${escapeHtml(j.user_name || j.user_email || '-')} ${j.user_avatar ? `<img src="${escapeHtml(j.user_avatar)}" style="width:20px;height:20px;border-radius:50%;vertical-align:middle" />` : ''}</p>
      <p><strong>Provider:</strong> ${escapeHtml(j.provider)} | <strong>Priority:</strong> ${j.priority}</p>
      <p><strong>Status:</strong> <span class="badge badge--${j.status}">${j.status}</span></p>
      <p><strong>Prompt:</strong> ${escapeHtml(j.prompt?.slice(0, 200))}</p>
      <p><strong>Model:</strong> ${escapeHtml(j.model || '-')} | <strong>Size:</strong> ${escapeHtml(j.size || '-')} | <strong>Quality:</strong> ${escapeHtml(j.quality || '-')}</p>
      <p><strong>Created:</strong> ${fmtTime(j.created_at)} | <strong>Started:</strong> ${fmtTime(j.started_at)} | <strong>Finished:</strong> ${fmtTime(j.finished_at)}</p>`;
    if (j.error_message) html += `<p style="color:var(--color-error)"><strong>Error:</strong> ${escapeHtml(j.error_message)}</p>`;
    if (events.length) {
      html += '<h3 style="margin-top:var(--space-lg)">队列事件</h3><div class="timeline">';
      for (const ev of events) {
        html += `<div class="timeline-item">
          <div class="timeline-time">${fmtTime(ev.created_at)} · ${escapeHtml(ev.event_type)}</div>
          <div class="timeline-message">${escapeHtml(ev.message || '')}</div>
          ${ev.old_rank != null ? `<div class="timeline-rank">#${ev.old_rank} → #${ev.new_rank}</div>` : ''}
        </div>`;
      }
      html += '</div>';
    }
    body.innerHTML = html;
    if (j.status === 'queued' || j.status === 'running') {
      actions.innerHTML = `<button id="cancelJobBtn" class="btn-danger">强制取消</button>`;
      document.querySelector('#cancelJobBtn').addEventListener('click', async () => {
        try {
          await api(`/api/admin/jobs/${jobId}/cancel`, { method: 'POST' });
          showToast('任务已取消', 'success');
          closeModal('jobModal');
          loadJobs();
        } catch (err) { showToast(err.message); }
      });
    }
  } catch (e) {
    body.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

// Users
async function loadUsers(q) {
  const container = document.querySelector('#usersContainer');
  try {
    const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : '/api/admin/users';
    const data = await api(url);
    const users = data.users || [];
    if (!users.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无用户</p>'; return; }
    let html = `<table class="data-table"><thead><tr>
      <th>Email</th><th>Name</th><th>Provider</th><th>Role</th><th>Priority</th><th>Status</th><th>Created</th>
    </tr></thead><tbody>`;
    for (const u of users) {
      html += `<tr class="row-link" data-user-id="${escapeHtml(u.id)}">
        <td>${escapeHtml(u.email || '-')}</td>
        <td>${escapeHtml(u.name || '-')}</td>
        <td>${escapeHtml(u.providers || '-')}</td>
        <td><span class="badge">${u.role}</span></td>
        <td>${u.priority}</td>
        <td>${u.status}</td>
        <td>${fmtTime(u.created_at)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('.row-link').forEach((row) => {
      row.addEventListener('click', () => openUserEdit(row.dataset.userId, users.find((u) => u.id === row.dataset.userId)));
    });
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

function openUserEdit(userId, user) {
  const body = document.querySelector('#userModalBody');
  const actions = document.querySelector('#userModalActions');
  body.innerHTML = `
    <div class="form-grid">
      <label>ID</label><code>${escapeHtml(userId)}</code>
      <label>Email</label><span>${escapeHtml(user?.email || '-')}</span>
      <label>Role</label>
      <select id="editRole" class="text-input">
        <option value="user" ${user?.role === 'user' ? 'selected' : ''}>user</option>
        <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>admin</option>
      </select>
      <label>Priority</label>
      <input id="editPriority" class="text-input" type="number" min="0" max="1000" value="${user?.priority ?? 0}" />
      <label>Status</label>
      <select id="editStatus" class="text-input">
        <option value="active" ${user?.status === 'active' ? 'selected' : ''}>active</option>
        <option value="suspended" ${user?.status === 'suspended' ? 'selected' : ''}>suspended</option>
      </select>
    </div>`;
  actions.innerHTML = `<button id="saveUserBtn" class="btn-primary">保存</button>`;
  openModal('userModal');
  document.querySelector('#saveUserBtn').addEventListener('click', async () => {
    try {
      await api(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          role: document.querySelector('#editRole').value,
          priority: Number(document.querySelector('#editPriority').value),
          status: document.querySelector('#editStatus').value
        })
      });
      showToast('用户已更新', 'success');
      closeModal('userModal');
      loadUsers();
    } catch (err) { showToast(err.message); }
  });
}

document.querySelector('#userSearchBtn')?.addEventListener('click', () => {
  loadUsers(document.querySelector('#userSearch').value.trim());
});
document.querySelector('#userSearch')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadUsers(document.querySelector('#userSearch').value.trim());
});

// Bans
async function loadBans() {
  const container = document.querySelector('#bansContainer');
  try {
    const data = await api('/api/admin/bans');
    const bans = data.bans || [];
    if (!bans.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无封禁</p>'; return; }
    let html = `<table class="data-table"><thead><tr>
      <th>Type</th><th>Value</th><th>Reason</th><th>Created</th><th>操作</th>
    </tr></thead><tbody>`;
    for (const b of bans) {
      html += `<tr>
        <td>${escapeHtml(b.ban_type)}</td>
        <td><code>${escapeHtml(b.ban_value)}</code></td>
        <td>${escapeHtml(b.reason || '-')}</td>
        <td>${fmtTime(b.created_at)}</td>
        <td><button class="btn-subtle" data-unban="${escapeHtml(b.id)}">解除</button></td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('[data-unban]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/api/admin/bans/${btn.dataset.unban}`, { method: 'DELETE' });
          showToast('已解除封禁', 'success');
          loadBans();
        } catch (err) { showToast(err.message); }
      });
    });
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

document.querySelector('#addBanBtn')?.addEventListener('click', () => openModal('banModal'));
document.querySelector('#banSubmitBtn')?.addEventListener('click', async () => {
  const banType = document.querySelector('#banType').value;
  const banValue = document.querySelector('#banValue').value.trim();
  const reason = document.querySelector('#banReason').value.trim();
  if (!banValue) { showToast('封禁目标不能为空'); return; }
  try {
    await api('/api/admin/bans', { method: 'POST', body: JSON.stringify({ banType, banValue, reason: reason || undefined }) });
    showToast('封禁已添加', 'success');
    closeModal('banModal');
    document.querySelector('#banValue').value = '';
    document.querySelector('#banReason').value = '';
    loadBans();
  } catch (err) { showToast(err.message); }
});

// Queue Events
async function loadEvents() {
  const container = document.querySelector('#eventsContainer');
  try {
    const data = await api('/api/admin/queue/events?limit=50');
    const events = data.events || [];
    if (!events.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无事件</p>'; return; }
    let html = `<table class="data-table"><thead><tr>
      <th>Time</th><th>Type</th><th>Job</th><th>User</th><th>Rank</th><th>Message</th>
    </tr></thead><tbody>`;
    for (const ev of events) {
      const rank = ev.old_rank != null ? `#${ev.old_rank} → #${ev.new_rank}` : '-';
      html += `<tr>
        <td>${fmtTime(ev.created_at)}</td>
        <td><span class="badge">${escapeHtml(ev.event_type)}</span></td>
        <td><code>${escapeHtml(ev.job_id?.slice(0, 12))}</code></td>
        <td>${escapeHtml(ev.user_name || ev.user_email || '-')}</td>
        <td>${rank}</td>
        <td>${escapeHtml(ev.message?.slice(0, 60) || '-')}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

// Settings (grouped)
async function loadSettings() {
  const container = document.querySelector('#settingsContainer');
  try {
    const data = await api('/api/admin/settings');
    const settings = data.settings || [];
    if (!settings.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无配置</p>'; return; }
    const groups = {};
    for (const s of settings) {
      const g = s.group_name || 'general';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    let html = '';
    for (const [group, rows] of Object.entries(groups)) {
      html += `<div class="group-section"><div class="group-title">${escapeHtml(group)}</div>`;
      html += `<table class="data-table"><thead><tr><th>Key</th><th>Value</th><th>Public</th></tr></thead><tbody>`;
      for (const row of rows) {
        html += `<tr>
          <td>${escapeHtml(row.key)}</td>
          <td class="editable" data-key="${escapeHtml(row.key)}" data-type="settings">${escapeHtml(row.value)}</td>
          <td>${row.is_public ? 'yes' : 'no'}</td>
        </tr>`;
      }
      html += '</tbody></table></div>';
    }
    container.innerHTML = html;
    bindInlineEdit(container, 'settings');
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

// Secrets
async function loadSecrets() {
  const container = document.querySelector('#secretsContainer');
  try {
    const data = await api('/api/admin/settings');
    const secrets = data.secrets || [];
    if (!secrets.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无密钥</p>'; return; }
    let html = `<table class="data-table"><thead><tr><th>Key</th><th>Masked Value</th><th>操作</th></tr></thead><tbody>`;
    for (const row of secrets) {
      html += `<tr>
        <td>${escapeHtml(row.key)}</td>
        <td>${escapeHtml(row.masked_value || 'configured')}</td>
        <td class="editable" data-key="${escapeHtml(row.key)}" data-type="secrets">点击修改</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    bindInlineEdit(container, 'secrets');
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

// Audit Logs
async function loadAudit() {
  const container = document.querySelector('#auditContainer');
  try {
    const data = await api('/api/admin/audit-logs?limit=50');
    const logs = data.logs || [];
    if (!logs.length) { container.innerHTML = '<p style="color:var(--color-mute)">暂无日志</p>'; return; }
    let html = `<table class="data-table"><thead><tr>
      <th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Old</th><th>New</th>
    </tr></thead><tbody>`;
    for (const l of logs) {
      html += `<tr>
        <td>${fmtTime(l.created_at)}</td>
        <td>${escapeHtml(l.actor_name || l.actor_email || '-')}</td>
        <td>${escapeHtml(l.action)}</td>
        <td>${escapeHtml(l.resource_type)}:${escapeHtml(l.resource_id?.slice(0, 16))}</td>
        <td>${escapeHtml(l.old_value_masked?.slice(0, 30) || '-')}</td>
        <td>${escapeHtml(l.new_value_masked?.slice(0, 30) || '-')}</td>
      </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p style="color:var(--color-error)">${escapeHtml(e.message)}</p>`;
  }
}

// Inline edit helpers
function bindInlineEdit(container, type) {
  container.querySelectorAll('td.editable').forEach((td) => {
    td.addEventListener('click', () => startEdit(td, type));
  });
}

function startEdit(td, type) {
  if (td.querySelector('input')) return;
  const key = td.dataset.key;
  const originalValue = type === 'secrets' ? '' : td.textContent;
  const inputType = type === 'secrets' ? 'password' : 'text';
  td.innerHTML = `<input class="edit-input" type="${inputType}" value="${escapeHtml(originalValue)}" placeholder="${type === 'secrets' ? '输入新密钥值' : ''}" />`;
  const input = td.querySelector('input');
  input.focus();
  input.select();
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') { e.preventDefault(); await saveEdit(td, key, input.value, type); }
    else if (e.key === 'Escape') { cancelEdit(td, originalValue, type); }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (td.querySelector('input')) cancelEdit(td, originalValue, type); }, 150);
  });
}

async function saveEdit(td, key, value, type) {
  try {
    if (type === 'secrets') {
      await api(`/api/admin/secrets/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
      td.textContent = '已更新';
    } else {
      await api(`/api/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
      td.textContent = value;
    }
    td.classList.add('flash-success');
    setTimeout(() => td.classList.remove('flash-success'), 500);
    showToast('保存成功', 'success');
  } catch (e) {
    td.classList.add('flash-error');
    setTimeout(() => td.classList.remove('flash-error'), 500);
    showToast(e.message);
  }
}

function cancelEdit(td, originalValue, type) {
  td.textContent = type === 'secrets' ? '点击修改' : originalValue;
}

// Init
loadJobs();
loadUsers();
loadBans();
loadEvents();
loadSettings();
loadSecrets();
loadAudit();
