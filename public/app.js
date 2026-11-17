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
