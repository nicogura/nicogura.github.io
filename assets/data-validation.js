/* Shared, dependency-free validation for local editing and publication. */
export function validateData(data) {
  const errors = [];
  const issue = (path, message) => errors.push(`${path}: ${message}`);
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, path, required = true, max = 50000) => {
    if (typeof value !== 'string' || (required && !value.trim()) || (typeof value === 'string' && value.length > max)) {
      issue(path, `文字列${required ? '（空欄不可）' : ''}、${max}文字以内で入力してください`);
      return false;
    }
    return true;
  };
  const id = (value, path) => {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(value)) issue(path, 'IDは英小文字で始まる英数字・ハイフン（80文字以内）にしてください');
  };
  const date = (value, path) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) issue(path, '実在する日付を YYYY-MM-DD で入力してください');
  };
  const strings = (value, path) => {
    if (!Array.isArray(value) || value.length > 100) { issue(path, '100個以内の文字列の配列にしてください'); return; }
    value.forEach((v, i) => text(v, `${path}[${i}]`, true, 1000));
  };
  if (!object(data)) return ['データ全体はJSONオブジェクトにしてください'];
  if (!object(data.site)) issue('site', 'サイト設定がありません');
  else {
    for (const key of ['name', 'tagline', 'version', 'notice']) text(data.site[key], `site.${key}`, key !== 'notice', 5000);
    date(data.site.updatedAt, 'site.updatedAt');
    if (!object(data.site.links)) issue('site.links', 'リンク設定がありません');
    else for (const [key, value] of Object.entries(data.site.links)) {
      if (value === '' || value === null) continue;
      try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || /^\[|^[\d.]+$/.test(host) || host === 'localhost' || /\.(local|localhost|internal|test)$/.test(host)) throw new Error();
      } catch { issue(`site.links.${key}`, '公開先のHTTPS URL、または空欄にしてください。認証情報・IPアドレス・ローカルURLは使用できません'); }
    }
    if (!object(data.site.assets)) issue('site.assets', '画像設定がありません');
    else for (const [key, value] of Object.entries(data.site.assets)) {
      if (typeof value !== 'string' || !/^assets\/[a-zA-Z0-9/_ .-]+\.(png|webp|jpe?g|svg|ico)$/i.test(value) || value.split('/').includes('..') || value.includes('\\')) issue(`site.assets.${key}`, 'assets/ 内の画像ファイルを指定してください');
    }
  }
  const categoryIds = new Set();
  if (!Array.isArray(data.categories) || data.categories.length > 200) issue('categories', '200件以内のカテゴリー配列にしてください');
  else data.categories.forEach((category, i) => {
    const path = `categories[${i}]`;
    if (!object(category)) { issue(path, 'オブジェクトにしてください'); return; }
    id(category.id, `${path}.id`);
    if (categoryIds.has(category.id)) issue(`${path}.id`, 'カテゴリーIDが重複しています');
    categoryIds.add(category.id);
    for (const key of ['label', 'shortLabel', 'description', 'group']) text(category[key], `${path}.${key}`, key === 'label', 3000);
  });
  const ruleIds = new Set();
  const numbers = new Set();
  const importance = ['normal', 'important', 'prohibited', 'warning', 'supplement', 'exception'];
  const severity = ['guide', 'notice', 'important', 'prohibited', 'serious'];
  if (!Array.isArray(data.rules) || data.rules.length > 5000) issue('rules', '5000件以内のルール配列にしてください');
  else data.rules.forEach((rule, i) => {
    const path = `rules[${i}]`;
    if (!object(rule)) { issue(path, 'オブジェクトにしてください'); return; }
    id(rule.id, `${path}.id`);
    if (ruleIds.has(rule.id)) issue(`${path}.id`, 'ルールIDが重複しています');
    ruleIds.add(rule.id);
    if (!['pending', 'published'].includes(rule.status)) issue(`${path}.status`, 'pending または published にしてください');
    const n = rule.number;
    if (!Number.isSafeInteger(n) || n < 0 || (rule.status === 'published' && n < 1)) issue(`${path}.number`, '番号は0以上の整数、正式公開ルールは1以上にしてください');
    if (n > 0) { if (numbers.has(n)) issue(`${path}.number`, 'ルール番号が重複しています'); numbers.add(n); }
    if (!categoryIds.has(rule.category)) issue(`${path}.category`, '存在するカテゴリーIDを指定してください');
    text(rule.title, `${path}.title`, true, 500);
    text(rule.summary, `${path}.summary`, rule.status === 'published', 5000);
    strings(rule.tags, `${path}.tags`);
    strings(rule.keywords, `${path}.keywords`);
    if (!severity.includes(rule.severity)) issue(`${path}.severity`, 'guide / notice / important / prohibited / serious の重大度を選んでください');
    if (rule.importance !== undefined && !importance.includes(rule.importance)) issue(`${path}.importance`, '互換用の重要度は指定された値にしてください');
    date(rule.updatedAt, `${path}.updatedAt`);
    for (const key of ['new', 'featured']) if (typeof rule[key] !== 'boolean') issue(`${path}.${key}`, 'true または false にしてください');
    if (!Array.isArray(rule.content) || rule.content.length > 500 || (rule.status === 'published' && rule.content.length === 0)) { issue(`${path}.content`, '本文を500ブロック以内の配列にしてください（正式公開時は本文必須）'); return; }
    rule.content.forEach((block, j) => {
      const bp = `${path}.content[${j}]`;
      if (!object(block) || !['paragraph', 'heading', 'list', 'note', 'table'].includes(block.type)) { issue(bp, 'paragraph / heading / list / note / table の本文ブロックにしてください'); return; }
      if (block.type === 'list') strings(block.items, `${bp}.items`);
      else if (block.type === 'table') {
        if (block.caption !== undefined) text(block.caption, `${bp}.caption`, false, 1000);
        const headersValid = Array.isArray(block.headers) && block.headers.length >= 1 && block.headers.length <= 12;
        if (!headersValid) issue(`${bp}.headers`, '見出しは1〜12列の文字列配列にしてください');
        else block.headers.forEach((header, k) => text(header, `${bp}.headers[${k}]`, true, 500));
        if (!Array.isArray(block.rows) || block.rows.length < 1 || block.rows.length > 200) issue(`${bp}.rows`, '表は1〜200行の配列にしてください');
        else block.rows.forEach((row, k) => {
          const rowPath = `${bp}.rows[${k}]`;
          if (!Array.isArray(row) || !headersValid || row.length !== block.headers.length) { issue(rowPath, '各行のセル数を見出しの列数と同じにしてください'); return; }
          row.forEach((cell, l) => text(cell, `${rowPath}[${l}]`, false, 5000));
        });
      }
      else text(block.text, `${bp}.text`, true);
    });
  });
  if (!Array.isArray(data.changelog) || data.changelog.length > 1000) issue('changelog', '1000件以内の更新履歴配列にしてください');
  else data.changelog.forEach((entry, i) => {
    const path = `changelog[${i}]`;
    if (!object(entry)) { issue(path, 'オブジェクトにしてください'); return; }
    date(entry.date, `${path}.date`);
    text(entry.type, `${path}.type`, true, 100);
    text(entry.title, `${path}.title`, true, 1000);
    strings(entry.items, `${path}.items`);
  });
  if (!object(data.settings)) issue('settings', '表示設定がありません');
  else {
    if (!Number.isSafeInteger(data.settings.newBadgeDays) || data.settings.newBadgeDays < 0 || data.settings.newBadgeDays > 365) issue('settings.newBadgeDays', '0〜365の整数にしてください');
    if (!Array.isArray(data.settings.featuredRuleIds)) issue('settings.featuredRuleIds', 'ルールIDの配列にしてください');
    else data.settings.featuredRuleIds.forEach((value, i) => { if (!ruleIds.has(value)) issue(`settings.featuredRuleIds[${i}]`, '存在するルールIDを指定してください'); });
  }
  if (data.pages !== undefined) {
    if (!object(data.pages)) issue('pages', 'ページ設定はオブジェクトにしてください');
    else for (const [key, page] of Object.entries(data.pages)) {
      id(key, `pages.${key}`);
      if (!object(page)) { issue(`pages.${key}`, 'ページ設定がありません'); continue; }
      for (const field of ['kicker', 'title', 'description']) text(page[field], `pages.${key}.${field}`, true, 3000);
      if (!Array.isArray(page.ruleIds)) issue(`pages.${key}.ruleIds`, 'ルールIDの配列にしてください');
      else {
        const seen = new Set();
        for (const value of page.ruleIds) {
          if (!ruleIds.has(value)) issue(`pages.${key}.ruleIds`, '存在するルールIDを指定してください');
          if (seen.has(value)) issue(`pages.${key}.ruleIds`, 'ルールIDが重複しています');
          seen.add(value);
        }
      }
    }
  }
  const inspect = (value, path) => {
    if (typeof value === 'string') {
      if (/<\s*\/?\s*(script|iframe|object|embed)\b|\bon\w+\s*=|(?:javascript|vbscript|data)\s*:/i.test(value)) issue(path, 'スクリプト・埋め込みHTML・危険なURLは使用できません');
      if (/(?:gh[pousr]_[a-zA-Z0-9]{25,}|github_pat_[a-zA-Z0-9_]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:mfa\.[\w-]{60,}))/i.test(value)) issue(path, '認証情報らしい文字列を含んでいます');
      if (/\b(?:\d{1,3}\.){3}\d{1,3}\b|[A-Z]:\\(?:Users|ゲーム|Program Files)\\/i.test(value)) issue(path, 'IPアドレスや内部のファイルパスを含めないでください');
    } else if (Array.isArray(value)) value.forEach((entry, i) => inspect(entry, `${path}[${i}]`));
    else if (object(value)) Object.entries(value).forEach(([key, entry]) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) issue(path, '予約されたキーは使用できません');
      if (/^(?:api[_-]?key|password|client[_-]?secret|bot[_-]?token|access[_-]?token|secret)$/i.test(key) && entry) issue(`${path}.${key}`, '認証情報の項目は公開データに含めないでください');
      inspect(entry, `${path}.${key}`);
    });
  };
  inspect(data, 'data');
  return [...new Set(errors)];
}
