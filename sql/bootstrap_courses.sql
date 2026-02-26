-- Run this in Supabase SQL Editor to create missing course tables.
-- Safe to re-run because each CREATE uses IF NOT EXISTS.

create table if not exists public.courses (
  id bigserial primary key,
  name text not null,
  description text,
  "totalLessons" integer not null default 0,
  "maxStudents" integer,
  "skillLevel" text,
  price numeric,
  "isActive" boolean not null default true,
  "instructorId" bigint references public.users(id) on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public."courseEnrollments" (
  id bigserial primary key,
  "userId" bigint not null references public.users(id) on delete cascade,
  "courseId" bigint not null references public.courses(id) on delete cascade,
  status text not null default 'active',
  "progressPercentage" integer not null default 0,
  "enrolledAt" timestamptz not null default now(),
  "completedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("userId", "courseId", status)
);

create table if not exists public."lessonCompletions" (
  id bigserial primary key,
  "enrollmentId" bigint not null references public."courseEnrollments"(id) on delete cascade,
  "lessonNumber" integer not null,
  "markedBy" bigint not null references public.users(id) on delete cascade,
  "completedAt" timestamptz not null default now(),
  "createdAt" timestamptz not null default now(),
  unique ("enrollmentId", "lessonNumber")
);

create index if not exists idx_course_enrollments_course_id
  on public."courseEnrollments" ("courseId");

create index if not exists idx_course_enrollments_user_id
  on public."courseEnrollments" ("userId");

create table if not exists public.events (
  id bigserial primary key,
  title text not null,
  caption text,
  "flyerUrl" text,
  "startAt" timestamptz not null,
  "endAt" timestamptz,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_events_start_at
  on public.events ("startAt");

create index if not exists idx_events_is_active
  on public.events ("isActive");
