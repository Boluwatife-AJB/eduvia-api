import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { RepositoryAccessDeniedException } from 'src/errors/exceptions/business.exception';
import { RepositoryScope, UserRole } from 'src/generated/prisma/enums';

export type RepositoryAction =
  | 'VIEW'
  | 'UPLOAD'
  | 'DELETE'
  | 'CREATE_FOLDER'
  | 'ARCHIVE'
  | 'RENAME_FOLDER';

interface AccessContext {
  userId: string;
  userRole: UserRole;
  tenantId: string;
  scope: RepositoryScope;
  scopeId?: string; // classId / subjectId / deptId
  action: RepositoryAction;
  targetUserId?: string; // for self-only scopes like STAFF_SALARY
}

@Injectable()
export class RepositoryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Main entry point — throws RepositoryAccessDeniedException if denied
  async assertAccess(ctx: AccessContext): Promise<void> {
    const allowed = await this.canAccess(ctx);
    if (!allowed) throw new RepositoryAccessDeniedException();
  }

  // Returns true/false without throwing — used for filtering lists
  async canAccess(ctx: AccessContext): Promise<boolean> {
    const { userRole, scope } = ctx;

    // Super Admin can do anything
    if (userRole === UserRole.SUPER_ADMIN) return true;

    // Route to the correct scope checker
    switch (scope) {
      case RepositoryScope.CLASS_DOCUMENTS:
        return this.checkClassDocuments(ctx);

      case RepositoryScope.SUBJECT_DOCUMENTS:
        return this.checkSubjectDocuments(ctx);

      case RepositoryScope.PAST_QUESTIONS:
        return this.checkPastQuestions(ctx);

      case RepositoryScope.DEPARTMENT_DOCUMENTS:
        return this.checkDepartmentDocuments(ctx);

      case RepositoryScope.SCHOOL_DOCUMENTS:
        return this.checkSchoolDocuments(ctx);

      case RepositoryScope.STAFF_RECORDS:
        return this.checkStaffRecords(ctx);

      case RepositoryScope.TUITION_PAYMENTS:
        return this.checkTuitionPayments(ctx);

      case RepositoryScope.STAFF_SALARY:
        return this.checkStaffSalary(ctx);

      case RepositoryScope.SCHOOL_EXPENSES:
        return this.checkSchoolExpenses(ctx);

      case RepositoryScope.HEALTH_RECORDS:
        return this.checkHealthRecords(ctx);

      case RepositoryScope.COUNSELING_RECORDS:
        return this.checkCounselingRecords(ctx);

      case RepositoryScope.DISCIPLINARY_RECORDS:
        return this.checkDisciplinaryRecords(ctx);

      case RepositoryScope.LIBRARY_RECORDS:
        return this.checkLibraryRecords(ctx);

      case RepositoryScope.LABORATORY_RECORDS:
        return this.checkLaboratoryRecords(ctx);

      case RepositoryScope.INVENTORY_RECORDS:
        return this.checkInventoryRecords(ctx);

      case RepositoryScope.MAINTENANCE_RECORDS:
        return this.checkMaintenanceRecords(ctx);

      case RepositoryScope.VISITOR_LOGS:
        return this.checkVisitorLogs(ctx);

      case RepositoryScope.PTA_MEETINGS:
        return this.checkPtaMeetings(ctx);

      case RepositoryScope.STAFF_MEETINGS:
        return this.checkStaffMeetings(ctx);

      case RepositoryScope.SCHOOL_EVENTS:
        return this.checkSchoolEvents(ctx);

      case RepositoryScope.EXTRACURRICULAR:
        return this.checkExtracurricular(ctx);

      case RepositoryScope.SPORT_RECORDS:
        return this.checkSportRecords(ctx);

      default:
        return false;
    }
  }

  // SCOPE CHECKERS
  private async checkClassDocuments(ctx: AccessContext): Promise<boolean> {
    const { userId, userRole, tenantId, scopeId: classId, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    if (action === 'VIEW') {
      if (isAdmin) return true;

      // Student in this class
      if (userRole === UserRole.STUDENT) {
        return this.isStudentInClass(userId, classId!, tenantId);
      }

      // Teacher of this class (teaches any subject in it)
      if (userRole === UserRole.TEACHER) {
        return this.isTeacherInClass(userId, classId!, tenantId);
      }

      // Parent whose ward is in this class
      if (userRole === UserRole.PARENT) {
        return this.isParentOfStudentInClass(userId, classId!, tenantId);
      }

      return false;
    }

    if (action === 'UPLOAD' || action === 'CREATE_FOLDER') {
      if (isAdmin) return true;
      if (userRole === UserRole.TEACHER) {
        return this.isTeacherInClass(userId, classId!, tenantId);
      }
      return false;
    }

    if (action === 'DELETE') {
      return isAdmin;
    }

    return false;
  }

  private async checkSubjectDocuments(ctx: AccessContext): Promise<boolean> {
    const { userId, userRole, tenantId, scopeId: subjectId, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    if (action === 'VIEW') {
      if (isAdmin) return true;

      if (userRole === UserRole.STUDENT) {
        return this.isStudentRegisteredForSubject(userId, subjectId!, tenantId);
      }

      if (userRole === UserRole.TEACHER) {
        return this.isTeacherOfSubject(userId, subjectId!, tenantId);
      }

      return false;
    }

    if (action === 'UPLOAD' || action === 'CREATE_FOLDER') {
      if (isAdmin) return true;
      if (userRole === UserRole.TEACHER) {
        return this.isTeacherOfSubject(userId, subjectId!, tenantId);
      }
      return false;
    }

    if (action === 'DELETE') {
      return isAdmin;
    }

    return false;
  }

  private checkPastQuestions(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    // Everyone in the school can view past questions
    if (action === 'VIEW') return true;

    if (action === 'UPLOAD' || action === 'CREATE_FOLDER') {
      return isAdmin || userRole === UserRole.TEACHER;
    }

    if (action === 'DELETE') return isAdmin;

    return false;
  }

  private async checkDepartmentDocuments(ctx: AccessContext): Promise<boolean> {
    const { userId, userRole, tenantId, scopeId: departmentId, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    if (action === 'VIEW') {
      if (isAdmin) return true;
      if (userRole === UserRole.TEACHER) {
        return this.isTeacherInDepartment(userId, departmentId!, tenantId);
      }
      // Non-teaching staff in this department
      return this.isStaffInDepartment(userId, departmentId!, tenantId);
    }

    if (action === 'UPLOAD' || action === 'CREATE_FOLDER') {
      if (isAdmin) return true;
      if (userRole === UserRole.TEACHER) {
        return this.isTeacherInDepartment(userId, departmentId!, tenantId);
      }
      return false;
    }

    if (action === 'DELETE') {
      return isAdmin || (await this.isHOD(userId, departmentId!, tenantId));
    }

    return false;
  }

  private checkSchoolDocuments(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    // Everyone can view school documents
    if (action === 'VIEW') return true;

    // Only admin can upload, create folders or delete
    return isAdmin;
  }

  private checkStaffRecords(ctx: AccessContext): boolean {
    const { userId, userRole, targetUserId, action } = ctx;
    const isHR = this.isHR(userRole);
    const isAdmin = this.isAdmin(userRole);

    if (action === 'VIEW') {
      // HR and admin see all staff records
      if (isHR || isAdmin) return true;
      // Staff can only see their own records
      return userId === targetUserId;
    }

    // Only super admin can delete — handled at a higher level
    return false;
  }

  private async checkTuitionPayments(ctx: AccessContext): Promise<boolean> {
    const { userId, userRole, tenantId, targetUserId, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isBursar = userRole === UserRole.BURSAR;

    if (action === 'VIEW') {
      if (isAdmin || isBursar) return true;

      // Student views their own payment records
      if (userRole === UserRole.STUDENT) {
        return userId === targetUserId;
      }

      // Parent views their ward's payment records
      if (userRole === UserRole.PARENT) {
        return this.isParentOfStudent(userId, targetUserId!, tenantId);
      }

      return false;
    }

    if (action === 'UPLOAD') return isAdmin || isBursar;

    // Super admin only for delete
    return false;
  }

  private checkStaffSalary(ctx: AccessContext): boolean {
    const { userId, userRole, targetUserId, action } = ctx;
    const isHR = this.isHR(userRole);
    const isAdmin = this.isAdmin(userRole);
    const isBursar = userRole === UserRole.BURSAR;

    if (action === 'VIEW') {
      if (isHR || isAdmin || isBursar) return true;
      // Staff sees only their own payslip
      return userId === targetUserId;
    }

    if (action === 'UPLOAD') return isHR || isAdmin || isBursar;

    return false;
  }

  private checkSchoolExpenses(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isBursar = userRole === UserRole.BURSAR;

    if (action === 'VIEW') return isAdmin || isBursar;
    if (action === 'UPLOAD') return isAdmin || isBursar;
    return false;
  }

  private async checkHealthRecords(ctx: AccessContext): Promise<boolean> {
    const { userId, userRole, tenantId, targetUserId, action } = ctx;
    const isMedical = userRole === UserRole.NURSE;
    const isPrincipal = userRole === UserRole.PRINCIPAL;

    if (action === 'VIEW') {
      if (isMedical || isPrincipal) return true;

      // Student sees their own health record
      if (userRole === UserRole.STUDENT) {
        return userId === targetUserId;
      }

      // Parent sees their ward's health record
      if (userRole === UserRole.PARENT) {
        return this.isParentOfStudent(userId, targetUserId!, tenantId);
      }

      return false;
    }

    // Only medical staff can upload health records
    if (action === 'UPLOAD') return isMedical;

    // Super admin only for delete
    return false;
  }

  private checkCounselingRecords(ctx: AccessContext): boolean {
    const { userId, userRole, targetUserId, action } = ctx;
    const isCounselor = userRole === UserRole.COUNSELOR;
    const isPrincipal = userRole === UserRole.PRINCIPAL;

    if (action === 'VIEW') {
      if (isCounselor || isPrincipal) return true;
      // Student sees their own counseling records
      return userRole === UserRole.STUDENT && userId === targetUserId;
    }

    // Only counselor can upload
    if (action === 'UPLOAD') return isCounselor;

    return false;
  }

  private async checkDisciplinaryRecords(ctx: AccessContext): Promise<boolean> {
    const { userId, userRole, tenantId, targetUserId, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    if (action === 'VIEW') {
      if (isAdmin) return true;
      if (userRole === UserRole.TEACHER) return true; // teachers who flagged can see
      if (userRole === UserRole.STUDENT) return userId === targetUserId;
      if (userRole === UserRole.PARENT) {
        return this.isParentOfStudent(userId, targetUserId!, tenantId);
      }
      return false;
    }

    if (action === 'UPLOAD') return isAdmin || userRole === UserRole.TEACHER;
    if (action === 'DELETE') return isAdmin;

    return false;
  }

  private checkLibraryRecords(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isLibrarian = userRole === UserRole.LIBRARIAN;

    if (action === 'VIEW') return isAdmin || isLibrarian;
    if (action === 'UPLOAD') return isAdmin || isLibrarian;
    if (action === 'DELETE') return isAdmin || isLibrarian;
    return false;
  }

  private checkLaboratoryRecords(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isLabAttendant = userRole === UserRole.LAB_ATTENDANT;
    const isHOD = userRole === UserRole.HOD;

    if (action === 'VIEW') return isAdmin || isLabAttendant || isHOD;
    if (action === 'UPLOAD') return isAdmin || isLabAttendant;
    if (action === 'DELETE') return isAdmin || isLabAttendant;
    return false;
  }

  private checkInventoryRecords(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isBursar = userRole === UserRole.BURSAR;
    const isSupport = userRole === UserRole.SUPPORT_STAFF;

    if (action === 'VIEW') return isAdmin || isBursar;
    if (action === 'UPLOAD') return isAdmin || isBursar || isSupport;
    if (action === 'DELETE') return isAdmin || isBursar;
    return false;
  }

  private checkMaintenanceRecords(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isSupport = userRole === UserRole.SUPPORT_STAFF;

    if (action === 'VIEW') return isAdmin || isSupport;
    if (action === 'UPLOAD') return isAdmin || isSupport;
    if (action === 'DELETE') return isAdmin;
    return false;
  }

  private checkVisitorLogs(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isSecurity = userRole === UserRole.SECURITY_OFFICER;

    if (action === 'VIEW') return isAdmin || isSecurity;
    if (action === 'UPLOAD') return isAdmin || isSecurity;
    if (action === 'DELETE') return isAdmin;
    return false;
  }

  private checkPtaMeetings(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    // Parents, teachers and admin can view PTA records
    if (action === 'VIEW') {
      return (
        isAdmin || userRole === UserRole.PARENT || userRole === UserRole.TEACHER
      );
    }

    // Only admin can upload and delete
    return isAdmin;
  }

  private checkStaffMeetings(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);
    const isStaff = this.isAnyStaff(userRole);

    if (action === 'VIEW') return isAdmin || isStaff;
    return isAdmin;
  }

  private checkSchoolEvents(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    // Everyone can view school events
    if (action === 'VIEW') return true;
    if (action === 'UPLOAD') return isAdmin || userRole === UserRole.TEACHER;
    return isAdmin;
  }

  private checkExtracurricular(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    if (action === 'VIEW') {
      return (
        isAdmin ||
        userRole === UserRole.STUDENT ||
        userRole === UserRole.TEACHER
      );
    }

    if (action === 'UPLOAD') return isAdmin || userRole === UserRole.TEACHER;
    if (action === 'DELETE') return isAdmin || userRole === UserRole.TEACHER;
    return false;
  }

  private checkSportRecords(ctx: AccessContext): boolean {
    const { userRole, action } = ctx;
    const isAdmin = this.isAdmin(userRole);

    // Everyone can view sport records
    if (action === 'VIEW') return true;
    if (action === 'UPLOAD') return isAdmin || userRole === UserRole.TEACHER;
    if (action === 'DELETE') return isAdmin;
    return false;
  }

  // ROLE HELPERS

  private isAdmin(role: UserRole): boolean {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.SCHOOL_OWNER,
      UserRole.PRINCIPAL,
      UserRole.HEAD_TEACHER,
      UserRole.ASST_HEAD_TEACHER,
    ].includes(role as any);
  }

  private isHR(role: UserRole): boolean {
    return [UserRole.SCHOOL_OWNER, UserRole.PRINCIPAL].includes(role as any);
  }

  private isAnyStaff(role: UserRole): boolean {
    return [
      UserRole.TEACHER,
      UserRole.COUNSELOR,
      UserRole.LAB_ATTENDANT,
      UserRole.NURSE,
      UserRole.LIBRARIAN,
      UserRole.BURSAR,
      UserRole.SECURITY_OFFICER,
      UserRole.SUPPORT_STAFF,
      UserRole.HOD,
      UserRole.HEAD_TEACHER,
      UserRole.ASST_HEAD_TEACHER,
    ].includes(role as any);
  }

  // DATABASE LOOKUP HELPERS

  private async isStudentInClass(
    userId: string,
    classId: string,
    tenantId: string,
  ): Promise<boolean> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user_id: userId, class_id: classId, tenant_id: tenantId },
    });
    return !!profile;
  }

  private async isTeacherInClass(
    userId: string,
    classId: string,
    tenantId: string,
  ): Promise<boolean> {
    // Teacher is in the class if they teach any subject in it
    // OR if they are the form teacher
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenant_id: tenantId, class_teacher_id: userId },
    });
    if (cls) return true;

    const assignment = await this.prisma.subjectTeacher.findFirst({
      where: {
        teacher_id: userId,
        class_subject: { class_id: classId },
      },
    });
    return !!assignment;
  }

  private async isParentOfStudentInClass(
    parentUserId: string,
    classId: string,
    tenantId: string,
  ): Promise<boolean> {
    const parent = await this.prisma.guardianProfile.findFirst({
      where: { user_id: parentUserId, tenant_id: tenantId },
    });
    if (!parent) return false;

    // Check if any of their wards are in this class
    const ward = await this.prisma.studentProfile.findFirst({
      where: {
        user_id: { in: parent.ward_ids },
        class_id: classId,
        tenant_id: tenantId,
      },
    });
    return !!ward;
  }

  private async isParentOfStudent(
    parentUserId: string,
    studentUserId: string,
    tenantId: string,
  ): Promise<boolean> {
    const parent = await this.prisma.guardianProfile.findFirst({
      where: { user_id: parentUserId, tenant_id: tenantId },
    });
    if (!parent) return false;
    return parent.ward_ids.includes(studentUserId);
  }

  private async isStudentRegisteredForSubject(
    userId: string,
    subjectId: string,
    tenantId: string,
  ): Promise<boolean> {
    const student = await this.prisma.studentProfile.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (!student) return false;

    const currentTerm = await this.prisma.academicTerm.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!currentTerm) return false;

    const registration = await this.prisma.studentSubjectRegistration.findFirst(
      {
        where: {
          student_id: student.id,
          term_id: currentTerm.id,
          class_subject: { subject_id: subjectId },
        },
      },
    );
    return !!registration;
  }

  private async isTeacherOfSubject(
    userId: string,
    subjectId: string,
    tenantId: string,
  ): Promise<boolean> {
    const assignment = await this.prisma.subjectTeacher.findFirst({
      where: {
        teacher_id: userId,
        tenant_id: tenantId,
        class_subject: { subject_id: subjectId },
      },
    });
    return !!assignment;
  }

  private async isTeacherInDepartment(
    userId: string,
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        department_id: departmentId,
      },
    });
    return !!profile;
  }

  private async isStaffInDepartment(
    userId: string,
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    const profile = await this.prisma.staffProfile.findFirst({
      where: {
        user_id: userId,
        tenant_id: tenantId,
        course_of_study: departmentId,
      },
    });
    return !!profile;
  }

  private async isHOD(
    userId: string,
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, tenant_id: tenantId, hod_id: userId },
    });
    return !!dept;
  }
}
