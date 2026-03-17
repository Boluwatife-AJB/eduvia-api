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

// School Setup Exception
export class SubjectCodeTakenException extends AppException {
  constructor(code: string) {
    super({
      code: ErrorCode.SUBJECT_CODE_TAKEN,
      statusCode: HttpStatus.CONFLICT,
      message: `A subject with code '${code}' already exists in this department.`,
      action: 'Use a unique subject code within the department.',
    });
  }
}

// Teacher Wrong Department Exception
export class TeacherWrongDepartmentException extends AppException {
  constructor() {
    super({
      code: ErrorCode.TEACHER_WRONG_DEPARTMENT,
      statusCode: HttpStatus.BAD_REQUEST,
      message:
        'This teacher does not belong to the department this subject is assigned to.',
      action: 'Only assign teachers from the same department as the subject.',
    });
  }
}

// Subject Already Assigned Exception
export class SubjectAlreadyAssignedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SUBJECT_ALREADY_ASSIGNED,
      statusCode: HttpStatus.CONFLICT,
      message: 'This subject is already assigned to this class.',
    });
  }
}

// Subject Not Assigned Exception
export class SubjectNotAssignedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SUBJECT_NOT_ASSIGNED,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'This subject is not assigned to this class.',
    });
  }
}

// Active Term Required Exception
export class ActiveTermRequiredException extends AppException {
  constructor() {
    super({
      code: ErrorCode.ACTIVE_TERM_REQUIRED,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'No active term found.',
    });
  }
}

// Form Teacher Cannot Teach Own Class Exception
// export class FormTeacherCannotTeachOwnClassException extends AppException {
//   constructor() {
//     super({
//       code: ErrorCode.FORM_TEACHER_CANNOT_TEACH_OWN_CLASS,
//       statusCode: HttpStatus.BAD_REQUEST,
//       message:
//         'A form teacher cannot be assigned to teach a subject in their own class.',
//       action:
//         'Assign a different teacher or assign this teacher to a subject in another class.',
//     });
//   }
// }

export class TeacherAlreadyAssignedToSubjectException extends AppException {
  constructor() {
    super({
      code: ErrorCode.TEACHER_ALREADY_ASSIGNED_TO_SUBJECT,
      statusCode: HttpStatus.CONFLICT,
      message:
        'This teacher is already assigned to this subject in this class.',
    });
  }
}

export class CompulsorySubjectCannotDeregisterException extends AppException {
  constructor() {
    super({
      code: ErrorCode.COMPULSORY_SUBJECT_CANNOT_DEREGISTER,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Compulsory subjects cannot be deselected.',
      action: 'Only elective subjects can be removed from your registration.',
    });
  }
}

export class SubjectRegistrationNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SUBJECT_REGISTRATION_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Subject registration not found.',
    });
  }
}

export class StudentNotInClassException extends AppException {
  constructor() {
    super({
      code: ErrorCode.STUDENT_NOT_IN_CLASS,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Student is not assigned to any class.',
      action: 'Assign the student to a class before registering subjects.',
    });
  }
}

export class StudentAlreadyInClassException extends AppException {
  constructor(className: string) {
    super({
      code: ErrorCode.STUDENT_ALREADY_IN_CLASS,
      statusCode: HttpStatus.CONFLICT,
      message: `Student is already assigned to class '${className}'.`,
      action:
        'Remove the student from their current class first, or use the transfer endpoint.',
    });
  }
}
