# AI Context for Pipe Industries ERP

## Project Overview
- **Purpose**: Comprehensive ERP system for Pipe Industries, managing inventory, dealers, invoices, and payments.
- **Tech Stack**: 
  - **Frontend**: React 19, Vite, Tailwind CSS 4, Lucide React, Framer Motion, Recharts.
  - **Backend**: Express (Node.js), SQLite (Legacy/Migration Source).
  - **Database/Auth**: Firebase Firestore & Firebase Auth (Current Target).
- **Architecture**: Single Page Application (SPA) with a Node.js server to serve static files and provide legacy API support.

## Current State
- **Version**: 1.1.0
- **Status**: Production (Deployed to Vercel)
- **Deployment URL**: [https://pipe-industries-erp.vercel.app](https://pipe-industries-erp.vercel.app)
- **Last Updated**: 2026-04-05

## File Structure
```
/
├── .env                  # Environment variables (Firebase, Gemini)
├── .env.example          # Template for environment variables
├── server.ts             # Express server (Static hosting + Legacy SQLite API)
├── package.json          # Project dependencies and scripts
├── src/
│   ├── components/       # Reusable UI components
│   ├── context/          # React Context (Auth, etc.)
│   ├── pages/            # Page-level components
│   ├── services/         # Data fetching services (Firestore, Gemini)
│   ├── lib/              # Utility functions and shared library configs
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles (Tailwind 4)
└── dist/                 # Production build output
```

## Key Components
### AuthContext
- **Location**: `src/context/AuthContext.tsx`
- **Purpose**: Manages user session using Firestore and local storage.
- **Notes**: Includes a "simulated token" for legacy login support.

### FirestoreService
- **Location**: `src/services/firestoreService.ts`
- **Purpose**: Core data layer for the application.
- **Dependencies**: Firebase SDK.

## Configuration
- **Environment Variables**:
  - `VITE_FIREBASE_*`: Firebase configuration keys.
  - `GEMINI_API_KEY`: API key for Google Gemini AI.
  - `PORT`: Server listening port (Production).
  - `JWT_SECRET`: Secret for signing tokens (Legacy).

## Known Issues
- Architecture is split between legacy SQLite logic in `server.ts` and new Firestore logic in `src/services/`. (SQLite is not available on Vercel).
- `AuthContext.tsx` uses manual bcrypt hashing in Firestore instead of Firebase Auth.
- Firestore requires manual composite index creation for complex queries (UI handling implemented).

## Future Improvements
- Complete removal of legacy SQLite logic and `server.ts`.
- Full transition to Firebase Authentication.

## Development Notes
The project is currently transitioning from a local SQLite-based architecture to a cloud-based Firebase architecture.
