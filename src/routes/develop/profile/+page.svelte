<script lang="ts">
	import { ChevronLeft, Save, Upload, Image as ImageIcon } from 'lucide-svelte';
	import toast from 'svelte-french-toast';
	import { hub } from '$lib/api/hub';
	import { errorMessage } from '$lib/api/http';
	import { useQuery } from '$lib/api/query.svelte';
	import type { DeveloperProfileInput } from '$lib/api/types';
	import { signedIn } from '$lib/stores/wallet';
	import { uploadImage, IMAGE_ACCEPT } from '$lib/develop/upload';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import LoadingBlock from '$lib/components/common/LoadingBlock.svelte';
	import ErrorState from '$lib/components/common/ErrorState.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

	const devQ = useQuery(() => hub.myDeveloper(), { enabled: () => $signedIn });
	const developer = $derived(devQ.data ?? null);

	let displayName = $state('');
	let email = $state('');
	let bio = $state('');
	let website = $state('');
	let location = $state('');
	let logo = $state('');
	let twitter = $state('');
	let discord = $state('');
	let github = $state('');
	let telegram = $state('');
	let saving = $state(false);
	let uploading = $state(false);
	let hydratedFor: string | null = null;

	$effect(() => {
		const d = developer;
		if (!d || hydratedFor === d.address) return;
		hydratedFor = d.address;
		displayName = d.display_name ?? '';
		email = d.email ?? '';
		bio = d.bio ?? '';
		website = d.website ?? '';
		location = d.location ?? '';
		logo = d.logo ?? '';
		twitter = d.social?.twitter ?? '';
		discord = d.social?.discord ?? '';
		github = d.social?.github ?? '';
		telegram = d.social?.telegram ?? '';
	});

	const URL_RE = /^https?:\/\/\S+$/;
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const problems = $derived({
		displayName: !displayName.trim() ? 'Required' : displayName.length > 64 ? 'At most 64 characters' : null,
		email: email.trim() && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : null,
		website: website.trim() && !URL_RE.test(website.trim()) ? 'Enter a full URL starting with https://' : null,
		bio: bio.length > 2000 ? 'At most 2000 characters' : null,
		location: location.length > 64 ? 'At most 64 characters' : null
	});
	const valid = $derived(Object.values(problems).every((p) => !p));

	async function handleLogo(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		uploading = true;
		try {
			logo = await uploadImage(f);
		} catch (err) {
			toast.error(errorMessage(err));
		} finally {
			uploading = false;
		}
	}

	async function handleSave() {
		if (!valid) return;
		saving = true;
		const social: NonNullable<DeveloperProfileInput['social']> = {};
		if (twitter.trim()) social.twitter = twitter.trim();
		if (discord.trim()) social.discord = discord.trim();
		if (github.trim()) social.github = github.trim();
		if (telegram.trim()) social.telegram = telegram.trim();
		const body: DeveloperProfileInput = {
			display_name: displayName.trim(),
			bio: bio.trim(),
			location: location.trim(),
			social,
			...(email.trim() ? { email: email.trim() } : {}),
			...(website.trim() ? { website: website.trim() } : {}),
			...(logo ? { logo } : {})
		};
		try {
			devQ.set(await hub.putMyDeveloper(body));
			toast.success('Profile saved');
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			saving = false;
		}
	}

	const inp = 'w-full h-9 px-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--surface-0)] text-[var(--text-primary)] text-[13px] outline-none';
	const label = 'text-[12px] font-medium text-[var(--text-secondary)] block mb-1.5';
	const err = 'text-[11px] text-[var(--error)] mt-1';
</script>

<svelte:head>
	<title>Developer Profile — Necter Mining App Store</title>
</svelte:head>

