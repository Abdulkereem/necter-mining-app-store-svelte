<script lang="ts">
	import toast from 'svelte-french-toast';
	import { User, Wallet, Bell, Target, BookUser, ExternalLink, Trash2, LogOut } from 'lucide-svelte';
	import { errorMessage } from '$lib/api/http';
	import { session } from '$lib/api/session';
	import type { Preferences } from '$lib/api/types';
	import { wallet, disconnectWallet } from '$lib/stores/wallet';
	import { preferences, updatePreferences, me } from '$lib/stores/account';
	import { balances, nectaOf } from '$lib/stores/balances';
	import { descriptor } from '$lib/stores/network';
	import { formatAmount, formatDateTime, formatUnitsExact, parseUnits, shortAddress } from '$lib/format';
	import { minerAvatarDataUri } from '$lib/miner-avatar';
	import { NOTIFIABLE_EVENTS } from '$lib/components/mining/labels';
	import { Card } from '$lib/components/ui';
	import SignInGate from '$lib/components/common/SignInGate.svelte';
	import CopyText from '$lib/components/common/CopyText.svelte';
	import MinerWalletCard from '$lib/components/wallet/MinerWalletCard.svelte';
	import { APP_MODE } from '$lib/config';

	type Tab = 'profile' | 'wallet' | 'notifications' | 'addresses' | 'goal';
	const tabs: { id: Tab; label: string; icon: typeof User }[] = [
		{ id: 'profile', label: 'Profile', icon: User },
		{ id: 'wallet', label: 'Wallet & session', icon: Wallet },
		{ id: 'notifications', label: 'Notifications', icon: Bell },
		{ id: 'addresses', label: 'Address book', icon: BookUser },
		{ id: 'goal', label: 'Earnings goal', icon: Target }
	];
	let activeTab = $state<Tab>('profile');
	let saving = $state(false);

	// Local editable copies, reset whenever preferences reload.
	let displayName = $state('');
	let newAddress = $state('');
	let newLabel = $state('');
	let goalAmount = $state('');
	let goalPeriod = $state<'day' | 'week' | 'month'>('month');
	$effect(() => {
		const p = $preferences;
		if (!p) return;
		displayName = p.display_name ?? '';
		goalAmount = p.earnings_goal?.amount ? formatUnitsExact(p.earnings_goal.amount, 18) : '';
		goalPeriod = p.earnings_goal?.period ?? 'month';
	});

	const necta = $derived(nectaOf($balances));
	const notif = $derived($preferences?.notifications ?? {});
	const groups = ['mining', 'earnings', 'security', 'developer'] as const;
	const groupLabel: Record<string, string> = { mining: 'Mining', earnings: 'Earnings', security: 'Slashing & security', developer: 'Developer' };

	async function save(patch: Partial<Preferences>, ok = 'Saved') {
		saving = true;
		try {
			await updatePreferences(patch);
			toast.success(ok);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			saving = false;
		}
	}

	function addAddress() {
		const a = newAddress.trim().toLowerCase();
		if (!/^0x[0-9a-f]{40}$/.test(a)) return toast.error('Enter a valid 0x address');
		const list = $preferences?.saved_addresses ?? [];
		if (list.some((x) => x.address === a)) return toast.error('Already saved');
		void save({ saved_addresses: [...list, { address: a, label: newLabel.trim().slice(0, 64) }] }, 'Address saved');
		newAddress = '';
		newLabel = '';
	}

	function saveGoal() {
		if (!goalAmount.trim()) return void save({ earnings_goal: null }, 'Goal cleared');
		let wei: string;
		try {
			wei = parseUnits(goalAmount, 18);
		} catch (e) {
			return toast.error(errorMessage(e));
		}
		const token = $descriptor?.chain.contracts.necta ?? $descriptor?.chain.token;
		void save({ earnings_goal: { token, amount: wei, period: goalPeriod } }, 'Goal saved');
	}

	const inputCls =
		'w-full h-[34px] px-3 rounded-[6px] bg-[var(--surface-0)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-base)]';
</script>

<svelte:head><title>Settings — Necter Mining App Store</title></svelte:head>

