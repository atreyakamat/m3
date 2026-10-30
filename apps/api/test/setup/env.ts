// Runs before the e2e test framework initialises. Points Prisma at the test DB.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://m3:change-me-in-prod@localhost:5544/m3_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-change-me-32-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BOOTSTRAP_SECRET = 'test-bootstrap-secret';
process.env.API_CORS_ORIGINS = '*';
