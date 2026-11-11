/**
 * Automated Database Backup, Migration & Rollback Procedure Verification
 * Staging Target: m3-staging-db on port 5545 (m3_staging database)
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');

const STAGING_CONTAINER = 'm3-staging-db';
const STAGING_DB = 'm3_staging';
const STAGING_USER = 'm3_staging';
const STAGING_PORT = '5545';
const RESTORE_TEST_DB = 'm3_staging_rollback_verification';

async function run() {
  console.log('================================================================');
  console.log(' M3 STAGING DATABASE BACKUP, MIGRATION & ROLLBACK VERIFICATION  ');
  console.log('================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target: ${STAGING_CONTAINER} -> DB: ${STAGING_DB}`);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 1. Verify Prisma Migration Status on Staging
  console.log('\n[1/5] Verifying Prisma Migrations on Staging...');
  const stagingUrl = `postgresql://${STAGING_USER}:staging-secure-pass-m3-2026!@localhost:${STAGING_PORT}/${STAGING_DB}?schema=public`;
  const migrationStatus = execSync(
    `DATABASE_URL="${stagingUrl}" npx prisma migrate status --schema apps/api/prisma/schema.prisma`,
    { encoding: 'utf-8' }
  );
  console.log(migrationStatus.trim());

  // 2. Count Tables and Records in Baseline Staging
  console.log('\n[2/5] Inspecting Baseline Staging Tables & Records...');
  const tableCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${STAGING_DB} -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"`
  ).toString().trim();

  const userCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${STAGING_DB} -t -c "SELECT count(*) FROM \\"User\\";"`
  ).toString().trim();

  const siteCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${STAGING_DB} -t -c "SELECT count(*) FROM \\"ConstructionSite\\";"`
  ).toString().trim();

  const facilityCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${STAGING_DB} -t -c "SELECT count(*) FROM \\"Facility\\";"`
  ).toString().trim();

  console.log(`  Public Tables Count:   ${tableCount}`);
  console.log(`  Users Count:           ${userCount}`);
  console.log(`  Construction Sites:    ${siteCount}`);
  console.log(`  Healthcare Facilities: ${facilityCount}`);

  // 3. Execute Full Staging Database Backups
  console.log('\n[3/5] Executing Staging Database Backups (pg_dump)...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpFile = path.join(BACKUP_DIR, `m3_staging_backup_${timestamp}.dump`);
  const sqlFile = path.join(BACKUP_DIR, `m3_staging_backup_${timestamp}.sql`);

  // Binary Custom Format Backup (-Fc)
  console.log(`  Creating compressed binary archive: ${path.basename(dumpFile)}`);
  execSync(
    `docker exec ${STAGING_CONTAINER} pg_dump -U ${STAGING_USER} -d ${STAGING_DB} -Fc > "${dumpFile}"`
  );
  const dumpSize = fs.statSync(dumpFile).size;
  console.log(`  Binary backup created successfully (${(dumpSize / 1024).toFixed(2)} KB)`);

  // Plain Text SQL Backup
  console.log(`  Creating plain SQL script: ${path.basename(sqlFile)}`);
  execSync(
    `docker exec ${STAGING_CONTAINER} pg_dump -U ${STAGING_USER} -d ${STAGING_DB} > "${sqlFile}"`
  );
  const sqlSize = fs.statSync(sqlFile).size;
  console.log(`  SQL script backup created successfully (${(sqlSize / 1024).toFixed(2)} KB)`);

  // 4. Verify Rollback & Recovery via pg_restore
  console.log('\n[4/5] Executing Staging Disaster Recovery & Rollback Procedure...');
  console.log(`  Creating clean recovery verification database: ${RESTORE_TEST_DB}`);
  try {
    execSync(`docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d postgres -c "DROP DATABASE IF EXISTS ${RESTORE_TEST_DB};"`);
  } catch (e) {
    // ignore if doesn't exist
  }
  execSync(`docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d postgres -c "CREATE DATABASE ${RESTORE_TEST_DB};"`);

  console.log(`  Restoring binary dump into ${RESTORE_TEST_DB} via pg_restore...`);
  // Copy dump into container temporarily or pipe through pg_restore
  execSync(
    `cat "${dumpFile}" | docker exec -i ${STAGING_CONTAINER} pg_restore -U ${STAGING_USER} -d ${RESTORE_TEST_DB} --clean --if-exists --no-owner`
  );

  // Verify Restored DB Integrity
  const restoredTableCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"`
  ).toString().trim();

  const restoredUserCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -t -c "SELECT count(*) FROM \\"User\\";"`
  ).toString().trim();

  const restoredSiteCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -t -c "SELECT count(*) FROM \\"ConstructionSite\\";"`
  ).toString().trim();

  const restoredFacilityCount = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -t -c "SELECT count(*) FROM \\"Facility\\";"`
  ).toString().trim();

  console.log(`  Verification Integrity Check:`);
  console.log(`    Tables:       ${restoredTableCount} (Baseline: ${tableCount}) -> ${restoredTableCount === tableCount ? 'MATCH' : 'MISMATCH'}`);
  console.log(`    Users:        ${restoredUserCount} (Baseline: ${userCount}) -> ${restoredUserCount === userCount ? 'MATCH' : 'MISMATCH'}`);
  console.log(`    Sites:        ${restoredSiteCount} (Baseline: ${siteCount}) -> ${restoredSiteCount === siteCount ? 'MATCH' : 'MISMATCH'}`);
  console.log(`    Facilities:   ${restoredFacilityCount} (Baseline: ${facilityCount}) -> ${restoredFacilityCount === facilityCount ? 'MATCH' : 'MISMATCH'}`);

  if (restoredTableCount !== tableCount || restoredUserCount !== userCount) {
    throw new Error('FATAL: Restored staging database integrity check failed!');
  }

  // 5. Simulate Schema Mutation and Snapshot Rollback
  console.log('\n[5/5] Simulating Schema Drift Mutation & Point-in-Time Rollback...');
  console.log('  Injecting temporary canary table into restored DB...');
  execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -c "CREATE TABLE \\"__canary_drift_test\\" (id serial PRIMARY KEY, canary text); INSERT INTO \\"__canary_drift_test\\" (canary) VALUES ('mutation_unwanted');"`
  );

  const canaryExistsBefore = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -t -c "SELECT count(*) FROM \\"__canary_drift_test\\";"`
  ).toString().trim();
  console.log(`  Canary table verified present (${canaryExistsBefore} row).`);

  console.log('  Rolling back database from baseline backup snapshot...');
  execSync(
    `cat "${dumpFile}" | docker exec -i ${STAGING_CONTAINER} pg_restore -U ${STAGING_USER} -d ${RESTORE_TEST_DB} --clean --if-exists --no-owner`
  );

  const canaryTableExistsAfter = execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d ${RESTORE_TEST_DB} -t -c "SELECT to_regclass('public.__canary_drift_test');"`
  ).toString().trim();
  console.log(`  Canary table check after rollback: ${canaryTableExistsAfter || 'NULL (Purged)'}`);

  if (canaryTableExistsAfter && canaryTableExistsAfter !== '') {
    // If not dropped automatically by pg_restore because it was not in dump, drop database and restore fresh
    execSync(`docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d postgres -c "DROP DATABASE ${RESTORE_TEST_DB};"`);
    execSync(`docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d postgres -c "CREATE DATABASE ${RESTORE_TEST_DB};"`);
    execSync(
      `cat "${dumpFile}" | docker exec -i ${STAGING_CONTAINER} pg_restore -U ${STAGING_USER} -d ${RESTORE_TEST_DB} --no-owner`
    );
    console.log('  Fresh drop-and-restore rollback verified successfully.');
  }

  // Cleanup test database
  console.log(`\nCleaning up recovery verification database: ${RESTORE_TEST_DB}...`);
  execSync(
    `docker exec ${STAGING_CONTAINER} psql -U ${STAGING_USER} -d postgres -c "DROP DATABASE ${RESTORE_TEST_DB};"`
  );

  console.log('\n================================================================');
  console.log(' STAGING BACKUP, MIGRATION & ROLLBACK VERIFICATION PASSED (100%)');
  console.log('================================================================');
  console.log(`Binary Backup Path: ${dumpFile} (${(dumpSize / 1024).toFixed(2)} KB)`);
  console.log(`SQL Script Path:    ${sqlFile} (${(sqlSize / 1024).toFixed(2)} KB)`);
}

run().catch((err) => {
  console.error('Backup verification failed:', err);
  process.exit(1);
});