<SignInGate title="Developer profile" description="Sign in with your wallet to edit your public developer profile." illustration="bee">
	<div class="px-4 md:px-8 pt-8 pb-12" style="max-width: 720px; margin: 0 auto;">
		<a href="/develop" class="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-5 no-underline">
			<ChevronLeft class="h-3.5 w-3.5" />
			Back to Developer Portal
		</a>

		<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight mb-8">Edit Profile</h1>

		{#if devQ.loading && !devQ.data}
			<LoadingBlock rows={5} height="44px" />
		{:else if devQ.error}
			<ErrorState error={devQ.error} retry={devQ.refresh} />
		{:else if !developer}
			<EmptyState illustration="bee" title="You're not enrolled yet" description="Enroll as a developer first; your profile is created with your enrollment.">
				<a href="/develop" class="btn-subscribe no-underline">Enroll</a>
			</EmptyState>
		{:else}
			<div class="space-y-6">
				<div class="flex items-center gap-4">
					<div class="w-16 h-16 rounded-[14px] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden shrink-0" style="border:{logo ? 'none' : '2px dashed var(--border-default)'}">
						{#if logo}
							<img src={logo} alt="Logo" width="64" height="64" class="w-16 h-16 rounded-[14px] object-cover" />
						{:else}
							<ImageIcon size={24} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
						{/if}
					</div>
					<div>
						<label class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium cursor-pointer bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)]">
							<Upload size={12} strokeWidth={1.5} /> {uploading ? 'Uploading…' : 'Upload Logo'}
							<input type="file" accept={IMAGE_ACCEPT} onchange={handleLogo} class="hidden" disabled={uploading} />
						</label>
						<p class="text-[11px] text-[var(--text-tertiary)] mt-1">PNG, JPEG or WebP, up to 2 MB</p>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class={label} for="dp-name">Display Name</label>
						<input id="dp-name" class={inp} maxlength="64" bind:value={displayName} />
						{#if problems.displayName}<p class={err}>{problems.displayName}</p>{/if}
					</div>
					<div>
						<label class={label} for="dp-email">Email <span class="text-[var(--text-tertiary)] font-normal">(private)</span></label>
						<input id="dp-email" class={inp} type="email" bind:value={email} />
						{#if problems.email}<p class={err}>{problems.email}</p>{/if}
					</div>
				</div>

				<div>
					<label class={label} for="dp-bio">Bio</label>
					<textarea id="dp-bio" class="{inp} h-auto py-2" rows="3" maxlength="2000" bind:value={bio}></textarea>
					{#if problems.bio}<p class={err}>{problems.bio}</p>{/if}
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class={label} for="dp-web">Website</label>
						<input id="dp-web" class={inp} bind:value={website} placeholder="https://" />
						{#if problems.website}<p class={err}>{problems.website}</p>{/if}
					</div>
					<div>
						<label class={label} for="dp-loc">Location</label>
						<input id="dp-loc" class={inp} maxlength="64" bind:value={location} />
						{#if problems.location}<p class={err}>{problems.location}</p>{/if}
					</div>
				</div>

				<div>
					<h3 class="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.04em] mb-3">Social Links</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class={label} for="dp-tw">Twitter</label>
							<input id="dp-tw" class={inp} bind:value={twitter} placeholder="@handle" />
						</div>
						<div>
							<label class={label} for="dp-dc">Discord</label>
							<input id="dp-dc" class={inp} bind:value={discord} />
						</div>
						<div>
							<label class={label} for="dp-gh">GitHub</label>
							<input id="dp-gh" class={inp} bind:value={github} />
						</div>
						<div>
							<label class={label} for="dp-tg">Telegram</label>
							<input id="dp-tg" class={inp} bind:value={telegram} />
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-3 pt-4 border-t border-[var(--border-default)]">
					<a href="/develop" class="btn-secondary no-underline" style="height: 38px; padding: 0 16px; display: inline-flex; align-items: center;">Cancel</a>
					<button onclick={handleSave} class="btn-subscribe" style="height: 38px; padding: 0 20px;" disabled={!valid || saving || uploading}>
						<Save class="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save Profile'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</SignInGate>
