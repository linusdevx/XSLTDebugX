// ════════════════════════════════════════════
//  CATEGORIES — single source of truth for labels, accents and order
// ════════════════════════════════════════════
const CATEGORIES = {
  transform:   { label: 'Data Transformation',    accent: '#3fb950', icon: 'repeat-2' },
  aggregation: { label: 'Aggregation & Splitting', accent: '#f5a524', icon: 'layers' },
  format:      { label: 'Format Conversion',       accent: '#c084fc', icon: 'file-output' },
  advanced:    { label: 'XSLT 3.0 Advanced',      accent: '#e06c75', icon: 'sparkles' },
  cpi:         { label: 'SAP CPI Patterns',        accent: '#0070f2', icon: 'cloud' },
  xpath:       { label: 'XPath Explorer',          accent: '#f5a524', icon: 'crosshair' },
};

// ════════════════════════════════════════════
//  EXAMPLES
// ════════════════════════════════════════════
const EXAMPLES = {

  // ── DATA TRANSFORMATION ──────────────────────────────────────────

  identityTransform: {
    label: 'Identity Transform',
    icon: 'copy',
    desc: 'Copy XML as-is — foundation for all CPI mappings',
    cat:  'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SalesOrder>
  <Header>
    <OrderId>SO-2024-001</OrderId>
    <Customer>C-10042</Customer>
    <OrderDate>2024-03-15</OrderDate>
    <Currency>USD</Currency>
  </Header>
  <Items>
    <Item>
      <LineNo>10</LineNo>
      <Material>MAT-001</Material>
      <Qty>5</Qty>
      <UnitPrice>120.00</UnitPrice>
    </Item>
    <Item>
      <LineNo>20</LineNo>
      <Material>MAT-002</Material>
      <Qty>3</Qty>
      <UnitPrice>85.50</UnitPrice>
    </Item>
  </Items>
</SalesOrder>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Identity Transform — copies every node and attribute unchanged.
    The foundation for all CPI mappings: start here, then override
    only the templates you need to modify.
  -->

  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>`
  },

  renameElements: {
    label: 'Rename Elements & Attributes',
    icon: 'pencil',
    desc: 'Map SAP IDoc MATMAS fields to target REST format',
    cat:  'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<MATMAS>
  <MATNR>000000000000012345</MATNR>
  <MAKTX>Hydraulic Pump 50bar</MAKTX>
  <MEINS>EA</MEINS>
  <MTART>FERT</MTART>
  <MATKL>01010</MATKL>
  <BRGEW>12.500</BRGEW>
  <GEWEI>KG</GEWEI>
  <NTGEW>11.200</NTGEW>
</MATMAS>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Rename SAP MATMAS IDoc fields to a target REST API format.
    Pattern: one template per renamed element using push-style processing.
  -->

  <xsl:template match="MATMAS">
    <MaterialMaster>
      <xsl:apply-templates/>
    </MaterialMaster>
  </xsl:template>

  <xsl:template match="MATNR">
    <materialNumber><xsl:value-of select="normalize-space(.)"/></materialNumber>
  </xsl:template>

  <xsl:template match="MAKTX">
    <description><xsl:value-of select="."/></description>
  </xsl:template>

  <xsl:template match="MEINS">
    <baseUnitOfMeasure><xsl:value-of select="."/></baseUnitOfMeasure>
  </xsl:template>

  <xsl:template match="MTART">
    <materialType><xsl:value-of select="."/></materialType>
  </xsl:template>

  <xsl:template match="MATKL">
    <materialGroup><xsl:value-of select="."/></materialGroup>
  </xsl:template>

  <xsl:template match="BRGEW">
    <grossWeight unit="{../GEWEI}">
      <xsl:value-of select="format-number(xs:decimal(.), '#,##0.000')"/>
    </grossWeight>
  </xsl:template>

  <xsl:template match="NTGEW">
    <netWeight unit="{../GEWEI}">
      <xsl:value-of select="format-number(xs:decimal(.), '#,##0.000')"/>
    </netWeight>
  </xsl:template>

  <!-- Suppress GEWEI — already consumed as attribute above -->
  <xsl:template match="GEWEI"/>

</xsl:stylesheet>`
  },

  filterNodes: {
    label: 'Filter / Conditional Output',
    icon: 'filter',
    desc: 'Keep only nodes matching multi-field conditions',
    cat:  'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Employees>
  <Employee>
    <EmpId>E001</EmpId>
    <Name>Alice Martin</Name>
    <Department>IT</Department>
    <Status>Active</Status>
    <Salary>85000</Salary>
  </Employee>
  <Employee>
    <EmpId>E002</EmpId>
    <Name>Bob Chen</Name>
    <Department>Finance</Department>
    <Status>Inactive</Status>
    <Salary>72000</Salary>
  </Employee>
  <Employee>
    <EmpId>E003</EmpId>
    <Name>Carol Smith</Name>
    <Department>IT</Department>
    <Status>Active</Status>
    <Salary>91000</Salary>
  </Employee>
  <Employee>
    <EmpId>E004</EmpId>
    <Name>David Lee</Name>
    <Department>IT</Department>
    <Status>Active</Status>
    <Salary>67000</Salary>
  </Employee>
</Employees>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Filter: keep only Active IT employees with Salary > 70000.
    Use xsl:apply-templates with a predicate — clean and composable.
    Common in CPI for pre-filtering payloads before routing.
  -->

  <xsl:template match="Employees">
    <ActiveITEmployees count="{count(Employee[Status='Active' and Department='IT' and xs:decimal(Salary) gt 70000])}">
      <xsl:apply-templates select="Employee[
        Status = 'Active' and
        Department = 'IT' and
        xs:decimal(Salary) gt 70000
      ]"/>
    </ActiveITEmployees>
  </xsl:template>

  <xsl:template match="Employee">
    <Employee id="{EmpId}">
      <Name><xsl:value-of select="Name"/></Name>
      <Department><xsl:value-of select="Department"/></Department>
      <Salary currency="USD">
        <xsl:value-of select="format-number(xs:decimal(Salary), '#,##0')"/>
      </Salary>
    </Employee>
  </xsl:template>

</xsl:stylesheet>`
  },

  namespaceHandling: {
    label: 'Namespace Handling',
    icon: 'tag',
    desc: 'Strip ns prefixes, remap namespaces, enrich inline',
    cat:  'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<ns0:Order xmlns:ns0="http://acme.com/order/v1"
           xmlns:ns1="http://acme.com/common/v1">
  <ns0:Header>
    <ns1:Id>ORD-2024-9987</ns1:Id>
    <ns1:Date>2024-11-01</ns1:Date>
    <ns0:Priority>HIGH</ns0:Priority>
  </ns0:Header>
  <ns0:Lines>
    <ns0:Line>
      <ns1:Product>PUMP-50</ns1:Product>
      <ns0:Quantity>2</ns0:Quantity>
      <ns0:Price>1450.00</ns0:Price>
    </ns0:Line>
    <ns0:Line>
      <ns1:Product>VALVE-12</ns1:Product>
      <ns0:Quantity>5</ns0:Quantity>
      <ns0:Price>320.00</ns0:Price>
    </ns0:Line>
  </ns0:Lines>
</ns0:Order>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:ns0="http://acme.com/order/v1"
  xmlns:ns1="http://acme.com/common/v1"
  exclude-result-prefixes="xs ns0 ns1">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Strip incoming namespaces and produce a clean, namespace-free XML.
    Very common in SAP CPI when bridging systems with different namespace conventions.
    Uses local-name() to match regardless of prefix.
  -->

  <xsl:template match="*">
    <xsl:element name="{local-name()}">
      <xsl:apply-templates select="@* | node()"/>
    </xsl:element>
  </xsl:template>

  <!-- Strip namespace-prefixed attributes, keep unprefixed ones -->
  <xsl:template match="@*">
    <xsl:if test="not(contains(name(), ':'))">
      <xsl:copy/>
    </xsl:if>
  </xsl:template>

  <!-- Add computed LineTotal to each Line -->
  <xsl:template match="*[local-name() = 'Line']">
    <Line>
      <xsl:apply-templates select="@* | node()"/>
      <LineTotal>
        <xsl:value-of select="format-number(
          xs:decimal(*[local-name()='Quantity']) * xs:decimal(*[local-name()='Price']),
          '#,##0.00')"/>
      </LineTotal>
    </Line>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── AGGREGATION & SPLITTING ──────────────────────────────────────

  groupBy: {
    label: 'Group-by & Aggregate',
    icon: 'group',
    desc: 'Nested grouping with subtotals — xsl:for-each-group',
    cat:  'aggregation',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SalesData>
  <Sale><Region>North</Region><Product>Pump</Product><Amount>12500</Amount></Sale>
  <Sale><Region>South</Region><Product>Valve</Product><Amount>8300</Amount></Sale>
  <Sale><Region>North</Region><Product>Valve</Product><Amount>4200</Amount></Sale>
  <Sale><Region>South</Region><Product>Pump</Product><Amount>17800</Amount></Sale>
  <Sale><Region>North</Region><Product>Pump</Product><Amount>9100</Amount></Sale>
  <Sale><Region>East</Region><Product>Pipe</Product><Amount>6700</Amount></Sale>
  <Sale><Region>South</Region><Product>Pump</Product><Amount>11200</Amount></Sale>
  <Sale><Region>East</Region><Product>Valve</Product><Amount>5400</Amount></Sale>
</SalesData>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Group sales by Region, compute total and count per group.
    xsl:for-each-group is essential for CPI aggregation scenarios.
    Also demonstrates nested grouping (Region > Product).
  -->

  <xsl:template match="SalesData">
    <SalesSummary generatedAt="{current-dateTime()}">
      <xsl:for-each-group select="Sale" group-by="Region">
        <xsl:sort select="current-grouping-key()"/>
        <Region name="{current-grouping-key()}"
                saleCount="{count(current-group())}">
          <Total>
            <xsl:value-of select="format-number(sum(current-group()/xs:decimal(Amount)), '#,##0.00')"/>
          </Total>
          <xsl:for-each-group select="current-group()" group-by="Product">
            <xsl:sort select="current-grouping-key()"/>
            <Product name="{current-grouping-key()}">
              <xsl:value-of select="format-number(sum(current-group()/xs:decimal(Amount)), '#,##0.00')"/>
            </Product>
          </xsl:for-each-group>
        </Region>
      </xsl:for-each-group>
      <GrandTotal>
        <xsl:value-of select="format-number(sum(Sale/xs:decimal(Amount)), '#,##0.00')"/>
      </GrandTotal>
    </SalesSummary>
  </xsl:template>

</xsl:stylesheet>`
  },

  splitMessage: {
    label: 'Split Message',
    icon: 'scissors',
    desc: 'Wrap each record as standalone message with index',
    cat:  'aggregation',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrders>
  <PurchaseOrder>
    <OrderId>PO-001</OrderId>
    <Vendor>V-100</Vendor>
    <Currency>EUR</Currency>
    <Items>
      <Item><LineNo>10</LineNo><Material>MAT-A</Material><Qty>5</Qty><Price>100</Price></Item>
      <Item><LineNo>20</LineNo><Material>MAT-B</Material><Qty>2</Qty><Price>250</Price></Item>
    </Items>
  </PurchaseOrder>
  <PurchaseOrder>
    <OrderId>PO-002</OrderId>
    <Vendor>V-200</Vendor>
    <Currency>USD</Currency>
    <Items>
      <Item><LineNo>10</LineNo><Material>MAT-C</Material><Qty>10</Qty><Price>75</Price></Item>
    </Items>
  </PurchaseOrder>
</PurchaseOrders>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Split: wrap each PurchaseOrder as a standalone message with envelope.
    In CPI, use this before a Splitter step so each child becomes
    an independent message with its own headers.
    Adds split index and total for downstream tracking.
  -->

  <xsl:variable name="total" select="count(/PurchaseOrders/PurchaseOrder)"/>

  <xsl:template match="/">
    <Messages total="{$total}">
      <xsl:for-each select="PurchaseOrders/PurchaseOrder">
        <Message index="{position()}" of="{$total}">
          <PurchaseOrder>
            <xsl:copy-of select="*"/>
          </PurchaseOrder>
        </Message>
      </xsl:for-each>
    </Messages>
  </xsl:template>

</xsl:stylesheet>`
  },

  mergeMessages: {
    label: 'Merge / Collect Records',
    icon: 'merge',
    desc: 'Flatten nested records, compute open/closed totals',
    cat:  'aggregation',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomerOrders>
  <Customer id="C001">
    <Name>Acme Corp</Name>
    <Orders>
      <Order><Id>ORD-101</Id><Amount>5000</Amount><Status>OPEN</Status></Order>
      <Order><Id>ORD-102</Id><Amount>3200</Amount><Status>CLOSED</Status></Order>
    </Orders>
  </Customer>
  <Customer id="C002">
    <Name>Beta GmbH</Name>
    <Orders>
      <Order><Id>ORD-201</Id><Amount>8900</Amount><Status>OPEN</Status></Order>
    </Orders>
  </Customer>
  <Customer id="C003">
    <Name>Gamma Ltd</Name>
    <Orders>
      <Order><Id>ORD-301</Id><Amount>1200</Amount><Status>OPEN</Status></Order>
      <Order><Id>ORD-302</Id><Amount>4500</Amount><Status>OPEN</Status></Order>
      <Order><Id>ORD-303</Id><Amount>2100</Amount><Status>CLOSED</Status></Order>
    </Orders>
  </Customer>
</CustomerOrders>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Merge/Collect: flatten nested customer orders into a single list.
    Computes open vs closed totals per customer.
    Useful in CPI Gather step post-processing and reporting scenarios.
  -->

  <xsl:template match="CustomerOrders">
    <OrderReport generatedAt="{current-date()}">
      <Summary>
        <TotalCustomers><xsl:value-of select="count(Customer)"/></TotalCustomers>
        <TotalOrders><xsl:value-of select="count(Customer/Orders/Order)"/></TotalOrders>
        <OpenOrders><xsl:value-of select="count(Customer/Orders/Order[Status='OPEN'])"/></OpenOrders>
        <GrandTotal><xsl:value-of select="format-number(sum(Customer/Orders/Order/xs:decimal(Amount)), '#,##0.00')"/></GrandTotal>
      </Summary>
      <Customers>
        <xsl:apply-templates select="Customer"/>
      </Customers>
    </OrderReport>
  </xsl:template>

  <xsl:template match="Customer">
    <Customer id="{@id}" name="{Name}">
      <OpenTotal><xsl:value-of select="format-number(sum(Orders/Order[Status='OPEN']/xs:decimal(Amount)), '#,##0.00')"/></OpenTotal>
      <ClosedTotal><xsl:value-of select="format-number(sum(Orders/Order[Status='CLOSED']/xs:decimal(Amount)), '#,##0.00')"/></ClosedTotal>
      <Orders>
        <xsl:apply-templates select="Orders/Order">
          <xsl:sort select="Status"/>
          <xsl:sort select="xs:decimal(Amount)" order="descending"/>
        </xsl:apply-templates>
      </Orders>
    </Customer>
  </xsl:template>

  <xsl:template match="Order">
    <Order id="{Id}" status="{Status}" amount="{format-number(xs:decimal(Amount), '#,##0.00')}"/>
  </xsl:template>

</xsl:stylesheet>`
  },

  pivotCrossTab: {
    label: 'Pivot / Cross-Tab',
    icon: 'bar-chart-3',
    desc: 'Rotate rows to columns — months as column headers',
    cat:  'aggregation',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<MonthlySales>
  <Entry region="North" month="Jan" amount="12500"/>
  <Entry region="North" month="Feb" amount="14200"/>
  <Entry region="North" month="Mar" amount="11800"/>
  <Entry region="South" month="Jan" amount="9800"/>
  <Entry region="South" month="Feb" amount="10500"/>
  <Entry region="South" month="Mar" amount="13200"/>
  <Entry region="East" month="Jan" amount="7600"/>
  <Entry region="East" month="Feb" amount="8100"/>
  <Entry region="East" month="Mar" amount="9400"/>
</MonthlySales>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Pivot / Cross-Tab: rotate row-oriented data so that months
    become columns and regions become rows. Common for reporting
    transformations where downstream systems expect tabular layout.
  -->

  <xsl:variable name="months" select="distinct-values(/MonthlySales/Entry/@month)"/>

  <xsl:template match="MonthlySales">
    <SalesPivot>
      <xsl:for-each-group select="Entry" group-by="@region">
        <xsl:sort select="current-grouping-key()"/>
        <Region name="{current-grouping-key()}">
          <xsl:for-each select="$months">
            <xsl:variable name="m" select="."/>
            <xsl:variable name="val" select="current-group()[@month = $m]/@amount"/>
            <Month name="{$m}">
              <xsl:value-of select="format-number(xs:decimal($val), '#,##0')"/>
            </Month>
          </xsl:for-each>
          <Total>
            <xsl:value-of select="format-number(sum(current-group()/xs:decimal(@amount)), '#,##0')"/>
          </Total>
        </Region>
      </xsl:for-each-group>
    </SalesPivot>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── FORMAT CONVERSION ────────────────────────────────────────────

  dateFormatting: {
    label: 'Date Format Conversion',
    icon: 'calendar',
    desc: 'SAP YYYYMMDD ↔ ISO 8601 ↔ display formats',
    cat:  'format',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Dates>
  <!-- SAP compact format YYYYMMDD -->
  <SAPDate>20241115</SAPDate>
  <!-- ISO 8601 datetime -->
  <ISODate>2024-11-15T08:30:00Z</ISODate>
  <!-- SAP timestamp YYYYMMDDHHMMSS -->
  <SAPTimestamp>20241115083000</SAPTimestamp>
  <!-- Slash format DD/MM/YYYY -->
  <EUDate>15/11/2024</EUDate>
</Dates>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Date conversion patterns common in SAP CPI integrations.
    SAP uses YYYYMMDD and YYYYMMDDHHMMSS — ISO 8601 is the universal bridge.
  -->

  <xsl:template match="Dates">
    <ConvertedDates>

      <!-- SAP YYYYMMDD → ISO 8601 date -->
      <FromSAP>
        <xsl:variable name="y" select="substring(SAPDate, 1, 4)"/>
        <xsl:variable name="m" select="substring(SAPDate, 5, 2)"/>
        <xsl:variable name="d" select="substring(SAPDate, 7, 2)"/>
        <ISO><xsl:value-of select="concat($y, '-', $m, '-', $d)"/></ISO>
        <Display><xsl:value-of select="concat($d, '/', $m, '/', $y)"/></Display>
      </FromSAP>

      <!-- ISO datetime → date components -->
      <FromISO>
        <xsl:variable name="dt" select="xs:dateTime(ISODate)"/>
        <SAPFormat><xsl:value-of select="format-dateTime($dt, '[Y0001][M01][D01]')"/></SAPFormat>
        <Readable><xsl:value-of select="format-dateTime($dt, '[D01] [MNn] [Y0001]')"/></Readable>
        <TimeOnly><xsl:value-of select="format-dateTime($dt, '[H01]:[m01]:[s01]')"/></TimeOnly>
      </FromISO>

      <!-- SAP Timestamp YYYYMMDDHHMMSS → ISO datetime -->
      <FromSAPTimestamp>
        <xsl:variable name="ts" select="SAPTimestamp"/>
        <ISO><xsl:value-of select="concat(
          substring($ts,1,4),'-',substring($ts,5,2),'-',substring($ts,7,2),
          'T',substring($ts,9,2),':',substring($ts,11,2),':',substring($ts,13,2))"/>
        </ISO>
      </FromSAPTimestamp>

      <!-- Add 30 days to today -->
      <ThirtyDaysFromNow>
        <xsl:value-of select="xs:date(substring-before(ISODate,'T')) + xs:dayTimeDuration('P30D')"/>
      </ThirtyDaysFromNow>

    </ConvertedDates>
  </xsl:template>

</xsl:stylesheet>`
  },

  currencyAmount: {
    label: 'Currency & Amount Formatting',
    icon: 'coins',
    desc: 'format-number, IBAN validation, negative handling',
    cat:  'format',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Payments>
  <Payment>
    <Id>PAY-001</Id>
    <Amount>1234567.891</Amount>
    <Currency>EUR</Currency>
    <IBAN>DE89370400440532013000</IBAN>
  </Payment>
  <Payment>
    <Id>PAY-002</Id>
    <Amount>-500.5</Amount>
    <Currency>USD</Currency>
    <IBAN>GB29NWBK60161331926819</IBAN>
  </Payment>
  <Payment>
    <Id>PAY-003</Id>
    <Amount>notANumber</Amount>
    <Currency>CHF</Currency>
    <IBAN>INVALID-IBAN</IBAN>
  </Payment>
</Payments>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Currency formatting and basic IBAN validation.
    Handles negative amounts, non-numeric input, and invalid IBANs gracefully.
  -->

  <xsl:template match="Payments">
    <ProcessedPayments>
      <xsl:apply-templates select="Payment"/>
    </ProcessedPayments>
  </xsl:template>

  <xsl:template match="Payment">
    <xsl:variable name="valid" select="Amount castable as xs:decimal"/>
    <Payment id="{Id}">
      <Amount>
        <xsl:choose>
          <xsl:when test="$valid">
            <xsl:value-of select="format-number(xs:decimal(Amount), '#,##0.00')"/>
          </xsl:when>
          <xsl:otherwise>INVALID: <xsl:value-of select="Amount"/></xsl:otherwise>
        </xsl:choose>
      </Amount>
      <Currency><xsl:value-of select="Currency"/></Currency>
      <AbsoluteAmount>
        <xsl:if test="$valid">
          <xsl:value-of select="format-number(abs(xs:decimal(Amount)), '#,##0.00')"/>
        </xsl:if>
      </AbsoluteAmount>
      <IBAN>
        <xsl:variable name="stripped" select="translate(IBAN, ' ', '')"/>
        <xsl:choose>
          <xsl:when test="string-length($stripped) >= 15 and string-length($stripped) &lt;= 34
                          and matches($stripped, '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$')">
            <xsl:value-of select="$stripped"/>
          </xsl:when>
          <xsl:otherwise>INVALID: <xsl:value-of select="IBAN"/></xsl:otherwise>
        </xsl:choose>
      </IBAN>
      <Status>
        <xsl:value-of select="if ($valid and xs:decimal(Amount) gt 0) then 'VALID' else 'REVIEW'"/>
      </Status>
    </Payment>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── SAP CPI PATTERNS ─────────────────────────────────────────────

  idocToXml: {
    label: 'IDoc ORDERS05 → Custom XML',
    icon: 'file-text',
    desc: 'Full IDoc parse: control record, header, vendor, items',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS05>
  <IDOC BEGIN="1">
    <EDI_DC40 SEGMENT="1">
      <TABNAM>EDI_DC40</TABNAM>
      <MANDT>100</MANDT>
      <DOCNUM>0000000000012345</DOCNUM>
      <IDOCTYP>ORDERS05</IDOCTYP>
      <MESTYP>ORDERS</MESTYP>
      <SNDPOR>SAPDEV</SNDPOR>
      <RCVPOR>PARTNER</RCVPOR>
      <CREDAT>20241115</CREDAT>
      <CRETIM>093045</CRETIM>
    </EDI_DC40>
    <E1EDK01 SEGMENT="1">
      <ACTION>004</ACTION>
      <BSART>NB</BSART>
      <BELNR>4500012345</BELNR>
      <NTGEW>25.000</NTGEW>
      <BRGEW>27.500</BRGEW>
      <GEWEI>KG</GEWEI>
    </E1EDK01>
    <E1EDKA1 SEGMENT="1">
      <PARVW>LF</PARVW>
      <PARTN>V-100042</PARTN>
      <LIFNR>V-100042</LIFNR>
      <NAME1>Acme Suppliers GmbH</NAME1>
      <NAME2>Procurement Dept</NAME2>
      <STRAS>Industriestr 42</STRAS>
      <ORT01>Frankfurt</ORT01>
      <PSTLZ>60528</PSTLZ>
      <LAND1>DE</LAND1>
    </E1EDKA1>
    <E1EDP01 SEGMENT="1">
      <POSEX>000010</POSEX>
      <MATNR>000000000000012345</MATNR>
      <MAKTX>Hydraulic Pump 50bar</MAKTX>
      <MENGE>5.000</MENGE>
      <MENEE>EA</MENEE>
      <NETWR>5750.00</NETWR>
      <WAERS>EUR</WAERS>
    </E1EDP01>
    <E1EDP01 SEGMENT="1">
      <POSEX>000020</POSEX>
      <MATNR>000000000000067890</MATNR>
      <MAKTX>Control Valve DN50</MAKTX>
      <MENGE>10.000</MENGE>
      <MENEE>EA</MENEE>
      <NETWR>1200.00</NETWR>
      <WAERS>EUR</WAERS>
    </E1EDP01>
  </IDOC>
</ORDERS05>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Transform SAP IDoc ORDERS05 to a canonical Purchase Order XML
    for downstream REST/SOAP systems.
    Maps control record (EDI_DC40), header (E1EDK01), partner (E1EDKA1)
    and line items (E1EDP01).
  -->

  <xsl:template match="ORDERS05">
    <xsl:apply-templates select="IDOC"/>
  </xsl:template>

  <xsl:template match="IDOC">
    <xsl:variable name="dc"     select="EDI_DC40"/>
    <xsl:variable name="header" select="E1EDK01"/>
    <xsl:variable name="vendor" select="E1EDKA1[PARVW='LF']"/>

    <PurchaseOrder>
      <DocumentNumber><xsl:value-of select="normalize-space($dc/DOCNUM)"/></DocumentNumber>
      <OrderNumber><xsl:value-of select="$header/BELNR"/></OrderNumber>
      <OrderType><xsl:value-of select="$header/BSART"/></OrderType>
      <CreatedAt>
        <xsl:value-of select="concat(
          substring($dc/CREDAT,1,4),'-',
          substring($dc/CREDAT,5,2),'-',
          substring($dc/CREDAT,7,2),'T',
          substring($dc/CRETIM,1,2),':',
          substring($dc/CRETIM,3,2),':',
          substring($dc/CRETIM,5,2))"/>
      </CreatedAt>

      <Vendor id="{$vendor/LIFNR}">
        <Name><xsl:value-of select="$vendor/NAME1"/></Name>
        <Department><xsl:value-of select="$vendor/NAME2"/></Department>
        <Address>
          <Street><xsl:value-of select="$vendor/STRAS"/></Street>
          <City><xsl:value-of select="$vendor/ORT01"/></City>
          <PostalCode><xsl:value-of select="$vendor/PSTLZ"/></PostalCode>
          <Country><xsl:value-of select="$vendor/LAND1"/></Country>
        </Address>
      </Vendor>

      <LineItems count="{count(E1EDP01)}">
        <xsl:apply-templates select="E1EDP01"/>
      </LineItems>

      <Totals>
        <NetValue currency="{E1EDP01[1]/WAERS}">
          <xsl:value-of select="format-number(sum(E1EDP01/xs:decimal(NETWR)), '#,##0.00')"/>
        </NetValue>
      </Totals>
    </PurchaseOrder>
  </xsl:template>

  <xsl:template match="E1EDP01">
    <Item line="{normalize-space(POSEX)}">
      <MaterialNumber><xsl:value-of select="normalize-space(MATNR)"/></MaterialNumber>
      <Description><xsl:value-of select="MAKTX"/></Description>
      <Quantity unit="{MENEE}"><xsl:value-of select="format-number(xs:decimal(MENGE), '#,##0.###')"/></Quantity>
      <NetValue currency="{WAERS}"><xsl:value-of select="format-number(xs:decimal(NETWR), '#,##0.00')"/></NetValue>
      <UnitPrice currency="{WAERS}">
        <xsl:value-of select="format-number(xs:decimal(NETWR) div xs:decimal(MENGE), '#,##0.00')"/>
      </UnitPrice>
    </Item>
  </xsl:template>

</xsl:stylesheet>`
  },

  lookupEnrich: {
    label: 'Value Mapping / Lookup',
    icon: 'link',
    desc: 'Inline lookup tables — replaces CPI Value Mapping step',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Orders>
  <Order>
    <Id>ORD-001</Id>
    <StatusCode>A</StatusCode>
    <PriorityCode>1</PriorityCode>
    <CountryCode>DE</CountryCode>
  </Order>
  <Order>
    <Id>ORD-002</Id>
    <StatusCode>B</StatusCode>
    <PriorityCode>2</PriorityCode>
    <CountryCode>US</CountryCode>
  </Order>
  <Order>
    <Id>ORD-003</Id>
    <StatusCode>X</StatusCode>
    <PriorityCode>9</PriorityCode>
    <CountryCode>JP</CountryCode>
  </Order>
</Orders>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  exclude-result-prefixes="#all">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Value Mapping using inline lookup tables (xsl:key + document fragment).
    Replaces SAP CPI Value Mapping iFlow step inline — useful for small,
    stable mappings you want to keep in the stylesheet itself.
  -->

  <!-- Inline lookup table as a variable -->
  <xsl:variable name="statusMap">
    <entry code="A" label="Active"    target="ACTIVE"/>
    <entry code="B" label="Blocked"   target="BLOCKED"/>
    <entry code="C" label="Closed"    target="CLOSED"/>
    <entry code="D" label="Deleted"   target="DELETED"/>
  </xsl:variable>

  <xsl:variable name="priorityMap">
    <entry code="1" label="Critical"  sla="4h"/>
    <entry code="2" label="High"      sla="8h"/>
    <entry code="3" label="Medium"    sla="24h"/>
    <entry code="4" label="Low"       sla="72h"/>
  </xsl:variable>

  <xsl:variable name="countryMap">
    <entry code="DE" name="Germany"        region="EMEA"/>
    <entry code="US" name="United States"  region="AMER"/>
    <entry code="GB" name="United Kingdom" region="EMEA"/>
    <entry code="JP" name="Japan"          region="APAC"/>
    <entry code="CN" name="China"          region="APAC"/>
  </xsl:variable>

  <xsl:template match="Orders">
    <EnrichedOrders>
      <xsl:apply-templates select="Order"/>
    </EnrichedOrders>
  </xsl:template>

  <xsl:template match="Order">
    <xsl:variable name="status"   select="$statusMap/entry[@code = current()/StatusCode]"/>
    <xsl:variable name="priority" select="$priorityMap/entry[@code = current()/PriorityCode]"/>
    <xsl:variable name="country"  select="$countryMap/entry[@code = current()/CountryCode]"/>

    <Order id="{Id}">
      <Status code="{StatusCode}" target="{$status/@target}">
        <xsl:value-of select="if ($status) then $status/@label else concat('UNKNOWN(', StatusCode, ')')"/>
      </Status>
      <Priority code="{PriorityCode}" sla="{$priority/@sla}">
        <xsl:value-of select="if ($priority) then $priority/@label else concat('UNKNOWN(', PriorityCode, ')')"/>
      </Priority>
      <Country code="{CountryCode}" region="{$country/@region}">
        <xsl:value-of select="if ($country) then $country/@name else concat('UNKNOWN(', CountryCode, ')')"/>
      </Country>
    </Order>
  </xsl:template>

</xsl:stylesheet>`
  },

  cpiGetSet: {
    label: 'CPI Headers & Properties (Complete)',
    icon: 'refresh-cw',
    desc: 'Set + Get headers/properties with console debugging',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomerOrder>
  <Header>
    <OrderId>ORD-2024-99142</OrderId>
    <CustomerId>C-10042</CustomerId>
    <CustomerTier>GOLD</CustomerTier>
    <OrderDate>2024-03-26</OrderDate>
    <TotalAmount>4250.00</TotalAmount>
    <Currency>EUR</Currency>
  </Header>
  <Items>
    <Item>
      <SkuId>SKU-001</SkuId>
      <ProductName>Industrial Sensor XR20</ProductName>
      <Qty>10</Qty>
      <UnitPrice>125.00</UnitPrice>
    </Item>
    <Item>
      <SkuId>SKU-002</SkuId>
      <ProductName>Control Module CM50</ProductName>
      <Qty>5</Qty>
      <UnitPrice>450.00</UnitPrice>
    </Item>
  </Items>
</CustomerOrder>`,
    headers: [['source', 'WEBSHOP'], ['channel', 'B2B']],
    properties: [['environment', 'PROD'], ['maxRetries', '3']],
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="xs cpi">
  <xsl:output method="xml" indent="yes"/>

  <!--
    CPI Headers & Properties: get/set headers and exchange properties.
    Demonstrates routing logic based on customer tier and source channel.
    Uses xsl:message for console debugging of intermediate values.
  -->

  <!-- ═══════ INPUT PARAMETERS ═══════════════════════════════════ -->
  <!--
    $exchange: always provided by CPI runtime — reference to the message exchange object
    Below params map to:
      - Headers:    source, channel (from CPI message headers)
      - Properties: environment, maxRetries (from CPI exchange properties)
  -->
  <xsl:param name="exchange"/>
  <xsl:param name="source"      select="'UNKNOWN'"/>  <!-- Incoming header: source system  -->
  <xsl:param name="channel"     select="'UNKNOWN'"/>  <!-- Incoming header: B2B or B2C     -->
  <xsl:param name="environment" select="'DEV'"/>      <!-- Incoming property: DEV/QA/PROD  -->
  <xsl:param name="maxRetries"  select="'1'"/>        <!-- Incoming property: retry limit  -->


  <!-- ═══════ MAIN TEMPLATE ══════════════════════════════════════ -->
  <xsl:template match="/CustomerOrder">
    <!-- ─── STEP 1: Retrieve incoming header values via cpi:getHeader() ─── -->
    <xsl:variable name="incomingSource"  select="cpi:getHeader($exchange, 'source')"/>
    <xsl:variable name="incomingChannel" select="cpi:getHeader($exchange, 'channel')"/>

    <!-- ─── Console Debug: Show incoming values ─── -->
    <xsl:message>
      <xsl:text>🔵 [DEBUG] Incoming Headers: </xsl:text>
      <xsl:text>source=</xsl:text><xsl:value-of select="$incomingSource"/>
      <xsl:text>, channel=</xsl:text><xsl:value-of select="$incomingChannel"/>
    </xsl:message>


    <!-- ─── STEP 2: Retrieve incoming property values via cpi:getProperty() ─── -->
    <xsl:variable name="env"      select="cpi:getProperty($exchange, 'environment')"/>
    <xsl:variable name="retries"  select="cpi:getProperty($exchange, 'maxRetries')"/>

    <!-- ─── Console Debug: Show incoming properties ─── -->
    <xsl:message>
      <xsl:text>🟢 [DEBUG] Incoming Properties: </xsl:text>
      <xsl:text>environment=</xsl:text><xsl:value-of select="$env"/>
      <xsl:text>, maxRetries=</xsl:text><xsl:value-of select="$retries"/>
    </xsl:message>


    <!-- ─── STEP 3: Extract payload data for business logic ─── -->
    <xsl:variable name="tier"    select="Header/CustomerTier"/>
    <xsl:variable name="orderId" select="Header/OrderId"/>
    <xsl:variable name="amount"  select="xs:decimal(Header/TotalAmount)"/>

    <!-- ─── Console Debug: Show extracted payload values ─── -->
    <xsl:message>
      <xsl:text>📦 [DEBUG] Payload Values: </xsl:text>
      <xsl:text>OrderId=</xsl:text><xsl:value-of select="$orderId"/>
      <xsl:text>, Tier=</xsl:text><xsl:value-of select="$tier"/>
      <xsl:text>, Amount=</xsl:text><xsl:value-of select="$amount"/>
    </xsl:message>


    <!-- ─── STEP 4: Business Logic — Determine routing and priority ─── -->
    <!--
      BUSINESS RULES:
        - GOLD tier + amount > 1000  → Priority=HIGH,  Route=EXPRESS
        - SILVER tier                 → Priority=MED,   Route=STANDARD
        - BRONZE tier or low amount   → Priority=LOW,   Route=ECONOMY

      Priority header: used by downstream system for SLA handling
      Route header:    used by CPI Router step to branch to different receivers
    -->
    <xsl:variable name="priority" select="
      if ($tier = 'GOLD' and $amount gt 1000) then 'HIGH'
      else if ($tier = 'SILVER') then 'MEDIUM'
      else 'LOW'"/>

    <xsl:variable name="route" select="
      if ($tier = 'GOLD' and $amount gt 1000) then 'EXPRESS'
      else if ($tier = 'SILVER') then 'STANDARD'
      else 'ECONOMY'"/>

    <!-- ─── Console Debug: Show calculated routing ─── -->
    <xsl:message>
      <xsl:text>🧮 [DEBUG] Calculated Routing: </xsl:text>
      <xsl:text>Priority=</xsl:text><xsl:value-of select="$priority"/>
      <xsl:text>, Route=</xsl:text><xsl:value-of select="$route"/>
    </xsl:message>


    <!-- ─── STEP 5: SET HEADERS for downstream systems (via HTTP headers or SOAP headers) ─── -->
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Order-Id',      $orderId)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Priority',      $priority)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Route',         $route)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'X-Customer-Tier', $tier)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'Content-Type',    'application/xml')"/>

    <!-- ─── Console Debug: Confirm headers set ─── -->
    <xsl:message>
      <xsl:text>✅ [DEBUG] Headers SET: </xsl:text>
      <xsl:text>X-Order-Id=</xsl:text><xsl:value-of select="$orderId"/>
      <xsl:text>, X-Priority=</xsl:text><xsl:value-of select="$priority"/>
      <xsl:text>, X-Route=</xsl:text><xsl:value-of select="$route"/>
    </xsl:message>


    <!-- ─── STEP 6: SET PROPERTIES for CPI-internal tracking (audit, logging, flow control) ─── -->
    <xsl:value-of select="cpi:setProperty($exchange, 'processedBy',   'XSLTDebugX-Demo')"/>
    <xsl:value-of select="cpi:setProperty($exchange, 'tier',          $tier)"/>
    <xsl:value-of select="cpi:setProperty($exchange, 'orderAmount',   string($amount))"/>
    <xsl:value-of select="cpi:setProperty($exchange, 'routeDecision', $route)"/>

    <!-- ─── Console Debug: Confirm properties set ─── -->
    <xsl:message>
      <xsl:text>✅ [DEBUG] Properties SET: </xsl:text>
      <xsl:text>processedBy=XSLTDebugX-Demo, tier=</xsl:text><xsl:value-of select="$tier"/>
      <xsl:text>, orderAmount=</xsl:text><xsl:value-of select="$amount"/>
    </xsl:message>


    <!-- ─── STEP 7: Transform the payload ─── -->
    <ProcessedOrder>
      <Metadata>
        <OrderId><xsl:value-of select="$orderId"/></OrderId>
        <Source><xsl:value-of select="$incomingSource"/></Source>
        <Channel><xsl:value-of select="$incomingChannel"/></Channel>
        <Environment><xsl:value-of select="$env"/></Environment>
        <Priority><xsl:value-of select="$priority"/></Priority>
        <Route><xsl:value-of select="$route"/></Route>
        <ProcessedTimestamp><xsl:value-of select="current-dateTime()"/></ProcessedTimestamp>
      </Metadata>
      <Customer>
        <CustomerId><xsl:value-of select="Header/CustomerId"/></CustomerId>
        <Tier><xsl:value-of select="$tier"/></Tier>
      </Customer>
      <OrderSummary>
        <ItemCount><xsl:value-of select="count(Items/Item)"/></ItemCount>
        <TotalAmount currency="{Header/Currency}">
          <xsl:value-of select="Header/TotalAmount"/>
        </TotalAmount>
      </OrderSummary>
      <Items>
        <xsl:apply-templates select="Items/Item"/>
      </Items>
    </ProcessedOrder>

    <!-- ─── Final Console Debug: Transformation complete ─── -->
    <xsl:message>
      <xsl:text>✅ [DEBUG] Transformation COMPLETE. Order </xsl:text>
      <xsl:value-of select="$orderId"/>
      <xsl:text> routed to: </xsl:text>
      <xsl:value-of select="$route"/>
    </xsl:message>
  </xsl:template>


  <!-- ═══════ ITEM TEMPLATE ══════════════════════════════════════ -->
  <xsl:template match="Item">
    <Item>
      <SKU><xsl:value-of select="SkuId"/></SKU>
      <Product><xsl:value-of select="ProductName"/></Product>
      <Quantity><xsl:value-of select="Qty"/></Quantity>
      <UnitPrice><xsl:value-of select="UnitPrice"/></UnitPrice>
      <LineTotal>
        <xsl:value-of select="format-number(xs:decimal(Qty) * xs:decimal(UnitPrice), '#,##0.00')"/>
      </LineTotal>
    </Item>
  </xsl:template>

