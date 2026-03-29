import toast from 'svelte-french-toast';

export function showToast(title: string, description?: string) {
	toast.success(description ? `${title}: ${description}` : title, {
		style: 'background: var(--surface-2); color: var(--text-primary); border: 1px solid var(--border-default); font-size: 13px;',
		duration: 3000,
	});
}

export function showError(title: string, description?: string) {
	toast.error(description ? `${title}: ${description}` : title, {
		style: 'background: var(--surface-2); color: var(--error); border: 1px solid var(--border-default); font-size: 13px;',
		duration: 4000,
	});
}

export { toast };
