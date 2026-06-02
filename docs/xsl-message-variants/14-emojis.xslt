<?xml version="1.0" encoding="UTF-8"?>
<!-- VARIANT 14: Emojis in message (4-byte UTF-8 / surrogate pair test) -->
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

        <xsl:message>Test 14: 🚀 Transform started for order <xsl:value-of select="$orderid"/> 📦</xsl:message>
        <xsl:message>Test 14: Status icons — ✅ ⚠️ ❌ ℹ️ 🔥 ⏱️ 💰 🌍</xsl:message>
        <xsl:message>Test 14: Mixed scripts + emoji — Привет 你好 مرحبا 🎉 こんにちは 🇯🇵 👨‍💻 👩🏽‍🚀</xsl:message>

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

        <xsl:message>Test 14: Done 🏁 — <xsl:value-of select="count(/Products/Product)"/> items processed ✨</xsl:message>
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
