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
  const res = await ctx.http().post('/api/v1/auth/staff/login').send({ username: opts.username, password: 'password123' });
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
