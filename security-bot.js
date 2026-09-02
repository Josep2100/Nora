/**
 * ============================================================================
 * 🤖 BOT GUARDIÁN DE SEGURIDAD Y MANTENIMIENTO 24/7 - NORA
 * ============================================================================
 * Funciones automáticas:
 * 1. Vigilancia de salud (Heartbeat cada 60s con auto-reinicio si el servidor falla)
 * 2. Copias de seguridad automáticas diarias de la base de datos (data/backups/)
 * 3. Rotación de backups (mantiene los últimos 30 backups para no saturar disco)
 * 4. Registro y auditoría de eventos de seguridad (data/security-logs.txt)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_FILE = path.join(DATA_DIR, 'security-logs.txt');
const HEALTH_URL = 'http://localhost:3000/api/health';

let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_RESTART = 3;

// Asegurar directorios
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function logSecurityEvent(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  console.log(`🤖 Guardián Nora -> ${line.trim()}`);
  try {
    fs.appendFileSync(LOGS_FILE, line, 'utf8');
  } catch (err) {
    console.error('Error escribiendo log:', err);
  }
}

/**
 * 💾 Realizar copia de seguridad automática de la base de datos
 */
function performDatabaseBackup() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      logSecurityEvent('WARN', 'Archivo users.json no existe todavía, omitiendo backup.');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `users_backup_${dateStr}.json`);

    fs.copyFileSync(USERS_FILE, backupFile);
    logSecurityEvent('INFO', `✅ Copia de seguridad creada con éxito: ${path.basename(backupFile)}`);

    // Rotación: eliminar backups antiguos si hay más de 30
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('users_backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 30) {
      files.slice(30).forEach(oldFile => {
        try {
          fs.unlinkSync(oldFile.path);
          logSecurityEvent('INFO', `🗑️ Rotación de seguridad: backup antiguo purgado (${oldFile.name})`);
        } catch (e) {}
      });
    }
  } catch (error) {
    logSecurityEvent('ERROR', `Fallo al generar copia de seguridad: ${error.message}`);
  }
}

/**
 * 💓 Comprobación de salud del servidor
 */
function checkServerHealth() {
  http.get(HEALTH_URL, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        consecutiveFailures = 0;
      } else {
        handleHealthFailure(`HTTP Status ${res.statusCode}`);
      }
    });
  }).on('error', (err) => {
    handleHealthFailure(err.message);
  });
}

function handleHealthFailure(reason) {
  consecutiveFailures++;
  logSecurityEvent('WARN', `Aviso de latencia/salud: Servidor no respondió correctamente (${reason}). Fallo ${consecutiveFailures}/${MAX_FAILURES_BEFORE_RESTART}`);

  if (consecutiveFailures >= MAX_FAILURES_BEFORE_RESTART) {
    logSecurityEvent('ALERT', '🚨 Servidor no responde. Iniciando auto-recuperación de emergencia...');
    attemptServerRestart();
    consecutiveFailures = 0;
  }
}

function attemptServerRestart() {
  const isWindows = process.platform === 'win32';
  const restartCmd = isWindows
    ? 'powershell -Command "Stop-Process -Name node -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Start-Process -NoNewWindow node server.js"'
    : 'pkill -f "node server.js"; sleep 1; nohup node server.js > /dev/null 2>&1 &';

  exec(restartCmd, (err) => {
    if (err) {
      logSecurityEvent('ERROR', `Error en auto-reinicio: ${err.message}`);
    } else {
      logSecurityEvent('INFO', '✨ Comando de auto-recuperación ejecutado con éxito.');
    }
  });
}

// ============================================================================
// INICIALIZACIÓN DEL BOT
// ============================================================================
logSecurityEvent('INFO', '🛡️ Bot Guardián de Seguridad y Mantenimiento de Nora INICIADO.');

// 1. Backup inicial inmediato al arrancar
performDatabaseBackup();

// 2. Chequeo de salud continuo cada 30 segundos
setInterval(checkServerHealth, 30 * 1000);

// 3. Backup automático diario cada 24 horas (86400000 ms)
setInterval(performDatabaseBackup, 24 * 60 * 60 * 1000);

