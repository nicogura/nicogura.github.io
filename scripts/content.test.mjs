import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
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
  assert.equal(data.site.updatedAt, '2026-11-05');
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
  assert.match(JSON.stringify(entry('administration-response')), /警告.*キック.*期限BAN.*永久BAN/);
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
test('unchanged approved prices stay exact while meeting changes use their new values', () => {
  for (const [label,value] of [
    [/現金/, '10,000,000'],[/銀行/, '10,000,000'],[/空腹.*20/, '300,000'],[/空腹.*30.*水分.*30/, '700,000'],
    [/ストレス.*30/, '250,000'],[/一般車/, '100円'],[/高性能車/, '100円'],[/大型車/, '100円'],[/ヘリ/, '100円'],
    [/通常治療/, '300,000'],[/院内蘇生/, '1,000,000'],[/現場蘇生/, '1,500,000'],[/牢屋/, '2,000,000'],[/NPC治療/, '800,000'],
    [/タイヤ/, '500,000'],[/通常修理/, '200,000'],[/全修理/, '1,400,000'],[/包帯/, '250,000'],[/鎮痛剤/, '250,000'],[/IFAK/, '200,000'],
    [/ニトロ補充/, '1,000,000'],[/塗装・外装/, '300,000'],[/RGB/, '600,000'],[/アンダーグロー/, '600,000'],[/特殊ナンバー/, '1,000,000,000']
  ]) price(label,value);
  assert.deepEqual(entry('gang-establishment').content.find(b => b.type === 'table').rows, [['ギャング設立費', '2,000,000,000円']]);
});
test('retired services and pricing do not return through duplicate tables', () => {
  assert.ok(!data.rules.some(r => r.id === 'economy-long-term'));
  assert.ok(!data.pages.economy.ruleIds.includes('economy-long-term'));
  assert.doesNotMatch(body, /北対応|全項目20|全項目30|一般販売|3か月|週5日|日次収入上限|犯罪\s*＞/);
  assert.equal(entry('economy-consumable-prices').content.filter(b => b.type === 'table').length, 0);
  assert.ok(entry('economy-consumable-prices').relatedRuleIds.includes('mechanic-fees'));
  assert.doesNotMatch(JSON.stringify(entry('mechanic-fees').content), /外装一式|半カス|フルカス|100,000,000円/);
});
test('EMS products share one article while prices, effects and first-aid warnings stay exact', async () => {
  const r = entry('ems-supplies');
  assert.equal(r.title, 'EMS専売品');
  assert.equal(r.contentKind, 'guide');
  assert.deepEqual(r.content.find(b => b.type === 'table').rows, [
    ['包帯','250,000円','一時的な止血','EMS専売品'],
    ['鎮痛剤','250,000円','痛み・症状の一時的な緩和','EMS専売品'],
    ['IFAK','200,000円','体力25％回復のみ','EMS専売品']
  ]);
  const text = JSON.stringify(r.content);
  for (const term of ['時間がたつと症状が再発','完全に治療するものではありません','EMSによる治療','EMSへ相談']) assert.ok(text.includes(term), term);
  assert.doesNotMatch(text, /3分/);
  const aliases = ['ems-bandage','ems-painkiller','ems-ifak','ems-injuries'];
  assert.deepEqual(r.aliases, aliases);
  for (const id of aliases) assert.ok(!data.rules.some(item => item.id === id));
  for (const page of ['ems','economy','guides']) {
    assert.equal(data.pages[page].ruleIds.filter(id => id === r.id).length, 1);
    const html = await read(`${page}/index.html`);
    for (const alias of aliases) assert.equal(html.split(`id="${alias}"`).length - 1, 1, `${page}/${alias}`);
  }
  const faq = entry('faq-bandage-treatment');
  assert.equal(faq.relatedRuleIds.filter(id => id === r.id).length, 1);
  const config = JSON.parse(await read('content/site.json'));
  for (const page of Object.values(config.pages)) for (const id of page.ruleIds || []) entry(id);
});

