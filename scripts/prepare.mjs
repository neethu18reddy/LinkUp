// Git hooks are a local development tool, not a deployment prerequisite.
const skipHooks =
  process.env.HUSKY === '0' ||
  process.env.NODE_ENV === 'production' ||
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.VERCEL === '1';

if (!skipHooks) {
  const { default: installHooks } = await import('husky');
  const message = installHooks();
  if (message) console.log(message);
}
