# Changelog

All notable changes to this project will be documented in this file.

Format: [Date] - [Version] - [Type]

---

## [1.1.0] - 2026-04-05

### Added
- **Firestore Error Handling**: Implemented deep-link detection for missing Firestore indices in the Dashboard UI.
- **Partial Data Loading**: Updated `getDashboardStats` to catch individual KPI failures, allowing the dashboard to render even if some data is unavailable.
- **Deployment Hardening**: Automated environment variable injection in the Vercel production build.

### Fixed
- Resolved "Failed to Load Dashboard" error caused by missing composite indices.

## [1.0.0] - 2026-04-05

### Added
- **Production Deployment**: Successfully deployed to Vercel.
- **SPA Routing**: Added `vercel.json` for standard Single Page Application routing.
- **Environment Management**: Configured production-level environment variables via build flags.
- **Vite Build Optimization**: Verified local and remote builds pass with React 19.

### Technical Details
- Implemented static hosting architecture.
- Bypassed legacy Express/SQLite backend in production in favor of direct Firestore communication.
- Secured Firestore keys using Vercel's build-time environment variables.

---

## [0.1.0] - 2026-04-05

### Added
- Initial project initialization (Pre-Audit)
- Integrated Firebase SDK
- Integrated Google Gemini AI (Optional)