</xsl:stylesheet>`
  },

  errorHandling: {
    label: 'Error Handling (xsl:try)',
    icon: 'shield',
    desc: 'Per-field try/catch with fallback — XSLT 3.0 resilience',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Transactions>
  <Transaction>
    <Id>TXN-001</Id>
    <Amount>1250.75</Amount>
    <Date>2024-11-15</Date>
    <Type>CREDIT</Type>
  </Transaction>
  <Transaction>
    <Id>TXN-002</Id>
    <Amount>NOT_A_NUMBER</Amount>
    <Date>invalid-date</Date>
    <Type>DEBIT</Type>
  </Transaction>
  <Transaction>
    <Id>TXN-003</Id>
    <Amount>-500.00</Amount>
    <Date>2024-11-16</Date>
    <Type>UNKNOWN_TYPE</Type>
  </Transaction>
</Transactions>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:err="http://www.w3.org/2005/xqt-errors"
  exclude-result-prefixes="xs err">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Error handling with xsl:try / xsl:catch — XSLT 3.0 only.
    Each field is wrapped individually so one bad value doesn't
    fail the whole message. Critical for CPI resilience patterns.
  -->

  <xsl:template match="Transactions">
    <ProcessedTransactions>
      <xsl:apply-templates select="Transaction"/>
    </ProcessedTransactions>
  </xsl:template>

  <xsl:template match="Transaction">
    <Transaction id="{Id}">

      <!-- Safe decimal cast -->
      <Amount>
        <xsl:try>
          <xsl:variable name="amt" select="xs:decimal(Amount)"/>
          <xsl:attribute name="status">OK</xsl:attribute>
          <xsl:value-of select="format-number(abs($amt), '#,##0.00')"/>
          <xsl:catch errors="*">
            <xsl:attribute name="status">ERROR</xsl:attribute>
            <xsl:attribute name="error"><xsl:value-of select="$err:description"/></xsl:attribute>
            <xsl:value-of select="Amount"/>
          </xsl:catch>
        </xsl:try>
      </Amount>

      <!-- Safe date cast -->
      <Date>
        <xsl:try>
          <xsl:variable name="d" select="xs:date(Date)"/>
          <xsl:attribute name="status">OK</xsl:attribute>
          <xsl:value-of select="format-date($d, '[D01]-[MNn,3-3]-[Y0001]')"/>
          <xsl:catch errors="*">
            <xsl:attribute name="status">ERROR</xsl:attribute>
            <xsl:value-of select="Date"/>
          </xsl:catch>
        </xsl:try>
      </Date>

      <!-- Controlled vocabulary check -->
      <Type>
        <xsl:variable name="allowed" select="('CREDIT','DEBIT','TRANSFER','FEE')"/>
        <xsl:choose>
          <xsl:when test="Type = $allowed">
            <xsl:attribute name="valid">true</xsl:attribute>
            <xsl:value-of select="Type"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:attribute name="valid">false</xsl:attribute>
            <xsl:attribute name="error">Not in allowed values</xsl:attribute>
            <xsl:value-of select="Type"/>
          </xsl:otherwise>
        </xsl:choose>
      </Type>

    </Transaction>
  </xsl:template>

</xsl:stylesheet>`
  },

  batchProcessing: {
    label: 'Batch Processing (SuccessFactors)',
    icon: 'folder-open',
    desc: 'OData $batch for EmpEmployment + EmpJob UPSERT',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<FormHeader>
  <FormHeader>
    <formSubjectId>user001</formSubjectId>
    <formTemplateId>PIP_TEMPLATE_01</formTemplateId>
    <creationDate>2024-11-15T09:00:00</creationDate>
    <formSubject>
      <User>
        <empInfo>
          <EmpEmployment>
            <personIdExternal>EXT-001</personIdExternal>
            <jobInfoNav>
              <EmpJob>
                <employeeClassNav>
                  <PicklistOption>
                    <externalCode>4</externalCode>
                  </PicklistOption>
                </employeeClassNav>
              </EmpJob>
            </jobInfoNav>
          </EmpEmployment>
        </empInfo>
      </User>
    </formSubject>
  </FormHeader>
  <FormHeader>
    <formSubjectId>user002</formSubjectId>
    <formTemplateId>CF_TEMPLATE_01</formTemplateId>
    <creationDate>2024-11-16T10:30:00</creationDate>
    <formSubject>
      <User>
        <empInfo>
          <EmpEmployment>
            <personIdExternal>EXT-002</personIdExternal>
            <jobInfoNav>
              <EmpJob>
                <employeeClassNav>
                  <PicklistOption>
                    <externalCode>4</externalCode>
                  </PicklistOption>
                </employeeClassNav>
              </EmpJob>
            </jobInfoNav>
          </EmpEmployment>
        </empInfo>
      </User>
    </formSubject>
  </FormHeader>
  <FormHeader>
    <formSubjectId>user003</formSubjectId>
    <formTemplateId>PIP_TEMPLATE_01</formTemplateId>
    <creationDate>2024-11-17T08:15:00</creationDate>
    <formSubject>
      <User>
        <empInfo>
          <EmpEmployment>
            <personIdExternal>EXT-003</personIdExternal>
            <jobInfoNav>
              <EmpJob>
                <employeeClassNav>
                  <PicklistOption>
                    <externalCode>3</externalCode>
                  </PicklistOption>
                </employeeClassNav>
              </EmpJob>
            </jobInfoNav>
          </EmpEmployment>
        </empInfo>
      </User>
    </formSubject>
  </FormHeader>
</FormHeader>`,
    headers: [['PIPFlag_OptionID', 'OPT_PIP_01'], ['CF_TemplateID', 'CF_TEMPLATE_01'], ['PIP_TemplateID', 'PIP_TEMPLATE_01']],
    properties: [['batchMode', 'UPSERT']],
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>

  <!--
    SAP SuccessFactors OData Batch Processing.
    Transforms performance form data into a $batch payload for
    EmpEmployment and EmpJob upsert operations.

    PIPFlag_OptionID — the option ID to stamp on PIP/CF forms
    PIP_TemplateID   — form template ID for PIP (Performance Improvement Plan)
    CF_TemplateID    — form template ID for Confirmation forms

    Only employees with employeeClass externalCode = '4' (probationary)
    receive an additional EmpJob batchChangeSetPart with probation end dates:
      PIP → +90 days from creation
      CF  → +30 days from creation
  -->

  <xsl:param name="PIPFlag_OptionID"/>
  <xsl:param name="CF_TemplateID"/>
  <xsl:param name="PIP_TemplateID"/>

  <xsl:template match="/FormHeader">
    <batchParts>
      <xsl:for-each select="FormHeader">
        <batchChangeSet>

          <!-- Always: upsert EmpEmployment with PIP/CF flag -->
          <batchChangeSetPart>
            <method>UPSERT</method>
            <EmpEmployment>
              <EmpEmployment>
                <personIdExternal>
                  <xsl:value-of select="formSubject/User/empInfo/EmpEmployment/personIdExternal"/>
                </personIdExternal>
                <userId><xsl:value-of select="formSubjectId"/></userId>
                <xsl:if test="formTemplateId = $PIP_TemplateID">
                  <customString34><xsl:value-of select="$PIPFlag_OptionID"/></customString34>
                </xsl:if>
                <xsl:if test="formTemplateId = $CF_TemplateID">
                  <customString35><xsl:value-of select="$PIPFlag_OptionID"/></customString35>
                </xsl:if>
              </EmpEmployment>
            </EmpEmployment>
          </batchChangeSetPart>

          <!-- Conditional: probationary employees (externalCode=4) get EmpJob update -->
          <xsl:if test="formSubject/User/empInfo/EmpEmployment/jobInfoNav/EmpJob/employeeClassNav/PicklistOption/externalCode = '4'">
            <batchChangeSetPart>
              <method>UPSERT</method>
              <EmpJob>
                <EmpJob>
                  <seqNumber>1</seqNumber>
                  <userId><xsl:value-of select="formSubjectId"/></userId>
                  <startDate><xsl:value-of select="creationDate"/></startDate>
                  <xsl:if test="formTemplateId = $PIP_TemplateID">
                    <probationPeriodEndDate>
                      <xsl:value-of select="xs:date(substring-before(creationDate, 'T')) + xs:dayTimeDuration('P90D')"/>
                    </probationPeriodEndDate>
                  </xsl:if>
                  <xsl:if test="formTemplateId = $CF_TemplateID">
                    <probationPeriodEndDate>
                      <xsl:value-of select="xs:date(substring-before(creationDate, 'T')) + xs:dayTimeDuration('P30D')"/>
                    </probationPeriodEndDate>
                  </xsl:if>
                  <eventReason>0909</eventReason>
                </EmpJob>
              </EmpJob>
            </batchChangeSetPart>
          </xsl:if>

        </batchChangeSet>
      </xsl:for-each>
    </batchParts>
  </xsl:template>

</xsl:stylesheet>`
  },

  multiCurrencyReport: {
    label: 'Multi-Currency Consolidation',
    icon: 'banknote',
    desc: 'Convert to base currency, group by currency code',
    cat:  'format',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoices baseCurrency="EUR">
  <Invoice>
    <Id>INV-001</Id><Vendor>Acme US</Vendor>
    <Amount>5000.00</Amount><Currency>USD</Currency><Rate>0.92</Rate>
  </Invoice>
  <Invoice>
    <Id>INV-002</Id><Vendor>Beta UK</Vendor>
    <Amount>3200.00</Amount><Currency>GBP</Currency><Rate>1.17</Rate>
  </Invoice>
  <Invoice>
    <Id>INV-003</Id><Vendor>Gamma DE</Vendor>
    <Amount>2800.00</Amount><Currency>EUR</Currency><Rate>1.00</Rate>
  </Invoice>
  <Invoice>
    <Id>INV-004</Id><Vendor>Delta JP</Vendor>
    <Amount>450000</Amount><Currency>JPY</Currency><Rate>0.0062</Rate>
  </Invoice>
</Invoices>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Multi-currency invoice consolidation.
    Converts all invoice amounts to base currency (EUR) using inline rates,
    then groups and sums by currency for a treasury report.
    Common in SAP CPI finance integration scenarios.
  -->

  <xsl:template match="Invoices">
    <xsl:variable name="baseCcy" select="@baseCurrency"/>
    <ConsolidatedReport baseCurrency="{$baseCcy}" generatedAt="{current-date()}">

      <InvoiceDetails>
        <xsl:for-each select="Invoice">
          <Invoice id="{Id}" vendor="{Vendor}">
            <OriginalAmount currency="{Currency}">
              <xsl:value-of select="format-number(xs:decimal(Amount), '#,##0.00')"/>
            </OriginalAmount>
            <BaseAmount currency="{$baseCcy}">
              <xsl:value-of select="format-number(xs:decimal(Amount) * xs:decimal(Rate), '#,##0.00')"/>
            </BaseAmount>
            <ExchangeRate><xsl:value-of select="Rate"/></ExchangeRate>
          </Invoice>
        </xsl:for-each>
      </InvoiceDetails>

      <CurrencyBreakdown>
        <xsl:for-each-group select="Invoice" group-by="Currency">
          <xsl:sort select="current-grouping-key()"/>
          <Group currency="{current-grouping-key()}" count="{count(current-group())}">
            <OriginalTotal>
              <xsl:value-of select="format-number(sum(current-group()/xs:decimal(Amount)), '#,##0.00')"/>
            </OriginalTotal>
            <BaseTotal currency="{$baseCcy}">
              <xsl:value-of select="format-number(sum(current-group()/(xs:decimal(Amount)*xs:decimal(Rate))), '#,##0.00')"/>
            </BaseTotal>
          </Group>
        </xsl:for-each-group>
      </CurrencyBreakdown>

      <GrandTotal currency="{$baseCcy}">
        <xsl:value-of select="format-number(sum(Invoice/(xs:decimal(Amount)*xs:decimal(Rate))), '#,##0.00')"/>
      </GrandTotal>

    </ConsolidatedReport>
  </xsl:template>

</xsl:stylesheet>`
  }
,

  batchKeyRecovery: {
    label: 'Batch Key Recovery (SuccessFactors)',
    icon: 'key',
    desc: 'Re-inject saved keys into $batch response by position',
    cat:  'cpi',
    properties: [['Batch_Key', 'userId=20655282;userId=20654955']],
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<batchPartResponse>
  <batchChangeSetResponse>
    <batchChangeSetPartResponse>
      <headers>
        <Content-Length>753</Content-Length>
        <DataServiceVersion>1.0</DataServiceVersion>
        <Content-Type>application/atom+xml;charset=utf-8</Content-Type>
        <successfactors-message>successfactors-sourcetype is missing in request headers</successfactors-message>
      </headers>
      <statusInfo>OK</statusInfo>
      <contentId/>
      <body><UpsertResponses><EmpEmployment><key>EmpEmployment/personIdExternal=20655282,EmpEmployment/userId=20655282</key><status>OK</status><editStatus>UPSERTED</editStatus><message>[Warning!] This record was not saved because there were no new changes compared to the existing record.</message><index type="Edm.Int32">0</index><httpCode type="Edm.Int32">200</httpCode><inlineResults type="Bag(SFOData.UpsertResult)"/></EmpEmployment></UpsertResponses></body>
      <statusCode>200</statusCode>
    </batchChangeSetPartResponse>
  </batchChangeSetResponse>
  <batchChangeSetResponse>
    <batchChangeSetPartResponse>
      <headers>
        <Content-Length>753</Content-Length>
        <DataServiceVersion>1.0</DataServiceVersion>
        <Content-Type>application/atom+xml;charset=utf-8</Content-Type>
        <successfactors-message>successfactors-sourcetype is missing in request headers</successfactors-message>
      </headers>
      <statusInfo>OK</statusInfo>
      <contentId/>
      <body><UpsertResponses><EmpEmployment><key>EmpEmployment/personIdExternal=20654955,EmpEmployment/userId=20654955</key><status>OK</status><editStatus>UPSERTED</editStatus><message>[Warning!] This record was not saved because there were no new changes compared to the existing record.</message><index type="Edm.Int32">0</index><httpCode type="Edm.Int32">200</httpCode><inlineResults type="Bag(SFOData.UpsertResult)"/></EmpEmployment></UpsertResponses></body>
      <statusCode>200</statusCode>
    </batchChangeSetPartResponse>
  </batchChangeSetResponse>
</batchPartResponse>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes" omit-xml-declaration="yes"/>

  <!--
    SAP SuccessFactors Batch Key Recovery.

    PROBLEM: When a $batch request fails, the error response often omits the
    entity keys (personIdExternal / userId) making it impossible to know
    which records failed.

    SOLUTION: Before sending the $batch request, serialize the keys of all
    records into a semicolon-delimited string and save it as a CPI exchange
    property (Batch_Key). After receiving the response, this XSLT re-injects
    the keys back into each batchChangeSetResponse by position, so every
    response — success or failure — can be correlated to its source record.

    Property: Batch_Key = "userId=20655282;userId=20654955;..."
    Each token maps positionally to batchChangeSetResponse[n].
  -->

  <xsl:param name="Batch_Key"/>

  <xsl:template match="/batchPartResponse">
    <batchPartResponse>
      <xsl:for-each select="batchChangeSetResponse">
        <xsl:variable name="index"       select="position()"/>
        <xsl:variable name="keyFragment" select="tokenize($Batch_Key, ';')[$index]"/>
        <batchChangeSetResponse>
          <!-- Re-inject the saved key at the top of each changeset response -->
          <key>
            <xsl:value-of select="$keyFragment"/>
          </key>
          <!-- Pass through the full response body unchanged -->
          <xsl:copy-of select="batchChangeSetPartResponse"/>
        </batchChangeSetResponse>
      </xsl:for-each>
    </batchPartResponse>
  </xsl:template>

</xsl:stylesheet>`
  },

  xslMessageDebug: {
    label: 'xsl:message Debugging',
    icon: 'bug',
    desc: 'xsl:message as console.log — trace variables and branches',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Orders>
  <Order id="ORD-001">
    <Customer>ACME Corp</Customer>
    <Total currency="USD">1250.00</Total>
    <Status>APPROVED</Status>
  </Order>
  <Order id="ORD-002">
    <Customer>Globex</Customer>
    <Total currency="EUR">340.00</Total>
    <Status>PENDING</Status>
  </Order>
  <Order id="ORD-003">
    <Customer>Initech</Customer>
    <Total currency="USD">89.50</Total>
    <Status>REJECTED</Status>
  </Order>
</Orders>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>

  <!--
    xsl:message Debugging — the XSLT equivalent of console.log.

    In SAP CPI there is no debugger and no variable inspector.
    xsl:message is your only way to trace what is happening at
    runtime. Messages appear in the CPI message monitor log,
    and here in XSLTDebugX they show up in the console panel
    as "xsl:message → ..." lines so you can inspect values
    without needing to deploy.

    Techniques demonstrated:
      1. Trace a variable value
      2. Log loop position and item count
      3. Log which branch of a choose was taken
      4. Trace a concat expression inline
      5. terminate="yes" to hard-stop on an unexpected condition
  -->

  <xsl:template match="/Orders">

    <!-- Technique 1: trace a document-level variable -->
    <xsl:variable name="orderCount" select="count(Order)"/>
    <xsl:message select="concat('DEBUG orderCount = ', $orderCount)"/>

    <ProcessedOrders>
      <xsl:apply-templates select="Order"/>
    </ProcessedOrders>
  </xsl:template>

  <xsl:template match="Order">

    <!-- Technique 2: trace loop position -->
    <xsl:message select="concat('DEBUG processing Order ', position(), ' of ', last(), ' — id=', @id)"/>

    <!-- Technique 3: trace which branch is taken -->
    <xsl:variable name="status" select="normalize-space(Status)"/>
    <xsl:choose>
      <xsl:when test="$status = 'APPROVED'">
        <xsl:message select="concat('DEBUG APPROVED branch — id=', @id)"/>
        <Order id="{@id}" action="SEND"/>
      </xsl:when>
      <xsl:when test="$status = 'PENDING'">
        <xsl:message select="concat('DEBUG PENDING branch — id=', @id, ' skipping')"/>
        <!-- intentionally omitted from output -->
      </xsl:when>
      <xsl:otherwise>
        <!-- Technique 5: hard-stop on truly unexpected status values -->
        <!-- Comment out terminate="yes" to continue past errors instead -->
        <xsl:message select="concat('WARN unknown status [', $status, '] for id=', @id)"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>`
  }
,

  // ── XPATH EXAMPLES ───────────────────────────────────────────────

  xpathNavigation: {
    label: 'Navigation & Predicates',
    icon:  'compass',
    desc:  'Filter by attribute, position and multi-condition predicates',
    cat:   'xpath',
    xpathExpr: "//Item[@status='active']",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SalesOrder>
  <Header>
    <OrderId>SO-2024-001</OrderId>
    <Customer>ACME Corp</Customer>
    <OrderDate>2024-03-15</OrderDate>
    <Currency>USD</Currency>
    <Status>OPEN</Status>
  </Header>
  <Items>
    <Item status="active">
      <LineNo>10</LineNo>
      <Material>MAT-001</Material>
      <Qty>5</Qty>
      <UnitPrice>120.00</UnitPrice>
      <Category>Pumps</Category>
    </Item>
    <Item status="cancelled">
      <LineNo>20</LineNo>
      <Material>MAT-002</Material>
      <Qty>3</Qty>
      <UnitPrice>85.50</UnitPrice>
      <Category>Valves</Category>
    </Item>
    <Item status="active">
      <LineNo>30</LineNo>
      <Material>MAT-003</Material>
      <Qty>10</Qty>
      <UnitPrice>45.00</UnitPrice>
      <Category>Pumps</Category>
    </Item>
    <Item status="active">
      <LineNo>40</LineNo>
      <Material>MAT-004</Material>
      <Qty>2</Qty>
      <UnitPrice>380.00</UnitPrice>
      <Category>Valves</Category>
    </Item>
  </Items>
</SalesOrder>`,
    xslt: '',
    xpathHints: [
      "//Item                                  — all Item elements",
      "//Item[@status='active']                — active items only",
      "//Item[@status='active' and Qty > 3]    — active with Qty > 3",
      "//Item[last()]                           — last item",
      "//Item[position() <= 2]                  — first two items",
      "//Item[Category='Pumps']/@status         — status attrs of Pumps",
      "//Item[UnitPrice = max(//Item/UnitPrice)]  — item with highest price",
      "/SalesOrder/Header/ancestor::*             — ancestors of Header",
      "//Item/parent::Items                       — parent of Item nodes",
      "//Item[Qty * UnitPrice > 500]              — lines with value over 500",
      "//Item[@status='active']/LineNo            — line numbers of active items",
      "string-join(//Item[@status='active']/Material, ', ') — active materials joined",
      "concat(//Header/OrderId, ' — ', //Header/Customer)   — order label",
      "distinct-values(//Item/Category)           — unique categories",
    ]
  },

  xpathAggregation: {
    label: 'Aggregation Functions',
    icon:  'sigma',
    desc:  'sum(), count(), max(), min(), avg() — CPI payload inspection',
    cat:   'xpath',
    xpathExpr: "sum(//Item/(UnitPrice * Qty))",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder id="PO-8821" currency="EUR">
  <Vendor>Siemens AG</Vendor>
  <Items>
    <Item>
      <LineNo>10</LineNo>
      <Material>SIE-CTRL-01</Material>
      <Qty>4</Qty>
      <UnitPrice>1250.00</UnitPrice>
      <Confirmed>true</Confirmed>
    </Item>
    <Item>
      <LineNo>20</LineNo>
      <Material>SIE-CABLE-5M</Material>
      <Qty>20</Qty>
      <UnitPrice>38.50</UnitPrice>
      <Confirmed>true</Confirmed>
    </Item>
    <Item>
      <LineNo>30</LineNo>
      <Material>SIE-RELAY-12V</Material>
      <Qty>10</Qty>
      <UnitPrice>95.00</UnitPrice>
      <Confirmed>false</Confirmed>
    </Item>
    <Item>
      <LineNo>40</LineNo>
      <Material>SIE-FUSE-32A</Material>
      <Qty>50</Qty>
      <UnitPrice>4.20</UnitPrice>
      <Confirmed>true</Confirmed>
    </Item>
  </Items>
</PurchaseOrder>`,
    xslt: '',
    xpathHints: [
      "count(//Item)                             — total line count",
      "count(//Item[Confirmed='true'])            — confirmed lines only",
      "sum(//Item/UnitPrice)                     — sum of unit prices",
      "max(//Item/UnitPrice)                     — most expensive item",
      "min(//Item/Qty)                           — smallest quantity",
      "avg(//Item/UnitPrice)                     — average unit price",
      "sum(//Item/(xs:decimal(UnitPrice) * xs:decimal(Qty))) — weighted total value",
      "//Item[UnitPrice = max(//Item/UnitPrice)]  — most expensive line",
      "//Item[Confirmed='true']/(xs:decimal(Qty) * xs:decimal(UnitPrice)) — confirmed line values",
      "format-number(sum(//Item/UnitPrice),'#,##0.00') — formatted sum",
      "count(//Item[Confirmed='false'])            — unconfirmed line count",
      "string-join(//Item/Material, ', ')          — all materials as string",
      "//Item[Confirmed='true']/parent::Items/parent::PurchaseOrder/@id — PO id via parent axis",
    ]
  },

  xpathStringFunctions: {
    label: 'String Functions',
    icon:  'type',
    desc:  'normalize-space, upper-case, substring — string functions',
    cat:   'xpath',
    xpathExpr: "//Employee[contains(normalize-space(Name), 'Kumar')]",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Employees system="SuccessFactors">
  <Employee>
    <EmpId>  SF-1001  </EmpId>
    <Name>Rahul Kumar</Name>
    <Email>rahul.kumar@acme.com</Email>
    <Department>IT Integration</Department>
    <Status>active</Status>
    <JoiningDate>2021-06-15</JoiningDate>
  </Employee>
  <Employee>
    <EmpId>SF-1002</EmpId>
    <Name>  Priya Sharma  </Name>
    <Email>priya.sharma@acme.com</Email>
    <Department>SAP Basis</Department>
    <Status>ACTIVE</Status>
    <JoiningDate>2019-03-01</JoiningDate>
  </Employee>
  <Employee>
    <EmpId>SF-1003</EmpId>
    <Name>Klaus Müller</Name>
    <Email>k.mueller@acme.de</Email>
    <Department>Finance</Department>
    <Status>inactive</Status>
    <JoiningDate>2018-11-20</JoiningDate>
  </Employee>
  <Employee>
    <EmpId>SF-1004</EmpId>
    <Name>Anita Kumar</Name>
    <Email>anita.kumar@acme.com</Email>
    <Department>IT Integration</Department>
    <Status>active</Status>
    <JoiningDate>2022-01-10</JoiningDate>
  </Employee>
</Employees>`,
    xslt: '',
    xpathHints: [
      "normalize-space(//Employee[1]/EmpId)                    — trim whitespace",
      "upper-case(//Employee[3]/Status)                        — normalise case",
      "//Employee[upper-case(Status)='ACTIVE']                 — case-insensitive filter",
      "//Employee[contains(Name,'Kumar')]                      — partial name match",
      "//Employee[starts-with(Email,'rahul')]                  — email prefix",
      "string-length(//Employee[1]/Name)                       — name length",
      "substring-before(//Employee[1]/Email,'@')               — local part of email",
      "concat(//Employee[1]/Name,' (',//Employee[1]/EmpId,')')  — build display label",
      "lower-case(//Employee[2]/Status)                        — to lowercase",
      "ends-with(//Employee[1]/Email,'.com')                   — email domain check",
      "translate(//Employee[3]/Email,'@','_')                  — replace char",
      "string-join(//Employee[Department='IT Integration']/Name,', ') — join names",
      "//Employee[ends-with(Email,'.de')]                       — German email domain",
    ]
  },

  xpathTokenizeJoin: {
    label: 'tokenize() & string-join()',
    icon:  'unlink',
    desc:  'Split delimited CPI property strings and reassemble',
    cat:   'xpath',
    xpathExpr: "string-join(tokenize(//BatchKeys, ';'), ',')",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<CPIContext>
  <!-- Semicolon-delimited keys saved before $batch call — typical CPI pattern -->
  <BatchKeys>userId=20655282;userId=20654955;userId=20651100;userId=20651101</BatchKeys>

  <!-- Comma-delimited routing categories from a CPI property -->
  <RoutingCategories>INVOICE,CREDIT_NOTE,DEBIT_NOTE,REVERSAL</RoutingCategories>

  <!-- Pipe-delimited error codes returned from downstream -->
  <ErrorCodes>DUPLICATE_KEY|MANDATORY_FIELD_MISSING|INVALID_DATE_FORMAT</ErrorCodes>

  <Records>
    <Record><Id>REC-001</Id><Tags>urgent,finance,eu</Tags></Record>
    <Record><Id>REC-002</Id><Tags>standard,hr</Tags></Record>
    <Record><Id>REC-003</Id><Tags>urgent,procurement</Tags></Record>
  </Records>
</CPIContext>`,
    xslt: '',
    xpathHints: [
      "tokenize(//BatchKeys, ';')                              — split on semicolon",
      "tokenize(//BatchKeys, ';')[2]                           — second token",
      "count(tokenize(//BatchKeys, ';'))                       — token count",
      "string-join(//Record/Id, ', ')                         — join element values",
      "string-join(tokenize(//RoutingCategories,',')[position()<=2],';') — slice & rejoin",
      "//Record[tokenize(Tags,',') = 'urgent']                — filter by tag in list",
      "tokenize(//ErrorCodes,'\\|')                             — split pipe-delimited",
      "count(tokenize(//RoutingCategories,','))                  — category count",
      "tokenize(//BatchKeys,';')[starts-with(.,'userId')]        — filter tokens by prefix",
      "string-join(for $r in //Record return $r/Id, ' | ')      — join with custom sep",
      "tokenize(//BatchKeys,';')[last()]                         — last token",
    ]
  },

  xpathRegexReplace: {
    label: 'matches() & replace() — Regex',
    icon:  'regex',
    desc:  'Validate and clean field values with XPath regex',
    cat:   'xpath',
    xpathExpr: "replace(//Invoice[1]/VATNumber, '[^A-Z0-9]', '')",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoices>
  <Invoice>
    <Id>INV-2024-001</Id>
    <Vendor>Bosch GmbH</Vendor>
    <VATNumber>DE 123 456 789</VATNumber>
    <Amount>  1,250.00  </Amount>
    <IBAN>DE89 3704 0044 0532 0130 00</IBAN>
    <Phone>+49 (0)89 1234-5678</Phone>
  </Invoice>
  <Invoice>
    <Id>INV-2024-002</Id>
    <Vendor>SAP SE</Vendor>
    <VATNumber>DE987654321</VATNumber>
    <Amount>8750.50</Amount>
    <IBAN>DE27 2004 1010 0504 0100 04</IBAN>
    <Phone>+49-6227-7-47474</Phone>
  </Invoice>
  <Invoice>
    <Id>INV-2024-003</Id>
    <Vendor>Invalid Corp</Vendor>
    <VATNumber>INVALID!</VATNumber>
    <Amount>not-a-number</Amount>
    <IBAN>GB29NWBK60161331926819</IBAN>
    <Phone>123</Phone>
  </Invoice>
</Invoices>`,
    xslt: '',
    xpathHints: [
      "replace(//Invoice[1]/VATNumber, '[^A-Z0-9]', '')       — strip non-alphanumeric",
      "replace(//Invoice[1]/IBAN, ' ', '')                     — strip spaces from IBAN",
      "replace(//Invoice[1]/Phone, '[^0-9+]', '')              — digits and + only",
      "matches(//Invoice[2]/VATNumber, '^DE[0-9]{9}$')         — validate German VAT",
      "matches(//Invoice[3]/Amount, '^[0-9]+(\.[0-9]+)?$')    — validate numeric",
      "//Invoice[matches(VATNumber, '^DE[0-9]{9}$')]           — filter valid VAT only",
      "replace(//Invoice[1]/Amount, '[^0-9.]', '')              — strip to numeric only",
      "matches(//Invoice[3]/Amount, '^[0-9]+(\\.[0-9]+)?$')   — is it a valid number?",
      "//Invoice[not(matches(VATNumber, '^DE[0-9]{9}$'))]      — flag invalid VAT numbers",
      "replace(//Invoice[1]/Phone, '^\\+49\\s?\\(0\\)', '+49') — normalise prefix",
    ]
  },

  xpathDateFunctions: {
    label: 'Date & Duration Functions',
    icon:  'clock',
    desc:  'Parse, format and compare xs:date — SLA and deadline checks',
    cat:   'xpath',
    xpathExpr: "//Order[xs:date(DeliveryDate) lt current-date()]",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Orders xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <Order>
    <Id>ORD-001</Id>
    <Customer>ACME Corp</Customer>
    <OrderDate>2024-01-10</OrderDate>
    <DeliveryDate>2024-01-25</DeliveryDate>
    <Status>DELIVERED</Status>
    <Amount>4500.00</Amount>
  </Order>
  <Order>
    <Id>ORD-002</Id>
    <Customer>Globex</Customer>
    <OrderDate>2024-03-01</OrderDate>
    <DeliveryDate>2027-06-30</DeliveryDate>
    <Status>PENDING</Status>
    <Amount>12000.00</Amount>
  </Order>
  <Order>
    <Id>ORD-003</Id>
    <Customer>Initech</Customer>
    <OrderDate>2024-02-14</OrderDate>
    <DeliveryDate>2027-12-31</DeliveryDate>
    <Status>PENDING</Status>
    <Amount>780.00</Amount>
  </Order>
</Orders>`,
    xslt: '',
    xpathHints: [
      "current-date()                                           — today's date",
      "current-dateTime()                                       — now with time",
      "//Order[xs:date(DeliveryDate) lt current-date()]        — overdue orders",
      "//Order[xs:date(DeliveryDate) gt current-date()]        — future deliveries",
      "xs:date(//Order[1]/DeliveryDate) - xs:date(//Order[1]/OrderDate) — duration",
      "format-date(xs:date(//Order[1]/OrderDate),'[D01]/[M01]/[Y0001]') — reformat date",
      "year-from-date(xs:date(//Order[1]/OrderDate))            — extract year",
      "month-from-date(xs:date(//Order[1]/OrderDate))           — extract month",
      "day-from-date(xs:date(//Order[1]/DeliveryDate))           — extract day",
      "days-from-duration(xs:date(//Order[2]/DeliveryDate) - current-date()) — days until delivery",
      "//Order[xs:date(DeliveryDate) - xs:date(OrderDate) > xs:dayTimeDuration('P30D')] — lead > 30 days",
      "count(//Order[xs:date(DeliveryDate) gt current-date()])    — future delivery count",
      "max(for $o in //Order return xs:date($o/DeliveryDate))     — latest delivery date",
    ]
  },

  xpathNamespaceAgnostic: {
    label: 'Namespace-Agnostic Selection',
    icon:  'tags',
    desc:  'local-name() for namespaced payloads, no prefix binding',
    cat:   'xpath',
    xpathExpr: "//*[local-name()='Amount']",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<ns0:Invoice
  xmlns:ns0="http://sap.com/xi/AP/FI/Global"
  xmlns:ns1="http://sap.com/xi/AP/Common/Global"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ns0:Header>
    <ns1:InvoiceId>FI-2024-88721</ns1:InvoiceId>
    <ns1:PostingDate>2024-03-15</ns1:PostingDate>
    <ns0:CompanyCode>1000</ns0:CompanyCode>
    <ns0:Currency>EUR</ns0:Currency>
    <ns0:Amount>18750.00</ns0:Amount>
  </ns0:Header>
  <ns0:LineItems>
    <ns0:Item>
      <ns1:LineNo>1</ns1:LineNo>
      <ns1:GLAccount>400000</ns1:GLAccount>
      <ns0:Amount>12000.00</ns0:Amount>
      <ns0:CostCenter>CC-IT-01</ns0:CostCenter>
    </ns0:Item>
    <ns0:Item>
      <ns1:LineNo>2</ns1:LineNo>
      <ns1:GLAccount>470000</ns1:GLAccount>
      <ns0:Amount>6750.00</ns0:Amount>
      <ns0:CostCenter>CC-FIN-02</ns0:CostCenter>
    </ns0:Item>
  </ns0:LineItems>
</ns0:Invoice>`,
    xslt: '',
    xpathHints: [
      "//*[local-name()='Amount']                              — all Amount elements, any ns",
      "//*[local-name()='Item']                                — all Item elements",
      "//*[local-name()='Invoice']/*[local-name()='Header']    — Header child of Invoice",
      "string(//*[local-name()='InvoiceId'])                   — get ID value",
      "sum(//*[local-name()='Item']/*[local-name()='Amount'])  — sum line amounts",
      "namespace-uri(//*[local-name()='Amount'][1])            — inspect namespace URI",
      "//*[local-name()='Item']/*[local-name()='Amount']       — Amount inside Item",
      "//*[namespace-uri()='http://sap.com/xi/AP/FI/Global']   — all ns0: elements",
      "//*[local-name()='Header']/*[local-name()='Currency']   — Currency in Header",
      "count(//*[namespace-uri()='http://sap.com/xi/AP/Common/Global']) — ns1 element count",
      "//*[local-name()='Item'][*[local-name()='Amount'] > 10000] — high-value items",
      "string-join(//*[local-name()='CostCenter'], ', ')         — all cost centres joined",
      "concat(//*[local-name()='InvoiceId'], ' / ', //*[local-name()='Currency']) — id + currency label",
    ]
  },

  xpathBatchErrorDetect: {
    label: 'Batch Error Detection',
    icon:  'alert-triangle',
    desc:  'Identify failed changesets in SF $batch responses',
    cat:   'xpath',
    xpathExpr: "//batchChangeSetPartResponse[statusCode != '200']",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<batchPartResponse>
  <batchChangeSetResponse>
    <batchChangeSetPartResponse>
      <statusInfo>OK</statusInfo>
      <statusCode>200</statusCode>
      <body>
        <UpsertResponses>
          <EmpEmployment>
            <key>userId=20655282</key>
            <status>OK</status>
            <editStatus>UPSERTED</editStatus>
          </EmpEmployment>
        </UpsertResponses>
      </body>
    </batchChangeSetPartResponse>
  </batchChangeSetResponse>
  <batchChangeSetResponse>
    <batchChangeSetPartResponse>
      <statusInfo>Bad Request</statusInfo>
      <statusCode>400</statusCode>
      <body>
        <error>
          <code>INVALID_FIELD_VALUE</code>
          <message>Field userId=20654955 contains an invalid value</message>
        </error>
      </body>
    </batchChangeSetPartResponse>
  </batchChangeSetResponse>
  <batchChangeSetResponse>
    <batchChangeSetPartResponse>
      <statusInfo>OK</statusInfo>
      <statusCode>200</statusCode>
      <body>
        <UpsertResponses>
          <EmpEmployment>
            <key>userId=20651100</key>
            <status>OK</status>
            <editStatus>UPSERTED</editStatus>
          </EmpEmployment>
        </UpsertResponses>
      </body>
    </batchChangeSetPartResponse>
  </batchChangeSetResponse>
  <batchChangeSetResponse>
    <batchChangeSetPartResponse>
      <statusInfo>Internal Server Error</statusInfo>
      <statusCode>500</statusCode>
      <body>
        <error>
          <code>SERVER_ERROR</code>
          <message>An unexpected error occurred processing userId=20651101</message>
        </error>
      </body>
    </batchChangeSetPartResponse>
  </batchChangeSetResponse>
</batchPartResponse>`,
    xslt: '',
    xpathHints: [
      "//batchChangeSetPartResponse[statusCode != '200']       — all failures",
      "//batchChangeSetPartResponse[statusCode = '400']        — bad requests only",
      "count(//batchChangeSetPartResponse[statusCode != '200']) — failure count",
      "count(//batchChangeSetPartResponse[statusCode = '200']) — success count",
      "//batchChangeSetPartResponse[statusCode != '200']/body/error/message — error msgs",
      "every $r in //batchChangeSetPartResponse satisfies $r/statusCode = '200' — all ok?",
      "some $r in //batchChangeSetPartResponse satisfies $r/statusCode = '500'  — any server error?",
      "//batchChangeSetPartResponse[statusCode != '200']/body/error/code        — error codes",
      "//batchChangeSetPartResponse[statusCode != '200']/body/error/message     — error messages",
      "string-join(//batchChangeSetPartResponse[statusCode!='200']/statusCode, ',') — failure codes joined",
      "//batchChangeSetPartResponse[statusCode='200']/body//key                 — successful keys",
      "for $r in //batchChangeSetPartResponse[statusCode!='200'] return $r/statusCode — failure codes sequence",
      "string-join(//batchChangeSetPartResponse[statusCode='200']/body//key, '; ') — successful keys joined",
    ]
  }


  ,

  // ── NEW CPI EXAMPLES ─────────────────────────────────────────────────────────

  soapFaultHandling: {
    label: 'SOAP Fault Handling',
    icon:  'alert-circle',
    desc:  'Extract faultcode, faultstring and detail from a SOAP Fault',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <soapenv:Body>
    <soapenv:Fault>
      <faultcode>soapenv:Server</faultcode>
      <faultstring>Internal server error — ERP system unavailable</faultstring>
      <detail>
        <errorDetail>
          <errorCode>SY/530</errorCode>
          <errorMessage>Connection to backend RFC destination failed</errorMessage>
          <systemId>PRD</systemId>
          <timestamp>2024-03-15T10:22:33Z</timestamp>
        </errorDetail>
      </detail>
    </soapenv:Fault>
  </soapenv:Body>
</soapenv:Envelope>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  exclude-result-prefixes="soap">
  <xsl:output method="xml" indent="yes"/>

  <!--
    SOAP Fault Handler — extract fault details into a clean error envelope.
    Common in CPI error subprocesses that receive SOAP faults from backend
    systems (ERP RFC, S/4HANA OData, PI/PO proxies) and need to transform
    them into a normalised error format for logging or retry flows.
  -->

  <xsl:template match="/soap:Envelope">
    <xsl:variable name="fault" select="soap:Body/soap:Fault"/>
    <ErrorResponse>
      <FaultCode><xsl:value-of select="$fault/faultcode"/></FaultCode>
      <FaultString><xsl:value-of select="normalize-space($fault/faultstring)"/></FaultString>
      <ErrorCode><xsl:value-of select="$fault/detail/errorDetail/errorCode"/></ErrorCode>
      <ErrorMessage><xsl:value-of select="$fault/detail/errorDetail/errorMessage"/></ErrorMessage>
      <SystemId><xsl:value-of select="$fault/detail/errorDetail/systemId"/></SystemId>
      <Timestamp><xsl:value-of select="$fault/detail/errorDetail/timestamp"/></Timestamp>
      <IsFatal><xsl:value-of select="starts-with($fault/faultcode, 'soapenv:Server')"/></IsFatal>
    </ErrorResponse>
  </xsl:template>

</xsl:stylesheet>`
  },

  conditionalRouting: {
    label: 'Conditional Routing Headers',
    icon:  'git-branch',
    desc:  'Set routing headers from payload — drives CPI router steps',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder>
  <Header>
    <PONumber>PO-2024-88721</PONumber>
    <Vendor>10000015</Vendor>
    <TotalAmount currency="EUR">125000.00</TotalAmount>
    <DocumentType>NB</DocumentType>
    <CompanyCode>1000</CompanyCode>
    <PurchOrg>1000</PurchOrg>
  </Header>
  <Items>
    <Item><LineNo>10</LineNo><Material>MAT-001</Material><Qty>5</Qty></Item>
    <Item><LineNo>20</LineNo><Material>MAT-002</Material><Qty>10</Qty></Item>
  </Items>
</PurchaseOrder>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cpi="http://sap.com/it/"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="cpi xs">
  <xsl:output method="xml" indent="yes"/>

  <xsl:param name="exchange"/>

  <!--
    Conditional Routing Header Setting.
    
    A common CPI pattern: inspect the payload and set message headers
    that downstream Router steps use to decide which branch to take.

    Rules applied here:
      - Amount > 100,000 → ApprovalRequired = true, Route = HIGH_VALUE
      - DocType = NB (standard PO) → Route = STANDARD
      - Otherwise → Route = REVIEW

    The Router step in the iFlow checks header 'Route' to branch.
  -->

  <xsl:template match="/PurchaseOrder">
    <xsl:variable name="amount"  select="xs:decimal(Header/TotalAmount)"/>
    <xsl:variable name="docType" select="Header/DocumentType"/>

    <!-- Set routing headers via CPI extension -->
    <xsl:value-of select="cpi:setHeader($exchange, 'CompanyCode',       Header/CompanyCode)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'VendorId',          Header/Vendor)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'TotalAmount',       Header/TotalAmount)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'ApprovalRequired',  string($amount gt 100000))"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'Route',
      if      ($amount gt 100000) then 'HIGH_VALUE'
      else if ($docType = 'NB')   then 'STANDARD'
      else                             'REVIEW')"/>

    <!-- Pass through the original document unchanged -->
    <xsl:copy-of select="."/>
  </xsl:template>

