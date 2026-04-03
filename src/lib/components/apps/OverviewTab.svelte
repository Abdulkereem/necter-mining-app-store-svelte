<script lang="ts">
	import {
		CheckCircle2,
		Award,
		Lock,
		Eye,
		Cpu,
		Wifi,
		MapPin,
		Database,
		History,
	} from 'lucide-svelte';

	const variantClasses: Record<string, string> = {
		neutral: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
		accent: 'bg-[var(--accent-subtle)] text-[var(--text-accent)]',
		success: 'bg-[rgba(76,183,130,0.12)] text-[var(--success)]',
		warning: 'bg-[rgba(242,153,74,0.12)] text-[var(--warning)]',
		error: 'bg-[rgba(235,87,87,0.12)] text-[var(--error)]',
		info: 'bg-[rgba(110,159,255,0.12)] text-[var(--info)]',
	};

	const versionHistory = [
		{ version: 'v2.1.0', date: 'Jan 28, 2026', notes: 'Performance improvements, bug fixes, and new proof verification algorithm' },
		{ version: 'v2.0.5', date: 'Jan 15, 2026', notes: 'Security patch for consensus mechanism' },
		{ version: 'v2.0.0', date: 'Dec 10, 2025', notes: 'Major update: New reward distribution model, improved SLA tracking' },
		{ version: 'v1.9.2', date: 'Nov 22, 2025', notes: 'Bug fixes and stability improvements' },
	];

	const privacyLabels = {
		dataCollected: [
			{ type: 'Hardware Specs', purpose: 'Task Assignment', icon: 'cpu' as const },
			{ type: 'Network Stats', purpose: 'Performance Monitoring', icon: 'wifi' as const },
			{ type: 'Location (Region)', purpose: 'Network Optimization', icon: 'map-pin' as const },
			{ type: 'Wallet Address', purpose: 'Rewards Distribution', icon: 'database' as const },
		],
		dataNotCollected: ['Personal Identity', 'Browsing History', 'Contacts'],
		dataLinkedToYou: ['Wallet Address', 'Mining Performance'],
		dataNotLinkedToYou: ['Hardware Benchmarks', 'Network Latency'],
	};

	let {
		app,
		profile,
		trustScore,
	}: {
		app: any;
		profile: any;
		trustScore: any;
	} = $props();
</script>

