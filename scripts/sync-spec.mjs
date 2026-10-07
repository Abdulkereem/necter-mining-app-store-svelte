// Copies the binding API spec from the platform workspace (../spec/openapi.yaml) when it exists, so
// `npm run gen:api` regenerates src/lib/api/schema.d.ts from the latest spec. The vendored copy in
// spec/openapi.yaml is used when the workspace is not present (standalone checkout / CI).
import { copyFileSync, existsSync } from 'node:fs';
const src = new URL('../../spec/openapi.yaml', import.meta.url);
const dst = new URL('../spec/openapi.yaml', import.meta.url);
if (existsSync(src)) {
	copyFileSync(src, dst);
	console.log('spec/openapi.yaml synced from ../spec');
} else {
	console.log('using vendored spec/openapi.yaml');
}
