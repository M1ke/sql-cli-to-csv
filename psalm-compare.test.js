// Test suite for psalm-compare tool
// Run this file in Node.js with: node psalm-compare.test.js

// ============================================================================
// Import functions from psalm-compare.js
// ============================================================================

const {
	extractArrayShapes,
	parseArrayShape,
	skipWhitespace,
	findTypeEnd,
	detectKeyNames,
	extractNestedArrayShape,
	compareArrayShapes,
	findDifferences
} = require('./psalm-compare.js');

// ============================================================================
// Test utilities
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
	if (condition) {
		testsPassed++;
		console.log(`✓ ${message}`);
	} else {
		testsFailed++;
		console.error(`✗ ${message}`);
	}
}

function assertEquals(actual, expected, message) {
	const actualStr = JSON.stringify(actual);
	const expectedStr = JSON.stringify(expected);

	if (actualStr === expectedStr) {
		testsPassed++;
		console.log(`✓ ${message}`);
	} else {
		testsFailed++;
		console.error(`✗ ${message}`);
		console.error(`  Expected: ${expectedStr}`);
		console.error(`  Actual:   ${actualStr}`);
	}
}

function runTest(name, testFn) {
	console.log(`\n--- ${name} ---`);
	try {
		testFn();
	} catch (e) {
		testsFailed++;
		console.error(`✗ Test threw exception: ${e.message}`);
		console.error(e.stack);
	}
}

// ============================================================================
// Test cases
// ============================================================================

runTest('extractArrayShapes - basic extraction', () => {
	const input = "array{foo: string, bar: int}";
	const result = extractArrayShapes(input);
	assertEquals(result, ['foo: string, bar: int'], 'Should extract single array shape');
});

runTest('extractArrayShapes - two array shapes', () => {
	const input = "The type 'array{a: int, b: string}' is more general than 'array{a: int, b: int}'";
	const result = extractArrayShapes(input);
	assertEquals(result, ['a: int, b: string', 'a: int, b: int'], 'Should extract two array shapes');
});

runTest('extractArrayShapes - nested arrays', () => {
	const input = "array{data: array{nested: string}, id: int}";
	const result = extractArrayShapes(input);
	assertEquals(result, ['data: array{nested: string}, id: int'], 'Should handle nested arrays');
});

runTest('extractArrayShapes - complex nested with generics', () => {
	const input = "array{role: array<array-key, mixed>, uid: int} vs array{role: list<string>, uid: int}";
	const result = extractArrayShapes(input);
	assertEquals(result, [
		'role: array<array-key, mixed>, uid: int',
		'role: list<string>, uid: int'
	], 'Should handle generics and nested types');
});

runTest('parseArrayShape - simple types', () => {
	const input = 'foo: string, bar: int, baz: bool';
	const result = parseArrayShape(input);
	assertEquals(result, {
		foo: 'string',
		bar: 'int',
		baz: 'bool'
	}, 'Should parse simple types');
});

runTest('parseArrayShape - nullable types', () => {
	const input = 'name: string, age: int|null, email: null|string';
	const result = parseArrayShape(input);
	assertEquals(result, {
		name: 'string',
		age: 'int|null',
		email: 'null|string'
	}, 'Should parse nullable types');
});

runTest('parseArrayShape - generic types', () => {
	const input = 'roles: list<string>, data: array<array-key, mixed>';
	const result = parseArrayShape(input);
	assertEquals(result, {
		roles: 'list<string>',
		data: 'array<array-key, mixed>'
	}, 'Should parse generic types with angle brackets');
});

runTest('parseArrayShape - nested arrays', () => {
	const input = 'user: array{id: int, name: string}, count: int';
	const result = parseArrayShape(input);
	assertEquals(result, {
		user: 'array{id: int, name: string}',
		count: 'int'
	}, 'Should parse nested array shapes');
});

runTest('parseArrayShape - with extra whitespace', () => {
	const input = '  foo:  string  ,  bar : int  ';
	const result = parseArrayShape(input);
	assertEquals(result, {
		foo: 'string',
		bar: 'int'
	}, 'Should handle extra whitespace');
});

