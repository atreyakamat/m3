import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LocationLevel } from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SitesService } from './sites.service';

@ApiTags('sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'sites', version: '1' })
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get('locations')
  @ApiOperation({ summary: 'Location hierarchy nodes (drill-down by level and/or parent)' })
  locations(@Query('level') level?: LocationLevel, @Query('parentId') parentId?: string) {
    return this.sites.locations(level, parentId);
  }

  @Get()
  @ApiOperation({ summary: 'Search/list construction sites (paginated)' })
  search(
    @Query('search') search?: string,
    @Query('areaId') areaId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sites.searchSites({ search, areaId, page, pageSize });
  }

  @Get(':siteCode')
  @ApiOperation({ summary: 'Construction-site details by Site ID' })
  byCode(@Param('siteCode') siteCode: string) {
    return this.sites.getByCode(siteCode);
  }
}