test('food stays unchanged and meeting EMS and mechanic tables match the source', () => {
  const tableRows = id => entry(id).content.filter(b => b.type === 'table').flatMap(b => b.rows);
  assert.deepEqual(tableRows('economy-food-prices'), [
    ['空腹＋20％','単一効果・安価','300,000円'],['空腹＋30％','単一効果・上限','350,000円'],
    ['水分＋20％','単一効果・安価','300,000円'],['水分＋30％','単一効果・上限','350,000円'],
    ['ストレス－20％','単一効果','200,000円'],['ストレス－30％','単一効果・上限','250,000円'],
    ['空腹30％＋水分30％','複合商品','700,000円']
  ]);
  // Latest DOCX p675–692. NPC service amendment and live /help are distinguished below.
  assert.deepEqual(tableRows('ems-fees').map(row => row.slice(0,2)), [
    ['通常治療','300,000円'],['院内蘇生','1,000,000円'],['現場蘇生・運搬','1,500,000円'],
    ['牢屋対応','2,000,000円'],['NPC治療','800,000円']
  ]);
  // Latest DOCX p715–805, including the vertical-merge performance levels.
  assert.deepEqual(tableRows('mechanic-fees'), [
    ['通常修理','200,000円','1箇所'],['全修理','1,400,000円',''],['タイヤ交換','500,000円','1本'],
    ['出張','500,000円','都心・郊外'],['出張','1,000,000円','北'],
    ['性能カスタム level1','3,000,000円'],['性能カスタム level2','4,000,000円'],['性能カスタム level3','5,000,000円'],
    ['性能カスタム level4','6,000,000円'],['性能カスタム level5','7,000,000円'],['ターボチャージャー','4,000,000円'],
    ['ニトロ取り付け','2,000,000円'],['ニトロ補充','1,000,000円'],['アーマー','8,000,000円'],['ハーネス','4,000,000円'],
    ['塗装・外装','300,000円','1箇所'],['RGB塗装','600,000円',''],['アンダーグロー・キセノン','600,000円',''],
    ['特殊ナンバー','1,000,000,000円','申請制'],['ダクトテープ','300,000円','1個']
  ]);
  assert.doesNotMatch(JSON.stringify(entry('economy-food-prices')), /[%]|一時的的/);
  for (const [id, pages] of [['ems-fees',['economy','ems']], ['mechanic-fees',['economy','mechanic']], ['economy-consumable-prices',['economy','mechanic']]]) {
    for (const page of pages) assert.ok(data.pages[page].ruleIds.includes(id));
    assert.equal(data.rules.filter(r => r.id === id).length, 1);
  }
});
test('gang registration colors are preserved and scene color rules are separate', () => {
  const colorTable=entry('gang-color-registration').content.find(b=>b.type==='table');
  assert.deepEqual(colorTable.headers,['色名','HEX','登録状況','ギャング名']);
  assert.deepEqual(colorTable.rows.map(row=>row[0]),['赤','青','桃','黄','橙','緑','紫']);
  assert.ok(colorTable.rows.every(row=>row[1]==='—'&&row[2]==='運営へ確認'&&row[3]==='—'));
  assert.match(JSON.stringify(entry('affiliation-colors')),/設立時に運営へ登録/);
  assert.match(JSON.stringify(entry('affiliation-colors')),/他ギャング.*偽装/);
  const scene = JSON.stringify(entry('crime-scene-colors').content);
  for (const term of ['服装','車両','盗難車','近似色','黒・白・グレー','PDへ確認']) assert.ok(scene.includes(term),term);
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
  assert.match(JSON.stringify(entry('faq-bug-report')), /PDへ連絡してシーンを一時中断/);
});
test('current JST schedules stay separate from the future beta change', () => {
  assert.deepEqual(entry('server-restarts').content.find(b=>b.type==='table').rows,[['03:00'],['11:00'],['19:00']]);
  assert.deepEqual(entry('server-maintenance').content.find(b=>b.type==='table').rows,[['水曜日03:00','木曜日19:00']]);
  assert.match(JSON.stringify(entry('server-maintenance')), /40時間/);
  assert.doesNotMatch(JSON.stringify(entry('server-maintenance').content), /24時間/);
  for(const id of ['server-restarts','server-maintenance']) for(const page of ['home','server']) assert.ok(data.pages[page].ruleIds.includes(id));
});
test('MOD exceptions require prior consultation rather than a permitted-products list', () => {
  const policy=JSON.stringify(entry('client-mod-policy').content);
  for(const term of ['原則禁止','使用前','チケット','自己判断']) assert.ok(policy.includes(term),term);
  const guidance=JSON.stringify(entry('client-mod-consultation').content);
  for(const term of ['Texture','NVE','QuantV','ReShade','Sound','Road','Crosshair','Overlay','Hitbox','Damage','Tracer','KillFX','自己責任','補償','使用を許可した一覧ではありません']) assert.ok(guidance.includes(term),term);
  for(const id of ['faq-client-mods','faq-low-spec']) assert.match(JSON.stringify(entry(id).content),/チケット/);
  assert.ok(data.pages.mods.ruleIds.includes('client-mod-policy'));
});
test('intentional repeated movement exploits and their automation are prohibited', () => {
  const text=JSON.stringify(entry('movement-glitches'));
  for(const term of ['スピードブースト','グリッチロール','ローリングキャンセル','移動モーションキャンセル','意図的','反復','偶然','マクロ']) assert.ok(text.includes(term),term);
  assert.ok(data.pages.mods.ruleIds.includes('movement-glitches'));
});
test('chase limits and crime response are shared by crime and PD pages', () => {
  const table = entry('crime-chase-attack-window').content.find(b => b.type === 'table');
  assert.deepEqual(table.rows, [['プレイヤー所有車（借りた車両を含む）', '1分'], ['盗難車両', '3分']]);
  assert.match(JSON.stringify(entry('crime-chase-attack-window').content), /クレーン強盗.*2分/);
  assert.match(JSON.stringify(entry('crime-chase-demands')), /最大2項目/);
  assert.match(JSON.stringify(entry('crime-common-response')), /見失ってから10分以内/);
  for (const id of ['crime-chase-demands', 'crime-chase-attack-window', 'crime-common-response', 'crime-bug-response']) {
    for (const page of ['crime', 'pd']) assert.ok(data.pages[page].ruleIds.includes(id), `${page}: ${id}`);
    assert.equal(data.rules.filter(r => r.id === id).length, 1, `single definition: ${id}`);
  }
});
test('crime bug procedure requires PD verification, evidence and no second reset', () => {
  const response = JSON.stringify(entry('crime-bug-response').content);
  assert.match(response, /PDが現場.*確認.*リセット/);
  assert.doesNotMatch(response, /上官/);
  const options = response;
  for (const text of ['必ず同じ犯罪', '1〜2名', '指定された時間', '手を上げて待機', '他の犯罪者が同じ犯罪を実行できる','成功後','チケット','ボディカメラの提出がない場合は補填できません']) assert.ok(options.includes(text), text);
  assert.doesNotMatch(options, /\d+(?:[～〜~]\d+)?分|PD専用/);
  assert.match(response, /2回目以降は、再度リセットして最初からやり直す選択はできません/);
  assert.deepEqual(entry('crime-bug-response').aliases, ['crime-bug-options','crime-bug-recurrence']);
  for (const heading of ['① リセットして再実行','② そのまま続行','③ 中断']) assert.ok(response.includes(heading));
  assert.match(JSON.stringify(entry('heist-duplicate')), /PDの確認を受けた正規の不具合対応は、不正なリセットと区別/);
});
test('consolidated crime and mechanic articles preserve legacy links without duplicate listings', async () => {
  for (const [id, aliases, pages] of [
    ['crime-bug-response',['crime-bug-options','crime-bug-recurrence'],['rules','crime','pd']],
    ['mechanic-billing',['pending-mechanic-fees'],['guides','mechanic']],
  ]) {
    assert.deepEqual(entry(id).aliases,aliases);
    for (const page of pages) {
      assert.equal(data.pages[page].ruleIds.filter(value=>value===id).length,1);
      const html=await read(`${page}/index.html`);
      for (const alias of aliases) assert.equal(html.split(`id="${alias}"`).length-1,1,`${page}/${alias}`);
    }
    for (const alias of aliases) assert.ok(!data.rules.some(r=>r.id===alias));
  }
  const mechanic=JSON.stringify(entry('mechanic-billing').content);
  for (const term of ['修理','車両整備','カスタム','塗装','外装パーツ','ライト','ナンバー','仕上がり','作業の範囲','料金の内訳','請求内容','納得']) assert.ok(mechanic.includes(term),term);
  assert.ok(entry('mechanic-billing').relatedRuleIds.includes('mechanic-fees'));
  assert.equal(entry('mechanic-billing').content.filter(b=>b.type==='table').length,0);
});
test('short FAQ answers lead to the authoritative detail and retain critical caveats', () => {
  const links={
    'faq-rp-beginner':['rp-light','intro-reading'],
    'faq-character-count':['character-identity','character-changes'],
    'faq-whitelist-interview':['join-whitelist','join-flow'],
    'faq-rule-memory':['intro-reading','faq-find-share'],
    'faq-rule-loopholes':['administration-response'],
    'faq-bandage-treatment':['ems-supplies'],
    'faq-wednesday-maintenance':['server-maintenance'],
  };
  for(const [id,related] of Object.entries(links)) assert.deepEqual(entry(id).relatedRuleIds,related);
  assert.match(JSON.stringify(entry('faq-character-count').content),/追加で作成せず.*事前.*運営/);
  assert.match(JSON.stringify(entry('faq-whitelist-interview').content),/本人のRxxxx.*承認後.*再接続/);
  assert.match(JSON.stringify(entry('faq-bandage-treatment').content),/完治しません.*一時的.*再発.*EMS/);
  assert.match(JSON.stringify(entry('faq-wednesday-maintenance').content),/水曜日03:00.*木曜日19:00.*日本時間.*JST.*予定.*最新/);
});
test('approved half fines preserve the official offences, probation periods and impound fees', () => {
  // Official baseline (DOCX p825–904), fixed fines halved on 2026-11-05; relative assistance rule unchanged.
  assert.deepEqual(entry('penalties-basic-fines').content.find(b => b.type === 'table').rows, [
    ['銃刀法違反','750,000円','5分','犯罪時に武器を所持していた場合に適用'],
    ['誘拐拉致監禁罪','750,000円','—','—'],['NPC殺人罪','1,250,000円','5分','—'],
    ['プレイヤー殺人・未遂罪','5,000,000円','10分','—'],['窃盗罪','500,000円','10分','車両窃盗に適用'],
    ['重窃盗罪','25,000,000円','60分','公務員の窃盗に適用'],['公務執行妨害罪','1,000,000円','5分','—'],
    ['テロ罪','2,500,000,000円','12時間','警察署襲撃など'],['汚職収賄罪','2,500,000,000円','60分','—'],
    ['業務妨害罪','500,000,000円','60分','店舗オーナーと応相談'],['逃走補助罪','逃走補助をした犯罪の罰金額の半額','30分','個人医のみ適用'],
    ['セクハラ / カスハラ / パワハラ / 暴言','5,000,000,000円','1日','—'],['公然わいせつ罪','50円','24時間','—'],['詐欺罪','12,500,000円','15分','—']
  ]);
  assert.deepEqual(entry('penalties-heist-fines').content.find(b=>b.type==='table').rows, [
    ['小型','700,000円','15分'],['準中型チェイス','3,500,000円','30分'],['準中型撃ち合い','6,000,000円','30分'],['中型','20,000,000円','45分'],['大型','40,000,000円','60分']
  ]);
  assert.deepEqual(entry('penalties-impound').content.find(b=>b.type==='table').rows, [['一般','500,000円','0分'],['犯罪','1,000,000円','0分']]);
  assert.match(JSON.stringify(entry('weapons-crime-use').content), /犯罪時.*所持/);
  assert.doesNotMatch(JSON.stringify(entry('weapons-crime-use').content), /所持だけ.*(?:違反|犯罪).*なりません|使用した時点/);
  for(const id of ['penalties-basic-fines','penalties-heist-fines','penalties-impound']) {
    assert.ok(data.pages.law.ruleIds.includes(id)); assert.ok(!data.pages.rules.ruleIds.includes(id));
  }
});

