# TaskFlow AI

Full-stack productivity app built with **Next.js 15, React 19, TypeScript and Supabase**. Features secure authentication, task CRUD, priorities, due dates, speech-to-text task capture, private voice recordings, search, in-app overdue indicators, and productivity analytics.

## 1. Requirements
- Node.js 20+ (Node.js 22 recommended)
- A free Supabase project
- GitHub account and Vercel account for deployment

## 2. Configure Supabase
1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. This creates tables, Row Level Security policies, and a private voice-notes bucket.
3. Open **Project Settings → API** (or **Connect**) and copy your project URL and **publishable/anon key**. Do **not** use the `service_role`/secret key.
4. In **Authentication → Providers → Email**, enable email/password authentication. Email confirmation can stay enabled (recommended).
5. In **Authentication → URL Configuration**, add your production Vercel URL to Site URL and Redirect URLs after deployment. For local testing, add `http://localhost:3000`.

## 3. Local development
```bash
npm install
cp .env.example .env.local
```
Edit `.env.local` with your Supabase values:
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```
Then:
```bash
npm run dev
```
Visit http://localhost:3000. Create an account and confirm your email if requested.

## 4. Test
```bash
npm run typecheck
npm run build
```
Manual acceptance checks:
- Register, confirm email, sign in and sign out.
- Create, edit, complete, filter, search and delete a task.
- Set a due date and check due-today/overdue counters.
- Allow microphone access; dictate a task in a supported browser (Chrome/Edge are recommended).
- Record, save, play and delete an audio note.
- Sign in with a second account and verify that the first account's tasks/notes cannot be accessed.

## 5. Publish on GitHub
From the project directory:
```bash
git init
git add .
git commit -m "Initial TaskFlow AI full-stack MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taskflow-ai.git
git push -u origin main
```
Create an empty repository called `taskflow-ai` on GitHub before pushing. `.env.local` is ignored by Git; **never commit secrets**.

## 6. Deploy on Vercel
1. Open https://vercel.com/new and import the `taskflow-ai` GitHub repository.
2. Framework preset: **Next.js**.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Environment Variables.
4. Click **Deploy**. Add the deployed URL to Supabase Authentication URL Configuration.
5. Verify sign-up/login, task operations and voice recording on your live HTTPS URL.

## Known limitations / next phase
- Speech-to-text uses the browser's SpeechRecognition API and is not available in all browsers. Recognition may use a browser vendor's online service; don't dictate sensitive data without understanding that service's privacy practices.
- Voice recordings use the MediaRecorder API; supported audio formats depend on the browser. Maximum size is 10 MB per recording.
- Deadline reminders are **in-app indicators** only. Scheduled email/push reminders are not yet implemented.
- The 'AI' name is product branding in this MVP. AI planning, transcription fallback, natural-language date extraction and smart scheduling are planned enhancements, not included here.
- This project is a client-side Supabase architecture protected by RLS; no custom Next.js API route is necessary for the current CRUD operations.

## Security
- Row Level Security is enabled for all application tables and storage objects.
- Voice files live in a private bucket; playback uses expiring signed URLs.
- Supabase publishable/anon key is intended for client-side use. Never expose service-role keys.
