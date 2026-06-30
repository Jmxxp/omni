const { app, BrowserWindow, desktopCapturer, dialog, shell, session } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const isWindows = process.platform === 'win32';
const isDev = !app.isPackaged || process.env.JARVIS_DESKTOP_DEV === '1';
const appRoot = path.resolve(__dirname, '..');
const children = new Map();

let logFile;

function initLogging() {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  logFile = path.join(logsDir, 'jarvis-desktop.log');
  log(`Jarvis desktop boot. packaged=${app.isPackaged} dev=${isDev}`);
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${String(message)}\n`;
  if (logFile) {
    fs.appendFileSync(logFile, line, 'utf8');
  }
  if (isDev) {
    process.stdout.write(line);
  }
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const parsed = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function getDevAgentDir() {
  return path.resolve(appRoot, '..', '..', 'Aula automacao', 'Controle_PC');
}

function getPackagedAgentSourceDir() {
  return path.join(process.resourcesPath, 'agent-source');
}

function getAgentDir() {
  if (process.env.JARVIS_AGENT_DIR) return path.resolve(process.env.JARVIS_AGENT_DIR);
  return app.isPackaged ? getPackagedAgentSourceDir() : getDevAgentDir();
}

function getUserEnvPath() {
  return path.join(app.getPath('userData'), '.env.local');
}

function ensureUserEnvFile() {
  if (!app.isPackaged) return;

  const target = getUserEnvPath();
  if (fs.existsSync(target)) return;

  const example = path.join(appRoot, '.env.example');
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(example)) {
    fs.copyFileSync(example, target);
  } else {
    fs.writeFileSync(
      target,
      [
        'LIVEKIT_URL=',
        'LIVEKIT_API_KEY=',
        'LIVEKIT_API_SECRET=',
        'GOOGLE_API_KEY=',
        'MEM0_API_KEY=',
        'JARVIS_USER_ID=usuario_principal',
        'JARVIS_AGENT_MODE=dev',
        'JARVIS_AUTOSTART_AGENT=1',
        '',
      ].join('\n'),
      'utf8'
    );
  }
}

function buildEnv() {
  const agentDir = getAgentDir();
  const executableDir = path.dirname(process.execPath);
  const envFromFiles = {
    ...parseEnvFile(path.join(appRoot, '.env')),
    ...parseEnvFile(path.join(appRoot, '.env.local')),
    ...parseEnvFile(path.join(executableDir, '.env')),
    ...parseEnvFile(path.join(executableDir, '.env.local')),
    ...parseEnvFile(getUserEnvPath()),
    ...parseEnvFile(path.join(agentDir, '.env')),
  };
  const env = { ...envFromFiles, ...process.env };

  if (!env.GOOGLE_API_KEY && env.GEMINI_API_KEY) {
    env.GOOGLE_API_KEY = env.GEMINI_API_KEY;
  }

  return {
    ...env,
    NODE_ENV: isDev ? 'development' : 'production',
    JARVIS_DESKTOP: '1',
  };
}

function warnMissingEnv(env) {
  const missing = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].filter((key) => !env[key]);
  if (!env.GOOGLE_API_KEY && !env.GEMINI_API_KEY) missing.push('GOOGLE_API_KEY');

  if (missing.length === 0) return;

  dialog.showMessageBox({
    type: 'warning',
    title: 'Configuração incompleta',
    message: 'Algumas chaves do Jarvis ainda não foram configuradas.',
    detail: `Revise o arquivo .env.local antes de iniciar uma conversa.\n\nArquivo do usuário: ${getUserEnvPath()}\n\nFaltando: ${missing.join(', ')}`,
    buttons: ['Abrir mesmo assim'],
  });
}

function findOpenPort(startPort = 3217) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();
      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });
      server.listen({ host: '127.0.0.1', port }, () => {
        server.close(() => resolve(port));
      });
    };
    tryPort(startPort);
  });
}

function waitForHttp(url, timeoutMs = 45_000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      req.on('error', retry);
      req.setTimeout(1_500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Servidor local não respondeu em ${url}`));
        return;
      }
      setTimeout(poll, 500);
    };

    poll();
  });
}

