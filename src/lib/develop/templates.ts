/**
 * HiveKit starter templates (static). Each SDK in necter-sdk builds a `hive-wasm-v1` module and packages it as a
 * `.hbc` artifact; the developer uploads the artifact and names it as the project's worker module.
 *
 * Committee workers MUST be stateless (PLATFORM.md §b.2): no `storage.*` or `hive.call` imports.
 */
export interface HiveKitTemplate {
	id: string;
	name: string;
	language: string;
	sdk: string;
	description: string;
	install: string;
	build: string;
	/** Example in the SDK repository to start from. */
	example: string;
}

export const HIVEKIT_TEMPLATES: HiveKitTemplate[] = [
	{
		id: 'rust',
		name: 'Rust worker',
		language: 'Rust',
		sdk: 'hivekit-rs',
		description:
			'#[hive_export] functions compiled to wasm32-unknown-unknown. Smallest modules and lowest gas per call; the reference SDK.',
		install: 'rustup target add wasm32-unknown-unknown',
		build: 'cargo run --bin hivec -- build --example math_module',
		example: 'hivekit-rs/examples/math_module.rs'
	},
	{
		id: 'go',
		name: 'Go worker',
		language: 'Go',
		sdk: 'hivekit-go',
		description: 'hivekit.Define handlers built with TinyGo (-target=wasm-unknown) and packaged by the Go hivec CLI.',
		install: 'go build -o hivec ./cmd/hivec   # needs TinyGo',
		build: './hivec build ./examples/math_module',
		example: 'hivekit-go/examples/math_module'
	},
	{
		id: 'assemblyscript',
		name: 'AssemblyScript worker',
		language: 'AssemblyScript',
		sdk: 'hivekit-js (as target)',
		description:
			'Strict TypeScript subset compiled with a pinned AssemblyScript toolchain. Modules of a few KB with low gas; no async, JSON or Date.',
		install: 'npm install hivekit',
		build: 'npx hivec build my_worker.ts',
		example: 'hivekit-js/examples/counter.ts'
	},
	{
		id: 'javascript',
		name: 'JavaScript / TypeScript worker',
		language: 'JavaScript',
		sdk: 'hivekit-js (js target)',
		description:
			'Full JavaScript or TypeScript inside an embedded engine. JSON in, JSON out. Larger modules and higher gas than the AssemblyScript target.',
		install: 'npm install hivekit',
		build: 'npx hivec build my_worker.ts --target js',
		example: 'hivekit-js/examples/profile.ts'
	},
	{
		id: 'python',
		name: 'Python worker',
		language: 'Python',
		sdk: 'hivekit',
		description: '@hive.define handlers in Python, packaged with the pure-Python hivec CLI. Good for prototyping workers.',
		install: 'pip install hivekit',
		build: 'hivec build math_module.py',
		example: 'hivekit/examples/math_module.py'
	}
];
