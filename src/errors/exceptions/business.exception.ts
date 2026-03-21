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

// TIMETABLE EXCEPTIONS
export class TimetableSlotNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.TIMETABLE_SLOT_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Timetable slot not found.',
    });
  }
}

export class TeacherScheduleConflictException extends AppException {
  constructor(day: string, startTime: string, endTime: string) {
    super({
      code: ErrorCode.TEACHER_SCHEDULE_CONFLICT,
      statusCode: HttpStatus.CONFLICT,
      message: `This teacher already has a class on ${day} between ${startTime} and ${endTime}.`,
      action: 'Choose a different time slot or assign a different teacher.',
    });
  }
}

export class ClassScheduleConflictException extends AppException {
  constructor(day: string, startTime: string, endTime: string) {
    super({
      code: ErrorCode.CLASS_SCHEDULE_CONFLICT,
      statusCode: HttpStatus.CONFLICT,
      message: `This class already has a subject scheduled on ${day} between ${startTime} and ${endTime}.`,
      action: 'Choose a different time slot.',
    });
  }
}

export class InvalidTimeRangeException extends AppException {
  constructor() {
    super({
      code: ErrorCode.INVALID_TIME_RANGE,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Start time must be before end time.',
    });
  }
}

export class SlotNotInSchoolHoursException extends AppException {
  constructor(open: string, close: string) {
    super({
      code: ErrorCode.SLOT_NOT_IN_SCHOOL_HOURS,
      statusCode: HttpStatus.BAD_REQUEST,
      message: `Slot must fall within school hours (${open} — ${close}).`,
      action: 'Adjust the slot time to fit within school operating hours.',
    });
  }
}

export class TutorialClassNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.TUTORIAL_CLASS_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Tutorial class not found.',
    });
  }
}

export class TutorialTimeConflictException extends AppException {
  constructor() {
    super({
      code: ErrorCode.TUTORIAL_TIME_CONFLICT,
      statusCode: HttpStatus.CONFLICT,
      message: 'You already have a session scheduled during this time.',
      action: 'Choose a different time for this tutorial class.',
    });
  }
}

export class ClassNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.CLASS_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Class not found.',
    });
  }
}

export class SubjectNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SUBJECT_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Subject not found.',
    });
  }
}

// ══════════════════════════════════════════════════════════
// LECTURE EXCEPTIONS
// ══════════════════════════════════════════════════════════

export class LectureNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.LECTURE_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Lecture not found.',
    });
  }
}

export class LectureNotPublishedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.LECTURE_NOT_PUBLISHED,
      statusCode: HttpStatus.FORBIDDEN,
      message: 'This lecture has not been published yet.',
    });
  }
}

export class LectureAlreadyPublishedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.LECTURE_ALREADY_PUBLISHED,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'This lecture is already published.',
      action: 'Archive it first if you want to unpublish.',
    });
  }
}

export class FileNotFoundInStorageException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FILE_NOT_FOUND_IN_STORAGE,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'The uploaded file could not be verified in storage.',
      action: 'Re-upload the file and try again.',
    });
  }
}

export class LectureAccessDeniedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.LECTURE_ACCESS_DENIED,
      statusCode: HttpStatus.FORBIDDEN,
      message: 'You do not have access to this lecture.',
      action: 'Ensure you are registered for this subject.',
    });
  }
}

export class TeacherProfileNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.TEACHER_PROFILE_NOT_FOUND,
      statusCode: HttpStatus.FORBIDDEN,
      message:
        'No teacher profile exists for this account in the current school.',
      action:
        'Only staff with a teacher profile can manage lectures. Contact your administrator.',
    });
  }
}

// REPOSITORY EXCEPTIONS
export class RepositoryAccessDeniedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.REPOSITORY_ACCESS_DENIED,
      statusCode: HttpStatus.FORBIDDEN,
      message: 'You do not have permission to access this repository section.',
      action: 'Contact your administrator if you believe this is an error.',
    });
  }
}

export class FolderNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FOLDER_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Folder not found.',
    });
  }
}

export class FolderNotEmptyException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FOLDER_NOT_EMPTY,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Cannot delete a folder that still contains files.',
      action: 'Move or delete all files inside the folder first.',
    });
  }
}

export class FolderMaxDepthException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FOLDER_MAX_DEPTH_REACHED,
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Folders can only be nested up to 3 levels deep.',
    });
  }
}

export class FolderAlreadyExistsException extends AppException {
  constructor(name: string) {
    super({
      code: ErrorCode.FOLDER_ALREADY_EXISTS,
      statusCode: HttpStatus.CONFLICT,
      message: `A folder named '${name}' already exists here.`,
    });
  }
}

export class RepositoryFileNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FILE_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'File not found.',
    });
  }
}

export class FileUnderRetentionException extends AppException {
  constructor(retentionUntil: Date) {
    super({
      code: ErrorCode.FILE_UNDER_RETENTION,
      statusCode: HttpStatus.FORBIDDEN,
      message: `This file cannot be deleted until ${retentionUntil.toDateString()} due to retention policy.`,
      action: 'Only a Super Admin can override the retention policy.',
    });
  }
}

export class FileArchivedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FILE_ARCHIVED,
      statusCode: HttpStatus.GONE,
      message: 'This file has been archived and is no longer accessible.',
      action: 'Contact your administrator to restore the file.',
    });
  }
}

export class FileVersionNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.FILE_VERSION_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'File version not found.',
    });
  }
}

export class ShareLinkNotFoundException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SHARE_LINK_NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Share link not found or has been revoked.',
    });
  }
}

export class ShareLinkExpiredException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SHARE_LINK_EXPIRED,
      statusCode: HttpStatus.GONE,
      message: 'This share link has expired.',
      action: 'Request a new share link from the file owner.',
    });
  }
}

export class ShareLinkMaxAccessException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SHARE_LINK_MAX_ACCESS_REACHED,
      statusCode: HttpStatus.FORBIDDEN,
      message: 'This share link has reached its maximum number of uses.',
      action: 'Request a new share link from the file owner.',
    });
  }
}

export class ShareLinkNotAllowedException extends AppException {
  constructor() {
    super({
      code: ErrorCode.SHARE_LINK_NOT_ALLOWED,
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Share links cannot be generated for this type of document.',
      action:
        'Sensitive records must always be accessed through authenticated sessions.',
    });
  }
}

export class StorageQuotaExceededException extends AppException {
  constructor(quotaGB: number) {
    super({
      code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
      statusCode: HttpStatus.FORBIDDEN,
      message: `Your school has reached its ${quotaGB}GB storage limit.`,
      action: 'Upgrade your plan or delete unused files to free up space.',
    });
  }
}
