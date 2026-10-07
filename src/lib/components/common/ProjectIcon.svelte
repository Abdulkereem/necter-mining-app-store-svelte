<script lang="ts">
	import { appIconDataUri } from '$lib/app-icon';
	import { categoryShort } from '$lib/format';

	let {
		project,
		size = 40,
		rounded = '10px',
		class: className = ''
	}: {
		project: { project_id: string; name: string; category?: string | null; icon?: string | null };
		size?: number;
		rounded?: string;
		class?: string;
	} = $props();

	let failed = $state(false);
	const fallback = $derived(appIconDataUri({ id: project.project_id, name: project.name, category: categoryShort(project.category) }));
	// Only https assets (Hub asset store) and data: images are rendered; anything else falls back.
	const safe = $derived(
		!!project.icon && (project.icon.startsWith('https://') || project.icon.startsWith('data:image/') || project.icon.startsWith('/'))
	);
	$effect(() => {
		void project.icon;
		failed = false;
	});
</script>

<img
	src={safe && !failed ? project.icon : fallback}
	alt=""
	width={size}
	height={size}
	style="width:{size}px;height:{size}px;border-radius:{rounded}"
	class="object-cover flex-shrink-0 bg-[var(--surface-3)] {className}"
	loading="lazy"
	referrerpolicy="no-referrer"
	onerror={() => (failed = true)}
/>