</xsl:stylesheet>`
  },

  xmlToText: {
    label: 'XML to Flat Text / CSV',
    icon:  'file-text',
    desc:  'XML to pipe-delimited flat file — legacy system integration',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Employees>
  <Employee>
    <EmpId>E001</EmpId>
    <FirstName>Alice</FirstName>
    <LastName>Martin</LastName>
    <Department>IT Integration</Department>
    <CostCenter>CC-4100</CostCenter>
    <Salary>85000</Salary>
    <StartDate>2021-06-15</StartDate>
  </Employee>
  <Employee>
    <EmpId>E002</EmpId>
    <FirstName>Bob</FirstName>
    <LastName>Chen</LastName>
    <Department>SAP Basis</Department>
    <CostCenter>CC-4200</CostCenter>
    <Salary>91000</Salary>
    <StartDate>2019-03-01</StartDate>
  </Employee>
  <Employee>
    <EmpId>E003</EmpId>
    <FirstName>Carol</FirstName>
    <LastName>Müller</LastName>
    <Department>Finance</Department>
    <CostCenter>CC-4300</CostCenter>
    <Salary>78000</Salary>
    <StartDate>2022-09-12</StartDate>
  </Employee>
</Employees>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="text" encoding="UTF-8"/>

  <!--
    XML to Pipe-Delimited Flat File.

    Outputs a header row + one data row per Employee.
    The pipe | delimiter is common in legacy HR and payroll integrations
    on SAP CPI where the target system expects a flat file format.

    Adapt the delimiter by changing the separator variable.
    Change method="text" to method="xml" to wrap in a document element instead.
  -->

  <xsl:variable name="sep" select="'|'"/>
  <xsl:variable name="nl"  select="'&#10;'"/>

  <xsl:template match="/Employees">
    <!-- Header row -->
    <xsl:value-of select="string-join(('EmpId','FirstName','LastName','Department','CostCenter','Salary','StartDate'), $sep)"/>
    <xsl:value-of select="$nl"/>
    <!-- Data rows -->
    <xsl:apply-templates select="Employee"/>
  </xsl:template>

  <xsl:template match="Employee">
    <xsl:value-of select="string-join((EmpId,FirstName,LastName,Department,CostCenter,Salary,StartDate), $sep)"/>
    <xsl:value-of select="$nl"/>
  </xsl:template>

</xsl:stylesheet>`
  },

  sfEmployeeMapping: {
    label: 'SuccessFactors Employee Mapping',
    icon:  'user',
    desc:  'Map SuccessFactors EmpEmployment + EmpJob to flat HR format',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<EmpEmploymentCollection>
  <EmpEmployment>
    <personIdExternal>20655282</personIdExternal>
    <userId>20655282</userId>
    <startDate>2018-04-01T00:00:00</startDate>
    <endDate>9999-12-31T00:00:00</endDate>
    <employmentStatus>A</employmentStatus>
    <EmpJob>
      <jobCode>IT_ARCH_SR</jobCode>
      <jobTitle>Senior Integration Architect</jobTitle>
      <department>IT Integration</department>
      <division>Technology</division>
      <location>DE_BERLIN</location>
      <managerId>10001001</managerId>
      <fte>1.0</fte>
    </EmpJob>
    <EmpPayCompensation>
      <payGroup>DE01</payGroup>
      <currency>EUR</currency>
    </EmpPayCompensation>
  </EmpEmployment>
  <EmpEmployment>
    <personIdExternal>20654955</personIdExternal>
    <userId>20654955</userId>
    <startDate>2020-01-15T00:00:00</startDate>
    <endDate>9999-12-31T00:00:00</endDate>
    <employmentStatus>A</employmentStatus>
    <EmpJob>
      <jobCode>FIN_CTRL_JR</jobCode>
      <jobTitle>Junior Financial Controller</jobTitle>
      <department>Finance</department>
      <division>Operations</division>
      <location>DE_MUNICH</location>
      <managerId>10001002</managerId>
      <fte>0.8</fte>
    </EmpJob>
    <EmpPayCompensation>
      <payGroup>DE02</payGroup>
      <currency>EUR</currency>
    </EmpPayCompensation>
  </EmpEmployment>
</EmpEmploymentCollection>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    SuccessFactors EmpEmployment → HR Integration Format.

    Maps the nested EmpEmployment / EmpJob / EmpPayCompensation structure
    from a SuccessFactors OData $expand response into a flat HR record
    suitable for downstream SAP HCM, S/4HANA HR, or third-party payroll.

    Key transformations:
      - Date truncation: strip time from ISO 8601 datetime strings
      - End date mapping: 9999-12-31 = no end date → leave blank
      - FTE: format as percentage
      - Status: A = Active, I = Inactive, T = Terminated
  -->

  <xsl:variable name="NO_END_DATE" select="'9999-12-31'"/>

  <xsl:template match="/EmpEmploymentCollection">
    <HREmployees count="{count(EmpEmployment)}">
      <xsl:apply-templates select="EmpEmployment"/>
    </HREmployees>
  </xsl:template>

  <xsl:template match="EmpEmployment">
    <xsl:variable name="startDate" select="substring(startDate, 1, 10)"/>
    <xsl:variable name="endDate"   select="substring(endDate,   1, 10)"/>
    <xsl:variable name="status"    select="employmentStatus"/>

    <Employee>
      <PersonId><xsl:value-of select="personIdExternal"/></PersonId>
      <UserId><xsl:value-of select="userId"/></UserId>
      <Status>
        <xsl:value-of select="if ($status='A') then 'Active'
                         else if ($status='I') then 'Inactive'
                         else                       'Terminated'"/>
      </Status>
      <StartDate><xsl:value-of select="$startDate"/></StartDate>
      <EndDate>
        <xsl:if test="$endDate != $NO_END_DATE">
          <xsl:value-of select="$endDate"/>
        </xsl:if>
      </EndDate>
      <JobCode><xsl:value-of select="EmpJob/jobCode"/></JobCode>
      <JobTitle><xsl:value-of select="EmpJob/jobTitle"/></JobTitle>
      <Department><xsl:value-of select="EmpJob/department"/></Department>
      <Division><xsl:value-of select="EmpJob/division"/></Division>
      <Location><xsl:value-of select="EmpJob/location"/></Location>
      <ManagerId><xsl:value-of select="EmpJob/managerId"/></ManagerId>
      <FTE><xsl:value-of select="format-number(xs:decimal(EmpJob/fte) * 100, '##0.##')"/>%</FTE>
      <PayGroup><xsl:value-of select="EmpPayCompensation/payGroup"/></PayGroup>
      <Currency><xsl:value-of select="EmpPayCompensation/currency"/></Currency>
    </Employee>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── NEW XPATH EXAMPLES ────────────────────────────────────────────────────────

  xpathConditional: {
    label: 'Conditional & Boolean Logic',
    icon:  'toggle-left',
    desc:  'if/then/else, and/or, not(), exists() — XPath decision logic',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "//Order[xs:decimal(Amount) gt 1000 and Status = 'OPEN']",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Orders xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <Order>
    <Id>ORD-001</Id><Customer>ACME</Customer>
    <Amount>4500.00</Amount><Status>OPEN</Status><Priority>HIGH</Priority>
  </Order>
  <Order>
    <Id>ORD-002</Id><Customer>Globex</Customer>
    <Amount>340.00</Amount><Status>OPEN</Status><Priority>LOW</Priority>
  </Order>
  <Order>
    <Id>ORD-003</Id><Customer>Initech</Customer>
    <Amount>12000.00</Amount><Status>CLOSED</Status><Priority>HIGH</Priority>
  </Order>
  <Order>
    <Id>ORD-004</Id><Customer>Umbrella</Customer>
    <Amount>890.00</Amount><Status>OPEN</Status><Priority>HIGH</Priority>
  </Order>
  <Order>
    <Id>ORD-005</Id><Customer>Globex</Customer>
    <Amount>5600.00</Amount><Status>OPEN</Status><Priority>LOW</Priority>
  </Order>
</Orders>`,
    xpathHints: [
      "//Order[xs:decimal(Amount) gt 1000 and Status='OPEN']         — high value open orders",
      "//Order[Status='OPEN' or Status='PENDING']                    — open or pending",
      "//Order[not(Status='CLOSED')]                                  — exclude closed",
      "//Order[exists(Priority) and Priority='HIGH']                  — has Priority = HIGH",
      "if (count(//Order[Status='OPEN']) gt 0) then 'Has open' else 'All closed'  — conditional string",
      "every $o in //Order satisfies xs:decimal($o/Amount) gt 100    — all over 100?",
      "some $o in //Order satisfies $o/Status = 'OPEN'               — any open?",
      "//Order[Priority = 'HIGH' and not(Status = 'CLOSED')]              — open high priority",
      "if (some $o in //Order satisfies $o/Priority='HIGH') then 'Urgent' else 'Normal' — urgency label",
      "//Order[xs:decimal(Amount) = max(//Order/xs:decimal(Amount))]      — order with max amount",
      "count(//Order[Status='OPEN' and xs:decimal(Amount) gt 1000])        — high-value open count",
      "string-join(//Order[Status='OPEN']/Customer, ', ')                  — open order customers joined",
      "//Order[Priority='HIGH']/Id/parent::Order/Amount                    — navigate to amount via parent",
      "distinct-values(//Order[not(Status='CLOSED')]/Customer)             — unique non-closed customers",
    ]
  },

  xpathNodeInspection: {
    label: 'Node Inspection Functions',
    icon:  'microscope',
    desc:  'name(), local-name(), namespace-uri() — inspect structure',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "//IDOC/*[local-name() != 'EDI_DC40']",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40 SEGMENT="1">
    <TABNAM>EDI_DC40</TABNAM>
    <MANDT>100</MANDT>
    <DOCNUM>0000000000123456</DOCNUM>
    <DOCREL>755</DOCREL>
    <MESTYP>ORDERS</MESTYP>
    <RCVPRT>LS</RCVPRT>
    <RCVPRN>PARTNERB</RCVPRN>
  </EDI_DC40>
  <E1EDK01 SEGMENT="1">
    <ACTION>000</ACTION>
    <CURCY>EUR</CURCY>
    <HWAER>EUR</HWAER>
    <BSART>NB</BSART>
  </E1EDK01>
  <E1EDP01 SEGMENT="1">
    <POSEX>000010</POSEX>
    <MATNR>000000000000012345</MATNR>
    <MENGE>00005.000</MENGE>
    <MEINS>EA</MEINS>
  </E1EDP01>
  <E1EDP01 SEGMENT="1">
    <POSEX>000020</POSEX>
    <MATNR>000000000000067890</MATNR>
    <MENGE>00010.000</MENGE>
    <MEINS>KG</MEINS>
  </E1EDP01>
</IDOC>`,
    xpathHints: [
      "//IDOC/*[local-name() != 'EDI_DC40']         — all segments except control record",
      "name(//IDOC/*[1])                              — name of first child",
      "local-name(//IDOC/*[2])                        — local name without prefix",
      "count(//IDOC/*)                                — total segment count",
      "count(//E1EDP01)                               — line item segment count",
      "//IDOC/*[last()]                               — last segment",
      "//IDOC/*[position() = 2]                       — second segment",
      "/IDOC/@BEGIN                                   — attribute value",
      "for $s in //IDOC/* return local-name($s)         — segment names as sequence",
      "distinct-values(for $s in //IDOC/* return local-name($s)) — unique segment types",
      "//IDOC/*[@SEGMENT]                                — all segments with SEGMENT attr",
      "//IDOC/*[count(preceding-sibling::*) = 0]        — first child (alt to [1])",
      "string-join(for $n in //IDOC/* return local-name($n), ', ') — all segment names joined",
    ]
  },

  xpathSOAPNavigation: {
    label: 'SOAP Envelope Navigation',
    icon:  'puzzle',
    desc:  'Navigate SOAP envelope with namespace-aware XPath',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "//*[local-name()='Body']/*[1]",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:ord="http://sap.com/xi/orders/v1">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>svc_cpi_user</wsse:Username>
        <wsse:Password>**hidden**</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ord:CreateOrderRequest>
      <ord:OrderHeader>
        <ord:PONumber>PO-2024-99001</ord:PONumber>
        <ord:Vendor>10000042</ord:Vendor>
        <ord:Currency>EUR</ord:Currency>
        <ord:TotalAmount>18750.00</ord:TotalAmount>
      </ord:OrderHeader>
      <ord:OrderLines>
        <ord:Line lineNo="1">
          <ord:Material>MAT-001</ord:Material>
          <ord:Quantity>5</ord:Quantity>
          <ord:UnitPrice>1500.00</ord:UnitPrice>
        </ord:Line>
        <ord:Line lineNo="2">
          <ord:Material>MAT-002</ord:Material>
          <ord:Quantity>10</ord:Quantity>
          <ord:UnitPrice>937.50</ord:UnitPrice>
        </ord:Line>
      </ord:OrderLines>
    </ord:CreateOrderRequest>
  </soapenv:Body>
</soapenv:Envelope>`,
    xpathHints: [
      "//*[local-name()='Body']/*[1]                           — first child of Body",
      "//*[local-name()='PONumber']                            — PO number anywhere",
      "//*[local-name()='OrderHeader']/*[local-name()='Vendor'] — vendor in header",
      "count(//*[local-name()='Line'])                         — number of order lines",
      "//*[local-name()='Line']/@lineNo                        — all lineNo attributes",
      "//*[local-name()='Username']                            — WSSE username",
      "sum(//*[local-name()='Line']/(xs:decimal(*[local-name()='UnitPrice']) * xs:decimal(*[local-name()='Quantity']))) — total order value (XPath 3.0)",
      "//*[local-name()='Header']/*                           — all Header children",
      "//*[local-name()='Security']//*[local-name()='Username'] — drill into WSSecurity",
      "count(//*[local-name()='Line'])                         — line count",
      "//*[local-name()='Line'][@lineNo='2']/*[local-name()='Material'] — material on line 2",
      "string(//*[local-name()='TotalAmount'])                 — total amount as string",
    ]
  },



  // ── DATA TRANSFORMATION (continued) ─────────────────────────────

  unwrapRewrap: {
    label: 'Unwrap / Rewrap Payload',
    icon: 'package-open',
    desc:  'Strip envelope and re-wrap under new root \u2014 adapter',
    cat:   'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<ns0:MT_PurchaseOrder_Out
  xmlns:ns0="http://acme.com/interfaces/purchasing/out">
  <MessageHeader>
    <SenderId>SAP-ERP</SenderId>
    <ReceiverId>PARTNER-B2B</ReceiverId>
    <Timestamp>2024-11-15T09:30:00Z</Timestamp>
    <MessageId>MSG-20241115-00042</MessageId>
  </MessageHeader>
  <PurchaseOrder>
    <PONumber>4500099001</PONumber>
    <Vendor>V-100042</Vendor>
    <Currency>EUR</Currency>
    <Items>
      <Item>
        <LineNo>10</LineNo>
        <Material>MAT-001</Material>
        <Qty>5</Qty>
        <NetValue>2250.00</NetValue>
      </Item>
      <Item>
        <LineNo>20</LineNo>
        <Material>MAT-002</Material>
        <Qty>2</Qty>
        <NetValue>960.00</NetValue>
      </Item>
    </Items>
  </PurchaseOrder>
</ns0:MT_PurchaseOrder_Out>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:ns0="http://acme.com/interfaces/purchasing/out"
  exclude-result-prefixes="ns0">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Unwrap / Rewrap Pattern.

    Strips the source interface envelope (ns0:MT_PurchaseOrder_Out)
    and re-wraps the inner payload under a new canonical root
    expected by the target system.

    Also promotes MessageHeader fields as attributes on the new root
    for traceability — common in CPI audit logging patterns.

    Key technique: match the outer element by local-name() so the
    XSLT stays namespace-tolerant if the prefix ever changes.
  -->

  <xsl:template match="/*">
    <CanonicalPurchaseOrder
      messageId="{MessageHeader/MessageId}"
      sender="{MessageHeader/SenderId}"
      receiver="{MessageHeader/ReceiverId}"
      timestamp="{MessageHeader/Timestamp}">
      <xsl:apply-templates select="PurchaseOrder/*"/>
    </CanonicalPurchaseOrder>
  </xsl:template>

  <!-- Copy inner content as-is using identity -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>`
  },

  sortRecords: {
    label: 'Sort Records',
    icon: 'arrow-up-down',
    desc:  'Multi-key xsl:sort by priority then net value descending',
    cat:   'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoices>
  <Invoice>
    <InvoiceNo>INV-1003</InvoiceNo>
    <Vendor>Siemens AG</Vendor>
    <NetValue>12500.00</NetValue>
    <DueDate>2024-04-30</DueDate>
    <Priority>LOW</Priority>
    <Status>OPEN</Status>
  </Invoice>
  <Invoice>
    <InvoiceNo>INV-1001</InvoiceNo>
    <Vendor>Bosch GmbH</Vendor>
    <NetValue>4200.00</NetValue>
    <DueDate>2024-03-15</DueDate>
    <Priority>HIGH</Priority>
    <Status>OPEN</Status>
  </Invoice>
  <Invoice>
    <InvoiceNo>INV-1004</InvoiceNo>
    <Vendor>ABB Ltd</Vendor>
    <NetValue>8750.00</NetValue>
    <DueDate>2024-03-20</DueDate>
    <Priority>HIGH</Priority>
    <Status>OPEN</Status>
  </Invoice>
  <Invoice>
    <InvoiceNo>INV-1002</InvoiceNo>
    <Vendor>Schneider Electric</Vendor>
    <NetValue>1350.00</NetValue>
    <DueDate>2024-05-10</DueDate>
    <Priority>LOW</Priority>
    <Status>PAID</Status>
  </Invoice>
</Invoices>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Multi-key sort with xsl:sort.

    Sort order applied:
      1. Priority: HIGH before LOW (ascending alpha on H < L)
      2. NetValue: highest first (descending numeric)
      3. DueDate: earliest first (ascending)

    In CPI this pattern is used when preparing payment runs,
    approval queues, or ranked output for downstream systems
    that process records in sequence.

    Note: data-type="number" is essential for numeric sort \u2014
    lexicographic sort of "12500" vs "4200" gives wrong order.
  -->

  <xsl:template match="Invoices">
    <SortedInvoices total="{count(Invoice)}"
                    totalValue="{format-number(sum(Invoice/xs:decimal(NetValue)),'#,##0.00')}">
      <xsl:apply-templates select="Invoice">
        <xsl:sort select="Priority"  order="ascending"  data-type="text"/>
        <xsl:sort select="xs:decimal(NetValue)" order="descending" data-type="number"/>
        <xsl:sort select="DueDate"   order="ascending"  data-type="text"/>
      </xsl:apply-templates>
    </SortedInvoices>
  </xsl:template>

  <xsl:template match="Invoice">
    <Invoice rank="{position()}">
      <xsl:copy-of select="*"/>
    </Invoice>
  </xsl:template>

</xsl:stylesheet>`
  },

  fieldInjection: {
    label: 'Deep Copy + Field Injection',
    icon: 'syringe',
    desc:  'Identity transform that injects or overrides specific fields',
    cat:   'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<DeliveryNote>
  <Header>
    <DeliveryNo>LF-2024-00881</DeliveryNo>
    <ShipToParty>C-10042</ShipToParty>
    <ShipDate>2024-11-20</ShipDate>
    <CarrierId>DHL-EXPRESS</CarrierId>
  </Header>
  <Items>
    <Item>
      <LineNo>10</LineNo>
      <Material>MAT-001</Material>
      <Description>Hydraulic Pump 50bar</Description>
      <Qty>5</Qty>
      <UoM>EA</UoM>
      <BatchNo>BT-20241101-A</BatchNo>
    </Item>
    <Item>
      <LineNo>20</LineNo>
      <Material>MAT-003</Material>
      <Description>Pressure Gauge 0-100bar</Description>
      <Qty>10</Qty>
      <UoM>EA</UoM>
      <BatchNo>BT-20241105-C</BatchNo>
    </Item>
  </Items>
</DeliveryNote>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Deep Copy with Field Injection.

    Extends the identity transform to:
      - Add a ProcessedAt timestamp to the root element
      - Override CarrierId with a normalised value
      - Inject a TrackingRef into each Item

    The key pattern: use the identity template as the default,
    then write specific templates ONLY for the nodes you need
    to change. Everything else copies through untouched.

    This is far safer than rebuilding the full structure from
    scratch \u2014 new source fields added later pass through
    automatically.
  -->

  <!-- Identity: copy everything by default -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Inject ProcessedAt attribute onto root -->
  <xsl:template match="DeliveryNote">
    <xsl:copy>
      <xsl:attribute name="processedAt" select="current-dateTime()"/>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Normalise CarrierId: map legacy codes to standard names -->
  <xsl:template match="CarrierId">
    <CarrierId>
      <xsl:choose>
        <xsl:when test=". = 'DHL-EXPRESS'">DHL_EXPRESS</xsl:when>
        <xsl:when test=". = 'UPS-STD'">UPS_STANDARD</xsl:when>
        <xsl:otherwise><xsl:value-of select="."/></xsl:otherwise>
      </xsl:choose>
    </CarrierId>
  </xsl:template>

  <!-- Inject TrackingRef into each Item -->
  <xsl:template match="Item">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
      <TrackingRef>
        <xsl:value-of select="concat(ancestor::Header/DeliveryNo,'-',LineNo)"/>
      </TrackingRef>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>`
  },

  emptyElementCleanup: {
    label: 'Empty Element Cleanup',
    icon: 'eraser',
    desc:  'Remove blank elements and normalize whitespace \u2014 pre-send',
    cat:   'transform',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<CustomerMaster>
  <Customer id="C-10042">
    <Name>Acme Industries GmbH</Name>
    <TaxId>DE123456789</TaxId>
    <Email></Email>
    <Phone>  </Phone>
    <Website>https://acme-industries.de</Website>
    <Address>
      <Street>Industriestrasse   42</Street>
      <City>Frankfurt</City>
      <PostalCode>60528</PostalCode>
      <Region></Region>
      <Country>DE</Country>
    </Address>
    <Contacts>
      <Contact>
        <Name>  Hans   Mueller  </Name>
        <Role>Purchasing</Role>
        <Email>h.mueller@acme-industries.de</Email>
        <Mobile></Mobile>
      </Contact>
      <Contact>
        <Name></Name>
        <Role></Role>
        <Email></Email>
        <Mobile></Mobile>
      </Contact>
    </Contacts>
  </Customer>
</CustomerMaster>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Empty Element Cleanup.

    Removes elements whose text content is empty or whitespace-only,
    normalizes internal whitespace in text nodes, and removes
    Contact entries where ALL child elements are blank.

    Two passes of the identity template with targeted overrides:
      1. Text nodes: normalize-space() to collapse internal gaps
      2. Elements:   suppress if normalize-space(.) = ''
      3. Contact:    suppress entire block if all children are blank

    Common in CPI before sending to Salesforce, S/4HANA OData,
    or any API that rejects empty string fields.
  -->

  <!-- Default: copy everything -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

  <!-- Suppress elements with empty or whitespace-only content -->
  <xsl:template match="*[not(*) and normalize-space(.) = '']"/>

  <!-- Normalize whitespace in text nodes -->
  <xsl:template match="text()">
    <xsl:value-of select="normalize-space(.)"/>
  </xsl:template>

  <!-- Suppress Contact blocks where every child is blank -->
  <xsl:template match="Contact[every $c in * satisfies normalize-space($c) = '']"/>

</xsl:stylesheet>`
  },

  // ── SAP CPI PATTERNS (continued) ────────────────────────────────

  stripSoapEnvelope: {
    label: 'Strip SOAP Envelope',
    icon:  'scissors',
    desc:  'Extract SOAP Body payload \u2014 bridge to REST or plain-XML',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ord="http://sap.com/xi/orders/v2">
  <soapenv:Header>
    <soapenv:Action>CreateOrder</soapenv:Action>
  </soapenv:Header>
  <soapenv:Body>
    <ord:CreateOrderRequest>
      <ord:PONumber>PO-2024-00991</ord:PONumber>
      <ord:Vendor>10000042</ord:Vendor>
      <ord:Currency>EUR</ord:Currency>
      <ord:TotalAmount>18750.00</ord:TotalAmount>
      <ord:Items>
        <ord:Item lineNo="1">
          <ord:Material>MAT-001</ord:Material>
          <ord:Quantity>5</ord:Quantity>
          <ord:UnitPrice>1500.00</ord:UnitPrice>
        </ord:Item>
        <ord:Item lineNo="2">
          <ord:Material>MAT-002</ord:Material>
          <ord:Quantity>10</ord:Quantity>
          <ord:UnitPrice>937.50</ord:UnitPrice>
        </ord:Item>
      </ord:Items>
    </ord:CreateOrderRequest>
  </soapenv:Body>
</soapenv:Envelope>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  exclude-result-prefixes="soap">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Strip SOAP Envelope.

    Extracts the first child element of soapenv:Body and outputs
    it as the document root, stripping the envelope and header.
    Namespace prefixes on the payload are preserved as-is.

    Common CPI patterns where this is used:
      - SOAP \u2192 REST adapter bridge (body becomes the JSON source)
      - SOAP \u2192 XI/SOAP forwarding with envelope re-wrap
      - Content-based routing where the router reads the bare payload

    The /* in soap:Body/* selects any child regardless of namespace,
    so this works with any SOAP service without changing the XSLT.
  -->

  <xsl:template match="/">
    <xsl:apply-templates select="/soap:Envelope/soap:Body/*[1]"/>
  </xsl:template>

  <!-- Identity: copy the payload and all descendants as-is -->
  <xsl:template match="@* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
  </xsl:template>

</xsl:stylesheet>`
  },

  addXmlWrapper: {
    label: 'Add XML Wrapper / Envelope',
    icon:  'package-plus',
    desc:  'Wrap payload under new root with interface metadata',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<GoodsReceipt>
  <DocumentNo>5000012345</DocumentNo>
  <PostingDate>2024-11-15</PostingDate>
  <Plant>1000</Plant>
  <StorageLocation>0001</StorageLocation>
  <Items>
    <Item>
      <LineNo>1</LineNo>
      <PurchaseOrder>4500099001</PurchaseOrder>
      <POLine>10</POLine>
      <Material>MAT-001</Material>
      <ReceivedQty>5</ReceivedQty>
      <UoM>EA</UoM>
    </Item>
    <Item>
      <LineNo>2</LineNo>
      <PurchaseOrder>4500099001</PurchaseOrder>
      <POLine>20</POLine>
      <Material>MAT-002</Material>
      <ReceivedQty>2</ReceivedQty>
      <UoM>EA</UoM>
    </Item>
  </Items>
</GoodsReceipt>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Add XML Wrapper / Envelope.

    Wraps the incoming payload under a new root element that
    carries interface metadata: sender, receiver, message ID,
    timestamp, and a payload type discriminator.

    Common scenarios in CPI:
      - Adding a canonical message envelope before PI/PO handoff
      - Wrapping payloads for async queuing (SQS, ServiceBus)
      - Adding traceability headers before archiving
      - Constructing XI 3.0 / AS2 interchange wrappers

    generate-id() produces a stable document-unique string
    suitable as a message correlation ID when no external ID
    is available in the payload.
  -->

  <xsl:param name="senderId"   select="'CPI-PROD'"/>
  <xsl:param name="receiverId" select="'WM-SYSTEM'"/>

  <xsl:template match="/">
    <InterfaceMessage
      version="1.0"
      messageId="{generate-id()}"
      sender="{$senderId}"
      receiver="{$receiverId}"
      payloadType="{local-name(/*)}"
      createdAt="{current-dateTime()}">
      <Payload>
        <xsl:copy-of select="*"/>
      </Payload>
    </InterfaceMessage>
  </xsl:template>

</xsl:stylesheet>`
  },

  idocInvoic01: {
    label: 'IDoc INVOIC01 \u2192 XML',
    icon:  'receipt',
    desc:  'Parse INVOIC01 IDoc \u2014 maps header, payment terms and items',
    cat:   'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<INVOIC01>
  <IDOC BEGIN="1">
    <EDI_DC40 SEGMENT="1">
      <TABNAM>EDI_DC40</TABNAM>
      <MANDT>100</MANDT>
      <DOCNUM>0000000000054321</DOCNUM>
      <IDOCTYP>INVOIC01</IDOCTYP>
      <MESTYP>INVOIC</MESTYP>
      <SNDPOR>VENDOR_EDI</SNDPOR>
      <RCVPOR>SAP_ERP</RCVPOR>
      <CREDAT>20241120</CREDAT>
      <CRETIM>141500</CRETIM>
    </EDI_DC40>
    <E1EDK01 SEGMENT="1">
      <ACTION>009</ACTION>
      <CURCY>EUR</CURCY>
      <HWAER>EUR</HWAER>
      <WKURS>1.00000</WKURS>
      <ZTERM>NET30</ZTERM>
      <BELNR>INV-2024-88410</BELNR>
      <NTGEW>18.500</NTGEW>
    </E1EDK01>
    <E1EDK02 SEGMENT="1">
      <QUALF>001</QUALF>
      <BELNR>4500099001</BELNR>
    </E1EDK02>
    <E1EDKA1 SEGMENT="1">
      <PARVW>LF</PARVW>
      <PARTN>V-200099</PARTN>
      <NAME1>Global Supplies AG</NAME1>
      <STRAS>Hauptstrasse 100</STRAS>
      <ORT01>Berlin</ORT01>
      <PSTLZ>10115</PSTLZ>
      <LAND1>DE</LAND1>
    </E1EDKA1>
    <E1EDP01 SEGMENT="1">
      <POSEX>000010</POSEX>
      <MATNR>000000000000012345</MATNR>
      <MAKTX>Control Valve DN50</MAKTX>
      <MENGE>10.000</MENGE>
      <MENEE>EA</MENEE>
      <VPREI>320.00</VPREI>
      <NETWR>3200.00</NETWR>
      <MWSBT>608.00</MWSBT>
      <MWSKZ>A0</MWSKZ>
    </E1EDP01>
    <E1EDP01 SEGMENT="1">
      <POSEX>000020</POSEX>
      <MATNR>000000000000067890</MATNR>
      <MAKTX>Pressure Sensor 4-20mA</MAKTX>
      <MENGE>5.000</MENGE>
      <MENEE>EA</MENEE>
      <VPREI>185.00</VPREI>
      <NETWR>925.00</NETWR>
      <MWSBT>175.75</MWSBT>
      <MWSKZ>A0</MWSKZ>
    </E1EDP01>
    <E1EDKT1 SEGMENT="1">
      <TSSPRAS>E</TSSPRAS>
      <TDID>Z001</TDID>
    </E1EDKT1>
    <E1EDKT2 SEGMENT="1">
      <TDLINE>Payment due 30 days net. Bank: IBAN DE89370400440532013000</TDLINE>
    </E1EDKT2>
  </IDOC>
</INVOIC01>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    SAP IDoc INVOIC01 \u2192 Canonical Invoice XML.

    Segment mapping:
      EDI_DC40  \u2014 control record (IDoc meta, dates)
      E1EDK01   \u2014 invoice header (currency, payment terms, doc number)
      E1EDK02   \u2014 reference documents (QUALF=001 \u2192 PO reference)
      E1EDKA1   \u2014 partner addresses (PARVW=LF \u2192 vendor/supplier)
      E1EDP01   \u2014 line items (material, qty, unit price, tax)
      E1EDKT2   \u2014 text lines (payment notes, bank details)

    VPREI = unit price, NETWR = line net value, MWSBT = tax amount.
  -->

  <xsl:template match="INVOIC01">
    <xsl:apply-templates select="IDOC"/>
  </xsl:template>

  <xsl:template match="IDOC">
    <xsl:variable name="dc"     select="EDI_DC40"/>
    <xsl:variable name="hdr"    select="E1EDK01"/>
    <xsl:variable name="vendor" select="E1EDKA1[PARVW='LF']"/>
    <xsl:variable name="poRef"  select="E1EDK02[QUALF='001']/BELNR"/>

    <Invoice>
      <IDocNumber><xsl:value-of select="normalize-space($dc/DOCNUM)"/></IDocNumber>
      <InvoiceNumber><xsl:value-of select="$hdr/BELNR"/></InvoiceNumber>
      <PurchaseOrderRef><xsl:value-of select="$poRef"/></PurchaseOrderRef>
      <InvoiceDate>
        <xsl:value-of select="concat(
          substring($dc/CREDAT,1,4),'-',
          substring($dc/CREDAT,5,2),'-',
          substring($dc/CREDAT,7,2))"/>
      </InvoiceDate>
      <Currency><xsl:value-of select="$hdr/CURCY"/></Currency>
      <PaymentTerms><xsl:value-of select="$hdr/ZTERM"/></PaymentTerms>

      <Vendor id="{$vendor/PARTN}">
        <Name><xsl:value-of select="$vendor/NAME1"/></Name>
        <Address>
          <Street><xsl:value-of select="$vendor/STRAS"/></Street>
          <City><xsl:value-of select="$vendor/ORT01"/></City>
          <PostalCode><xsl:value-of select="$vendor/PSTLZ"/></PostalCode>
          <Country><xsl:value-of select="$vendor/LAND1"/></Country>
        </Address>
      </Vendor>

      <LineItems count="{count(E1EDP01)}">
        <xsl:apply-templates select="E1EDP01"/>
      </LineItems>

      <Totals currency="{$hdr/CURCY}">
        <NetTotal>
          <xsl:value-of select="format-number(sum(E1EDP01/xs:decimal(NETWR)),'#,##0.00')"/>
        </NetTotal>
        <TaxTotal>
          <xsl:value-of select="format-number(sum(E1EDP01/xs:decimal(MWSBT)),'#,##0.00')"/>
        </TaxTotal>
        <GrossTotal>
          <xsl:value-of select="format-number(
            sum(E1EDP01/xs:decimal(NETWR)) + sum(E1EDP01/xs:decimal(MWSBT)),
            '#,##0.00')"/>
        </GrossTotal>
      </Totals>

      <xsl:if test="E1EDKT2">
        <PaymentNote>
          <xsl:value-of select="normalize-space(E1EDKT2/TDLINE)"/>
        </PaymentNote>
      </xsl:if>
    </Invoice>
  </xsl:template>

  <xsl:template match="E1EDP01">
    <Item line="{normalize-space(POSEX)}">
      <MaterialNumber><xsl:value-of select="normalize-space(MATNR)"/></MaterialNumber>
      <Description><xsl:value-of select="MAKTX"/></Description>
      <Quantity unit="{MENEE}">
        <xsl:value-of select="format-number(xs:decimal(MENGE),'#,##0.###')"/>
      </Quantity>
      <UnitPrice><xsl:value-of select="format-number(xs:decimal(VPREI),'#,##0.00')"/></UnitPrice>
      <NetValue><xsl:value-of select="format-number(xs:decimal(NETWR),'#,##0.00')"/></NetValue>
      <TaxAmount taxCode="{MWSKZ}">
        <xsl:value-of select="format-number(xs:decimal(MWSBT),'#,##0.00')"/>
      </TaxAmount>
    </Item>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── XPATH EXPLORER (continued) ───────────────────────────────────

  xpathDistinctValues: {
    label: 'distinct-values()',
    icon:  'target',
    desc:  'Deduplicate currency, status and category in CPI payloads',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "distinct-values(//Item/Currency)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrders>
  <PO id="PO-001">
    <Vendor>V-100</Vendor>
    <Item><LineNo>10</LineNo><Material>MAT-A</Material><Qty>5</Qty><UnitPrice>100.00</UnitPrice><Currency>EUR</Currency><Status>CONFIRMED</Status><Category>Pumps</Category></Item>
    <Item><LineNo>20</LineNo><Material>MAT-B</Material><Qty>2</Qty><UnitPrice>450.00</UnitPrice><Currency>USD</Currency><Status>PENDING</Status><Category>Valves</Category></Item>
    <Item><LineNo>30</LineNo><Material>MAT-C</Material><Qty>8</Qty><UnitPrice>75.00</UnitPrice><Currency>EUR</Currency><Status>CONFIRMED</Status><Category>Pumps</Category></Item>
  </PO>
  <PO id="PO-002">
    <Vendor>V-200</Vendor>
    <Item><LineNo>10</LineNo><Material>MAT-D</Material><Qty>3</Qty><UnitPrice>220.00</UnitPrice><Currency>GBP</Currency><Status>CONFIRMED</Status><Category>Sensors</Category></Item>
    <Item><LineNo>20</LineNo><Material>MAT-E</Material><Qty>12</Qty><UnitPrice>38.50</UnitPrice><Currency>EUR</Currency><Status>PENDING</Status><Category>Sensors</Category></Item>
    <Item><LineNo>30</LineNo><Material>MAT-F</Material><Qty>1</Qty><UnitPrice>1850.00</UnitPrice><Currency>USD</Currency><Status>CANCELLED</Status><Category>Valves</Category></Item>
  </PO>
</PurchaseOrders>`,
    xpathHints: [
      "distinct-values(//Item/Currency)                          \u2014 unique currencies",
      "distinct-values(//Item/Status)                            \u2014 unique statuses",
      "distinct-values(//Item/Category)                          \u2014 unique categories",
      "count(distinct-values(//Item/Currency))                   \u2014 how many currencies",
      "distinct-values(//PO/@id)                                 \u2014 unique PO IDs",
      "distinct-values(//Item[Status='CONFIRMED']/Currency)      \u2014 currencies of confirmed lines",
      "//Item[Currency = distinct-values(//Item/Currency)[1]]    \u2014 items in first currency",
      "for $c in distinct-values(//Item/Currency) return concat($c,': ',count(//Item[Currency=$c])) \u2014 count per currency",
      "distinct-values(//Item[Status='CANCELLED']/Category)    \u2014 categories with cancellations",
      "count(distinct-values(//Item/Status))                    \u2014 number of distinct statuses",
      "//PO[count(distinct-values(Item/Currency)) > 1]          \u2014 POs with mixed currencies",
    ]
  },

  xpathSiblingAxes: {
    label: 'Sibling Axes',
    icon:  'move-horizontal',
    desc:  'Sibling axes \u2014 navigate peer elements and IDoc segments',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "//E1EDP01[1]/following-sibling::E1EDP01",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40 SEGMENT="1">
    <DOCNUM>0000000000099001</DOCNUM>
    <MESTYP>ORDERS</MESTYP>
    <CREDAT>20241120</CREDAT>
  </EDI_DC40>
  <E1EDK01 SEGMENT="1">
    <BELNR>4500099001</BELNR>
    <CURCY>EUR</CURCY>
    <ZTERM>NET30</ZTERM>
  </E1EDK01>
  <E1EDP01 SEGMENT="1">
    <POSEX>000010</POSEX>
    <MATNR>MAT-001</MATNR>
    <MAKTX>Hydraulic Pump</MAKTX>
    <MENGE>5</MENGE>
    <NETWR>2500.00</NETWR>
  </E1EDP01>
  <E1EDP01 SEGMENT="1">
    <POSEX>000020</POSEX>
    <MATNR>MAT-002</MATNR>
    <MAKTX>Control Valve</MAKTX>
    <MENGE>10</MENGE>
    <NETWR>1200.00</NETWR>
  </E1EDP01>
  <E1EDP01 SEGMENT="1">
    <POSEX>000030</POSEX>
    <MATNR>MAT-003</MATNR>
    <MAKTX>Pressure Gauge</MAKTX>
    <MENGE>3</MENGE>
    <NETWR>450.00</NETWR>
  </E1EDP01>
  <E1EDKT1 SEGMENT="1">
    <TDID>Z001</TDID>
  </E1EDKT1>
  <E1EDKT2 SEGMENT="1">
    <TDLINE>Delivery expected within 14 days</TDLINE>
  </E1EDKT2>
</IDOC>`,
    xpathHints: [
      "//E1EDP01[1]/following-sibling::E1EDP01             \u2014 all line segments after first",
      "//E1EDP01[last()]/preceding-sibling::E1EDP01        \u2014 all line segments before last",
      "//E1EDKT1/following-sibling::E1EDKT2                \u2014 text lines after header text",
      "//E1EDK01/following-sibling::*[1]                   \u2014 segment immediately after header",
      "//E1EDP01[POSEX='000020']/preceding-sibling::E1EDP01 \u2014 lines before position 20",
      "count(//E1EDP01[1]/following-sibling::E1EDP01)      \u2014 count of lines after first",
      "//EDI_DC40/following-sibling::*[local-name() != 'E1EDP01'][1] \u2014 first non-item segment",
      "//E1EDP01[MENGE > 5]/following-sibling::E1EDP01          \u2014 items after a high-qty line",
      "//E1EDP01[last()]/preceding-sibling::*[1]                \u2014 segment just before last item",
      "//E1EDKT2/preceding-sibling::E1EDK01                     \u2014 header before text segment",
      "count(//E1EDK01/following-sibling::*)                     \u2014 segments after header",
      "string-join(//E1EDP01/MATNR, ', ')                       \u2014 all material numbers joined",
      "distinct-values(for $s in //IDOC/* return local-name($s)) \u2014 unique segment type names",
      "//E1EDP01[xs:decimal(NETWR) = max(//E1EDP01/xs:decimal(NETWR))] \u2014 highest value line",
    ]
  },

  xpathSequenceOps: {
    label: 'index-of() & subsequence()',
    icon:  'list-ordered',
    desc:  'index-of() and subsequence() \u2014 slice sequences',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "subsequence(//Item, 2, 3)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<BatchPayload>
  <BatchId>BATCH-2024-1120</BatchId>
  <Items>
    <Item seq="1"><Id>ITM-001</Id><Status>SUCCESS</Status><Amount>1200.00</Amount></Item>
    <Item seq="2"><Id>ITM-002</Id><Status>FAILED</Status><Amount>340.00</Amount></Item>
    <Item seq="3"><Id>ITM-003</Id><Status>SUCCESS</Status><Amount>875.00</Amount></Item>
    <Item seq="4"><Id>ITM-004</Id><Status>SUCCESS</Status><Amount>2100.00</Amount></Item>
    <Item seq="5"><Id>ITM-005</Id><Status>FAILED</Status><Amount>90.00</Amount></Item>
    <Item seq="6"><Id>ITM-006</Id><Status>SUCCESS</Status><Amount>455.00</Amount></Item>
  </Items>
</BatchPayload>`,
    xpathHints: [
      "subsequence(//Item, 2, 3)                              \u2014 items 2,3,4 (start=2, length=3)",
      "subsequence(//Item, 4)                                 \u2014 items from position 4 onwards",
      "index-of(//Item/Status, 'FAILED')                      \u2014 positions of FAILED items",
      "index-of(//Item/Id, 'ITM-003')                         \u2014 position of specific item",
      "//Item[index-of(//Item/Status,'FAILED') = position()]  \u2014 FAILED items by position",
      "subsequence(//Item[Status='SUCCESS'], 1, 2)            \u2014 first 2 successful items",
      "count(//Item) - count(//Item[Status='SUCCESS'])        \u2014 failure count",
      "//Item[@seq = string(index-of(//Item/Status,'FAILED')[1])] \u2014 first failed item by position",
      "subsequence(//Item[Status='FAILED'], 1, 1)               \u2014 first failed item",
      "for $i in index-of(//Item/Status,'FAILED') return //Item[$i]/Id \u2014 IDs of failed items",
      "string-join(for $i in index-of(//Item/Status,'FAILED') return string($i), ',') \u2014 failure positions",
    ]
  },

  xpathDeepEqual: {
    label: 'deep-equal()',
    icon:  'equal',
    desc:  'Compare XML subtrees for structural equality',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "deep-equal(//SourceOrder/LineItems, //TargetOrder/LineItems)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Reconciliation>
  <SourceOrder id="PO-9001">
    <Vendor>V-100042</Vendor>
    <Currency>EUR</Currency>
    <LineItems>
      <Item><LineNo>10</LineNo><Material>MAT-001</Material><Qty>5</Qty><Price>120.00</Price></Item>
      <Item><LineNo>20</LineNo><Material>MAT-002</Material><Qty>3</Qty><Price>85.50</Price></Item>
    </LineItems>
  </SourceOrder>
  <TargetOrder id="PO-9001">
    <Vendor>V-100042</Vendor>
    <Currency>EUR</Currency>
    <LineItems>
      <Item><LineNo>10</LineNo><Material>MAT-001</Material><Qty>5</Qty><Price>120.00</Price></Item>
      <Item><LineNo>20</LineNo><Material>MAT-002</Material><Qty>3</Qty><Price>85.50</Price></Item>
    </LineItems>
  </TargetOrder>
</Reconciliation>`,
    xpathHints: [
      "deep-equal(//SourceOrder/LineItems, //TargetOrder/LineItems)   \u2014 are line items identical?",
      "deep-equal(//SourceOrder/Vendor, //TargetOrder/Vendor)         \u2014 same vendor?",
      "not(deep-equal(//SourceOrder, //TargetOrder))                  \u2014 any difference?",
      "deep-equal(//SourceOrder/@id, //TargetOrder/@id)               \u2014 same order ID?",
      "if (deep-equal(//SourceOrder/LineItems, //TargetOrder/LineItems)) then 'MATCH' else 'MISMATCH'  \u2014 result string",
      "deep-equal(//SourceOrder/Currency, //TargetOrder/Currency)     \u2014 same currency?",
      "deep-equal(//SourceOrder/LineItems/Item[1], //TargetOrder/LineItems/Item[1]) \u2014 first line matches?",
      "count(//SourceOrder/LineItems/Item) = count(//TargetOrder/LineItems/Item)  \u2014 same line count?",
      "//SourceOrder/LineItems/Item/Material[not(. = //TargetOrder/LineItems/Item/Material)] \u2014 materials only in source",
      "if (deep-equal(//SourceOrder, //TargetOrder)) then 'IN SYNC' else concat('DIFF: ',count(//SourceOrder/LineItems/Item),' vs ',count(//TargetOrder/LineItems/Item),' lines') \u2014 sync status",
    ]
  },

  xpathTypeCasting: {
    label: 'xs: Type Casting',
    icon:  'arrow-right-left',
    desc:  'xs:integer, xs:decimal, xs:boolean \u2014 type coercion patterns',
    cat:   'xpath',
    xslt:  '',
    xpathExpr: "xs:decimal(//Item[1]/UnitPrice) * xs:integer(//Item[1]/Qty)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<OrderLines xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <Item>
    <LineNo>10</LineNo>
    <Material>MAT-001</Material>
    <Qty>5</Qty>
    <UnitPrice>1250.50</UnitPrice>
    <Confirmed>true</Confirmed>
    <DeliveryDate>2024-12-01</DeliveryDate>
    <DiscountPct>10</DiscountPct>
  </Item>
  <Item>
    <LineNo>20</LineNo>
    <Material>MAT-002</Material>
    <Qty>12</Qty>
    <UnitPrice>38.75</UnitPrice>
    <Confirmed>false</Confirmed>
    <DeliveryDate>2024-12-15</DeliveryDate>
    <DiscountPct>0</DiscountPct>
  </Item>
  <Item>
    <LineNo>30</LineNo>
    <Material>MAT-003</Material>
    <Qty>3</Qty>
    <UnitPrice>875.00</UnitPrice>
    <Confirmed>true</Confirmed>
    <DeliveryDate>2024-11-28</DeliveryDate>
    <DiscountPct>5</DiscountPct>
  </Item>
</OrderLines>`,
    xpathHints: [
      "xs:decimal(//Item[1]/UnitPrice) * xs:integer(//Item[1]/Qty)          \u2014 numeric multiply",
      "sum(//Item/(xs:decimal(UnitPrice) * xs:integer(Qty)))                 \u2014 total order value",
      "//Item[xs:integer(Qty) gt 5]                                          \u2014 qty filter (numeric)",
      "xs:boolean(//Item[1]/Confirmed)                                       \u2014 string to boolean",
      "//Item[xs:boolean(Confirmed) = true()]                                \u2014 confirmed items",
      "xs:date(//Item[1]/DeliveryDate) lt xs:date('2024-12-10')              \u2014 date comparison",
      "//Item[xs:date(DeliveryDate) lt xs:date('2024-12-10')]                \u2014 items due before Dec 10",
      "xs:decimal(//Item[1]/UnitPrice) * (1 - xs:decimal(//Item[1]/DiscountPct) div 100) \u2014 discounted price",
      "sum(//Item[xs:boolean(Confirmed)]/(xs:decimal(UnitPrice)*xs:integer(Qty)))  \u2014 confirmed order value",
      "max(for $i in //Item return xs:decimal($i/UnitPrice))                       \u2014 highest unit price",
      "//Item[xs:date(DeliveryDate) = min(for $i in //Item return xs:date($i/DeliveryDate))] \u2014 earliest delivery",
      "format-number(avg(//Item/xs:decimal(UnitPrice)),'#,##0.00')                 \u2014 formatted average",
    ]
  },

  // ── FORMAT CONVERSION — OUTPUT EXAMPLES ──────────────────────────

  xmlToJson: {
    label: 'XML \u2192 JSON Output',
    icon:  'braces',
    desc:  'XML to JSON via XSLT 3.0 maps and arrays \u2014 method="json"',
    cat:   'format',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SalesOrders>
  <Order id="SO-4001">
    <Customer>
      <Id>C-10042</Id>
      <Name>Acme Corp</Name>
      <Country>US</Country>
    </Customer>
    <Currency>USD</Currency>
    <Status>CONFIRMED</Status>
    <Items>
      <Item>
        <LineNo>10</LineNo>
        <Material>MAT-001</Material>
        <Qty>5</Qty>
        <UnitPrice>120.00</UnitPrice>
      </Item>
      <Item>
        <LineNo>20</LineNo>
        <Material>MAT-002</Material>
        <Qty>3</Qty>
        <UnitPrice>85.50</UnitPrice>
      </Item>
    </Items>
  </Order>
  <Order id="SO-4002">
    <Customer>
      <Id>C-20017</Id>
      <Name>GlobalTech GmbH</Name>
      <Country>DE</Country>
    </Customer>
    <Currency>EUR</Currency>
    <Status>PENDING</Status>
    <Items>
      <Item>
        <LineNo>10</LineNo>
        <Material>MAT-005</Material>
        <Qty>12</Qty>
        <UnitPrice>43.00</UnitPrice>
      </Item>
    </Items>
  </Order>
</SalesOrders>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:output method="json" indent="yes"/>

  <!--
    XML to JSON using XSLT 3.0 maps and arrays.

    Key XSLT 3.0 constructs used:
      map{ }         \u2014 creates a JSON object
      array{ }       \u2014 creates a JSON array
      for ... return \u2014 iterates nodes into array entries
      number()       \u2014 ensures numeric fields are not quoted in JSON

    In SAP CPI this pattern is used when the target system
    expects a REST/JSON payload but the source is an IDoc or
    SOAP/XML message.
  -->

  <xsl:template match="/">
    <xsl:sequence select="map{
      'orders': array{
        for $o in /SalesOrders/Order return map{
          'id'      : string($o/@id),
          'customer': map{
            'id'     : string($o/Customer/Id),
            'name'   : string($o/Customer/Name),
            'country': string($o/Customer/Country)
          },
          'currency': string($o/Currency),
          'status'  : string($o/Status),
          'items'   : array{
            for $i in $o/Items/Item return map{
              'lineNo'   : number($i/LineNo),
              'material' : string($i/Material),
              'qty'      : number($i/Qty),
              'unitPrice': number($i/UnitPrice)
            }
          }
        }
      }
    }"/>
  </xsl:template>

</xsl:stylesheet>`
  },

  xmlToCsv: {
    label: 'XML \u2192 CSV Output',
    icon:  'table',
    desc:  'Export to RFC 4180 CSV \u2014 handles commas and quotes in fields',
    cat:   'format',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrders>
  <PO number="PO-9001" vendor="V-100">
    <VendorName>Acme Supplies, Inc.</VendorName>
    <OrderDate>2024-03-15</OrderDate>
    <Items>
      <Item>
        <LineNo>1</LineNo>
        <Description>Hydraulic Pump 50bar</Description>
        <Qty>10</Qty>
        <UnitPrice>450.00</UnitPrice>
        <Currency>USD</Currency>
      </Item>
      <Item>
        <LineNo>2</LineNo>
        <Description>Seal Kit "Premium", 50bar</Description>
        <Qty>50</Qty>
        <UnitPrice>12.50</UnitPrice>
        <Currency>USD</Currency>
      </Item>
      <Item>
        <LineNo>3</LineNo>
        <Description>Pressure Gauge</Description>
        <Qty>5</Qty>
        <UnitPrice>88.00</UnitPrice>
        <Currency>USD</Currency>
      </Item>
    </Items>
  </PO>
</PurchaseOrders>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:f="urn:xsltdebugx:fn"
  exclude-result-prefixes="xs f">

  <xsl:output method="text" encoding="UTF-8"/>

  <!--
    XML to RFC 4180-compliant CSV.

    RFC 4180 quoting rules applied via the csv-field function:
      \u2022 Fields containing commas, double-quotes, or newlines are wrapped in "..."
      \u2022 Any " inside a field is escaped as ""

    This is safer than a plain string-join() which breaks whenever
    vendor names or item descriptions from SAP master data contain
    the delimiter character.
  -->

  <xsl:variable name="nl" select="'&#10;'"/>
  <xsl:variable name="q"  select="'&quot;'"/>

  <xsl:function name="f:csv-field" as="xs:string">
    <xsl:param name="val" as="xs:string"/>
    <xsl:variable name="escaped" select="replace($val, $q, concat($q,$q))"/>
    <xsl:sequence select="
      if (contains($val, ',') or contains($val, $q) or contains($val, '&#10;'))
      then concat($q, $escaped, $q)
      else $val
    "/>
  </xsl:function>

  <xsl:template match="/">
    <xsl:value-of select="'PONumber,Vendor,VendorName,OrderDate,LineNo,Description,Qty,UnitPrice,Currency'"/>
    <xsl:value-of select="$nl"/>
    <xsl:for-each select="/PurchaseOrders/PO/Items/Item">
      <xsl:variable name="po" select="parent::Items/parent::PO"/>
      <xsl:value-of select="string-join((
        f:csv-field(string($po/@number)),
        f:csv-field(string($po/@vendor)),
        f:csv-field(string($po/VendorName)),
        f:csv-field(string($po/OrderDate)),
        f:csv-field(string(LineNo)),
        f:csv-field(string(Description)),
        f:csv-field(string(Qty)),
        f:csv-field(string(UnitPrice)),
        f:csv-field(string(Currency))
      ), ',')"/>
      <xsl:value-of select="$nl"/>
    </xsl:for-each>
  </xsl:template>

</xsl:stylesheet>`
  },

  xmlToFixedLength: {
    label: 'XML \u2192 Fixed-Length Output',
    icon:  'ruler',
    desc:  'Fixed-width flat file with padded/truncated fields',
    cat:   'format',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Employees>
  <Employee>
    <EmpId>E00123</EmpId>
    <LastName>Muller</LastName>
    <FirstName>Hans</FirstName>
    <CostCenter>CC-4100</CostCenter>
    <Salary>92500</Salary>
    <StartDate>2019-03-01</StartDate>
  </Employee>
  <Employee>
    <EmpId>E00456</EmpId>
    <LastName>Krishnamurthy</LastName>
    <FirstName>Priya</FirstName>
    <CostCenter>CC-2200</CostCenter>
    <Salary>105000</Salary>
    <StartDate>2021-11-15</StartDate>
  </Employee>
  <Employee>
    <EmpId>E00789</EmpId>
    <LastName>Smith</LastName>
    <FirstName>Jo</FirstName>
    <CostCenter>CC-3300</CostCenter>
    <Salary>78000</Salary>
    <StartDate>2023-06-01</StartDate>
  </Employee>
</Employees>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:f="urn:xsltdebugx:fn"
  exclude-result-prefixes="xs f">

  <xsl:output method="text" encoding="UTF-8"/>

  <!--
    XML to Fixed-Length Flat File.

    Required by legacy mainframe systems, AS2 EDI partners, and
    some SAP payroll integrations where each field must occupy
    an exact column position regardless of actual data length.

    Layout (67 chars per record):
      Col  1\u2013 6  EmpId       (6  chars, left-aligned, space-padded)
      Col  7\u201326  LastName    (20 chars, left-aligned, space-padded, truncated)
      Col 27\u201341  FirstName   (15 chars, left-aligned, space-padded, truncated)
      Col 42\u201349  CostCenter  (8  chars, left-aligned, space-padded)
      Col 50\u201357  Salary      (8  chars, right-aligned, zero-padded)
      Col 58\u201367  StartDate   (10 chars, YYYY-MM-DD as-is)

    pad-right \u2014 left-aligns text, pads or truncates to exact width
    pad-left  \u2014 right-aligns numbers with leading zeros
  -->

  <xsl:variable name="nl"     select="'&#10;'"/>
  <xsl:variable name="spaces" select="'                              '"/>
  <xsl:variable name="zeros"  select="'00000000'"/>

  <xsl:function name="f:pad-right" as="xs:string">
    <xsl:param name="val"   as="xs:string"/>
    <xsl:param name="width" as="xs:integer"/>
    <xsl:sequence select="substring(concat($val, $spaces), 1, $width)"/>
  </xsl:function>

  <xsl:function name="f:pad-left" as="xs:string">
    <xsl:param name="val"   as="xs:string"/>
    <xsl:param name="width" as="xs:integer"/>
    <xsl:variable name="padded" select="concat($zeros, $val)"/>
    <xsl:sequence select="substring($padded, string-length($padded) - $width + 1, $width)"/>
  </xsl:function>

  <xsl:template match="/">
    <xsl:for-each select="/Employees/Employee">
      <xsl:value-of select="concat(
        f:pad-right(string(EmpId),      6),
        f:pad-right(string(LastName),  20),
        f:pad-right(string(FirstName), 15),
        f:pad-right(string(CostCenter), 8),
        f:pad-left(string(Salary),      8),
        string(StartDate),
        $nl
      )"/>
    </xsl:for-each>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── XSLT 3.0 ADVANCED ──────────────────────────────────────────

  mapsAndArrays: {
    label: 'Maps & Arrays',
    icon: 'map',
    desc: 'XPath 3.1 maps and arrays for structured data routing',
    cat:  'advanced',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Products>
  <Product id="P-001" category="electronics">
    <Name>Industrial Sensor XR20</Name>
    <Price currency="EUR">125.00</Price>
    <Stock warehouse="WH-01">42</Stock>
    <Stock warehouse="WH-02">18</Stock>
  </Product>
  <Product id="P-002" category="mechanical">
    <Name>Hydraulic Pump 50bar</Name>
    <Price currency="USD">890.00</Price>
    <Stock warehouse="WH-01">7</Stock>
    <Stock warehouse="WH-03">23</Stock>
  </Product>
  <Product id="P-003" category="electronics">
    <Name>Control Module CM50</Name>
    <Price currency="EUR">450.00</Price>
    <Stock warehouse="WH-02">31</Stock>
  </Product>
</Products>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:map="http://www.w3.org/2005/xpath-functions/map"
  xmlns:array="http://www.w3.org/2005/xpath-functions/array"
  exclude-result-prefixes="xs map array">
  <xsl:output method="xml" indent="yes"/>

  <!--
    XPath 3.1 maps and arrays: build a lookup map from product data,
    then use it to route products by category to different targets.
    Demonstrates map{}, array{}, map:keys(), map:get().
  -->

  <xsl:template match="/">
    <xsl:variable name="doc" select="/"/>
    <xsl:variable name="priceMap" select="
      map:merge(
        for $p in /Products/Product
        return map{ string($p/@id): xs:decimal($p/Price) }
      )
    "/>

    <xsl:variable name="categories" select="
      array{ distinct-values(/Products/Product/@category) }
    "/>

    <RoutingPlan>
      <PriceIndex>
        <xsl:for-each select="map:keys($priceMap)">
          <Entry id="{.}" price="{map:get($priceMap, .)}"/>
        </xsl:for-each>
      </PriceIndex>
      <Categories count="{array:size($categories)}">
        <xsl:for-each select="1 to array:size($categories)">
          <xsl:variable name="cat" select="array:get($categories, .)"/>
          <Category name="{$cat}"
                    products="{count($doc/Products/Product[@category = $cat])}"/>
        </xsl:for-each>
      </Categories>
    </RoutingPlan>
  </xsl:template>

</xsl:stylesheet>`
  },

  higherOrderFilter: {
    label: 'Higher-Order: filter() & sort()',
    icon: 'zap',
    desc: 'Functional filter() and sort() with custom comparator',
    cat:  'advanced',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Shipments>
  <Shipment id="SH-001">
    <Origin>Frankfurt</Origin>
    <Destination>Singapore</Destination>
    <Weight unit="kg">1250</Weight>
    <Priority>HIGH</Priority>
    <DueDate>2024-04-01</DueDate>
  </Shipment>
  <Shipment id="SH-002">
    <Origin>Mumbai</Origin>
    <Destination>London</Destination>
    <Weight unit="kg">340</Weight>
    <Priority>LOW</Priority>
    <DueDate>2024-04-15</DueDate>
  </Shipment>
  <Shipment id="SH-003">
    <Origin>Shanghai</Origin>
    <Destination>New York</Destination>
    <Weight unit="kg">2100</Weight>
    <Priority>HIGH</Priority>
    <DueDate>2024-03-28</DueDate>
  </Shipment>
  <Shipment id="SH-004">
    <Origin>Berlin</Origin>
    <Destination>Tokyo</Destination>
    <Weight unit="kg">890</Weight>
    <Priority>MEDIUM</Priority>
    <DueDate>2024-04-05</DueDate>
  </Shipment>
</Shipments>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Higher-order functions: filter() selects elements by predicate,
    sort() orders with a custom key function. Avoids verbose
    xsl:for-each with nested xsl:sort for simple cases.
  -->

  <xsl:template match="/">
    <xsl:variable name="shipments" select="/Shipments/Shipment"/>

    <!-- filter(): keep only heavy shipments (>500kg) -->
    <xsl:variable name="heavy" select="
      filter($shipments, function($s) { xs:decimal($s/Weight) gt 500 })
    "/>

    <!-- sort(): order by DueDate ascending -->
    <xsl:variable name="sorted" select="
      sort($heavy, (), function($s) { xs:date($s/DueDate) })
    "/>

    <HeavyShipments count="{count($sorted)}">
      <xsl:for-each select="$sorted">
        <Shipment id="{@id}" priority="{Priority}">
          <Route><xsl:value-of select="concat(Origin, ' → ', Destination)"/></Route>
          <Weight><xsl:value-of select="Weight"/> kg</Weight>
          <DueDate><xsl:value-of select="DueDate"/></DueDate>
        </Shipment>
      </xsl:for-each>
    </HeavyShipments>
  </xsl:template>

</xsl:stylesheet>`
  },

  higherOrderFold: {
    label: 'Higher-Order: fold-left()',
    icon: 'iteration-cw',
    desc: 'Running totals via fold-left() — no recursion needed',
    cat:  'advanced',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Transactions>
  <Transaction>
    <Date>2024-03-01</Date>
    <Type>CREDIT</Type>
    <Amount>5000.00</Amount>
    <Description>Opening balance</Description>
  </Transaction>
  <Transaction>
    <Date>2024-03-05</Date>
    <Type>DEBIT</Type>
    <Amount>1200.00</Amount>
    <Description>Supplier payment</Description>
  </Transaction>
  <Transaction>
    <Date>2024-03-12</Date>
    <Type>CREDIT</Type>
    <Amount>3400.00</Amount>
    <Description>Customer receipt</Description>
  </Transaction>
  <Transaction>
    <Date>2024-03-18</Date>
    <Type>DEBIT</Type>
    <Amount>800.00</Amount>
    <Description>Office supplies</Description>
  </Transaction>
  <Transaction>
    <Date>2024-03-25</Date>
    <Type>DEBIT</Type>
    <Amount>2500.00</Amount>
    <Description>Equipment lease</Description>
  </Transaction>
</Transactions>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:map="http://www.w3.org/2005/xpath-functions/map"
  exclude-result-prefixes="xs map">
  <xsl:output method="xml" indent="yes"/>

  <!--
    fold-left(): compute running balance without recursion.
    Each transaction adds or subtracts from an accumulator.
    Replaces complex recursive templates in XSLT 1.0/2.0.
  -->

  <xsl:template match="/">
    <xsl:variable name="txns" select="/Transactions/Transaction"/>

    <xsl:variable name="withBalance" select="
      fold-left($txns, map{ 'balance': 0, 'rows': () },
        function($acc, $txn) {
          let $amt := xs:decimal($txn/Amount),
              $delta := if ($txn/Type = 'CREDIT') then $amt else -$amt,
              $newBal := map:get($acc, 'balance') + $delta
          return map{
            'balance': $newBal,
            'rows': (map:get($acc, 'rows'), map{ 'txn': $txn, 'bal': $newBal })
          }
        }
      )
    "/>

    <Ledger finalBalance="{map:get($withBalance, 'balance')}">
      <xsl:for-each select="map:get($withBalance, 'rows')">
        <Entry date="{map:get(., 'txn')/Date}"
               type="{map:get(., 'txn')/Type}"
               amount="{map:get(., 'txn')/Amount}"
               balance="{map:get(., 'bal')}">
          <xsl:value-of select="map:get(., 'txn')/Description"/>
        </Entry>
      </xsl:for-each>
    </Ledger>
  </xsl:template>

</xsl:stylesheet>`
  },

  groupByAdjacent: {
    label: 'Group-by Adjacent',
    icon: 'rows-3',
    desc: 'Detect consecutive runs with group-adjacent',
    cat:  'advanced',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SensorReadings device="TEMP-01">
  <Reading time="08:00" value="22.1" status="NORMAL"/>
  <Reading time="08:15" value="22.3" status="NORMAL"/>
  <Reading time="08:30" value="28.7" status="WARNING"/>
  <Reading time="08:45" value="31.2" status="WARNING"/>
  <Reading time="09:00" value="35.8" status="WARNING"/>
  <Reading time="09:15" value="24.1" status="NORMAL"/>
  <Reading time="09:30" value="23.9" status="NORMAL"/>
  <Reading time="09:45" value="29.5" status="WARNING"/>
  <Reading time="10:00" value="22.0" status="NORMAL"/>
</SensorReadings>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    group-adjacent: detect consecutive runs of the same status.
    Groups readings into "episodes" where each episode is an
    unbroken sequence of the same status value. Essential for
    alerting, time-series analysis, and CPI batch error detection.
  -->

  <xsl:template match="SensorReadings">
    <AlertReport device="{@device}">
      <xsl:for-each-group select="Reading" group-adjacent="@status">
        <Episode status="{current-grouping-key()}"
                 readings="{count(current-group())}"
                 from="{current-group()[1]/@time}"
                 to="{current-group()[last()]/@time}">
          <xsl:if test="current-grouping-key() = 'WARNING'">
            <MaxValue><xsl:value-of select="max(current-group()/xs:decimal(@value))"/></MaxValue>
          </xsl:if>
        </Episode>
      </xsl:for-each-group>
    </AlertReport>
  </xsl:template>

</xsl:stylesheet>`
  },

  groupByStartingWith: {
    label: 'Group Starting-With',
    icon: 'bookmark',
    desc: 'Flat-to-hierarchy via group-starting-with pattern',
    cat:  'advanced',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<FlatRecords>
  <Record type="HEADER" id="H001" customer="ACME Corp" date="2024-03-15"/>
  <Record type="ITEM" lineNo="10" material="MAT-001" qty="5" price="120.00"/>
  <Record type="ITEM" lineNo="20" material="MAT-002" qty="3" price="85.50"/>
  <Record type="HEADER" id="H002" customer="GlobalTech" date="2024-03-16"/>
  <Record type="ITEM" lineNo="10" material="MAT-005" qty="12" price="43.00"/>
  <Record type="ITEM" lineNo="20" material="MAT-008" qty="1" price="1250.00"/>
  <Record type="ITEM" lineNo="30" material="MAT-003" qty="8" price="67.00"/>
</FlatRecords>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    group-starting-with: convert flat sequential records into
    nested hierarchy. Each HEADER record starts a new group
    that includes all following ITEM records until the next HEADER.
    Common pattern for IDoc flat segments and EDI parsing.
  -->

  <xsl:template match="FlatRecords">
    <Orders>
      <xsl:for-each-group select="Record" group-starting-with="Record[@type='HEADER']">
        <xsl:variable name="hdr" select="current-group()[1]"/>
        <Order id="{$hdr/@id}" customer="{$hdr/@customer}" date="{$hdr/@date}">
          <Items>
            <xsl:for-each select="current-group()[position() gt 1]">
              <Item lineNo="{@lineNo}" material="{@material}">
                <Qty><xsl:value-of select="@qty"/></Qty>
                <Price><xsl:value-of select="format-number(xs:decimal(@price), '#,##0.00')"/></Price>
              </Item>
            </xsl:for-each>
          </Items>
          <Total><xsl:value-of select="format-number(
            sum(current-group()[position() gt 1]/(xs:decimal(@qty) * xs:decimal(@price))),
            '#,##0.00')"/></Total>
        </Order>
      </xsl:for-each-group>
    </Orders>
  </xsl:template>

