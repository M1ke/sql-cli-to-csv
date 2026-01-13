// Test suite for psalm-compare.html
// Run this file in Node.js with: node psalm-compare.test.js
// Or in browser console by copying the functions and test cases

// ============================================================================
// Copy of functions from psalm-compare.html
// ============================================================================

function extractArrayShapes(text) {
	const shapes = [];
	let pos = 0;

	while (pos < text.length) {
		const arrayStart = text.indexOf('array{', pos);
		if (arrayStart === -1) break;

		let depth = 0;
		let i = arrayStart + 5;
		let inShape = false;

		for (; i < text.length; i++) {
			if (text[i] === '{') {
				depth++;
				inShape = true;
			} else if (text[i] === '}') {
				depth--;
				if (depth === 0) {
					break;
				}
			}
		}

		if (inShape && i < text.length) {
			const content = text.substring(arrayStart + 6, i);
			shapes.push(content);
			pos = i + 1;
		} else {
			break;
		}
	}

	return shapes;
}

function parseArrayShape(content) {
	const result = {};
	let pos = 0;

	while (pos < content.length) {
		pos = skipWhitespace(content, pos);
		if (pos >= content.length) break;

		const keyEnd = content.indexOf(':', pos);
		if (keyEnd === -1) break;

		let key = content.substring(pos, keyEnd).trim();

		// Check if the key ends with ? (optional field marker)
		let isOptional = false;
		if (key.endsWith('?')) {
			isOptional = true;
			key = key.slice(0, -1); // Remove the ? from the key
		}

		pos = keyEnd + 1;
		pos = skipWhitespace(content, pos);

		const typeEnd = findTypeEnd(content, pos);
		let type = content.substring(pos, typeEnd).trim();

		// If the field was optional, prepend undefined| to the type
		if (isOptional) {
			type = 'undefined|' + type;
		}

		result[key] = type;
		pos = typeEnd;

		pos = skipWhitespace(content, pos);
		if (pos < content.length && content[pos] === ',') {
			pos++;
		}
	}

	return result;
}

function skipWhitespace(str, pos) {
	while (pos < str.length && /\s/.test(str[pos])) {
		pos++;
	}
	return pos;
}

function findTypeEnd(content, start) {
	let depth = 0;
	let angleDepth = 0;
	let pos = start;

	while (pos < content.length) {
		const char = content[pos];

		if (char === '{') {
			depth++;
		} else if (char === '}') {
			if (depth === 0) break;
			depth--;
		} else if (char === '<') {
			angleDepth++;
		} else if (char === '>') {
			angleDepth--;
		} else if (char === ',' && depth === 0 && angleDepth === 0) {
			break;
		}

		pos++;
	}

	return pos;
}

function detectKeyNames(input) {
	// Check for "inferred" and "declared" pattern
	const inferredMatch = /\binferred\s+type\b/i.test(input);
	const declaredMatch = /\bdeclared\s+(return\s+)?type\b/i.test(input);

	if (inferredMatch && declaredMatch) {
		return { firstKey: 'inferred', secondKey: 'declared', swap: true };
	}

	// Check for "expects" and "provided" pattern
	const expectsMatch = /\bexpects\s+array\{/i.test(input);
	const providedMatch = /\barray\{[^}]*\}\s+provided\b/i.test(input) || /\bprovided\b/i.test(input);

	if (expectsMatch && providedMatch) {
		return { firstKey: 'expects', secondKey: 'provided', swap: false };
	}

	// Default to first/second
	return { firstKey: 'first', secondKey: 'second', swap: false };
}

function findDifferences(input){
	const shapes = extractArrayShapes(input);

	if (shapes.length < 2) {
		outputEl.value = 'Error: Could not find two array{} type definitions in the input.';
		return;
	}

	const keyNames = detectKeyNames(input);
	let shape1 = parseArrayShape(shapes[0]);
	let shape2 = parseArrayShape(shapes[1]);

	// Swap shapes if needed (e.g., for inferred/declared pattern)
	if (keyNames.swap) {
		[shape1, shape2] = [shape2, shape1];
	}

	return compareArrayShapes(shape1, shape2, keyNames);
}

