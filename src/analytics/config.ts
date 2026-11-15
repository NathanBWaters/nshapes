/**
 * Shared PostHog project configuration kept free of React Native imports so both
 * runtime bundles and Node CLI scripts (`scripts/posthog-dashboards.ts`) import it cleanly.
 */
export const POSTHOG_HOST = 'https://us.i.posthog.com';
export const POSTHOG_PROJECT_KEY = 'phc_mZNKMZuCMvvbDi6jacqGWYiGSKFQ8WHEZStwAneL3JKL';
export const POSTHOG_PROJECT_ID = 738615;
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
