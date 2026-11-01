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
