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

import lombok.experimental.UtilityClass;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.Processor;
import org.apache.nifi.util.MockProcessContext;
import org.apache.nifi.util.TestRunner;

import java.util.Map;

/**
 * Helper utilities for testing NiFi components with dynamic properties.
 * <p>
 * Works around the limitation where {@link TestRunner} doesn't properly
 * surface dynamic properties through the {@code getProperties()} method.
 */
@UtilityClass
public class DynamicPropertyTestHelper {

    /**
     * Creates a {@link ProcessContext} from a {@link TestRunner} that properly includes
     * dynamic properties.
     *
     * @param testRunner the test runner with configured properties
     * @param processor  the processor being tested
     * @return a {@link ProcessContext} that includes all dynamic properties
     */
    public static ProcessContext createContextWithDynamicProperties(TestRunner testRunner, Processor processor) {
        var context = new MockProcessContext(processor);
        Map<PropertyDescriptor, String> properties = testRunner.getProcessContext().getProperties();
        for (var entry : properties.entrySet()) {
            context.setProperty(entry.getKey(), entry.getValue());
        }
        return context;
    }

    /**
     * Sets multiple dynamic properties sharing a common prefix.
     *
     * @param testRunner the test runner
     * @param prefix     the property prefix (e.g. {@code "issuer.test-issuer."})
     * @param properties map of property suffixes to values
     */
    public static void setDynamicProperties(TestRunner testRunner, String prefix, Map<String, String> properties) {
        for (var entry : properties.entrySet()) {
            testRunner.setProperty(prefix + entry.getKey(), entry.getValue());
        }
    }

    /**
     * Sets issuer properties for JWT testing.
     *
     * @param testRunner       the test runner
     * @param issuerName       the issuer name
     * @param issuerProperties map of issuer properties (without prefix)
     */
    public static void setIssuerProperties(TestRunner testRunner, String issuerName,
            Map<String, String> issuerProperties) {
        setDynamicProperties(testRunner, "issuer." + issuerName + ".", issuerProperties);
    }
}
