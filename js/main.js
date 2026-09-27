/* main.js — اسکریپت مشترک همهٔ صفحات
   بهینه‌سازی‌ها:
   - IntersectionObserver مشترک برای reveal و شمارنده‌ها
   - Event delegation روی فیلترها
   - رندر یکپارچه برای صفحات media
   - جستجوی سراسری با Ctrl+K
*/

(function () {
  'use strict';

  /* =========================================================
     ۱. ابزارها
     ========================================================= */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const toFa = (n) => Number(n).toLocaleString('fa-IR');
  const toFaNum = (n) => Number(n).toLocaleString('fa-IR', { useGrouping: false });

  const FA_MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];

  const faDate = (iso) => {
    if (!iso) return '';
    const parts = String(iso).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return String(iso);
    const [y, m, d] = parts;
    if (m < 1 || m > 12) return String(iso);
    return `${toFaNum(d)} ${FA_MONTHS[m - 1]} ${toFaNum(y)}`;
  };

  const faDateMonth = (iso) => {
    if (!iso) return '';
    const parts = String(iso).split('-').map(Number);
    if (parts.length < 2 || parts.some(Number.isNaN)) return String(iso);
    const [y, m] = parts;
    if (m < 1 || m > 12) return String(iso);
    return `${FA_MONTHS[m - 1]} ${toFaNum(y)}`;
  };

  const escape = (s) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const isExternal = (url) => /^https?:\/\//i.test(url);
  const linkAttrs = (url) => isExternal(url) ? 'target="_blank" rel="noopener"' : '';

  /* =========================================================
     ۲. پوسته (theme)
     ========================================================= */
  const themeToggle = $('#themeToggle');
  themeToggle?.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'dark' ? '#0b0d12' : '#f6f7fb');
  });

  /* =========================================================
     ۳. منوی موبایل
     ========================================================= */
  const menuBtn = $('#menuBtn');
  const nav = $('#siteNav');

  menuBtn?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  nav?.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', (e) => {
    if (!nav?.classList.contains('is-open')) return;
    if (nav.contains(e.target) || menuBtn.contains(e.target)) return;
    nav.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  });

  /* =========================================================
     ۴. لینک فعال در ناوبری
     ========================================================= */
  const page = document.body.dataset.page;
  $$('#siteNav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === `${page}.html` || (page === 'home' && href === 'index.html')) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* =========================================================
     ۵. Reveal on scroll — observer مشترک
     ========================================================= */
  let revealObserver = null;

  function setupReveal() {
    const els = $$('.reveal:not([data-reveal-bound])');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    }

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      el.dataset.revealBound = '1';
      el.style.transitionDelay = `${Math.min(i * 40, 200)}ms`;
      revealObserver.observe(el);
    }
  }

  /* =========================================================
     ۶. شمارندهٔ آمار — observer مشترک
     ========================================================= */
  function animateCount(el, target) {
    const dur = 900;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = toFa(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = toFa(target);
    };
    requestAnimationFrame(step);
  }

  function renderStats() {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.dataset.count = val;
    };
    set('statProjects', DATA.projects.length);
    set('statCourses',  DATA.courses.length);
    set('statPosts',    DATA.posts.length + DATA.notes.length);
    set('statMedia',
        (DATA.movies?.length || 0) + (DATA.series?.length || 0) +
        (DATA.books?.length  || 0) + (DATA.games?.length  || 0)
    );
  }

  let statsObserver = null;

  function setupStatsCounter() {
    const els = $$('.stat strong:not([data-count-bound])');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(el => animateCount(el, Number(el.dataset.count || 0)));
      return;
    }

    if (!statsObserver) {
      statsObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animateCount(entry.target, Number(entry.target.dataset.count || 0));
            statsObserver.unobserve(entry.target);
          }
        }
      }, { threshold: 0.3 });
    }

    for (const el of els) {
      el.dataset.countBound = '1';
      statsObserver.observe(el);
    }
  }

  /* =========================================================
     ۷. فیلترها — تابع مشترک با event delegation
     ========================================================= */
  function setupFilterChips(filtersBox, items, getTags, empty) {
    if (!filtersBox || !items.length) return;

    const tagSet = new Set();
    for (const item of items) {
      for (const t of getTags(item)) tagSet.add(t);
    }

    const frag = document.createDocumentFragment();
    for (const tag of tagSet) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-chip';
      btn.dataset.filter = tag;
      btn.textContent = tag;
      frag.appendChild(btn);
    }
    filtersBox.appendChild(frag);

    filtersBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip || !filtersBox.contains(chip)) return;

      const filter = chip.dataset.filter;
      const chips = filtersBox.querySelectorAll('.filter-chip');
      for (const c of chips) c.classList.toggle('is-active', c === chip);

      let visible = 0;
      for (const item of items) {
        const match = filter === 'all' || getTags(item).includes(filter);
        item.classList.toggle('is-hidden', !match);
        if (match) visible++;
      }
      if (empty) empty.hidden = visible !== 0;
    });
  }

  /* =========================================================
     ۸. کارت‌سازها
     ========================================================= */
  function projectCardHTML(p) {
    const external = isExternal(p.url);
    const cta = external ? 'مشاهدهٔ مخزن' : 'مشاهدهٔ پروژه';
    return `
      <article class="card project-card">
        <div class="card-head">
          <span class="project-icon" aria-hidden="true">${p.icon || '📦'}</span>
          <h3 class="card-title">${escape(p.title)}</h3>
        </div>
        ${p.subtitle ? `<p class="project-sub">${escape(p.subtitle)}</p>` : ''}
        <p class="card-text">${escape(p.description)}</p>
        <div class="project-meta">
          ${(p.tags || []).map(t => `<span class="tag">${escape(t)}</span>`).join('')}
        </div>
        <a class="card-link" href="${escape(p.url)}" ${linkAttrs(p.url)}>
          ${cta}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
      </article>
    `;
  }

  function courseCardHTML(c) {
    return `
      <article class="card course-card">
        <div class="course-card-head">
          <span class="course-platform-tag">${escape(c.platform)}</span>
          ${c.rating ? `
            <span class="course-card-rating">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:13px;height:13px"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ${toFa(Number(c.rating).toFixed(1))}
            </span>
          ` : ''}
        </div>
        <h3 class="card-title">${escape(c.title)}</h3>
        ${c.subtitle ? `<p class="course-card-sub">${escape(c.subtitle)}</p>` : ''}
        <p class="card-text">${escape(c.description)}</p>
        <div class="course-card-meta">
          ${c.duration ? `<span>${escape(c.duration)}</span>` : ''}
          ${c.level ? `<span class="dot-sep" aria-hidden="true"></span><span>${escape(c.level)}</span>` : ''}
          ${c.students ? `<span class="dot-sep" aria-hidden="true"></span><span>${toFa(c.students)} دانشجو</span>` : ''}
        </div>
        <div class="project-meta">
          ${(c.tags || []).slice(0, 4).map(t => `<span class="tag">${escape(t)}</span>`).join('')}
        </div>
        <a class="card-link" href="${escape(c.url)}" ${linkAttrs(c.url)}>
          مشاهدهٔ دوره
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
      </article>
    `;
  }

  function mediaPosterHTML(item, kind) {
    if (item.poster) {
      return `<img src="${escape(item.poster)}" alt="پوستر ${escape(item.titleFa || item.title)}" loading="lazy" decoding="async">`;
    }
    const iconPath = kind === 'series'
        ? '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6l3-3h2l3 3"/><path d="M8 21h8"/><circle cx="12" cy="21" r="1"/>'
        : '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>';
    return `
      <div class="media-placeholder" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
        <span>${escape(item.title)}</span>
      </div>
    `;
  }

  function mediaBadgesHTML(item) {
    const rating = (item.rating != null)
        ? `<span class="media-badge media-badge-rating">
           <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
           ${toFa(Number(item.rating).toFixed(1))}
         </span>`
        : '';
    const year = item.year
        ? `<span class="media-badge media-badge-year">${toFaNum(item.year)}</span>`
        : '';
    return (rating || year) ? `<div class="media-badges">${rating}${year}</div>` : '';
  }

  function movieCardHTML(m) {
    const poster = mediaPosterHTML(m, 'movie');
    const badges = mediaBadgesHTML(m);

    const metaLine = [
      m.director ? `کارگردان: ${escape(m.director)}` : '',
      m.runtime ? `${toFaNum(m.runtime)} دقیقه` : '',
    ].filter(Boolean).join(' · ');

    const castLine = (m.cast && m.cast.length)
        ? `<p class="media-cast"><span>بازیگران:</span> ${m.cast.map(escape).join('، ')}</p>`
        : '';

    const genres = (m.genres && m.genres.length)
        ? `<div class="media-genres">${m.genres.map(g => `<span class="tag">${escape(g)}</span>`).join('')}</div>`
        : '';

    const note = m.note ? `<p class="media-note">${escape(m.note)}</p>` : '';

    const external = m.trakt
        ? `<a class="media-external" href="${escape(m.trakt)}" target="_blank" rel="noopener">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
           مشاهده در Trakt
         </a>`
        : '';

    const genresAttr = (m.genres || []).join(',');

    return `
      <article class="media-card movie-card" data-tags="${escape(genresAttr)}">
        <div class="media-poster">
          ${poster}
          ${badges}
        </div>
        <div class="media-body">
          <h3 class="media-title">
            ${escape(m.titleFa || m.title)}
            <span class="media-title-en" dir="ltr">${escape(m.title)}</span>
          </h3>
          ${metaLine ? `<p class="media-meta">${metaLine}</p>` : ''}
          <p class="media-summary">${escape(m.summary)}</p>
          ${castLine}
          ${note}
          ${genres}
          ${external}
        </div>
      </article>
    `;
  }

  const SERIES_STATUS_LABEL = {
    watching: 'در حال تماشا',
    completed: null,
    rewatched: null,
    dropped: 'ناتمام',
    'on-hold': 'متوقف‌شده',
  };

  function seriesCardHTML(s) {
    const poster = mediaPosterHTML(s, 'series');
    const badges = mediaBadgesHTML(s);

    const statusLabel = SERIES_STATUS_LABEL[s.status];
    const statusBadge = statusLabel
        ? `<span class="media-status media-status-${escape(s.status)}">${escape(statusLabel)}</span>`
        : '';

    const metaParts = [];
    if (s.creator) metaParts.push(`سازنده: ${escape(s.creator)}`);
    if (s.seasons) {
      let seasonsStr = `${toFa(s.seasons)} فصل`;
      if (s.episodes) seasonsStr += ` · ${toFaNum(s.episodes)} قسمت`;
      metaParts.push(seasonsStr);
    }
    if (s.network) metaParts.push(escape(s.network));
    const metaLine = metaParts.join(' · ');

    const castLine = (s.cast && s.cast.length)
        ? `<p class="media-cast"><span>بازیگران:</span> ${s.cast.map(escape).join('، ')}</p>`
        : '';

    const genres = (s.genres && s.genres.length)
        ? `<div class="media-genres">${s.genres.map(g => `<span class="tag">${escape(g)}</span>`).join('')}</div>`
        : '';

    const note = s.note ? `<p class="media-note">${escape(s.note)}</p>` : '';

    const timesWatched = (s.timesWatched && s.timesWatched > 1)
        ? `<span class="media-times">${toFa(s.timesWatched)} بار دیده‌شده</span>`
        : '';

    const external = s.trakt
        ? `<a class="media-external" href="${escape(s.trakt)}" target="_blank" rel="noopener">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
           مشاهده در Trakt
         </a>`
        : '';

    const genresAttr = (s.genres || []).join(',');

    return `
      <article class="media-card series-card" data-tags="${escape(genresAttr)}">
        <div class="media-poster">
          ${poster}
          ${badges}
          ${statusBadge}
        </div>
        <div class="media-body">
          <h3 class="media-title">
            ${escape(s.titleFa || s.title)}
            <span class="media-title-en" dir="ltr">${escape(s.title)}</span>
          </h3>
          ${metaLine ? `<p class="media-meta">${metaLine}</p>` : ''}
          <p class="media-summary">${escape(s.summary)}</p>
          ${timesWatched}
          ${castLine}
          ${note}
          ${genres}
          ${external}
        </div>
      </article>
    `;
  }

  function bookCardHTML(b) {
    const cover = b.cover
        ? `<img src="${escape(b.cover)}" alt="جلد ${escape(b.titleFa || b.title)}" loading="lazy" decoding="async">`
        : `
        <div class="media-placeholder book-placeholder" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/>
            <path d="M18 7h2v13H7"/>
            <path d="M7 8h8M7 12h8"/>
          </svg>
          <span>${escape(b.title)}</span>
        </div>
      `;

    /* بج امتیاز — اول امتیاز شخصی، اگر نبود میانگین Goodreads */
    const shownRating = (b.rating != null) ? b.rating : b.avgRating;
    const isPersonal  = (b.rating != null);
    const ratingBadge = (shownRating != null)
        ? `<span class="media-badge media-badge-rating${isPersonal ? '' : ' media-badge-avg'}"
                title="${isPersonal ? 'امتیاز شما' : 'میانگین Goodreads'}">
           <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
           ${toFa(Number(shownRating).toFixed(2))}
         </span>`
        : '';

    const yearBadge = b.year
        ? `<span class="media-badge media-badge-year">${toFaNum(b.year)}</span>`
        : '';

    const badges = (ratingBadge || yearBadge)
        ? `<div class="media-badges">${ratingBadge}${yearBadge}</div>`
        : '';

    const readBadge = b.finishedAt
        ? `<span class="media-status media-read-date" title="تاریخ خواندن">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:12px;height:12px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
           ${faDateMonth(b.finishedAt)}
         </span>`
        : '';

    const metaParts = [];
    if (b.authorFa || b.author) {
      metaParts.push(`نویسنده: ${escape(b.authorFa || b.author)}`);
    }
    if (b.pages) metaParts.push(`${toFaNum(b.pages)} صفحه`);
    const metaLine = metaParts.join(' · ');

    const genres = (b.genres && b.genres.length)
        ? `<div class="media-genres">${b.genres.map(g => `<span class="tag">${escape(g)}</span>`).join('')}</div>`
        : '';

    const note = b.note ? `<p class="media-note">${escape(b.note)}</p>` : '';

    const external = b.goodreads
        ? `<a class="media-external" href="${escape(b.goodreads)}" target="_blank" rel="noopener">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
           مشاهده در Goodreads
         </a>`
        : '';

    const genresAttr = (b.genres || []).join(',');

    return `
      <article class="media-card book-card" data-tags="${escape(genresAttr)}">
        <div class="media-poster">
          ${cover}
          ${badges}
          ${readBadge}
        </div>
        <div class="media-body">
          <h3 class="media-title">
            ${escape(b.titleFa || b.title)}
            ${b.title && b.title !== b.titleFa
        ? `<span class="media-title-en" dir="ltr">${escape(b.title)}</span>`
        : ''}
          </h3>
          ${metaLine ? `<p class="media-meta">${metaLine}</p>` : ''}
          <p class="media-summary">${escape(b.summary)}</p>
          ${note}
          ${genres}
          ${external}
        </div>
      </article>
    `;
  }

  /* ---------- کارت مقاله ---------- */
  const PAPER_STATUS_LABEL = {
    read: 'خوانده‌شده',
    reading: 'در حال خواندن',
    planned: 'در برنامه',
  };
  const PAPER_STATUS_CLASS = {
    read: 'media-status-watching',
    reading: 'media-status-on-hold',
    planned: 'media-status-dropped',
  };

  function paperCardHTML(p) {
    const statusLabel = PAPER_STATUS_LABEL[p.status] || null;
    const statusClass = PAPER_STATUS_CLASS[p.status] || 'media-status-dropped';

    const yearBadge = p.year
        ? `<span class="media-badge media-badge-year">${toFaNum(p.year)}</span>`
        : '';

    const statusBadge = statusLabel
        ? `<span class="media-status ${statusClass}">${escape(statusLabel)}</span>`
        : '';

    const authorsStr = (p.authors || []).slice(0, 3).join('، ')
        + ((p.authors || []).length > 3 ? ' و همکاران' : '');
    const metaLine = [authorsStr, p.venue].filter(Boolean).join(' · ');

    const takeaway = p.takeaway
        ? `<div class="paper-takeaway">
             <span class="paper-takeaway-label">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>
               دستاورد اصلی
             </span>
             <p>${escape(p.takeaway)}</p>
           </div>`
        : '';

    const tags = (p.tags && p.tags.length)
        ? `<div class="media-genres">${p.tags.map(t => `<span class="tag">${escape(t)}</span>`).join('')}</div>`
        : '';

    const note = p.note ? `<p class="media-note">${escape(p.note)}</p>` : '';

    const links = [];
    if (p.url) {
      links.push(`<a class="paper-link" href="${escape(p.url)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        ${p.venueShort === 'arXiv' ? 'arXiv' : 'مشاهده'}
      </a>`);
    }
    if (p.ieee) {
      links.push(`<a class="paper-link" href="${escape(p.ieee)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        IEEE
      </a>`);
    }
    if (p.pdf) {
      links.push(`<a class="paper-link" href="${escape(p.pdf)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
        PDF
      </a>`);
    }
    if (p.doi) {
      links.push(`<a class="paper-link" href="https://doi.org/${escape(p.doi)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        DOI
      </a>`);
    }
    const linksHTML = links.length
        ? `<div class="paper-links">${links.join('')}</div>`
        : '';

    const readBadge = p.readAt
        ? `<span class="paper-read-date" title="تاریخ خواندن">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:12px;height:12px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
             خوانده‌شده ${faDateMonth(p.readAt)}
           </span>`
        : '';

    const genresAttr = (p.tags || []).join(',');

    return `
      <article class="paper-card reveal" data-tags="${escape(genresAttr)}" data-status="${escape(p.status || '')}">
        <header class="paper-header">
          <div class="paper-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M8 13h8M8 17h6M8 9h3"/>
            </svg>
          </div>
          <div class="paper-badges">
            ${yearBadge}
            ${statusBadge}
          </div>
        </header>

        <h3 class="paper-title">
          ${escape(p.titleFa || p.title)}
          <span class="paper-title-en" dir="ltr">${escape(p.title)}</span>
        </h3>

        ${p.subtitle ? `<p class="paper-subtitle" dir="ltr">${escape(p.subtitle)}</p>` : ''}

        ${metaLine ? `<p class="paper-meta">${escape(metaLine)}</p>` : ''}

        <p class="paper-summary">${escape(p.summary)}</p>

        ${takeaway}
        ${note}
        ${tags}
        ${readBadge}
        ${linksHTML}
      </article>
    `;
  }

  /* ---------- کارت بازی ---------- */
  const GAME_STATUS_LABEL = {
    playing: 'در حال بازی',
    completed: 'تمام‌شده',
    dropped: 'ناتمام',
    backlog: 'در انتظار',
  };

  function gameCardHTML(g) {
    const cover = g.cover
        ? `<img src="${escape(g.cover)}" alt="کاور ${escape(g.titleFa || g.title)}" loading="lazy" decoding="async">`
        : `
        <div class="media-placeholder game-placeholder" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 12h4M8 10v4"/>
            <circle cx="15" cy="11" r="1"/>
            <circle cx="17" cy="13" r="1"/>
            <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258a4 4 0 0 0-.017-.152A4 4 0 0 0 17.32 5z"/>
          </svg>
          <span>${escape(g.title)}</span>
        </div>
      `;

    const ratingBadge = (g.rating != null)
        ? `<span class="media-badge media-badge-rating game-rating" title="${escape(g.ratingSource || 'Metacritic')}">
             ${toFaNum(g.rating)}
           </span>`
        : '';

    const yearBadge = g.year
        ? `<span class="media-badge media-badge-year">${toFaNum(g.year)}</span>`
        : '';

    const badges = (ratingBadge || yearBadge)
        ? `<div class="media-badges">${ratingBadge}${yearBadge}</div>`
        : '';

    const statusLabel = GAME_STATUS_LABEL[g.status];
    const statusBadge = statusLabel
        ? `<span class="media-status media-status-${escape(g.status)}">${escape(statusLabel)}</span>`
        : '';

    const metaParts = [];
    if (g.developer) metaParts.push(escape(g.developer));
    if (g.platforms && g.platforms.length) {
      metaParts.push(g.platforms.slice(0, 2).join('، '));
    }
    const metaLine = metaParts.join(' · ');

    const genres = (g.genres && g.genres.length)
        ? `<div class="media-genres">${g.genres.map(x => `<span class="tag">${escape(x)}</span>`).join('')}</div>`
        : '';

    const note = g.note ? `<p class="media-note">${escape(g.note)}</p>` : '';

    const external = g.igdb
        ? `<a class="media-external" href="${escape(g.igdb)}" target="_blank" rel="noopener">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
           مشاهده در IGDB
         </a>`
        : '';

    const genresAttr = (g.genres || []).join(',');

    return `
      <article class="media-card game-card" data-tags="${escape(genresAttr)}">
        <div class="media-poster">
          ${cover}
          ${badges}
          ${statusBadge}
        </div>
        <div class="media-body">
          <h3 class="media-title">
            ${escape(g.titleFa || g.title)}
            ${g.title !== g.titleFa
        ? `<span class="media-title-en" dir="ltr">${escape(g.title)}</span>`
        : ''}
          </h3>
          ${metaLine ? `<p class="media-meta">${metaLine}</p>` : ''}
          <p class="media-summary">${escape(g.summary)}</p>
          ${note}
          ${genres}
          ${external}
        </div>
      </article>
    `;
  }

  /* =========================================================
     ۹. رندر صفحات
     ========================================================= */
  function renderHomeProjects() {
    const box = $('#homeProjects');
    if (!box) return;
    const items = DATA.projects.filter(p => p.featured).slice(0, 3);
    box.innerHTML = items.map(projectCardHTML).join('');
  }

  function renderProjectsGrid() {
    const box = $('#projectsGrid');
    if (!box) return;
    const items = DATA.projects.filter(p => p.id !== 'purser');
    box.innerHTML = items.map(projectCardHTML).join('');
  }

  function renderCoursesGrid() {
    const box = $('#coursesGrid');
    if (!box) return;
    const items = DATA.courses.filter(c => !c.featured);
    if (!items.length) {
      box.innerHTML = `
        <div class="empty-state">
          <p>دورهٔ دیگری در حال حاضر منتشر نشده است. به‌زودی دوره‌های جدید اضافه می‌شوند.</p>
        </div>
      `;
      return;
    }
    box.innerHTML = items.map(courseCardHTML).join('');
  }

  function renderHomePosts() {
    const box = $('#homePosts');
    if (!box) return;
    const items = [...DATA.posts]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
    box.innerHTML = items.map((p) => `
      <a class="list-item" href="${escape(p.url)}">
        <div>
          <h3 class="list-title">${escape(p.title)}</h3>
          <p class="list-excerpt">${escape(p.excerpt)}</p>
          <div class="list-meta">
            <span>${faDate(p.date)}</span>
            <span class="dot-sep" aria-hidden="true"></span>
            <span>${escape(p.readingTime)}</span>
            ${p.tags?.length ? '<span class="dot-sep" aria-hidden="true"></span>' : ''}
            ${p.tags?.map(t => `<span>#${escape(t)}</span>`).join(' ') || ''}
          </div>
        </div>
        <span class="list-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </span>
      </a>
    `).join('');
  }

  function renderNotesTimeline() {
    const list = $('#notesTimeline');
    const filtersBox = $('#notesFilters');
    const empty = $('#notesEmpty');
    if (!list) return;

    const notes = [...DATA.notes].sort((a, b) =>
        String(b.date).localeCompare(String(a.date))
    );

    if (!notes.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    const noteItemHTML = (n) => {
      const image = n.image ? `
        <figure class="note-image">
          <img src="${escape(n.image)}" alt="${escape(n.imageAlt || '')}" loading="lazy" decoding="async">
          ${n.imageCaption ? `<figcaption>${escape(n.imageCaption)}</figcaption>` : ''}
        </figure>
      ` : '';

      const link = n.link ? `
        <a class="note-link" href="${escape(n.link.url)}" target="_blank" rel="noopener">
          <span class="note-link-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </span>
          <span class="note-link-text">
            <strong>${escape(n.link.title || n.link.url)}</strong>
            ${n.link.host ? `<span class="note-link-host" dir="ltr">${escape(n.link.host)}</span>` : ''}
          </span>
          <span class="note-link-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </span>
        </a>
      ` : '';

      const year = (n.date || '').slice(0, 4);

      return `
        <li class="note-item reveal" data-year="${escape(year)}">
          <span class="note-marker" aria-hidden="true"></span>
          <article class="note-body">
            <time class="note-date" datetime="${escape(n.date || '')}">${faDate(n.date)}</time>
            <p class="note-text">${escape(n.text)}</p>
            ${image}
            ${link}
          </article>
        </li>
      `;
    };

    list.innerHTML = notes.map(noteItemHTML).join('');
    if (empty) empty.hidden = true;

    if (filtersBox) {
      const years = [...new Set(notes.map(n => (n.date || '').slice(0, 4)))]
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a));

      const frag = document.createDocumentFragment();
      for (const y of years) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-chip';
        btn.dataset.filter = y;
        btn.textContent = toFaNum(y);
        frag.appendChild(btn);
      }
      filtersBox.appendChild(frag);

      const items = $$('.note-item', list);
      filtersBox.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip || !filtersBox.contains(chip)) return;

        const filter = chip.dataset.filter;
        const chips = filtersBox.querySelectorAll('.filter-chip');
        for (const c of chips) c.classList.toggle('is-active', c === chip);

        let visible = 0;
        for (const item of items) {
          const match = filter === 'all' || item.dataset.year === filter;
          item.classList.toggle('is-hidden', !match);
          if (match) visible++;
        }
        if (empty) empty.hidden = visible !== 0;
      });
    }
  }

  function setupBlogFilters() {
    const filtersBox = $('#blogFilters');
    const list = $('#blogList');
    const empty = $('#blogEmpty');
    if (!filtersBox || !list) return;

    const posts = $$('.blog-post', list);
    if (!posts.length) return;

    setupFilterChips(
        filtersBox,
        posts,
        (post) => (post.dataset.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        empty
    );
  }

  function renderMediaPage(config) {
    const grid = document.getElementById(config.gridId);
    if (!grid) return;

    const empty = document.getElementById(config.emptyId);
    const filtersBox = document.getElementById(config.filtersId);
    const statsBox = document.getElementById(config.statsId);

    const items = [...config.data].sort(config.sortFn);

    if (statsBox && config.statsBuilder) {
      statsBox.innerHTML = config.statsBuilder(items);
    }

    if (!items.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    grid.innerHTML = items.map(config.cardBuilder).join('');
    if (empty) empty.hidden = true;

    const cards = $$('.media-card', grid);
    setupFilterChips(
        filtersBox,
        cards,
        (card) => (card.dataset.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        empty
    );
  }

  function renderMoviesPage() {
    if (!$('#moviesGrid')) return;
    renderMediaPage({
      data: DATA.movies || [],
      gridId: 'moviesGrid',
      filtersId: 'moviesFilters',
      emptyId: 'moviesEmpty',
      statsId: 'moviesStats',
      cardBuilder: movieCardHTML,
      sortFn: (a, b) => (b.year || 0) - (a.year || 0),
      statsBuilder: (movies) => {
        const rated = movies.filter(m => m.rating != null);
        const avg = rated.length
            ? (rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length).toFixed(1)
            : null;
        return `
          <span class="media-stat"><strong>${toFa(movies.length)}</strong> فیلم ثبت‌شده</span>
          ${avg ? `<span class="media-stat"><strong>${toFa(avg)}</strong> میانگین امتیاز</span>` : ''}
        `;
      },
    });
  }

  function renderSeriesPage() {
    if (!$('#seriesGrid')) return;
    renderMediaPage({
      data: DATA.series || [],
      gridId: 'seriesGrid',
      filtersId: 'seriesFilters',
      emptyId: 'seriesEmpty',
      statsId: 'seriesStats',
      cardBuilder: seriesCardHTML,
      sortFn: (a, b) => (b.year || 0) - (a.year || 0),
      statsBuilder: (series) => {
        const rated = series.filter(s => s.rating != null);
        const avg = rated.length
            ? (rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length).toFixed(1)
            : null;
        const rewatched = series.filter(s => s.timesWatched > 1).length;
        return `
          <span class="media-stat"><strong>${toFa(series.length)}</strong> سریال ثبت‌شده</span>
          ${avg ? `<span class="media-stat"><strong>${toFa(avg)}</strong> میانگین امتیاز</span>` : ''}
          ${rewatched ? `<span class="media-stat"><strong>${toFa(rewatched)}</strong> چندبار دیده‌شده</span>` : ''}
        `;
      },
    });
  }

  function renderGamesPage() {
    if (!$('#gamesGrid')) return;
    renderMediaPage({
      data: DATA.games || [],
      gridId: 'gamesGrid',
      filtersId: 'gamesFilters',
      emptyId: 'gamesEmpty',
      statsId: 'gamesStats',
      cardBuilder: gameCardHTML,
      sortFn: (a, b) => (b.year || 0) - (a.year || 0),
      statsBuilder: (games) => {
        const rated = games.filter(g => g.rating != null);
        const avg = rated.length
            ? Math.round(rated.reduce((s, g) => s + Number(g.rating), 0) / rated.length)
            : null;
        return `
          <span class="media-stat"><strong>${toFa(games.length)}</strong> بازی ثبت‌شده</span>
          ${avg ? `<span class="media-stat"><strong>${toFa(avg)}</strong> میانگین Metacritic</span>` : ''}
        `;
      },
    });
  }

  /* =========================================================
     صفحهٔ کتاب‌ها — با sort و filter
     ========================================================= */
  function bindBooksToolbar() {
    const sortSelect = document.getElementById('booksSort');
    const filtersBox = document.getElementById('booksFilters');
    const grid       = document.getElementById('booksGrid');
    const empty      = document.getElementById('booksEmpty');
    const statsBox   = document.getElementById('booksStats');
    if (!grid) return;

    const state = {
      sortKey: 'finishedAt',
      sortDir: 'desc',
      filter:  'all',
    };

    if (statsBox) {
      const all = DATA.books || [];
      const rated = all.filter(b => b.rating != null);
      const avg = rated.length
          ? (rated.reduce((s, b) => s + Number(b.rating), 0) / rated.length).toFixed(1)
          : null;
      statsBox.innerHTML = `
        <span class="media-stat"><strong>${toFa(all.length)}</strong> کتاب در سایت</span>
        ${avg ? `<span class="media-stat"><strong>${toFa(avg)}</strong> میانگین امتیاز</span>` : ''}
        <span class="media-stat"><strong>${toFa(61)}</strong> کتاب در Goodreads</span>
      `;
    }

    const genreSet = new Set();
    (DATA.books || []).forEach(b => (b.genres || []).forEach(g => genreSet.add(g)));
    {
      const frag = document.createDocumentFragment();
      for (const g of genreSet) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-chip';
        btn.dataset.filter = g;
        btn.textContent = g;
        frag.appendChild(btn);
      }
      filtersBox.appendChild(frag);
    }

    function compare(a, b) {
      const { sortKey, sortDir } = state;
      let av = a[sortKey];
      let bv = b[sortKey];

      const aMissing = av == null || av === '';
      const bMissing = bv == null || bv === '';
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }

      av = String(av);
      bv = String(bv);
      const cmp = av.localeCompare(bv, 'fa');
      return sortDir === 'asc' ? cmp : -cmp;
    }

    function render() {
      let items = [...(DATA.books || [])];

      if (state.filter !== 'all') {
        items = items.filter(b => (b.genres || []).includes(state.filter));
      }

      items.sort(compare);

      if (!items.length) {
        grid.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
      }
      grid.innerHTML = items.map(bookCardHTML).join('');
      if (empty) empty.hidden = true;

      setupReveal();
    }

    sortSelect?.addEventListener('change', () => {
      const [key, dir] = sortSelect.value.split('-');
      state.sortKey = key;
      state.sortDir = dir;
      render();
    });

    filtersBox?.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip || !filtersBox.contains(chip)) return;

      state.filter = chip.dataset.filter;
      const chips = filtersBox.querySelectorAll('.filter-chip');
      for (const c of chips) c.classList.toggle('is-active', c === chip);
      render();
    });

    render();
  }

  /* =========================================================
     صفحهٔ مقالات — با sort و filter
     ========================================================= */
  function renderPapersPage() {
    const grid = document.getElementById('papersGrid');
    if (!grid) return;

    const filtersBox = document.getElementById('papersFilters');
    const empty      = document.getElementById('papersEmpty');
    const statsBox   = document.getElementById('papersStats');
    const sortSelect = document.getElementById('papersSort');

    const state = { sortKey: 'readAt', sortDir: 'desc', filter: 'all' };

    if (statsBox) {
      const all = DATA.papers || [];
      const byStatus = { read: 0, reading: 0, planned: 0 };
      all.forEach(p => { if (byStatus[p.status] != null) byStatus[p.status]++; });
      statsBox.innerHTML = `
        <span class="media-stat"><strong>${toFa(all.length)}</strong> مقاله</span>
        ${byStatus.read ? `<span class="media-stat"><strong>${toFa(byStatus.read)}</strong> خوانده‌شده</span>` : ''}
        ${byStatus.planned ? `<span class="media-stat"><strong>${toFa(byStatus.planned)}</strong> در برنامه</span>` : ''}
      `;
    }

    const tagSet = new Set();
    (DATA.papers || []).forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
    {
      const frag = document.createDocumentFragment();
      for (const tag of tagSet) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-chip';
        btn.dataset.filter = tag;
        btn.textContent = tag;
        frag.appendChild(btn);
      }
      filtersBox?.appendChild(frag);
    }

    function compare(a, b) {
      const { sortKey, sortDir } = state;
      let av = a[sortKey], bv = b[sortKey];
      const aMissing = av == null || av === '';
      const bMissing = bv == null || bv === '';
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      av = String(av); bv = String(bv);
      const cmp = av.localeCompare(bv, 'fa');
      return sortDir === 'asc' ? cmp : -cmp;
    }

    function render() {
      let items = [...(DATA.papers || [])];
      if (state.filter !== 'all') {
        items = items.filter(p => (p.tags || []).includes(state.filter));
      }
      items.sort(compare);

      if (!items.length) {
        grid.innerHTML = '';
        if (empty) empty.hidden = false;
        return;
      }
      grid.innerHTML = items.map(paperCardHTML).join('');
      if (empty) empty.hidden = true;
      setupReveal();
    }

    sortSelect?.addEventListener('change', () => {
      const [key, dir] = sortSelect.value.split('-');
      state.sortKey = key; state.sortDir = dir;
      render();
    });

    filtersBox?.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip || !filtersBox.contains(chip)) return;
      state.filter = chip.dataset.filter;
      const chips = filtersBox.querySelectorAll('.filter-chip');
      for (const c of chips) c.classList.toggle('is-active', c === chip);
      render();
    });

    render();
  }

  /* =========================================================
     ۱۰. صفحهٔ مستندات Purser
     ========================================================= */
  function setupCopyButtons(root) {
    const pres = $$('pre', root);
    if (!pres.length) return;

    for (const pre of pres) {
      if (pre.parentElement?.classList.contains('code-block') &&
          pre.parentElement.querySelector('.copy-btn')) continue;

      let wrapper = pre.closest('.code-block');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', 'کپی کد');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
        <span>کپی</span>
      `;
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code') || pre;
        const text = code.innerText;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'absolute';
          ta.style.insetInlineStart = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch {}
          ta.remove();
        }
        btn.classList.add('is-copied');
        const label = btn.querySelector('span');
        if (label) label.textContent = 'کپی شد';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (label) label.textContent = 'کپی';
        }, 1800);
      });
      wrapper.appendChild(btn);
    }
  }

  function setupInlineCopy() {
    for (const btn of $$('[data-copy]')) {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-copy');
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add('is-copied');
          setTimeout(() => btn.classList.remove('is-copied'), 1800);
        } catch {}
      });
    }
  }

  function setupScrollSpy() {
    const links = $$('.docs-toc a[href^="#"]');
    if (!links.length) return;

    const sections = links
        .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
        .filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) => {
      for (const a of links) {
        a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`);
      }
    };

    if (!('IntersectionObserver' in window)) {
      const onScroll = () => {
        const y = window.scrollY + 120;
        let current = sections[0].id;
        for (const s of sections) {
          if (s.offsetTop <= y) current = s.id;
        }
        setActive(current);
      };
      document.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return;
    }

    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry);
        else visible.delete(entry.target.id);
      }
      if (!visible.size) return;
      const top = Array.from(visible.values())
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: '-90px 0px -55% 0px', threshold: 0 });

    for (const s of sections) io.observe(s);
    setActive(sections[0].id);
  }

  function setupMobileToc() {
    const toc = document.getElementById('docsToc');
    const toggle = toc?.querySelector('.toc-toggle');
    if (!toc || !toggle) return;

    toggle.addEventListener('click', () => {
      const open = toc.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    toc.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' && window.innerWidth <= 900) {
        toc.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setupBackToTop() {
    if (document.querySelector('.back-to-top')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'بازگشت به بالا');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    `;
    document.body.appendChild(btn);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        btn.classList.toggle('is-visible', window.scrollY > 700);
        ticking = false;
      });
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function setupDocsPage() {
    if (!$('.docs-content')) return;
    const content = $('.docs-content');
    setupCopyButtons(content);
    setupInlineCopy();
    setupScrollSpy();
    setupMobileToc();
    setupBackToTop();
  }

  /* =========================================================
     ۱۱. جستجوی سراسری (Ctrl+K)
     ========================================================= */
  function buildSearchIndex() {
    const idx = [];
    const push = (type, icon, title, subtitle, url, tags) => {
      idx.push({
        type, icon,
        title: String(title || ''),
        subtitle: String(subtitle || ''),
        url,
        search: `${title || ''} ${subtitle || ''} ${(tags || []).join(' ')}`.toLowerCase(),
      });
    };

    push('صفحه', '🏠', 'خانه', 'خانهٔ دیجیتال', 'index.html');
    push('صفحه', '📁', 'پروژه‌ها', 'مشاهدهٔ همهٔ پروژه‌ها', 'projects.html');
    push('صفحه', '🎬', 'دوره‌ها', 'دوره‌های ویدیویی', 'courses.html');
    push('صفحه', '🍿', 'فیلم‌ها', 'فیلم‌هایی که دیده‌ام', 'movies.html');
    push('صفحه', '📺', 'سریال‌ها', 'سریال‌هایی که دیده‌ام', 'series.html');
    push('صفحه', '📚', 'کتاب‌ها', 'کتاب‌هایی که خوانده‌ام', 'books.html');
    push('صفحه', '📄', 'مقالات علمی', 'مقالاتی که خوانده‌ام', 'papers.html');
    push('صفحه', '🎮', 'بازی‌ها', 'بازی‌هایی که تجربه کرده‌ام', 'games.html');
    push('صفحه', '✍️', 'بلاگ', 'نوشته‌های بلند', 'blog.html');
    push('صفحه', '📝', 'یادداشت‌ها', 'یادداشت‌های کوتاه', 'notes.html');

    (DATA.projects || []).forEach(p => {
      push('پروژه', p.icon || '📦', p.title, p.subtitle || p.description,
          p.internal ? p.url : p.url, p.tags);
    });

    (DATA.courses || []).forEach(c => {
      push('دوره', '🎬', c.title, c.platform, c.url, c.tags);
    });

    (DATA.posts || []).forEach(p => {
      push('نوشته', '✍️', p.title, p.subtitle || p.excerpt, p.url, p.tags);
    });

    (DATA.notes || []).forEach(n => {
      push('یادداشت', '📝', n.text.slice(0, 60) + '…', faDate(n.date),
          `notes.html#${n.id}`, []);
    });

    (DATA.movies || []).forEach(m => {
      push('فیلم', '🍿', m.titleFa || m.title, m.title, 'movies.html#' + m.id,
          [...(m.genres || []), m.director, ...(m.cast || [])]);
    });

    (DATA.series || []).forEach(s => {
      push('سریال', '📺', s.titleFa || s.title, s.title, 'series.html#' + s.id,
          [...(s.genres || []), s.creator, ...(s.cast || [])]);
    });

    (DATA.books || []).forEach(b => {
      push('کتاب', '📚', b.titleFa || b.title, b.authorFa || b.author,
          'books.html#' + b.id, [...(b.genres || []), b.author]);
    });

    (DATA.papers || []).forEach(p => {
      push('مقاله', '📄', p.titleFa || p.title, p.venue || p.title,
          'papers.html#' + p.id, [...(p.tags || []), ...(p.authors || [])]);
    });

    (DATA.games || []).forEach(g => {
      push('بازی', '🎮', g.titleFa || g.title, g.developer || '',
          'games.html#' + g.id, [...(g.genres || []), g.developer, ...(g.platforms || [])]);
    });

    return idx;
  }

  let searchIndex = null;
  let searchActiveIdx = 0;
  let searchResults = [];

  function ensureSearchModal() {
    if (document.getElementById('searchModal')) return;

    const modal = document.createElement('div');
    modal.id = 'searchModal';
    modal.className = 'search-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'جستجو');
    modal.hidden = true;
    modal.innerHTML = `
      <div class="search-panel" role="document">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          <input id="searchInput" class="search-input" type="search"
                 placeholder="جستجو در پروژه‌ها، دوره‌ها، کتاب‌ها، یادداشت‌ها…"
                 autocomplete="off" autocorrect="off" autocapitalize="off"
                 spellcheck="false" dir="rtl">
          <button type="button" class="search-esc" id="searchClose" aria-label="بستن">ESC</button>
        </div>
        <div class="search-results" id="searchResults" role="listbox" aria-label="نتایج"></div>
        <div class="search-footer">
          <span>با <kbd>↑</kbd><kbd>↓</kbd> جابه‌جا شوید، <kbd>Enter</kbd> باز کنید.</span>
          <span id="searchCount"></span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSearch();
    });

    const input = modal.querySelector('#searchInput');
    input.addEventListener('input', () => {
      searchActiveIdx = 0;
      renderSearchResults(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        searchActiveIdx = Math.min(searchActiveIdx + 1, searchResults.length - 1);
        updateSearchActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
        updateSearchActive();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = searchResults[searchActiveIdx];
        if (item) window.location.href = item.url;
      }
    });

    modal.querySelector('#searchClose').addEventListener('click', closeSearch);
  }

  function openSearch() {
    ensureSearchModal();
    if (!searchIndex) searchIndex = buildSearchIndex();

    const modal = document.getElementById('searchModal');
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.body.classList.add('search-open');

    const input = document.getElementById('searchInput');
    input.value = '';
    input.focus();
    renderSearchResults('');
  }

  function closeSearch() {
    const modal = document.getElementById('searchModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('search-open');
    setTimeout(() => { modal.hidden = true; }, 200);
  }

  function renderSearchResults(query) {
    const resultsBox = document.getElementById('searchResults');
    const countBox = document.getElementById('searchCount');
    if (!resultsBox) return;

    const q = query.trim().toLowerCase();

    if (!q) {
      searchResults = searchIndex
          .filter(x => x.type === 'صفحه' || x.type === 'پروژه')
          .slice(0, 8);
    } else {
      searchResults = searchIndex
          .map(item => {
            const inTitle = item.title.toLowerCase().includes(q);
            const inSearch = item.search.includes(q);
            const score = inTitle ? 2 : (inSearch ? 1 : 0);
            return { item, score };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map(x => x.item);
    }

    searchActiveIdx = 0;

    if (!searchResults.length) {
      resultsBox.innerHTML = `
        <div class="search-empty">
          نتیجه‌ای برای «<strong>${escape(query)}</strong>» پیدا نشد.
        </div>
      `;
      if (countBox) countBox.textContent = '';
      return;
    }

    const groups = {};
    for (const item of searchResults) {
      (groups[item.type] = groups[item.type] || []).push(item);
    }

    let html = '';
    let idx = 0;
    for (const type of Object.keys(groups)) {
      html += `<div class="search-group">${escape(type)}</div>`;
      for (const item of groups[type]) {
        const isActive = idx === 0 ? ' is-active' : '';
        html += `
          <a class="search-item${isActive}" href="${escape(item.url)}"
             role="option" data-index="${idx}">
            <span class="search-item-icon" aria-hidden="true">${item.icon}</span>
            <span class="search-item-body">
              <span class="search-item-title">${escape(item.title)}</span>
              ${item.subtitle ? `<span class="search-item-sub" dir="auto">${escape(item.subtitle)}</span>` : ''}
            </span>
            <span class="search-item-arrow" aria-hidden="true">←</span>
          </a>
        `;
        idx++;
      }
    }
    resultsBox.innerHTML = html;

    if (countBox) countBox.textContent = `${toFa(searchResults.length)} نتیجه`;

    resultsBox.querySelectorAll('.search-item').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        searchActiveIdx = Number(el.dataset.index);
        updateSearchActive();
      });
    });
  }

  function updateSearchActive() {
    const items = document.querySelectorAll('.search-item');
    items.forEach((el, i) => el.classList.toggle('is-active', i === searchActiveIdx));
    const active = items[searchActiveIdx];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function setupSearchButton() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    if (headerActions.querySelector('.search-trigger')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-trigger';
    btn.setAttribute('aria-label', 'باز کردن جستجو');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      <span class="search-text">جستجو…</span>
      <kbd>Ctrl K</kbd>
    `;
    btn.addEventListener('click', openSearch);

    const themeBtn = headerActions.querySelector('#themeToggle');
    if (themeBtn) headerActions.insertBefore(btn, themeBtn);
    else headerActions.appendChild(btn);
  }

  function setupSearchShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === '/' &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) &&
          !e.target.isContentEditable) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === 'Escape') {
        const modal = document.getElementById('searchModal');
        if (modal && !modal.hidden) closeSearch();
      }
    });
  }

  /* =========================================================
     ۱۲. سال فوتر
     ========================================================= */
  function renderYear() {
    const el = document.getElementById('year');
    if (!el) return;
    try {
      el.textContent = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date());
    } catch {}
  }

  /* =========================================================
     ۱۳. راه‌اندازی
     ========================================================= */
  function init() {
    /* ابتدا همهٔ رندرها */
    renderStats();
    renderHomeProjects();
    renderProjectsGrid();
    renderCoursesGrid();
    renderHomePosts();
    renderNotesTimeline();
    renderMoviesPage();
    renderSeriesPage();
    renderGamesPage();
    bindBooksToolbar();
    renderPapersPage();
    renderYear();

    /* سپس observerها */
    setupReveal();
    setupStatsCounter();

    /* در نهایت تنظیمات تعاملی */
    setupDocsPage();
    setupBlogFilters();
    setupSearchButton();
    setupSearchShortcuts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();