import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url), React = require('react');
const render = element => require('react-dom/server').renderToStaticMarkup(element);
const leader = '10000000-0000-4000-8000-000000000001';
const applicant = '20000000-0000-4000-8000-000000000002';
const mission = '30000000-0000-4000-8000-000000000003';
const applicationId = '40000000-0000-4000-8000-000000000004';
const Link = ({ href, children, className, 'aria-label': label }) => React.createElement('a', { href, className, 'aria-label': label }, children);

function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => imports[name] ?? require(name) });
  return exports;
}

test('applicant identities are resolved by authorized application IDs, with only public route identifiers selected', async () => {
  const calls = [], { loadPendingApplicantIds } = load('../src/lib/squad-applicant-profiles.ts');
  const client = { from(table) {
    calls.push(['from', table]);
    const q = { select(fields) { calls.push(['select', fields]); return q; },
      eq(key, value) { calls.push(['eq', key, value]); return q; },
      in(key, ids) { calls.push(['in', key, Array.from(ids)]); return q; },
      then: resolve => Promise.resolve({ data: [{ application_id: applicationId, user_id: applicant }], error: null }).then(resolve) };
    return q;
  } };
  assert.equal((await loadPendingApplicantIds(client, mission, [applicationId])).get(applicationId), applicant);
  assert.deepEqual(calls, [['from', 'squad_applications'], ['select', 'application_id, user_id'],
    ['eq', 'mission_id', mission], ['eq', 'status_application', 'PENDING'], ['in', 'application_id', [applicationId]]]);
  assert.equal((await loadPendingApplicantIds({ from() { throw Error('unnecessary query'); } }, mission, [])).size, 0);
  const failed = { from() { const q = { select() { return q; }, eq() { return q; }, in() { return q; },
    then: resolve => Promise.resolve({ data: null, error: { message: 'Denied' } }).then(resolve) }; return q; } };
  assert.equal(await loadPendingApplicantIds(failed, mission, [applicationId]), null);
});

test('each pending applicant gets their own profile link without invoking accept or reject', () => {
  let decisions = 0;
  const List = load('../src/app/missions/[missionId]/SquadApplicationDecisionList.tsx', {
    'next/link': { default: Link }, 'next/navigation': { useRouter: () => ({ refresh() {} }) },
    './actions': { decideSquadApplication: () => { decisions++; } },
  }).default;
  const html = render(React.createElement(List, { missionId: mission, applications: [
    { applicationId, applicantUserId: applicant, applicantName: 'Nama yang sama', primaryClassName: 'Creative', submittedAtLabel: '20 Okt' },
    { applicationId: 'another-application', applicantUserId: leader, applicantName: 'Nama yang sama', primaryClassName: null, submittedAtLabel: '20 Okt' },
    { applicationId: 'unavailable', applicantUserId: null, applicantName: 'Belum tersedia', primaryClassName: null, submittedAtLabel: '20 Okt' },
  ] }));
  assert.ok(html.includes(`href="/profile/${applicant}?mission=${mission}"`));
  assert.ok(html.includes(`href="/profile/${leader}?mission=${mission}"`));
  assert.doesNotMatch(html, /\/profile\/null|\/profile\/undefined/);
  assert.match(html, /Profil pelamar belum dapat dimuat/);
  assert.equal((html.match(/>Lihat Profil</g) ?? []).length, 2);
  assert.equal((html.match(/>Terima</g) ?? []).length, 3);
  assert.equal((html.match(/>Tolak</g) ?? []).length, 3);
  assert.equal(decisions, 0);
});

function peerPage(options = {}) {
  const calls = [], Form = () => null;
  const client = { auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: leader } }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const q = { select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push([key, value]); return q; },
        maybeSingle: async () => ({ data: table === 'profiles'
          ? { nama_lengkap: 'Ketua', role_app: options.admin ? 'ADMIN' : 'STUDENT', status_akun: options.suspended ? 'SUSPENDED' : 'ACTIVE' }
          : table === 'public_profiles' ? options.missing ? null : { nama_lengkap: 'Pelamar', bio: 'Bio pelamar', tahun_masuk: 2024, primary_class_id: 1, program_studi_id: 2 }
            : { nama_class: 'Creative', nama_program_studi: 'Bisnis Digital', fakultas_id: 1, nama_fakultas: 'FEB' }, error: null }),
        then: resolve => Promise.resolve({ data: options.skillError ? null : options.emptySkills ? [] : [{ skills: { nama_skill: 'Figma' } }],
          error: options.skillError ? {} : null }).then(resolve) };
      return q;
    },
  };
  const Page = load('../src/app/profile/[userId]/page.tsx', {
    'next/link': { default: Link }, 'next/image': { default: () => null },
    'next/navigation': { redirect: path => { throw Error('redirect:' + path); }, notFound: () => { throw Error('404'); } },
    '@/components/layout/Navbar': { default: () => null }, '@/components/profile/EndorsementSummary': { default: () => null },
    '@/lib/supabase/server': { createClient: async () => client }, './EndorsementForm': { default: Form },
    '@/lib/endorsements': { loadEndorsementSummary: async () => ({}), loadSharedCompletedSquads: async () => [] },
  }).default;
  return { calls, run: (returnMission = mission, userId = applicant) => Page({ params: Promise.resolve({ userId }), searchParams: Promise.resolve({ mission: returnMission }) }), Form };
}

test('recruitment profile shows public suitability details and returns to its Mission without granting endorsement eligibility', async () => {
  const s = peerPage(), page = await s.run(), html = render(page);
  assert.ok(html.includes(`href="/missions/${mission}"`));
  for (const text of ['Kembali ke Mission', 'Pelamar', 'Bio pelamar', 'Creative', 'Bisnis Digital', 'Figma']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Edit profil|Klaim Achievement|type="email"|NIM/);
  const skills = s.calls.find(c => c.table === 'user_skills');
  assert.deepEqual(skills.filters, [['user_id', applicant]]);
  assert.equal(skills.fields, 'skills(nama_skill)');
  assert.equal(s.calls.filter(c => c.table === 'profiles').length, 1);
  assert.deepEqual(s.calls.find(c => c.table === 'profiles').filters, [['user_id', leader]]);
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    assert.notEqual(node.type, s.Form, 'A pending application must not grant a rating form'); walk(node.props?.children);
  };
  walk(page);
});

test('recruitment return links accept only a single UUID and preserve profile auth guards', async () => {
  for (const value of ['https://example.com', '//example.com', [mission], 'javascript:alert(1)', null]) {
    const html = render(await peerPage().run(value));
    assert.match(html, /href="\/leaderboard"/); assert.doesNotMatch(html, /Kembali ke Mission/);
  }
  await assert.rejects(peerPage({ anonymous: true }).run(), /redirect:\/login/);
  await assert.rejects(peerPage({ admin: true }).run(), /redirect:\/admin/);
  await assert.rejects(peerPage({ suspended: true }).run(), /404/);
  await assert.rejects(peerPage({ missing: true }).run(), /404/);
  await assert.rejects(peerPage().run(mission, 'not-a-uuid'), /404/);
  assert.match(render(await peerPage({ emptySkills: true }).run()), /Belum ada Skill yang dipilih/);
  const failed = render(await peerPage({ skillError: true }).run());
  assert.match(failed, /Skill belum dapat dimuat/); assert.doesNotMatch(failed, /Belum ada Skill yang dipilih/);
});
