import { createZodDto } from 'nestjs-zod';
import {
  selectActiveFacilitySchema,
  healthWorkerSearchQuerySchema,
  suspectedCaseInputSchema,
  testRequestInputSchema,
  healthWorkerFollowUpInputSchema,
  healthWorkerScreeningInputSchema,
  healthWorkerHouseholdScreeningInputSchema,
} from '@m3/shared';

export class SelectActiveFacilityDto extends createZodDto(selectActiveFacilitySchema) {}
export class HealthWorkerSearchQueryDto extends createZodDto(healthWorkerSearchQuerySchema) {}
export class SuspectedCaseDto extends createZodDto(suspectedCaseInputSchema) {}
export class TestRequestDto extends createZodDto(testRequestInputSchema) {}
export class HealthWorkerFollowUpDto extends createZodDto(healthWorkerFollowUpInputSchema) {}
export class HealthWorkerScreeningDto extends createZodDto(healthWorkerScreeningInputSchema) {}
export class HealthWorkerHouseholdScreeningDto extends createZodDto(healthWorkerHouseholdScreeningInputSchema) {}
