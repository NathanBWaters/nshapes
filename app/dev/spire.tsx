/**
 * Legacy route alias (/dev/spire → /dev/summit).
 * Re-exports DevSummit directly so all existing query-param URLs (?start, ?room, ?seed, etc.)
 * and E2E suites work seamlessly without dropping params on redirect.
 */
export { default } from './summit';
