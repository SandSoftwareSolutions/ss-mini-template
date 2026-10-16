export interface TemplateOptions {
  /** "html" (default) escapes values, "none" leaves them, or give your own function. */
  escape?: "html" | "none" | ((value: unknown) => string);
  /** What to do with a value that is not there. Default "throw". */
  missing?: "throw" | "empty" | "keep";
  /** Extra filters: `{ money: (value, arg) => ... }` used as `{{price | money: "EUR"}}`. */
  filters?: Record<string, (value: any, arg?: string) => unknown>;
}

export class TemplateError extends Error {
  readonly placeholder?: string;
}

export interface Compiled {
  (data?: Record<string, unknown>): string;
  readonly variables: string[];
}

export function compile(template: string, options?: TemplateOptions): Compiled;
export function render(template: string, data?: Record<string, unknown>, options?: TemplateOptions): string;
export function variables(template: string): string[];
export function escapeHtml(value: unknown): string;