<div class="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
	<!-- Description -->
	<div
		class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2 overflow-hidden"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			Description
		</p>
		<p class="text-[13px] text-[var(--text-secondary)] leading-5 m-0 break-words">{app.description}</p>
	</div>

	<!-- Network Features -->
	<div
		class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 overflow-hidden"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			Network Features
		</p>
		<ul class="list-none p-0 m-0 flex flex-col gap-2">
			{#each (app.features ?? []).slice(0, 6) as feature}
				<li
					class="flex items-start gap-2 text-[13px] text-[var(--text-secondary)] leading-[18px]"
				>
					<CheckCircle2 size={13} strokeWidth={1.5} class="text-[var(--success)] shrink-0 mt-[3px]" />
					<span class="break-words">{feature}</span>
				</li>
			{/each}
		</ul>
	</div>

	<!-- Technical Details -->
	<div
		class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 overflow-hidden"
	>
		<p class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3">
			Technical Details
		</p>
		<div class="flex flex-col gap-2.5">
			{#each [
				{ label: 'Consensus', value: profile?.consensusMechanism || app.consensusMechanism },
				{ label: 'Verification', value: profile?.verificationMethod || app.verificationMethod },
				{ label: 'Reward Model', value: profile?.rewardModel || app.rewardModel },
			] as row}
				<div class="flex justify-between items-start gap-3">
					<span class="text-[12px] text-[var(--text-tertiary)] flex-shrink-0">{row.label}</span>
					<span
						class="text-[12px] md:text-[13px] text-[var(--text-primary)] font-medium text-right break-words min-w-0"
						>{row.value}</span
					>
				</div>
			{/each}
		</div>
	</div>

	<!-- Trust Score -->
	{#if trustScore}
		<div
			class="bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] p-4 md:p-5 md:col-span-2"
		>
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<Award size={14} strokeWidth={1.5} class="text-[var(--text-accent)]" />
					<p
						class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-0"
					>
						Trust Score
					</p>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-[20px] font-semibold font-mono text-[var(--text-primary)]">
						{trustScore.overallScore}<span class="text-[13px] text-[var(--text-tertiary)] font-normal"
							>/100</span
						>
					</span>
					{#if trustScore.trendingDirection === 'improving'}
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.success}"
							>Improving</span
						>
					{/if}
					{#if trustScore.trendingDirection === 'declining'}
						<span
							class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.error}"
							>Declining</span
						>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				{#each [
					{ label: 'Developer Track Record', value: trustScore.developerTrackRecord },
					{ label: 'Network Security', value: trustScore.networkSecurity },
					{ label: 'Consensus Health', value: trustScore.consensusHealth },
					{ label: 'Community Votes', value: trustScore.communityVotes },
				] as item}
					<div>
						<div class="flex justify-between mb-[6px]">
							<span class="text-[12px] text-[var(--text-tertiary)]">{item.label}</span>
							<span class="text-[12px] font-mono text-[var(--text-primary)] font-medium"
								>{item.value}%</span
							>
						</div>
						<div class="h-[3px] bg-[var(--surface-3)] rounded-full overflow-hidden">
							<div
								class="h-full rounded-full"
								style="width: {item.value}%; background: {item.value >= 80
									? 'var(--success)'
									: item.value >= 60
										? 'var(--warning)'
										: 'var(--error)'};"
							></div>
						</div>
					</div>
				{/each}
			</div>

			{#if trustScore.redFlags.length > 0}
				<div
					class="mt-4 bg-[rgba(235,87,87,0.08)] border border-[rgba(235,87,87,0.20)] rounded-[6px] px-3 py-[10px]"
				>
					<p
						class="text-[11px] font-semibold text-[var(--error)] mb-[6px] uppercase tracking-[0.04em]"
					>
						Warnings
					</p>
					{#each trustScore.redFlags as flag}
						<p class="text-[12px] text-[var(--error)] opacity-85">· {flag}</p>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Privacy & Attestation (collapsible) -->
	<details
		class="md:col-span-2 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
	>
		<summary
			class="flex items-center gap-2 px-4 md:px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
		>
			<Lock size={14} strokeWidth={1.5} class="text-[var(--text-accent)]" />
			<span class="text-[14px] font-semibold text-[var(--text-primary)]">Privacy & Attestation</span>
		</summary>
		<div class="px-4 md:px-5 pb-5">
			<p class="text-[13px] text-[var(--text-secondary)] mb-6 leading-5">
				The developer indicated that this app's privacy practices may include handling of data as described
				below.
			</p>

			<p
				class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
			>
				Data Used to Track You
			</p>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
				{#each privacyLabels.dataCollected as item}
					<div
						class="flex items-start gap-[10px] bg-[var(--surface-2)] border border-[var(--border-default)] rounded-[8px] px-[14px] py-3"
					>
						{#if item.icon === 'cpu'}
							<Cpu
								size={14}
								strokeWidth={1.5}
								class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
							/>
						{:else if item.icon === 'wifi'}
							<Wifi
								size={14}
								strokeWidth={1.5}
								class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
							/>
						{:else if item.icon === 'map-pin'}
							<MapPin
								size={14}
								strokeWidth={1.5}
								class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
							/>
						{:else if item.icon === 'database'}
							<Database
								size={14}
								strokeWidth={1.5}
								class="text-[var(--text-tertiary)] shrink-0 mt-[1px]"
							/>
						{/if}
						<div>
							<p class="text-[13px] font-medium text-[var(--text-primary)]">{item.type}</p>
							<p class="text-[12px] text-[var(--text-tertiary)] mt-0.5">{item.purpose}</p>
						</div>
					</div>
				{/each}
			</div>

			<hr class="border-0 border-t border-[var(--border-default)] my-6" />

			<p
				class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
			>
				Data Linked to You
			</p>
			<div class="flex flex-wrap gap-[6px] mb-6">
				{#each privacyLabels.dataLinkedToYou as item}
					<span
						class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.warning}"
					>
						<Eye size={10} class="mr-1" />
						{item}
					</span>
				{/each}
			</div>

			<p
				class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
			>
				Data Not Linked to You
			</p>
			<div class="flex flex-wrap gap-[6px] mb-6">
				{#each privacyLabels.dataNotLinkedToYou as item}
					<span
						class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.neutral}"
						>{item}</span
					>
				{/each}
			</div>

			<hr class="border-0 border-t border-[var(--border-default)] my-6" />

			<p
				class="text-[10px] font-semibold tracking-[0.04em] uppercase text-[var(--text-tertiary)] mb-3"
			>
				Data Not Collected
			</p>
			<div class="flex flex-wrap gap-[6px]">
				{#each privacyLabels.dataNotCollected as item}
					<span
						class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.success}"
					>
						<CheckCircle2 size={10} class="mr-1" />
						{item}
					</span>
				{/each}
			</div>
		</div>
	</details>

	<!-- Version History (collapsible) -->
	<details
		class="md:col-span-2 bg-[var(--surface-1)] border border-[var(--border-default)] rounded-[8px] overflow-hidden"
	>
		<summary
			class="flex items-center gap-2 px-4 md:px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
		>
			<History size={14} strokeWidth={1.5} class="text-[var(--text-tertiary)]" />
			<span class="text-[14px] font-semibold text-[var(--text-primary)]">Version History</span>
		</summary>
		<div class="px-4 md:px-5 pb-5">
			<div class="relative">
				<div class="absolute bg-[var(--border-default)] left-[7px] top-[8px] bottom-[8px] w-px"></div>
				<div class="flex flex-col gap-6">
					{#each versionHistory as version, index}
						<div class="pl-7 relative">
							<div
								class="absolute rounded-full"
								style="left: 0; top: 4px; width: 15px; height: 15px; background: {index === 0
									? 'var(--accent-base)'
									: 'var(--surface-3)'}; border: 2px solid {index === 0
									? 'var(--accent-base)'
									: 'var(--border-strong)'};"
							></div>
							<div class="flex items-center gap-[10px] mb-[6px]">
								<span class="text-[13px] font-semibold text-[var(--text-primary)] font-mono"
									>{version.version}</span
								>
								<span class="text-[12px] text-[var(--text-tertiary)]">{version.date}</span>
								{#if index === 0}
									<span
										class="inline-flex items-center h-5 px-[6px] rounded-[3px] text-[11px] font-medium whitespace-nowrap {variantClasses.accent}"
										>Latest</span
									>
								{/if}
							</div>
							<p class="text-[13px] text-[var(--text-secondary)] leading-5">{version.notes}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</details>
</div>
