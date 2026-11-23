// Slot aset 2D: mencoba memuat gambar dari daftar path (berurutan).
// Jika semua gagal → tampilkan placeholder berlabel.

const cache = new Map(); // path -> Promise<boolean>

function probe(path) {
  if (!path) return Promise.resolve(false);
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = path;
    }));
  }
  return cache.get(path);
}

/**
 * @param {object} o
 * @param {string|string[]} o.src   path atau daftar path (fallback berurutan)
 * @param {string} o.label          label placeholder
 * @param {string} [o.className]
 * @param {'cover'|'contain'} [o.fit]
 * @param {string} [o.tag]          elemen pembungkus (default div)
 */
export function slot({ src, label, className = '', fit = 'contain', tag = 'div' }) {
  const el = document.createElement(tag);
  el.className = `slot ${className}`.trim();
  el.dataset.label = label;
  const list = (Array.isArray(src) ? src : [src]).filter(Boolean);

  (async () => {
    for (const p of list) {
      if (await probe(p)) {
        const img = document.createElement('img');
        img.src = p;
        img.alt = label;
        img.draggable = false;
        img.style.objectFit = fit;
        el.appendChild(img);
        el.classList.add('is-loaded');
        return;
      }
    }
    el.classList.add('is-placeholder');
    const ph = document.createElement('span');
    ph.className = 'ph-label';
    ph.innerHTML = `<b>${label}</b><small>${list[0] ?? ''}</small>`;
    el.appendChild(ph);
  })();

  return el;
}

/** Cek apakah file media (video/audio) tersedia. */
export async function mediaExists(path) {
  if (!path) return false;
  try {
    const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
