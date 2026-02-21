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
package de.cuioss.nifi.jwt.test;

import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.Processor;
import org.apache.nifi.util.MockProcessContext;
import org.apache.nifi.util.TestRunner;

import java.util.Map;

/**
 * Helper class for testing NiFi components with dynamic properties.
 * <p>
 * Provides utilities to work around the limitation where TestRunner
 * doesn't properly handle dynamic properties in getProperties() method.
 */
public class DynamicPropertyTestHelper {

    /**
     * Creates a ProcessContext from a TestRunner that properly includes dynamic properties.
     *
     * @param testRunner The test runner with configured properties
     * @param processor  The processor being tested
     * @return A ProcessContext that includes all dynamic properties
     */
    public static ProcessContext createContextWithDynamicProperties(TestRunner testRunner, Processor processor) {
        MockProcessContext context = new MockProcessContext(processor);
        Map<PropertyDescriptor, String> properties = testRunner.getProcessContext().getProperties();
        for (Map.Entry<PropertyDescriptor, String> entry : properties.entrySet()) {
            context.setProperty(entry.getKey(), entry.getValue());
        }
        return context;
    }

    /**
     * Sets multiple dynamic properties with a common prefix.
     *
     * @param testRunner The test runner
     * @param prefix     The property prefix (e.g., "issuer.test-issuer.")
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
     * @param testRunner       The test runner
     * @param issuerName       The issuer name
     * @param issuerProperties Map of issuer properties (without prefix)
     */
    public static void setIssuerProperties(TestRunner testRunner, String issuerName,
            Map<String, String> issuerProperties) {
        String prefix = "issuer." + issuerName + ".";
        setDynamicProperties(testRunner, prefix, issuerProperties);
    }
}
