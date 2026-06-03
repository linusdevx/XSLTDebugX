// Fixtures for CPI pre-flight validation tests. Each fixture violates one
// rule and pairs with an expected error fragment that must appear in clog.
// `xml` is a no-op input — the failure must be detected before XSLT runs.

export const minimalXml = `<?xml version="1.0"?>
<r/>`;

export const cpiBadSamples = {
  whitespaceLineSpacing: {
    description: 'Multi-space formatting in XPath expression — line lookup must still resolve',
    xml: minimalXml,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <out>

      <x><xsl:value-of select="bogus-fn(   'a',    'b',     'c'   )"/></x>
    </out>
  </xsl:template>
</xsl:stylesheet>`,
    expectedLine: 7,
  },

  unknownCpiFunction: {
    description: 'cpi:setHeaders typo (plural) — not a valid CPI function',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="cpi">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <xsl:value-of select="cpi:setHeaders($exchange, 'X-Foo', 'bar')"/>
  </xsl:template>
</xsl:stylesheet>`,
    expectedFragment: 'cpi:setHeaders is not a valid CPI function',
    expectedLine: 8,
  },

  cpiGetter: {
    description: 'cpi:getHeader does not exist in real CPI',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="cpi">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <xsl:value-of select="cpi:getHeader($exchange, 'source')"/>
  </xsl:template>
</xsl:stylesheet>`,
    expectedFragment: 'cpi:getHeader is not a valid CPI function',
    expectedLine: 8,
  },

  wrongArityTwo: {
    description: 'cpi:setHeader called with 2 args instead of 3',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="cpi">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Foo')"/>
  </xsl:template>
</xsl:stylesheet>`,
    expectedFragment: 'requires exactly 3 arguments (got 2)',
    expectedLine: 8,
  },

  missingNamespace: {
    description: 'cpi:setHeader called but xmlns:cpi not declared',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Foo', 'bar')"/>
  </xsl:template>
</xsl:stylesheet>`,
    expectedFragment: 'Missing xmlns:cpi declaration',
  },

  missingExchangeParam: {
    description: 'cpi:setHeader uses $exchange but the param is not declared',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="cpi">
  <xsl:template match="/">
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Foo', 'bar')"/>
  </xsl:template>
</xsl:stylesheet>`,
    expectedFragment: 'Missing <xsl:param name="exchange"/>',
  },

  wrongFirstArg: {
    description: 'cpi:setHeader first arg is a literal instead of $exchange',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="cpi">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <xsl:value-of select="cpi:setHeader('not-an-exchange', 'X-Foo', 'bar')"/>
  </xsl:template>
</xsl:stylesheet>`,
    expectedFragment: 'first argument must be $exchange',
    expectedLine: 8,
  },

  validMinimalCpi: {
    description: 'A minimal correct CPI XSLT must pass validation and run',
    xml: minimalXml,
    xslt: `<?xml version="1.0"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="cpi">
  <xsl:param name="exchange"/>
  <xsl:template match="/">
    <out>
      <xsl:value-of select="cpi:setHeader($exchange, 'X-Foo', 'bar')"/>
    </out>
  </xsl:template>
</xsl:stylesheet>`,
  },
};
