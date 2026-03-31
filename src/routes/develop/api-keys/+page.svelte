<script>
  import { ArrowLeft, Copy, RefreshCw, Eye, EyeOff, Key, Code, BookOpen } from 'lucide-svelte';

  const MOCK_API_KEY = 'sk_live_n3ct3r_a8f2c1d4e5b6789012345678abcdef90';
  const MASKED_KEY = 'sk_live_••••••••••••••••••••••••••••••••';

  const endpoints = [
    { method: 'POST', path: '/v1/jobs', description: 'Submit a new compute job to your project' },
    { method: 'GET', path: '/v1/proofs/{id}', description: 'Retrieve a proof by ID with verification status' },
    { method: 'POST', path: '/v1/proofs/submit', description: 'Submit a completed proof for on-chain verification' },
    { method: 'GET', path: '/v1/miners', description: 'List active miners subscribed to your project' },
  ];

  const jsCode = `import { NecterSDK } from '@necter/sdk';

const necter = new NecterSDK({
  apiKey: 'sk_live_••••••••',
  network: 'mainnet',
});

// Submit a job
const job = await necter.jobs.create({
  type: 'inference',
  payload: { model: 'llama-3.2', prompt: 'Hello world' },
  maxReward: 0.5,
});

// Wait for proof
const proof = await necter.proofs.get(job.proofId);
console.log(proof.status); // 'verified'`;

  const pyCode = `from necter import NecterClient

client = NecterClient(
    api_key="sk_live_••••••••",
    network="mainnet",
)

# Submit a job
job = client.jobs.create(
    type="inference",
    payload={"model": "llama-3.2", "prompt": "Hello world"},
    max_reward=0.5,
)

# Wait for proof
proof = client.proofs.get(job.proof_id)
print(proof.status)  # 'verified'`;

  let showKey = $state(false);
  let activeTab = $state('javascript');
</script>

