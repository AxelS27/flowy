const test = require('node:test');
const assert = require('node:assert/strict');

const { SttManager } = require('../dist-electron/backend/stt/sttManager.js');
const { GroqWhisperProvider } = require('../dist-electron/backend/stt/providers/whisperStt.js');

const VALID_AUDIO_BASE64 = Buffer.alloc(4096, 1).toString('base64');

function makeRequest(overrides = {}) {
  return {
    requestId: 'stt-req-1',
    audioBase64: VALID_AUDIO_BASE64,
    mimeType: 'audio/webm;codecs=opus',
    language: 'id-ID',
    ...overrides,
  };
}

test('SttManager returns NOT_CONFIGURED when provider is not configured', async () => {
  const manager = new SttManager({
    name: 'mock',
    isConfigured: () => false,
    transcribe: async () => 'should not run',
  });

  const res = await manager.transcribe(makeRequest());
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NOT_CONFIGURED');
});

test('SttManager rejects disallowed MIME types and too-short audio before calling provider', async () => {
  let called = false;
  const manager = new SttManager({
    name: 'mock',
    isConfigured: () => true,
    transcribe: async () => {
      called = true;
      return 'ok';
    },
  });

  const badMime = await manager.transcribe(makeRequest({ mimeType: 'audio/flac' }));
  assert.equal(badMime.ok, false);
  assert.equal(badMime.code, 'INVALID_REQUEST');

  const tooShort = await manager.transcribe(
    makeRequest({ audioBase64: Buffer.alloc(100, 1).toString('base64') }),
  );
  assert.equal(tooShort.ok, false);
  assert.equal(tooShort.code, 'INVALID_REQUEST');
  assert.equal(called, false);
});

test('SttManager normalizes whitespace and caps transcript length', async () => {
  const longText = `  halo   dunia  ${'a'.repeat(2500)}  `;
  const manager = new SttManager({
    name: 'mock',
    isConfigured: () => true,
    transcribe: async () => longText,
  });

  const res = await manager.transcribe(makeRequest());
  assert.equal(res.ok, true);
  assert.equal(res.text.startsWith('halo dunia '), true);
  assert.equal(res.text.length, 2000);
});

test('SttManager returns CANCELLED when external signal is already aborted', async () => {
  const manager = new SttManager({
    name: 'mock',
    isConfigured: () => true,
    transcribe: async () => 'ok',
  });

  const controller = new AbortController();
  controller.abort();
  const res = await manager.transcribe(makeRequest(), controller.signal);
  assert.equal(res.ok, false);
  assert.equal(res.code, 'CANCELLED');
});

test('GroqWhisperProvider uploads matching webm filename/MIME and maps 401 to AUTHENTICATION', async () => {
  process.env.FLOWY_GROQ_API_KEY = 'gsk_test_key';
  const provider = new GroqWhisperProvider();

  let uploadedFileName = '';
  let uploadedMimeType = '';
  global.fetch = async (_url, init) => {
    const file = init.body.get('file');
    uploadedFileName = file.name;
    uploadedMimeType = file.type;
    return new Response(JSON.stringify({ text: 'buka mode kerja' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const text = await provider.transcribe({
    audioBase64: VALID_AUDIO_BASE64,
    mimeType: 'audio/webm;codecs=opus',
    language: 'id-ID',
    signal: new AbortController().signal,
  });

  assert.equal(text, 'buka mode kerja');
  assert.equal(uploadedFileName, 'recording.webm');
  assert.equal(uploadedMimeType, 'audio/webm');

  global.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });

  await assert.rejects(
    () =>
      provider.transcribe({
        audioBase64: VALID_AUDIO_BASE64,
        mimeType: 'audio/wav',
        signal: new AbortController().signal,
      }),
    (err) => err.code === 'AUTHENTICATION',
  );
});
