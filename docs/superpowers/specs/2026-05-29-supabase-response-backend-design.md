# Supabase Response Backend Design

## Goal

Use the owner's Supabase project as the source of truth for authentication, uploaded evidence files, saved outreach responses, and an admin-only central dashboard.

## Architecture

The existing Supabase Auth Google sign-in remains the only authentication path. Staff access to the lead audit flow continues to use the current email-domain visibility rules. Admin access is separate and controlled by an `admin_users` table in Supabase.

Responses are stored in normalized Postgres tables: one response row per lead/user save, child rows for touchpoints, and child rows for uploaded evidence metadata. Evidence files are stored in a private Supabase Storage bucket and referenced by storage path. The admin dashboard reads all response records only after confirming the current user's email exists as an active admin.

## Data Model

- `admin_users`: active admin emails and role labels.
- `lead_responses`: submission-level metadata for lead audit responses.
- `lead_response_touchpoints`: first outreach and follow-up data.
- `lead_response_files`: evidence file metadata linked to a touchpoint.
- Storage bucket: `lead-evidence`, private.

## Access Control

Row Level Security allows authenticated users to insert and read their own response data. Admin policies allow active admins to read all responses and files. Storage policies allow authenticated uploads to the private bucket and restrict reads to file owners or active admins.

The frontend also hides the admin route for non-admin users, but database policies are the authoritative protection.

## UI Flow

On each lead card, selected files upload to Supabase Storage during save. The app then upserts the response, replaces touchpoints for that response, and stores file metadata. The card loads any previously saved response for the signed-in user and displays persisted attachments with signed URLs.

The `/admin` route lists all responses across users, with filters for center, submitter, and lead search. Admins can inspect the saved touchpoints and open evidence files through signed URLs.

