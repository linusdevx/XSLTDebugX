/**
 * Test Data Fixtures for XSLTDebugX E2E Tests
 * Provides reusable sample XML, XSLT, and expected outputs
 */

export const sampleData = {
  // ============ SIMPLE TRANSFORMS ============

  simpleXml: `<?xml version="1.0" encoding="UTF-8"?>
<users>
  <user id="1">
    <name>John Doe</name>
    <email>john@example.com</email>
  </user>
  <user id="2">
    <name>Jane Smith</name>
    <email>jane@example.com</email>
  </user>
</users>`,

  simpleXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <results>
      <xsl:for-each select="//user">
        <user>
          <id><xsl:value-of select="@id"/></id>
          <name><xsl:value-of select="name"/></name>
          <email><xsl:value-of select="email"/></email>
        </user>
      </xsl:for-each>
    </results>
  </xsl:template>
</xsl:stylesheet>`,

  // Expected output contains the same data wrapped
  simpleExpectedOutput: `<?xml version=\"1.0\" encoding=\"UTF-8\"?><results><user><id>1</id><name>John Doe</name><email>john@example.com</email></user><user><id>2</id><name>Jane Smith</name><email>jane@example.com</email></user></results>`,

  // ============ TRANSFORMATIONS WITH xsl:message ============

  xsltWithMessage: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:message>Processing transform</xsl:message>
    <xsl:message select="count(//user) || ' users found'"/>
    <results>
      <xsl:for-each select="//user">
        <user><xsl:value-of select="name"/></user>
      </xsl:for-each>
    </results>
  </xsl:template>
</xsl:stylesheet>`,

  // ============ JSON OUTPUT ============

  jsonXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:text>{
  "users": [</xsl:text>
    <xsl:for-each select="//user">
      <xsl:text>{
    "id": </xsl:text>
      <xsl:value-of select="@id"/>
      <xsl:text>,
    "name": "</xsl:text>
      <xsl:value-of select="name"/>
      <xsl:text>"
  }</xsl:text>
      <xsl:if test="position() != last()">,</xsl:if>
    </xsl:for-each>
    <xsl:text>]
}</xsl:text>
  </xsl:template>
</xsl:stylesheet>`,

  // ============ MALFORMED XML (validation error) ============

  malformedXml: `<?xml version="1.0" encoding="UTF-8"?>
<users>
  <user id="1">
    <name>John Doe
  </user>
</users>`,  // Missing closing </name> tag

  // ============ INVALID XSLT (syntax error) ============

  invalidXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:invalid-element />
  </xsl:template>
</xsl:stylesheet>`,

  // ============ CPI-SPECIFIC XSLT ============

  cpiXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:cpi="http://sap.com/cpi">
  <xsl:param name="authToken" select="''"/>
  <xsl:param name="environment" select="'dev'"/>

  <xsl:template match="/">
    <response>
      <auth_token><xsl:value-of select="$authToken"/></auth_token>
      <env><xsl:value-of select="$environment"/></env>
      <data>
        <xsl:copy-of select="//user[1]"/>
      </data>
    </response>
  </xsl:template>
</xsl:stylesheet>`,

  // ============ XPATH TEST DATA ============

  xmlForXpath: `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1" genre="fiction">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price currency="USD">10.99</price>
  </book>
  <book id="2" genre="mystery">
    <title>The Maltese Falcon</title>
    <author>Dashiell Hammett</author>
    <year>1930</year>
    <price currency="USD">8.99</price>
  </book>
  <book id="3" genre="fiction">
    <title>To Kill a Mockingbird</title>
    <author>Harper Lee</author>
    <year>1960</year>
    <price currency="USD">12.99</price>
  </book>
</catalog>`,

  xpathExpressions: {
    countBooks: "count(//book)",
    countBooksResult: "3",
    firstTitle: "//book[1]/title/text()",
    firstTitleResult: "The Great Gatsby",
    authorsByGenre: "//book[@genre='fiction']/author/text()",
    authorsByGenreCount: 2,
    priceRange: "//price[number(@currency='USD')]",
    priceCount: 3
  },

  // ============ EMPTY/EDGE CASES ============

  emptyXml: `<?xml version="1.0" encoding="UTF-8"?>
<root/>`,

  emptyXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
</xsl:stylesheet>`,

  // ============ LARGE XML (for stress testing) ============

  generateLargeXml(recordCount = 100) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?><records>`;
    for (let i = 1; i <= recordCount; i++) {
      xml += `<record id="${i}"><value>Record ${i}</value></record>`;
    }
    xml += `</records>`;
    return xml;
  },

  // ============ PLAINTEXT OUTPUT ============

  plaintextXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text"/>
  <xsl:template match="/">
    <xsl:text>User Directory
