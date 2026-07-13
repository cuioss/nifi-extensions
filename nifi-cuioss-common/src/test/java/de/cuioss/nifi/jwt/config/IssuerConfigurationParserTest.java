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

import de.cuioss.nifi.jwt.JwtAttributes;
import de.cuioss.sheriff.token.validation.IssuerConfig;
import de.cuioss.sheriff.token.validation.ParserConfig;
import de.cuioss.sheriff.token.validation.test.InMemoryKeyMaterialHandler;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("IssuerConfigurationParser")
@EnableTestLogger
class IssuerConfigurationParserTest {

    @Nested
    @DisplayName("Null and Empty Input Handling")
    class NullAndEmptyInputTests {

        @Test
        @DisplayName("Should throw NullPointerException for null properties")
        void shouldThrowNPEForNullProperties() {
            var configManager = new ConfigurationManager();
            assertThrows(NullPointerException.class,
                    () -> IssuerConfigurationParser.parseIssuerConfigs(null, configManager));
        }

        @Test
        @DisplayName("Should return empty list for empty properties")
        void shouldReturnEmptyListForEmptyProperties() {
            Map<String, String> properties = new HashMap<>();
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertTrue(configs.isEmpty(), "Should return empty list for empty properties");
        }
    }

    @Nested
    @DisplayName("UI Property Parsing")
    class UIPropertyParsingTests {

        @Test
        @DisplayName("Should create IssuerConfig from UI property with JWKS URL")
        void shouldCreateIssuerConfigWithJwksUrl() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            IssuerConfig config = configs.getFirst();
            assertEquals("TestIssuer", config.getIssuerIdentifier());
            assertNotNull(config.getJwksLoader(), "JWKS loader should be configured");
        }

        @Test
        @DisplayName("Should create IssuerConfig from UI property with JWKS file")
        void shouldCreateIssuerConfigWithJwksFile(@TempDir Path tempDir) throws Exception {
            // Arrange — create a real JWKS file since the builder validates existence
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, InMemoryKeyMaterialHandler.createDefaultJwks());
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-file", jwksFile.toString());
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertEquals("TestIssuer", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should skip disabled issuer")
        void shouldSkipDisabledIssuer() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.enabled", "false");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertTrue(configs.isEmpty(), "Disabled issuer should be skipped");
        }

