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
package de.cuioss.nifi.jwt.config;

import de.cuioss.nifi.jwt.JwtConstants;
import org.apache.nifi.components.PropertyDescriptor;
import org.apache.nifi.processor.AbstractProcessor;
import org.apache.nifi.processor.ProcessContext;
import org.apache.nifi.processor.ProcessSession;
import org.apache.nifi.processor.Relationship;
import org.apache.nifi.processor.exception.ProcessException;
import org.apache.nifi.util.TestRunner;
import org.apache.nifi.util.TestRunners;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("StandardJwtIssuerConfigService")
class StandardJwtIssuerConfigServiceTest {

    private static final String CS_ID = "jwt-config-service";

    /**
     * Minimal processor stub for TestRunner — required to add the controller service.
     */
    public static class StubProcessor extends AbstractProcessor {
        static final PropertyDescriptor CS_PROPERTY = new PropertyDescriptor.Builder()
                .name("jwt-config-service")
                .displayName("JWT Config Service")
                .description("Reference to JwtIssuerConfigService")
                .identifiesControllerService(JwtIssuerConfigService.class)
                .required(false)
                .build();

        @Override
        protected List<PropertyDescriptor> getSupportedPropertyDescriptors() {
            return List.of(CS_PROPERTY);
        }

        @Override
        public void onTrigger(ProcessContext context, ProcessSession session) throws ProcessException {
            // No-op
        }

        @Override
        public Set<Relationship> getRelationships() {
            return Set.of();
        }
    }

    @Nested
    @DisplayName("Property Descriptors")
    class PropertyDescriptorTests {

        @Test
        @DisplayName("Should return all 6 property descriptors")
        void shouldReturnAllPropertyDescriptors() throws Exception {
            // Arrange
            TestRunner runner = TestRunners.newTestRunner(StubProcessor.class);
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();
            runner.addControllerService(CS_ID, service);

            // Act
            List<PropertyDescriptor> descriptors = service.getSupportedPropertyDescriptors();

            // Assert
            assertEquals(6, descriptors.size());
        }

        @Test
        @DisplayName("Should include JWKS Refresh Interval property")
        void shouldIncludeJwksRefreshInterval() {
            // Assert
            assertNotNull(StandardJwtIssuerConfigService.JWKS_REFRESH_INTERVAL);
            assertEquals("3600", StandardJwtIssuerConfigService.JWKS_REFRESH_INTERVAL.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.JWKS_REFRESH_INTERVAL.isRequired());
        }

        @Test
        @DisplayName("Should include Maximum Token Size property")
        void shouldIncludeMaximumTokenSize() {
            // Assert
            assertNotNull(StandardJwtIssuerConfigService.MAXIMUM_TOKEN_SIZE);
            assertEquals("16384", StandardJwtIssuerConfigService.MAXIMUM_TOKEN_SIZE.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.MAXIMUM_TOKEN_SIZE.isRequired());
        }

        @Test
        @DisplayName("Should include Allowed Algorithms property")
        void shouldIncludeAllowedAlgorithms() {
            // Assert
            assertNotNull(StandardJwtIssuerConfigService.ALLOWED_ALGORITHMS);
            assertNotNull(StandardJwtIssuerConfigService.ALLOWED_ALGORITHMS.getDefaultValue());
            assertFalse(StandardJwtIssuerConfigService.ALLOWED_ALGORITHMS.isRequired());
        }

        @Test
        @DisplayName("Should include Require HTTPS for JWKS property")
        void shouldIncludeRequireHttps() {
            // Assert
            assertNotNull(StandardJwtIssuerConfigService.REQUIRE_HTTPS_FOR_JWKS);
            assertEquals("true", StandardJwtIssuerConfigService.REQUIRE_HTTPS_FOR_JWKS.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.REQUIRE_HTTPS_FOR_JWKS.isRequired());
        }

        @Test
        @DisplayName("Should include JWKS Connection Timeout property")
        void shouldIncludeJwksConnectionTimeout() {
            // Assert
            assertNotNull(StandardJwtIssuerConfigService.JWKS_CONNECTION_TIMEOUT);
            assertEquals("10", StandardJwtIssuerConfigService.JWKS_CONNECTION_TIMEOUT.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.JWKS_CONNECTION_TIMEOUT.isRequired());
        }

