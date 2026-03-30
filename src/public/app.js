// ── Bootstrap ────────────────────────────────────────────────

let currentAuthRoleUserId = null;
let currentFsRoleUserId = null;

const FS_ROLES = ['STUDENT', 'TEACHER', 'TUTOR', 'PROJECTMANAGER', 'SCHOOLDIRECTOR', 'MODERATOR', 'ADMIN'];

async function bootstrap() {
  const res = await fetch('/api/me');
  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }
  const me = await res.json();
  document.getElementById('user-email').textContent = me.email;

  // Show service badges
  document.getElementById('auth-service-badge').textContent =
    me.services.authService ? 'verbunden' : 'nicht verbunden';
  document.getElementById('auth-service-badge').className =
    'badge ' + (me.services.authService ? 'ok' : 'warn');

  document.getElementById('freeschool-badge').textContent =
    me.services.freeSchool ? 'verbunden' : 'nicht verbunden';
  document.getElementById('freeschool-badge').className =
    'badge ' + (me.services.freeSchool ? 'ok' : 'warn');

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('section-' + btn.dataset.section).classList.add('active');
    });
  });

  // Tab switching (scoped to parent section)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.section');
      section.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      section.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // Auto-load first tab data
  if (me.services.authService) loadAuthUsers();
  if (me.services.freeSchool) loadFsUsers();

  // Load settings when that section is opened
  document.querySelector('[data-section="settings"]').addEventListener('click', loadSettings);
}

// ── Helpers ──────────────────────────────────────────────────

function renderError(el, msg) {
  el.innerHTML = `<p class="error">${msg}</p>`;
}

function roles2pills(roles) {
  if (!roles || !roles.length) return '<span class="muted">–</span>';
  return roles.map(r => `<span class="role-pill">${r}</span>`).join('');
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('session expired');
  }
  return res;
}

// ── AuthService — Users ───────────────────────────────────────

async function loadAuthUsers() {
  const el = document.getElementById('auth-users-table');
  el.innerHTML = '<p class="loading-text">Lade Benutzer…</p>';
  try {
    const res = await apiFetch('/api/auth-service/admin/users');
    const data = await res.json();
    const users = data.users ?? data;
    renderAuthUsersTable(users);
  } catch (err) {
    if (err.message !== 'session expired') renderError(el, 'Fehler: ' + err.message);
  }
}

function renderAuthUsersTable(users) {
  const el = document.getElementById('auth-users-table');
  if (!users.length) { el.innerHTML = '<p class="loading-text">Keine Benutzer gefunden.</p>'; return; }

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>ID</th><th>E-Mail</th><th>Rollen</th><th>E-Mail bestätigt</th><th>Letzter Login</th><th></th>
      </tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td><code>${u.id ?? '–'}</code></td>
            <td>${u.email}</td>
            <td>${roles2pills(u.roles)}</td>
            <td><span class="badge ${u.is_email_verify ? 'ok' : 'warn'}">${u.is_email_verify ? 'ja' : 'nein'}</span></td>
            <td>${u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : '–'}</td>
            <td>
              <button class="btn-ghost" onclick="openAuthRolePanel('${u.id}','${u.email}','${(u.roles??[]).join(',')}')">
                Rollen
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function openAuthRolePanel(id, email, rolesStr) {
  currentAuthRoleUserId = id;
  document.getElementById('auth-role-user-email').textContent = email;
  document.getElementById('auth-role-input').value = rolesStr;
  document.getElementById('auth-role-panel').classList.remove('hidden');
}

function closeAuthRolePanel() {
  document.getElementById('auth-role-panel').classList.add('hidden');
  currentAuthRoleUserId = null;
}

async function saveAuthRoles() {
  if (!currentAuthRoleUserId) return;
  const rolesRaw = document.getElementById('auth-role-input').value;
  const roles = rolesRaw.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);

  const res = await apiFetch('/api/auth-service/admin/set_roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentAuthRoleUserId, roles }),
  });

  if (res.ok) {
    closeAuthRolePanel();
    loadAuthUsers();
  } else {
    const d = await res.json();
    alert('Fehler: ' + (d.detail ?? JSON.stringify(d)));
  }
}

async function importAuthUsers(input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch('/api/auth-service/admin/users/import', { method: 'POST', body: form });
  const d = await res.json();
  alert(`Import: ${d.created ?? 0} erstellt, ${d.updated ?? 0} aktualisiert, ${d.skipped ?? 0} übersprungen`);
  loadAuthUsers();
}

// ── AuthService — JWT ─────────────────────────────────────────

async function loadJwtKeyStorage() {
  const el = document.getElementById('jwt-key-info');
  el.textContent = 'Lade…';
  try {
    const res = await apiFetch('/api/auth-service/admin/jwt/key-storage');
    const d = await res.json();
    el.textContent = JSON.stringify(d, null, 2);
  } catch (err) {
    if (err.message !== 'session expired') el.textContent = 'Fehler: ' + err.message;
  }
}

