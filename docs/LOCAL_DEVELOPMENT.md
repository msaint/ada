# Local development

The checkout is at `/Users/msaint/Projects/Ada`. Use Node 22 (`.nvmrc`) and install dependencies with `npm ci`.

On this machine, Node 22 is also installed in the ignored `work/runtime` directory. Start the app using:

```bash
./scripts/local-dev.sh
```

Open http://localhost:3001/app. The launcher selects the project-local runtime when available and binds the server to the loopback interface. Stop it with Ctrl+C.

The ignored `.env.local` is configured for live Supabase authentication/persistence and OpenAI, with `ADA_DEV_AUTH=false` and `MOCK_MODEL=false`. Sign in using an email magic link. For an offline fixture, set both flags to `true`; that mode uses a single local learner and persistent files in `work/data`.

To run checks using the project-local runtime:

```bash
export PATH="$PWD/work/runtime/node_modules/.bin:$PATH"
npm run typecheck
npm run lint
npm test
ADA_TEST_PORT=3001 npm run test:e2e
ADA_DEV_AUTH=false MOCK_MODEL=false npm run build
```

Stop the development server before running end-to-end tests; the suite starts its own server on port 3001. Tests use the local fixture learner, so use expendable local data.

For live services, fill in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` in `.env.local`, and disable both development flags. Follow the README's authentication setup and migration instructions. Verify the existing hosted database's migration state before applying migrations. Allow `http://localhost:3001/auth/callback` in Supabase Auth redirect URLs. Keep `APP_BASE_URL=http://localhost:3001` locally. Never commit `.env.local` or expose service-role/API keys in public variables.

Hosted references:

- Repository: https://github.com/msaint/ada
- Deployment: https://ada-three-mauve.vercel.app/
- Supabase: https://curvpbuiyoznnyufyyrp.supabase.co