<div class="min-h-screen animate-fadeIn" style="background: var(--surface-0);">
  <div style="max-width: 860px; margin: 0 auto;" class="px-4 md:px-6 pt-4 md:pt-6 pb-12">
    <!-- Header -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
      <a
        href="/develop"
        style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 5px; text-decoration: none;"
        class="hover:bg-[var(--surface-2)] transition-colors"
      >
        <ArrowLeft style="width: 16px; height: 16px; color: var(--text-tertiary);" strokeWidth={1.5} />
      </a>
      <div>
        <h1 style="font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); margin: 0;">
          API Keys & SDK
        </h1>
        <p style="font-size: 12px; color: var(--text-tertiary); margin: 2px 0 0;">
          Manage your API credentials and integrate with the Necter SDK
        </p>
      </div>
    </div>

    <!-- API Key Section -->
    <div
      style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-bottom: 16px;"
    >
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <Key style="width: 16px; height: 16px; color: var(--text-accent);" strokeWidth={1.5} />
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Live API Key</h2>
      </div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">
        Use this key to authenticate requests to the Necter API. Keep it secret. Do not expose it in client-side code.
      </p>

      <div
        style="display: flex; align-items: center; gap: 8px; background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 6px; padding: 10px 14px;"
      >
        <code
          style="flex: 1; font-size: 13px; font-family: var(--font-mono); color: var(--text-primary); letter-spacing: 0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
        >
          {showKey ? MOCK_API_KEY : MASKED_KEY}
        </code>
        <button
          onclick={() => { showKey = !showKey; }}
          style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-2); cursor: pointer; color: var(--text-secondary); flex-shrink: 0;"
          title={showKey ? 'Hide key' : 'Show key'}
        >
          {#if showKey}
            <EyeOff size={13} strokeWidth={1.5} />
          {:else}
            <Eye size={13} strokeWidth={1.5} />
          {/if}
        </button>
        <button
          onclick={() => {
            if (typeof navigator !== 'undefined') {
              navigator.clipboard.writeText(MOCK_API_KEY);
            }
          }}
          style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-2); cursor: pointer; color: var(--text-secondary); font-size: 12px; font-weight: 500; flex-shrink: 0;"
        >
          <Copy size={12} strokeWidth={1.5} />
          Copy
        </button>
        <button
          onclick={() => {}}
          style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 5px; border: 1px solid var(--border-default); background: var(--surface-2); cursor: pointer; color: var(--text-secondary); font-size: 12px; font-weight: 500; flex-shrink: 0;"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          Regenerate
        </button>
      </div>
    </div>

    <!-- SDK Quickstart -->
    <div
      style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px; margin-bottom: 16px;"
    >
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <Code style="width: 16px; height: 16px; color: var(--text-accent);" strokeWidth={1.5} />
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">SDK Quickstart</h2>
      </div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">
        Install the SDK and start submitting jobs in minutes.
      </p>

      <!-- Install commands -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        <div
          style="background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 6px; padding: 10px 14px;"
        >
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em;">
            JavaScript / TypeScript
          </span>
          <code style="display: block; font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); margin-top: 6px;">
            npm install @necter/sdk
          </code>
        </div>
        <div
          style="background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 6px; padding: 10px 14px;"
        >
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em;">
            Python
          </span>
          <code style="display: block; font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); margin-top: 6px;">
            pip install necter
          </code>
        </div>
      </div>

      <!-- Code tabs -->
      <div style="display: flex; gap: 0; margin-bottom: 0;">
        {#each ['javascript', 'python'] as tab}
          <button
            onclick={() => { activeTab = tab; }}
            style="height: 32px; padding: 0 14px; border-radius: 6px 6px 0 0; font-size: 12px; font-weight: 500; border: 1px solid var(--border-default); border-bottom: {activeTab === tab ? '1px solid var(--surface-0)' : '1px solid var(--border-default)'}; background: {activeTab === tab ? 'var(--surface-0)' : 'var(--surface-2)'}; color: {activeTab === tab ? 'var(--text-accent)' : 'var(--text-secondary)'}; cursor: pointer; margin-bottom: -1px; position: relative; z-index: {activeTab === tab ? 1 : 0};"
          >
            {tab === 'javascript' ? 'JavaScript' : 'Python'}
          </button>
        {/each}
      </div>
      <div
        style="background: var(--surface-0); border: 1px solid var(--border-default); border-radius: 0 6px 6px 6px; padding: 16px; overflow: auto;"
      >
        <pre
          style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary); line-height: 20px; margin: 0; white-space: pre;"
        >{activeTab === 'javascript' ? jsCode : pyCode}</pre>
      </div>
    </div>

    <!-- Endpoint Reference -->
    <div
      style="background: var(--surface-1); border: 1px solid var(--border-default); border-radius: 8px; padding: 20px;"
    >
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <BookOpen style="width: 16px; height: 16px; color: var(--text-accent);" strokeWidth={1.5} />
        <h2 style="font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0;">Endpoint Reference</h2>
      </div>
      <p style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px;">
        Base URL: <code style="font-family: var(--font-mono); color: var(--text-secondary);">https://api.necter.network</code>
      </p>

      <div style="border: 1px solid var(--border-default); border-radius: 6px; overflow: hidden;">
        <!-- Table header -->
        <div
          style="display: grid; grid-template-columns: 90px 200px 1fr; gap: 0; background: var(--surface-2); border-bottom: 1px solid var(--border-default); padding: 8px 14px;"
        >
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em;">
            Method
          </span>
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em;">
            Endpoint
          </span>
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.04em;">
            Description
          </span>
        </div>

        <!-- Table rows -->
        {#each endpoints as ep, idx}
          <div
            style="display: grid; grid-template-columns: 90px 200px 1fr; gap: 0; padding: 10px 14px; {idx < endpoints.length - 1 ? 'border-bottom: 1px solid var(--border-default);' : ''} align-items: center;"
          >
            <span
              style="font-size: 11px; font-weight: 600; font-family: var(--font-mono); color: {ep.method === 'POST' ? 'var(--text-accent)' : 'var(--success)'}; background: {ep.method === 'POST' ? 'var(--accent-subtle)' : 'rgba(76,183,130,0.12)'}; padding: 2px 6px; border-radius: 3px; width: fit-content;"
            >
              {ep.method}
            </span>
            <code style="font-size: 12px; font-family: var(--font-mono); color: var(--text-primary);">
              {ep.path}
            </code>
            <span style="font-size: 12px; color: var(--text-secondary);">
              {ep.description}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
