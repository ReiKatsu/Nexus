import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: id => imports[id] ?? require(id) });
  return exports;
}
const id = '10000000-0000-4000-8000-000000000001';
function setup(options = {}) {
  const calls = [];
  let clients = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: 'owner' } }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const query = {
        select() { return query; },
        update(patch) { call.patch = patch; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        maybeSingle: async () => table === 'profiles'
          ? { data: { status_akun: options.suspended ? 'SUSPENDED' : 'ACTIVE' }, error: null }
          : call.patch
            ? { data: options.noUpdate ? null : { notification_id: id }, error: options.updateError ?? null }
            : { data: options.existing ?? null, error: options.readError ?? null },
      };
      return query;
    },
  };
  const run = load('../src/app/notifications/actions.ts', {
    '@/lib/supabase/server': { createClient: async () => { clients++; return client; } },
  }).markNotificationRead;
  return { run, calls, clients: () => clients };
}

test('standard five-part notification UUID passes; malformed values do no network work', async () => {
  const valid = setup(); assert.equal((await valid.run(id)).success, true);
  for (const input of [null, 1, {}, 'bad', '10000000-0000-4000-000000000001']) {
    const s = setup(); assert.equal((await s.run(input)).success, false); assert.equal(s.clients(), 0);
  }
});
test('anonymous and suspended callers cannot update notifications', async () => {
  for (const options of [{ anonymous: true }, { suspended: true }]) {
    const s = setup(options); assert.equal((await s.run(id)).success, false);
    assert.ok(!s.calls.some(c => c.table === 'notifications'));
  }
});
test('opening one notification updates only its owner-scoped unread flag', async () => {
  const s = setup(); assert.equal((await s.run(id)).success, true);
  const write = s.calls.find(c => c.patch);
  assert.deepEqual(JSON.parse(JSON.stringify(write.patch)), { is_read: true });
  assert.deepEqual(write.filters, [['notification_id', id], ['user_id', 'owner'], ['is_read', false]]);
});
test('already read in another tab succeeds only after an owner-scoped lookup', async () => {
  const s = setup({ noUpdate: true, existing: { is_read: true } });
  assert.equal((await s.run(id)).success, true);
  assert.deepEqual(s.calls.at(-1).filters, [['notification_id', id], ['user_id', 'owner']]);
});
test('foreign/missing notification and write/read failures cannot report success or leak errors', async () => {
  for (const options of [{ noUpdate: true }, { noUpdate: true, existing: { is_read: false } },
    { noUpdate: true, existing: { is_read: true }, readError: {} }, { updateError: { message: 'private detail' } }]) {
    const result = await setup(options).run(id);
    assert.equal(result.success, false); assert.doesNotMatch(result.message, /private detail/);
  }
});
test('notification renders an accessible unread dot and native disclosure without manual mark button', () => {
  const Item = load('../src/app/notifications/NotificationItem.tsx', {
    './actions': { markNotificationRead: async () => ({ success: true }) },
  }).default;
  for (const read of [false, true]) {
    const html = require('react-dom/server').renderToStaticMarkup(require('react').createElement(Item, {
      item: { notification_id: id, title: 'Mission ditolak', body: 'Lengkapi informasi',
        created_at: '2026-10-14T00:00:00Z', is_read: read },
    }));
    assert.match(html, /<details/); assert.match(html, /<summary/);
    assert.equal(html.includes('Belum dibaca'), !read);
    assert.doesNotMatch(html, /Tandai dibaca|<button/);
  }
});
