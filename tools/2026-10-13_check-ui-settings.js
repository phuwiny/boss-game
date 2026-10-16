'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const sandbox = {};
vm.createContext(sandbox);
const file = path.join(__dirname, '../js/2026-10-13_ui-settings.js');
if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
assert.ok(sandbox.CQ && sandbox.CQ.UISettings, 'UISettings module must be available');
const S = sandbox.CQ.UISettings;
let count = 0;
function test(name, fn) { fn(); count++; console.log('ok ' + name); }
test('known sizes and safe defaults', () => {
  for (const raw of [null, undefined, {}, 'large', [], {touchSize:'giant'}, {touchSize:7}]) {
    assert.strictEqual(S.normalize(raw).touchSize, 'standard');
  }
  assert.strictEqual(S.normalize({touchSize:'large'}).touchSize, 'large');
  assert.strictEqual(S.normalize({touchSize:'standard'}).touchSize, 'standard');
});
test('reloads saved selection without changing old records', () => {
  const data = {'coinquest.best.v3':'{"time":99}'};
  const store = {get:k=>data[k], set:(k,v)=>{data[k]=v;}};
  S.save(store, {touchSize:'large', unwanted:'ignored'});
  assert.strictEqual(S.load(store).touchSize, 'large');
  assert.deepStrictEqual(JSON.parse(data['coinquest.ui.v1']), {touchSize:'large'});
  assert.strictEqual(data['coinquest.best.v3'], '{"time":99}');
  assert.strictEqual(Object.keys(data).length, 2);
});
test('malformed, missing and invalid saved data', () => {
  for (const raw of ['{bad', null, 'null', 'false', '[]', '{"touchSize":"unknown"}']) {
    assert.strictEqual(S.load({get:()=>raw}).touchSize, 'standard');
  }
});
test('blocked storage remains playable', () => {
  const store = {get(){throw new Error('SecurityError');}, set(){throw new Error('QuotaExceededError');}};
  assert.strictEqual(S.load(store).touchSize, 'standard');
  assert.doesNotThrow(()=>S.save(store,{touchSize:'large'}));
});
console.log('PASS ' + count + '/' + count);
