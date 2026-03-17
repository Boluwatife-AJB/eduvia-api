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

  console.log(`Tenant: ${tenant.name}`);
  console.log(`ID: ${tenant.id}`);
  console.log(`Slug: ${tenant.slug}`);
  console.log(`Initials: ${tenant.initials ?? '(none)'}\n`);

  // Create a principal - School admin
  await prisma.user.upsert({
    where: {
      tenantId_identifier: {
        tenantId: tenant.id,
        identifier: 'PRIN/001',
      },
    },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      role: 'PRINCIPAL',
      identifier: 'PRIN/001',
      firstName: 'Tony',
      lastName: 'Stark',
      email: 'tony.stark@greenfieldacademy.com',
      passwordHash: passwordHash,
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
      tenantId: tenant.id,
      name: '2026/2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-07-31'),
      isCurrent: true,
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
      tenantId: tenant.id,
      academicSessionId: academicSession.id,
      name: 'First Term',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
      isCurrent: true,
    },
  });

  // Departments
  const sciencesDept = await prisma.department.upsert({
    where: { id: 'seed-dept-sciences' },
    update: {},
    create: {
      id: 'seed-dept-sciences',
      tenantId: tenant.id,
      name: 'Sciences',
    },
  });

  const artsDept = await prisma.department.upsert({
    where: { id: 'seed-dept-arts' },
    update: {},
    create: {
      id: 'seed-dept-arts',
      tenantId: tenant.id,
      name: 'Arts',
    },
  });

  // Classes
  const jss1Onyx = await prisma.class.upsert({
    where: { id: 'seed-class-jss1-onyx' },
    update: {},
    create: {
      id: 'seed-class-jss1-onyx',
      tenantId: tenant.id,
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
      tenantId: tenant.id,
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
      tenantId: tenant.id,
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
      tenantId: tenant.id,
      name: 'Mathematics',
      code: 'MTS',
      title: 'Algebra',
      departmentId: sciencesDept.id,
    },
  });

  const english = await prisma.subject.upsert({
    where: { id: 'seed-subject-english' },
    update: {},
    create: {
      id: 'seed-subject-english',
      tenantId: tenant.id,
      name: 'English Language',
      code: 'ENG',
      title: 'English Language',
      departmentId: artsDept.id,
    },
  });

  // Assign subject to JSS 1 Onyx
  for (const subject of [maths, english]) {
    await prisma.classSubject.upsert({
      where: { id: `seed-cs-${subject.id}` },
      update: {},
      create: {
        id: `seed-cs-${subject.id}`,
        tenantId: tenant.id,
        classId: jss1Onyx.id,
        subjectId: subject.id,
      },
    });
  }

  console.log('Created academic session (2026/2027)');

  const teacherData = [
    {
      identifier: 'GFA/TCH/001',
      firstName: 'Roxy',
      lastName: 'Roxanne',
      email: 'roxy.roxanne@greenfieldacademy.com',
      qualification: 'B.Sc Mathematics',
    },
    {
      identifier: 'GFA/TCH/002',
      firstName: 'James',
      lastName: 'Okonkwo',
      email: 'james.okonkwo@greenfieldacademy.com',
      qualification: 'M.Ed Physics',
    },
    {
      identifier: 'GFA/TCH/003',
      firstName: 'Amina',
      lastName: 'Hassan',
      email: 'amina.hassan@greenfieldacademy.com',
      qualification: 'B.A English',
    },
  ];

  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_identifier: { tenantId: tenant.id, identifier: t.identifier },
      },
      update: { passwordHash },
      create: {
        tenantId: tenant.id,
        role: 'TEACHER',
        identifier: t.identifier,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    await prisma.teacherProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        tenantId: tenant.id,
        employeeId: t.identifier,
        qualification: t.qualification,
      },
    });
  }
  console.log('Created 3 teachers with TeacherProfile');

  const studentData = [
    {
      identifier: 'GFA/2026/0001',
      firstName: 'Benny',
      lastName: 'Graham',
      email: 'benny.graham@greenfieldacademy.com',
      classKey: jss1Onyx.id,
    },
    {
      identifier: 'GFA/2026/0002',
      firstName: 'Chioma',
      lastName: 'Nwosu',
      email: 'chioma.nwosu@greenfieldacademy.com',
      classKey: jss1Sapphire.id,
    },
    {
      identifier: 'GFA/2026/0003',
      firstName: 'David',
      lastName: 'Adeyemi',
      email: 'david.adeyemi@greenfieldacademy.com',
      classKey: jss2Emerald.id,
    },
  ];

  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_identifier: { tenantId: tenant.id, identifier: s.identifier },
      },
      update: { passwordHash },
      create: {
        tenantId: tenant.id,
        role: 'STUDENT',
        identifier: s.identifier,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        tenantId: tenant.id,
        matricNumber: s.identifier,
        classId: s.classKey,
      },
    });
  }
  console.log('Created 3 students with StudentProfile');

  const guardianData = [
    {
      identifier: 'GRD/2026/001',
      firstName: 'Grace',
      lastName: 'Graham',
      email: 'grace.graham@greenfieldacademy.com',
      relationship: 'Mother',
    },
    {
      identifier: 'GRD/2026/002',
      firstName: 'Ibrahim',
      lastName: 'Nwosu',
      email: 'ibrahim.nwosu@greenfieldacademy.com',
      relationship: 'Father',
    },
    {
      identifier: 'GRD/2026/003',
      firstName: 'Funke',
      lastName: 'Adeyemi',
      email: 'funke.adeyemi@greenfieldacademy.com',
      relationship: 'Guardian',
    },
  ];

  for (const g of guardianData) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_identifier: { tenantId: tenant.id, identifier: g.identifier },
      },
      update: { passwordHash },
      create: {
        tenantId: tenant.id,
        role: 'PARENT',
        identifier: g.identifier,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    await prisma.guardianProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        tenantId: tenant.id,
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
