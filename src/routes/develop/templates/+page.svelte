<script>
  import { Cpu, HardDrive, Wifi, Database, Globe, Radio, Settings, Clock } from 'lucide-svelte';
  import { ArrowLeft } from 'lucide-svelte';

  const categoryColors = {
    'AI/ML': 'var(--text-secondary)',
    'Storage': 'var(--text-secondary)',
    'IoT': 'var(--text-secondary)',
    'DePIN': 'var(--text-secondary)',
    'Data Sovereignty': 'var(--text-secondary)',
    'Compute': 'var(--text-secondary)',
    'Custom': 'var(--text-tertiary)',
  };

  const templates = [
    {
      name: 'AI Inference Network',
      category: 'AI/ML',
      description: 'Deploy a distributed AI inference network. Miners contribute GPU compute to serve model predictions. Supports popular frameworks like PyTorch, TensorFlow, and ONNX Runtime out of the box.',
      consensus: 'Proof of Inference',
      rewardModel: 'Per-task',
      hardware: 'GPU required, 16GB+ VRAM',
      icon: Cpu,
      setupTime: '~15 min',
    },
    {
      name: 'Storage Provider',
      category: 'Storage',
      description: 'Create a decentralized storage network. Miners provide disk space and bandwidth for data availability. Includes erasure coding, replication policies, and retrieval market configuration.',
      consensus: 'Proof of Storage',
      rewardModel: 'Capacity-based',
      hardware: '1TB+ SSD, 100Mbps uplink',
      icon: HardDrive,
      setupTime: '~20 min',
    },
    {
      name: 'IoT Sensor Grid',
      category: 'IoT',
      description: 'Build a sensor data collection network. Miners run IoT gateways to aggregate and validate sensor readings. Supports LoRa, Zigbee, and BLE protocols with built-in data normalization.',
      consensus: 'Proof of Coverage',
      rewardModel: 'Data-volume',
      hardware: 'ARM/x86, LoRa gateway',
      icon: Radio,
      setupTime: '~15 min',
    },
    {
      name: 'CDN Relay Network',
      category: 'DePIN',
      description: 'Launch a content delivery relay network. Miners cache and serve content at the edge for low-latency access. Includes geographic load balancing, cache invalidation, and bandwidth metering.',
      consensus: 'Proof of Bandwidth',
      rewardModel: 'Bandwidth-based',
      hardware: '100Mbps+ uplink, 500GB cache',
      icon: Globe,
      setupTime: '~10 min',
    },
    {
      name: 'Data Validation',
      category: 'Data Sovereignty',
      description: 'Run a data validation and attestation network. Miners verify data integrity and generate cryptographic proofs. Built-in support for ZK circuits, Merkle proofs, and cross-chain attestation.',
      consensus: 'Proof of Correctness',
      rewardModel: 'Per-validation',
      hardware: '4-core CPU, 8GB RAM',
      icon: Database,
      setupTime: '~10 min',
    },
    {
      name: 'GPU Compute Pool',
      category: 'Compute',
      description: 'Create a shared GPU compute pool for rendering, training, and general-purpose parallel workloads. Job scheduler handles queue management, priority tiers, and automatic failover.',
      consensus: 'Proof of Work',
      rewardModel: 'Compute-time',
      hardware: 'GPU required, 8GB+ VRAM',
      icon: Cpu,
      setupTime: '~15 min',
    },
    {
      name: 'Coverage Network',
      category: 'DePIN',
      description: 'Deploy a wireless coverage network. Miners operate hotspots to extend network reach and earn coverage rewards. Includes hex-based coverage mapping and signal quality attestation.',
      consensus: 'Proof of Coverage',
      rewardModel: 'Coverage-based',
      hardware: 'Hotspot hardware, outdoor antenna',
      icon: Wifi,
      setupTime: '~20 min',
    },
    {
      name: 'Custom Network',
      category: 'Custom',
      description: 'Start from scratch with a blank template. Define your own consensus mechanism, reward model, hardware requirements, and proof verification pipeline. Full control over every parameter.',
      consensus: 'Custom',
      rewardModel: 'Custom',
      hardware: 'Configurable',
      icon: Settings,
      setupTime: '~30 min',
    },
  ];
</script>

<div class="min-h-screen animate-fadeIn px-6 pt-6 pb-12">
  <div style="max-width:900px;margin:0 auto">
    <!-- Back link -->
    <a
      href="/develop"
      class="btn-secondary"
      style="margin-bottom:16px;width:fit-content;text-decoration:none"
    >
      <ArrowLeft class="h-3 w-3" strokeWidth={1.5} style="margin-right:6px" />
      Back to Develop
    </a>

    <!-- Header -->
    <h1 style="font-size:20px;font-weight:600;color:var(--text-primary);letter-spacing:-0.015em;line-height:28px;margin:0">
      Templates & Starter Kits
    </h1>
    <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;line-height:20px">
      Bootstrap a mining network in minutes. Choose a template, customize in the wizard, and deploy.
    </p>

    <!-- Grid -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:24px">
      {#each templates as t (t.name)}
        <div
          style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:12px;transition:border-color 100ms ease-out,transform 100ms ease-out"
          onmouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onmouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <!-- Top: Icon + Name + Badge -->
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:8px;background:var(--accent-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <t.icon size={16} strokeWidth={1.5} style="color:var(--text-accent)" />
            </div>
            <div style="flex:1;min-width:0">
              <p style="font-size:14px;font-weight:600;color:var(--text-primary);letter-spacing:-0.006em;line-height:20px;margin:0">{t.name}</p>
            </div>
            <span style="display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:3px;font-size:11px;font-weight:500;background:var(--surface-2);color:var(--text-secondary);flex-shrink:0">
              {t.category}
            </span>
          </div>

          <!-- Description -->
          <p style="font-size:12px;color:var(--text-secondary);line-height:18px;margin:0">{t.description}</p>

          <!-- Key specs -->
          <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:var(--surface-2);border-radius:5px">
            {#each [
              { label: 'Consensus', value: t.consensus },
              { label: 'Rewards', value: t.rewardModel },
              { label: 'Min Hardware', value: t.hardware },
            ] as row}
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
                <span style="font-size:11px;color:var(--text-tertiary);flex-shrink:0">{row.label}</span>
                <span style="font-size:11px;color:var(--text-secondary);font-family:var(--font-mono);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{row.value}</span>
              </div>
            {/each}
          </div>

          <!-- Footer -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-tertiary)">
              <Clock size={12} strokeWidth={1.5} />
              {t.setupTime}
            </span>
            <a
              href="/develop/create?template={encodeURIComponent(t.name.replace(/ Network$| Pool$/, ''))}"
              class="btn-subscribe"
              style="text-decoration:none"
            >
              Use Template
            </a>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
