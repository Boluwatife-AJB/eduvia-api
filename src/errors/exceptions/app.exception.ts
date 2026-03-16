import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../types/error-codes.enum';
import { FieldError } from '../types/error-response.interface';

interface AppExceptionOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  action?: string; // tells client what to do next
  errors?: FieldError[]; // field-level detail for validation errors
  detail?: string; // internal detail — only shown in development
  cause?: unknown; // original error for logging
}

export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly action?: string;
  public readonly errors?: FieldError[];
  public readonly detail?: string;
  public override readonly cause: unknown;

  constructor(options: AppExceptionOptions) {
    super(options.message, options.statusCode ?? HttpStatus.BAD_REQUEST);
    this.code = options.code;
    this.action = options.action;
    this.errors = options.errors;
    this.detail = options.detail;
    this.cause = options.cause;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