runTest('parseArrayShape - real Psalm example', () => {
	const input = 'adm: bool, ctd: string, eml: string, exp: int, img: string, lgo: null|string, llid: int|null, lnm: null|string, name: string, role: array<array-key, mixed>, uid: int';
	const result = parseArrayShape(input);
	assertEquals(result, {
		adm: 'bool',
		ctd: 'string',
		eml: 'string',
		exp: 'int',
		img: 'string',
		lgo: 'null|string',
		llid: 'int|null',
		lnm: 'null|string',
		name: 'string',
		role: 'array<array-key, mixed>',
		uid: 'int'
	}, 'Should parse real Psalm error output');
});

runTest('compareArrayShapes - identical shapes', () => {
	const shape1 = { foo: 'string', bar: 'int' };
	const shape2 = { foo: 'string', bar: 'int' };
	const result = compareArrayShapes(shape1, shape2);
	assertEquals(result, {}, 'Should return empty object for identical shapes');
});

runTest('compareArrayShapes - different type for same key', () => {
	const shape1 = { foo: 'string', bar: 'int' };
	const shape2 = { foo: 'string', bar: 'string' };
	const result = compareArrayShapes(shape1, shape2);
	assertEquals(result, {
		bar: { first: 'int', second: 'string' }
	}, 'Should show difference for changed type');
});

runTest('compareArrayShapes - key only in first', () => {
	const shape1 = { foo: 'string', bar: 'int' };
	const shape2 = { foo: 'string' };
	const result = compareArrayShapes(shape1, shape2);
	assertEquals(result, {
		bar: { first: 'int', second: null }
	}, 'Should show key that exists only in first');
});

runTest('compareArrayShapes - key only in second', () => {
	const shape1 = { foo: 'string' };
	const shape2 = { foo: 'string', bar: 'int' };
	const result = compareArrayShapes(shape1, shape2);
	assertEquals(result, {
		bar: { first: null, second: 'int' }
	}, 'Should show key that exists only in second');
});

runTest('compareArrayShapes - multiple differences', () => {
	const shape1 = {
		same: 'string',
		changed: 'int',
		onlyFirst: 'bool'
	};
	const shape2 = {
		same: 'string',
		changed: 'string',
		onlySecond: 'array'
	};
	const result = compareArrayShapes(shape1, shape2);
	assertEquals(result, {
		changed: { first: 'int', second: 'string' },
		onlyFirst: { first: 'bool', second: null },
		onlySecond: { first: null, second: 'array' }
	}, 'Should show all differences');
});

runTest('Full integration - real Psalm error', () => {
	const input = "The type 'array{adm: bool, ctd: string, eml: string, exp: int, img: string, lgo: null|string, llid: int|null, lnm: null|string, name: string, role: array<array-key, mixed>, uid: int}' is more general than the declared return type 'array{adm: bool, ctd: string, eml: string, exp: int, img: string, lgo: null|string, llid: int|null, lnm: null|string, name: string, role: list<string>, uid: int}'";

	const differences = findDifferences(input);
	assertEquals(differences, {
		role: { first: 'array<array-key, mixed>', second: 'list<string>' }
	}, 'Should identify role as the only difference');
});

runTest('Full integration - nested array shapes', () => {
	const input = "array{user: array{id: int, name: string, roles: list<string>}, count: int} vs array{user: array{id: int, name: string, roles: array<string>}, count: int}";

	const differences = findDifferences(input);

	assertEquals(differences, {
		user: {
			first: 'array{id: int, name: string, roles: list<string>}',
			second: 'array{id: int, name: string, roles: array<string>}'
		}
	}, 'Should detect nested array differences');
});

runTest('Edge case - empty array shape', () => {
	const input = 'array{}';
	const result = extractArrayShapes(input);
	assertEquals(result, [''], 'Should handle empty array shape');

	const parsed = parseArrayShape('');
	assertEquals(parsed, {}, 'Should parse empty shape to empty object');
});

