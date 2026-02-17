# MUSE INC Management and Scheduling System
        
I want to create an app for a MUSE INC. It needs to schedule room time so people can block off time to practice on their own in one of the practice rooms. Create a roadmap for courses. When people sign up for a course they will be able to schedule and stay on the class plan and recieve notes after each class. In app messaging for student to instructor as well as company marketing emails

Made originally with Floot (modified for self-hosting).

# Instructions

For security reasons, the `env.json` file is not pre-populated — you will need to generate or retrieve the values yourself.  

For **JWT secrets**, generate a value with:  

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then paste the generated value into the appropriate field.  

For the project database, export your data (pg_dump) from your previous provider or source and import it into your PostgreSQL database, then fill in the connection string value.  

**Note:** Provider-hosted OAuth flows may not work in self-hosted environments; configure your own OAuth provider (or Supabase) and set the appropriate env values.

For other external services, retrieve your API keys and fill in the corresponding values.  

Once everything is configured, you can build and start the service with:  

```
npm install -g pnpm
pnpm install
pnpm vite build
pnpm tsx server.ts
```

## Deploy Free (Render)

This app can be hosted for free on a Render **Web Service**.

1. Push this repo to GitHub.
2. In Render, create `New > Web Service` and connect the repo.
3. Configure:
   - Build Command: `pnpm install && pnpm run build`
   - Start Command: `pnpm run start`
   - Instance Type: `Free`
4. Add environment variables in Render (same keys used in `env.example.json`).
5. Deploy.

Notes:
- `loadEnv.js` now treats `env.json` as optional, so production can use host-managed env vars directly.
- Free Render web services sleep after idle time and may take a short time to wake up on the first request.