function extractNestedArrayShape(typeStr) {
	// Check if the type contains a nested array{...} within a generic
	// e.g., "list<array{...}>" or "array<int, array{...}>"
	// NOT just "array{...}" by itself

	const arrayShapeStart = typeStr.indexOf('array{');
	if (arrayShapeStart === -1) {
		return null;
	}

	// If the type starts with "array{", it's not nested in a container
	if (arrayShapeStart === 0) {
		return null;
	}

	// Find where the container part ends and array{ begins
	const containerPart = typeStr.substring(0, arrayShapeStart);

	// Check if there's actually a container (should contain < or be a type name followed by <)
	if (!containerPart.includes('<')) {
		return null;
	}

	// Extract the container type (everything before array{)
	// For "list<array{" -> "list"
	// For "array<int, array{" -> "array<int>"
	let containerType = containerPart.trim();
	if (containerType.endsWith('<')) {
		containerType = containerType.slice(0, -1).trim();
	}
	if (containerType.endsWith(',')) {
		// Handle "array<int, array{" case - we want "array<int>"
		const angleStart = containerType.indexOf('<');
		if (angleStart !== -1) {
			containerType = containerType.substring(0, containerType.lastIndexOf(',')).trim() + '>';
		}
	}

	// Extract the nested array shape content
	let depth = 0;
	let i = arrayShapeStart + 5; // Start after "array"
	let inShape = false;

	for (; i < typeStr.length; i++) {
		if (typeStr[i] === '{') {
			depth++;
			inShape = true;
		} else if (typeStr[i] === '}') {
			depth--;
			if (depth === 0) {
				break;
			}
		}
	}

	if (inShape && i < typeStr.length) {
		const nestedContent = typeStr.substring(arrayShapeStart + 6, i);
		return {
			containerType,
			nestedShape: nestedContent
		};
	}

	return null;
}

function compareArrayShapes(shape1, shape2, keyNames = {firstKey: 'first', secondKey: 'second'}) {
	const differences = {};
	const allKeys = new Set([...Object.keys(shape1), ...Object.keys(shape2)]);

	for (const key of allKeys) {
		const type1 = shape1[key];
		const type2 = shape2[key];

		if (type1 === undefined) {
			differences[key] = {
				[keyNames.firstKey]: null,
				[keyNames.secondKey]: type2
			};
		} else if (type2 === undefined) {
			differences[key] = {
				[keyNames.firstKey]: type1,
				[keyNames.secondKey]: null
			};
		} else if (type1 !== type2) {
			// Check if both types contain nested array shapes
			const nested1 = extractNestedArrayShape(type1);
			const nested2 = extractNestedArrayShape(type2);

			if (nested1 && nested2) {
				// Both have nested array shapes - compare them
				const nestedShape1 = parseArrayShape(nested1.nestedShape);
				const nestedShape2 = parseArrayShape(nested2.nestedShape);
				const nestedDifferences = compareArrayShapes(nestedShape1, nestedShape2, keyNames);

				const result = {};

				// Show container type difference if they differ
				if (nested1.containerType !== nested2.containerType) {
					result.containerType = {
						[keyNames.firstKey]: nested1.containerType,
						[keyNames.secondKey]: nested2.containerType
					};
				}

				// Show nested shape differences
				result.nestedShapeDifferences = nestedDifferences;

				differences[key] = result;
			} else {
				// Simple type difference
				differences[key] = {
					[keyNames.firstKey]: type1,
					[keyNames.secondKey]: type2
				};
			}
		}
	}

	return differences;
}

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
	}, 'Should show both container and nested differences');
});

runTest('Null vs undefined handling in inferred', () => {
	const input = "The inferred type 'list<array{added: null|string}>}' does not match the declared return type 'list<array{added?: string}>}' for Sturents\\Routes\\Page\\Mobile\\PaymentsNew::paymentsAndDatesFromRent ";
	const differences = findDifferences(input);
	assertEquals(differences, {
		"added": {
			"inferred": "undefined|string",
			"declared": "null|string"
		}
	}, 'Should show both container and nested differences');
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
