/* Small, versioned UI preferences. No DOM or gameplay dependencies. */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const KEY = 'coinquest.ui.v1';
  function normalize(raw) {
    return { touchSize: raw && raw.touchSize === 'large' ? 'large' : 'standard' };
  }
  function load(store) {
    try { return normalize(JSON.parse(store.get(KEY))); }
    catch (e) { return normalize(null); }
  }
  function save(store, settings) {
    try { store.set(KEY, JSON.stringify(normalize(settings))); }
    catch (e) { /* Preferences are optional when storage is blocked. */ }
  }
  CQ.UISettings = { normalize: normalize, load: load, save: save };
})(typeof window !== 'undefined' ? window : globalThis);