</xsl:stylesheet>`
  },

  inlineFunctions: {
    label: 'User-Defined Functions (xsl:function)',
    icon: 'blocks',
    desc: 'Reusable xsl:function for DRY stylesheets',
    cat:  'advanced',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Invoices>
  <Invoice id="INV-001" currency="EUR">
    <LineItems>
      <Line qty="5" unitPrice="120.00" taxRate="0.19"/>
      <Line qty="3" unitPrice="85.50" taxRate="0.19"/>
      <Line qty="10" unitPrice="22.00" taxRate="0.07"/>
    </LineItems>
  </Invoice>
  <Invoice id="INV-002" currency="USD">
    <LineItems>
      <Line qty="2" unitPrice="450.00" taxRate="0.08"/>
      <Line qty="1" unitPrice="1200.00" taxRate="0.08"/>
    </LineItems>
  </Invoice>
</Invoices>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:f="urn:xsltdebugx:fn"
  exclude-result-prefixes="xs f">
  <xsl:output method="xml" indent="yes"/>

  <!--
    xsl:function: define reusable functions to avoid repeating
    calculation logic. Keeps templates clean and enables unit-testable
    business logic. Use a custom namespace (f:) to avoid collisions.
  -->

  <xsl:function name="f:line-total" as="xs:decimal">
    <xsl:param name="line" as="element()"/>
    <xsl:sequence select="xs:decimal($line/@qty) * xs:decimal($line/@unitPrice)"/>
  </xsl:function>

  <xsl:function name="f:line-tax" as="xs:decimal">
    <xsl:param name="line" as="element()"/>
    <xsl:sequence select="f:line-total($line) * xs:decimal($line/@taxRate)"/>
  </xsl:function>

  <xsl:function name="f:format-amount" as="xs:string">
    <xsl:param name="amount" as="xs:decimal"/>
    <xsl:param name="currency" as="xs:string"/>
    <xsl:sequence select="concat($currency, ' ', format-number($amount, '#,##0.00'))"/>
  </xsl:function>

  <xsl:template match="Invoices">
    <InvoiceSummary>
      <xsl:for-each select="Invoice">
        <xsl:variable name="lines" select="LineItems/Line"/>
        <xsl:variable name="subtotal" select="sum(for $l in $lines return f:line-total($l))"/>
        <xsl:variable name="tax" select="sum(for $l in $lines return f:line-tax($l))"/>
        <Invoice id="{@id}">
          <Subtotal><xsl:value-of select="f:format-amount($subtotal, @currency)"/></Subtotal>
          <Tax><xsl:value-of select="f:format-amount($tax, @currency)"/></Tax>
          <GrandTotal><xsl:value-of select="f:format-amount($subtotal + $tax, @currency)"/></GrandTotal>
        </Invoice>
      </xsl:for-each>
    </InvoiceSummary>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── SAP CPI PATTERNS (advanced) ──────────────────────────────────

  s4BusinessPartner: {
    label: 'S/4HANA Business Partner',
    icon: 'building-2',
    desc: 'Map BP OData API response to canonical partner format',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<BusinessPartner xmlns="http://sap.com/s4/bupa/v1">
  <BusinessPartnerNumber>BP-0010042</BusinessPartnerNumber>
  <BusinessPartnerCategory>1</BusinessPartnerCategory>
  <FirstName>Thomas</FirstName>
  <LastName>Mueller</LastName>
  <BusinessPartnerFullName>Thomas Mueller</BusinessPartnerFullName>
  <CreationDate>2023-06-15</CreationDate>
  <IsFemale>false</IsFemale>
  <IsMale>true</IsMale>
  <Language>DE</Language>
  <Addresses>
    <Address>
      <AddressID>1</AddressID>
      <Country>DE</Country>
      <Region>BY</Region>
      <CityName>Munich</CityName>
      <PostalCode>80331</PostalCode>
      <StreetName>Marienplatz</StreetName>
      <HouseNumber>8</HouseNumber>
    </Address>
  </Addresses>
  <Roles>
    <Role>FLCU00</Role>
    <Role>BUP003</Role>
  </Roles>
  <BankAccounts>
    <BankAccount>
      <BankCountry>DE</BankCountry>
      <BankNumber>70050000</BankNumber>
      <BankAccountNumber>123456789</BankAccountNumber>
      <IBAN>DE89370400440532013000</IBAN>
    </BankAccount>
  </BankAccounts>
</BusinessPartner>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:s4="http://sap.com/s4/bupa/v1"
  exclude-result-prefixes="xs s4">
  <xsl:output method="xml" indent="yes"/>

  <!--
    S/4HANA Business Partner OData mapping: transform the BUPA API
    response into a canonical partner format for downstream systems.
    Strips S/4 namespace, maps category codes, flattens address.
  -->

  <xsl:template match="s4:BusinessPartner">
    <Partner>
      <Id><xsl:value-of select="s4:BusinessPartnerNumber"/></Id>
      <Type>
        <xsl:choose>
          <xsl:when test="s4:BusinessPartnerCategory = '1'">Person</xsl:when>
          <xsl:when test="s4:BusinessPartnerCategory = '2'">Organization</xsl:when>
          <xsl:otherwise>Group</xsl:otherwise>
        </xsl:choose>
      </Type>
      <Name>
        <First><xsl:value-of select="s4:FirstName"/></First>
        <Last><xsl:value-of select="s4:LastName"/></Last>
        <Full><xsl:value-of select="s4:BusinessPartnerFullName"/></Full>
      </Name>
      <Gender>
        <xsl:choose>
          <xsl:when test="s4:IsMale = 'true'">M</xsl:when>
          <xsl:when test="s4:IsFemale = 'true'">F</xsl:when>
          <xsl:otherwise>X</xsl:otherwise>
        </xsl:choose>
      </Gender>
      <Language><xsl:value-of select="s4:Language"/></Language>
      <CreatedOn><xsl:value-of select="s4:CreationDate"/></CreatedOn>
      <xsl:apply-templates select="s4:Addresses/s4:Address[1]"/>
      <Roles>
        <xsl:for-each select="s4:Roles/s4:Role">
          <Role code="{.}"/>
        </xsl:for-each>
      </Roles>
    </Partner>
  </xsl:template>

  <xsl:template match="s4:Address">
    <Address primary="true">
      <Street><xsl:value-of select="concat(s4:StreetName, ' ', s4:HouseNumber)"/></Street>
      <City><xsl:value-of select="s4:CityName"/></City>
      <PostalCode><xsl:value-of select="s4:PostalCode"/></PostalCode>
      <Region><xsl:value-of select="s4:Region"/></Region>
      <Country><xsl:value-of select="s4:Country"/></Country>
    </Address>
  </xsl:template>

</xsl:stylesheet>`
  },

  s4SalesOrder: {
    label: 'S/4HANA Sales Order A2X',
    icon: 'shopping-cart',
    desc: 'Transform S/4 Sales Order API to internal schema',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SalesOrder xmlns="http://sap.com/s4/sd/v1">
  <SalesOrderNumber>SO-0000045678</SalesOrderNumber>
  <SalesOrderType>OR</SalesOrderType>
  <SalesOrganization>1000</SalesOrganization>
  <DistributionChannel>10</DistributionChannel>
  <SoldToParty>C-10042</SoldToParty>
  <PurchaseOrderByCustomer>CUST-PO-9981</PurchaseOrderByCustomer>
  <CreationDate>2024-03-20</CreationDate>
  <RequestedDeliveryDate>2024-04-05</RequestedDeliveryDate>
  <OverallSDProcessStatus>B</OverallSDProcessStatus>
  <TotalNetAmount>18750.00</TotalNetAmount>
  <TransactionCurrency>EUR</TransactionCurrency>
  <Items>
    <Item>
      <SalesOrderItem>000010</SalesOrderItem>
      <Material>FG-2000</Material>
      <MaterialDescription>Electric Motor 5kW</MaterialDescription>
      <RequestedQuantity>5</RequestedQuantity>
      <RequestedQuantityUnit>EA</RequestedQuantityUnit>
      <NetAmount>12500.00</NetAmount>
      <Plant>1000</Plant>
      <StorageLocation>0001</StorageLocation>
    </Item>
    <Item>
      <SalesOrderItem>000020</SalesOrderItem>
      <Material>FG-3010</Material>
      <MaterialDescription>Control Panel CP-A</MaterialDescription>
      <RequestedQuantity>2</RequestedQuantity>
      <RequestedQuantityUnit>EA</RequestedQuantityUnit>
      <NetAmount>6250.00</NetAmount>
      <Plant>2000</Plant>
      <StorageLocation>0002</StorageLocation>
    </Item>
  </Items>
</SalesOrder>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:sd="http://sap.com/s4/sd/v1"
  exclude-result-prefixes="xs sd">
  <xsl:output method="xml" indent="yes"/>

  <!--
    S/4HANA Sales Order A2X API mapping: transform the SD API
    response to an internal order schema. Maps process status codes,
    computes line-level unit prices, and normalizes item numbers.
  -->

  <xsl:template match="sd:SalesOrder">
    <Order>
      <OrderNumber><xsl:value-of select="sd:SalesOrderNumber"/></OrderNumber>
      <Type><xsl:value-of select="sd:SalesOrderType"/></Type>
      <CustomerRef><xsl:value-of select="sd:PurchaseOrderByCustomer"/></CustomerRef>
      <Customer><xsl:value-of select="sd:SoldToParty"/></Customer>
      <Status>
        <xsl:choose>
          <xsl:when test="sd:OverallSDProcessStatus = 'A'">NOT_STARTED</xsl:when>
          <xsl:when test="sd:OverallSDProcessStatus = 'B'">IN_PROGRESS</xsl:when>
          <xsl:when test="sd:OverallSDProcessStatus = 'C'">COMPLETED</xsl:when>
          <xsl:otherwise>UNKNOWN</xsl:otherwise>
        </xsl:choose>
      </Status>
      <Dates>
        <Created><xsl:value-of select="sd:CreationDate"/></Created>
        <RequestedDelivery><xsl:value-of select="sd:RequestedDeliveryDate"/></RequestedDelivery>
      </Dates>
      <Totals currency="{sd:TransactionCurrency}">
        <NetAmount><xsl:value-of select="format-number(xs:decimal(sd:TotalNetAmount), '#,##0.00')"/></NetAmount>
      </Totals>
      <LineItems>
        <xsl:for-each select="sd:Items/sd:Item">
          <LineItem number="{xs:integer(sd:SalesOrderItem)}">
            <Material><xsl:value-of select="sd:Material"/></Material>
            <Description><xsl:value-of select="sd:MaterialDescription"/></Description>
            <Quantity uom="{sd:RequestedQuantityUnit}"><xsl:value-of select="sd:RequestedQuantity"/></Quantity>
            <UnitPrice><xsl:value-of select="format-number(xs:decimal(sd:NetAmount) div xs:decimal(sd:RequestedQuantity), '#,##0.00')"/></UnitPrice>
            <NetAmount><xsl:value-of select="format-number(xs:decimal(sd:NetAmount), '#,##0.00')"/></NetAmount>
            <Fulfillment plant="{sd:Plant}" storageLocation="{sd:StorageLocation}"/>
          </LineItem>
        </xsl:for-each>
      </LineItems>
    </Order>
  </xsl:template>

</xsl:stylesheet>`
  },

  cpiDynamicConfig: {
    label: 'CPI Dynamic Configuration',
    icon: 'settings',
    desc: 'Set receiver and interface dynamically from payload',
    cat:  'cpi',
    headers: [['SAP_Sender', 'ERP_PROD']],
    properties: [['routingMode', 'CONTENT_BASED']],
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Message>
  <Header>
    <MessageType>ORDERS</MessageType>
    <SenderSystem>ERP_PROD</SenderSystem>
    <ReceiverSystem>CRM_EU</ReceiverSystem>
    <Priority>HIGH</Priority>
    <Country>DE</Country>
  </Header>
  <Payload>
    <OrderId>PO-2024-88123</OrderId>
    <Amount currency="EUR">42500.00</Amount>
    <Customer>C-20017</Customer>
  </Payload>
</Message>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:cpi="http://sap.com/it/"
  exclude-result-prefixes="xs cpi">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Dynamic Configuration: set SAP CPI receiver determination and
    interface at runtime based on message content. Used when routing
    cannot be determined statically in the iFlow configuration.
  -->

  <xsl:param name="exchange"/>

  <xsl:template match="/">
    <xsl:variable name="msg" select="/Message"/>
    <xsl:variable name="country" select="$msg/Header/Country"/>
    <xsl:variable name="msgType" select="$msg/Header/MessageType"/>
    <xsl:variable name="amount" select="xs:decimal($msg/Payload/Amount)"/>

    <!-- Determine receiver based on country -->
    <xsl:variable name="receiver" select="
      if ($country = ('DE', 'AT', 'CH')) then 'CRM_EU_CENTRAL'
      else if ($country = ('US', 'CA')) then 'CRM_AMERICAS'
      else 'CRM_DEFAULT'
    "/>

    <!-- Determine interface based on message type + amount threshold -->
    <xsl:variable name="interface" select="
      if ($amount gt 50000) then concat($msgType, '_PRIORITY')
      else $msgType
    "/>

    <!-- Set dynamic configuration headers for CPI routing -->
    <xsl:value-of select="cpi:setHeader($exchange, 'SAP_Receiver', $receiver)"/>
    <xsl:value-of select="cpi:setHeader($exchange, 'SAP_Interface', $interface)"/>
    <xsl:value-of select="cpi:setProperty($exchange, 'resolvedReceiver', $receiver)"/>
    <xsl:value-of select="cpi:setProperty($exchange, 'resolvedInterface', $interface)"/>

    <xsl:message select="concat('[ROUTING] ', $receiver, '/', $interface, ' for ', $msg/Payload/OrderId)"/>

    <!-- Pass through payload unchanged -->
    <xsl:copy-of select="$msg/Payload"/>
  </xsl:template>

</xsl:stylesheet>`
  },

  cpiMultiMapping: {
    label: 'Multi-Mapping (1:N Split)',
    icon: 'git-fork',
    desc: 'Produce multiple output documents with routing context',
    cat:  'cpi',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<BatchOrder>
  <OrderId>BO-2024-5501</OrderId>
  <Customer>C-10042</Customer>
  <Lines>
    <Line plant="1000" material="MAT-A" qty="10" type="STANDARD"/>
    <Line plant="1000" material="MAT-B" qty="5" type="STANDARD"/>
    <Line plant="2000" material="MAT-C" qty="3" type="CONSIGNMENT"/>
    <Line plant="2000" material="MAT-D" qty="8" type="STANDARD"/>
    <Line plant="3000" material="MAT-E" qty="1" type="SUBCONTRACT"/>
  </Lines>
</BatchOrder>`,
    xslt: `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  exclude-result-prefixes="xs">
  <xsl:output method="xml" indent="yes"/>

  <!--
    Multi-Mapping 1:N: split a single batch order into one output
    document per plant. Each sub-document carries routing metadata
    so a CPI Splitter step can send each to the correct receiver.
    Uses xsl:for-each-group to partition by plant.
  -->

  <xsl:template match="/">
    <xsl:variable name="order" select="/BatchOrder"/>
    <MultiMessages>
      <xsl:for-each-group select="$order/Lines/Line" group-by="@plant">
        <Message index="{position()}" targetPlant="{current-grouping-key()}">
          <PlantOrder>
            <SourceOrder><xsl:value-of select="$order/OrderId"/></SourceOrder>
            <Customer><xsl:value-of select="$order/Customer"/></Customer>
            <Plant><xsl:value-of select="current-grouping-key()"/></Plant>
            <Items>
              <xsl:for-each select="current-group()">
                <Item material="{@material}" qty="{@qty}" type="{@type}"/>
              </xsl:for-each>
            </Items>
            <TotalQty><xsl:value-of select="sum(current-group()/xs:decimal(@qty))"/></TotalQty>
          </PlantOrder>
        </Message>
      </xsl:for-each-group>
    </MultiMessages>
  </xsl:template>

</xsl:stylesheet>`
  },

  // ── XPATH EXPLORER (new examples) ────────────────────────────────

  xpathMapsArrays: {
    label: 'XPath Maps & Arrays',
    icon: 'database',
    desc: 'Construct and query XPath 3.1 maps and arrays',
    cat:  'xpath',
    xpathExpr: "map{ 'name': //Product[1]/Name, 'price': xs:decimal(//Product[1]/Price) }",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Catalog>
  <Product id="P-001" category="sensor">
    <Name>Temperature Probe XR-20</Name>
    <Price>125.00</Price>
    <InStock>true</InStock>
  </Product>
  <Product id="P-002" category="actuator">
    <Name>Servo Motor SM-50</Name>
    <Price>890.00</Price>
    <InStock>false</InStock>
  </Product>
  <Product id="P-003" category="sensor">
    <Name>Pressure Gauge PG-10</Name>
    <Price>45.00</Price>
    <InStock>true</InStock>
  </Product>
</Catalog>`,
    xslt: '',
    xpathHints: [
      "map{ 'a': 1, 'b': 2 }                             — literal map",
      "map{ 'name': //Product[1]/Name, 'price': xs:decimal(//Product[1]/Price) } — map from data",
      "['one', 'two', 'three']                            — array literal",
      "array{ //Product/Name }                            — array from sequence",
      "array{ //Product/Name }?2                          — array lookup (2nd item)",
      "map{ 'x': 10, 'y': 20 }?x                        — map lookup shorthand",
      "map:keys(map{ 'a': 1, 'b': 2 })                  — get map keys",
      "map:merge((map{'a':1}, map{'b':2}))               — merge two maps",
      "array:size(array{ //Product })                    — array size",
      "array:flatten([1, [2, 3], 4])                     — flatten nested arrays",
    ]
  },

  xpathLetExpressions: {
    label: 'let Expressions',
    icon: 'variable',
    desc: 'Readable complex expressions with let $x := ... return',
    cat:  'xpath',
    xpathExpr: "let $items := //Item, $total := sum($items/xs:decimal(Price) * xs:decimal(Qty)) return $total",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<PurchaseOrder id="PO-7712" currency="EUR">
  <Vendor>Bosch Rexroth AG</Vendor>
  <Items>
    <Item status="confirmed">
      <Material>BRX-CYL-40</Material>
      <Description>Hydraulic Cylinder 40mm</Description>
      <Qty>4</Qty>
      <Price>780.00</Price>
    </Item>
    <Item status="confirmed">
      <Material>BRX-VALVE-DN25</Material>
      <Description>Directional Valve DN25</Description>
      <Qty>8</Qty>
      <Price>145.00</Price>
    </Item>
    <Item status="pending">
      <Material>BRX-PUMP-A10</Material>
      <Description>Axial Piston Pump A10</Description>
      <Qty>1</Qty>
      <Price>4200.00</Price>
    </Item>
  </Items>
</PurchaseOrder>`,
    xslt: '',
    xpathHints: [
      "let $items := //Item return count($items)                             — bind and use",
      "let $items := //Item, $total := sum($items/xs:decimal(Price) * xs:decimal(Qty)) return $total — multi-bind",
      "let $confirmed := //Item[@status='confirmed'] return sum($confirmed/xs:decimal(Price) * xs:decimal(Qty)) — filtered sum",
      "let $avg := avg(//Item/xs:decimal(Price)) return //Item[xs:decimal(Price) gt $avg]/Material — above average",
      "let $max := max(//Item/xs:decimal(Price)) return //Item[xs:decimal(Price) = $max]/Description — most expensive",
      "for $i in //Item let $lineTotal := xs:decimal($i/Price) * xs:decimal($i/Qty) return concat($i/Material, ': ', $lineTotal) — per-item totals",
    ]
  },

  xpathQuantified: {
    label: 'Quantified Expressions',
    icon: 'check-check',
    desc: 'some/every for existence and universal checks',
    cat:  'xpath',
    xpathExpr: "every $item in //Item satisfies xs:decimal($item/Stock) gt 0",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Warehouse id="WH-CENTRAL">
  <Items>
    <Item sku="SKU-001">
      <Name>Industrial Sensor XR20</Name>
      <Stock>42</Stock>
      <MinStock>10</MinStock>
      <Price>125.00</Price>
    </Item>
    <Item sku="SKU-002">
      <Name>Control Module CM50</Name>
      <Stock>0</Stock>
      <MinStock>5</MinStock>
      <Price>450.00</Price>
    </Item>
    <Item sku="SKU-003">
      <Name>Hydraulic Pump HP-30</Name>
      <Stock>7</Stock>
      <MinStock>3</MinStock>
      <Price>890.00</Price>
    </Item>
    <Item sku="SKU-004">
      <Name>Servo Drive SD-100</Name>
      <Stock>15</Stock>
      <MinStock>8</MinStock>
      <Price>1250.00</Price>
    </Item>
  </Items>
</Warehouse>`,
    xslt: '',
    xpathHints: [
      "some $i in //Item satisfies xs:decimal($i/Stock) = 0              — any out of stock?",
      "every $i in //Item satisfies xs:decimal($i/Stock) gt 0            — all in stock?",
      "every $i in //Item satisfies xs:decimal($i/Stock) ge xs:decimal($i/MinStock) — all above minimum?",
      "some $i in //Item satisfies xs:decimal($i/Stock) lt xs:decimal($i/MinStock)  — any below minimum?",
      "some $i in //Item satisfies xs:decimal($i/Price) gt 1000          — any expensive items?",
      "every $i in //Item satisfies string-length($i/Name) le 30         — all names short?",
      "//Item[xs:decimal(Stock) lt xs:decimal(MinStock)]/@sku            — SKUs below minimum",
      "count(//Item[xs:decimal(Stock) = 0])                              — count out-of-stock",
    ]
  },

};