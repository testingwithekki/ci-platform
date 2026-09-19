import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createAppJwt, verifyWebhookSignature } from '../src/security.js';

test('verifies the raw webhook body and rejects a changed body', () => {
  const body = Buffer.from('{"action":"queued"}');
  const signature = `sha256=${crypto.createHmac('sha256', 'secret').update(body).digest('hex')}`;
  assert.equal(verifyWebhookSignature(body, signature, 'secret'), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{}'), signature, 'secret'), false);
});

test('creates an RS256 GitHub App JWT with a nine minute lifetime', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwt = createAppJwt('123', privateKey.export({ type: 'pkcs8', format: 'pem' }), 1_000);
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { iat: 940, exp: 1540, iss: '123' });
  assert.equal(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')), true);
});
