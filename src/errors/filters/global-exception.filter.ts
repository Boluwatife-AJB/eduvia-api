import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse, FieldError } from '../types/error-response.interface';
import { ErrorCode } from '../types/error-codes.enum';
import { AppException } from '../exceptions/app.exception';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import {
  AccessTokenExpiredException,
  AccessTokenInvalidException,
} from '../exceptions/token.exception';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  private readonly isDev = process.env.NODE_ENV === 'development';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Classify exception
    const classified = this.classify(exception);
    this.logError(exception, classified, request);

    // Build response body
    const body = this.buildResponseBody(classified, request, exception);
    response.status(body.status_code).json(body);
  }

  // Classify
  private classify(exception: unknown): {
    status_code: number;
    code: ErrorCode;
    message: string;
    action?: string;
    errors?: FieldError[];
    detail?: string;
  } {
    if (exception instanceof AppException) {
      return {
        status_code: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        action: exception.action,
        errors: exception.errors,
        detail: exception.detail,
      };
    }

    // JWT: access token expired
    if (exception instanceof TokenExpiredError) {
      const ex = new AccessTokenExpiredException();
      return {
        status_code: ex.getStatus(),
        code: ex.code,
        message: ex.message,
        action: ex.action,
      };
    }

    // JWT: access token invalid
    if (exception instanceof JsonWebTokenError) {
      const ex = new AccessTokenInvalidException();
      return {
        status_code: ex.getStatus(),
        code: ex.code,
        message: ex.message,
        action: ex.action,
      };
    }

    // Validation pipe error
    if (exception instanceof HttpException && exception.getStatus() === 400) {
      const response = exception.getResponse() as any;

      if (Array.isArray(response?.message)) {
        return {
          status_code: 422,
          code: ErrorCode.VALIDATION_ERROR,
          message: 'The data you submitted is invalid.',
          errors: this.parseValidationErrors(response.message),
        };
      }
    }

    // Generic errors(not-found, conflict, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as any;

      return {
        status_code: status,
        code: this.httpStatusToCode(status),
        message:
          typeof response === 'string'
            ? response
            : (response.message ?? exception.message),
        action: response.action,
      };
    }

    // Rate limit exceeded
    if (exception instanceof ThrottlerException) {
      return {
        status_code: HttpStatus.TOO_MANY_REQUESTS,
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please slow down your requests.',
        action: 'Try again in a few seconds.',
      };
    }

    // Prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.classifyPrismaError(exception);
    }

    // Prisma validation errors
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status_code: HttpStatus.BAD_REQUEST,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'The data you submitted is invalid.',
        detail: this.isDev ? exception.message : undefined,
      };
    }

    // Catch all unknown errors
    return {
      status_code: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      detail: this.isDev
        ? exception instanceof Error
          ? exception.message
          : ''
        : undefined,
    };
  }

  // Prisma Error Classifier
  private classifyPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status_code: number;
    code: ErrorCode;
    message: string;
    action?: string;
    detail?: string;
  } {
    switch (error.code) {
      // Unique constraint violation
      case 'P2002': {
        const field = (error.meta?.target as string[])?.join(', ') ?? 'field';
        return {
          status_code: HttpStatus.CONFLICT,
          code: ErrorCode.RESOURCE_ALREADY_EXISTS,
          message: `The record with this ${field} already exists.`,
          action: 'Please use a different value.',
          detail: this.isDev ? `Prisma P2002 on ${field}` : undefined,
        };
      }

      // Record not found
      case 'P2025':
        return {
          status_code: HttpStatus.NOT_FOUND,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'The requested record was not found.',
          detail: this.isDev ? `Prisma P2025: ${error.meta?.cause}` : undefined,
        };

      // Foreign key constraint violation
      case 'P2003':
        const relatedField = (error.meta?.field_name as string) ?? 'field';
        return {
          status_code: HttpStatus.BAD_REQUEST,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message:
            'A related record required for this operation was not found.',
          detail: this.isDev
            ? `Prisma P2003: foreign key failed on ${relatedField}`
            : undefined,
        };

      // Record required for this operation was not found
      case 'P2001':
        return {
          status_code: HttpStatus.NOT_FOUND,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'The record you are trying to modify does not exist.',
          detail: this.isDev ? `Prisma P2001` : undefined,
        };

      // Default case
      default:
        return {
          status_code: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.DATABASE_ERROR,
          message: 'A database error occurred.',
          detail: this.isDev
            ? `Prisma ${error.code}: ${error.message}`
            : undefined,
        };
    }
  }

  // Build response body
  private buildResponseBody(
    classified: ReturnType<typeof this.classify>,
    request: Request,
    exception: unknown,
  ): ErrorResponse {
    const base: ErrorResponse = {
      success: false,
      status_code: classified.status_code,
      code: classified.code,
      message:
        typeof classified.message === 'string'
          ? classified.message
          : 'An error occurred.',
      action: classified.action,
      errors: classified.errors,
      detail: classified.detail,
      path: request.url,
    };

    if (classified.action) base.action = classified.action;
    if (classified.errors) base.errors = classified.errors;

    if (this.isDev) {
      if (classified.detail) base.detail = classified.detail;

      if (exception instanceof Error && exception.stack) {
        base.stack = exception.stack;
      }
    }

    return base;
  }

  // Logging
  private logError(
    exception: unknown,
    classified: ReturnType<typeof this.classify>,
    request: Request,
  ): void {
    const context = {
      method: request.method,
      url: request.url,
      status_code: classified.status_code,
      code: classified.code,
      tenant_id: (request as any).tenantId ?? 'unknown',
      user_id: (request as any).user?.id ?? 'unauthenticated',
      ip: request.ip,
    };

    if (classified.status_code >= 500) {
      // Server errors — always log full stack
      this.logger.error(
        ` ${request.method} ${request.url} → ${classified.status_code} ${classified.code}`,
        exception instanceof Error ? exception.stack : String(exception),
        'ExceptionFilter',
      );
    } else if (classified.status_code >= 400) {
      // Client errors — log at warn level with context only (no stack spam)
      this.logger.warn(
        ` ${request.method} ${request.url} → ${classified.status_code} ${classified.code}: ${classified.message}`,
      );
    }
  }

  // Helpers
  // Converts class-validation error message to field-level errors
  private parseValidationErrors(messages: string[]): FieldError[] {
    return messages.map((msg) => {
      // class-validator messages are formatted as "field must be..."
      // Extract the field name from the beginning of the message
      const parts = msg.split(' ');
      return {
        field: parts[0] ?? 'unknown',
        message: msg,
      };
    });
  }

  // Maps HTTP status codes to our error code enum for generic HttpExceptions
  private httpStatusToCode(status: number): ErrorCode {
    const map: Record<number, ErrorCode> = {
      400: ErrorCode.INVALID_INPUT,
      401: ErrorCode.ACCESS_TOKEN_INVALID,
      403: ErrorCode.INSUFFICIENT_PERMISSIONS,
      404: ErrorCode.RESOURCE_NOT_FOUND,
      409: ErrorCode.RESOURCE_CONFLICT,
      422: ErrorCode.VALIDATION_ERROR,
      429: ErrorCode.RATE_LIMIT_EXCEEDED,
      500: ErrorCode.INTERNAL_ERROR,
      503: ErrorCode.SERVICE_UNAVAILABLE,
    };
    return map[status] ?? ErrorCode.INTERNAL_ERROR;
  }
}
