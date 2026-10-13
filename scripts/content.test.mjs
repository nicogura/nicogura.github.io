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
  assert.equal(data.site.updatedAt, '2026-10-13');
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
    [/現金/, '10,000,000'],[/銀行/, '10,000,000'],[/空腹.*20/, '300,000'],[/空腹.*30.*水分.*30/, '700,000'],
    [/ストレス.*30/, '250,000'],[/一般車/, '100円'],[/高性能車/, '100円'],[/大型車/, '100円'],[/ヘリ/, '100円'],
    [/通常治療/, '300,000'],[/院内蘇生/, '1,000,000'],[/現場蘇生/, '1,500,000'],[/牢屋/, '2,000,000'],[/NPC/, '1,000,000'],
    [/タイヤ/, '500,000'],[/通常修理/, '200,000'],[/全修理/, '1,400,000'],[/包帯/, '250,000'],[/鎮痛剤/, '250,000'],[/IFAK/, '200,000'],[/簡易修理/, '300,000'],[/ニトロ/, '1,000,000'],
    [/通常塗装/, '300,000'],[/特殊.*RGB/, '600,000'],[/外装パーツ/, '300,000'],[/アンダーグロー/, '600,000'],[/特別ナンバー/, '100,000,000'],[/外装一式/, '4,200,000'],[/半カス/, '35,000,000'],[/フルカス/, '60,000,000']
  ]) price(label,value);
  const gang = entry('gang-establishment');
  assert.equal(gang.summary, '標準ギャング設立費は2,000,000,000円です。');
  assert.deepEqual(gang.content.find(b => b.type === 'table').rows, [['標準ギャング設立費', '2,000,000,000円']]);
});
test('retired services, old products and internal economics are absent', () => {
  assert.ok(!data.rules.some(r => r.id === 'economy-long-term'));
  assert.ok(!data.pages.economy.ruleIds.includes('economy-long-term'));
  assert.doesNotMatch(body, /北対応|全項目20|全項目30|一般販売|100億|3か月|週5日|日次収入上限|犯罪\s*＞/);
  const table = entry('economy-consumable-prices').content.find(b => b.type === 'table');
  assert.deepEqual(table.rows, [
    ['ニトロ補充', '1,000,000円', 'ニトロの補充'],
    ['簡易修理キット / ダクトテープ', '300,000円', '走行可能になる程度']
  ]);
});
test('EMS products use one definition and distinguish first aid from treatment', () => {
  for (const [id, name, amount, effect] of [
    ['ems-bandage','包帯','250,000円','一時的な止血'],
    ['ems-painkiller','鎮痛剤','250,000円','痛み・症状の一時的な緩和'],
    ['ems-ifak','IFAK','200,000円','体力25％回復のみ']
  ]) {
    const r=entry(id);const text=JSON.stringify(r);
    assert.deepEqual(r.content.find(b=>b.type==='table').rows, [[name,amount,effect,'EMS専売品']]);
    assert.ok(r.tags.includes('EMS専売品'));assert.ok(r.tags.includes('応急処置'));
    assert.match(text,/EMSによる治療/);
    if(id!=='ems-ifak') { assert.match(text,/約3分程度/);assert.match(text,/再び症状が出る場合/); }
    else { assert.match(text,/完全に治療するものではありません/);assert.doesNotMatch(text,/3分/); }
    for(const page of ['ems','economy']) assert.ok(data.pages[page].ruleIds.includes(id));
    assert.equal(data.rules.filter(r=>r.id===id).length,1);
  }
});
test('latest food, medical and repair conditions match the integrated request', () => {
  const firstTable = id => entry(id).content.find(b => b.type === 'table').rows;
  assert.deepEqual(firstTable('economy-food-prices'), [
    ['空腹＋20％','単一効果・安価','300,000円'],['空腹＋30％','単一効果・上限','350,000円'],
    ['水分＋20％','単一効果・安価','300,000円'],['水分＋30％','単一効果・上限','350,000円'],
    ['ストレス－20％','単一効果','200,000円'],['ストレス－30％','単一効果・上限','250,000円'],
    ['空腹30％＋水分30％','複合商品','700,000円']
  ]);
  assert.deepEqual(firstTable('ems-fees'), [
    ['通常治療','負傷','300,000円'],['院内蘇生','病院内','1,000,000円'],['現場蘇生・搬送','救急現場','1,500,000円'],
    ['牢屋対応','犯罪対応','2,000,000円'],['EMS不在時NPC治療','即時救済','1,000,000円']
  ]);
  assert.deepEqual(firstTable('mechanic-fees'), [['タイヤ1本','部分修理','500,000円'],['通常修理','一か所','200,000円'],['全修理','大きな損傷','1,400,000円']]);
  assert.doesNotMatch(JSON.stringify(entry('economy-food-prices')), /[%]|一時的的/);
  for (const [id, pages] of [['ems-fees',['economy','ems']], ['mechanic-fees',['economy','mechanic']], ['economy-consumable-prices',['economy','mechanic']]]) {
    for (const page of pages) assert.ok(data.pages[page].ruleIds.includes(id));
    assert.equal(data.rules.filter(r => r.id === id).length, 1);
  }
});
test('gang colors retain confirmed names and do not invent assignments or HEX', () => {
  const color = entry('affiliation-colors');
  const colorTable=color.content.find(b=>b.type==='table');
  assert.deepEqual(colorTable.headers,['色名','HEX','登録状況','ギャング名']);
  assert.deepEqual(colorTable.rows.map(row=>row[0]),['赤','青','桃','黄','橙','緑','紫']);
  assert.ok(colorTable.rows.every(row=>row[1]==='—'&&row[2]==='運営へ確認'&&row[3]==='—'));
  assert.equal(color.category,'gang');
  assert.match(JSON.stringify(color),/設立時に運営へ登録/);
  assert.match(JSON.stringify(color),/他ギャング.*偽装/);
  assert.ok(color.content.some(b => b.text === '白・黒は使用禁止です。'));
});
test('Life Job lists the seventeen jobs once and retains existing additional jobs', () => {
  const jobTables = entry('lifejobs-overview').content.filter(b => b.type === 'table');
  const expected = ['ハンティング','トレジャーハンター','リサセン','鉱石','釣り','砂金','消防士','建設','ゴミ収集','窓清掃','プール清掃','タクシー運転手','トラック','農業 / 酪農','新聞配達','木こり','電気工事'];
  assert.deepEqual(jobTables[0].rows.map(r => r[0]), expected);
  const jobRows = jobTables.flatMap(t => t.rows);
  assert.equal(new Set(jobRows.map(r => r[0])).size, jobRows.length);
  assert.deepEqual(jobRows.filter(r => r.includes('調整中')).map(r => r[0]), ['木こり','電気工事']);
  for (const name of ['バス','フードトラック']) assert.ok(jobRows.some(r => r[0] === name));
});
test('FAQ gives the requested direct answers before further guidance', () => {
  assert.equal(entry('faq-fivem-beginner').content[0].text, 'はい、大丈夫です。FiveMが初めての方でも参加できます。');
  assert.match(entry('faq-character-count').content[0].text, /1人.*1キャラクター/);
  assert.doesNotMatch(entry('faq-character-count').content[0].text, /原則/);
  assert.equal(entry('faq-whitelist-interview').content[0].text, 'いいえ、面接ではありません。質問への回答形式でもありません。');
  assert.match(JSON.stringify(entry('faq-bug-report')), /速やかにPDへ連絡してシーンを一時中断/);
});
test('server schedules are JST data shared with the home page', () => {
  assert.deepEqual(entry('server-restarts').content.find(b=>b.type==='table').rows,[['03:00'],['11:00'],['19:00']]);
  assert.deepEqual(entry('server-maintenance').content.find(b=>b.type==='table').rows,[['水曜日 03:00','木曜日 19:00']]);
  const text=JSON.stringify(entry('server-maintenance'));
  for(const term of ['月曜日','火曜日','街からのお知らせ','予定']) assert.ok(text.includes(term),term);
  for(const id of ['server-restarts','server-maintenance']) for(const page of ['home','server']) assert.ok(data.pages[page].ruleIds.includes(id));
});
test('client mods are conditional exceptions and unfair advantages are prohibited', () => {
  const text=JSON.stringify(entry('client-mod-policy'));
  for(const term of ['原則禁止','優位性','軽量化','Texture','NVE','QuantV','ReShade','Sound','Road','No Bush','No Tree','No Prop','No Mountain','No Water','Smoke','Fog','No Night','Crosshair','Overlay','Hitbox','Damage','Tracer','KillFX','Stretched','自己責任','補償','使用前']) assert.ok(text.includes(term),term);
  assert.ok(data.pages.mods.ruleIds.includes('client-mod-policy'));
});
test('intentional repeated movement exploits and their automation are prohibited', () => {
  const text=JSON.stringify(entry('movement-glitches'));
  for(const term of ['スピードブースト','グリッチロール','ローリングキャンセル','移動モーションキャンセル','意図的','反復','偶然','マクロ']) assert.ok(text.includes(term),term);
  assert.ok(data.pages.mods.ruleIds.includes('movement-glitches'));
});
test('chase limits and crime response are shared by crime and PD pages', () => {
  const table = entry('crime-chase-attack-window').content.find(b => b.type === 'table');
  assert.deepEqual(table.rows, [['本人が所有する車両', '1分'], ['他プレイヤーから借りた車両', '1分'], ['窃盗車両', '3分']]);
  assert.match(JSON.stringify(entry('crime-chase-demands')), /最大2項目/);
  assert.match(JSON.stringify(entry('crime-common-response')), /見失ってから10分以内/);
  for (const id of ['crime-chase-demands', 'crime-chase-attack-window', 'crime-common-response', 'crime-bug-response', 'crime-bug-options', 'crime-bug-recurrence']) {
    for (const page of ['crime', 'pd']) assert.ok(data.pages[page].ruleIds.includes(id), `${page}: ${id}`);
    assert.equal(data.rules.filter(r => r.id === id).length, 1, `single definition: ${id}`);
  }
});
test('crime bug procedure requires verification and disallows a second reset', () => {
  const response = JSON.stringify(entry('crime-bug-response'));
  assert.match(response, /PD側の上官/);
  assert.match(response, /確認が取れた場合に限り/);
  assert.match(response, /PDがその旨を犯罪者側へ/);
  const options = JSON.stringify(entry('crime-bug-options'));
  for (const text of ['必ず同じ犯罪', '1〜2名', '3〜5分間', '手を上げて待機', '他の犯罪者が同じ犯罪を実行できる']) assert.ok(options.includes(text), text);
  assert.match(JSON.stringify(entry('crime-bug-recurrence')), /2回目以降は、再度リセットして最初からやり直す選択はできません/);
  assert.match(JSON.stringify(entry('heist-duplicate')), /この項目で禁止する不正なリセットには当たりません/);
});
test('crime rewards and IC penalties are separate, with stated limits', () => {
  for (const amount of ['8,000,000円','15,000,000円','35,000,000円','70,000,000円','120,000,000円','1,400,000円','7,000,000円','12,000,000円','40,000,000円','80,000,000円']) assert.ok(body.includes(amount), amount);
  const law = JSON.stringify(entry('penalties-basic-fines'));
  for (const text of ['1,500,000円','2,500,000円','10,000,000円','1,000,000円','1,000,000,000円','2,000,000円','100,000,000円','10,000,000,000円','12時間','1日','個人医','半額','所持']) assert.ok(law.includes(text),text);
  assert.ok(data.pages.law.ruleIds.includes('penalties-basic-fines'));
  assert.ok(!data.pages.rules.ruleIds.includes('penalties-basic-fines'));
});

