/**
 * Minimal OpenAPI 3.1 schema validator for consumer contract testing.
 */
function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

export function createValidator(doc) {
  const lookup = (ref) => {
    if (!ref.startsWith("#/")) throw new Error(`Only local refs supported: ${ref}`);
    return ref
      .slice(2)
      .split("/")
      .reduce((node, key) => {
        if (node?.[key] === undefined) throw new Error(`Unresolvable $ref ${ref}`);
        return node[key];
      }, doc);
  };

  const resolve = (s) => (s.$ref ? resolve(lookup(s.$ref)) : s);

  function check(schema, value, path, errors) {
    const s = resolve(schema);
    if (s.oneOf) {
      const matches = s.oneOf.filter((sub) => check(sub, value, path, []).length === 0).length;
      if (matches !== 1) errors.push(`${path}: oneOf matched ${matches} branches`);
      return errors;
    }
    if ("const" in s && value !== s.const) {
      errors.push(`${path}: expected const ${JSON.stringify(s.const)}, got ${JSON.stringify(value)}`);
    }
    if (s.enum && !s.enum.includes(value)) {
      errors.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(s.enum)}`);
    }
    if (s.type) {
      const types = Array.isArray(s.type) ? s.type : [s.type];
      const t = typeOf(value);
      if (!types.includes(t) && !(t === "integer" && types.includes("number"))) {
        errors.push(`${path}: expected ${types.join("|")}, got ${t}`);
        return errors;
      }
    }
    if (typeof value === "string") {
      if (s.pattern && !new RegExp(s.pattern).test(value)) {
        errors.push(`${path}: "${value}" !~ /${s.pattern}/`);
      }
      if (s.maxLength !== undefined && value.length > s.maxLength) {
        errors.push(`${path}: longer than ${s.maxLength}`);
      }
      if (s.minLength !== undefined && value.length < s.minLength) {
        errors.push(`${path}: shorter than ${s.minLength}`);
      }
    }
    if (typeof value === "number") {
      if (s.minimum !== undefined && value < s.minimum) errors.push(`${path}: ${value} < ${s.minimum}`);
      if (s.maximum !== undefined && value > s.maximum) errors.push(`${path}: ${value} > ${s.maximum}`);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value;
      for (const r of s.required ?? []) {
        if (!(r in obj)) errors.push(`${path}: missing required "${r}"`);
      }
      for (const [k, v] of Object.entries(obj)) {
        const ps = s.properties?.[k];
        if (ps) {
          check(ps, v, `${path}.${k}`, errors);
        } else if (s.additionalProperties === false) {
          errors.push(`${path}: undocumented property "${k}"`);
        }
      }
    }
    if (Array.isArray(value) && s.items) {
      value.forEach((v, i) => check(s.items, v, `${path}[${i}]`, errors));
    }
    return errors;
  }

  return {
    validateResponse(path, method, status, body) {
      const op = doc.paths?.[path]?.[method.toLowerCase()];
      if (!op) return [`operation ${method} ${path} not documented in OpenAPI`];
      const res = op.responses?.[String(status)] ?? (status >= 400 ? op.responses?.default : undefined);
      if (!res) return [`status ${status} not documented for ${method} ${path}`];
      const resolved = resolve(res);
      if (!resolved.content) return body === null ? [] : [`${method} ${path} ${status} documents no body`];
      const schema = resolved.content?.["application/json"]?.schema;
      return schema ? check(schema, body, "$", []) : [`no JSON schema for ${method} ${path} ${status}`];
    },
    validateSchema(schemaRef, value) {
      return check({ $ref: schemaRef }, value, "$", []);
    },
  };
}
