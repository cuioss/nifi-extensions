/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.processors.auth.test;

import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.*;
import org.apache.nifi.processor.exception.ProcessException;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for DynamicPropertyTestHelper
 */
class DynamicPropertyTestHelperTest {

    private TestRunner testRunner;
    private TestProcessor processor;

    @BeforeEach
    void setUp() {
        processor = new TestProcessor();
        testRunner = TestRunners.newTestRunner(processor);
    }

    @Test
    void createContextWithDynamicProperties() {
        // Set static property
        testRunner.setProperty(TestProcessor.STATIC_PROPERTY, "static-value");

        // Set dynamic properties
        testRunner.setProperty("dynamic.prop1", "value1");
        testRunner.setProperty("dynamic.prop2", "value2");

        // Create context using helper
        ProcessContext context = DynamicPropertyTestHelper.createContextWithDynamicProperties(testRunner, processor);

        // Verify all properties are present
        Map<PropertyDescriptor, String> properties = context.getProperties();
        assertEquals(3, properties.size());

        // Verify static property
        assertEquals("static-value", context.getProperty(TestProcessor.STATIC_PROPERTY).getValue());

        // Verify dynamic properties are included
        boolean foundDynamic1 = false;
        boolean foundDynamic2 = false;
        for (Map.Entry<PropertyDescriptor, String> entry : properties.entrySet()) {
            String name = entry.getKey().getName();
            if ("dynamic.prop1".equals(name)) {
                assertEquals("value1", entry.getValue());
                foundDynamic1 = true;
            } else if ("dynamic.prop2".equals(name)) {
                assertEquals("value2", entry.getValue());
                foundDynamic2 = true;
            }
        }
        assertTrue(foundDynamic1, "dynamic.prop1 should be present");
        assertTrue(foundDynamic2, "dynamic.prop2 should be present");
    }

    @Test
    void setDynamicProperties() {
        // Prepare properties map
        Map<String, String> properties = new HashMap<>();
        properties.put("url", "https://example.com");
        properties.put("timeout", "30000");
        properties.put("enabled", "true");

        // Set properties with prefix
        DynamicPropertyTestHelper.setDynamicProperties(testRunner, "service.config.", properties);

        // Verify properties were set correctly
        assertEquals("https://example.com", testRunner.getProcessContext().getProperty("service.config.url").getValue());
        assertEquals("30000", testRunner.getProcessContext().getProperty("service.config.timeout").getValue());
        assertEquals("true", testRunner.getProcessContext().getProperty("service.config.enabled").getValue());
    }

    @Test
    void setIssuerProperties() {
        // Prepare issuer properties
        Map<String, String> issuerProps = new HashMap<>();
        issuerProps.put("jwks-url", "https://auth.example.com/.well-known/jwks.json");
        issuerProps.put("issuer", "https://auth.example.com");
        issuerProps.put("audience", "my-api");
        issuerProps.put("algorithm", "RS256");

        // Set issuer properties
        DynamicPropertyTestHelper.setIssuerProperties(testRunner, "auth-server", issuerProps);

        // Verify properties were set with correct prefix
        assertEquals("https://auth.example.com/.well-known/jwks.json",
                testRunner.getProcessContext().getProperty("issuer.auth-server.jwks-url").getValue());
        assertEquals("https://auth.example.com",
                testRunner.getProcessContext().getProperty("issuer.auth-server.issuer").getValue());
        assertEquals("my-api",
                testRunner.getProcessContext().getProperty("issuer.auth-server.audience").getValue());
        assertEquals("RS256",
                testRunner.getProcessContext().getProperty("issuer.auth-server.algorithm").getValue());
    }

    @Test
    void multipleIssuersConfiguration() {
        // Configure first issuer
        Map<String, String> issuer1Props = new HashMap<>();
        issuer1Props.put("jwks-url", "https://issuer1.example.com/.well-known/jwks.json");
        issuer1Props.put("issuer", "https://issuer1.example.com");
        issuer1Props.put("audience", "api1");
        DynamicPropertyTestHelper.setIssuerProperties(testRunner, "issuer1", issuer1Props);

        // Configure second issuer
        Map<String, String> issuer2Props = new HashMap<>();
        issuer2Props.put("jwks-url", "https://issuer2.example.com/.well-known/jwks.json");
        issuer2Props.put("issuer", "https://issuer2.example.com");
        issuer2Props.put("audience", "api2");
        DynamicPropertyTestHelper.setIssuerProperties(testRunner, "issuer2", issuer2Props);

        // Verify both issuers are configured
        assertEquals("https://issuer1.example.com/.well-known/jwks.json",
                testRunner.getProcessContext().getProperty("issuer.issuer1.jwks-url").getValue());
        assertEquals("https://issuer2.example.com/.well-known/jwks.json",
                testRunner.getProcessContext().getProperty("issuer.issuer2.jwks-url").getValue());
    }

    @Test
    void emptyPropertiesMap() {
        // Test with empty map
        Map<String, String> emptyProps = new HashMap<>();
        DynamicPropertyTestHelper.setDynamicProperties(testRunner, "prefix.", emptyProps);

        // Should not throw exception and no properties should be set
        assertDoesNotThrow(() -> testRunner.run());
    }

    /**
     * Test processor that supports dynamic properties
     */
    private static class TestProcessor extends AbstractProcessor {

        static final PropertyDescriptor STATIC_PROPERTY = new PropertyDescriptor.Builder()
                .name("static.property")
                .displayName("Static Property")
                .description("A static property for testing")
                .required(false)
                .build();

        @Override
        public void init(ProcessorInitializationContext context) {
            // No initialization needed
        }

        @Override
        public Set<Relationship> getRelationships() {
            return Collections.emptySet();
        }

        @Override
        public List<PropertyDescriptor> getSupportedPropertyDescriptors() {
            return List.of(STATIC_PROPERTY);
        }

        @Override
        protected PropertyDescriptor getSupportedDynamicPropertyDescriptor(String propertyDescriptorName) {
            return new PropertyDescriptor.Builder()
                    .name(propertyDescriptorName)
                    .dynamic(true)
                    .build();
        }

        @Override
        public void onTrigger(ProcessContext context, ProcessSession session) throws ProcessException {
            // Not used in tests
        }
    }
}