function spawnManaged(name, command, args, options = {}) {
  log(`${name}: starting ${command} ${args.join(' ')}`);

  const child = spawn(command, args, {
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  child.stdout?.on('data', (chunk) => log(`${name}: ${chunk.toString().trimEnd()}`));
  child.stderr?.on('data', (chunk) => log(`${name}: ${chunk.toString().trimEnd()}`));
  child.on('error', (error) => log(`${name}: ${error.message}`));
  child.on('exit', (code, signal) => {
    children.delete(name);
    log(`${name}: exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  });

  children.set(name, child);
  return child;
}

function getNpmCommand() {
  return isWindows ? 'npm.cmd' : 'npm';
}

function getPythonCommand() {
  const agentDir = getAgentDir();
  const venvPython = isWindows
    ? path.join(agentDir, '.venv', 'Scripts', 'python.exe')
    : path.join(agentDir, '.venv', 'bin', 'python');

  if (fs.existsSync(venvPython)) return venvPython;
  return process.env.JARVIS_PYTHON || (isWindows ? 'python' : 'python3');
}

async function startNextServer(env, port) {
  const serverEnv = {
    ...env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NEXT_TELEMETRY_DISABLED: '1',
  };

  if (isDev) {
    spawnManaged('next', getNpmCommand(), ['run', 'dev', '--', '-p', String(port), '-H', '127.0.0.1'], {
      cwd: appRoot,
      env: serverEnv,
    });
  } else {
    const serverPath = path.join(appRoot, '.next', 'standalone', 'server.js');
    if (!fs.existsSync(serverPath)) {
      throw new Error(`Build standalone não encontrado: ${serverPath}`);
    }

    spawnManaged('next', process.execPath, [serverPath], {
      cwd: path.dirname(serverPath),
      env: {
        ...serverEnv,
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
  }

  const url = `http://127.0.0.1:${port}`;
  await waitForHttp(url);
  return url;
}

function startAgent(env) {
  if (env.JARVIS_AUTOSTART_AGENT === '0') {
    log('agent: autostart disabled by JARVIS_AUTOSTART_AGENT=0');
    return;
  }

  const packagedAgent = path.join(process.resourcesPath, 'agent', 'jarvis-agent.exe');
  const agentMode = env.JARVIS_AGENT_MODE || 'dev';

  if (app.isPackaged && fs.existsSync(packagedAgent)) {
    spawnManaged('agent', packagedAgent, [agentMode], {
      cwd: path.dirname(packagedAgent),
      env,
    });
    return;
  }

  const agentDir = getAgentDir();
  const agentPy = path.join(agentDir, 'agent.py');

  if (!fs.existsSync(agentPy)) {
    log(`agent: agent.py não encontrado em ${agentPy}`);
    return;
  }

  spawnManaged('agent', getPythonCommand(), [agentPy, agentMode], {
    cwd: agentDir,
    env,
  });
}

function installPermissionHandlers() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'display-capture'].includes(permission));
  });

  if (typeof session.defaultSession.setDisplayMediaRequestHandler === 'function') {
    session.defaultSession.setDisplayMediaRequestHandler(
      (_request, callback) => {
        desktopCapturer
          .getSources({ types: ['screen', 'window'] })
          .then((sources) => callback({ video: sources[0] }))
          .catch(() => callback({ video: null }));
      },
      { useSystemPicker: true }
    );
  }
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#020407',
    title: 'Jarvis',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });
  win.loadURL(url);

  return win;
}

function killChild(child) {
  if (!child || child.killed) return;

  if (isWindows && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }

  child.kill('SIGTERM');
}

function cleanup() {
  for (const child of children.values()) killChild(child);
  children.clear();
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  initLogging();
  installPermissionHandlers();
  ensureUserEnvFile();

  const env = buildEnv();
  warnMissingEnv(env);

  try {
    const port = Number(env.JARVIS_PORT || 3217);
    const availablePort = await findOpenPort(port);
    const url = await startNextServer(env, availablePort);
    startAgent(env);
    createWindow(url);
  } catch (error) {
    log(error.stack || error.message || String(error));
    dialog.showErrorBox('Jarvis não iniciou', error.message || String(error));
    app.quit();
  }
});
