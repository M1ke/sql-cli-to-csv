// Core logic for json-editor tool
// Used by both json-editor.html (browser) and json-editor.test.js (Node.js)

const formatJson = (jsonString) => JSON.stringify(JSON.parse(jsonString), null, 2);

// Resolves a $ref string like "#/definitions/Foo" against the root schema
const resolveRef = (ref, rootSchema) => {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let node = rootSchema;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return null;
    node = node[part];
  }
  return node ?? null;
};

const getType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

// Validates a parsed JS value against a JSON Schema (draft-07 subset).
// Returns Array<{path: string, message: string}>
const validateJsonSchema = (value, schema, rootSchema = schema, path = '') => {
  if (!schema || typeof schema !== 'object') return [];

  if (schema['$ref']) {
    const resolved = resolveRef(schema['$ref'], rootSchema);
    if (!resolved) return [{ path, message: `Unknown $ref: ${schema['$ref']}` }];
    return validateJsonSchema(value, resolved, rootSchema, path);
  }

  const errors = [];
  const label = path || '(root)';

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = getType(value);
    const matches = types.some(t => {
      if (t === 'integer') return typeof value === 'number' && Number.isInteger(value);
      return t === actualType;
    });
    if (!matches) {
      errors.push({ path, message: `Expected type ${types.join('|')}, got ${actualType}` });
      return errors;
    }
  }

  if (schema.enum !== undefined) {
    const match = schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value));
    if (!match) {
      errors.push({ path, message: `Value must be one of: ${schema.enum.map(e => JSON.stringify(e)).join(', ')}` });
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `Minimum length is ${schema.minLength}, got ${value.length}` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `Maximum length is ${schema.maxLength}, got ${value.length}` });
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `Value does not match pattern: ${schema.pattern}` });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `Value must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `Value must be <= ${schema.maximum}` });
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      errors.push(...validateJsonSchema(item, schema.items, rootSchema, itemPath));
    });
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const declared = schema.properties ? Object.keys(schema.properties) : [];

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          const fieldPath = path ? `${path}.${key}` : key;
          errors.push({ path: fieldPath, message: `Required field is missing` });
        }
      }
    }

    if (schema.properties) {
      for (const key of Object.keys(schema.properties)) {
        if (key in value) {
          const fieldPath = path ? `${path}.${key}` : key;
          errors.push(...validateJsonSchema(value[key], schema.properties[key], rootSchema, fieldPath));
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!declared.includes(key)) {
          const fieldPath = path ? `${path}.${key}` : key;
          errors.push({ path: fieldPath, message: `Additional property not allowed` });
        }
      }
    }
  }

  return errors;
};

// Base64 encode/decode with Unicode support
const encodeForStorage = (jsonString) => btoa(encodeURIComponent(jsonString));
const decodeFromStorage = (encoded) => decodeURIComponent(atob(encoded));

// Returns {key, value} — key is "json-editor:title", value is the pre-encoded value passed through
const serializeStorage = (title, preEncodedValue) => ({
  key: `json-editor:${title}`,
  value: preEncodedValue,
});

const deserializeStorage = (encoded) => decodeFromStorage(encoded);

// Pure index management — returns new arrays, does not mutate inputs
const addToIndex = (index, title) => index.includes(title) ? [...index] : [...index, title];
const removeFromIndex = (index, title) => index.filter(t => t !== title);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatJson,
    validateJsonSchema,
    encodeForStorage,
    decodeFromStorage,
    serializeStorage,
    deserializeStorage,
    addToIndex,
    removeFromIndex,
  };
}
