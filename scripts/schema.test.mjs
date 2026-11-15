import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateData } from '../assets/data-validation.js';

const source = JSON.parse(await readFile(new URL('../data/rules.json', import.meta.url), 'utf8'));
const withImage = src => {
  const copy = structuredClone(source);
  copy.rules[0].content.push({ type: 'image', src, alt: '対象範囲', caption: '赤枠の範囲' });
  return copy;
};

test('content images accept local raster assets and reject active or external content', () => {
  for (const src of ['assets/law-police-main.png', 'assets/maps/police.JPG', 'assets/map.webp']) {
    assert.deepEqual(validateData(withImage(src)), [], src);
  }
  for (const src of ['https://example.com/map.png', '//example.com/map.png', 'assets/../map.png', 'assets/maps/../../map.png', 'assets/%2e%2e/map.png', 'assets/map.svg', 'assets/map.png?x=1', 'assets/map.png#x', 'assets\\map.png', 'data:image/png;base64,x', '/assets/map.png']) {
    assert.ok(validateData(withImage(src)).some(error => error.includes('.src')), src);
  }
  const missingAlt = withImage('assets/map.png');
  delete missingAlt.rules[0].content.at(-1).alt;
  assert.ok(validateData(missingAlt).some(error => error.includes('.alt')));
});

test('related entries must refer to distinct existing entries', () => {
  for (const values of [[source.rules[0].id], ['unknown-entry'], [source.rules[1].id, source.rules[1].id]]) {
    const copy = structuredClone(source);
    copy.rules[0].relatedRuleIds = values;
    assert.ok(validateData(copy).some(error => error.includes('relatedRuleIds')));
  }
  const copy = structuredClone(source);
  copy.rules[0].relatedRuleIds = [source.rules[1].id];
  assert.deepEqual(validateData(copy), []);
});

test('legacy aliases cannot collide with current IDs or another alias', () => {
  for (const aliases of [[source.rules[0].id], ['same-id','same-id'], ['Bad ID'], 'not-an-array', Array(101).fill('old-id')]) {
    const copy = structuredClone(source);
    copy.rules[1].aliases = aliases;
    assert.ok(validateData(copy).some(error => error.includes('.aliases')), JSON.stringify(aliases));
  }
  const copy = structuredClone(source);
  copy.rules[0].aliases = ['shared-old-id'];
  copy.rules[1].aliases = ['shared-old-id'];
  assert.ok(validateData(copy).some(error => error.includes('.aliases')));
});

test('legacy related references resolve once and cannot alias a self-reference', () => {
  const copy = structuredClone(source);
  const supply = copy.rules.find(r => r.id === 'ems-supplies');
  copy.rules[0].relatedRuleIds = ['ems-ifak'];
  assert.deepEqual(validateData(copy), []);
  copy.rules[0].relatedRuleIds = ['ems-ifak', 'ems-bandage'];
  assert.ok(validateData(copy).some(error => error.includes('relatedRuleIds')));
  copy.rules[0].relatedRuleIds = [];
  supply.relatedRuleIds = ['ems-injuries'];
  assert.ok(validateData(copy).some(error => error.includes('relatedRuleIds')));
});

test('reader sections require the five ordered categories and valid groups', () => {
  const mutate=fn=>{const copy=structuredClone(source);fn(copy);return validateData(copy);};
  for(const change of [
    copy=>{delete copy.settings.ruleSections;},
    copy=>{copy.settings.ruleSections=[];},
    copy=>{copy.settings.ruleSections[1].id='overview';},
    copy=>{copy.settings.ruleSections[2]=null;},
    copy=>{copy.settings.ruleSections[2].groups=[];},
    copy=>{copy.settings.ruleSections[2].groups[0].ruleIds=[];},
    copy=>{copy.settings.ruleSections[2].groups[0].ruleIds=['missing-article'];},
    copy=>{copy.settings.ruleSections[2].groups.push(structuredClone(copy.settings.ruleSections[2].groups[0]));}
  ]) assert.ok(mutate(change).some(error=>error.includes('ruleSections')));
});

test('reader sections reject duplicate aliases, missing coverage and hidden entries', () => {
  const copy=structuredClone(source);
  const section=copy.settings.ruleSections.find(s=>s.id==='ems');
  const group=section.groups[0];
  const item=copy.rules.find(rule=>rule.id===group.ruleIds[0]);
  item.aliases=[...(item.aliases||[]),'reader-test-alias'];
  group.ruleIds.push('reader-test-alias');
  assert.ok(validateData(copy).some(error=>error.includes('ruleSections')&&error.includes('重複')));

  const omitted=structuredClone(source);
  const id=omitted.rules.find(rule=>rule.contentKind==='rule').id;
  for(const section of omitted.settings.ruleSections) for(const group of section.groups) group.ruleIds=group.ruleIds.filter(value=>value!==id);
  assert.ok(validateData(omitted).some(error=>error.includes('ruleSections')&&error.includes(id)));

  const hidden=structuredClone(source);
  const hiddenId=hidden.settings.ruleSections[0].groups[0].ruleIds[0];
  hidden.rules.find(rule=>rule.id===hiddenId).status='pending';
  assert.ok(validateData(hidden).some(error=>error.includes('ruleSections')&&error.includes('公開')));

  const page=structuredClone(source);
  page.pages.rules.ruleIds=page.pages.rules.ruleIds.filter(value=>value!==id);
  assert.ok(validateData(page).some(error=>error.includes('pages.rules.ruleIds')&&error.includes(id)));
});
