const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FLOWY_GEMINI_API_KEY = 'test-key-never-sent';
const { routeIntent } = require('../dist-electron/backend/ai/router.js');

const routines = [
  { id: 'work', name: 'Deep Work', description: 'Coding and focus', category: 'work' },
  { id: 'game', name: 'Gaming', description: 'Steam and Discord', category: 'gaming' },
];

function providerResponse(decision) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(decision) }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function request(overrides = {}) {
  return { requestId: 'request-1', text: 'I want to code', routines, ...overrides };
}

test('accepts an allowlisted match', async () => {
  global.fetch = async () => providerResponse({ status: 'match', routineId: 'work' });
  const result = await routeIntent(request(), new AbortController().signal);
  assert.deepEqual(result, { ok: true, requestId: 'request-1', decision: { status: 'match', routineId: 'work' } });
});

test('rejects an invented routine ID', async () => {
  global.fetch = async () => providerResponse({ status: 'match', routineId: 'invented' });
  const result = await routeIntent(request(), new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_RESPONSE');
});

test('rejects duplicate ambiguous candidates', async () => {
  global.fetch = async () => providerResponse({ status: 'ambiguous', candidateIds: ['work', 'work'] });
  const result = await routeIntent(request(), new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_RESPONSE');
});

test('rejects oversized or empty requests before calling the provider', async () => {
  let called = false;
  global.fetch = async () => { called = true; return providerResponse({ status: 'no_match' }); };
  const result = await routeIntent(request({ text: '' }), new AbortController().signal);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_REQUEST');
  assert.equal(called, false);
});

test('returns ambiguous when numbered variants exist and user does not specify one', async () => {
  const variantRoutines = [
    { id: 'coding', name: 'Coding', description: 'Open VS Code' },
    { id: 'coding2', name: 'Coding 2', description: 'Open Cursor' },
  ];
  const ambig = await routeIntent(
    { requestId: 'req-ambig', text: 'gw mau coding nih', routines: variantRoutines },
    new AbortController().signal,
  );
  assert.deepEqual(ambig, {
    ok: true,
    requestId: 'req-ambig',
    decision: { status: 'ambiguous', candidateIds: ['coding', 'coding2'] },
  });

  const explicit = await routeIntent(
    { requestId: 'req-biasa', text: 'gw mau coding biasa', routines: variantRoutines },
    new AbortController().signal,
  );
  assert.deepEqual(explicit, {
    ok: true,
    requestId: 'req-biasa',
    decision: { status: 'match', routineId: 'coding' },
  });
});
