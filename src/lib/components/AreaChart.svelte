<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	Chart.register(...registerables);

	let { data = [], labels = [], color = '#FFBF00', height = 200 }: {
		data: number[];
		labels: string[];
		color?: string;
		height?: number;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [{
					data,
					borderColor: color,
					backgroundColor: `${color}15`,
					fill: true,
					tension: 0.3,
					borderWidth: 1.5,
					pointRadius: 0,
					pointHoverRadius: 4,
					pointHoverBackgroundColor: color,
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: 'rgba(28,28,32,0.95)',
						titleColor: '#8A8F98',
						bodyColor: '#E8E8EC',
						borderColor: 'rgba(255,255,255,0.08)',
						borderWidth: 1,
						titleFont: { size: 10, family: 'JetBrains Mono Variable' },
						bodyFont: { size: 12, family: 'JetBrains Mono Variable' },
						padding: 8,
						displayColors: false,
					}
				},
				scales: {
					x: {
						grid: { color: 'rgba(255,255,255,0.04)', lineWidth: 1 },
						ticks: { color: '#5A5F69', font: { size: 10, family: 'JetBrains Mono Variable' }, maxTicksLimit: 6 },
						border: { display: false },
					},
					y: {
						grid: { color: 'rgba(255,255,255,0.04)', lineWidth: 1 },
						ticks: { color: '#5A5F69', font: { size: 10, family: 'JetBrains Mono Variable' }, maxTicksLimit: 5 },
						border: { display: false },
					}
				},
				interaction: { intersect: false, mode: 'index' },
			}
		});
	});

	$effect(() => {
		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets[0].data = data;
			chart.update('none');
		}
	});

	onDestroy(() => {
		chart?.destroy();
	});
</script>

<div style="height: {height}px; position: relative;">
	<canvas bind:this={canvas}></canvas>
</div>
