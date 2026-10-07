/**
 * Canonical JSON (PROTOCOL.md § Primitives): UTF-8, object keys sorted by code point, no insignificant
 * whitespace, non-ASCII not escaped, integers only (no floats anywhere in signed payloads).
 * Byte-identical to Python `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
 */

export class CanonicalJsonError extends Error {
	readonly path: string;
	readonly code: string;
	constructor(code: string, path: string, message: string) {
		super(`${path || '$'}: ${message}`);
		this.name = 'CanonicalJsonError';
		this.code = code;
		this.path = path;
	}
}

/** Compares two strings by Unicode code point (Python `str` ordering), not UTF-16 units. */
export function compareCodePoints(a: string, b: string): number {
	const ia = a[Symbol.iterator]();
	const ib = b[Symbol.iterator]();
	for (;;) {
		const x = ia.next();
		const y = ib.next();
		if (x.done && y.done) return 0;
		if (x.done) return -1;
		if (y.done) return 1;
		const cx = x.value.codePointAt(0)!;
		const cy = y.value.codePointAt(0)!;
		if (cx !== cy) return cx < cy ? -1 : 1;
	}
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function encodeString(s: string, path: string): string {
	if (LONE_SURROGATE.test(s)) throw new CanonicalJsonError('invalid_string', path, 'lone surrogate in string');
	// JSON.stringify escapes exactly what Python escapes with ensure_ascii=False:
	// '"', '\\', \b \f \n \r \t and other C0 controls as \u00XX; leaves U+007F and non-ASCII raw.
	return JSON.stringify(s);
}

function encode(v: unknown, path: string): string {
	if (v === null) return 'null';
	switch (typeof v) {
		case 'boolean':
			return v ? 'true' : 'false';
		case 'number':
			if (!Number.isInteger(v) || Object.is(v, -0)) throw new CanonicalJsonError('float', path, 'floats are not allowed');
			if (!Number.isSafeInteger(v)) throw new CanonicalJsonError('unsafe_integer', path, 'integer exceeds 2^53; use a string');
			return String(v);
		case 'string':
			return encodeString(v, path);
		case 'bigint':
			throw new CanonicalJsonError('bigint', path, 'bigint values must be encoded as decimal strings');
		case 'object': {
			if (Array.isArray(v)) return '[' + v.map((x, i) => encode(x, `${path}[${i}]`)).join(',') + ']';
			const proto = Object.getPrototypeOf(v);
			if (proto !== Object.prototype && proto !== null) throw new CanonicalJsonError('invalid_type', path, 'only plain objects are allowed');
			const keys = Object.keys(v as object).sort(compareCodePoints);
			const parts: string[] = [];
			for (const k of keys) {
				const val = (v as Record<string, unknown>)[k];
				if (val === undefined) throw new CanonicalJsonError('undefined', `${path}.${k}`, 'undefined is not JSON');
				parts.push(encodeString(k, `${path}.${k}`) + ':' + encode(val, path ? `${path}.${k}` : k));
			}
			return '{' + parts.join(',') + '}';
		}
		default:
			throw new CanonicalJsonError('invalid_type', path, `${typeof v} is not JSON`);
	}
}

/** Canonical JSON text. Throws `CanonicalJsonError` on floats, unsafe integers, lone surrogates, non-JSON values. */
export function canonicalJson(value: unknown): string {
	return encode(value, '');
}

/** Canonical JSON as UTF-8 bytes. */
export function canonicalBytes(value: unknown): Uint8Array {
	return new TextEncoder().encode(canonicalJson(value));
}

/**
 * Strict JSON parse for signed documents: rejects duplicate keys (anywhere) and non-integer numbers.
 * Returns the parsed value.
 */
export function parseStrictJson(text: string): unknown {
	let i = 0;
	const fail = (msg: string, code = 'invalid_json'): never => {
		throw new CanonicalJsonError(code, `@${i}`, msg);
	};
	const ws = () => {
		while (i < text.length && ' \t\n\r'.includes(text[i])) i++;
	};
	const parseValue = (): unknown => {
		ws();
		const c = text[i];
		if (c === '{') return parseObject();
		if (c === '[') return parseArray();
		if (c === '"') return parseString();
		if (c === 't' && text.startsWith('true', i)) return (i += 4), true;
		if (c === 'f' && text.startsWith('false', i)) return (i += 5), false;
		if (c === 'n' && text.startsWith('null', i)) return (i += 4), null;
		return parseNumber();
	};
	const parseString = (): string => {
		const start = i;
		i++;
		while (i < text.length) {
			const ch = text[i];
			if (ch === '\\') i += 2;
			else if (ch === '"') {
				i++;
				return JSON.parse(text.slice(start, i)) as string;
			} else i++;
		}
		return fail('unterminated string');
	};
	const parseNumber = (): number => {
		const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
		if (!m) return fail('unexpected token');
		if (m[2] || m[3]) fail('floats are not allowed', 'float');
		i += m[0].length;
		const n = Number(m[0]);
		if (!Number.isSafeInteger(n)) fail('integer exceeds 2^53', 'unsafe_integer');
		return n;
	};
	const parseArray = (): unknown[] => {
		i++;
		const out: unknown[] = [];
		ws();
		if (text[i] === ']') return i++, out;
		for (;;) {
			out.push(parseValue());
			ws();
			if (text[i] === ',') i++;
			else if (text[i] === ']') return i++, out;
			else fail('expected , or ]');
		}
	};
	const parseObject = (): Record<string, unknown> => {
		i++;
		const out: Record<string, unknown> = {};
		const seen = new Set<string>();
		ws();
		if (text[i] === '}') return i++, out;
		for (;;) {
			ws();
			if (text[i] !== '"') fail('expected key');
			const k = parseString();
			if (seen.has(k)) fail(`duplicate key "${k}"`, 'duplicate_key');
			seen.add(k);
			ws();
			if (text[i] !== ':') fail('expected :');
			i++;
			Object.defineProperty(out, k, { value: parseValue(), enumerable: true, writable: true, configurable: true });
			ws();
			if (text[i] === ',') i++;
			else if (text[i] === '}') return i++, out;
			else fail('expected , or }');
		}
	};
	const v = parseValue();
	ws();
	if (i !== text.length) fail('trailing data');
	return v;
}
