-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Users Table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  password text not null,
  "discordId" text, 
  role text default 'student',
  major text,
  "createdAt" timestamptz default now()
);

-- Students Table
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  "mentorId" text,
  name text not null,
  discord text,
  major text,
  "createdAt" timestamptz default now()
);

-- Questions Table
create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  "mentorId" text,
  topic text,
  questions jsonb, -- Array of strings or objects
  "createdAt" timestamptz default now()
);

-- Sessions Table
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  "mentorId" text,
  "groupName" text,
  "topicIds" jsonb, -- Array of IDs
  "topicNames" jsonb, -- Array of strings
  "topicName" text,
  questions jsonb, -- Array of question objects with context
  status text default 'active',
  "createdAt" timestamptz default now(),
  students jsonb -- Array of student objects with status, grades, etc.
);

-- Chats Table
create table if not exists chats (
  id uuid primary key default uuid_generate_v4(),
  "sessionId" uuid references sessions(id) on delete cascade,
  "studentId" text,
  messages jsonb default '[]',
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

-- Refresh Tokens Table
create table if not exists refresh_tokens (
  id uuid primary key default uuid_generate_v4(),
  "userId" uuid references users(id) on delete cascade,
  token text unique not null,
  "expiresAt" timestamptz not null,
  "isRevoked" boolean default false,
  "familyId" uuid default uuid_generate_v4(),
  "createdAt" timestamptz default now()
);
