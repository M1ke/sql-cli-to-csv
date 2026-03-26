// Tests for json-editor.js — run with: node json-editor.test.js (Node 16+ required)
const {
  formatJson,
  validateJsonSchema,
  encodeForStorage,
  decodeFromStorage,
  serializeStorage,
  deserializeStorage,
  addToIndex,
  removeFromIndex,
} = require('./json-editor.js');

let passed = 0;
let failed = 0;

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

const assertEquals = (actual, expected, message) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message || 'assertEquals failed'}: got ${a}, expected ${e}`);
};

const runTest = (name, fn) => {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL: ${name} — ${e.message}`);
    failed++;
  }
};

// --- formatJson ---
console.log('\nformatJson');

runTest('formats minified JSON', () => {
  assertEquals(formatJson('{"a":1,"b":2}'), '{\n  "a": 1,\n  "b": 2\n}');
});

runTest('is idempotent on already-formatted JSON', () => {
  const formatted = '{\n  "a": 1\n}';
  assertEquals(formatJson(formatted), formatted);
});

runTest('handles nested structures', () => {
  const result = formatJson('{"a":{"b":[1,2]}}');
  const parsed = JSON.parse(result);
  assertEquals(parsed.a.b, [1, 2]);
  assert(result.includes('  '), 'should be indented');
});

runTest('throws on invalid JSON', () => {
  let threw = false;
  try { formatJson('{bad}'); } catch (e) { threw = true; }
  assert(threw, 'should throw');
});

runTest('throws on empty string', () => {
  let threw = false;
  try { formatJson(''); } catch (e) { threw = true; }
  assert(threw, 'should throw');
});

// --- validateJsonSchema: type checks ---
console.log('\nvalidateJsonSchema — type');

runTest('string matches type:string', () => {
  assertEquals(validateJsonSchema('hello', { type: 'string' }), []);
});

runTest('number where type:string returns error', () => {
  const errs = validateJsonSchema(42, { type: 'string' });
  assert(errs.length === 1);
  assert(errs[0].message.includes('string'));
});

runTest('integer accepted for type:integer', () => {
  assertEquals(validateJsonSchema(5, { type: 'integer' }), []);
});

runTest('float rejected for type:integer', () => {
  const errs = validateJsonSchema(1.5, { type: 'integer' });
  assert(errs.length === 1);
});

runTest('type:number accepts integers and floats', () => {
  assertEquals(validateJsonSchema(1, { type: 'number' }), []);
  assertEquals(validateJsonSchema(1.5, { type: 'number' }), []);
});

runTest('type:array rejects object', () => {
  const errs = validateJsonSchema({}, { type: 'array' });
  assert(errs.length === 1);
});

runTest('type:null accepts null', () => {
  assertEquals(validateJsonSchema(null, { type: 'null' }), []);
});

runTest('type:null rejects false', () => {
  const errs = validateJsonSchema(false, { type: 'null' });
  assert(errs.length === 1);
});

runTest('type:boolean accepts true', () => {
  assertEquals(validateJsonSchema(true, { type: 'boolean' }), []);
});

// --- validateJsonSchema: properties + required ---
console.log('\nvalidateJsonSchema — properties/required');

runTest('missing required field returns error', () => {
  const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
  const errs = validateJsonSchema({}, schema);
  assert(errs.length === 1);
  assert(errs[0].path === 'name');
  assert(errs[0].message.includes('Required'));
});

runTest('all required fields present returns no error', () => {
  const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
  assertEquals(validateJsonSchema({ name: 'Alice' }, schema), []);
});

runTest('additionalProperties:false rejects extra key', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
  const errs = validateJsonSchema({ a: 'x', b: 'y' }, schema);
  assert(errs.length === 1);
  assert(errs[0].path === 'b');
});

runTest('additionalProperties:false accepts declared keys only', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
  assertEquals(validateJsonSchema({ a: 'x' }, schema), []);
});

runTest('nested properties error path is parent.child', () => {
  const schema = {
    type: 'object',
    properties: {
      address: {
        type: 'object',
        required: ['city'],
        properties: { city: { type: 'string' } },
      },
    },
  };
  const errs = validateJsonSchema({ address: {} }, schema);
  assert(errs.length === 1);
  assertEquals(errs[0].path, 'address.city');
});

// --- validateJsonSchema: string constraints ---
console.log('\nvalidateJsonSchema — string constraints');

runTest('minLength rejects short string', () => {
  const errs = validateJsonSchema('ab', { type: 'string', minLength: 5 });
  assert(errs.length === 1);
});

runTest('minLength accepts long enough string', () => {
  assertEquals(validateJsonSchema('hello', { type: 'string', minLength: 5 }), []);
});

runTest('maxLength rejects long string', () => {
  const errs = validateJsonSchema('hello!', { type: 'string', maxLength: 3 });
  assert(errs.length === 1);
});

runTest('pattern rejects non-matching string', () => {
  const errs = validateJsonSchema('ABC', { type: 'string', pattern: '^[a-z]+$' });
  assert(errs.length === 1);
});

runTest('pattern accepts matching string', () => {
  assertEquals(validateJsonSchema('abc', { type: 'string', pattern: '^[a-z]+$' }), []);
});

