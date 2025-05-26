import { spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import {
  readFile,
  writeFile,
  mkdir,
  access,
  constants,
} from 'node:fs/promises';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import fetch, { Response } from 'node-fetch';
import dotenv from 'dotenv';
import { mainnet } from 'viem/chains';
import { privateKeyToAddress, type Address } from 'viem/accounts';
import { fundAccountWithEth } from './src/demo/fund-account.js';
import { getAddress, parseEther } from 'viem';

interface ExecResult {
  code: number;
  stdout: string;
}

const exec = promisify(
  (
    cmd: string,
    opts: ShellOptions = {},
    cb: (err: Error | null, result: ExecResult) => void
  ) => {
    const proc = spawn(cmd, { ...opts, shell: true, stdio: 'pipe' });
    let stdout = '';
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    proc.on('exit', (code) => cb(null, { code: code ?? 1, stdout }));
    proc.on('error', cb);
    return proc;
  }
);

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const meeDir = pathJoin(here, 'mee-node');

const WANTED_CHAIN_ID = process.env.CHAIN_ID ?? mainnet.id;

let anvilProc: ChildProcess | undefined;

/* ---------- utility helpers ---------- */
const exists = async (p: string): Promise<boolean> =>
  access(p, constants.F_OK)
    .then(() => true)
    .catch(() => false);

interface ShellOptions {
  cwd?: string;
  [key: string]: any;
}

const sh = (cmd: string, opts: ShellOptions = {}): Promise<void> =>
  new Promise((res, rej) => {
    const p = spawn(cmd, { shell: true, stdio: 'inherit', ...opts });
    p.on('exit', (code) =>
      code === 0 ? res() : rej(new Error(`"${cmd}" exited ${code}`))
    );
  });

const waitForUrl = async (url: string, timeout = 30_000): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (url.includes('8545')) {
      try {
        const ok = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        }).then((r: Response) => r.json());

        if (ok && 'result' in ok) return;
      } catch {}
    } else {
      try {
        const ok = await fetch(url);
        if (ok.ok) return;
      } catch {}
    }
    await wait(2_000);
  }
  throw new Error(`Timeout waiting for ${url}`);
};

interface SpinnerOptions {
  text: string;
  frames?: string[];
  interval?: number;
}