        @Test
        @DisplayName("Should skip issuer with missing name")
        void shouldSkipIssuerWithMissingName() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertTrue(configs.isEmpty(), "Issuer without name should be skipped");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "no name");
        }

        @Test
        @DisplayName("Should skip issuer with missing JWKS source")
        void shouldSkipIssuerWithMissingJwksSource() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertTrue(configs.isEmpty(), "Issuer without JWKS source should be skipped");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "JWKS");
        }

        @Test
        @DisplayName("Should set audience when present")
        void shouldSetAudience() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.audience", "test-audience");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertTrue(configs.getFirst().getExpectedAudience().contains("test-audience"),
                    "Expected audience should contain 'test-audience'");
        }

        @Test
        @DisplayName("Should set client ID when present")
        void shouldSetClientId() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.client-id", "test-client");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertTrue(configs.getFirst().getExpectedClientId().contains("test-client"),
                    "Expected client ID should contain 'test-client'");
        }

        @Test
        @DisplayName("Should parse multiple issuers from UI properties")
        void shouldParseMultipleIssuers() {
            // Arrange — use only URL-based issuers to avoid file existence checks
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test1.name", "TestIssuer1");
            properties.put("issuer.test1.jwks-url", "https://example1.com/jwks");
            properties.put("issuer.test2.name", "TestIssuer2");
            properties.put("issuer.test2.jwks-url", "https://example2.com/jwks");
            properties.put("issuer.test3.name", "TestIssuer3");
            properties.put("issuer.test3.jwks-url", "https://example3.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(3, configs.size());
        }

        @Test
        @DisplayName("Should use issuer key as fallback name")
        void shouldUseIssuerPropertyAsFallbackName() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.issuer", "FallbackIssuerName");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertEquals("FallbackIssuerName", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should resolve jwksUri as alternative URL key")
        void shouldResolveJwksUri() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwksUri", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertEquals("TestIssuer", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should warn when jwks-content is used")
        void shouldWarnOnJwksContent() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-content", "{\"keys\":[]}");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertTrue(configs.isEmpty(), "JWKS content is not yet supported");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "not yet supported");
        }
    }

    @Nested
    @DisplayName("JWKS Type Resolution")
    class JwksTypeResolutionTests {

        @Test
        @DisplayName("Should use explicit JWKS URL type when specified")
        void shouldUseExplicitUrlType() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.jwks-type", "url");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertNotNull(configs.getFirst().getJwksLoader());
        }

        @Test
        @DisplayName("Should infer URL type from jwks-url property")
        void shouldInferUrlTypeFromJwksUrl() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
        }

        @Test
        @DisplayName("Should infer file type from jwks-file property")
        void shouldInferFileTypeFromJwksFile(@TempDir Path tempDir) throws Exception {
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, InMemoryKeyMaterialHandler.createDefaultJwks());
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-file", jwksFile.toString());
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
        }

        @Test
        @DisplayName("Should warn and infer the type from the source for an unknown jwks-type")
        void shouldInferTypeForUnknownJwksType() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.jwks-type", "ftp");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size(),
                    "An unknown jwks-type must fall back to the source-inferred type, not silently to file");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "Unknown jwks-type");
        }

        @Test
        @DisplayName("Should treat the source as a file when jwks-type=url but only a jwks-file is present")
        void shouldTreatUrlTypeWithFileSourceAsFile(@TempDir Path tempDir) throws Exception {
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, InMemoryKeyMaterialHandler.createDefaultJwks());
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-file", jwksFile.toString());
            properties.put("issuer.test.jwks-type", "url");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size(),
                    "A file source declared as jwks-type=url must load as a file, not route through "
                            + "the URL/HTTPS/private-address checks");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "only a jwks-file");
        }
    }

    @Nested
    @DisplayName("ParserConfig Parsing")
    class ParserConfigParsingTests {

        @Test
        @DisplayName("Should parse valid max token size")
        void shouldParseValidMaxTokenSize() {
            Map<String, String> properties = new HashMap<>();
            properties.put("Maximum Token Size", "32768");

            ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

            assertEquals(32768, config.getMaxTokenSize());
        }

        @Test
        @DisplayName("Should use default for invalid max token size")
        void shouldUseDefaultForInvalidMaxTokenSize() {
            Map<String, String> properties = new HashMap<>();
            properties.put("Maximum Token Size", "not-a-number");

            ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

            assertEquals(16384, config.getMaxTokenSize());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "not-a-number");
        }

        @Test
        @DisplayName("Should use default when max token size key missing")
        void shouldUseDefaultWhenKeyMissing() {
            Map<String, String> properties = new HashMap<>();

            ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

            assertEquals(16384, config.getMaxTokenSize());
        }

        @Test
        @DisplayName("Should fall back to default for zero or negative max token size")
        void shouldUseDefaultForNonPositiveMaxTokenSize() {
            Map<String, String> zero = new HashMap<>();
            zero.put("Maximum Token Size", "0");
            Map<String, String> negative = new HashMap<>();
            negative.put("Maximum Token Size", "-4096");

            ParserConfig zeroConfig = IssuerConfigurationParser.parseParserConfig(zero);
            ParserConfig negativeConfig = IssuerConfigurationParser.parseParserConfig(negative);

            assertEquals(16384, zeroConfig.getMaxTokenSize(),
                    "A zero max token size must fall back to the default rather than disable enforcement");
            assertEquals(16384, negativeConfig.getMaxTokenSize(),
                    "A negative max token size must fall back to the default");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "Non-positive");
        }

        @Test
        @DisplayName("Should throw NPE for null properties in parseParserConfig")
        void shouldThrowNPEForNullInParseParserConfig() {
            assertThrows(NullPointerException.class,
                    () -> IssuerConfigurationParser.parseParserConfig(null));
        }
    }

    @Nested
    @DisplayName("Global JWKS Settings")
    class GlobalJwksSettingsTests {

        @Test
        @DisplayName("Should apply valid JWKS refresh interval")
        void shouldApplyValidRefreshInterval() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JwtAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL, "7200");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size(), "Should create one issuer config");
        }

        @Test
        @DisplayName("Should log warning for invalid refresh interval")
        void shouldLogWarningForInvalidRefreshInterval() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JwtAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL, "invalid");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "invalid");
        }

        @Test
        @DisplayName("Should log warning for invalid connection timeout")
        void shouldLogWarningForInvalidConnectionTimeout() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JwtAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT, "invalid");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "invalid");
        }
    }

    @Nested
    @DisplayName("External Configuration Manager Integration")
    class ExternalConfigurationTests {

        @Test
        @DisplayName("Should load issuers from ConfigurationManager")
        void shouldLoadIssuersFromConfigManager(@TempDir Path tempDir) throws Exception {
            Path confDir = tempDir.resolve("conf");
            Files.createDirectories(confDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.issuer.external1.name=External Issuer
                    jwt.validation.issuer.external1.jwks-url=https://external.com/jwks
                    """;
            Files.writeString(configFile, content);

            ConfigurationManager configManager = new ConfigurationManager(tempDir.toString() + "/");
            Map<String, String> properties = new HashMap<>();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
            assertEquals("External Issuer", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should merge UI and external configurations")
        void shouldMergeUIAndExternalConfigs(@TempDir Path tempDir) throws Exception {
            Path confDir = tempDir.resolve("conf");
            Files.createDirectories(confDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.issuer.external1.name=External Issuer
                    jwt.validation.issuer.external1.jwks-url=https://external.com/jwks
                    """;
            Files.writeString(configFile, content);

            ConfigurationManager configManager = new ConfigurationManager(tempDir.toString() + "/");
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.ui1.name", "UI Issuer");
            properties.put("issuer.ui1.jwks-url", "https://ui.com/jwks");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(2, configs.size());
        }

        @Test
        @DisplayName("Should handle ConfigurationManager with no config loaded")
        void shouldHandleConfigManagerWithNoConfig() {
            ConfigurationManager configManager = new ConfigurationManager();
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            assertEquals(1, configs.size());
        }

        @Test
        @DisplayName("Should handle null ConfigurationManager")
        void shouldHandleNullConfigManager() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertEquals(1, configs.size());
        }
    }

    @Nested
    @DisplayName("ParserConfig Integration")
    class ParserConfigIntegrationTests {

        @Test
        @DisplayName("Should apply ParserConfig when provided")
        void shouldApplyParserConfig() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();
            ParserConfig parserConfig = ParserConfig.builder().maxTokenSize(32768).build();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(
                    properties, configManager, parserConfig);

            assertEquals(1, configs.size());
            assertNotNull(configs.getFirst().getJwksLoader());
        }

        @Test
        @DisplayName("Should work without ParserConfig")
        void shouldWorkWithoutParserConfig() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(
                    properties, configManager, null);

            assertEquals(1, configs.size());
        }
    }

    @Nested
    @DisplayName("Security Enforcement")
    class SecurityEnforcementTests {

        @Test
        @DisplayName("Should reject non-HTTPS JWKS URL by default")
        void shouldRejectHttpJwksUrlByDefault() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "http://example.com/jwks");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertTrue(configs.isEmpty(), "Non-HTTPS JWKS URL must be rejected when HTTPS is required");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.ERROR, "does not use HTTPS");
        }

        @Test
        @DisplayName("Should allow non-HTTPS JWKS URL when requirement is disabled")
        void shouldAllowHttpJwksUrlWhenHttpsNotRequired() {
            // cui-http 2.0.0 refuses to build a cleartext HTTP handler and the token-sheriff
            // JWKS loader offers no opt-in, so an https:// JWKS URL is required even when the
            // NiFi-level "Require HTTPS for JWKS URLs" guard and private-address checks are
            // both lifted. The plaintext-HTTP rejection is covered by the loopback tests below.
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://localhost:8080/jwks");
            properties.put(JwtAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS, "false");
            properties.put(JwtAttributes.Properties.Validation.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES, "true");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertEquals(1, configs.size(), "JWKS URL should pass when both restrictions are lifted");
        }

        @Test
        @DisplayName("Should reject plaintext HTTP JWKS URL even when the HTTPS requirement is disabled")
        void shouldRejectHttpJwksUrlEvenWhenHttpsNotRequired() {
            // Even with the NiFi-level HTTPS requirement disabled, cui-http 2.0.0 refuses to
            // build a plaintext HTTP handler (no allowInsecureHttp opt-in is exposed by the
            // token-sheriff JWKS loader), so the issuer configuration fails closed.
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "http://localhost:8080/jwks");
            properties.put(JwtAttributes.Properties.Validation.REQUIRE_HTTPS_FOR_JWKS, "false");
            properties.put(JwtAttributes.Properties.Validation.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES, "true");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertTrue(configs.isEmpty(), "Plaintext HTTP JWKS URL must not yield an issuer configuration");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.ERROR, "Error creating issuer configuration");
        }

        @Test
        @DisplayName("Should reject JWKS URL resolving to loopback address by default")
        void shouldRejectLoopbackJwksUrlByDefault() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://localhost/jwks");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertTrue(configs.isEmpty(), "Loopback JWKS URL must be rejected when private addresses are disallowed");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.ERROR, "private/loopback");
        }

        @Test
        @DisplayName("Should reject JWKS URL resolving to a carrier-grade NAT address by default")
        void shouldRejectCarrierGradeNatJwksUrlByDefault() {
            // 100.64.0.0/10 (RFC 6598) is not covered by InetAddress#isSiteLocalAddress(); the
            // dedicated carrier-grade-NAT check must still treat it as private for SSRF protection.
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://100.64.0.1/jwks");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertTrue(configs.isEmpty(),
                    "Carrier-grade NAT (100.64.0.0/10) must be treated as private and rejected");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.ERROR, "private/loopback");
        }

        @Test
        @DisplayName("Should allow JWKS URL resolving to loopback when private addresses enabled")
        void shouldAllowLoopbackJwksUrlWhenPrivateAllowed() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://localhost/jwks");
            properties.put(JwtAttributes.Properties.Validation.JWKS_ALLOW_PRIVATE_NETWORK_ADDRESSES, "true");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertEquals(1, configs.size(), "Loopback JWKS URL should pass when private addresses are allowed");
        }

        @Test
        @DisplayName("Should apply trimmed, de-duplicated allowed algorithms to issuer configs")
        void shouldApplyAllowedAlgorithms() {
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JwtAttributes.Properties.Validation.ALLOWED_ALGORITHMS, "RS256, ES256,RS256, ");

            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            assertEquals(1, configs.size());
            var preferences = configs.getFirst().getAlgorithmPreferences();
            assertEquals(List.of("RS256", "ES256"), preferences.getPreferredAlgorithms(),
                    "Algorithms must be trimmed and de-duplicated");
            assertTrue(preferences.isSupported("RS256"));
            assertFalse(preferences.isSupported("HS256"),
                    "Algorithms outside the configured list must not be supported");
        }
    }
}
