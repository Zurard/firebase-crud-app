# ProManage

ProManage is a real-life student project tracker built with Next.js and Firebase. It demonstrates CRUD and a full service integration stack: Authentication, Firestore, Storage, Cloud Functions, Analytics, and Hosting.

## Features

- Google and Email/Password sign-in (Firebase Authentication)
- User-specific project task CRUD (Cloud Firestore)
- File attachment uploads per task (Firebase Storage)
- Automatic activity logging on task changes (Cloud Functions)
- Client analytics events for user actions (Firebase Analytics)
- Firebase Hosting ready configuration for deployment

## Tech Stack

- Next.js App Router (TypeScript)
- Firebase Web SDK
- Firebase Cloud Functions (Node.js)
- Tailwind CSS

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the root (copy from `.env.local.example`):

```bash
cp .env.local.example .env.local
```

3. Fill these values from Firebase project settings:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

4. Run the app:

```bash
npm run dev
```

## Firebase Console Setup

### 1) Authentication

- Go to Firebase Console -> Build -> Authentication.
- Enable providers:
  - Google
  - Email/Password

### 2) Firestore

- Go to Build -> Firestore Database.
- Ensure database is created.
- Publish rules from `firestore.rules`.

### 3) Storage

- Go to Build -> Storage.
- Ensure bucket is created.
- Publish rules from `storage.rules`.

### 4) Analytics

- Enable Google Analytics in project settings.
- Set `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` in `.env.local`.

### 5) Functions + Hosting (Blaze plan)

- Cloud Functions requires Blaze billing enabled.

Install Firebase CLI and login:

```bash
npm install -g firebase-tools
firebase login
```

Install function deps:

```bash
npm install --prefix functions
```

Deploy rules and functions:

```bash
firebase deploy --only firestore:rules,storage:rules,functions
```

Deploy Hosting (framework integration):

```bash
firebase deploy --only hosting
```

## Activity Logging (Cloud Functions)

Functions in `functions/index.js` listen to Firestore task events:

- `logTaskCreated`
- `logTaskUpdated`
- `logTaskDeleted`

Each event writes an audit document into the `activity` collection.

## Project Structure

- `src/app/page.tsx` -> main app UI, auth flows, CRUD, uploads, analytics events
- `src/lib/firebase.ts` -> Firebase app initialization and service exports
- `src/lib/types.ts` -> shared task form and task data types
- `functions/index.js` -> Firestore trigger functions for activity logs
- `firestore.rules` -> per-user Firestore access control
- `storage.rules` -> per-user storage access control
- `firebase.json` -> Firebase functions/hosting/rules config

## Notes

- `.env.local` is ignored by git; keep secrets there.
- Analytics only runs in supported browsers and client context.
- Activity logs are stored in Firebase and not rendered in UI by design.
# CRUD-cloud
