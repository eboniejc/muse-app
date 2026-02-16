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
