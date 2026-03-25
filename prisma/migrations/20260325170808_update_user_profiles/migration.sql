-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'MALE';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'MALE';

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'MALE';
