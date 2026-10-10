import { validateData } from './data-validation.js';

const $ = (selector) => document.querySelector(selector);
const ruleForm = $('#rule-form');
const siteForm = $('#site-form');
let data;
let selectedId;
let dirty = false;
let formDirty = false;
let siteFormDirty = false;
let categoryFormDirty = false;
let changelogFormDirty = false;
let lastContentMode = 'paragraph';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
const field = (name) => ruleForm.elements.namedItem(name);
const splitComma = (value) => [...new Set(value.split(/[,、]/).map((v) => v.trim()).filter(Boolean))];
const clone = (value) => JSON.parse(JSON.stringify(value));
const severityLabels = { guide: 'ガイド', notice: 'お願い', important: '注意', prohibited: '禁止', serious: '重大違反' };
const message = (value) => { $('#editor-message').textContent = value; };
function showErrors(errors) {
  const box = $('#validation-errors');
  box.replaceChildren();
  box.hidden = errors.length === 0;
  if (!errors.length) return;
  const title = document.createElement('strong');
  title.textContent = '入力内容を確認してください';
  const list = document.createElement('ul');
  errors.slice(0, 30).forEach((error) => {
    const item = document.createElement('li');
    item.textContent = error;
    list.append(item);
  });
  if (errors.length > 30) {
    const item = document.createElement('li');
    item.textContent = `ほか ${errors.length - 30} 件のエラーがあります。`;
    list.append(item);
  }
  box.append(title, list);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function accept(candidate, status) {
  const errors = validateData(candidate);
  showErrors(errors);
  if (errors.length) return false;
  data = candidate;
  dirty = true;
  message(status);
  renderList();
  return true;
}
function renderCategories() {
  const select = field('category');
  const previous = select.value;
  select.replaceChildren();
  data.categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.label;
    select.append(option);
  });
  if (data.categories.some((c) => c.id === previous)) select.value = previous;
}
function renderList() {
  const query = $('#rule-search').value.toLocaleLowerCase('ja');
  const matches = data.rules.filter((rule) => `${rule.id} ${rule.title} ${rule.severity} ${severityLabels[rule.severity] || ''}`.normalize('NFKC').toLocaleLowerCase('ja').includes(query.normalize('NFKC')));
  $('#rule-count').textContent = `${matches.length} / ${data.rules.length} 件・正式公開 ${data.rules.filter((r) => r.status === 'published').length} 件`;
  $('#changelog-count').textContent = `更新履歴は現在 ${data.changelog.length} 件あります。`;
  $('#rule-list').replaceChildren();
  matches.forEach((rule) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rule-option';
    button.setAttribute('aria-pressed', String(rule.id === selectedId));
    button.textContent = rule.title;
    const subtitle = document.createElement('span');
    subtitle.textContent = `${rule.status === 'published' ? `#${String(rule.number).padStart(2, '0')}` : '準備中'} · ${severityLabels[rule.severity] || 'ガイド'} · ${rule.id}`;
    button.append(subtitle);
    button.addEventListener('click', () => {
      if (rule.id === selectedId) return;
      if (formDirty && !window.confirm('このルールの未適用の変更を破棄して、別のルールを開きますか？')) return;
      selectRule(rule.id);
    });
    $('#rule-list').append(button);
  });
  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'helper';
    empty.textContent = '一致するルールがありません。';
    $('#rule-list').append(empty);
  }
}
function selectRule(id) {
  const rule = data.rules.find((r) => r.id === id);
  selectedId = rule?.id;
  ruleForm.hidden = !rule;
  $('#empty-rule').hidden = Boolean(rule);
  formDirty = false;
  if (!rule) {
    $('#draft-status').textContent = 'ルールを選択してください';
    renderList();
    return;
  }
  renderCategories();
  for (const name of ['id', 'number', 'title', 'category', 'severity', 'summary', 'updatedAt', 'status']) field(name).value = rule[name];
  for (const name of ['tags', 'keywords']) field(name).value = rule[name].join(', ');
  for (const name of ['new', 'featured']) field(name).checked = rule[name];
  const paragraphsOnly = rule.content.every((block) => block.type === 'paragraph');
  lastContentMode = paragraphsOnly ? 'paragraph' : 'json';
  field('contentMode').value = lastContentMode;
  field('content').value = paragraphsOnly ? rule.content.map((block) => block.text).join('\n\n') : JSON.stringify(rule.content, null, 2);
  $('#draft-status').textContent = '変更はまだ公開されません';
  renderList();
}
function readContent() {
  if (field('contentMode').value === 'json') {
    const blocks = JSON.parse(field('content').value);
    if (!Array.isArray(blocks)) throw new Error('本文のJSONは配列 [ … ] で入力してください。');
    return blocks;
  }
  return field('content').value.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ type: 'paragraph', text }));
}
function applyRule(quiet = false) {
  if (!data || !selectedId) return true;
  if (!ruleForm.reportValidity()) return false;
  let content;
  try { content = readContent(); } catch (error) { showErrors([`本文: ${error.message}`]); return false; }
  const candidate = clone(data);
  const rule = candidate.rules.find((r) => r.id === selectedId);
  const oldId = rule.id;
  for (const name of ['id', 'title', 'category', 'severity', 'summary', 'updatedAt', 'status']) rule[name] = field(name).value.trim();
  if (rule.importance !== undefined) rule.importance = ({ guide: 'normal', notice: 'supplement', important: 'important', prohibited: 'prohibited', serious: 'prohibited' })[rule.severity];
  rule.number = Number(field('number').value);
  for (const name of ['tags', 'keywords']) rule[name] = splitComma(field(name).value);
  for (const name of ['new', 'featured']) rule[name] = field(name).checked;
  rule.content = content;
  candidate.settings.featuredRuleIds = candidate.settings.featuredRuleIds.map((id) => id === oldId ? rule.id : id);
  if (!accept(candidate, quiet ? '編集中のルールを適用しました。' : 'このルールの変更を適用しました。最後に rules.json をダウンロードしてください。')) return false;
  selectedId = rule.id;
  formDirty = false;
  $('#draft-status').textContent = 'このタブに適用済み';
  renderList();
  return true;
}
function loadData(candidate, status) {
  const errors = validateData(candidate);
  showErrors(errors);
  if (errors.length) { message('JSONを読み込めませんでした。現在の編集データは保持されています。'); return false; }
  data = clone(candidate);
  selectedId = undefined;
  dirty = false;
  formDirty = false;
  siteFormDirty = false;
  categoryFormDirty = false;
  changelogFormDirty = false;
  $('#download').disabled = false;
  $('#add-rule').disabled = false;
  siteForm.elements.namedItem('version').value = data.site.version;
  siteForm.elements.namedItem('updatedAt').value = data.site.updatedAt;
  siteForm.elements.namedItem('notice').value = data.site.notice;
  siteForm.elements.namedItem('newBadgeDays').value = data.settings.newBadgeDays;
  $('#category-form').reset();
  $('#changelog-form').reset();
  $('#changelog-form').elements.namedItem('date').value = today();
  renderCategories();
  selectRule(data.rules[0]?.id);
  message(status);
  return true;
}
ruleForm.addEventListener('input', () => {
  dirty = true;
  formDirty = true;
  $('#draft-status').textContent = '未適用の変更があります';
});
ruleForm.addEventListener('submit', (event) => { event.preventDefault(); applyRule(); });
field('contentMode').addEventListener('change', () => {
  const next = field('contentMode').value;
  try {
    if (next === 'json') {
      field('content').value = JSON.stringify(field('content').value.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ type: 'paragraph', text })), null, 2);
    } else {
      const blocks = JSON.parse(field('content').value);
      if (!Array.isArray(blocks) || blocks.some((block) => block.type !== 'paragraph')) throw new Error('見出し・箇条書き・注記・表があるため、構造を保つJSONモードで編集してください。');
      field('content').value = blocks.map((block) => block.text).join('\n\n');
    }
    lastContentMode = next;
    formDirty = true;
    dirty = true;
    showErrors([]);
  } catch (error) { field('contentMode').value = lastContentMode; showErrors([`本文: ${error.message}`]); }
});
$('#rule-search').addEventListener('input', () => { if (data) renderList(); });
$('#add-rule').addEventListener('click', () => {
  if (!data) return;
  if (formDirty && !window.confirm('未適用の変更を破棄して、新しいルールを追加しますか？')) return;
  if (!data.categories.length) { message('先にカテゴリーを追加してください。'); return; }
  const candidate = clone(data);
  let sequence = 1;
  while (candidate.rules.some((rule) => rule.id === `new-rule-${sequence}`)) sequence++;
  const id = `new-rule-${sequence}`;
  candidate.rules.push({ id, number: 0, title: '新しいルール（運営確認中）', category: candidate.categories[0].id, tags: [], keywords: [], severity: 'guide', summary: '', content: [], updatedAt: today(), new: true, featured: false, status: 'pending' });
  if (accept(candidate, '準備中のルールを追加しました。内容を編集し、運営承認後に正式公開へ変更してください。')) {
    $('#rule-search').value = '';
    selectRule(id);
    field('title').focus();
  }
});
$('#delete-rule').addEventListener('click', () => {
  const rule = data?.rules.find((r) => r.id === selectedId);
  if (!rule || !window.confirm(`「${rule.title}」を削除しますか？ダウンロードして公開データを置き換えるまではサイトに反映されません。`)) return;
  const candidate = clone(data);
  candidate.rules = candidate.rules.filter((r) => r.id !== selectedId);
  candidate.settings.featuredRuleIds = candidate.settings.featuredRuleIds.filter((id) => id !== selectedId);
  if (accept(candidate, '選択したルールをこのタブから削除しました。')) selectRule(data.rules[0]?.id);
});
function applySite(quiet = false) {
  if (!data) { message('先にJSONを読み込んでください。'); return false; }
  if (!siteForm.reportValidity()) return false;
  const candidate = clone(data);
  for (const name of ['version', 'updatedAt', 'notice']) candidate.site[name] = siteForm.elements.namedItem(name).value.trim();
  candidate.settings.newBadgeDays = Number(siteForm.elements.namedItem('newBadgeDays').value);
  if (!accept(candidate, quiet ? '編集中のサイト設定を適用しました。' : 'サイト設定を適用しました。最後に rules.json をダウンロードしてください。')) return false;
  siteFormDirty = false;
  return true;
}
siteForm.addEventListener('input', () => { dirty = true; siteFormDirty = true; });
siteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applySite();
});
$('#category-form').addEventListener('input', () => { dirty = true; categoryFormDirty = true; });
$('#category-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!data) { message('先にJSONを読み込んでください。'); return; }
  const form = event.currentTarget;
  const candidate = clone(data);
  const category = {};
  for (const name of ['id', 'label', 'shortLabel', 'description', 'group']) category[name] = form.elements.namedItem(name).value.trim();
  if (!category.shortLabel) category.shortLabel = category.label;
  candidate.categories.push(category);
  if (accept(candidate, 'カテゴリーを追加しました。ルールのカテゴリー欄で選択できます。')) { renderCategories(); form.reset(); categoryFormDirty = false; }
});
$('#changelog-form').addEventListener('input', () => { dirty = true; changelogFormDirty = true; });
$('#changelog-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!data) { message('先にJSONを読み込んでください。'); return; }
  const form = event.currentTarget;
  const candidate = clone(data);
  const entry = {};
  for (const name of ['date', 'type', 'title']) entry[name] = form.elements.namedItem(name).value.trim();
  entry.items = form.elements.namedItem('items').value.split('\n').map((v) => v.trim()).filter(Boolean);
  candidate.changelog.unshift(entry);
  if (accept(candidate, '更新履歴を追加しました。最後に rules.json をダウンロードしてください。')) { form.reset(); form.elements.namedItem('date').value = today(); changelogFormDirty = false; }
});
$('#import-file').addEventListener('change', async (event) => {
  const file = event.currentTarget.files[0];
  if (!file) return;
  if ((dirty || formDirty) && !window.confirm('現在の未保存の編集内容を破棄して、このJSONを読み込みますか？')) { event.currentTarget.value = ''; return; }
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('JSONは5MB以内にしてください。');
    loadData(JSON.parse(await file.text()), `「${file.name}」を読み込みました。`);
  } catch (error) { showErrors([`JSONの読み込み: ${error.message}`]); }
  event.currentTarget.value = '';
});
$('#download').addEventListener('click', () => {
  if (!data) return;
  if (categoryFormDirty || changelogFormDirty) {
    const unfinished = categoryFormDirty ? $('#category-form') : $('#changelog-form');
    const label = categoryFormDirty ? 'カテゴリー' : '更新履歴';
    unfinished.closest('details').open = true;
    message(`${label}の入力が未追加です。「${label}を追加」を押してからダウンロードしてください。不要なら入力を消して「入力を破棄」を押してください。`);
    unfinished.elements[0].focus();
    return;
  }
  if (formDirty && !applyRule(true)) return;
  if (siteFormDirty && !applySite(true)) return;
  const errors = validateData(data);
  showErrors(errors);
  if (errors.length) return;
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'rules.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  dirty = false;
  message('rules.json をダウンロードしました。内容を運営で確認し、READMEの取込手順でコンテンツへ反映してください。');
});
for (const [id, clear] of [['category', () => { categoryFormDirty = false; }], ['changelog', () => { changelogFormDirty = false; }]]) {
  $(`#discard-${id}`).addEventListener('click', () => {
    const form = $(`#${id}-form`);
    form.reset();
    if (id === 'changelog') form.elements.namedItem('date').value = today();
    clear();
    message(`${id === 'category' ? 'カテゴリー' : '更新履歴'}の未追加の入力を破棄しました。`);
  });
}
window.addEventListener('beforeunload', (event) => { if (dirty || formDirty) { event.preventDefault(); event.returnValue = ''; } });
try {
  const response = await fetch('../data/rules.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`読み込みエラー (${response.status})`);
  loadData(await response.json(), 'サイトの rules.json を読み込みました。編集はダウンロードまでこのタブだけに保存されます。');
} catch {
  message('サイトのJSONを読み込めませんでした。ローカルサーバーで開くか、「JSONを読み込む」から data/rules.json を選択してください。');
}