        @Test
        @DisplayName("Should include Allow Private Network Addresses property with false default")
        void shouldIncludeAllowPrivateNetworkAddresses() {
            // Assert
            assertNotNull(StandardJwtIssuerConfigService.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES);
            assertEquals("false",
                    StandardJwtIssuerConfigService.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES.isRequired());
        }
    }

    @Nested
    @DisplayName("Dynamic Property Descriptors")
    class DynamicPropertyTests {

        private StandardJwtIssuerConfigService service;

        @BeforeEach
        void setUp() {
            service = new StandardJwtIssuerConfigService();
        }

        @Test
        @DisplayName("Should return dynamic descriptor for issuer-prefixed property")
        void shouldReturnDynamicDescriptorForIssuerPrefix() {
            // Act
            PropertyDescriptor descriptor = service.getSupportedDynamicPropertyDescriptor(
                    JwtConstants.ISSUER_PREFIX + "myIssuer.jwksUrl");

            // Assert
            assertNotNull(descriptor);
            assertTrue(descriptor.isDynamic());
            assertEquals("Issuer configuration property", descriptor.getDescription());
        }

        @Test
        @DisplayName("Should return dynamic descriptor for non-issuer property")
        void shouldReturnDynamicDescriptorForNonIssuerProperty() {
            // Act
            PropertyDescriptor descriptor = service.getSupportedDynamicPropertyDescriptor("custom.property");

            // Assert
            assertNotNull(descriptor);
            assertTrue(descriptor.isDynamic());
            assertEquals("Dynamic property", descriptor.getDescription());
        }
    }

    @Nested
    @DisplayName("Disabled State")
    class DisabledStateTests {

        private StandardJwtIssuerConfigService service;

        @BeforeEach
        void setUp() {
            service = new StandardJwtIssuerConfigService();
        }

        @Test
        @DisplayName("Should throw NullPointerException when token is null")
        void shouldThrowNpeWhenTokenNull() {
            // Act & Assert
            assertThrows(NullPointerException.class,
                    () -> service.validateToken(null));
        }

        @Test
        @DisplayName("Should throw IllegalStateException when validating token before enable")
        void shouldThrowIseWhenNotEnabled() {
            // Act & Assert
            IllegalStateException exception = assertThrows(IllegalStateException.class,
                    () -> service.validateToken("some.jwt.token"));
            assertTrue(exception.getMessage().contains("not enabled"));
        }

        @Test
        @DisplayName("Should throw IllegalStateException when getting auth config before enable")
        void shouldThrowIseForAuthConfigWhenNotEnabled() {
            // Act & Assert
            IllegalStateException exception = assertThrows(IllegalStateException.class,
                    () -> service.getAuthenticationConfig());
            assertTrue(exception.getMessage().contains("not enabled"));
        }

        @Test
        @DisplayName("Should return empty Optional for security counter before enable")
        void shouldReturnEmptyCounterWhenNotEnabled() {
            // Act & Assert
            assertTrue(service.getSecurityEventCounter().isEmpty());
        }
    }

    @Nested
    @DisplayName("Lifecycle")
    class LifecycleTests {

        @Test
        @DisplayName("Should clear state on disable")
        void shouldClearStateOnDisable() {
            // Arrange — directly call onDisabled without enabling
            // (onEnabled requires dsl-json ServiceLoader not available in test)
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();

            // Act
            service.onDisabled();

            // Assert — should be in clean disabled state
            assertTrue(service.getSecurityEventCounter().isEmpty());
            assertThrows(IllegalStateException.class, service::getAuthenticationConfig);
            assertThrows(IllegalStateException.class,
                    () -> service.validateToken("some.token"));
        }

        @Test
        @DisplayName("Should wrap exception when onEnabled fails")
        void shouldWrapExceptionOnEnableFailure() throws Exception {
            // Arrange — enableControllerService triggers onEnabled which fails
            // because dsl-json ServiceLoader isn't available in unit test classloader.
            // This exercises the catch block in onEnabled (lines 192-197).
            TestRunner runner = TestRunners.newTestRunner(StubProcessor.class);
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();
            runner.addControllerService(CS_ID, service);

            // Act & Assert — TestRunner wraps the IllegalStateException from
            // onEnabled's catch block in an AssertionError
            AssertionError error = assertThrows(AssertionError.class,
                    () -> runner.enableControllerService(service));
            assertTrue(error.getMessage().contains("Failed to enable"));
        }
    }
}
