# `<xsl:message>` Compatibility Test Suite

A battery of 14 XSLT files exercising different `<xsl:message>` shapes against
the same input. Used to verify that **XSLTDebugX** (Saxon-JS in the browser) and
**SAP CPI** (Saxon on the JVM in the iflow runtime) handle `<xsl:message>`
identically.

**Status (2026-06-01): all 14 variants pass on both XSLTDebugX and CPI.** ✅

## Test setup

All variants use the same input XML and parameters.

### Input XML
File: [`input.xml`](./input.xml) — 4 products across 3 categories.

### Parameters

| Param | CPI binding | Value |
|---|---|---|
| `orderid` | **header** | `ORD-20260601-001` |
| `quantity` | **property** | `5` (use `0` to trigger variant 12's terminate path) |
| `exchange` | iflow exchange object | bound automatically by CPI; XSLTDebugX stubs this |

### How to run

**XSLTDebugX (local):**
1. Open the variant `.xslt` in the XSLT pane.
2. Paste `input.xml` into the XML pane.
3. Set the header `orderid` and property `quantity` in the CPI simulation panel.
4. Click Run. Watch the console panel for `<xsl:message>` output.

**CPI (iflow):**
1. Drop the variant `.xslt` into an XSLT mapping step.
2. Configure the iflow with the header/property above.
3. **Enable trace mode** on the iflow (required to see message output).
4. Send the input. Check the MPL → step trace for log lines.

## Results matrix

Legend: ✅ works as expected · ⚠️ works but with caveats · ❌ fails

| # | File | Description | XSLTDebugX | CPI |
|---|------|-------------|:---:|:---:|
| 01 | [`01-plain-text.xslt`](./01-plain-text.xslt) | Plain text message | ✅ | ✅ |
| 02 | [`02-multi-line.xslt`](./02-multi-line.xslt) | Multi-line with embedded values | ✅ | ✅ |
| 03 | [`03-computed-xpath.xslt`](./03-computed-xpath.xslt) | Computed XPath (`sum() * number()`) | ✅ | ✅ |
| 04 | [`04-embedded-xml.xslt`](./04-embedded-xml.xslt) | Embedded XML structure (literal child elements) | ✅ | ✅ |
| 05 | [`05-select-attribute.xslt`](./05-select-attribute.xslt) | `select=""` attribute form (XSLT 2.0) | ✅ | ✅ |
| 06 | [`06-conditional-in-loop.xslt`](./06-conditional-in-loop.xslt) | Conditional message inside loop (Price > 50) | ✅ | ✅ |
| 07 | [`07-special-chars.xslt`](./07-special-chars.xslt) | Special chars + BMP unicode (`<>&"'©®€™日本語`) | ✅ | ✅ |
| 08 | [`08-empty-message.xslt`](./08-empty-message.xslt) | Empty `<xsl:message></xsl:message>` | ✅ | ✅ |
| 09 | [`09-before-output.xslt`](./09-before-output.xslt) | Message before any setHeader / output | ✅ | ✅ |
| 10 | [`10-volume-loop.xslt`](./10-volume-loop.xslt) | One message per loop iteration | ✅ | ✅ |
| 11 | [`11-side-effect.xslt`](./11-side-effect.xslt) | `cpi:setHeader` call inside message | ✅ | ✅ |
| 12 | [`12-terminate.xslt`](./12-terminate.xslt) | `terminate="yes"` (set quantity=0 to trigger) | ✅ | ✅ |
| 13 | [`13-nested-structure.xslt`](./13-nested-structure.xslt) | Deeply-nested literal `<item>` children | ✅ | ✅ |
| 14 | [`14-emojis.xslt`](./14-emojis.xslt) | Emojis + mixed scripts + ZWJ sequences + flags | ✅ | ✅ |

## Baseline expected output

Every variant except **12** produces this exact `PurchaseOrder` payload (the
messages are side-effects logged separately, they don't touch the result tree):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder>
  <PurchaseOrderNumber>ORD-20260601-001</PurchaseOrderNumber>
  <Items>
    <Item>
      <ProductId>P-1001</ProductId>
      <ProductName>Wireless Mouse</ProductName>
      <Category>Electronics</Category>
      <Quantity>5</Quantity>
      <Price>124.94999999999999</Price>
      <Currency>USD</Currency>
    </Item>
    <Item>
      <ProductId>P-1002</ProductId>
      <ProductName>Mechanical Keyboard</ProductName>
      <Category>Electronics</Category>
      <Quantity>5</Quantity>
      <Price>447.5</Price>
      <Currency>USD</Currency>
    </Item>
    <Item>
      <ProductId>P-2003</ProductId>
      <ProductName>Office Chair</ProductName>
      <Category>Furniture</Category>
      <Quantity>5</Quantity>
      <Price>995</Price>
      <Currency>USD</Currency>
    </Item>
    <Item>
      <ProductId>P-3004</ProductId>
      <ProductName>Notebook A5</ProductName>
      <Category>Stationery</Category>
      <Quantity>5</Quantity>
      <Price>18.75</Price>
      <Currency>USD</Currency>
    </Item>
  </Items>
</PurchaseOrder>
```

> Note: `124.94999999999999` instead of `124.95` is IEEE-754 float noise from
> `xs:double` arithmetic. Use `format-number(..., '0.00')` if you need clean
> currency output. This is documented behavior, not a bug in any variant.

**Variant 12** halts the transform before output is produced when `quantity ≤ 0`,
emitting the message text as the failure reason.

## What each variant proves about CPI / Saxon-JS

- **01–03** — basic message rendering, including computed XPath inside the body.
- **04, 13** — literal child elements inside `<xsl:message>` are serialized as
  XML in the log output (not stripped, not flattened).
- **05** — Saxon-JS and CPI both accept the XSLT 2.0 `<xsl:message select="..."/>`
  attribute form.
- **06** — predicates inside `<xsl:if>` filter messages correctly inside loops.
- **07, 14** — UTF-8 round-trips cleanly across both engines, including 4-byte
  surrogate-pair codepoints, ZWJ sequences (`👨‍💻`), regional indicator flag
  emoji (`🇯🇵`), and Fitzpatrick skin-tone modifiers (`👩🏽‍🚀`).
- **08** — empty `<xsl:message/>` is tolerated; no error.
- **09** — `<xsl:message>` is a side-effect: it fires when reached during
  execution, regardless of where the result-tree code sits in the template.
- **10** — high-volume loop logging works; no truncation observed at this scale.
- **11** — calling `cpi:setHeader($exchange, ...)` inside `<xsl:message>` both
  logs the result *and* sets the header — the side effect persists downstream.
- **12** — `terminate="yes"` halts the transform and surfaces the message text
  as the iflow step's failure reason in the MPL.

## Re-running the suite

If a future Saxon-JS upgrade or CPI runtime change is suspected of regressing
any of these, re-run the affected variants against the same input and compare.
