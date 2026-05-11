# HasadX (حصادX)

HasadX is an Arabic RTL educational platform offering smart homework, AI-powered grading, and interactive learning experiences.

## Run & Operate

_Populate as you build_

## Stack

-   **Runtime**: Node.js 24, pnpm, TypeScript 5.9
-   **Backend**: Express 5, PostgreSQL, Drizzle ORM, Zod
-   **Frontend**: React, Vite, Tailwind CSS, wouter
-   **Auth**: `bcryptjs` (session-based)
-   **Build Tool**: Vite
-   **Codegen**: Orval (OpenAPI to API client/Zod schemas)

## Where things live

-   `/apps/api-server`: Backend Express application.
    -   `src/db/schema.ts`: Drizzle ORM database schema.
    -   `src/openapi.yaml`: OpenAPI specification for API.
-   `/apps/homework-app`: Frontend React application.
    -   `src/tailwind.css`: Main Tailwind CSS configuration.
    -   `src/components/teacher/class-selector.tsx`: Reusable class selection component.
-   `/packages/`: Shared utilities and components.
    -   `artifacts/api-server/src/data/hasad_knowledge_base.md`: AI assistant knowledge base.
    -   `artifacts/api-server/src/data/hasad_faq.json`: AI assistant FAQs.
    -   `artifacts/api-server/src/lib/presentations-tier.ts`: Presentation tier logic.
    -   `scripts/src/seed-hasad-challenge-expansion.ts`: Idempotent seed for Hasad Challenge content (sections/categories/questions). Run with `pnpm --filter @workspace/scripts run seed:hasad-expansion`.

## Architecture decisions

-   **Monorepo Structure**: pnpm workspace for shared code and consistent development.
-   **API-First Design**: RESTful API for clear separation of concerns.
-   **AI Integration**: OpenAI (GPT-5.2) for grading/content analysis/question generation, Anthropic (Claude Sonnet 4.6) for AI assistant/slide generation.
-   **Real-time Interactivity**: Socket.IO for live features (games, notifications, whiteboards).
-   **Three-Role System**: Supports organizer/teacher, student, and visitor roles with distinct interfaces.

## Product

-   **Interactive Content**: Kahoot-style quizzes, 3D competitive games (React Three Fiber), mini-games (Flag Quiz, Wheel of Fortune, Who Wants a Million?), interactive video lessons.
-   **AI-Powered Tools**: Auto-grading, AI assistant, worksheet generator (bilingual, vision support, printable), lesson plan generator (bilingual, printable).
-   **Teacher Features**: Admin panel, content sharing, assignment/submission management, student management (bulk import with AI OCR), adaptive testing, hierarchical section organization, teacher dashboard.
-   **Live Sessions**: PIN-based interactive presentations with real-time teacher control and student responses.
-   **Feedback System**: Public feedback page with admin response and email notification capabilities.

## User preferences

-   I prefer clear and concise explanations.
-   I prefer an iterative development approach where we build features step-by-step.
-   Please ask for confirmation before making any major architectural changes or deleting significant portions of code.
-   Ensure all new features are accompanied by appropriate tests.

## Gotchas

-   Worksheet generator's `window.print()` relies on browser print functionality; no PDF library is used.
-   AI output for worksheet/lesson plan generation is strictly validated server-side after sanitization.
-   AI assistant is globally mounted and available on all teacher/organizer routes, but hidden on student/auth/game-play routes.
-   Presentation live mode (Phase 2B MVP) explicitly defers AI generation, teams, leaderboard, and persistent results dashboard.

## Pointers

-   **Drizzle ORM Docs**: `https://orm.drizzle.team/docs/overview`
-   **Zod Docs**: `https://zod.dev/`
-   **Orval Docs**: `https://orval.dev/docs/introduction`
-   **React Three Fiber Docs**: `https://docs.pmnd.rs/react-three-fiber/getting-started/introduction`
-   **Tailwind CSS Docs**: `https://tailwindcss.com/docs`
-   **Socket.IO Docs**: `https://socket.io/docs/`
-   **OpenAPI Specification**: `https://swagger.io/specification/`