// Independently transcribed from latest DOCX Table 3 p600–652 (merged ATM PD cell included).
const crimeParticipantRows = [
  ['小型','通常','2人','2～3人',''], ['小型','ATM','1人','2～3人',''],
  ['準中型（チェイス）','通常','1～2人','2～4人',''], ['準中型（チェイス）','クレーン強盗','2～3人','3～4人',''],
  ['準中型（チェイス）','現金交換所','1～2人','2～4人',''], ['準中型（撃ち合い）','通常','3～6人','5～10人',''],
  ['中型','通常','4～8人','6～12人',''], ['大型','通常','8～15人','12～20人','ギャング限定'], ['無人犯罪','通常','1人','0人','']
];
test('meeting participant counts distinguish criminal and PD ranges', () => {
  const rule = entry('crime-current-list');
  assert.equal(rule.number,212);
  const tables = rule.content.filter(b=>b.type==='table');
  assert.equal(tables.length,1);
  assert.deepEqual(tables[0].headers,['分類','犯罪名・区分','犯罪者側','PD側','補足']);
  assert.deepEqual(tables[0].rows,crimeParticipantRows);
  assert.equal(rule.contentKind,'rule');
  assert.ok(data.pages.rules.ruleIds.includes(rule.id));
  assert.ok(!data.pages.guides.ruleIds.includes(rule.id));
});

