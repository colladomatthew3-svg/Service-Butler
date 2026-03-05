import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const APP_URL = 'http://localhost:3000';
const SCREENSHOT_PATH = path.join('screenshots', 'homepage.png');
const DEV_SERVER_START_TIMEOUT_MS = 120_000;

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1_000);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

async function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for server on port ${port}`);
}

async function startDevServerIfNeeded(): Promise<{ process: ChildProcess | null; startedByScript: boolean }> {
  if (await isPortOpen(3000)) {
    console.log('Dev server already running on port 3000.');
    return { process: null, startedByScript: false };
  }

  console.log('Starting dev server...');

  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    detached: process.platform !== 'win32',
  });

  await waitForServer(3000, DEV_SERVER_START_TIMEOUT_MS);
  console.log('Dev server is ready.');

  return { process: devProcess, startedByScript: true };
}

async function takeScreenshot(): Promise<void> {
  const { process: devProcess, startedByScript } = await startDevServerIfNeeded();

  try {
    await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

    await browser.close();

    console.log(`Saved screenshot to ${SCREENSHOT_PATH}`);
  } finally {
    if (startedByScript && devProcess?.pid) {
      console.log('Stopping dev server...');
      if (process.platform === 'win32') {
        devProcess.kill();
      } else {
        process.kill(-devProcess.pid, 'SIGTERM');
      }
    }
  }
}

takeScreenshot().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
