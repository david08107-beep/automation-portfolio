import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('legacy Marketing Agent renders saved user text as escaped content', () => {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {value: '', textContent: '', innerHTML: '', addEventListener() {}});
    return nodes.get(selector);
  };
  const hostile = '<img src=x onerror="alert(1)"> & <script>bad()</script>';
  const history = [{tool: 'social', topic: hostile, copy: hostile, date: '2026-10-09'}];
  const localStorage = {getItem: key => key === 'ff-history' ? JSON.stringify(history) : null};
  runInNewContext(readFileSync(new URL('../../marketing-agent/dist/app.js', import.meta.url), 'utf8'), {
    document: {querySelector: node, querySelectorAll: () => []}, localStorage,
  });
  const html = node('#historyList').innerHTML;
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;img/);
  assert.match(html, /&amp;/);
});

test('legacy Marketing Agent starts with malformed or unavailable browser storage', () => {
  for (const stored of ['{broken', 'null', '42', '{"name":42}', '[{"tool":"unknown"}]', 'blocked']) {
    const nodes = new Map();
    const node = selector => {
      if (!nodes.has(selector)) nodes.set(selector, {value: '', textContent: '', innerHTML: '', addEventListener() {}});
      return nodes.get(selector);
    };
    runInNewContext(readFileSync(new URL('../../marketing-agent/dist/app.js', import.meta.url), 'utf8'), {
      document: {querySelector: node, querySelectorAll: () => []},
      localStorage: {getItem() {if (stored === 'blocked') throw Error('Unavailable'); return stored;}},
    });
    assert.equal(node('#businessName').value, 'Paws & Polish');
    assert.match(node('#historyList').innerHTML, /Create your first draft/);
  }
});
