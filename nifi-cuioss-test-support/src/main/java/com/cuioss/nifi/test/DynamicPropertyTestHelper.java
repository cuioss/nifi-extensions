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
package com.cuioss.nifi.test;

import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.Processor;
import org.apache.nifi.util.MockProcessContext;
import org.apache.nifi.util.TestRunner;

import java.util.HashMap;
import java.util.Map;

/**
 * Helper class for testing processors with dynamic properties.
 * 
 * This class provides utilities to work around the limitation where TestRunner 
 * doesn't properly handle dynamic properties in getProperties() method.
 */
public class DynamicPropertyTestHelper {

    /**
     * Creates a ProcessContext from a TestRunner that properly includes dynamic properties.
     * 
     * @param testRunner The test runner with configured properties
     * @param processor The processor being tested
     * @return A ProcessContext that includes all dynamic properties
     */
    public static ProcessContext createContextWithDynamicProperties(TestRunner testRunner, Processor processor) {
        MockProcessContext context = new MockProcessContext(processor);
        
        // Copy all properties from TestRunner to MockProcessContext
        Map<PropertyDescriptor, String> properties = testRunner.getProcessContext().getProperties();
        for (Map.Entry<PropertyDescriptor, String> entry : properties.entrySet()) {
            context.setProperty(entry.getKey(), entry.getValue());
        }
        
        // The MockProcessContext will now properly return dynamic properties
        return context;
    }

    /**
     * Sets multiple dynamic properties with a common prefix.
     * 
     * @param testRunner The test runner
     * @param prefix The property prefix (e.g., "issuer.test-issuer.")
     * @param properties Map of property suffixes to values
     */
    public static void setDynamicProperties(TestRunner testRunner, String prefix, Map<String, String> properties) {
        for (Map.Entry<String, String> entry : properties.entrySet()) {
            String fullPropertyName = prefix + entry.getKey();
            testRunner.setProperty(fullPropertyName, entry.getValue());
        }
    }

    /**
     * Sets issuer properties for JWT testing.
     * 
     * @param testRunner The test runner
     * @param issuerName The issuer name
     * @param issuerProperties Map of issuer properties (without prefix)
     */
    public static void setIssuerProperties(TestRunner testRunner, String issuerName, Map<String, String> issuerProperties) {
        String prefix = "issuer." + issuerName + ".";
        setDynamicProperties(testRunner, prefix, issuerProperties);
    }

    /**
     * Example usage for testing JWT processors with multiple issuers.
     */
    public static void configureMultipleIssuers(TestRunner testRunner) {
        // Configure issuer 1
        Map<String, String> issuer1Props = new HashMap<>();
        issuer1Props.put("jwks-url", "https://issuer1.example.com/.well-known/jwks.json");
        issuer1Props.put("issuer", "https://issuer1.example.com");
        issuer1Props.put("audience", "api1");
        setIssuerProperties(testRunner, "issuer1", issuer1Props);

        // Configure issuer 2
        Map<String, String> issuer2Props = new HashMap<>();
        issuer2Props.put("jwks-url", "https://issuer2.example.com/.well-known/jwks.json");
        issuer2Props.put("issuer", "https://issuer2.example.com");
        issuer2Props.put("audience", "api2");
        setIssuerProperties(testRunner, "issuer2", issuer2Props);
    }
}