test('named crime guide keeps all 33 old names without a second participant definition', () => {
  const table = entry('crime-types-guide').content.find(b=>b.type==='table');
  assert.equal(table.rows.length,33);
  assert.deepEqual(table.rows.map(row=>row[0]),["コンビニ強盗", "ATM強盗", "空き巣", "フリーカ強盗", "現金両替強盗", "クレーン強盗", "ブースティング（A・S）", "コインランドリー", "ヴァンジェリコ", "列車強盗", "パージ強盗", "軍事基地", "客船", "飛行場襲撃", "ボブキャット", "パレト", "オイルリグ", "貨物船強盗", "ヒューマンラボ", "美術館強盗", "空母強盗", "金庫強盗", "アーティファクト", "ユニオンヘイスト", "カジノヘイスト", "パシフィック", "マウンテン・ボルト", "アンダーグラウンド・ヘイスト", "メイズバンク", "警察署襲撃", "自動販売機強盗", "ポストロッカー強盗", "ブースティング（D・C・B）"]);
  assert.equal(new Set(table.rows.map(row=>row[0])).size,33);
  assert.ok(table.rows.every(row=>row.length===2));
  assert.doesNotMatch(JSON.stringify(table), /\d人/);
  assert.ok(entry('crime-types-guide').relatedRuleIds.includes('crime-current-list'));
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

// Original 0b3b10a snapshot, retained as a fixed compatibility contract.
const baselineIdsAndNumbers = {
  "intro-welcome": 1,
  "intro-reading": 2,
  "basic-respect": 3,
  "rp-back-and-forth": 4,
  "rp-metagaming": 5,
  "rp-rdm": 6,
  "prohibited-cheating": 7,
  "prohibited-exploit": 8,
  "prohibited-rmt": 9,
  "prohibited-harassment": 10,
  "prohibited-impersonation": 11,
  "communication-external-vc": 13,
  "communication-voice": 14,
  "vehicles-vdm": 15,
  "vehicles-courtesy": 16,
  "streaming-respect": 31,
  "administration-response": 32,
  "administration-report": 33,
  "rp-light": 103,
  "rp-powergaming": 104,
  "rp-no-pressure": 105,
  "rp-stream-ghosting": 106,
  "prohibited-ban-evasion": 108,
  "prohibited-evidence-fabrication": 109,
  "administration-sanctions": 110,
  "vehicles-emergency-use": 232,
  "vehicles-job-crime": 233,
  "server-restarts": 226,
  "server-maintenance": 227,
  "movement-glitches": 224,
  "client-mod-policy": 225,
  "join-flow": 101,
  "join-whitelist": 102,
  "character-identity": 12,
  "crime-combat-log": 18,
  "crime-third-party": 19,
  "crime-rejoin-combat": 20,
  "crime-probation": 21,
  "heist-duplicate": 22,
  "crime-down-information": 107,
  "pending-crime-conditions": 202,
  "crime-public-rewards": 211,
  "crime-current-list": 212,
  "crime-chase-demands": 218,
  "crime-chase-attack-window": 219,
  "crime-common-response": 220,
  "crime-bug-response": 221,
  "crime-bug-options": 222,
  "crime-bug-recurrence": 223,
  "crime-restart-window": 231,
  "weapons-crime-use": 17,
  "pending-weapons-license": 201,
  "penalties-basic-fines": 34,
  "pending-penalty-times": 205,
  "penalties-heist-fines": 213,
  "penalties-impound": 214,
  "economy-starting-funds": 207,
  "economy-food-prices": 208,
  "economy-fuel-prices": 209,
  "economy-consumable-prices": 210,
  "pd-authority": 23,
  "pd-fines": 24,
  "ems-request": 25,
  "ems-care": 26,
  "ems-fees": 27,
  "ems-bandage": 228,
  "ems-painkiller": 229,
  "ems-ifak": 230,
  "mechanic-billing": 28,
  "mechanic-fees": 29,
  "pending-mechanic-fees": 203,
  "business-honest": 30,
  "pending-job-conditions": 204,
  "lifejobs-overview": 216,
  "gang-establishment": 215,
  "affiliation-colors": 217,
  "faq-find-share": 35,
  "faq-rp-beginner": 111,
  "faq-fivem-beginner": 112,
  "faq-character-count": 113,
  "faq-whitelist-interview": 114,
  "faq-rule-memory": 115,
  "faq-crime-ban": 116,
  "faq-bug-report": 117,
  "faq-missing-items": 118,
  "faq-rule-loopholes": 119,
  "faq-client-mods": 120,
  "faq-low-spec": 121,
  "faq-movement-glitches": 122,
  "faq-bandage-treatment": 123,
  "faq-wednesday-maintenance": 124
};

test('original article identities survive, with consolidated article IDs available as aliases', () => {
  assert.equal(Object.keys(baselineIdsAndNumbers).length,91);
  const consolidated = { 'ems-bandage':'ems-supplies','ems-painkiller':'ems-supplies','ems-ifak':'ems-supplies',
    'crime-bug-options':'crime-bug-response','crime-bug-recurrence':'crime-bug-response','pending-mechanic-fees':'mechanic-billing' };
  for(const [id, number] of Object.entries(baselineIdsAndNumbers)) {
    if (consolidated[id]) assert.ok(entry(consolidated[id]).aliases.includes(id));
    else assert.equal(entry(id).number,number,id);
  }
  assert.equal(entry('ems-supplies').number, 228);
  for (const number of [229,230,247,222,223,203]) assert.ok(!data.rules.some(r => r.number === number), 'Do not reuse consolidated article numbers');
  assert.equal(new Set(data.rules.map(r=>r.id)).size,data.rules.length);
  assert.equal(new Set(data.rules.map(r=>r.number)).size,data.rules.length);
  for(const r of data.rules) assert.ok(['rule','guide','law'].includes(r.contentKind),r.id);
  const sortedIds=kind=>data.rules.filter(r=>r.contentKind===kind).map(r=>r.id).sort();
  assert.deepEqual([...data.pages.rules.ruleIds].sort(),sortedIds('rule'));
  assert.deepEqual([...data.pages.guides.ruleIds].sort(),sortedIds('guide'));
  for(const r of data.rules.filter(r=>r.contentKind==='law')) assert.ok(data.pages.law.ruleIds.includes(r.id),r.id);
  for(const id of data.pages.rules.ruleIds) assert.ok(!data.pages.guides.ruleIds.includes(id),id);
  for(let chapter=1;chapter<=12;chapter++) assert.ok(data.rules.some(r=>r.contentKind==='rule' && r.ruleChapter===chapter),`chapter ${chapter}`);
});

test('helicopter and scene rules preserve the meeting scope and exceptions', () => {
  assert.deepEqual(entry('crime-helicopter-limits').content.find(b=>b.type==='table').rows,[
    ['小型','使用不可'],['準中型（チェイス）','使用不可'],['準中型（撃ち合い）','1台'],['密輸バージ','4台'],
    ['中型','2台'],['空母襲撃・海上油田・貨物船強盗','5台'],['大型','3台']
  ]);
  const helis=JSON.stringify(entry('crime-helicopter-limits').content);
  assert.match(helis,/PD側.*犯罪者側.*1台/); assert.match(helis,/1事件の最大台数/);
  const scene=JSON.stringify(entry('crime-scene-conduct').content);
  for(const term of ['チェイス中','ガレージ','犯罪シーン中','車両・ヘリ','ヘイストネットワーク','復帰']) assert.ok(scene.includes(term),term);
  const end=JSON.stringify(entry('crime-scene-end').content);
  for(const term of ['振り切ってから5分','サイレン','PDヘリ','服装や車両','犯人と断定','10分以内']) assert.ok(end.includes(term),term);
  const mechanic=JSON.stringify(entry('mechanic-crime-limits').content);
  for(const term of ['中型','大型','ギャング']) assert.ok(mechanic.includes(term),term);
});

test('private PD timings and internal editing notes never enter published data', () => {
  assert.doesNotMatch(body,/非掲載|PD専用|revisionSource|source_latest|\bp\d{4}\b/);
  const bug=JSON.stringify(entry('crime-bug-response'));
  assert.doesNotMatch(bug,/\d+(?:[～〜~]\d+)?分/);
  assert.doesNotMatch(body,/11月5日|同時受注制限.*外す|デバッグ用NPC.*復活/);
});

test('future beta changes remain explicitly future guidance, not current restrictions', () => {
  for(const id of ['server-future-maintenance','ems-beginner-ticket-planned']) {
    const r=entry(id),text=JSON.stringify(r.content);
    assert.equal(r.contentKind,'guide'); assert.ok(!data.pages.rules.ruleIds.includes(id));
    for(const term of ['β','予定','開始日','現在']) assert.ok(text.includes(term),`${id}: ${term}`);
  }
  assert.match(JSON.stringify(entry('server-future-maintenance').content),/24時間/);
  assert.match(JSON.stringify(entry('ems-beginner-ticket-planned').content),/牢屋対応/);
  const currentRules=JSON.stringify(data.rules.filter(r=>r.contentKind==='rule'));
  assert.doesNotMatch(currentRules,/初心者EMS券|24時間.*メンテ/);
});

test('emergency commands distinguish transport, NPC rescue and actual current charge', () => {
  const text=JSON.stringify(entry('ems-emergency-commands').content);
  for(const term of ['/tpems','理由','運営が確認','蘇生や体力回復は行いません','/help','ダウン中','EMSが勤務中でも利用できます','車内','拘束','収監','銀行残高','その場で処置']) assert.ok(text.includes(term),term);
  const fees=JSON.stringify(entry('ems-fees').content);
  assert.match(fees,/\/help/); assert.match(fees,/1,000,000円/); assert.match(fees,/800,000円/);
  assert.match(fees,/現行|現在|現時点/); assert.match(fees,/反映/);
  const controls=JSON.stringify(entry('guide-menu-controls').content);
  for(const term of ['F2','インベントリ','F5','タブレット']) assert.ok(controls.includes(term),term);
  assert.doesNotMatch(controls,/F2で街のメニュー/);
});

test('three police station boundary images preserve the exact source mapping', async () => {
  const images=entry('law-police-station-attack').content.filter(b=>b.type==='image');
  const expected=[
    ['assets/law-police-main.png','本署','8e6a2ec87dd3e25f16681aa19bd797c4b8d59179b7d83929f297102575b3ed55'],
    ['assets/law-police-sandy.png','砂漠署','9d1c4dc1e4b7605566cf3a4129c3583ae95406596b772d45352168688141ad96'],
    ['assets/law-police-paleto.png','北署','2ae419b81a308dc7727e04da44a208a3ab12739862fb97c0a2f223fcb3df4ee2']
  ];
  assert.equal(images.length,3);
  for(let index=0;index<3;index++) {
    const [src,label,hash]=expected[index]; assert.equal(images[index].src,src);
    assert.ok(images[index].alt.includes(label)); assert.ok(images[index].caption.includes(label));
    assert.equal(createHash('sha256').update(await readFile(resolve(root,src))).digest('hex'),hash);
  }
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
