# OneSignal Preview Setup

Set these Vercel environment variables for branch `codex/onesignal-preview`:

```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-onesignal-app-id
ONESIGNAL_REST_API_KEY=your-onesignal-rest-api-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

In OneSignal Web configuration:

1. Add the preview Vercel domain as an allowed site origin.
2. Keep HTTPS enabled.
3. Use the default worker paths:
   - `/OneSignalSDKWorker.js`
   - `/OneSignalSDKUpdaterWorker.js`

Preview flow covered by this branch:

1. Admin opens the bell and grants notification permission.
2. Crew submits a PPE request.
3. Admin receives a OneSignal push notification.
4. Admin approves or rejects the request.
5. Requester receives a OneSignal push notification that links to `/my-requests`.