// Independent transcription of the latest user list: 33 named entries.
const crimeParticipantRows = [
  ['コンビニ強盗', '小型', '1人', '2人'],
  ['ATM強盗', '小型', '1人', '1人'],
  ['空き巣', '小型', '1人', '2人'],
  ['フリーカ強盗', '準中（チェイス）', '1人', '2人'],
  ['現金両替強盗', '準中（チェイス）', '1人', '2人'],
  ['クレーン強盗', '準中（チェイス）', '2人', '3人'],
  ['ブースティング（A・S）', '準中（チェイス）', '1人', '2人'],
  ['コインランドリー', '準中（撃ち合い）', '3人', '6人'],
  ['ヴァンジェリコ', '準中（撃ち合い）', '3人', '6人'],
  ['列車強盗', '準中（撃ち合い）', '3人', '6人'],
  ['パージ強盗', '準中（撃ち合い）', '3人', '6人'],
  ['軍事基地', '準中（撃ち合い）', '3人', '6人'],
  ['客船', '中型', '4人', '8人'],
  ['飛行場襲撃', '中型', '4人', '8人'],
  ['ボブキャット', '中型', '4人', '8人'],
  ['パレト', '中型', '4人', '8人'],
  ['オイルリグ', '中型', '4人', '8人'],
  ['貨物船強盗', '中型', '4人', '8人'],
  ['ヒューマンラボ', '中型', '4人', '8人'],
  ['美術館強盗', '中型', '4人', '8人'],
  ['空母強盗', '中型', '4人', '8人'],
  ['金庫強盗', '中型', '4人', '8人'],
  ['アーティファクト', '大型', '8人', '15人'],
  ['ユニオンヘイスト', '大型', '8人', '15人'],
  ['カジノヘイスト', '大型', '8人', '15人'],
  ['パシフィック', '大型', '8人', '15人'],
  ['マウンテン・ボルト', '大型', '8人', '15人'],
  ['アンダーグラウンド・ヘイスト', '大型', '8人', '15人'],
  ['メイズバンク', '大型', '8人', '15人'],
  ['警察署襲撃', '特殊', '8人', '15人'],
  ['自動販売機強盗', 'PDなし犯罪', '1人', '1人'],
  ['ポストロッカー強盗', 'PDなし犯罪', '1人', '1人'],
  ['ブースティング（D・C・B）', 'PDなし犯罪', '1人', '1人'],
];
test('crime participants match all 33 named entries and separate minimum from maximum', () => {
  const rule = entry('crime-current-list');
  assert.equal(rule.number, 212);
  assert.equal(rule.title, '犯罪カテゴリ・参加人数');
  const participantTables = rule.content.filter(block => block.type === 'table');
  assert.equal(participantTables.length, 1, 'one authoritative participant table');
  const table = participantTables[0];
  assert.deepEqual(table.headers, ['犯罪名', 'カテゴリ', '最低人数', '最大人数']);
  assert.deepEqual(table.rows, crimeParticipantRows);
  assert.equal(table.rows.length, 33);
  assert.equal(new Set(table.rows.map(row => row[0])).size, 33, 'no duplicate crime names');
  const counts = {};
  for (const [name, category, minimum, maximum] of table.rows) {
    counts[category] = (counts[category] || 0) + 1;
    assert.match(minimum, /^[1-9]\d*人$/u, `${name}: minimum is a single count`);
    assert.match(maximum, /^[1-9]\d*人$/u, `${name}: maximum is a single count`);
    assert.ok(parseInt(minimum, 10) <= parseInt(maximum, 10), `${name}: valid participant range`);
  }
  assert.deepEqual(counts, { '小型': 3, '準中（チェイス）': 4, '準中（撃ち合い）': 5, '中型': 10, '大型': 7, '特殊': 1, 'PDなし犯罪': 3 });
  assert.deepEqual(table.rows.filter(row => row[2] === '1人' && row[3] === '1人').map(row => row[0]), ['ATM強盗', '自動販売機強盗', 'ポストロッカー強盗', 'ブースティング（D・C・B）']);
});
test('participant guidance identifies the criminal side without adding other conditions', () => {
  const rule = entry('crime-current-list');
  const explanation = [rule.summary, ...rule.content.filter(block => block.type !== 'table').flatMap(block => [block.text || '', ...(block.items || [])])].join('\n');
  assert.match(explanation, /犯罪(?:者)?側/u);
  assert.match(explanation, /人数/u);
  assert.doesNotMatch(explanation, /(?:PD|警察)(?:側)?(?:の)?人数\s*[:：]?\s*[\d０-９]/u, 'no invented police count');
  assert.doesNotMatch(JSON.stringify(rule), /人質|車両|傭兵|開始(?:時刻|時間)|クールダウン|\bCD\b|報酬|罰金|成功率/u, 'no extra crime conditions or reward values');
  assert.ok(data.pages.crime.ruleIds.includes(rule.id), 'crime page includes the participant definition');
  assert.equal(data.rules.filter(value => value.id === rule.id).length, 1);
});
test('public rewards keep their five approved amounts and baseline conditions', () => {
  const rewardTables = entry('crime-public-rewards').content.filter(block => block.type === 'table');
  assert.equal(rewardTables.length, 1);
  assert.deepEqual(rewardTables[0].headers, ['分類', '基準条件', '1人の報酬']);
  assert.deepEqual(rewardTables[0].rows, [
    ['小型', '1人報酬基準', '8,000,000円'],
    ['準中（チェイス）', '1人報酬基準', '15,000,000円'],
    ['準中（撃ち合い）', '6人時・1人あたり', '35,000,000円'],
    ['中型', '8人時・1人あたり', '70,000,000円'],
    ['大型', '15人時・1人あたり', '120,000,000円'],
  ]);
  assert.ok(rewardTables[0].rows.every(row => !['特殊', 'PDなし犯罪'].includes(row[0])), 'no unapproved reward category');
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
