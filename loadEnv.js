import fs from 'fs';

// Prefer environment variables from the host. If env.json exists locally,
// use it as a fallback and do not overwrite already-set env vars.
const envPath = 'env.json';
if (fs.existsSync(envPath)) {
  const envConfig = JSON.parse(fs.readFileSync(envPath, 'utf8'));
  Object.keys(envConfig).forEach((key) => {
    if (process.env[key] === undefined) {
      process.env[key] = envConfig[key];
    }
  });
}
