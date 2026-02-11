// Core logic for psalm-compare tool
// This file is used by both psalm-compare.html (browser) and psalm-compare.test.js (Node.js)

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
	const declaredMatch = /\bdeclared\s+(return\s+)?type\b/i.test(input);
	const inferredMatch = /\binferred\s+(return\s+)?type\b/i.test(input);
	const gotMatch = /\bgot\s+['"]?list</i.test(input);

	// Check for "declared" and "got" pattern
	if (declaredMatch && gotMatch && !inferredMatch) {
		return { firstKey: 'declared', secondKey: 'got', swap: false };
	}

	// Check for "inferred" and "declared" pattern (both orderings)
	if (inferredMatch && declaredMatch) {
		// Determine which comes first in the text
		const inferredPos = input.search(/\binferred\s+(return\s+)?type\b/i);
		const declaredPos = input.search(/\bdeclared\s+(return\s+)?type\b/i);

		if (inferredPos < declaredPos) {
			return { firstKey: 'inferred', secondKey: 'declared', swap: false };
		} else {
			return { firstKey: 'declared', secondKey: 'inferred', swap: false };
		}
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

function findDifferences(input) {
	const shapes = extractArrayShapes(input);

	if (shapes.length < 2) {
		throw new Error('Could not find two array{} type definitions in the input.');
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

// Export for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		extractArrayShapes,
		parseArrayShape,
		skipWhitespace,
		findTypeEnd,
		detectKeyNames,
		extractNestedArrayShape,
		compareArrayShapes,
		findDifferences
	};
}
