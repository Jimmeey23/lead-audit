# Supabase Response Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist lead audit responses and uploaded evidence in Supabase, then expose a central admin-only dashboard.

**Architecture:** Use Supabase Auth on the client, RLS-protected Postgres tables for responses, and a private Storage bucket for files. Keep lead seed data local for now, but persist each user's response state by `lead_id` and expose aggregated admin reads through RLS.

**Tech Stack:** TanStack Start, React, TypeScript, Supabase JS, Supabase Postgres, Supabase Storage.

---

### Task 1: Types and Supabase Helpers

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/lib/lead-responses.ts`

- [x] Define typed tables for `admin_users`, `lead_responses`, `lead_response_touchpoints`, and `lead_response_files`.
- [x] Add helper functions for admin lookup, response loading, file uploads, response saves, and admin dashboard loading.

### Task 2: Persist Lead Cards

**Files:**
- Modify: `src/components/LeadCard.tsx`
- Modify: `src/routes/index.tsx`

- [x] Load the signed-in user's existing response for each visible lead.
- [x] Upload evidence files to Supabase Storage on save.
- [x] Store response/touchpoint/file metadata in Supabase.
- [x] Display persisted evidence links using signed URLs.

### Task 3: Admin Route

**Files:**
- Create: `src/routes/admin.tsx`

- [x] Check `admin_users` for the signed-in user's active admin status.
- [x] Block non-admin users.
- [x] Display all saved responses and their touchpoints/files in one dashboard.

### Task 4: SQL Setup Script

**Files:**
- Create: `supabase/setup-response-backend.sql`

- [x] Create tables, indexes, RLS policies, storage bucket, and storage policies.
- [x] Include a clearly marked admin insert example.

### Task 5: Verification

**Commands:**
- [ ] Run `npm run build`.
- [ ] Report any build or type issues with exact evidence.

