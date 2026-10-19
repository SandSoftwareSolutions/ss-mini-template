import assert from "node:assert/strict";
import { test } from "node:test";

import { compile, escapeHtml, render, TemplateError, variables } from "./src/index.js";

test("fills in values, also nested ones", () => {
  assert.equal(render("Hello {{name}}!", { name: "Kaj" }), "Hello Kaj!");
  assert.equal(render("{{ user.address.city }} / {{user.name}}", { user: { name: "A", address: { city: "Haarlem" } } }), "Haarlem / A");
  assert.equal(render("{{a}}{{b}}{{a}}", { a: 1, b: 0 }), "101");
  assert.equal(render("no placeholders", {}), "no placeholders");
  assert.equal(render("", {}), "");
});

test("HTML is escaped by default and {{{triple}}} is not", () => {
  const data = { x: '<script>alert("hi")</script> & \'q\'' };
  assert.equal(render("{{x}}", data), "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; &#39;q&#39;");
  assert.equal(render("{{{x}}}", data), data.x);
  assert.equal(render("{{x}}", data, { escape: "none" }), data.x);
  assert.equal(render("{{x}}", { x: "ab" }, { escape: (v) => `[${v}]` }), "[ab]");
  assert.equal(escapeHtml(5), "5");
});

test("a missing value is an error that names it, unless you choose otherwise", () => {
  assert.throws(() => render("Hi {{name}}", {}), (e) => e instanceof TemplateError && e.placeholder === "name" && /\{\{name\}\} is missing/.test(e.message));
  assert.throws(() => render("{{a.b}}", { a: null }), /\{\{a\.b\}\} is missing/);
  assert.equal(render("Hi {{name}}!", {}, { missing: "empty" }), "Hi !");
  assert.equal(render("Hi {{name}}!", {}, { missing: "keep" }), "Hi {{name}}!");
  assert.equal(render("{{n}}", { n: 0 }), "0");
  assert.equal(render("{{b}}", { b: false }), "false");
});

test("filters", () => {
  assert.equal(render("{{ name | upper }}", { name: "kaj" }), "KAJ");
  assert.equal(render("{{name | trim | capitalize}}", { name: "  kaj " }), "Kaj");
  assert.equal(render('{{ nick | default: "n/a" }}', {}), "n/a");
  assert.equal(render("{{ nick | default: 'x y' }}", { nick: "" }), "x y");
  assert.equal(render("{{ obj | json }}", { obj: { a: 1 } }, { escape: "none" }), '{"a":1}');
  assert.equal(render('{{ price | money: "EUR" }}', { price: 5 }, { filters: { money: (v, cur) => `${cur} ${v.toFixed(2)}` } }), "EUR 5.00");
  assert.throws(() => compile("{{x | nope}}"), /unknown filter "nope"/);
});

test("a backslash writes the braces literally", () => {
  assert.equal(render("Use \\{{name}} to insert a name", { name: "x" }), "Use {{name}} to insert a name");
  assert.equal(render("\\{{{raw}}}", {}), "{{{raw}}}");
});

test("only the data's own properties are readable: no prototype tricks", () => {
  for (const path of ["constructor", "__proto__", "toString", "constructor.name", "__proto__.polluted"]) {
    assert.throws(() => render(`{{${path}}}`, {}), /is missing/, path);
  }
  assert.equal(render("{{constructor}}", { constructor: "mine" }), "mine");
  assert.equal(render("{{__proto__}}", JSON.parse('{"__proto__":"own"}')), "own");
  assert.equal({}.polluted, undefined);
});

test("templates cannot run code", () => {
  const out = render("{{ a }} ${1+1} `x` <%= 7 %> {% y %}", { a: 1 });
  assert.equal(out, "1 ${1+1} `x` <%= 7 %> {% y %}");
  assert.throws(() => compile("{{ alert(1) }}"), /not a valid placeholder/);
  assert.throws(() => compile("{{ a.b() }}"), /not a valid placeholder/);
  assert.throws(() => compile("{{ }}"), TemplateError);
});

test("variables lists what a template needs", () => {
  assert.deepEqual(variables("Hi {{name}}, {{user.email}} and {{name}} again, {{{raw}}}"), ["name", "user.email", "raw"]);
  assert.deepEqual(variables("none"), []);
  const compiled = compile("{{a}} {{b}}");
  assert.deepEqual(compiled.variables, ["a", "b"]);
  assert.equal(compiled({ a: 1, b: 2 }), "1 2");
  assert.equal(compiled({ a: 3, b: 4 }), "3 4");
});

test("foundry-style placeholders and bad options", () => {
  assert.equal(render("{{PROJECT_NAME_KEBAB}}", { PROJECT_NAME_KEBAB: "my-app" }), "my-app");
  assert.throws(() => compile(5), TypeError);
  assert.throws(() => compile("x", { missing: "ignore" }), RangeError);
  assert.throws(() => compile("x", { escape: 5 }), TypeError);
});

test("filter names are looked up as own properties: constructor, toString and __proto__ are unknown filters", () => {
  for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
    assert.throws(() => compile(`{{x | ${name}}}`), TemplateError, name);
  }
});

test("a pipe inside a quoted filter argument is part of the argument", () => {
  assert.equal(render('{{x | default: "a|b"}}', {}), "a|b");
  assert.equal(render("{{x | default: 'a | b' | upper}}", {}), "A | B");
});

test("a missing value skips the filters before default, and default needs a value", () => {
  assert.equal(render('{{x | upper | default: "n/a"}}', {}), "n/a");
  assert.equal(render('{{x | upper | default: "n/a"}}', { x: "a" }), "A");
  assert.throws(() => compile("{{x | default}}"), TemplateError);
});

test("an unclosed tag followed by many spaces compiles in linear time", () => {
  const start = Date.now();
  compile("{{" + " ".repeat(20000));
  compile("{{{" + " ".repeat(20000) + "x");
  assert.ok(Date.now() - start < 500, `took ${Date.now() - start} ms`);
});

test("inherited properties are not looked up", () => {
  assert.equal(render("{{__proto__.polluted}}", {}, { missing: "empty" }), "");
  assert.equal(render("{{constructor.name}}", {}, { missing: "empty" }), "");
  assert.equal({}.polluted, undefined);
});
