# @sandsoftwaresolutions/mini-template

[![CI](https://github.com/SandSoftwareSolutions/ss-mini-template/actions/workflows/ci.yml/badge.svg)](https://github.com/SandSoftwareSolutions/ss-mini-template/actions/workflows/ci.yml)

Fill in `{{placeholders}}` in emails, messages and generated files. Small on purpose: no loops, no conditions, no code, so a template can never run anything. Values are HTML-escaped by default and a missing value is an error, not a silent blank. No dependencies.

## Install

```bash
npm install @sandsoftwaresolutions/mini-template
```

Works with `import` and `require()`, and ships TypeScript types for both.

## Usage

```js
import { render, compile, variables } from "@sandsoftwaresolutions/mini-template";

render("Hello {{name}}, your table is {{booking.table}}!", { name: "Kaj", booking: { table: 7 } });
// "Hello Kaj, your table is 7!"

render("{{ name | upper }} / {{ nick | default: 'n/a' }}", { name: "kaj" });   // "KAJ / n/a"

const email = compile("Dear {{name}}, {{{signatureHtml}}}");   // parse once, use many times
email({ name: "A", signatureHtml: "<b>Team</b>" });

variables("Hi {{name}}, {{user.email}}");   // ["name", "user.email"]: check you have all the data
```

## Safe by default

- **HTML escaped.** `{{x}}` turns `<script>` into `&lt;script&gt;`. `{{{x}}}` writes the value as it is, for HTML you made yourself. `escape: "none"` is for plain text such as `.env` files or SQL-free config.
- **A missing value is an error** that names it: `The value for {{booking.table}} is missing`. Choose `missing: "empty"` or `"keep"` if you really want something else.
- **No code.** Only names like `user.name` are placeholders; `{{ alert(1) }}` is refused, and `${...}`, `<%= %>` and backticks in the text are just text.
- **Only the data's own properties** can be read, so `{{constructor}}`, `{{__proto__.x}}` and `{{toString}}` never reach into JavaScript's built-ins.
- `\{{` writes a literal `{{`.

## Filters

`upper`, `lower`, `trim`, `capitalize`, `json`, and `default: "text"` (also fills in empty values). Chain them: `{{ name | trim | capitalize }}`. Add your own:

```js
render('{{ price | money: "EUR" }}', { price: 5 }, { filters: { money: (value, currency) => `${currency} ${value.toFixed(2)}` } });
```

Placeholder names may be `PROJECT_NAME_KEBAB` style, so the same templates work for scaffolding files.
