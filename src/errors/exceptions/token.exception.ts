import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../types/error-codes.enum';
import { AppException } from './app.exception';

// Access token expired exception
export class AccessTokenExpiredException extends AppException {
  constructor() {
    super({
      code: ErrorCode.ACCESS_TOKEN_EXPIRED,
      message: 'Access token expired',
      statusCode: HttpStatus.UNAUTHORIZED,
      action:
        'Call POST /api/v1/auth/refresh with your refresh token to continue.',
    });
  }
}

// Access token invalid exception
export class AccessTokenInvalidException extends AppException {
  constructor() {
    super({
      code: ErrorCode.ACCESS_TOKEN_INVALID,
      message: 'Your access token invalid',
      statusCode: HttpStatus.UNAUTHORIZED,
      action: 'Please log in again.',
    });
  }
}

// Refresh token expired exception
export class RefreshTokenExpiredException extends AppException {
  constructor() {
    super({
      code: ErrorCode.REFRESH_TOKEN_EXPIRED,
      message: 'This session has expired, please log in again.',
      statusCode: HttpStatus.UNAUTHORIZED,
      action: 'Please log in again.',
    });
  }
}

// Refresh token invalid exception
export class RefreshTokenInvalidException extends AppException {
  constructor() {
    super({
      code: ErrorCode.REFRESH_TOKEN_INVALID,
      message: 'This session is no longer valid.',
      statusCode: HttpStatus.UNAUTHORIZED,
      action: 'Please log in again.',
    });
  }
}

// Session revoked exception
export class SessionRevokedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SESSION_REVOKED,
      message: 'This session has been revoked.',
      statusCode: HttpStatus.UNAUTHORIZED,
      action: 'Please log in again.',
    });
  }
}

// Insufficient permissions exception
export class InsufficientPermissionsException extends AppException {
  constructor(requiredRole?: string) {
    super({
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: requiredRole
        ? `This action requires the '${requiredRole}' role.`
        : 'You do not have permission to perform this action.',
      statusCode: HttpStatus.FORBIDDEN,
      action:
        'Please contact your school administrator if you believe this is an error.',
    });
  }
}
