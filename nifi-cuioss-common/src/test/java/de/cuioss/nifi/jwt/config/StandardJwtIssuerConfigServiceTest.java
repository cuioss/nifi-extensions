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
import de.cuioss.sheriff.token.validation.exception.TokenValidationException;
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
            TestRunner runner = TestRunners.newTestRunner(StubProcessor.class);
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();
            runner.addControllerService(CS_ID, service);

            List<PropertyDescriptor> descriptors = service.getSupportedPropertyDescriptors();

            assertEquals(6, descriptors.size());
        }

        @Test
        @DisplayName("Should include JWKS Refresh Interval property")
        void shouldIncludeJwksRefreshInterval() {
            assertNotNull(StandardJwtIssuerConfigService.JWKS_REFRESH_INTERVAL);
            assertEquals("3600", StandardJwtIssuerConfigService.JWKS_REFRESH_INTERVAL.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.JWKS_REFRESH_INTERVAL.isRequired());
        }

        @Test
        @DisplayName("Should include Maximum Token Size property")
        void shouldIncludeMaximumTokenSize() {
            assertNotNull(StandardJwtIssuerConfigService.MAXIMUM_TOKEN_SIZE);
            assertEquals("16384", StandardJwtIssuerConfigService.MAXIMUM_TOKEN_SIZE.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.MAXIMUM_TOKEN_SIZE.isRequired());
        }

        @Test
        @DisplayName("Should include Allowed Algorithms property")
        void shouldIncludeAllowedAlgorithms() {
            assertNotNull(StandardJwtIssuerConfigService.ALLOWED_ALGORITHMS);
            assertNotNull(StandardJwtIssuerConfigService.ALLOWED_ALGORITHMS.getDefaultValue());
            assertFalse(StandardJwtIssuerConfigService.ALLOWED_ALGORITHMS.isRequired());
        }

        @Test
        @DisplayName("Should include Require HTTPS for JWKS property")
        void shouldIncludeRequireHttps() {
            assertNotNull(StandardJwtIssuerConfigService.REQUIRE_HTTPS_FOR_JWKS);
            assertEquals("true", StandardJwtIssuerConfigService.REQUIRE_HTTPS_FOR_JWKS.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.REQUIRE_HTTPS_FOR_JWKS.isRequired());
        }

        @Test
        @DisplayName("Should include JWKS Connection Timeout property")
        void shouldIncludeJwksConnectionTimeout() {
            assertNotNull(StandardJwtIssuerConfigService.JWKS_CONNECTION_TIMEOUT);
            assertEquals("10", StandardJwtIssuerConfigService.JWKS_CONNECTION_TIMEOUT.getDefaultValue());
            assertTrue(StandardJwtIssuerConfigService.JWKS_CONNECTION_TIMEOUT.isRequired());
        }

        @Test
        @DisplayName("Should include Allow Private Network Addresses property with false default")
        void shouldIncludeAllowPrivateNetworkAddresses() {
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
            PropertyDescriptor descriptor = service.getSupportedDynamicPropertyDescriptor(
                    JwtConstants.ISSUER_PREFIX + "myIssuer.jwksUrl");

            assertNotNull(descriptor);
            assertTrue(descriptor.isDynamic());
            assertEquals("Issuer configuration property", descriptor.getDescription());
        }

        @Test
        @DisplayName("Should return dynamic descriptor for non-issuer property")
        void shouldReturnDynamicDescriptorForNonIssuerProperty() {
            PropertyDescriptor descriptor = service.getSupportedDynamicPropertyDescriptor("custom.property");

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
            assertThrows(NullPointerException.class,
                    () -> service.validateToken(null));
        }

        @Test
        @DisplayName("Should throw IllegalStateException when validating token before enable")
        void shouldThrowIseWhenNotEnabled() {
            IllegalStateException exception = assertThrows(IllegalStateException.class,
                    () -> service.validateToken("some.jwt.token"));
            assertTrue(exception.getMessage().contains("not enabled"));
        }

        @Test
        @DisplayName("Should throw IllegalStateException when getting auth config before enable")
        void shouldThrowIseForAuthConfigWhenNotEnabled() {
            IllegalStateException exception = assertThrows(IllegalStateException.class,
                    () -> service.getAuthenticationConfig());
            assertTrue(exception.getMessage().contains("not enabled"));
        }

        @Test
        @DisplayName("Should return empty Optional for security counter before enable")
        void shouldReturnEmptyCounterWhenNotEnabled() {
            assertTrue(service.getSecurityEventCounter().isEmpty());
        }
    }

    /**
     * Enables the service with a single valid issuer.
     * <p>
     * onEnabled sets the context classloader to its own before initializing dsl-json, so the
     * ServiceLoader lookup resolves under the unit-test classloader just as it does inside a NAR.
     * The enabled lifecycle therefore does not need an integration test to be covered.
     */
    private static StandardJwtIssuerConfigService enabledService(TestRunner runner) throws Exception {
        StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();
        runner.addControllerService(CS_ID, service);
        runner.setProperty(service, "issuer.test.issuer", "https://example.com/realms/test");
        runner.setProperty(service, "issuer.test.jwks-url", "https://example.com/jwks");
        runner.enableControllerService(service);
        return service;
    }

    @Nested
    @DisplayName("Enabled Lifecycle")
    class EnabledLifecycleTests {

        @Test
        @DisplayName("Should publish configuration and counter once enabled with a valid issuer")
        void shouldPublishConfigurationWhenEnabled() throws Exception {
            // Arrange + Act
            TestRunner runner = TestRunners.newTestRunner(StubProcessor.class);
            StandardJwtIssuerConfigService service = enabledService(runner);

            // Assert — the disabled-state guards must all have flipped, which is only true when
            // onEnabled ran to completion (issuer parsing, dsl-json init and validator build).
            assertNotNull(service.getAuthenticationConfig(),
                    "An enabled service must publish its authentication config");
            assertTrue(service.getSecurityEventCounter().isPresent(),
                    "An enabled service must publish its security event counter");
        }

        @Test
        @DisplayName("Should reject a malformed token with a validation error rather than a disabled-state error")
        void shouldValidateTokenWhenEnabled() throws Exception {
            // Arrange
            TestRunner runner = TestRunners.newTestRunner(StubProcessor.class);
            StandardJwtIssuerConfigService service = enabledService(runner);

            // Act + Assert — the token is rejected by the real TokenValidator, not by the
            // "not enabled" guard. Asserting the exception TYPE is what distinguishes the two:
            // a disabled service answers the same call with IllegalStateException.
            assertThrows(TokenValidationException.class,
                    () -> service.validateToken("not-a-valid-token"),
                    "An enabled service must delegate to the validator and surface a validation failure");
        }
    }

    @Nested
    @DisplayName("Lifecycle")
    class LifecycleTests {

        @Test
        @DisplayName("Should clear state on disable")
        void shouldClearStateOnDisable() {
            // Arrange — directly call onDisabled without ever enabling
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();

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
            // Arrange — enableControllerService triggers onEnabled, which fails because NO issuer is
            // configured: the validator build rejects an empty issuer list. That is the whole reason,
            // and it is why EnabledLifecycleTests above can enable the very same service simply by
            // supplying one issuer. (An earlier comment here blamed the dsl-json ServiceLoader being
            // unavailable to the unit-test classloader and deferred the enabled-state coverage to the
            // ITs on that basis; that was never true — onEnabled sets its own classloader before
            // initializing dsl-json.) This exercises the catch block in onEnabled.
            TestRunner runner = TestRunners.newTestRunner(StubProcessor.class);
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();
            runner.addControllerService(CS_ID, service);

            // Act & Assert — TestRunner wraps the IllegalStateException from
            // onEnabled's catch block in an AssertionError
            AssertionError error = assertThrows(AssertionError.class,
                    () -> runner.enableControllerService(service));
            assertTrue(error.getMessage().contains("Failed to enable"));
        }

        @Test
        @DisplayName("Should remain safely disabled across repeated onDisabled calls")
        void shouldRemainDisabledAcrossRepeatedDisable() {
            // The onDisabled try/finally always clears lifecycle state, so a repeated
            // disable is a safe no-op that keeps the service in the disabled contract.
            StandardJwtIssuerConfigService service = new StandardJwtIssuerConfigService();

            assertDoesNotThrow(service::onDisabled, "First disable must not throw");
            assertDoesNotThrow(service::onDisabled, "Repeated disable must remain a safe no-op");

            assertTrue(service.getSecurityEventCounter().isEmpty(),
                    "Security counter must stay empty after repeated disable");
            assertThrows(IllegalStateException.class, service::getAuthenticationConfig,
                    "Auth config must remain unavailable after repeated disable");
            assertThrows(IllegalStateException.class,
                    () -> service.validateToken("some.token"),
                    "Token validation must remain rejected after repeated disable");
        }
    }
}
