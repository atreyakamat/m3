import { execSync } from 'child_process';

/** Applies migrations to the test database once before the e2e suite runs. */
export default function globalSetup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://m3:change-me-in-prod@localhost:5544/m3_test?schema=public';
  execSync('npx prisma migrate deploy', {
    cwd: __dirname + '/../..',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
