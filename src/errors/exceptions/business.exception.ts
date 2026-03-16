import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../types/error-codes.enum';
import { AppException } from './app.exception';

// Auth Exception
// Invalid Credentials Exception
export class InvalidCredentialsException extends AppException {
  constructor() {
    super({
      code: ErrorCode.INVALID_CREDENTIALS,
      message: 'The provided credentials are invalid.',
      statusCode: HttpStatus.UNAUTHORIZED,
      action: 'Please check your username and password and try again.',
    });
  }
}

// Account Suspended Exception
export class AccountSuspendedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.ACCOUNT_SUSPENDED,
      message: 'Your account has been suspended.',
      statusCode: HttpStatus.UNAUTHORIZED,
      action:
        'Please contact your school administrator to reactivate your account.',
    });
  }
}

// Account Pending Exception
export class AccountPendingException extends AppException {
  constructor() {
    super({
      code: ErrorCode.ACCOUNT_PENDING,
      message: 'Your account is pending approval.',
      statusCode: HttpStatus.FORBIDDEN,
      action:
        'Please contact your school administrator to approve your account.',
    });
  }
}

// Account Inactive Exception
export class AccountInactiveException extends AppException {
  constructor() {
    super({
      code: ErrorCode.ACCOUNT_INACTIVE,
      message: 'Your account is inactive.',
      statusCode: HttpStatus.FORBIDDEN,
      action:
        'Please contact your school administrator to reactivate your account.',
    });
  }
}

// User Exception
export class UserNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.USER_NOT_FOUND,
      message: 'The user with the given ID was not found.',
      statusCode: HttpStatus.NOT_FOUND,
      action: 'Please check the user ID and try again.',
    });
  }
}

// Identifier Taken Exception
export class IdentifierTakenException extends AppException {
  constructor(identifier: string) {
    super({
      code: ErrorCode.IDENTIFIER_TAKEN,
      message: `The ID ${identifier} is already in use in this school.`,
      statusCode: HttpStatus.CONFLICT,
      action: 'Please choose a different identifier.',
    });
  }
}

// Email Taken Exception
export class EmailTakenException extends AppException {
  constructor(email: string) {
    super({
      code: ErrorCode.EMAIL_TAKEN,
      message: `The email ${email} is already in use in this school.`,
      statusCode: HttpStatus.CONFLICT,
      action: 'Please choose a different email.',
    });
  }
}

// Incorrect Password Exception
export class IncorrectPasswordException extends AppException {
  constructor() {
    super({
      code: ErrorCode.INCORRECT_PASSWORD,
      statusCode: HttpStatus.BAD_REQUEST,
      action: 'Please check your current password and try again.',
      message: 'Your current password is incorrect.',
    });
  }
}

// Password same as old exception
export class PasswordSameAsOldException extends AppException {
  constructor() {
    super({
      code: ErrorCode.PASSWORD_SAME_AS_OLD,
      message: 'The new password cannot be the same as the old password.',
      statusCode: HttpStatus.BAD_REQUEST,
      action: 'Please choose a different password.',
    });
  }
}

// Cannot modify self exception
export class CannotModifySelfException extends AppException {
  constructor(action: string) {
    super({
      code: ErrorCode.USER_CANNOT_MODIFY_SELF,
      statusCode: HttpStatus.FORBIDDEN,
      message: `You cannot ${action} your own account.`,
    });
  }
}

// TODO: School Setup Exception
