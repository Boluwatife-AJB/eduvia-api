# Eduvia API


Eduvia API is a multi-tenant school management backend built with NestJS, TypeScript, and Prisma (PostgreSQL). It is designed as a modular monolith, with each school isolated by tenant context while sharing one deployable API service.

The platform supports core academic and administrative workflows: school setup, user and profile management, timetable, lectures, assessments, result computation, repository/file storage, onboarding, notifications, and background processing.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Modules](#modules)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [API Conventions](#api-conventions)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

Eduvia API provides a tenant-aware backend for schools with:

- Role-based authentication and authorization
- Tenant isolation and tenant-aware request handling
- Academic setup and operational modules
- Async job processing for email, notifications, and grading
- File and document repository support with S3-compatible storage

Primary stakeholders in the platform include:

- Super admins (platform-level onboarding/approval)
- School admins
- Teachers
- Students
- Guardians/parents
- Non-teaching/support staff

## Core Features

- **Authentication and Authorization**
  - JWT access/refresh token flow
  - Role-based endpoint access
  - Tenant-aware request guard (`x-tenant-slug`)
- **School Setup**
  - Academic sessions and terms
  - Departments, classes, subjects
  - Class-subject and teacher-subject assignment
  - Student subject registration
- **User Management**
  - Unified user model with role-specific profiles
  - Student, teacher, guardian, and staff lifecycle handling
  - Bulk operations/import support
- **Learning and Delivery**
  - Timetable and tutorial class scheduling
  - Lecture publishing and tracking
- **Assessment and Results**
  - Assessments, questions, submissions
  - Grading and result-engine components
  - Approval workflow support
- **Repository and Storage**
  - Tenant-scoped folders/files and sharing
  - S3-compatible upload strategy (including large file presigned URLs)
- **Notifications**
  - In-app notification events
  - Email dispatch through queue workers
- **Onboarding**
  - School registration and approval lifecycle

## Tech Stack

- **Framework:** NestJS 11
- **Language:** TypeScript
- **Database:** PostgreSQL + Prisma
- **Queue:** BullMQ + Redis
- **Storage:** S3-compatible providers (AWS SDK)
- **Auth/Security:** JWT, Passport, Helmet, Throttler
- **Docs:** Swagger/OpenAPI
- **Email:** Resend + templates

## Architecture

Eduvia is structured as a modular monolith under `src`, composed by `AppModule`.

- Global API prefix: `/api/v1`
- API docs endpoint: `/api/docs`
- Global validation via `ValidationPipe` (whitelist, transform)
- Global guards for throttling, JWT auth, roles, and tenant enforcement
- Prisma as centralized data access layer

Request flow:

1. Resolve tenant context (subdomain/header)
2. Validate auth token and role access
3. Validate/transform DTO payload
4. Execute domain service logic
5. Return standardized API response envelope

## Modules

| Module | Responsibility |
| --- | --- |
| `auth` | Login, refresh, logout, auth session flow |
| `tenant` | Tenant resolution and request scoping |
| `users` | User/profile management and role operations |
| `school-setup` | Academic structure and configuration workflows |
| `timetable` | Scheduling and timetable operations |
| `lectures` | Lecture creation, publishing, and student access |
| `assessment` | Assessments, submissions, grading, results support |
| `approval` | Approval pipeline for moderated actions |
| `result-engine` | Result computation utilities |
| `repository` | Repository folders/files, permissions, quotas |
| `upload` | S3 upload lifecycle and file validation |
| `notifications` | Notification event handling |
| `email` | Email processing and delivery logging |
| `queue` | BullMQ configuration and background workers |
| `onboarding` | School onboarding and approval workflow |
| `school-config` | Tenant-specific school configuration |
| `payment` | Payment/payroll DTO and domain scaffolding |

## Data Model

Prisma schema is in `prisma/schema.prisma`, with generated client in `src/generated/prisma`.

### Core Domain Groups

- **Tenant and Identity:** `Tenant`, `User`, `RefreshToken`, profile models
- **Academic Core:** `AcademicSession`, `AcademicTerm`, `Department`, `Class`, `Subject`
- **Teaching:** `TimeTableSlot`, `TutorialClass`, `Lecture`, `LectureView`
- **Assessment:** `Assessment`, `AssessmentQuestion`, `AssessmentSubmission`, `SubmissionAnswer`
- **Operational:** notifications, email logs, repository/storage, onboarding, finance-related models

Most models are tenant-scoped using `tenant_id` to maintain data isolation.

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- Docker + Docker Compose

### 1) Install dependencies

```bash
npm ci
```

### 2) Copy environment file

Use the provided `.env.example` and create your local `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update values in `.env` for your local environment.

### 3) Start local infrastructure

```bash
docker compose up -d
```

### 4) Generate Prisma client and run migrations

```bash
npx prisma generate
npx prisma migrate dev
```

### 5) (Optional) Seed the database

```bash
npx prisma db seed
```

### 6) Start development server

```bash
npm run start:dev
```

### Local URLs

- API base: `http://localhost:8000/api/v1`
- Swagger docs: `http://localhost:8000/api/docs`

## Development Workflow

Common scripts:

- `npm run start:dev` - run API in watch mode
- `npm run build` - compile production build
- `npm run start:prod` - run compiled build
- `npm run format` - apply Prettier formatting
- `npm run format:check` - verify formatting
- `npm run lint` - run ESLint with fixes
- `npm run type-check` - run TypeScript checks
- `npm run test` - run unit/integration tests
- `npm run test:e2e` - run end-to-end tests
- `npm run verify` - run format, lint, type-check, and tests

Recommended pre-PR check:

```bash
npm run verify
```

## API Conventions

- All routes are prefixed with `/api/v1`
- OpenAPI docs available at `/api/docs`
- Most school-facing endpoints require `x-tenant-slug`
- Validation and transformation are globally enforced
- Auth uses Bearer JWT tokens

## Roadmap

The following are planned or actively evolving areas:

- **Payments**
  - Harden and complete payment gateway integration
  - Payment reconciliation and failure recovery workflows
  - Better fee lifecycle visibility and reporting
- **Email Notifications**
  - Expand template catalog and localization
  - Add richer event triggers and admin controls
  - Improve observability for email delivery and retries
- **Messaging**
  - In-app direct messaging and thread model
  - Role-aware communication channels (teacher-student, school-guardian)
  - Moderation, message history, and notification preferences

Future roadmap details may be tracked in GitHub issues/projects as the implementation evolves.

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit focused changes with tests
4. Run `npm run verify`
5. Open a pull request

Please keep PRs small, documented, and aligned with existing module boundaries.

## License

This project is currently marked as `UNLICENSED` in `package.json`. Add a license file and update this section when licensing is finalized.

