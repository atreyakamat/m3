import { Injectable, NotFoundException } from '@nestjs/common';
import type { LocationLevel } from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { paginated, parsePage, type Paginated } from '../common/pagination';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Location-hierarchy drill-down: children of a parent, or all of a level. */
  async locations(level?: LocationLevel, parentId?: string) {
    const nodes = await this.prisma.locationNode.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(parentId ? { parentId } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return nodes.map((n) => ({ id: n.id, level: n.level, name: n.name, parentId: n.parentId }));
  }

  async searchSites(opts: {
    search?: string;
    areaId?: string;
    page?: string;
    pageSize?: string;
  }): Promise<Paginated<{ siteId: string; name: string; area: string; active: boolean }>> {
    const params = parsePage(opts.page, opts.pageSize);
    const where = {
      active: true,
      ...(opts.areaId ? { areaId: opts.areaId } : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: 'insensitive' as const } },
              { siteCode: { contains: opts.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.constructionSite.findMany({
        where,
        include: { area: true },
        orderBy: { name: 'asc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.constructionSite.count({ where }),
    ]);
    return paginated(
      rows.map((s) => ({ siteId: s.siteCode, name: s.name, area: s.area.name, active: s.active })),
      total,
      params,
    );
  }

  async getByCode(siteCode: string) {
    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode },
      include: { area: { include: { parent: { include: { parent: true } } } }, contractor: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    return {
      siteId: site.siteCode,
      name: site.name,
      active: site.active,
      area: site.area.name,
      taluka: site.area.parent?.name ?? null,
      district: site.area.parent?.parent?.name ?? null,
      contractor: site.contractor ? { id: site.contractor.id, name: site.contractor.name } : null,
    };
  }
}
