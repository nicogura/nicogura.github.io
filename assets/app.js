'use strict';

(() => {
  const page = document.body.dataset.page || 'home';
  const base = new URL(document.querySelector('meta[name="site-base"]')?.content || './', document.baseURI);
  const href = (path = '') => new URL(path, base).href;
  const main = document.getElementById('page-content');
  const bookmarkKey = 'nicogura-bookmarks-v1';
  const themeKey = 'nicogura-theme';
  const symbols = {
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    moon: 'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z',
    sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
    chevron: 'm6 9 6 6 6-6',
    book: 'M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4V3Zm16 0h-3a3 3 0 0 0-3 3m0 15a4 4 0 0 1 4-2h2V3Z',
    star: 'm12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z',
    link: 'm10 13 4-4m-7 5-2 2a4 4 0 0 0 6 6l5-5a4 4 0 0 0 0-6m1-1 2-2a4 4 0 0 0-6-6l-5 5a4 4 0 0 0 0 6',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 2',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-5',
    up: 'm6 15 6-6 6 6',
    check: 'm5 12 4 4L19 6',
    external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  };
  let data;
  let categoryMap = new Map();
  let bookmarks = new Set();
  let toastTimer;
  let tocObserver;
  let filterTimer;
  let views;
  let tokens = [];
  const openRules = new Set();
  const state = { query: '', category: 'all', savedOnly: false };
  const severityLabels = { guide: 'ガイド', notice: 'お願い', important: '注意', prohibited: '禁止', serious: '重大違反' };
  function ruleSeverity(rule) {
    if (Object.hasOwn(severityLabels, rule.severity)) return rule.severity;
    return ({ normal: 'guide', important: 'important', prohibited: 'prohibited', warning: 'important', supplement: 'guide', exception: 'notice' })[rule.importance] || 'guide';
  }

  // All values from JSON enter the page through text nodes, never HTML.
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', symbols[name] || symbols.arrow);
    svg.append(path);
    return svg;
  }
  function button(text, className, handler, symbol) {
    const node = el('button', className);
    node.type = 'button';
    if (symbol) node.append(icon(symbol));
    if (text) node.append(el('span', '', text));
    if (handler) node.addEventListener('click', handler);
    return node;
  }
  function link(text, path, className, symbol) {
    const node = el('a', className);
    node.href = href(path);
    if (text) node.append(el('span', '', text));
    if (symbol) node.append(icon(symbol));
    return node;
  }
  function externalUrl(value) {
    try {
      const parsed = new URL(value);
      return /^https?:$/.test(parsed.protocol) ? parsed.href : null;
    } catch (_) { return null; }
  }
  function socialLink(label, key, className = 'button button-secondary') {
    const url = externalUrl(data.site.links?.[key]);
    if (!url) {
      const node = el('span', `${className} disabled-link`, `${label} · 準備中`);
      node.title = '公式URLは運営確認中です';
      return node;
    }
    const node = el('a', className, label);
    node.href = url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.append(icon('external'));
    node.setAttribute('aria-label', `${label}（新しいタブで開く）`);
    return node;
  }
  function asset(name, fallback) {
    const value = data.site.assets?.[name] || fallback;
    try {
      const parsed = new URL(value, base);
      return /^https?:$/.test(parsed.protocol) && parsed.origin === base.origin ? parsed.href : href(fallback);
    } catch (_) { return href(fallback); }
  }
  function dateText(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.replaceAll('-', '.') : '確認中'; }
  function time(value, className = '') {
    const node = el('time', className, dateText(value));
    if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) node.dateTime = value;
    return node;
  }
  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => { toast.classList.remove('is-visible'); toast.textContent = ''; }, 4200);
  }
  function scrollToNode(node) {
    if (!node) return;
    node.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  function readBookmarks() {
    try {
      const stored = JSON.parse(localStorage.getItem(bookmarkKey) || '[]');
      if (Array.isArray(stored)) bookmarks = new Set(stored.filter(id => typeof id === 'string' && data.rules.some(rule => rule.id === id)));
    } catch (_) { bookmarks = new Set(); }
  }
  function saveBookmarks() {
    try { localStorage.setItem(bookmarkKey, JSON.stringify([...bookmarks])); return true; }
    catch (_) { return false; }
  }
  function normalize(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('ja'); }
  function textIndex(rule) {
    const category = categoryMap.get(rule.category);
    const severity = ruleSeverity(rule);
    return normalize([rule.title, rule.number, rule.summary, category?.label, category?.shortLabel, severity, severityLabels[severity], ...(rule.tags || []), ...(rule.keywords || []), ...(rule.content || []).flatMap(block => [block.text || '', block.caption || '', ...(block.items || []), ...(block.headers || []), ...(block.rows || []).flat()])].join(' '));
  }
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  function highlighted(text, className = '', tag = 'span') {
    const node = el(tag, className);
    text = String(text || '');
    if (!tokens.length) { node.textContent = text; return node; }
    // Map normalized graphemes back to their original offsets (e.g. full-width PD).
    const segments = segmenter ? [...segmenter.segment(text)].map(part => ({ text: part.segment, start: part.index })) : (() => {
      let offset = 0;
      return Array.from(text.matchAll(/\P{M}\p{M}*|\p{M}+/gu), match => { const part = { text: match[0], start: offset }; offset += match[0].length; return part; });
    })();
    let normalized = '';
    const offsets = [];
    segments.forEach(part => {
      const normalizedPart = normalize(part.text);
      normalized += normalizedPart;
      for (let index = 0; index < normalizedPart.length; index++) offsets.push([part.start, part.start + part.text.length]);
    });
    const ranges = [];
    for (const token of tokens) {
      let cursor = 0;
      while (cursor < normalized.length) {
        const match = normalized.indexOf(token, cursor);
        if (match < 0) break;
        if (offsets[match] && offsets[match + token.length - 1]) ranges.push([offsets[match][0], offsets[match + token.length - 1][1]]);
        cursor = match + Math.max(1, token.length);
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(range => {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    });
    let cursor = 0;
    merged.forEach(([start, end]) => {
      node.append(document.createTextNode(text.slice(cursor, start)), el('mark', '', text.slice(start, end)));
      cursor = end;
    });
    node.append(document.createTextNode(text.slice(cursor)));
    return node;
  }
  function notice() {
    const node = el('aside', 'notice');
    node.setAttribute('aria-label', '重要なお知らせ');
    node.append(icon('shield'), el('div', 'notice-copy', data.site.notice));
    return node;
  }
  function metaRow() {
    const node = el('div', 'meta-row');
    const updated = el('span', 'meta-item');
    updated.append(icon('clock'), el('span', '', '最終更新 '), time(data.site.updatedAt));
    node.append(el('span', 'badge status-badge', `ルール v${data.site.version}`), updated);
    return node;
  }
  function sectionHeading(kicker, title, description) {
    const head = el('div', 'section-heading');
    const copy = el('div', 'section-heading-copy');
    copy.append(el('p', 'section-kicker', kicker), el('h2', '', title));
    if (description) copy.append(el('p', 'section-description', description));
    head.append(copy);
    return head;
  }
  function changeType(value) { return ({ addition: '追加', change: '変更', removal: '削除', notice: 'お知らせ' })[value] || value; }
  function displayNumber(rule) {
    const n = Number(rule.number) || data.categories.findIndex(category => category.id === rule.category) + 1;
    const number = String(n).padStart(2, '0');
    return rule.status === 'published' ? number : `PREP ${number}`;
  }
  function initChrome() {
    const skipLink = document.querySelector('.skip-link');
    if (page === '404' && skipLink) skipLink.href = `${location.pathname}${location.search}#main-content`;
    const header = document.getElementById('site-header');
    const inner = el('div', 'shell header-inner');
    const brand = link('', '', 'brand');
    brand.setAttribute('aria-label', 'NicoGura ホーム');
    const logo = el('img', 'brand-logo');
    logo.src = asset('logo', 'assets/logo.webp');
    logo.alt = 'NicoGura';
    logo.width = 144;
    logo.height = 44;
    logo.addEventListener('error', () => { logo.hidden = true; brand.append(el('span', 'brand-name', 'NicoGura')); }, { once: true });
    brand.append(logo);
    const navItems = [['HOME', '', 'home'], ['RULES', 'rules/', 'rules'], ['CHANGELOG', 'changelog/', 'changelog']];
    function makeNav(className) {
      const nav = el('nav', className);
      nav.setAttribute('aria-label', 'メインナビゲーション');
      navItems.forEach(([name, path, key]) => {
        const node = link(name, path, 'nav-link');
        if (page === key) node.setAttribute('aria-current', 'page');
        nav.append(node);
      });
      return nav;
    }
    const actions = el('div', 'header-actions');
    const search = button('', 'icon-button header-search', () => {
      if (page === 'rules' && views) { views.input.focus(); scrollToNode(views.searchBox); }
      else location.href = href('rules/?focus=search');
    }, 'search');
    search.setAttribute('aria-label', 'ルールを検索');
    const theme = button('', 'icon-button theme-toggle', () => {
      const selected = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = selected;
      document.documentElement.style.colorScheme = selected;
      try { localStorage.setItem(themeKey, selected); } catch (_) { notify('テーマ設定はこの画面を開いている間だけ保持されます。'); }
      refreshTheme();
    });
    function refreshTheme() {
      const dark = document.documentElement.dataset.theme === 'dark';
      theme.replaceChildren(icon(dark ? 'sun' : 'moon'));
      theme.setAttribute('aria-label', dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
      theme.title = dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
    }
    refreshTheme();
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', event => {
      let explicit;
      try { explicit = localStorage.getItem(themeKey); } catch (_) { explicit = null; }
      if (explicit === 'dark' || explicit === 'light') return;
      document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
      document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
      refreshTheme();
    });
    const mobile = el('div', 'mobile-menu');
    mobile.id = 'mobile-menu';
    mobile.hidden = true;
    mobile.append(makeNav('mobile-nav'));
    const socials = el('div', 'mobile-socials');
    socials.append(socialLink('Discord', 'discord'), socialLink('X', 'x'));
    mobile.append(socials);
    const menu = button('', 'icon-button menu-toggle', () => setMenu(mobile.hidden), 'menu');
    menu.setAttribute('aria-label', 'メニューを開く');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-controls', mobile.id);
    function setMenu(open) {
      mobile.hidden = !open;
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      menu.replaceChildren(icon(open ? 'close' : 'menu'));
    }
    document.addEventListener('click', event => { if (!header.contains(event.target)) setMenu(false); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobile.hidden) { setMenu(false); menu.focus(); } });
    mobile.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
    actions.append(search, socialLink('Discord', 'discord', 'button button-discord header-discord'), theme, menu);
    inner.append(brand, makeNav('header-nav'), actions);
    header.replaceChildren(inner, mobile);
    const footer = document.getElementById('site-footer');
    const footerInner = el('div', 'shell footer-inner');
    const footerBrand = el('div', 'footer-brand');
    footerBrand.append(link(data.site.name || 'NicoGura', '', 'brand-name'), el('p', '', data.site.tagline || 'あなたらしい物語が、この街から。'));
    const links = el('nav', 'footer-links');
    links.setAttribute('aria-label', 'フッターナビゲーション');
    links.append(link('HOME', ''), link('RULES', 'rules/'), link('CHANGELOG', 'changelog/'), socialLink('Discord', 'discord', 'footer-social'), socialLink('X', 'x', 'footer-social'));
    const note = el('div', 'footer-note');
    note.append(el('span', '', `ルール v${data.site.version} · 最終更新 ${dateText(data.site.updatedAt)}`), el('p', '', '確認済みの内容から更新します。「運営確認中」は確定したルールではありません。'), el('small', '', `© ${new Date().getFullYear()} NicoGura. All rights reserved.`));
    footerInner.append(footerBrand, links, note);
    footer.replaceChildren(footerInner);
    const top = document.getElementById('back-to-top');
    if (top) {
      top.replaceChildren(icon('up'));
      top.setAttribute('aria-label', 'ページの先頭へ戻る');
      top.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        document.querySelector('.skip-link')?.focus({ preventScroll: true });
      });
    }
    const refreshScroll = () => { header.classList.toggle('is-scrolled', scrollY > 24); if (top) top.hidden = scrollY < 450; };
    window.addEventListener('scroll', refreshScroll, { passive: true });
    refreshScroll();
    window.addEventListener('storage', event => {
      if (event.key === bookmarkKey) { readBookmarks(); if (views) renderResults(); }
      if (event.key === themeKey) {
        const value = event.newValue;
        document.documentElement.dataset.theme = value === 'dark' || value === 'light' ? value : scheme.matches ? 'dark' : 'light';
        document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
        refreshTheme();
      }
    });
  }
  function heroArt(className = 'hero-art') {
    const img = el('img', className);
    img.src = asset('header', 'assets/city.webp');
    img.alt = '';
    img.width = 1280;
    img.height = 720;
    img.fetchPriority = 'high';
    img.decoding = 'async';
    return img;
  }
  function renderHome() {
    const hero = el('section', 'hero home-hero');
    const heroCopy = el('div', 'hero-copy');
    const kicker = el('p', 'eyebrow');
    kicker.append(el('span', 'status-dot'), document.createTextNode('WELCOME TO NICOGURA'));
    const title = el('h1', 'hero-title');
    title.append(document.createTextNode('この街で、'), el('br'), el('span', 'text-gradient', 'あなたらしい物語を。'));
    const lead = el('p', 'hero-lead', 'にこぐらへようこそ。暮らしも、出会いも、あなたの物語の一部に。NicoGuraの公式情報を、この場所から。');
    const actions = el('div', 'hero-actions');
    actions.append(link('ルール・ガイドラインを見る', 'rules/', 'button button-primary', 'arrow'), socialLink('Discordへ', 'discord', 'button button-secondary'));
    const homeSearch = el('form', 'search-box home-search');
    homeSearch.setAttribute('role', 'search');
    homeSearch.action = href('rules/');
    const searchLabel = el('label', 'visually-hidden', 'ホームからルールを検索');
    searchLabel.htmlFor = 'home-rule-search';
    const searchInput = el('input', 'search-input');
    searchInput.id = 'home-rule-search';
    searchInput.name = 'q';
    searchInput.type = 'search';
    searchInput.maxLength = 500;
    searchInput.placeholder = '気になるルールを検索…';
    const searchSubmit = button('', 'icon-button', null, 'arrow');
    searchSubmit.type = 'submit';
    searchSubmit.setAttribute('aria-label', '検索結果を見る');
    homeSearch.append(searchLabel, icon('search'), searchInput, searchSubmit);
    homeSearch.addEventListener('submit', event => {
      event.preventDefault();
      location.href = href(`rules/?q=${encodeURIComponent(searchInput.value.trim())}`);
    });
    heroCopy.append(kicker, title, lead, actions, homeSearch, metaRow());
    hero.append(heroArt(), el('div', 'hero-overlay'), heroCopy);
    const content = el('div', 'home-content');
    content.append(notice());
    const published = data.rules.filter(rule => rule.status === 'published').length;
    const stats = el('div', 'stat-strip');
    [[`${published}`, '正式掲載ルール'], [`${data.categories.length}`, 'カテゴリー'], ['FREE', 'いつでも、すぐに確認']].forEach(([value, label]) => {
      const item = el('div', 'stat-item');
      item.append(el('strong', 'stat-value', value), el('span', 'stat-label', label));
      stats.append(item);
    });
    content.append(stats);
    const quick = el('section', 'home-section');
    quick.append(sectionHeading('EXPLORE THE CITY', 'この街のことを、もっと。', '知りたい情報に、迷わずたどり着ける公式ガイド。'));
    const grid = el('div', 'home-grid');
    [['book', 'RULES & GUIDELINES', '街のルールを探す', 'カテゴリーと全文検索から、必要な情報をすぐに。', 'rules/'], ['clock', 'CHANGELOG', '最新の更新を確認', '掲載・変更された内容を、時系列で確認できます。', 'changelog/'], ['star', 'YOUR BOOKMARKS', 'あとで読むを、手元に', '気になるルールを保存して、自分だけの一覧に。', 'rules/?saved=1']].forEach(([symbol, kicker, title, description, path]) => {
      const card = link('', path, 'feature-card');
      const featureIcon = el('div', 'feature-icon');
      featureIcon.append(icon(symbol));
      card.append(featureIcon);
      card.append(el('p', 'section-kicker', kicker), el('h3', '', title), el('p', '', description), el('span', 'section-link', '見る '));
      card.lastChild.append(icon('arrow'));
      grid.append(card);
    });
    quick.append(grid);
    content.append(quick);
    const categories = el('section', 'home-section');
    const categoryHead = el('div', 'section-head');
    categoryHead.append(sectionHeading('FIND YOUR WAY', 'カテゴリーから探す', '知りたい場面や仕事から、必要なルールへ。'), link('すべてのカテゴリー', 'rules/#categories', 'section-link', 'arrow'));
    categories.append(categoryHead);
    const categoryGrid = el('div', 'home-grid category-grid');
    const selected = ['basic', 'rp', 'crime', 'pd', 'ems', 'business'];
    selected.forEach((id, index) => {
      const category = categoryMap.get(id);
      if (!category) return;
      const card = link('', `rules/?category=${encodeURIComponent(id)}`, 'category-card');
      card.append(el('span', 'category-index', String(index + 1).padStart(2, '0')), el('div', 'category-card-copy'));
      const categoryCount = data.rules.filter(rule => rule.category === id && rule.status === 'published').length;
      card.lastChild.append(el('h3', '', category.label), el('span', 'category-meta', `${categoryCount} 件のルール`));
      card.append(icon('arrow'));
      categoryGrid.append(card);
    });
    categories.append(categoryGrid);
    content.append(categories);
    const news = el('section', 'home-section home-news');
    const newsHead = el('div', 'section-head');
    newsHead.append(sectionHeading('LATEST NEWS', '街からのお知らせ'), link('更新履歴を見る', 'changelog/', 'section-link', 'arrow'));
    news.append(newsHead);
    const latest = [...data.changelog].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latest) {
      const entry = link('', 'changelog/', 'changelog-entry news-entry');
      entry.append(time(latest.date), el('span', 'badge', changeType(latest.type)), el('h3', '', latest.title), icon('arrow'));
      news.append(entry);
    } else news.append(el('p', 'empty-state', 'お知らせは準備中です。'));
    content.append(news);
    const future = el('section', 'home-section future-section');
    future.append(sectionHeading('NEXT CHAPTER', '街のガイドも、これから。', 'GUIDE・JOBS・CITYなどの公式コンテンツは、確認できた情報から順次ご案内します。'));
    const tags = el('div', 'future-tags');
    ['GUIDE', 'JOBS', 'CITY'].forEach(label => tags.append(el('span', 'badge', `${label} · 準備中`)));
    future.append(tags);
    content.append(future);
    main.replaceChildren(hero, content);
  }
  function searchBox() {
    const box = el('div', 'search-box');
    const label = el('label', 'visually-hidden', 'ルールを全文検索');
    label.htmlFor = 'rule-search';
    const input = el('input', 'search-input');
    input.id = 'rule-search';
    input.type = 'search';
    input.maxLength = 500;
    input.autocomplete = 'off';
    input.placeholder = 'キーワードでルールを検索…';
    input.setAttribute('aria-describedby', 'search-hint');
    const clear = button('', 'icon-button search-clear', () => { input.value = ''; state.query = ''; applyFilters(); input.focus(); }, 'close');
    clear.setAttribute('aria-label', '検索をクリア');
    clear.hidden = !state.query;
    box.append(label, icon('search'), input, clear);
    input.value = state.query;
    input.addEventListener('input', () => {
      clearTimeout(filterTimer);
      state.query = input.value;
      clear.hidden = !state.query;
      filterTimer = setTimeout(applyFilters, 90);
    });
    return { box, input, clear };
  }
  function readFiltersFromUrl() {
    const params = new URL(location.href).searchParams;
    state.query = (params.get('q') || '').slice(0, 500);
    state.category = categoryMap.has(params.get('category')) ? params.get('category') : 'all';
    state.savedOnly = params.get('saved') === '1';
  }
  function reflectUrl() {
    const url = new URL(location.href);
    state.query.trim() ? url.searchParams.set('q', state.query.trim()) : url.searchParams.delete('q');
    state.category !== 'all' ? url.searchParams.set('category', state.category) : url.searchParams.delete('category');
    state.savedOnly ? url.searchParams.set('saved', '1') : url.searchParams.delete('saved');
    url.searchParams.delete('focus');
    history.replaceState({}, '', url);
  }
  function renderRules() {
    readFiltersFromUrl();
    const focused = new URL(location.href).searchParams.get('focus') === 'search';
    const shell = el('div', 'rules-page');
    const hero = el('section', 'hero rules-hero');
    const heroCopy = el('div', 'hero-copy hero-panel');
    const published = data.rules.filter(rule => rule.status === 'published').length;
    const title = el('h1', 'hero-title');
    title.append(document.createTextNode('この街のルールを、'), el('br'), el('span', 'text-gradient', '迷わず、あなたに。'));
    heroCopy.append(el('p', 'eyebrow', 'NICOGURA / OFFICIAL RULES'), title, el('p', 'hero-lead', 'にこぐらで楽しく過ごすためのルール・ガイドライン。カテゴリーとキーワードから、必要な情報へ。'), metaRow());
    const search = searchBox();
    heroCopy.append(search.box);
    const hint = el('p', 'search-hint', 'タイトル・本文・カテゴリー・キーワードから検索。複数の言葉で絞り込みできます。');
    hint.id = 'search-hint';
    heroCopy.append(hint);
    hero.append(heroCopy);
    shell.append(hero, notice());
    const featured = data.settings.featuredRuleIds?.length ? data.settings.featuredRuleIds : data.rules.filter(rule => rule.featured && rule.status === 'published').map(rule => rule.id);
    if (featured?.length) {
      const quick = el('nav', 'featured-links');
      quick.setAttribute('aria-label', 'ピックアップルール');
      quick.append(el('span', 'section-kicker', 'QUICK ACCESS'));
      featured.forEach(id => {
        const rule = data.rules.find(item => item.id === id);
        if (rule?.status === 'published') quick.append(link(rule.title, `rules/#${encodeURIComponent(rule.id)}`, 'pill'));
      });
      shell.append(quick);
    }
    const categorySection = el('section', 'category-section');
    categorySection.id = 'categories';
    const categoryTitle = el('div', 'category-section-head');
    categoryTitle.append(el('h2', 'category-heading', 'カテゴリー'), el('span', 'category-meta', `正式掲載 ${published} 件 · ${data.categories.length} カテゴリー${published ? '' : '（仮）'}`));
    const pills = el('div', 'category-pills');
    pills.setAttribute('aria-label', 'ルールカテゴリー');
    const pillButtons = new Map();
    [{ id: 'all', shortLabel: 'すべて' }, ...data.categories].forEach(category => {
      const pill = button(category.shortLabel || category.label, 'pill', () => {
        state.category = category.id;
        applyFilters();
      });
      pill.setAttribute('aria-pressed', String(state.category === category.id));
      pillButtons.set(category.id, pill);
      pills.append(pill);
    });
    categorySection.append(categoryTitle, pills);
    shell.append(categorySection);
    const layout = el('div', 'rules-layout');
    const categorySidebar = el('aside', 'rules-category-sidebar');
    categorySidebar.setAttribute('aria-labelledby', 'desktop-category-title');
    const sideTitle = el('h2', 'toc-heading', 'カテゴリー');
    sideTitle.id = 'desktop-category-title';
    const categoryNav = el('nav', 'category-side-nav');
    categoryNav.setAttribute('aria-label', 'ルールカテゴリー（デスクトップ）');
    const desktopCategoryButtons = new Map();
    let currentGroup;
    [{ id: 'all', label: 'すべて', group: '' }, ...data.categories].forEach(category => {
      if (category.group && currentGroup !== category.group) {
        currentGroup = category.group;
        categoryNav.append(el('p', 'category-side-group', category.group));
      }
      const node = button(category.label, 'category-side-link', () => { state.category = category.id; applyFilters(); });
      node.setAttribute('aria-pressed', String(state.category === category.id));
      desktopCategoryButtons.set(category.id, node);
      categoryNav.append(node);
    });
    categorySidebar.append(sideTitle, categoryNav);
    const sidebar = el('aside', 'rules-sidebar');
    sidebar.setAttribute('aria-labelledby', 'desktop-toc-title');
    const tocTitle = el('h2', 'toc-heading', 'このページの目次');
    tocTitle.id = 'desktop-toc-title';
    const toc = el('nav', 'toc-list');
    toc.setAttribute('aria-label', 'ルールの目次');
    const tocNote = el('p', 'toc-note', 'PREPは運営確認中の項目です。正式なルールとは区別しています。');
    sidebar.append(tocTitle, toc, tocNote);
    const rulesMain = el('section', 'rules-main');
    rulesMain.setAttribute('aria-label', 'ルール一覧');
    const toolbar = el('div', 'rules-toolbar');
    const count = el('p', 'result-count');
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
    const tools = el('div', 'toolbar-actions');
    const saved = button('保存したルール', 'button button-small bookmark-filter', () => { state.savedOnly = !state.savedOnly; applyFilters(); }, 'star');
    saved.setAttribute('aria-pressed', String(state.savedOnly));
    const expand = button('すべて展開', 'button button-small button-secondary', () => {
      views.list.querySelectorAll('details').forEach(detail => { detail.open = true; openRules.add(detail.id); });
    });
    const collapse = button('すべて閉じる', 'button button-small button-secondary', () => {
      views.list.querySelectorAll('details').forEach(detail => { detail.open = false; openRules.delete(detail.id); });
    });
    tools.append(saved, expand, collapse);
    toolbar.append(count, tools);
    const mobileToc = el('details', 'mobile-toc');
    const mobileSummary = el('summary');
    mobileSummary.append(icon('list'), el('span', '', 'このページの目次'), icon('chevron'));
    const mobileNav = el('nav', 'toc-list');
    mobileNav.setAttribute('aria-label', 'ルールの目次（モバイル）');
    mobileToc.append(mobileSummary, mobileNav);
    const list = el('div', 'rule-list');
    list.id = 'rule-list';
    rulesMain.append(toolbar, mobileToc, list);
    layout.append(categorySidebar, rulesMain, sidebar);
    shell.append(layout);
    main.replaceChildren(shell);
    views = { input: search.input, searchBox: search.box, clear: search.clear, pillButtons, desktopCategoryButtons, saved, count, list, toc, mobileNav, mobileToc, expand, collapse };
    renderResults();
    window.addEventListener('hashchange', () => openDeepLink(true));
    window.addEventListener('popstate', () => {
      readFiltersFromUrl();
      views.input.value = state.query;
      renderResults();
      openDeepLink(true);
    });
    if (!openDeepLink(false) && focused) { views.input.focus(); scrollToNode(views.searchBox); reflectUrl(); }
  }
  function applyFilters() {
    clearTimeout(filterTimer);
    // An old anchor must not silently override an intentional new filter.
    const url = new URL(location.href);
    if (url.hash) { url.hash = ''; history.replaceState({}, '', url); }
    reflectUrl();
    renderResults();
  }
  function ruleBadge(rule) {
    if (rule.status !== 'published') return el('span', 'badge status-badge', '運営確認中');
    const severity = ruleSeverity(rule);
    return highlighted(severityLabels[severity], `badge badge-severity-${severity}`);
  }
  function recentBadge(rule) {
    if (rule.status !== 'published') return null;
    const stamp = Date.parse(`${rule.updatedAt}T00:00:00+09:00`);
    const maxDays = Math.max(0, Number(data.settings.newBadgeDays) || 0);
    const elapsed = (Date.now() - stamp) / 86400000;
    if (!Number.isFinite(stamp) || elapsed < 0 || elapsed > maxDays) return null;
    return el('span', 'badge badge-new', rule.new ? 'NEW' : 'UPDATED');
  }
  function ruleCard(rule) {
    const severity = ruleSeverity(rule);
    const details = el('details', `rule-card severity-${severity} importance-${rule.importance || 'normal'} ${rule.status === 'published' ? 'is-published' : 'is-pending'}`);
    details.dataset.importance = rule.importance || 'normal';
    details.dataset.severity = severity;
    details.id = rule.id;
    details.open = openRules.has(rule.id);
    const summary = el('summary', 'rule-summary');
    const number = el('div', 'rule-number');
    if (rule.status !== 'published') number.append(el('small', '', 'PREP'));
    number.append(highlighted(displayNumber(rule).replace(/^PREP /, ''), '', 'span'));
    summary.append(number);
    const copy = el('div', 'rule-summary-copy');
    const labels = el('div', 'rule-labels');
    labels.append(highlighted(categoryMap.get(rule.category)?.label || rule.category, 'rule-category'));
    const badge = ruleBadge(rule);
    if (badge) labels.append(badge);
    const recent = recentBadge(rule);
    if (recent) labels.append(recent);
    copy.append(labels, highlighted(rule.title, 'rule-title', 'h3'), highlighted(rule.summary, 'rule-excerpt', 'p'));
    summary.append(copy, icon('chevron'));
    summary.lastChild.classList.add('rule-chevron');
    const body = el('div', 'rule-body');
    (rule.content || []).forEach(block => {
      if (block.type === 'list') {
        const list = el('ul', 'rule-content-list');
        (block.items || []).forEach(item => list.append(highlighted(item, '', 'li')));
        body.append(list);
      } else if (block.type === 'heading') body.append(highlighted(block.text, '', 'h4'));
      else if (block.type === 'note') body.append(highlighted(block.text, 'rule-note', 'aside'));
      else if (block.type === 'table') {
        const scroll = el('div', 'rule-table-scroll');
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', `${block.caption || rule.title}の表（横にスクロールできます）`);
        const table = el('table', 'rule-table');
        if (block.caption) table.append(highlighted(block.caption, '', 'caption'));
        else table.setAttribute('aria-label', rule.title);
        const thead = el('thead');
        const headings = el('tr');
        (block.headers || []).forEach(text => { const cell = highlighted(text, '', 'th'); cell.scope = 'col'; headings.append(cell); });
        thead.append(headings);
        const tbody = el('tbody');
        (block.rows || []).forEach(row => {
          const tr = el('tr');
          row.forEach((text, index) => {
            const cell = highlighted(text, '', index === 0 ? 'th' : 'td');
            if (index === 0) cell.scope = 'row';
            tr.append(cell);
          });
          tbody.append(tr);
        });
        table.append(thead, tbody);
        scroll.append(table);
        body.append(scroll);
      }
      else body.append(highlighted(block.text, '', 'p'));
    });
    if (rule.tags?.length) {
      const tags = el('div', 'rule-tags');
      rule.tags.forEach(tag => tags.append(highlighted(tag, 'badge tag')));
      body.append(tags);
    }
    const footer = el('div', 'rule-footer');
    const updated = el('span', 'rule-date');
    updated.append(document.createTextNode('更新 '), time(rule.updatedAt));
    const actions = el('div', 'rule-actions');
    const save = button('', 'button button-small bookmark-button', () => {
      bookmarks.has(rule.id) ? bookmarks.delete(rule.id) : bookmarks.add(rule.id);
      const persisted = saveBookmarks();
      refreshBookmark();
      if (state.savedOnly) renderResults();
      const count = bookmarks.size;
      views.saved.title = `保存済み ${count} 件`;
      notify(persisted ? (bookmarks.has(rule.id) ? 'あとで読むに保存しました。' : '保存を解除しました。') : '保存情報はこの画面を開いている間だけ保持されます。');
    });
    function refreshBookmark() {
      const active = bookmarks.has(rule.id);
      save.replaceChildren(icon('star'), el('span', '', active ? '保存済み' : 'あとで読む'));
      save.setAttribute('aria-pressed', String(active));
      save.setAttribute('aria-label', `${rule.title}を${active ? '保存から解除' : 'あとで読むに保存'}`);
    }
    refreshBookmark();
    const copyLink = button('リンクをコピー', 'button button-small button-secondary copy-link', () => copyRuleUrl(rule), 'link');
    copyLink.setAttribute('aria-label', `${rule.title}のリンクをコピー`);
    actions.append(save, copyLink);
    footer.append(updated, actions);
    body.append(footer);
    details.append(summary, body);
    details.addEventListener('toggle', () => { details.open ? openRules.add(rule.id) : openRules.delete(rule.id); });
    return details;
  }
  function renderResults() {
    tokens = [...new Set(normalize(state.query).trim().split(/\s+/u).filter(Boolean))];
    const matches = data.rules.filter(rule => (state.category === 'all' || rule.category === state.category) && (!state.savedOnly || bookmarks.has(rule.id)) && tokens.every(token => rule._search.includes(token)));
    const category = categoryMap.get(state.category);
    const context = state.savedOnly ? '保存したルール' : category?.label || 'すべて';
    views.count.replaceChildren(el('strong', '', String(matches.length)), document.createTextNode(` 件 · ${context}${tokens.length ? ' / 検索結果' : ''}`));
    views.saved.setAttribute('aria-pressed', String(state.savedOnly));
    views.saved.title = `保存済み ${bookmarks.size} 件`;
    views.clear.hidden = !state.query;
    views.pillButtons.forEach((node, id) => {
      node.setAttribute('aria-pressed', String(state.category === id));
      node.classList.toggle('is-active', state.category === id);
    });
    views.desktopCategoryButtons.forEach((node, id) => {
      node.setAttribute('aria-pressed', String(state.category === id));
      node.classList.toggle('is-active', state.category === id);
    });
    const fragment = document.createDocumentFragment();
    matches.forEach(rule => fragment.append(ruleCard(rule)));
    if (!matches.length) {
      const empty = el('div', 'empty-state');
      empty.append(icon(state.savedOnly ? 'star' : 'search'), el('h3', '', state.savedOnly && !bookmarks.size ? '保存したルールはまだありません' : '一致するルールが見つかりませんでした'), el('p', '', state.savedOnly && !bookmarks.size ? '各カードの「あとで読む」から保存できます。' : '検索語を短くするか、カテゴリーを「すべて」にしてお試しください。'));
      empty.append(button('絞り込みをリセット', 'button button-secondary', () => { state.query = ''; state.category = 'all'; state.savedOnly = false; views.input.value = ''; applyFilters(); }));
      fragment.append(empty);
    }
    views.list.replaceChildren(fragment);
    views.expand.disabled = views.collapse.disabled = !matches.length;
    [views.toc, views.mobileNav].forEach(toc => {
      const navFragment = document.createDocumentFragment();
      matches.forEach(rule => {
        const node = link('', `rules/#${encodeURIComponent(rule.id)}`, 'toc-link');
        node.dataset.ruleId = rule.id;
        node.append(el('span', 'toc-count', displayNumber(rule)), highlighted(rule.title, 'toc-label'));
        node.addEventListener('click', event => {
          event.preventDefault();
          const url = new URL(location.href);
          url.hash = rule.id;
          history.pushState({}, '', url);
          openDeepLink(true);
          views.mobileToc.open = false;
        });
        navFragment.append(node);
      });
      if (!matches.length) navFragment.append(el('p', 'toc-empty', '表示する項目はありません。'));
      toc.replaceChildren(navFragment);
    });
    observeToc();
  }
  function observeToc() {
    tocObserver?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const visible = new Map();
    const active = id => {
      [...views.toc.children, ...views.mobileNav.children].forEach(link => {
        const selected = link.dataset.ruleId === id;
        link.classList.toggle('is-active', selected);
        link.classList.toggle('active', selected);
        selected ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current');
      });
    };
    tocObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { entry.isIntersecting ? visible.set(entry.target.id, entry.target) : visible.delete(entry.target.id); });
      const first = [...visible.values()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (first) active(first.id);
    }, { rootMargin: '-100px 0px -45% 0px', threshold: 0 });
    views.list.querySelectorAll('.rule-card').forEach(card => tocObserver.observe(card));
  }
  function openDeepLink(focus) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return false; }
    if (id === 'categories') {
      const target = document.getElementById('categories');
      if (focus && target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      scrollToNode(target);
      return true;
    }
    const rule = data.rules.find(item => item.id === id);
    if (!rule) return false;
    state.query = '';
    state.category = 'all';
    state.savedOnly = false;
    views.input.value = '';
    openRules.add(id);
    reflectUrl();
    renderResults();
    const node = document.getElementById(id);
    node.open = true;
    scrollToNode(node);
    if (focus) node.querySelector('summary')?.focus({ preventScroll: true });
    return true;
  }
  async function copyRuleUrl(rule) {
    const url = new URL(href('rules/'));
    url.hash = rule.id;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url.href);
      notify('この項目へのリンクをコピーしました。');
    } catch (_) {
      // No deprecated copy command: users can select and copy in every browser.
      const dialog = el('dialog', 'copy-fallback');
      const title = el('h2', '', 'リンクをコピー');
      title.id = 'copy-dialog-title';
      dialog.setAttribute('aria-labelledby', title.id);
      const instructions = el('p', '', '次のURLを選択してコピーしてください。');
      const input = el('input', 'copy-input');
      input.value = url.href;
      input.readOnly = true;
      input.setAttribute('aria-label', 'この項目へのURL');
      input.addEventListener('focus', () => input.select());
      input.addEventListener('click', () => input.select());
      const close = button('閉じる', 'button button-primary', () => dialog.close());
      dialog.append(title, instructions, input, close);
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
      document.body.append(dialog);
      dialog.showModal();
      input.focus();
      input.select();
    }
  }
  function renderChangelog() {
    const shell = el('div', 'changelog-page');
    const hero = el('section', 'hero page-hero');
    const heroCopy = el('div', 'hero-copy');
    heroCopy.append(el('p', 'eyebrow', 'NICOGURA / CHANGELOG'), el('h1', 'hero-title', '街の情報を、いつも新しく。'), el('p', 'hero-lead', '公式サイトとルールの更新履歴。変わったことを、ここから確認できます。'), metaRow());
    hero.append(heroCopy);
    shell.append(hero, notice());
    const list = el('div', 'changelog-list');
    [...data.changelog].sort((a, b) => b.date.localeCompare(a.date)).forEach(change => {
      const article = el('article', 'changelog-entry');
      const meta = el('div', 'changelog-meta');
      meta.append(time(change.date), el('span', 'badge', changeType(change.type)));
      const body = el('div', 'changelog-body');
      body.append(el('h2', '', change.title));
      const items = el('ul');
      (change.items || []).forEach(item => items.append(el('li', '', item)));
      body.append(items);
      article.append(meta, body);
      list.append(article);
    });
    if (!data.changelog.length) list.append(el('p', 'empty-state', '更新履歴はまだありません。'));
    shell.append(list, link('ルール・ガイドラインを見る', 'rules/', 'button button-primary', 'arrow'));
    main.replaceChildren(shell);
  }
  function render404() {
    const shell = el('div', 'not-found error-page');
    const image = el('img', 'error-mascot');
    image.src = asset('icon', 'assets/icon.webp');
    image.alt = 'NicoGuraの白くま';
    image.width = 128;
    image.height = 128;
    shell.append(image, el('p', 'eyebrow', '404 / LOST IN THE CITY'), el('h1', 'hero-title', 'この道は、まだ開通していないみたい。'), el('p', 'hero-lead', 'お探しのページが見つかりませんでした。街の入口から、もう一度。'), link('HOMEへ戻る', '', 'button button-primary', 'arrow'));
    main.replaceChildren(shell);
  }
  function validateData(value) {
    if (!value || typeof value.site !== 'object' || !Array.isArray(value.categories) || !Array.isArray(value.rules) || !Array.isArray(value.changelog)) throw new Error('Invalid site data');
    const ids = new Set();
    value.rules.forEach(rule => {
      if (typeof rule.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(rule.id) || ids.has(rule.id) || typeof rule.title !== 'string' || !Array.isArray(rule.content)) throw new Error('Invalid rule data');
      ids.add(rule.id);
    });
    value.settings ||= { newBadgeDays: 30, featuredRuleIds: [] };
    return value;
  }
  async function init() {
    try {
      const response = await fetch(href('data/rules.json'), { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`Data unavailable: ${response.status}`);
      data = validateData(await response.json());
      categoryMap = new Map(data.categories.map(category => [category.id, category]));
      data.rules.forEach(rule => { rule._search = textIndex(rule); if (rule.status === 'published' && ['important', 'serious'].includes(ruleSeverity(rule))) openRules.add(rule.id); });
      readBookmarks();
      initChrome();
      if (page === 'rules') renderRules();
      else if (page === 'changelog') renderChangelog();
      else if (page === '404') render404();
      else renderHome();
      document.body.classList.add('is-ready');
    } catch (error) {
      data = { site: { name: 'NicoGura', version: '未取得', updatedAt: '', links: {}, assets: {} }, rules: [], categories: [], changelog: [], settings: {} };
      initChrome();
      const message = el('div', 'error-state');
      message.append(el('p', 'eyebrow', 'NICOGURA'), el('h1', '', '情報を読み込めませんでした'), el('p', '', '通信状況を確認して、もう一度お試しください。'), button('再読み込み', 'button button-primary', () => location.reload()), link('HOMEへ戻る', '', 'button button-secondary'));
      main.replaceChildren(message);
      document.body.classList.add('is-ready');
      console.error('NicoGura: site data could not be loaded.', error);
    }
  }
  init();
})();
