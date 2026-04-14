-- Make StudentProfile.class_id nullable so students can be "unassigned" from a class
ALTER TABLE "student_profiles"
ALTER COLUMN "class_id" DROP NOT NULL;