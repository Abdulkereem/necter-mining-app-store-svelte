<script lang="ts">
	import { ChevronLeft, Save } from 'lucide-svelte';
	import { backendState, backend } from '$lib/stores/backend';
	import { actor, wallet, showConnectModal } from '$lib/stores/wallet';
	import { showToast } from '$lib/stores/toast';

	const walletAddress = $derived($actor?.walletAddress ?? null);
	const enrollment = $derived(walletAddress ? backend.getDeveloperEnrollment(walletAddress) : null);

	let displayName = $state('');
	let email = $state('');
	let bio = $state('');
	let website = $state('');
	let location = $state('');
	let founded = $state('');
	let category = $state('');
	let tagsStr = $state('');
	let twitter = $state('');
	let discord = $state('');
	let github = $state('');
	let telegram = $state('');

	$effect(() => {
		if (!enrollment) return;
		displayName = enrollment.displayName ?? '';
		email = enrollment.email ?? '';
		bio = (enrollment as any).bio ?? '';
		website = enrollment.website ?? '';
		location = (enrollment as any).location ?? '';
		founded = (enrollment as any).founded ?? '';
		category = (enrollment as any).category ?? '';
		tagsStr = ((enrollment as any).tags ?? []).join(', ');
		twitter = (enrollment as any).socialLinks?.twitter ?? '';
		discord = (enrollment as any).socialLinks?.discord ?? '';
		github = (enrollment as any).socialLinks?.github ?? '';
		telegram = (enrollment as any).socialLinks?.telegram ?? '';
	});

	function handleSave() {
		if (!walletAddress) return;
		try {
			backend.saveDeveloperProfile({
				walletAddress,
				displayName,
				bio,
				website,
				location,
				founded,
				category,
				tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
				socialLinks: { twitter, discord, github, telegram },
			});
			showToast('Profile saved');
		} catch (e: any) {
			showToast(e?.message ?? 'Failed to save');
		}
	}

	const inp = 'w-full h-9 px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none';
	const label = 'text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5';
</script>

{#if !walletAddress}
	<div class="px-8 pt-8 pb-12 text-center" style="padding-top: 120px;">
		<p class="text-[13px] text-[var(--text-secondary)] mb-4">Connect a wallet to edit your developer profile.</p>
		<button class="btn-pill" onclick={() => $showConnectModal = true}>Connect Wallet</button>
	</div>
{:else}
	<div class="px-8 pt-8 pb-12" style="max-width: 720px; margin: 0 auto;">
		<a href="/develop" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-5 no-underline">
			<ChevronLeft class="h-3.5 w-3.5" />
			Back to Developer Portal
		</a>

		<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-8">Edit Profile</h1>

		<div class="space-y-6">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class={label}>Display Name</label>
					<input class={inp} bind:value={displayName} />
				</div>
				<div>
					<label class={label}>Email</label>
					<input class={inp} type="email" bind:value={email} />
				</div>
			</div>

			<div>
				<label class={label}>Bio</label>
				<textarea class="{inp} h-auto py-2" rows="3" bind:value={bio}></textarea>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class={label}>Website</label>
					<input class={inp} bind:value={website} placeholder="https://" />
				</div>
				<div>
					<label class={label}>Location</label>
					<input class={inp} bind:value={location} />
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class={label}>Founded</label>
					<input class={inp} bind:value={founded} placeholder="e.g. 2024" />
				</div>
				<div>
					<label class={label}>Category</label>
					<input class={inp} bind:value={category} placeholder="e.g. DePIN, AI/ML" />
				</div>
			</div>

			<div>
				<label class={label}>Tags (comma separated)</label>
				<input class={inp} bind:value={tagsStr} placeholder="DePIN, IoT, Wireless" />
			</div>

			<div>
				<h3 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">Social Links</h3>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class={label}>Twitter</label>
						<input class={inp} bind:value={twitter} placeholder="@handle" />
					</div>
					<div>
						<label class={label}>Discord</label>
						<input class={inp} bind:value={discord} />
					</div>
					<div>
						<label class={label}>GitHub</label>
						<input class={inp} bind:value={github} />
					</div>
					<div>
						<label class={label}>Telegram</label>
						<input class={inp} bind:value={telegram} />
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
				<a href="/develop" class="btn-secondary no-underline" style="height: 38px; padding: 0 16px; display: inline-flex; align-items: center;">Cancel</a>
				<button onclick={handleSave} class="btn-subscribe" style="height: 38px; padding: 0 20px;">
					<Save class="h-3.5 w-3.5" /> Save Profile
				</button>
			</div>
		</div>
	</div>
{/if}
