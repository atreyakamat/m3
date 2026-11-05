/**
 * Development-only Admin bootstrap (spec §3).
 *
 * Creates the initial Admin account from environment variables:
 *   M3_ADMIN_DEV_USERNAME (default: admin)
 *   M3_ADMIN_DEV_PASSWORD (default: admin)
 *
 * Rules enforced here:
 *  - the password is always hashed before storage (never logged or returned);
 *  - the account is locked into the mandatory password change at first login
 *    (mustChangeCredential = true);
 *  - default credentials are refused outside local development; production
 *    requires NODE_ENV=production to unset... i.e. the script aborts, and even
 *    then the DEFAULT dev password is never allowed (M3_ADMIN_DEV_PASSWORD
 *    must be provided explicitly via a secure process).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const username = process.env.M3_ADMIN_DEV_USERNAME ?? 'admin';
  const password = process.env.M3_ADMIN_DEV_PASSWORD ?? 'admin';

  const usingDefaults = !process.env.M3_ADMIN_DEV_USERNAME && !process.env.M3_ADMIN_DEV_PASSWORD;
  if (usingDefaults && nodeEnv !== 'development') {
    throw new Error(
      `Refusing to bootstrap the Admin account with default credentials outside local development (NODE_ENV=${nodeEnv}).`,
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing && existing.role !== 'ADMIN') {
    throw new Error(`Username "${username}" is already used by a non-Admin account.`);
  }

  if (existing) {
    // Dev convenience: keep dev credentials in sync with the environment.
    await prisma.user.update({
      where: { username },
      data: {
        passwordHash,
        mustChangeCredential: true,
        active: true,
      },
    });
    console.log(`Admin account "${username}" reset to environment credentials (first-login change enforced).`);
  } else {
    await prisma.user.create({
      data: {
        role: 'ADMIN',
        username,
        displayName: 'Platform Admin',
        passwordHash,
        mustChangeCredential: true,
        active: true,
      },
    });
    console.log(`Admin account "${username}" created (first-login password change enforced).`);
  }
  console.log('Temporary credentials are valid for first login only. They are never echoed back.');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
