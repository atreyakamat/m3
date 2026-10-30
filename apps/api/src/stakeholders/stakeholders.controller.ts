import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IMPLEMENTED_ROLES, ROLE_LABELS } from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('stakeholders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'stakeholders', version: '1' })
export class StakeholdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Role dashboard metadata (placeholder message for non-implemented roles; no fabricated data)' })
  dashboard(@CurrentUser() user: RequestUser) {
    const implemented = IMPLEMENTED_ROLES.includes(user.role);
    return {
      role: user.role,
      label: ROLE_LABELS[user.role],
      displayName: user.displayName,
      implemented,
      message: implemented
        ? `${ROLE_LABELS[user.role]} workspace`
        : `The ${ROLE_LABELS[user.role]} workflow is not part of this release. This is a placeholder dashboard.`,
    };
  }

  @Get('contractor/sites')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'List construction sites this contractor manages' })
  async contractorSites(@CurrentUser() user: RequestUser) {
    if (!user.contractorId) throw new ForbiddenException('Not a contractor account');
    const sites = await this.prisma.constructionSite.findMany({
      where: { contractorId: user.contractorId },
      include: { area: true, _count: { select: { assignments: { where: { active: true } } } } },
      orderBy: { name: 'asc' },
    });
    return sites.map((s) => ({
      siteId: s.siteCode,
      name: s.name,
      area: s.area.name,
      activeWorkers: s._count.assignments,
    }));
  }
}
