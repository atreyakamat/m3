import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Centralized error handler: consistent JSON shape, never leaks internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Internal server error';
    let error = 'InternalServerError';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        message = obj.message ?? obj;
        error = String(obj.error ?? exception.name);
        // Preserve structured detail fields (e.g. missingFieldIds) for clients.
        const { message: _m, error: _e, statusCode: _s, ...rest } = obj;
        extra = rest;
      }
    } else if (exception instanceof Error) {
      // Log the real error server-side only; respond generically.
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...extra,
      timestamp: new Date().toISOString(),
    });
  }
}
