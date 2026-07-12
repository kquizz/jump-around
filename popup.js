/*
 * popup.js (step 3) — thin trigger for the worker, now with live data.
 *
 * The split from step 2 still holds:
 *   - POPUP  = UI. Paints state on open, sends messages on click. Fragile.
 *   - WORKER = durable work (fetch batch, navigate, POST to the API).
 *
 * What's new: on open we fetch the tag list from the API and build two
 * checkbox groups from it — one for tagging a recommendation, one for the
 * jump filter. Everything else is wiring buttons to worker messages.
 */

import { API_BASE } from './config.js';

/* --- tiny DOM helpers --- */
const $ = (id) => document.getElementById(id);
const setStatus = (el, msg, ok) => {
  el.textContent = msg;
  el.className = `status ${ok ? 'ok' : 'err'}`;
};

/* --- Paint current state on open (popup is alive right now) --- */
const { visited = {}, clientUuid, selectedTags = [] } = await chrome.storage.local.get([
  'visited',
  'clientUuid',
  'selectedTags',
]);

$('progress').textContent = `${Object.keys(visited).length} seen`;
$('client-uuid').textContent = clientUuid ?? '(minting…)';

/* --- Fetch the tag list (fallback to whatever we cached last time) --- */
async function loadTags() {
  try {
    const res = await fetch(`${API_BASE}/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tags = await res.json(); // [{ id, name }]
    await chrome.storage.local.set({ cachedTags: tags });
    return tags;
  } catch (_err) {
    const { cachedTags = [] } = await chrome.storage.local.get('cachedTags');
    return cachedTags;
  }
}

// Build a group of tag checkboxes into `container`. `checkedIds` pre-checks
// some; `onChange` (optional) fires whenever any box toggles.
function renderTagCheckboxes(container, tags, checkedIds, onChange) {
  container.innerHTML = '';
  if (tags.length === 0) {
    container.innerHTML = '<span class="small">no tags available</span>';
    return;
  }
  for (const tag of tags) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = String(tag.id);
    box.checked = checkedIds.includes(tag.id);
    if (onChange) box.addEventListener('change', onChange);
    label.append(box, document.createTextNode(tag.name));
    container.appendChild(label);
  }
}

// Collect the checked tag ids (as numbers) from a checkbox container.
function checkedTagIds(container) {
  return [...container.querySelectorAll('input:checked')].map((b) => Number(b.value));
}

const tags = await loadTags();

// Recommend panel: no pre-checked tags.
renderTagCheckboxes($('rec-tags'), tags, []);

// Filter panel: pre-check the user's saved filter. On any change, persist
// the new filter AND clear the candidate buffer so the next Jump refetches
// with the new filter instead of serving stale buffered pages.
renderTagCheckboxes($('filter-tags'), tags, selectedTags, async () => {
  const ids = checkedTagIds($('filter-tags'));
  await chrome.storage.local.set({ selectedTags: ids, candidates: [] });
});

/* --- Panel toggles --- */
const toggle = (btnId, panelId) =>
  $(btnId).addEventListener('click', () => $(panelId).classList.toggle('open'));
toggle('show-recommend', 'recommend-panel');
toggle('show-report', 'report-panel');
toggle('show-filter', 'filter-panel');

/* --- Jump: fire and let the worker navigate (popup likely dies here) --- */
$('jump').addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'jump' });
    if (result?.error) $('progress').textContent = result.error;
    else if (result) $('progress').textContent = `${result.seen} seen`;
  } catch (_ignored) {
    // Popup closed before the reply arrived. Expected — the jump happened.
  }
});

/* --- Reset history --- */
$('reset').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'resetVisited' });
  $('progress').textContent = '0 seen';
});

/* --- Recommend the current page --- */
$('rec-submit').addEventListener('click', async () => {
  const status = $('rec-status');
  setStatus(status, 'sending…', true);
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'recommend',
      tagIds: checkedTagIds($('rec-tags')),
    });
    if (!res?.ok) {
      setStatus(status, res?.error ?? 'Something went wrong.', false);
    } else if (res.already) {
      setStatus(status, 'Already in the pool — thanks anyway!', true);
    } else if (res.status === 'active') {
      setStatus(status, 'Added and live! 🎉', true);
    } else {
      setStatus(status, 'Submitted — pending review. Thanks!', true);
    }
  } catch (err) {
    setStatus(status, String(err), false);
  }
});

/* --- Report the page we last jumped to --- */
$('rep-submit').addEventListener('click', async () => {
  const status = $('rep-status');
  setStatus(status, 'sending…', true);
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'report',
      reason: $('rep-reason').value,
    });
    if (res?.ok) setStatus(status, 'Reported. Thanks for the heads up.', true);
    else setStatus(status, res?.error ?? 'Could not send report.', false);
  } catch (err) {
    setStatus(status, String(err), false);
  }
});
