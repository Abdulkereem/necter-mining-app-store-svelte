import { MockBackendStore } from '$lib/mock-backend/store';
import { readable } from 'svelte/store';
import type { MockBackendState } from '$lib/mock-backend/types';

// Single instance of the mock backend
const store = new MockBackendStore();

// Svelte readable store that updates when the backend state changes
export const backendState = readable<MockBackendState>(store.getState(), (set) => {
	set(store.getState());
	return store.subscribe(() => set(store.getState()));
});

// Export the store instance for calling actions
export const backend = store;

// Hydrate from localStorage (call this in onMount of root layout)
export function hydrateBackend() {
	store.hydrateFromStorageOnce();
}
