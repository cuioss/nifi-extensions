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

import de.cuioss.nifi.jwt.JWTAttributes;
import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import de.cuioss.test.juli.LogAsserts;
import de.cuioss.test.juli.TestLogLevel;
import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
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
            assertThrows(NullPointerException.class,
                    () -> IssuerConfigurationParser.parseIssuerConfigs(null, new ConfigurationManager()));
        }

        @Test
        @DisplayName("Should return empty list for empty properties")
        void shouldReturnEmptyListForEmptyProperties() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertTrue(configs.isEmpty(), "Should return empty list for empty properties");
        }
    }

    @Nested
    @DisplayName("UI Property Parsing")
    class UIPropertyParsingTests {

        @Test
        @DisplayName("Should create IssuerConfig from UI property with JWKS URL")
        void shouldCreateIssuerConfigWithJwksUrl() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            IssuerConfig config = configs.getFirst();
            assertEquals("TestIssuer", config.getIssuerIdentifier());
            assertNotNull(config.getJwksLoader(), "JWKS loader should be configured");
        }

        @Test
        @DisplayName("Should create IssuerConfig from UI property with JWKS file")
        void shouldCreateIssuerConfigWithJwksFile(@TempDir Path tempDir) throws IOException {
            // Arrange — create a real JWKS file since the builder validates existence
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, "{\"keys\":[]}");
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-file", jwksFile.toString());
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            assertEquals("TestIssuer", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should skip disabled issuer")
        void shouldSkipDisabledIssuer() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.enabled", "false");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertTrue(configs.isEmpty(), "Disabled issuer should be skipped");
        }

        @Test
        @DisplayName("Should skip issuer with missing name")
        void shouldSkipIssuerWithMissingName() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertTrue(configs.isEmpty(), "Issuer without name should be skipped");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "no name");
        }

        @Test
        @DisplayName("Should skip issuer with missing JWKS source")
        void shouldSkipIssuerWithMissingJwksSource() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertTrue(configs.isEmpty(), "Issuer without JWKS source should be skipped");
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "JWKS");
        }

        @Test
        @DisplayName("Should set audience when present")
        void shouldSetAudience() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.audience", "test-audience");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            assertTrue(configs.getFirst().getExpectedAudience().contains("test-audience"),
                    "Expected audience should contain 'test-audience'");
        }

        @Test
        @DisplayName("Should set client ID when present")
        void shouldSetClientId() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.client-id", "test-client");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
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

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(3, configs.size());
        }

        @Test
        @DisplayName("Should use issuer key as fallback name")
        void shouldUseIssuerPropertyAsFallbackName() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.issuer", "FallbackIssuerName");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            assertEquals("FallbackIssuerName", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should resolve jwksUri as alternative URL key")
        void shouldResolveJwksUri() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwksUri", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            assertEquals("TestIssuer", configs.getFirst().getIssuerIdentifier());
        }

        @Test
        @DisplayName("Should warn when jwks-content is used")
        void shouldWarnOnJwksContent() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-content", "{\"keys\":[]}");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
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
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put("issuer.test.jwks-type", "url");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            assertNotNull(configs.getFirst().getJwksLoader());
        }

        @Test
        @DisplayName("Should infer URL type from jwks-url property")
        void shouldInferUrlTypeFromJwksUrl() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
        }

        @Test
        @DisplayName("Should infer file type from jwks-file property")
        void shouldInferFileTypeFromJwksFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path jwksFile = tempDir.resolve("test-jwks.json");
            Files.writeString(jwksFile, "{\"keys\":[]}");
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-file", jwksFile.toString());
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
        }
    }

    @Nested
    @DisplayName("ParserConfig Parsing")
    class ParserConfigParsingTests {

        @Test
        @DisplayName("Should parse valid max token size")
        void shouldParseValidMaxTokenSize() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("Maximum Token Size", "32768");

            // Act
            ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

            // Assert
            assertEquals(32768, config.getMaxTokenSize());
        }

        @Test
        @DisplayName("Should use default for invalid max token size")
        void shouldUseDefaultForInvalidMaxTokenSize() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("Maximum Token Size", "not-a-number");

            // Act
            ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

            // Assert
            assertEquals(16384, config.getMaxTokenSize());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "not-a-number");
        }

        @Test
        @DisplayName("Should use default when max token size key missing")
        void shouldUseDefaultWhenKeyMissing() {
            // Arrange
            Map<String, String> properties = new HashMap<>();

            // Act
            ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

            // Assert
            assertEquals(16384, config.getMaxTokenSize());
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
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JWTAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL, "7200");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size(), "Should create one issuer config");
        }

        @Test
        @DisplayName("Should log warning for invalid refresh interval")
        void shouldLogWarningForInvalidRefreshInterval() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JWTAttributes.Properties.Validation.JWKS_REFRESH_INTERVAL, "invalid");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "invalid");
        }

        @Test
        @DisplayName("Should log warning for invalid connection timeout")
        void shouldLogWarningForInvalidConnectionTimeout() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            properties.put(JWTAttributes.Properties.Validation.JWKS_CONNECTION_TIMEOUT, "invalid");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
            LogAsserts.assertLogMessagePresentContaining(TestLogLevel.WARN, "invalid");
        }
    }

    @Nested
    @DisplayName("External Configuration Manager Integration")
    class ExternalConfigurationTests {

        @Test
        @DisplayName("Should load issuers from ConfigurationManager")
        void shouldLoadIssuersFromConfigManager(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.issuer.external1.name=External Issuer
                    jwt.validation.issuer.external1.jwks-url=https://external.com/jwks
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                ConfigurationManager configManager = new ConfigurationManager();
                Map<String, String> properties = new HashMap<>();

                // Act
                List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

                // Assert
                assertEquals(1, configs.size());
                assertEquals("External Issuer", configs.getFirst().getIssuerIdentifier());
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should merge UI and external configurations")
        void shouldMergeUIAndExternalConfigs(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.issuer.external1.name=External Issuer
                    jwt.validation.issuer.external1.jwks-url=https://external.com/jwks
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                ConfigurationManager configManager = new ConfigurationManager();
                Map<String, String> properties = new HashMap<>();
                properties.put("issuer.ui1.name", "UI Issuer");
                properties.put("issuer.ui1.jwks-url", "https://ui.com/jwks");

                // Act
                List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

                // Assert
                assertEquals(2, configs.size());
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should handle ConfigurationManager with no config loaded")
        void shouldHandleConfigManagerWithNoConfig() {
            // Arrange
            ConfigurationManager configManager = new ConfigurationManager();
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

            // Assert
            assertEquals(1, configs.size());
        }

        @Test
        @DisplayName("Should handle null ConfigurationManager")
        void shouldHandleNullConfigManager() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

            // Assert
            assertEquals(1, configs.size());
        }
    }

    @Nested
    @DisplayName("ParserConfig Integration")
    class ParserConfigIntegrationTests {

        @Test
        @DisplayName("Should apply ParserConfig when provided")
        void shouldApplyParserConfig() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();
            ParserConfig parserConfig = ParserConfig.builder().maxTokenSize(32768).build();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(
                    properties, configManager, parserConfig);

            // Assert
            assertEquals(1, configs.size());
            assertNotNull(configs.getFirst().getJwksLoader());
        }

        @Test
        @DisplayName("Should work without ParserConfig")
        void shouldWorkWithoutParserConfig() {
            // Arrange
            Map<String, String> properties = new HashMap<>();
            properties.put("issuer.test.name", "TestIssuer");
            properties.put("issuer.test.jwks-url", "https://example.com/jwks");
            ConfigurationManager configManager = new ConfigurationManager();

            // Act
            List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(
                    properties, configManager, null);

            // Assert
            assertEquals(1, configs.size());
        }
    }
}
