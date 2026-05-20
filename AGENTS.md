<!-- BEGIN:nextjs-agent-rules -->
# Dora3 agent guide

## Project state

Dora3 is in Phase 2: a local, single-user Next.js document-chat foundation. The implemented scope is `/chat`, `/documents`, local conversation/settings persistence, and server-side provider calls for OpenAI/OpenRouter.

Do not jump ahead into PDF upload, document indexing, embeddings, RAG, citations, authentication, or agent tool loops unless the user explicitly asks for a later phase.

# Do not commit
Never commit anything to github. you are only allowed to use git when investigating, comparing code. Never use git add , commit , push etc.

# never install a package if its not nessecarry. 
use normal javascript/nextjs/reactjs. dont instal 3rd pary package without asking first. See if you can implement wihout a third party package first. 
e.g. fetch data. use fetch api instead of axios or third party  

## App structure

- `app/chat/page.tsx` renders the chat page through `components/chat/ChatLayout.tsx`.
- `app/documents/page.tsx` is intentionally a placeholder for future document workflows.
- `app/api/chat/route.ts` validates chat requests and streams normalized NDJSON events to the client.
- `lib/providers/*` contains OpenAI-compatible provider adapters. Keep API keys server-side only.
- `lib/chat/localStorage.ts` and `lib/settings/settingsStorage.ts` own browser persistence. Keep local storage key changes intentional because existing browser data depends on them.

## Provider behavior

- Required environment keys are `OPENAI_API_KEY` and `OPENROUTER_API_KEY`; only the selected provider key is needed at runtime.
- Add provider models in `lib/settings/settingsStorage.ts`.
- Preserve understandable missing-key errors. The UI should show provider failures without exposing secrets.

## Verification

Before handing off code changes, run:

```bash
npm run lint
npm run typecheck
npm run build
```

For UI changes, also manually verify `/chat`, `/documents`, settings, new conversations, local persistence, and the right-side future sources panel.
<!-- END:nextjs-agent-rules -->