================
</xsl:text>
    <xsl:for-each select="//user">
      <xsl:text>Name: </xsl:text><xsl:value-of select="name"/>
      <xsl:text>&#10;Email: </xsl:text><xsl:value-of select="email"/>
      <xsl:text>&#10;&#10;</xsl:text>
    </xsl:for-each>
  </xsl:template>
</xsl:stylesheet>`,

  // ============ NAMESPACED XML (XPath with namespaces) ============

  namespacedXml: `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns="http://example.com/main" xmlns:custom="http://example.com/custom">
  <item id="1">
    <title>Item 1</title>
    <custom:metadata>
      <custom:author>John</custom:author>
    </custom:metadata>
  </item>
  <item id="2">
    <title>Item 2</title>
    <custom:metadata>
      <custom:author>Jane</custom:author>
    </custom:metadata>
  </item>
</root>`,

  namespacedXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:main="http://example.com/main"
                xmlns:custom="http://example.com/custom">
  <xsl:template match="/">
    <items>
      <xsl:for-each select="//main:item">
        <item>
          <title><xsl:value-of select="main:title"/></title>
          <author><xsl:value-of select="custom:metadata/custom:author"/></author>
        </item>
      </xsl:for-each>
    </items>
  </xsl:template>
</xsl:stylesheet>`,

  // ============ CPI SIMULATION: Headers & Properties ============

  cpiWithSetHeader: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:cpi="http://sap.com/cpi">
  <xsl:template match="/">
    <response>
      <xsl:copy-of select="cpi:setHeader('X-Custom-Header', 'TestValue')"/>
      <data>
        <xsl:value-of select="//user[1]/name"/>
      </data>
    </response>
  </xsl:template>
</xsl:stylesheet>`,

  cpiWithMultipleHeaders: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:cpi="http://sap.com/cpi">
  <xsl:param name="authToken" select="'default-token'"/>
  <xsl:param name="environment" select="'dev'"/>
  
  <xsl:template match="/">
    <response>
      <xsl:copy-of select="cpi:setHeader('Authorization', $authToken)"/>
      <xsl:copy-of select="cpi:setHeader('X-Environment', $environment)"/>
      <xsl:copy-of select="cpi:setProperty('ProcessingStatus', 'COMPLETED')"/>
      <body>
        <xsl:value-of select="count(//user)"/> users processed
      </body>
    </response>
  </xsl:template>
</xsl:stylesheet>`,

  // ============ LARGE PAYLOAD (for share URL testing) ============

  generateLargeXslt(lines = 50) {
    let xslt = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <results>`;
    
    for (let i = 1; i <= lines; i++) {
      xslt += `
      <item id="${i}">
        <value>Item ${i} - Data processing line</value>
        <description>Description for item ${i}</description>
      </item>`;
    }
    
    xslt += `
    </results>
  </xsl:template>
</xsl:stylesheet>`;
    
    return xslt;
  },

  // ============ SAP CPI IDoc EXAMPLE ============

  idocXml: `<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1" SEGMENT="EDI_DC40">
  <EDI_DC40 SEGMENT="1">
    <TABNAM>EDI_DC40</TABNAM>
    <MANDT>100</MANDT>
    <DOCNUM>0000000001234567</DOCNUM>
    <DOCREL>700</DOCREL>
    <STATUS>03</STATUS>
    <DIRECT>1</DIRECT>
    <OUTMOD>2</OUTMOD>
    <IDOCTYP>ORDERS01</IDOCTYP>
  </EDI_DC40>
  <E1EDK01 SEGMENT="1">
    <EBELN>4500000001</EBELN>
    <ERDAT>20230315</ERDAT>
    <ERNAM>TESTUSER</ERNAM>
  </E1EDK01>
</IDOC>`,

  idocTransformXslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:cpi="http://sap.com/cpi">
  <xsl:template match="/">
    <xsl:copy-of select="cpi:setHeader('SAP_Document_Type', 'IDoc')"/>
    <xsl:copy-of select="cpi:setProperty('IDOCTYP', //IDOCTYP)"/>
    <Order>
      <DocumentNumber><xsl:value-of select="//DOCNUM"/></DocumentNumber>
      <PurchaseOrder><xsl:value-of select="//EBELN"/></PurchaseOrder>
      <CreatedDate><xsl:value-of select="//ERDAT"/></CreatedDate>
      <CreatedBy><xsl:value-of select="//ERNAM"/></CreatedBy>
      <ProcessingStatus>Received</ProcessingStatus>
    </Order>
  </xsl:template>
</xsl:stylesheet>`
};

/**
 * Helper to validate XML
 */
export function isValidXml(xml) {
  try {
    new DOMParser().parseFromString(xml, 'text/xml');
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to validate XSLT
 */
export function isValidXslt(xslt) {
  return isValidXml(xslt) && xslt.includes('xsl:stylesheet');
}
