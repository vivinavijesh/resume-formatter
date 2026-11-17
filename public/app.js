const $ = id => document.getElementById(id);
let jobId = null;

const say = (t, err) => {
  $('status').textContent = t;
  $('status').className = 'status' + (err ? ' err' : '');
};

const api = (p, o) => fetch(p, o).then(async r => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = j.error || (r.status === 404
      ? 'Resume processing is not connected to this site yet. Please contact the site owner.'
      : 'Something went wrong.');
    const error = new Error(message);
    error.status = r.status;
    throw error;
  }
  return j;
});

function showLogin() {
  $('auth').hidden = false;
  $('app').hidden = true;
  $('logout').hidden = true;
  $('authHeading').textContent = 'Sign in';
  $('loginForm').hidden = false;
  $('authStatus').textContent = '';
  $('username').focus();
}

function showApp() {
  $('auth').hidden = true;
  $('app').hidden = false;
  $('logout').hidden = false;
  d.focus();
}

async function loadSession() {
  try {
    const session = await api('/api/session');
    if (session.authenticated) showApp();
    else showLogin();
  } catch (e) {
    $('auth').hidden = false;
    $('app').hidden = true;
    $('logout').hidden = true;
    $('authHeading').textContent = 'Service unavailable';
    $('loginForm').hidden = true;
    $('authStatus').textContent = e.message;
  }
}

function setReady(on) {
  for (const [el, f] of [[$('word'), 'docx'], [$('pdf'), 'pdf']]) {
    el.setAttribute('aria-disabled', on ? 'false' : 'true');
    el.tabIndex = on ? 0 : -1;
    if (on) {
      el.href = '/api/files/' + jobId + '/' + f;
      el.setAttribute('download', '');
      el.setAttribute('role', 'link');
    } else {
      el.removeAttribute('href');
    }
  }

  $('preview').disabled = !on;

  if (on) {
    if ($('dlgPdf')) $('dlgPdf').href = '/api/files/' + jobId + '/pdf';
    if ($('dlgWord')) $('dlgWord').href = '/api/files/' + jobId + '/docx';
    if ($('dlgOpen')) $('dlgOpen').href = '/api/files/' + jobId + '/pdf?inline=1';
  } else {
    if ($('dlgPdf')) $('dlgPdf').removeAttribute('href');
    if ($('dlgWord')) $('dlgWord').removeAttribute('href');
    if ($('dlgOpen')) $('dlgOpen').removeAttribute('href');
  }
}

for (const el of [$('word'), $('pdf')]) {
  el.addEventListener('click', e => {
    if (el.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
    }
  });
}

async function send(f) {
  if (!f) return;
  setReady(false);
  say('Processing "' + f.name + '" ...');
  const fd = new FormData();
  fd.append('resume', f);
  try {
    const j = await api('/api/convert', { method: 'POST', body: fd });
    jobId = j.id;
    setReady(true);
    say('Done! You can preview your formatted resume or download as Word / PDF.');
  } catch (e) {
    say(e.message, true);
  }
}

const d = $('drop'), fi = $('file');
const loginForm = $('loginForm');

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  $('authStatus').textContent = '';
  try {
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('username').value,
        password: $('password').value
      })
    });
    loginForm.reset();
    showApp();
  } catch (error) {
    $('authStatus').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

$('logout').onclick = async () => {
  try {
    await api('/api/logout', { method: 'POST' });
    jobId = null;
    setReady(false);
    $('dlg').close();
    $('frame').src = '';
    showLogin();
  } catch (error) {
    say(error.message, true);
  }
};

d.onclick = () => fi.click();
d.onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fi.click();
  }
};
fi.onchange = () => {
  send(fi.files[0]);
  fi.value = '';
};
d.ondragover = e => {
  e.preventDefault();
  d.classList.add('over');
};
d.ondragleave = () => d.classList.remove('over');
d.ondrop = e => {
  e.preventDefault();
  d.classList.remove('over');
  send(e.dataTransfer.files[0]);
};

$('preview').onclick = () => {
  $('frame').src = '/api/files/' + jobId + '/pdf?inline=1';
  $('dlg').showModal();
};

$('close').onclick = () => {
  $('dlg').close();
  $('frame').src = '';
};

loadSession();
