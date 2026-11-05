import * as bcrypt from 'bcryptjs';
import type { TestContext } from './test-app';

export async function createArea(ctx: TestContext, name = 'Test Area'): Promise<string> {
  const state = await ctx.prisma.locationNode.create({ data: { level: 'STATE', name: 'Goa' } });
  const district = await ctx.prisma.locationNode.create({ data: { level: 'DISTRICT', name: 'North Goa', parentId: state.id } });
  const taluka = await ctx.prisma.locationNode.create({ data: { level: 'TALUKA', name: 'Bardez', parentId: district.id } });
  const area = await ctx.prisma.locationNode.create({ data: { level: 'AREA', name, parentId: taluka.id } });
  return area.id;
}

export async function createContractor(
  ctx: TestContext,
  opts: { name: string; username: string },
): Promise<{ contractorId: string; token: string }> {
  const contractor = await ctx.prisma.contractor.create({ data: { name: opts.name } });
  const passwordHash = await bcrypt.hash('password123', 10);
  await ctx.prisma.user.create({
    data: { role: 'CONTRACTOR', username: opts.username, displayName: opts.name, passwordHash, contractorId: contractor.id },
  });
  const res = await ctx.http().post('/api/v1/auth/login').send({ phone: opts.username, pin: 'password123' });
  return { contractorId: contractor.id, token: res.body.token };
}

export async function createStaff(
  ctx: TestContext,
  opts: { role: string; username: string },
): Promise<{ token: string }> {
  const passwordHash = await bcrypt.hash('password123', 10);
  await ctx.prisma.user.create({
    data: { role: opts.role as any, username: opts.username, displayName: opts.username, passwordHash },
  });
  const res = await ctx.http().post('/api/v1/auth/staff/login').send({ username: opts.username, password: 'password123' });
  return { token: res.body.token };
}

/** Creates an Admin account; `pending` simulates the warm first-login state (temp password). */
export async function createAdmin(
  ctx: TestContext,
  opts: { username: string; password?: string; pending?: boolean; displayName?: string },
): Promise<{ userId: string; token: string }> {
  const password = opts.password ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await ctx.prisma.user.create({
    data: {
      role: 'ADMIN',
      username: opts.username,
      displayName: opts.displayName ?? 'Platform Admin',
      passwordHash,
      mustChangeCredential: Boolean(opts.pending),
    },
  });
  const res = await ctx.http()
    .post('/api/v1/auth/staff/login')
    .send({ username: opts.username, password });
  return { userId: user.id, token: res.body.token };
}

/** Creates a Contractor whose user account was provisioned by Admin (phone + temp PIN, first login pending). */
export async function createPendingStakeholder(
  ctx: TestContext,
  opts: { role: string; stakeholderCode: string; phone: string; tempPin: string; name?: string; contractorId?: string },
): Promise<{ userId: string }> {
  const passwordHash = await bcrypt.hash(opts.tempPin, 10);
  const user = await ctx.prisma.user.create({
    data: {
      role: opts.role as any,
      stakeholderCode: opts.stakeholderCode,
      displayName: opts.name ?? opts.stakeholderCode,
      phone: opts.phone,
      passwordHash,
      mustChangeCredential: true,
      contractorId: opts.contractorId ?? null,
    },
  });
  return { userId: user.id };
}

export async function createSite(
  ctx: TestContext,
  opts: { siteCode: string; name: string; areaId: string; contractorId?: string },
): Promise<string> {
  const site = await ctx.prisma.constructionSite.create({
    data: { siteCode: opts.siteCode, name: opts.name, areaId: opts.areaId, contractorId: opts.contractorId ?? null },
  });
  return site.siteCode;
}

export async function registerWorker(
  ctx: TestContext,
  opts: { name: string; phone: string; pin: string },
): Promise<{ token: string; workerId: string }> {
  const res = await ctx.http().post('/api/v1/auth/worker/register').send({ ...opts, preferredLanguage: 'en' });
  return { token: res.body.token, workerId: res.body.user.workerId };
}

export function auth(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
