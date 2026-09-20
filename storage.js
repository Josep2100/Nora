const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const session = require('express-session');
require('dotenv').config();

const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const eventsFile = path.join(dataDir, 'events.json');
const encryptionKey = crypto.createHash('sha256').update(process.env.DATA_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'nora-local-encryption-key').digest();
let usersCache = [];
let pool = null;
let mode = 'encrypted-file';
let supabaseEnabled = false;
let supabaseSessionsEnabled = false;
const memorySessions = new Map();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function supabaseRequest(endpoint, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body}`);
  return body.trim() ? JSON.parse(body) : null;
}

function ensureFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf8');
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '[]', 'utf8');
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return JSON.stringify({ encrypted: true, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
}

function decrypt(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed.encrypted) return parsed;
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(parsed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64')), decipher.final()]).toString('utf8'));
}

function readLocalUsers() {
  try {
    const raw = fs.readFileSync(usersFile, 'utf8');
    const parsed = decrypt(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('No se pudo leer el almacenamiento local:', error.message);
    return [];
  }
}

function writeLocalUsers(users) {
  fs.writeFileSync(usersFile, encrypt(JSON.stringify(users)), 'utf8');
}

async function initStorage() {
  ensureFiles();
  const localUsers = readLocalUsers();
  if (supabaseUrl && supabaseKey) {
    try {
      const remoteUsers = await supabaseRequest('nora_users?select=payload&order=created_at.asc');
      if (remoteUsers.length === 0 && localUsers.length) {
        await supabaseRequest('nora_users', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(localUsers.map(user => ({ id: user.id, email: user.email, payload: user }))) });
      }
      const freshUsers = await supabaseRequest('nora_users?select=payload&order=created_at.asc');
      usersCache = freshUsers.map(row => row.payload);
      supabaseEnabled = true;
      try { await supabaseRequest('nora_sessions?select=id&limit=1'); supabaseSessionsEnabled = true; } catch (_) { supabaseSessionsEnabled = false; }
      mode = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'supabase-anon';
    } catch (error) {
      console.warn(`Supabase no está listo (${error.message}).`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`El almacenamiento gestionado no está disponible en producción: ${error.message}`);
      }
      mode = 'encrypted-file';
      usersCache = localUsers;
    }
  } else if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    await pool.query(`CREATE TABLE IF NOT EXISTS nora_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE IF NOT EXISTS nora_events (id BIGSERIAL PRIMARY KEY, user_id TEXT, event_name TEXT NOT NULL, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW());`);
    const result = await pool.query('SELECT payload FROM nora_users ORDER BY created_at ASC');
    if (result.rows.length === 0 && localUsers.length) {
      for (const user of localUsers) await pool.query('INSERT INTO nora_users (id, email, payload) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [user.id, user.email, user]);
    }
    const fresh = await pool.query('SELECT payload FROM nora_users ORDER BY created_at ASC');
    usersCache = fresh.rows.map(row => row.payload);
    mode = 'postgresql';
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('La producción requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY o DATABASE_URL.');
    }
    usersCache = localUsers;
    // Converts legacy plaintext users.json to encrypted-at-rest storage.
    const raw = fs.readFileSync(usersFile, 'utf8');
    if (!raw.trim().startsWith('{')) writeLocalUsers(usersCache);
  }
  return { mode, users: usersCache.length };
}

function loadUsers() { return usersCache.map(user => JSON.parse(JSON.stringify(user))); }

function saveUsers(users) {
  usersCache = Array.isArray(users) ? users : [];
  if (supabaseEnabled) {
    Promise.all(usersCache.map(user => supabaseRequest('nora_users', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: user.id, email: user.email, payload: user }) }))).catch(error => console.error('Error guardando en Supabase:', error.message));
  } else if (pool) {
    Promise.all(usersCache.map(user => pool.query('INSERT INTO nora_users (id, email, payload) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, payload = EXCLUDED.payload, updated_at = NOW()', [user.id, user.email, user]))).catch(error => console.error('Error guardando en PostgreSQL:', error.message));
  } else {
    writeLocalUsers(usersCache);
  }
}

async function trackEvent(userId, eventName, metadata = {}) {
  const safeMetadata = { ...metadata };
  delete safeMetadata.message; delete safeMetadata.email; delete safeMetadata.name;
  if (supabaseEnabled) return supabaseRequest('nora_events', { method: 'POST', body: JSON.stringify({ user_id: userId || null, event_name: eventName, metadata: safeMetadata }) });
  if (pool) return pool.query('INSERT INTO nora_events (user_id, event_name, metadata) VALUES ($1, $2, $3)', [userId || null, eventName, safeMetadata]);
  let events = [];
  try { events = JSON.parse(fs.readFileSync(eventsFile, 'utf8')); } catch (_) {}
  events.push({ userId: userId || null, eventName, metadata: safeMetadata, createdAt: new Date().toISOString() });
  fs.writeFileSync(eventsFile, JSON.stringify(events.slice(-5000), null, 2), 'utf8');
}

async function getMetrics() {
  if (supabaseEnabled) {
    const events = await supabaseRequest('nora_events?select=event_name');
    return events.reduce((acc, event) => { acc[event.event_name] = (acc[event.event_name] || 0) + 1; return acc; }, {});
  }
  if (pool) {
    const result = await pool.query('SELECT event_name, COUNT(*)::int AS total FROM nora_events GROUP BY event_name ORDER BY total DESC');
    return Object.fromEntries(result.rows.map(row => [row.event_name, row.total]));
  }
  try {
    const events = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
    return events.reduce((acc, event) => { acc[event.eventName] = (acc[event.eventName] || 0) + 1; return acc; }, {});
  } catch (_) { return {}; }
}

function getStatus() { return { mode, ready: true, managed: mode === 'postgresql' || mode === 'supabase' }; }

class NoraSessionStore extends session.Store {
  get(id, callback) {
    if (!supabaseSessionsEnabled) return callback(null, memorySessions.get(id) || null);
    supabaseRequest(`nora_sessions?select=payload,expires_at&id=eq.${encodeURIComponent(id)}`).then(rows => {
      if (!rows.length || (rows[0].expires_at && new Date(rows[0].expires_at) < new Date())) return callback(null, null);
      callback(null, rows[0].payload);
    }).catch(error => callback(error));
  }
  set(id, sessionData, callback) {
    const expiresAt = sessionData.cookie?.expires || new Date(Date.now() + 30 * 86400000).toISOString();
    if (!supabaseSessionsEnabled) { memorySessions.set(id, sessionData); return callback?.(null); }
    supabaseRequest('nora_sessions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, payload: sessionData, expires_at: expiresAt }) }).then(() => callback?.(null)).catch(error => callback?.(error));
  }
  destroy(id, callback) {
    memorySessions.delete(id);
    if (!supabaseSessionsEnabled) return callback?.(null);
    supabaseRequest(`nora_sessions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => callback?.(null)).catch(error => callback?.(error));
  }
  touch(id, sessionData, callback) { this.set(id, sessionData, callback); }
}

function getSessionStore() { return new NoraSessionStore(); }

module.exports = { initStorage, loadUsers, saveUsers, trackEvent, getMetrics, getStatus, getSessionStore };
