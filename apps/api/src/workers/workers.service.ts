import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Language } from '@prisma/client';
import { deriveMalariaStatus, type MalariaStatus } from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** First-time construction-site selection. Later changes go via Transfer. */
  async assignInitialSite(workerId: string, siteCode: string) {
    const active = await this.prisma.workerSiteAssignment.findFirst({ where: { workerId, active: true } });
    if (active) {
      throw new ConflictException('You already have an active site; use Transfer to change sites');
    }
    const site = await this.prisma.constructionSite.findUnique({ where: { siteCode } });
    if (!site || !site.active) throw new NotFoundException('Site not found or inactive');

    const assignment = await this.prisma.workerSiteAssignment.create({
      data: { workerId, siteId: site.id, active: true },
    });
    await this.audit.record({
      actorId: null,
      action: 'INITIAL_SITE_ASSIGNED',
      entityType: 'WorkerSiteAssignment',
      entityId: assignment.id,
      metadata: { workerId, siteId: site.id },
    });
    return { siteId: site.siteCode, name: site.name, since: assignment.startedAt.toISOString() };
  }

  async getActiveAssignment(workerId: string) {
    return this.prisma.workerSiteAssignment.findFirst({
      where: { workerId, active: true },
      include: { site: { include: { area: true, contractor: true } } },
    });
  }

  async getMalariaStatus(workerId: string): Promise<MalariaStatus> {
    const episodes = await this.prisma.malariaEpisode.findMany({
      where: { workerId },
      include: { diagnostics: true },
    });
    const results = episodes.flatMap((e) =>
      e.diagnostics.map((d) => ({ result: d.result, testDate: d.testDate.toISOString() })),
    );
    const hasPendingSample = episodes.some(
      (e) => e.status !== 'RESOLVED' && e.diagnostics.length === 0,
    );
    return deriveMalariaStatus(results, hasPendingSample);
  }

  async getProfile(workerId: string) {
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const [assignment, screening, malariaStatus, episodeCount, prescriptionCount] =
      await Promise.all([
        this.getActiveAssignment(workerId),
        this.prisma.initialScreening.findUnique({ where: { workerId } }),
        this.getMalariaStatus(workerId),
        this.prisma.malariaEpisode.count({ where: { workerId } }),
        this.prisma.prescription.count({ where: { workerId } }),
      ]);

    return {
      workerId: worker.workerCode,
      name: worker.name,
      phone: worker.phone,
      preferredLanguage: worker.preferredLanguage,
      currentSite: assignment
        ? {
            siteId: assignment.site.siteCode,
            name: assignment.site.name,
            area: assignment.site.area.name,
            since: assignment.startedAt.toISOString(),
          }
        : null,
      screening: screening
        ? { status: screening.status, completedAt: screening.completedAt?.toISOString() ?? null }
        : { status: 'NOT_STARTED', completedAt: null },
      malariaStatus,
      episodeCount,
      prescriptionCount,
    };
  }

  async updatePreferredLanguage(workerId: string, language: Language) {
    const worker = await this.prisma.worker.update({
      where: { id: workerId },
      data: { preferredLanguage: language },
    });
    return { preferredLanguage: worker.preferredLanguage };
  }

  /** Minimal confirmation details a contractor may see when entering a Worker ID. */
  async lookupByCode(workerCode: string) {
    const worker = await this.prisma.worker.findUnique({ where: { workerCode } });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');
    const assignment = await this.getActiveAssignment(worker.id);
    return {
      workerId: worker.workerCode,
      name: worker.name,
      currentSite: assignment ? { siteId: assignment.site.siteCode, name: assignment.site.name } : null,
    };
  }

  async requireByCode(workerCode: string) {
    const worker = await this.prisma.worker.findUnique({ where: { workerCode } });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');
    return worker;
  }
}