const createSpinner = (options: SpinnerOptions) => {
  const frames = options.frames || [
    '⠋',
    '⠙',
    '⠹',
    '⠸',
    '⠼',
    '⠴',
    '⠦',
    '⠧',
    '⠇',
    '⠏',
  ];
  const interval = options.interval || 80;
  let frameIndex = 0;
  let spinnerInterval: NodeJS.Timeout;

  const start = () => {
    process.stdout.write('\x1B[?25l'); // hide cursor
    spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${frames[frameIndex]} ${options.text}`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, interval);
  };

  const stop = (finalText?: string) => {
    clearInterval(spinnerInterval);
    process.stdout.write('\r\x1B[K'); // clear line
    process.stdout.write('\x1B[?25h'); // show cursor
    if (finalText) {
      console.log(finalText);
    }
  };

  return { start, stop };
};

interface MeeHealthResponse {
  supportedChains: {
    chainId: string;
    healthCheck: {
      status: string;
    };
  }[];
}

const waitForMeeHealth = async (timeout = 120_000): Promise<void> => {
  const url = 'http://localhost:3000/v3/info';
  const start = Date.now();

  const spinner = createSpinner({
    text: 'Waiting for MEE Node health check...',
  });
  spinner.start();

  try {
    while (Date.now() - start < timeout) {
      try {
        const data = (await fetch(url).then((r: Response) =>
          r.json()
        )) as MeeHealthResponse;
        const status = data.supportedChains.find(
          (c) => Number(c.chainId) === Number(WANTED_CHAIN_ID)
        )?.healthCheck?.status;
        if (status === 'healthy') {
          spinner.stop('✅ MEE Node healthy');
          return;
        }
      } catch {}
      await wait(2_000);
    }
    spinner.stop();
    throw new Error('MEE Node never reached healthy status');
  } catch (error) {
    spinner.stop();
    throw error;
  }
};

const containerUp = async (name: string): Promise<boolean> => {
  try {
    const { stdout } = (await exec(
      `docker inspect --format='{{.State.Status}}' ${name}`,
      {}
    )) as ExecResult;
    return stdout.trim() === 'running';
  } catch {
    return false;
  }
};

/* ---------- cleanup ---------- */
const cleanup = async (): Promise<void> => {
  console.log('\n🧹  Cleaning up…');
  try {
    if (anvilProc && !anvilProc.killed) {
      anvilProc.kill('SIGTERM');
      await new Promise<void>((r) => anvilProc!.on('exit', r));
    }
    if (await exists(meeDir)) {
      await sh('docker compose down --remove-orphans', { cwd: meeDir });
    }
    await sh('pkill -f anvil || true').catch(() => {}); // ensure stray forks die
  } catch (e) {
    console.error('Cleanup error:', e);
  }
};

['SIGINT', 'SIGTERM'].forEach((sig) =>
  process.on(sig, async () => {
    await cleanup();
    process.exit(0);
  })
);
process.on('exit', cleanup);
process.on('uncaughtException', async (err) => {
  console.error('💥 Uncaught exception:', err);
  await cleanup();
  process.exit(1);
});

/* ---------- main flow ---------- */
const main = async (): Promise<void> => {
  if (!process.env.PRIVATE_KEY || !process.env.ETH_RPC_URL) {
    console.error('❌  .env missing PRIVATE_KEY or ETH_RPC_URL');
    process.exit(1);
  }

  await sh('pkill -f anvil || true').catch(() => {});
  if (await exists(meeDir)) {
    await sh('docker compose down --remove-orphans', { cwd: meeDir });
  }

  if (!(await exists(meeDir))) {
    console.log('Cloning MEE Node…');
    await sh(
      `git clone https://github.com/bcnmy/mee-node-deployment ${meeDir}`
    );

    // Only modify it the first time its being cloned
    const srcCfg = pathJoin(meeDir, `chains-prod/${WANTED_CHAIN_ID}.json`);
    // await mkdir(pathJoin(meeDir, 'chains-demo'), { recursive: true });
    const dstCfg = pathJoin(meeDir, `chains-testnet/${WANTED_CHAIN_ID}.json`);

    const cfg = JSON.parse(await readFile(srcCfg, 'utf8'));
    cfg.rpc = 'http://host.docker.internal:8545';

    await writeFile(dstCfg, JSON.stringify(cfg, null, 2));

    await writeFile(
      pathJoin(meeDir, '.env'),
      `KEY=${process.env.PRIVATE_KEY}\nPORT=3000\nREDIS_HOST=redis\nREDIS_PORT=6379\nHEALTH_CHECK_INTERVAL=10\n`
    );
  } else {
    await sh('git pull', { cwd: meeDir });
  }

  anvilProc = spawn('anvil', [
    '--fork-url',
    process.env.ETH_RPC_URL,
    '--port',
    '8545',
    '--chain-id',
    '1',
    '--host',
    '0.0.0.0',
  ]);

  await sh('docker compose --env-file .env up -d', { cwd: meeDir });
  if (
    !(await containerUp('mee-node-node-1')) ||
    !(await containerUp('mee-node-redis-1'))
  )
    throw new Error('🛑 Docker containers failed to start');

  // Fund the private key account with ETH
  console.log('💰 Funding account with ETH...');
  const accountAddress = privateKeyToAddress(
    ('0x' + process.env.PRIVATE_KEY) as Address
  );

  await fundAccountWithEth(accountAddress, parseEther('1'));
  console.log('✅ Account funded with ETH');

  console.log('⏳ Waiting for Anvil RPC...');
  await waitForUrl('http://127.0.0.1:8545', 30_000);
  console.log('✅ Anvil RPC ready');

  await waitForMeeHealth();

  // Now that health check is complete, show anvil output
  anvilProc.stdout?.pipe(process.stdout);
  anvilProc.stderr?.pipe(process.stderr);

  console.log('✅ Account funded with ETH');

  console.log(
    '🎉  Stack ready →  http://localhost:8545  &  http://localhost:3000'
  );
};

main();
