// The store is a client-rendered app in both build targets (hosted web store and the miner-embedded local
// build): all data comes from the Hub API in the browser (PLATFORM.md §k — the store has no API of its own).
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