runTest('enum rejects non-member value', () => {
  const errs = validateJsonSchema('c', { enum: ['a', 'b'] });
  assert(errs.length === 1);
});

runTest('enum accepts member value', () => {
  assertEquals(validateJsonSchema('a', { enum: ['a', 'b'] }), []);
});

// --- validateJsonSchema: numeric constraints ---
console.log('\nvalidateJsonSchema — numeric constraints');

runTest('minimum rejects value below minimum', () => {
  const errs = validateJsonSchema(4, { type: 'number', minimum: 5 });
  assert(errs.length === 1);
});

runTest('minimum accepts value at minimum', () => {
  assertEquals(validateJsonSchema(5, { type: 'number', minimum: 5 }), []);
});

runTest('maximum rejects value above maximum', () => {
  const errs = validateJsonSchema(11, { type: 'number', maximum: 10 });
  assert(errs.length === 1);
});

runTest('maximum accepts value at maximum', () => {
  assertEquals(validateJsonSchema(10, { type: 'number', maximum: 10 }), []);
});

// --- validateJsonSchema: array items ---
console.log('\nvalidateJsonSchema — array items');

runTest('items validates each element, returns per-item errors', () => {
  const errs = validateJsonSchema([1, 2], { type: 'array', items: { type: 'string' } });
  assert(errs.length === 2);
  assertEquals(errs[0].path, '[0]');
  assertEquals(errs[1].path, '[1]');
});

runTest('items accepts valid array', () => {
  assertEquals(validateJsonSchema(['a', 'b'], { type: 'array', items: { type: 'string' } }), []);
});

runTest('nested items path includes parent path', () => {
  const schema = {
    type: 'object',
    properties: {
      tags: { type: 'array', items: { type: 'string' } },
    },
  };
  const errs = validateJsonSchema({ tags: [1] }, schema);
  assert(errs.length === 1);
  assertEquals(errs[0].path, 'tags[0]');
});

// --- validateJsonSchema: $ref ---
console.log('\nvalidateJsonSchema — $ref');

runTest('$ref resolves from definitions', () => {
  const schema = {
    $ref: '#/definitions/Name',
    definitions: { Name: { type: 'string', minLength: 2 } },
  };
  assertEquals(validateJsonSchema('Alice', schema), []);
  const errs = validateJsonSchema('A', schema);
  assert(errs.length === 1);
});

runTest('unknown $ref returns error', () => {
  const schema = { $ref: '#/definitions/Missing' };
  const errs = validateJsonSchema('x', schema);
  assert(errs.length === 1);
  assert(errs[0].message.includes('$ref'));
});

// --- encodeForStorage / decodeFromStorage ---
console.log('\nencodeForStorage / decodeFromStorage');

runTest('roundtrip ASCII JSON', () => {
  const json = '{"name":"Alice","age":30}';
  assertEquals(decodeFromStorage(encodeForStorage(json)), json);
});

runTest('roundtrip Unicode JSON', () => {
  const json = '{"name":"Ångström","emoji":"✓"}';
  assertEquals(decodeFromStorage(encodeForStorage(json)), json);
});

runTest('encoded value contains only base64 characters', () => {
  const encoded = encodeForStorage('{"a":1}');
  assert(/^[A-Za-z0-9+/=]+$/.test(encoded), `not pure base64: ${encoded}`);
});

// --- addToIndex ---
console.log('\naddToIndex');

runTest('adds to empty index', () => {
  assertEquals(addToIndex([], 'foo'), ['foo']);
});

runTest('no duplicate on second add', () => {
  assertEquals(addToIndex(['foo'], 'foo'), ['foo']);
});

runTest('adds new item to existing index', () => {
  assertEquals(addToIndex(['foo'], 'bar'), ['foo', 'bar']);
});

runTest('does not mutate input array', () => {
  const original = ['foo'];
  addToIndex(original, 'bar');
  assertEquals(original, ['foo']);
});

// --- removeFromIndex ---
console.log('\nremoveFromIndex');

runTest('removes existing item', () => {
  assertEquals(removeFromIndex(['foo', 'bar'], 'foo'), ['bar']);
});

runTest('no-op on missing item', () => {
  assertEquals(removeFromIndex(['foo'], 'bar'), ['foo']);
});

runTest('no-op on empty array', () => {
  assertEquals(removeFromIndex([], 'foo'), []);
});

runTest('does not mutate input array', () => {
  const original = ['foo', 'bar'];
  removeFromIndex(original, 'foo');
  assertEquals(original, ['foo', 'bar']);
});

// --- serializeStorage ---
console.log('\nserializeStorage');

runTest('key is json-editor:title', () => {
  assertEquals(serializeStorage('myTitle', 'encoded').key, 'json-editor:myTitle');
});

runTest('value is the pre-encoded value passed through', () => {
  const encoded = encodeForStorage('{"a":1}');
  assertEquals(serializeStorage('t', encoded).value, encoded);
});

runTest('deserializeStorage roundtrip', () => {
  const json = '{"x":42}';
  const encoded = encodeForStorage(json);
  assertEquals(deserializeStorage(encoded), json);
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
