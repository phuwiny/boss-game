#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const file of ['js/level.js', 'js/stage-forest.js', 'js/stage-castle.js', 'js/world.js', 'js/characters.js', 'js/spawn.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
}
const CQ = sandbox.CQ;
const W = CQ.World;
const chars = Object.fromEntries(CQ.CHARACTERS.map(ch => [ch.id, ch]));
const counts = items => items.reduce((out, item) => { out[item] = (out[item] || 0) + 1; return out; }, {});

function check(name, fn) { fn(); console.log('ok  ' + name); }

check('moving platforms travel at 80 pixels per second', () => {
  const lv = CQ.parseLevel(CQ.getStage('forest').sections);
  assert(lv.platforms.length > 0);
  const pl = lv.platforms[0];
  assert.equal(pl.speed, 80);
  W.stepPlatform(pl, 0.5);
  assert.equal(pl.dx, 40);
});

check('Mew and Aclaire get character-specific item mixes in normal and boss stages', () => {
  for (const stageId of ['grassland', 'castle']) {
    const stage = CQ.getStage(stageId);
    const base = CQ.Spawn.itemsFor(stage);
    const mew = CQ.Spawn.itemsFor(stage, chars.mew);
    const aclaire = CQ.Spawn.itemsFor(stage, chars.aclaire);
    assert.equal(mew.length, base.length);
    assert.equal(aclaire.length, base.length);
    assert.equal(counts(mew).wing || 0, counts(base).wing - 1);
    assert.equal(counts(mew).mush || 0, counts(base).mush + 1);
    assert.equal(counts(aclaire).wing || 0, counts(base).wing + 1);
    assert.equal(counts(aclaire).mush || 0, counts(base).mush - 1);
    for (const type of ['star', 'heart']) assert.equal(counts(mew)[type] || 0, counts(base)[type] || 0);
    assert.deepEqual(Array.from(CQ.Spawn.itemsFor(stage, chars.bobo)), Array.from(base));
  }
});

check('Mew floats four seconds and Bobo/Mew shots have longer delays', () => {
  assert.equal(chars.mew.ability.float, 4);
  assert.equal(chars.bobo.shot.cooldown, 0.30);
  assert.equal(chars.mew.shot.cooldown, 0.32);
});

check('Aclaire shield regenerates ten seconds after use without dying', () => {
  const tiles = Array(20 * 4).fill(CQ.TILE.EMPTY);
  for (let x = 0; x < 20; x++) tiles[2 * 20 + x] = CQ.TILE.GROUND;
  const lv = { w: 20, h: 4, tiles, platforms: [] };
  const p = W.makePlayer(5, 1, chars.aclaire);
  assert.equal(W.hurt(p, [], 'enemy'), false);
  assert.equal(p.guard, 0);
  assert.equal(p.guardCooldown, 10);
  const idle = { left: false, right: false, jump: false, jumpPressed: false };
  for (let i = 0; i < 9 * 120; i++) W.stepPlayer(p, idle, lv, 1 / 120);
  assert.equal(p.guard, 0);
  assert(Math.abs(p.guardCooldown - 1) < 1e-8);
  for (let i = 0; i < 120; i++) W.stepPlayer(p, idle, lv, 1 / 120);
  assert.equal(p.guard, 1);
  assert.equal(p.guardCooldown, 0);
  assert.equal(p.dead, false);
  assert.equal(W.hurt(p, [], 'enemy'), false);
  assert.equal(p.guardCooldown, 10);
});