runTest('Edge case - array with single field', () => {
	const input = 'array{id: int}';
	const result = extractArrayShapes(input);
	assertEquals(result, ['id: int'], 'Should extract single field');

	const parsed = parseArrayShape('id: int');
	assertEquals(parsed, { id: 'int' }, 'Should parse single field');
});

runTest('Edge case - complex nested generics', () => {
	const input = 'data: array<string, array<int, mixed>>, count: int';
	const result = parseArrayShape(input);
	assertEquals(result, {
		data: 'array<string, array<int, mixed>>',
		count: 'int'
	}, 'Should handle nested generics');
});

runTest('Edge case - union types with pipes', () => {
	const input = 'value: string|int|null, optional: bool|false';
	const result = parseArrayShape(input);
	assertEquals(result, {
		value: 'string|int|null',
		optional: 'bool|false'
	}, 'Should handle union types');
});

runTest('Nested case', () => {
	const input = 'Argument 1 of Class expects array{availability: list<array{name: string, status: int}>, id: numeric}, but parent type array{availability: array<int, array{name: string, status: int}>, id: int, status: bool} provided';
	const differences = findDifferences(input);
	assertEquals(differences, {
		"availability": {
			"containerType": {
				"expects": "list",
				"provided": "array<int>"
			},
			"nestedShapeDifferences": {}
		},
		"id": {
			"expects": "numeric",
			"provided": "int"
		},
		"status": {
			"expects": null,
			"provided": "bool"
		},
	}, 'Should handle nested cases');
});

runTest('Nested case with inner differences', () => {
	const input = "array{users: list<array{id: int, name: string, role: string}>, count: int} vs array{users: array<int, array{id: int, name: string, role: list<string>}>, count: int}";
	const differences = findDifferences(input);
	assertEquals(differences, {
		"users": {
			"containerType": {
				"first": "list",
				"second": "array<int>"
			},
			"nestedShapeDifferences": {
				"role": {
					"first": "string",
					"second": "list<string>"
				}
			}
		}
	}, 'Should show both container and nested differences');
});

runTest('Null vs undefined handling in expects', () => {
	const input = "expects array{added?: string}, but array{added: null|string} provided";
	const differences = findDifferences(input);
	assertEquals(differences, {
		"added": {
			"expects": "undefined|string",
			"provided": "null|string"
		}
	}, 'Should handle undefined ?: vs null :?');
});

runTest('Null vs undefined handling in inferred', () => {
	const input = "The inferred type 'list<array{added: null|string}>}' does not match the declared return type 'list<array{added?: string}>}' for Sturents\\Routes\\Page\\Mobile\\PaymentsNew::paymentsAndDatesFromRent ";
	const differences = findDifferences(input);
	assertEquals(differences, {
		"added": {
			"inferred": "null|string",
			"declared": "undefined|string"
		}
	}, 'Should use inferred and declared as field names');
});

runTest('Null vs undefined handling in declared', () => {
	const input = "The declared return type 'list<array{added?: string}>}' for Sturents\\Routes\\Page\\Mobile\\PaymentsNew::paymentsAndDatesFromRent is incorrect, got 'list<array{added: null|string}>}'";
	const differences = findDifferences(input);
	assertEquals(differences, {
		"added": {
			"declared": "undefined|string",
			"got": "null|string",
		}
	}, 'Should use declared and got as field names');
});

runTest('Null vs undefined handling in declared', () => {
	const input = "The declared return type 'list<array{added?: string}>}' for Sturents\\Routes\\Page\\Mobile\\PaymentsNew::paymentsAndDatesFromRent is more specific than the inferred return type 'list<array{added: null|string}>}'";
	const differences = findDifferences(input);
	assertEquals(differences, {
		"added": {
			"declared": "undefined|string",
			"inferred": "null|string",
		}
	}, 'Should use declared and inferred as field names');
});

// ============================================================================
// Test summary
// ============================================================================

console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`Total tests:  ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
	console.log('\n✓ All tests passed!');
	if (typeof process !== 'undefined') {
		process.exit(0);
	}
} else {
	console.log(`\n✗ ${testsFailed} test(s) failed`);
	if (typeof process !== 'undefined') {
		process.exit(1);
	}
}
