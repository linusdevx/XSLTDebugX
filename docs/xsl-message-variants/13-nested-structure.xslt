<?xml version="1.0" encoding="UTF-8"?>
<!-- VARIANT 13: Deeply-nested / recursive structured content inside message -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:cpi="http://sap.com/it/" exclude-result-prefixes="cpi" version="2.0">

    <xsl:param name="exchange"/>
    <xsl:param name="quantity"/>
    <xsl:param name="orderid"/>

    <xsl:output method="xml" version="1.0" encoding="UTF-8" indent="yes"/>
    <xsl:strip-space elements="*"/>

    <xsl:template match="@* | node()">
        <xsl:apply-templates select="@* | node()"/>
    </xsl:template>

    <xsl:template match="/">

        <xsl:message>
            <xsl:for-each select="/Products/Product">
                <item>
                    <id><xsl:value-of select="./ProductId"/></id>
                    <name><xsl:value-of select="./Name"/></name>
                </item>
            </xsl:for-each>
        </xsl:message>

        <xsl:value-of select="cpi:setHeader($exchange, 'context', 'ModelingBasics-HeaderPropertiesInXSLT')"/>
        <xsl:value-of select="cpi:setHeader($exchange, 'content-type', 'application/xml')"/>
        <xsl:element name="PurchaseOrder">
            <xsl:element name="PurchaseOrderNumber">
                <xsl:value-of select="$orderid"/>
            </xsl:element>
            <xsl:element name="Items">
                <xsl:for-each select="/Products/Product">
                    <xsl:call-template name="Order_Items"/>
                </xsl:for-each>
            </xsl:element>
        </xsl:element>
    </xsl:template>

    <xsl:template name="Order_Items">
        <xsl:element name="Item">
            <xsl:element name="ProductId">
                <xsl:value-of select="./ProductId"/>
            </xsl:element>
            <xsl:element name="ProductName">
                <xsl:value-of select="./Name"/>
            </xsl:element>
            <xsl:element name="Category">
                <xsl:value-of select="./Category"/>
            </xsl:element>
            <xsl:element name="Quantity">
                <xsl:value-of select="$quantity"/>
            </xsl:element>
            <xsl:element name="Price">
                <xsl:value-of select="./Price * $quantity"/>
            </xsl:element>
            <xsl:element name="Currency">
                <xsl:value-of select="./CurrencyCode"/>
            </xsl:element>
        </xsl:element>
    </xsl:template>

</xsl:stylesheet>
