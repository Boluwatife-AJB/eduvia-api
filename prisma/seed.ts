import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import * as bcrypt from 'bcryptjs';

const connectionString = `${process.env.DATABASE_URL}`;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const plainPassword = 'Test+1234';
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const verifiedPassword = await bcrypt.compare(plainPassword, passwordHash);
  if (!verifiedPassword) {
    throw new Error('Password hash verification failed');
  }

  // Create a Tenant (School)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'greenfield-academy' },
    update: { initials: 'GFA' },
    create: { 
      name: 'Greenfield Academy',
      slug: 'greenfield-academy',
      initials: 'GFA',
      email: 'info@greenfieldacademy.com',
      phone: '+2348061234567',
      status: 'ACTIVE',
      logo: 'https://example.com/logo.png',
      plan: 'free',
    },
  });

  // console.log(`Tenant: ${tenant.name}`);
  // console.log(`ID: ${tenant.id}`);
  // console.log(`Slug: ${tenant.slug}`);
  // console.log(`Initials: ${tenant.initials ?? '(none)'}\n`);

  // Create a principal - School admin
  await prisma.user.upsert({
    where: {
      tenant_id_identifier: {
        tenant_id: tenant.id,
        identifier: 'PRIN/001',
      },
    },
    update: { password_hash: passwordHash },
    create: {
      tenant_id: tenant.id,
      role: 'PRINCIPAL',
      identifier: 'PRIN/001',
      first_name: 'Tony',
      last_name: 'Stark',
      email: 'tony.stark@greenfieldacademy.com',
      password_hash: passwordHash,
      status: 'ACTIVE',
    },
  });

  // Academic Session
  const academicSession = await prisma.academicSession.upsert({
    where: {
      id: 'academic-session-1',
    },
    update: {},
    create: {
      id: 'academic-session-1',
      tenant_id: tenant.id,
      name: '2026/2027',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2027-07-31'),
      is_current: true,
    },
  });

  // Terms
  await prisma.academicTerm.upsert({
    where: {
      id: 'seed-term-1',
    },
    update: {},
    create: {
      id: 'seed-term-1',
      tenant_id: tenant.id,
      academic_session_id: academicSession.id,
      name: 'First Term',
      start_date: new Date('2026-09-01'),
      end_date: new Date('2026-12-31'),
      is_current: true,
    },
  });

  // Departments
  const sciencesDept = await prisma.department.upsert({
    where: { id: 'seed-dept-sciences' },
    update: {},
    create: {
      id: 'seed-dept-sciences',
      tenant_id: tenant.id,
      name: 'Sciences',
    },
  });

  const artsDept = await prisma.department.upsert({
    where: { id: 'seed-dept-arts' },
    update: {},
    create: {
      id: 'seed-dept-arts',
      tenant_id: tenant.id,
      name: 'Arts',
    },
  });

  // Classes
  const jss1Onyx = await prisma.class.upsert({
    where: { id: 'seed-class-jss1-onyx' },
    update: {},
    create: {
      id: 'seed-class-jss1-onyx',
      tenant_id: tenant.id,
      name: 'JSS 1 Onyx',
      level: 'JSS',
      capacity: 40,
    },
  });

  const jss1Sapphire = await prisma.class.upsert({
    where: { id: 'seed-class-jss1-sapphire' },
    update: {},
    create: {
      id: 'seed-class-jss1-sapphire',
      tenant_id: tenant.id,
      name: 'JSS 1 Sapphire',
      level: 'JSS',
      capacity: 40,
    },
  });

  const jss2Emerald = await prisma.class.upsert({
    where: { id: 'seed-class-jss2-emerald' },
    update: {},
    create: {
      id: 'seed-class-jss2-emerald',
      tenant_id: tenant.id,
      name: 'JSS 2 Emerald',
      level: 'JSS',
      capacity: 40,
    },
  });

  // Subjects
  const maths = await prisma.subject.upsert({
    where: { id: 'seed-subject-maths' },
    update: {},
    create: {
      id: 'seed-subject-maths',
      tenant_id: tenant.id,
      name: 'Mathematics',
      code: 'MTS',
      title: 'Algebra',
      department_id: sciencesDept.id,
    },
  });

  const english = await prisma.subject.upsert({
    where: { id: 'seed-subject-english' },
    update: {},
    create: {
      id: 'seed-subject-english',
      tenant_id: tenant.id,
      name: 'English Language',
      code: 'ENG',
      title: 'English Language',
      department_id: artsDept.id,
    },
  });

  // Assign subject to JSS 1 Onyx
  for (const subject of [maths, english]) {
    await prisma.classSubject.upsert({
      where: { id: `seed-cs-${subject.id}` },
      update: {},
      create: {
        id: `seed-cs-${subject.id}`,
        tenant_id: tenant.id,
        class_id: jss1Onyx.id,
        subject_id: subject.id,
      },
    });
  }

  console.log('Created academic session (2026/2027)');

  const teacherData = [
    {
      identifier: 'GFA/TCH/001',
      first_name: 'Roxy',
      last_name: 'Roxanne',
      email: 'roxy.roxanne@greenfieldacademy.com',
      qualification: 'B.Sc Mathematics',
    },
    {
      identifier: 'GFA/TCH/002',
      first_name: 'James',
      last_name: 'Okonkwo',
      email: 'james.okonkwo@greenfieldacademy.com',
      qualification: 'M.Ed Physics',
    },
    {
      identifier: 'GFA/TCH/003',
      first_name: 'Amina',
      last_name: 'Hassan',
      email: 'amina.hassan@greenfieldacademy.com',
      qualification: 'B.A English',
    },
  ];

  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where: {
        tenant_id_identifier: {
          tenant_id: tenant.id,
          identifier: t.identifier,
        },
      },
      update: { password_hash: passwordHash },
      create: {
        tenant_id: tenant.id,
        role: 'TEACHER',
        identifier: t.identifier,
        first_name: t.first_name,
        last_name: t.last_name,
        email: t.email,
        password_hash: passwordHash,
        status: 'ACTIVE',
      },
    });
    await prisma.teacherProfile.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        tenant_id: tenant.id,
        employee_id: t.identifier,
        qualification: t.qualification,
      },
    });
  }
  console.log('Created 3 teachers with TeacherProfile');

  const studentData = [
    {
      identifier: 'GFA/2026/0001',
      first_name: 'Benny',
      last_name: 'Graham',
      email: 'benny.graham@greenfieldacademy.com',
      classKey: jss1Onyx.id,
    },
    {
      identifier: 'GFA/2026/0002',
      first_name: 'Chioma',
      last_name: 'Nwosu',
      email: 'chioma.nwosu@greenfieldacademy.com',
      classKey: jss1Sapphire.id,
    },
    {
      identifier: 'GFA/2026/0003',
      first_name: 'David',
      last_name: 'Adeyemi',
      email: 'david.adeyemi@greenfieldacademy.com',
      classKey: jss2Emerald.id,
    },
  ];

  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where: {
        tenant_id_identifier: {
          tenant_id: tenant.id,
          identifier: s.identifier,
        },
      },
      update: { password_hash: passwordHash },
      create: {
        tenant_id: tenant.id,
        role: 'STUDENT',
        identifier: s.identifier,
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email,
        password_hash: passwordHash,
        status: 'ACTIVE',
      },
    });
    await prisma.studentProfile.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        tenant_id: tenant.id,
        matric_number: s.identifier,
        class_id: s.classKey,
      },
    });
  }
  console.log('Created 3 students with StudentProfile');

  const guardianData = [
    {
      identifier: 'GRD/2026/001',
      first_name: 'Grace',
      last_name: 'Graham',
      email: 'grace.graham@greenfieldacademy.com',
      relationship: 'Mother',
    },
    {
      identifier: 'GRD/2026/002',
      first_name: 'Ibrahim',
      last_name: 'Nwosu',
      email: 'ibrahim.nwosu@greenfieldacademy.com',
      relationship: 'Father',
    },
    {
      identifier: 'GRD/2026/003',
      first_name: 'Funke',
      last_name: 'Adeyemi',
      email: 'funke.adeyemi@greenfieldacademy.com',
      relationship: 'Guardian',
    },
  ];

  for (const g of guardianData) {
    const user = await prisma.user.upsert({
      where: {
        tenant_id_identifier: {
          tenant_id: tenant.id,
          identifier: g.identifier,
        },
      },
      update: { password_hash: passwordHash },
      create: {
        tenant_id: tenant.id,
        role: 'PARENT',
        identifier: g.identifier,
        first_name: g.first_name,
        last_name: g.last_name,
        email: g.email,
        password_hash: passwordHash,
        status: 'ACTIVE',
      },
    });
    await prisma.guardianProfile.upsert({
      where: { user_id: user.id },
      update: {},
      create: {
        user_id: user.id,
        tenant_id: tenant.id,
        relationship: g.relationship,
      },
    });
  }
  console.log('Created 3 guardians with GuardianProfile');

  console.log('Seed completed successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
