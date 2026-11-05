import { createZodDto } from 'nestjs-zod';
import {
  createAdminSiteSchema,
  createAdminUserSchema,
  deactivateAdminSiteSchema,
  resetAdminUserPinSchema,
  travelReportReviewSchema,
  updateAdminSiteSchema,
  reviewCorrectionSchema,
} from '@m3/shared';

export class CreateAdminSiteDto extends createZodDto(createAdminSiteSchema) {}
export class UpdateAdminSiteDto extends createZodDto(updateAdminSiteSchema) {}
export class DeactivateAdminSiteDto extends createZodDto(deactivateAdminSiteSchema) {}
export class CreateAdminUserDto extends createZodDto(createAdminUserSchema) {}
export class ResetAdminUserPinDto extends createZodDto(resetAdminUserPinSchema) {}
export class TravelReportReviewDto extends createZodDto(travelReportReviewSchema) {}
export class ReviewCorrectionDto extends createZodDto(reviewCorrectionSchema) {}
