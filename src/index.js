const HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => HTML[c]);

const FILTERS = {
  upper: (v) => String(v).toUpperCase(),
  lower: (v) => String(v).toLowerCase(),
  trim: (v) => String(v).trim(),
  capitalize: (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1),
  json: (v) => JSON.stringify(v),
  default: (v, fallback) => (v === undefined || v === null || v === "" ? fallback : v)
};

const TAG = /(\\)?\{\{\{\s*([^{}]+?)\s*\}\}\}|(\\)?\{\{\s*([^{}]+?)\s*\}\}/g;

export class TemplateError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "TemplateError";
    Object.assign(this, details);
  }
}

function parseExpression(source) {
  const [path, ...filterParts] = source.split("|").map((s) => s.trim());
  if (!/^[A-Za-z_][\w-]*(\.[\w-]+)*$/.test(path)) throw new TemplateError(`"${source}" is not a valid placeholder (use names like user.name)`, { placeholder: source });
  const filters = filterParts.map((part) => {
    const m = /^(\w+)(?::\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?$/.exec(part);
    if (!m) throw new TemplateError(`"${part}" is not a valid filter`, { placeholder: source });
    return { name: m[1], arg: m[2] ?? m[3] ?? m[4] };
  });
  return { path, filters };
}

function lookup(data, path) {
  let current = data;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined || !Object.hasOwn(Object(current), segment)) return undefined; // own properties only: no prototype tricks
    current = current[segment];
  }
  return current;
}

/**
 * Parses a template once and gives you a function: `compile("Hello {{name}}!")({ name: "Kaj" })`.
 * Placeholders: `{{name}}`, `{{user.address.city}}`, filters `{{name | upper}}`, `{{x | default: "n/a"}}`; `{{{html}}}` is not escaped;
 * `\{{` writes a literal `{{`. By default values are HTML-escaped; `escape: "none"` or a function changes that.
 * A missing value is an error naming the placeholder (`missing: "throw"`, the default), an empty string (`"empty"`) or the
 * placeholder left as it was (`"keep"`). There is no logic in templates: no loops, no conditions, no code.
 */
export function compile(template, { escape = "html", missing = "throw", filters = {} } = {}) {
  if (typeof template !== "string") throw new TypeError("mini-template: template must be a string");
  if (!["throw", "empty", "keep"].includes(missing)) throw new RangeError('mini-template: missing must be "throw", "empty" or "keep"');
  const esc = escape === "html" ? escapeHtml : escape === "none" ? String : escape;
  if (typeof esc !== "function") throw new TypeError('mini-template: escape must be "html", "none" or a function');
  const allFilters = { ...FILTERS, ...filters };
  const parts = [];
  let last = 0;
  for (const m of template.matchAll(TAG)) {
    if (m.index > last) parts.push(template.slice(last, m.index));
    const escapedBackslash = m[1] ?? m[3];
    if (escapedBackslash) {
      parts.push(m[0].slice(1));
    } else {
      const raw = m[2] !== undefined;
      const expression = parseExpression(m[2] ?? m[4]);
      for (const f of expression.filters) if (!allFilters[f.name]) throw new TemplateError(`unknown filter "${f.name}"`, { placeholder: m[0] });
      parts.push({ raw, source: m[0], ...expression });
    }
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));

  const render = (data = {}) =>
    parts
      .map((part) => {
        if (typeof part === "string") return part;
        let value = lookup(data, part.path);
        const isMissing = value === undefined || value === null;
        const hasDefault = part.filters.some((f) => f.name === "default");
        if (isMissing && !hasDefault) {
          if (missing === "throw") throw new TemplateError(`The value for {{${part.path}}} is missing`, { placeholder: part.path });
          return missing === "keep" ? part.source : "";
        }
        for (const f of part.filters) value = allFilters[f.name](value, f.arg);
        return part.raw ? String(value) : esc(value);
      })
      .join("");
  render.variables = [...new Set(parts.filter((p) => typeof p !== "string").map((p) => p.path))];
  return render;
}

/** Renders in one go: `render("Hi {{name}}", { name: "Kaj" })`. For a template you use many times, `compile` it once. */
export function render(template, data, options) {
  return compile(template, options)(data);
}

/** The placeholder names a template uses (sorted by first appearance), for checking that all data is there: `["user.name", "date"]`. */
export function variables(template) {
  return compile(template, { missing: "keep" }).variables;
}
