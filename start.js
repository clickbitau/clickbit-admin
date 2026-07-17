const { spawn } = require('child_process');

const baseEnv = { ...process.env };

const api = spawn('node', ['dist/apps/api/src/main'], {
  cwd: '/app/apps/api',
  stdio: 'inherit',
  env: { ...baseEnv, PORT: '5001' },
});

const web = spawn('node', ['server.js'], {
  cwd: '/app/apps/web',
  stdio: 'inherit',
  env: { ...baseEnv, PORT: '3001', HOSTNAME: '0.0.0.0' },
});

const shutdown = (code) => {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  process.exit(code ?? 0);
};

api.on('exit', (code) => {
  console.log(`API exited with code ${code}`);
  shutdown(code ?? 1);
});

web.on('exit', (code) => {
  console.log(`Web exited with code ${code}`);
  shutdown(code ?? 1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
