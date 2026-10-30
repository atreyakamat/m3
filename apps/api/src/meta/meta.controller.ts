import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CONSENT_STEP,
  QUESTIONNAIRE_VERSION,
  WORKER_SCREENING_SECTIONS,
} from '@m3/shared';

@ApiTags('meta')
@Controller({ path: 'meta', version: '1' })
export class MetaController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness/health check' })
  health() {
    return { status: 'ok', service: 'm3-api', time: new Date().toISOString() };
  }

  @Get('questionnaire')
  @ApiOperation({ summary: 'Worker initial-screening questionnaire definition (versioned)' })
  questionnaire() {
    return {
      version: QUESTIONNAIRE_VERSION,
      sections: WORKER_SCREENING_SECTIONS,
      consent: CONSENT_STEP,
    };
  }
}
