import { chromium } from '@playwright/test';
const [base, ref, extra] = process.argv.slice(2);
const UID = '11111111-2222-3333-4444-555555555555';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = `${b64({ alg: 'HS256' })}.${b64({ sub: UID, aal: 'aal1' })}.sig`;
const nav = await chromium.launch();
const ctx = await nav.newContext();
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 20000 });
await page.evaluate(({ ref, uid, jeton, extra }) => {
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
    access_token: jeton, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) - 7200,
    expires_in: 3600, token_type: 'bearer',
    user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'membre@exemple.fr', app_metadata: {}, user_metadata: { full_name: 'Docteur Test' }, created_at: new Date().toISOString() },
  }));
  if (extra === 'uwh') localStorage.setItem(`uwh_roles:${uid}`, JSON.stringify(['bureau']));
}, { ref, uid: UID, jeton: JETON, extra });
if (extra === 'doc') {
  await page.evaluate(async uid => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('mister-doc-cache', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
      r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ id: 'doc-1', user_id: uid, name: 'Docteur Test', approved: true, is_admin: false }, `self-doctor:${uid}`);
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    });
  }, UID);
}
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
const t0 = Date.now();
for (const s of [3, 15, 30, 40]) {
  const attendre = s * 1000 - (Date.now() - t0);
  if (attendre > 0) await page.waitForTimeout(attendre);
  const e = await page.evaluate(() => ({
    connexion: !!document.querySelector('input[type="email"]') || !!document.querySelector('input[type="password"]'),
    txt: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  }));
  console.log(`  t=${String(s).padStart(2)}s  ${e.connexion ? 'ÉJECTÉ (connexion)' : 'application ouverte '}  « ${e.txt} »`);
}
await nav.close();
