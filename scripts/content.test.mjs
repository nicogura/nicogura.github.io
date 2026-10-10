import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { routes, htmlPaths } from './site-config.mjs';
import { validateData } from '../assets/data-validation.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFile(resolve(root,p), 'utf8');
const data = JSON.parse(await read('data/rules.json'));
const body = JSON.stringify(data);
const entry = id => { const r = data.rules.find(r => r.id === id); assert.ok(r, id); return r; };
test('published schema and page references', () => {
  assert.deepEqual(validateData(data), []);
  assert.ok(data.rules.every(r => r.status === 'published'));
  assert.equal(data.site.updatedAt, '2026-10-10');
  for (const key of Object.keys(routes)) { assert.ok(data.pages[key]); for (const id of data.pages[key].ruleIds) entry(id); }
});
test('official brand and no internal economics or obsolete joining flow', () => {
  assert.equal(data.site.links.discord, 'https://discord.gg/Fzhhp34JJy');
  assert.equal(data.site.links.x, 'https://x.com/NicoGura0810');
  assert.equal(data.site.links.fivem, '');
  assert.doesNotMatch(body, /入国前|NG-XXXX|純時給|期待利益|期待純利益|成功率|内部KPI|資産占有率|システム回収率|失敗.{0,8}罰金|PD.*内部計算/);
});
test('welcoming rules, one character, independent staff discretion', () => {
  assert.match(JSON.stringify(entry('character-identity')), /1人/);
  assert.match(JSON.stringify(entry('character-identity')), /別アカウント/);
  assert.equal(entry('administration-response').title, '【運営や市民の妨げになると判断された場合】');
  for (const word of ['ライトRP','完璧な演技','RDM','VDM','メタゲーミング','外部VC','クラッシュ','ダウン','常時録画']) assert.ok(body.includes(word), word);
});
test('join has ten ordered steps and uses txAdmin request codes', () => {
  const flow = entry('join-flow').content.find(b => b.type === 'list');
  assert.equal(flow.items.length, 10);
  const text = flow.items.join('\n');
  let position = -1;
  for (const term of ['Discord', 'ルール', '✅', '市民', 'FiveM', 'R1234', '#ホワイトリスト申請', 'txAdmin', '再接続', '生活']) {
    const next = text.indexOf(term, position + 1); assert.ok(next > position, term); position = next;
  }
});
const tables = data.rules.flatMap(r => r.content.filter(b => b.type === 'table'));
const rows = tables.flatMap(t => t.rows);
function price(label, value) { assert.ok(rows.some(row => label.test(row[0]) && row.some(cell => cell.includes(value))), `${label} → ${value}`); }
test('user approved prices are exact', () => {
  for (const [label,value] of [
    [/現金/, '5,000,000'],[/銀行/, '5,000,000'],[/空腹.*20/, '50,000'],[/空腹.*30.*水分.*30/, '150,000'],
    [/ストレス.*30/, '70,000'],[/全項目.*30/, '200,000'],[/一般車/, '100円'],[/高性能車/, '100円'],[/大型車/, '100円'],[/ヘリ/, '100円'],
    [/通常治療/, '200,000'],[/院内蘇生/, '600,000'],[/現場蘇生/, '700,000'],[/北対応/, '800,000'],[/牢屋/, '1,000,000'],[/NPC/, '500,000'],
    [/タイヤ/, '400,000'],[/通常修理/, '100,000'],[/全修理/, '700,000'],[/包帯/, '50,000'],[/鎮痛剤/, '30,000'],[/IFAK/, '100,000'],[/簡易修理/, '100,000'],[/ニトロ/, '500,000'],
    [/通常塗装/, '300,000'],[/特殊.*RGB/, '600,000'],[/外装パーツ/, '300,000'],[/アンダーグロー/, '600,000'],[/特別ナンバー/, '100,000,000'],[/外装一式/, '4,200,000'],[/半カス/, '35,000,000'],[/フルカス/, '60,000,000']
  ]) price(label,value);
  assert.match(body, /400,000,000円/);
});
test('crime rewards and IC penalties are separate, with stated limits', () => {
  for (const amount of ['8,000,000円','15,000,000円','35,000,000円','70,000,000円','120,000,000円','1,400,000円','7,000,000円','12,000,000円','40,000,000円','80,000,000円']) assert.ok(body.includes(amount), amount);
  const law = JSON.stringify(entry('penalties-basic-fines'));
  for (const text of ['1,500,000円','2,500,000円','10,000,000円','1,000,000円','1,000,000,000円','2,000,000円','100,000,000円','10,000,000,000円','12時間','1日','個人医','半額','所持']) assert.ok(law.includes(text),text);
  assert.ok(data.pages.law.ruleIds.includes('penalties-basic-fines'));
  assert.ok(!data.pages.rules.ruleIds.includes('penalties-basic-fines'));
});
test('generated metadata and local links exist on every route', async () => {
  for (const [key,[path]] of Object.entries(routes)) {
    const html = await read(path ? `${path}/index.html` : 'index.html');
    const canonical = `https://nicogura.github.io/${path ? path+'/' : ''}`;
    assert.ok(html.includes(`rel="canonical" href="${canonical}"`), key);
    for (const required of ['og:title','og:description','og:image','twitter:card','favicon.png',`data-page="${key}"`]) assert.ok(html.includes(required), `${key}: ${required}`);
  }
  for (const path of htmlPaths) {
    const html = await read(path);
    for (const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https:|#)/.test(url)) continue;
      const target = new URL(url, `https://nicogura.github.io/${path === '404.html' ? '' : path}`);
      const file = decodeURIComponent(target.pathname).replace(/^\//,'') || 'index.html';
      assert.ok((await stat(resolve(root, file.endsWith('/') ? file+'index.html' : file))).isFile(), `${path}: ${url}`);
    }
  }
});