// ── FreeSchool — Users ────────────────────────────────────────

async function loadFsUsers() {
  const el = document.getElementById('fs-users-table');
  el.innerHTML = '<p class="loading-text">Lade Benutzer…</p>';
  try {
    const res = await apiFetch('/api/freeschool/admin/users');
    const users = await res.json();
    renderFsUsersTable(users);
  } catch (err) {
    if (err.message !== 'session expired') renderError(el, 'Fehler: ' + err.message);
  }
}

function renderFsUsersTable(users) {
  const el = document.getElementById('fs-users-table');
  if (!users.length) { el.innerHTML = '<p class="loading-text">Keine Benutzer gefunden.</p>'; return; }

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>ID</th><th>E-Mail</th><th>Rollen</th><th>E-Mail bestätigt</th><th>Letzter Login</th><th></th>
      </tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td><code>${u.id ?? '–'}</code></td>
            <td>${u.email}</td>
            <td>${roles2pills(u.roles)}</td>
            <td><span class="badge ${u.email_verify ? 'ok' : 'warn'}">${u.email_verify ? 'ja' : 'nein'}</span></td>
            <td>${u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : '–'}</td>
            <td>
              <button class="btn-ghost" onclick="openFsRolePanel('${u.id}','${u.email}',${JSON.stringify(u.roles??[])})">
                Rollen
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function openFsRolePanel(id, email, currentRoles) {
  currentFsRoleUserId = id;
  document.getElementById('fs-role-user-email').textContent = email;
  const container = document.getElementById('fs-role-checkboxes');
  container.innerHTML = FS_ROLES.map(r => `
    <label>
      <input type="checkbox" value="${r}" ${currentRoles.includes(r) ? 'checked' : ''} />
      ${r}
    </label>`).join('');
  document.getElementById('fs-role-panel').classList.remove('hidden');
}

function closeFsRolePanel() {
  document.getElementById('fs-role-panel').classList.add('hidden');
  currentFsRoleUserId = null;
}

async function saveFsRoles() {
  if (!currentFsRoleUserId) return;
  const roles = [...document.querySelectorAll('#fs-role-checkboxes input:checked')]
    .map(cb => cb.value);

  const res = await apiFetch(`/api/freeschool/admin/user/${currentFsRoleUserId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roles }),
  });

  if (res.ok) {
    closeFsRolePanel();
    loadFsUsers();
  } else {
    const d = await res.json();
    alert('Fehler: ' + (d.detail ?? JSON.stringify(d)));
  }
}

// ── FreeSchool — Backup ───────────────────────────────────────

async function downloadFsBackupJson() {
  window.open('/api/freeschool/admin/backup/json', '_blank');
}

async function downloadFsBackupSql() {
  window.open('/api/freeschool/admin/backup', '_blank');
}

// ── Migration ─────────────────────────────────────────────────

async function previewMigration() {
  const el = document.getElementById('migration-preview');
  el.innerHTML = '<p class="loading-text">Lade Vorschau…</p>';
  document.getElementById('run-migration-btn').disabled = true;

  try {
    const res = await apiFetch('/api/migration/preview');
    const d = await res.json();

    if (!res.ok) {
      renderError(el, d.error ?? 'Fehler');
      return;
    }

    el.innerHTML = `
      <div class="migration-info">
        <p><strong>${d.count}</strong> Benutzer werden migriert.</p>
        <p class="warn-text">${d.warning}</p>
      </div>
      <table>
        <thead><tr><th>E-Mail</th><th>Rollen</th><th>Kommentar</th></tr></thead>
        <tbody>
          ${d.users.slice(0, 50).map(u => `
            <tr>
              <td>${u.email}</td>
              <td>${roles2pills(u.roles)}</td>
              <td><small>${u.comment ?? ''}</small></td>
            </tr>`).join('')}
          ${d.users.length > 50 ? `<tr><td colspan="3" style="color:var(--muted)">… und ${d.users.length - 50} weitere</td></tr>` : ''}
        </tbody>
      </table>`;

    document.getElementById('run-migration-btn').disabled = false;
  } catch (err) {
    if (err.message !== 'session expired') renderError(el, 'Fehler: ' + err.message);
  }
}

async function runMigration() {
  if (!confirm(`Migration jetzt ausführen? Dies kann nicht rückgängig gemacht werden.`)) return;

  const btn = document.getElementById('run-migration-btn');
  const el = document.getElementById('migration-result');
  btn.disabled = true;
  el.innerHTML = '<p class="loading-text">Migration läuft…</p>';

  try {
    const res = await apiFetch('/api/migration/run', { method: 'POST' });
    const d = await res.json();

    if (res.ok) {
      el.innerHTML = `
        <div class="migration-info">
          <p>✓ Migration abgeschlossen</p>
          <p>Erstellt: <strong>${d.created ?? '?'}</strong> &nbsp;
             Aktualisiert: <strong>${d.updated ?? '?'}</strong> &nbsp;
             Übersprungen: <strong>${d.skipped ?? '?'}</strong></p>
          ${d.skipped_reasons?.length ? `<pre class="code-block">${JSON.stringify(d.skipped_reasons, null, 2)}</pre>` : ''}
        </div>`;
    } else {
      renderError(el, d.error ?? d.detail ?? 'Migration fehlgeschlagen');
      btn.disabled = false;
    }
  } catch (err) {
    if (err.message !== 'session expired') renderError(el, 'Fehler: ' + err.message);
    btn.disabled = false;
  }
}

// ── Einstellungen — Servergruppen ─────────────────────────────

let editingGroupName = null; // null = neue Gruppe, string = bearbeiten

async function loadSettings() {
  const res = await apiFetch('/api/config');
  const cfg = await res.json();
  renderServerGroups(cfg.groups, cfg.activeGroup);
}

function renderServerGroups(groups, activeGroup) {
  const el = document.getElementById('server-groups-list');
  if (!groups.length) { el.innerHTML = '<p class="loading-text">Keine Gruppen.</p>'; return; }

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Aktiv</th><th>Name</th><th>AuthService URL</th><th>FreeSchool URL</th><th></th>
      </tr></thead>
      <tbody>
        ${groups.map(g => `
          <tr class="${g.name === activeGroup ? 'row-active' : ''}">
            <td>
              ${g.name === activeGroup
                ? '<span class="badge ok">aktiv</span>'
                : `<button class="btn-ghost" onclick="activateGroup('${g.name}')">Aktivieren</button>`}
            </td>
            <td><strong>${g.name}</strong></td>
            <td><code class="url-cell">${g.authServiceUrl || '–'}</code></td>
            <td><code class="url-cell">${g.freeSchoolUrl || '–'}</code></td>
            <td style="white-space:nowrap">
              <button class="btn-ghost" onclick="editGroup('${g.name}')">Bearbeiten</button>
              ${g.name !== activeGroup
                ? `<button class="btn-ghost danger-ghost" onclick="deleteGroup('${g.name}')">Löschen</button>`
                : ''}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function activateGroup(name) {
  const res = await apiFetch('/api/config/active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    loadSettings();
  } else {
    const d = await res.json();
    alert('Fehler: ' + (d.error ?? 'Unbekannt'));
  }
}

async function deleteGroup(name) {
  if (!confirm(`Gruppe "${name}" wirklich löschen?`)) return;
  const res = await apiFetch(`/api/config/groups/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (res.ok) {
    loadSettings();
  } else {
    const d = await res.json();
    alert('Fehler: ' + (d.error ?? 'Unbekannt'));
  }
}

function editGroup(name) {
  const rows = document.querySelectorAll('#server-groups-list tbody tr');
  // find matching group data from the table (re-fetch to be safe)
  apiFetch('/api/config').then(r => r.json()).then(cfg => {
    const g = cfg.groups.find(g => g.name === name);
    if (!g) return;
    editingGroupName = name;
    document.getElementById('group-form-title').textContent = `Gruppe bearbeiten: ${name}`;
    document.getElementById('gf-name').value = g.name;
    document.getElementById('gf-auth-url').value = g.authServiceUrl;
    document.getElementById('gf-fs-url').value = g.freeSchoolUrl;
    document.getElementById('group-form-error').classList.add('hidden');
    document.getElementById('group-form-panel').scrollIntoView({ behavior: 'smooth' });
  });
}

function resetGroupForm() {
  editingGroupName = null;
  document.getElementById('group-form-title').textContent = 'Neue Gruppe';
  document.getElementById('gf-name').value = '';
  document.getElementById('gf-auth-url').value = '';
  document.getElementById('gf-fs-url').value = '';
  document.getElementById('group-form-error').classList.add('hidden');
}

async function saveGroup() {
  const name = document.getElementById('gf-name').value.trim();
  const authServiceUrl = document.getElementById('gf-auth-url').value.trim();
  const freeSchoolUrl = document.getElementById('gf-fs-url').value.trim();
  const errEl = document.getElementById('group-form-error');

  if (!name || !authServiceUrl || !freeSchoolUrl) {
    errEl.textContent = 'Alle Felder sind erforderlich.';
    errEl.classList.remove('hidden');
    return;
  }

  const res = await apiFetch('/api/config/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, authServiceUrl, freeSchoolUrl }),
  });

  if (res.ok) {
    resetGroupForm();
    loadSettings();
  } else {
    const d = await res.json();
    errEl.textContent = d.error ?? 'Fehler beim Speichern';
    errEl.classList.remove('hidden');
  }
}

// ── Start ────────────────────────────────────────────────────

bootstrap();