<SignInGate title="Settings" description="Sign in to manage your profile, notifications and saved addresses. Preferences are stored per wallet on the network.">
	<div class="animate-fadeIn px-4 md:px-6 pt-4 md:pt-6 pb-12">
		<div class="max-w-[960px] mx-auto">
			<div class="mb-6">
				<h1 class="text-[20px] font-semibold text-[var(--text-primary)] tracking-tight">Settings</h1>
				<p class="text-[13px] text-[var(--text-secondary)] mt-1 hidden md:block">Your profile, wallet session and preferences.</p>
			</div>
			<div class="flex flex-col md:flex-row gap-4 md:gap-6">
				<nav class="flex md:flex-col w-full md:w-[180px] flex-shrink-0 gap-0.5 md:sticky md:top-6 md:self-start overflow-x-auto">
					{#each tabs as tab (tab.id)}
						{@const Icon = tab.icon}
						<button
							type="button"
							class="flex items-center gap-2.5 md:w-full px-3 py-2 text-[13px] rounded-[6px] text-left transition-colors whitespace-nowrap flex-shrink-0 border-none cursor-pointer {activeTab === tab.id ? 'bg-[var(--accent-subtle)] text-[var(--text-accent)] font-medium' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'}"
							onclick={() => (activeTab = tab.id)}
						>
							<Icon class="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
							{tab.label}
						</button>
					{/each}
				</nav>

				<div class="flex-1 min-w-0 space-y-5">
					{#if activeTab === 'profile'}
						<Card>
							<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Identity</h2>
							<div class="flex items-start gap-4 mb-5">
								<img src={minerAvatarDataUri($wallet?.address ?? '')} alt="" class="w-[64px] h-[64px] hex-avatar flex-shrink-0" />
								<div class="min-w-0 flex-1 pt-1">
									<p class="text-[14px] font-semibold text-[var(--text-primary)] truncate">{displayName || 'Unnamed miner'}</p>
									<p class="text-[11px] text-[var(--text-tertiary)] font-mono truncate mb-2">{$wallet?.address}</p>
									<a href="/profiles/{$wallet?.address}" class="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-accent)] hover:underline no-underline">
										View public profile <ExternalLink size={10} strokeWidth={1.5} />
									</a>
								</div>
							</div>
							<label for="dn" class="text-[12px] text-[var(--text-secondary)] block mb-1.5">Display name (public, max 32 characters)</label>
							<div class="flex gap-2">
								<input id="dn" maxlength="32" bind:value={displayName} class={inputCls} placeholder="e.g. hive-runner" />
								<button type="button" class="btn-subscribe" disabled={saving} onclick={() => save({ display_name: displayName.trim() || null })}>Save</button>
							</div>
						</Card>
						{#if $me}
							<Card>
								<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Account</h2>
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
									<div><p class="text-[var(--text-tertiary)]">Roles</p><p class="mt-0.5 capitalize">{$me.roles.length ? $me.roles.join(', ') : '—'}</p></div>
									<div><p class="text-[var(--text-tertiary)]">Devices</p><p class="mt-0.5 font-mono">{$me.devices ?? 0}</p></div>
									<div><p class="text-[var(--text-tertiary)]">Subscriptions</p><p class="mt-0.5 font-mono">{$me.subscriptions ?? 0}</p></div>
									<div><p class="text-[var(--text-tertiary)]">Developer</p><p class="mt-0.5">{$me.developer ? $me.developer.enrollment?.status ?? 'enrolled' : 'Not enrolled'}</p></div>
								</div>
							</Card>
						{/if}
					{:else if activeTab === 'wallet'}
						<Card>
							<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-4 tracking-[0.01em]">Connected wallet</h2>
							<div class="space-y-2 text-[13px]">
								<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Address</span>{#if $wallet}<CopyText value={$wallet.address} />{/if}</div>
								<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Wallet</span><span>{$wallet?.connector.name}</span></div>
								<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Network</span><span>{$wallet?.chainId === 11155111 ? 'Ethereum Sepolia' : $wallet?.chainId ? `Chain ${$wallet.chainId}` : '—'}</span></div>
								<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">NECTA</span><span class="font-mono">{necta ? formatAmount(necta.amount, 18, { maxFrac: 4 }) : '—'}</span></div>
								<div class="flex justify-between gap-3"><span class="text-[var(--text-secondary)]">Session expires</span><span>{$session ? formatDateTime($session.expires_at) : 'Miner session'}</span></div>
							</div>
							<button type="button" class="btn-secondary mt-5 inline-flex items-center gap-1.5" onclick={() => disconnectWallet()}><LogOut class="h-3.5 w-3.5" /> Sign out & disconnect</button>
						</Card>
						{#if APP_MODE === 'local'}
							<MinerWalletCard />
						{/if}
					{:else if activeTab === 'notifications'}
						<Card>
							<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Notification preferences</h2>
							<p class="text-[12px] text-[var(--text-tertiary)] mb-4">Choose which account events appear as notifications. The activity timeline always keeps everything.</p>
							{#each groups as g (g)}
								<p class="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-tertiary)] mt-4 mb-2">{groupLabel[g]}</p>
								<div class="divide-y divide-[var(--border-default)]">
									{#each NOTIFIABLE_EVENTS.filter((e) => e.group === g) as ev (ev.type)}
										{@const on = notif[ev.type] !== false}
										<label class="flex items-center justify-between py-2 cursor-pointer">
											<span class="text-[13px] text-[var(--text-primary)]">{ev.label}</span>
											<input type="checkbox" checked={on} disabled={saving} onchange={() => save({ notifications: { ...notif, [ev.type]: !on } })} class="h-4 w-4 accent-[var(--accent-base)]" />
										</label>
									{/each}
								</div>
							{/each}
						</Card>
					{:else if activeTab === 'addresses'}
						<Card>
							<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Address book</h2>
							<p class="text-[12px] text-[var(--text-tertiary)] mb-4">Labels for addresses you use often. Rewards and collateral always go to the miner wallet that owns the subscription.</p>
							<div class="space-y-2 mb-4">
								{#each $preferences?.saved_addresses ?? [] as a (a.address)}
									<div class="flex items-center justify-between gap-3 p-3 rounded-[6px] bg-[var(--surface-2)]">
										<div class="min-w-0"><p class="text-[13px] font-medium">{a.label || 'Unlabeled'}</p><p class="text-[11px] font-mono text-[var(--text-tertiary)]">{shortAddress(a.address)}</p></div>
										<button type="button" aria-label="Remove" class="bg-transparent border-none cursor-pointer p-1" disabled={saving} onclick={() => save({ saved_addresses: ($preferences?.saved_addresses ?? []).filter((x) => x.address !== a.address) }, 'Removed')}><Trash2 class="h-4 w-4 text-[var(--text-tertiary)]" /></button>
									</div>
								{:else}
									<p class="text-[13px] text-[var(--text-secondary)]">No saved addresses.</p>
								{/each}
							</div>
							<div class="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2">
								<input bind:value={newAddress} placeholder="0x…" class="{inputCls} font-mono" />
								<input bind:value={newLabel} maxlength="64" placeholder="Label" class={inputCls} />
								<button type="button" class="btn-subscribe" disabled={saving || !newAddress} onclick={addAddress}>Add</button>
							</div>
						</Card>
					{:else}
						<Card>
							<h2 class="text-[13px] font-semibold text-[var(--text-primary)] mb-1 tracking-[0.01em]">Earnings goal</h2>
							<p class="text-[12px] text-[var(--text-tertiary)] mb-4">Shown on My Mining as progress towards a NECTA target.</p>
							<div class="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
								<input bind:value={goalAmount} inputmode="decimal" placeholder="Amount in NECTA (empty = no goal)" class="{inputCls} font-mono" />
								<select bind:value={goalPeriod} class={inputCls}>
									<option value="day">per day</option>
									<option value="week">per week</option>
									<option value="month">per month</option>
								</select>
								<button type="button" class="btn-subscribe" disabled={saving} onclick={saveGoal}>Save goal</button>
							</div>
						</Card>
					{/if}
				</div>
			</div>
		</div>
	</div>
</SignInGate>
