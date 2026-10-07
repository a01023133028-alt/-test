/* 공용 화면 조각: 태그, 사진, 확대 보기, 모달 */
const UI = (() => {
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);
  }

  function morphTag(morph) {
    return `<span class="tag ${Data.MORPH_CLASS[morph] || ''}">${esc(morph)}</span>`;
  }

  function lifeTag(life) {
    return `<span class="tag ${Data.LIFE_CLASS[life] || ''}">${esc(life)}</span>`;
  }

  function tags(w) {
    return `<span class="tags">${morphTag(w.morph)}${lifeTag(w.life)}</span>`;
  }

  /* 사진 (불러오기 실패 시 아래 error 리스너가 자리표시로 바꿈) */
  function img(src, cls = '', alt = '잡초 사진', extra = '') {
    if (!src) return `<div class="img-missing ${cls}">사진 없음</div>`;
    return `<img class="wimg ${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" ${extra}>`;
  }

  /* 그 잡초의 모든 사진 썸네일 (탭하면 확대) */
  function thumbs(w) {
    if (!w.images.length) return '<p class="muted small">등록된 사진이 없습니다.</p>';
    return `<div class="thumbs">${w.images
      .map(
        (src, i) =>
          `<button type="button" class="thumb" data-zoom-weed="${w.id}" data-zoom-index="${i}" aria-label="사진 ${i + 1} 크게 보기">${img(src, '', `${w.name} 사진 ${i + 1}`)}</button>`,
      )
      .join('')}</div>`;
  }

  document.addEventListener(
    'error',
    (e) => {
      const t = e.target;
      if (t instanceof HTMLImageElement && t.classList.contains('wimg') && !t.dataset.failed) {
        t.dataset.failed = '1';
        const div = document.createElement('div');
        div.className = 'img-missing ' + t.className.replace('wimg', '');
        div.textContent = '사진을 불러올 수 없음';
        div.title = t.getAttribute('src');
        t.replaceWith(div);
      }
    },
    true,
  );

  /* ---------- 확대 보기 ---------- */
  const lb = { el: null, list: [], index: 0 };
  let credits = {};

  /* 사진 출처 { 경로: { author, license, source } } */
  function setCredits(map) {
    credits = map || {};
  }

  function creditHtml(src) {
    const c = credits[src];
    if (!c) return '';
    return `📷 ${esc(c.author || c.login || '알 수 없음')} · ${esc(c.license)} · <a href="${esc(c.source)}" target="_blank" rel="noopener">iNaturalist</a>`;
  }

  function openLightbox(list, index = 0) {
    if (!list.length) return;
    lb.list = list;
    lb.index = index;
    lb.el = lb.el || document.getElementById('lightbox');
    renderLightbox();
    lb.el.hidden = false;
    document.body.classList.add('no-scroll');
  }

  function renderLightbox() {
    const many = lb.list.length > 1;
    lb.el.querySelector('.lb-img').innerHTML = img(lb.list[lb.index], 'lb-photo', '확대한 사진');
    lb.el.querySelector('.lb-count').textContent = many ? `${lb.index + 1} / ${lb.list.length}` : '';
    lb.el.querySelector('.lb-credit').innerHTML = creditHtml(lb.list[lb.index]);
    lb.el.querySelectorAll('.lb-prev, .lb-next').forEach((b) => (b.hidden = !many));
  }

  function stepLightbox(d) {
    lb.index = (lb.index + d + lb.list.length) % lb.list.length;
    renderLightbox();
  }

  function closeLightbox() {
    if (!lb.el || lb.el.hidden) return false;
    lb.el.hidden = true;
    if (!isModalOpen()) document.body.classList.remove('no-scroll');
    return true;
  }

  function isLightboxOpen() {
    return !!lb.el && !lb.el.hidden;
  }

  /* ---------- 모달 ---------- */
  function openModal(html) {
    const m = document.getElementById('modal');
    m.querySelector('.modal-body').innerHTML = html;
    m.hidden = false;
    m.querySelector('.modal-sheet').scrollTop = 0;
    document.body.classList.add('no-scroll');
  }

  function closeModal() {
    const m = document.getElementById('modal');
    if (m.hidden) return false;
    m.hidden = true;
    if (!isLightboxOpen()) document.body.classList.remove('no-scroll');
    return true;
  }

  function isModalOpen() {
    return !document.getElementById('modal').hidden;
  }

  function initOverlays() {
    const lbEl = document.getElementById('lightbox');
    lbEl.addEventListener('click', (e) => {
      if (e.target.closest('.lb-credit a')) return;
      if (e.target.closest('.lb-prev')) return stepLightbox(-1);
      if (e.target.closest('.lb-next')) return stepLightbox(1);
      closeLightbox();
    });
    // 좌우 스와이프로 사진 넘기기
    let sx = null;
    lbEl.addEventListener('touchstart', (e) => {
      sx = e.touches.length === 1 ? e.touches[0].clientX : null;
    }, { passive: true });
    lbEl.addEventListener('touchend', (e) => {
      if (sx == null || lb.list.length < 2) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) {
        e.preventDefault();
        stepLightbox(dx < 0 ? 1 : -1);
      }
      sx = null;
    });

    const m = document.getElementById('modal');
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('.modal-close')) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (isLightboxOpen()) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeLightbox();
        } else if (e.key === 'ArrowLeft') stepLightbox(-1);
        else if (e.key === 'ArrowRight') stepLightbox(1);
      } else if (isModalOpen() && e.key === 'Escape') {
        closeModal();
      }
    }, true);
  }

  function pct(n, d) {
    return d ? Math.round((n / d) * 100) : 0;
  }

  return {
    esc,
    morphTag,
    lifeTag,
    tags,
    img,
    thumbs,
    openLightbox,
    closeLightbox,
    isLightboxOpen,
    openModal,
    closeModal,
    isModalOpen,
    initOverlays,
    setCredits,
    pct,
  };
})();
