import { spawn } from 'node:child_process';
import { access, readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = join(root, '.local/postgres-data');
const env = parse(await readFile(join(root, 'backend/.env')));
if (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production')
  throw new Error('Portable PostgreSQL is for local development only.');
let url;
try {
  url = new URL(env.DATABASE_URL);
} catch {
  throw new Error('Configure a local DATABASE_URL in backend/.env.');
}
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
  !/^\/[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(url.pathname) ||
  !url.username ||
  !url.password
)
  throw new Error(
    'Portable PostgreSQL requires a loopback URL, credentials and a simple database name.',
  );
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error(
    'This optional helper currently supports Windows x64. Use Docker on other platforms.',
  );
const requireRuntime = createRequire(join(root, '.local/postgres-runtime/package.json'));
let EmbeddedPostgres;
let binaries;
try {
  ({ default: EmbeddedPostgres } = await import(
    pathToFileURL(requireRuntime.resolve('embedded-postgres')).href
  ));
  binaries = await import(
    pathToFileURL(requireRuntime.resolve('@embedded-postgres/windows-x64')).href
  );
} catch {
  throw new Error('Run npm run db:local:install first.');
}
const control = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(binaries.pg_ctl, ['-D', data, ...args], {
      windowsHide: true,
      stdio: 'ignore',
    });
    child.once('error', () => reject(new Error('Could not launch local PostgreSQL control.')));
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('PostgreSQL control failed. Check .local/postgres.log.')),
    );
  });
if (process.argv.includes('--stop')) {
  await control(['-m', 'fast', '-w', 'stop']);
  console.log('Local PostgreSQL stopped. Data is preserved in .local/postgres-data.');
} else {
  const port = Number(url.port || 5432);
  const occupied = await new Promise((resolve) => {
    const socket = createConnection({ host: url.hostname.replace('[', '').replace(']', ''), port });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
  });
  if (occupied)
    throw new Error('Database port is already in use. No running database was changed.');
  const pg = new EmbeddedPostgres({
    databaseDir: data,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port,
    persistent: true,
    authMethod: 'scram-sha-256',
    createPostgresUser: false,
    onLog: () => {},
    onError: () => console.error('Local PostgreSQL client error; check .local/postgres.log.'),
  });
  const initialized = await access(join(data, 'PG_VERSION')).then(
    () => true,
    () => false,
  );
  if (!initialized) {
    await mkdir(dirname(data), { recursive: true });
    await pg.initialise();
  }
  // pg_ctl provides graceful Windows shutdown and persists independently of this command.
  await control([
    '-l',
    join(root, '.local/postgres.log'),
    '-o',
    `-h localhost -p ${port}`,
    '-w',
    'start',
  ]);
  const client = pg.getPgClient();
  try {
    await client.connect();
    const database = url.pathname.slice(1);
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!existing.rowCount)
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(database)}`);
    console.log(`Local PostgreSQL ready on localhost:${port}. Existing data is preserved.`);
  } catch {
    await control(['-m', 'fast', '-w', 'stop']);
    throw new Error('Local database setup failed. Check credentials and .local/postgres.log.');
  } finally {
    await client.end();
  }
}
