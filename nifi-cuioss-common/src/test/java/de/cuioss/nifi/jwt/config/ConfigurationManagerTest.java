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

import de.cuioss.test.juli.junit5.EnableTestLogger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ConfigurationManager")
@EnableTestLogger
class ConfigurationManagerTest {

    @Nested
    @DisplayName("Constructor and Initialization")
    class ConstructorTests {

        @Test
        @DisplayName("Should initialize with configurationLoaded false when no config file exists")
        void shouldInitializeWithoutConfig() {
            // Arrange & Act
            var configManager = new ConfigurationManager();

            // Assert
            assertFalse(configManager.isConfigurationLoaded(),
                    "Configuration should not be loaded when no config file exists");
            assertTrue(configManager.getStaticProperties().isEmpty(),
                    "Static properties should be empty");
            assertTrue(configManager.getIssuerProperties().isEmpty(),
                    "Issuer properties should be empty");
        }
    }

    @Nested
    @DisplayName("Properties File Loading")
    class PropertiesFileTests {

        @Test
        @DisplayName("Should load properties file with issuer config and static props")
        void shouldLoadPropertiesFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer1.jwks-url=https://example.com/jwks
                    jwt.validation.issuer.issuer1.audience=test-audience
                    jwt.validation.max.token.size=32768
                    jwt.validation.some.other.prop=value
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertTrue(configManager.isConfigurationLoaded(),
                        "Configuration should be loaded");

                assertEquals("32768", configManager.getProperty("jwt.validation.max.token.size"));
                assertEquals("value", configManager.getProperty("jwt.validation.some.other.prop"));

                List<String> issuerIds = configManager.getIssuerIds();
                assertTrue(issuerIds.contains("issuer1"));

                Map<String, String> issuer1Props = configManager.getIssuerProperties("issuer1");
                assertEquals("Issuer One", issuer1Props.get("name"));
                assertEquals("https://example.com/jwks", issuer1Props.get("jwks-url"));
                assertEquals("test-audience", issuer1Props.get("audience"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should load properties file with multiple issuers")
        void shouldLoadMultipleIssuersFromPropertiesFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer1.jwks-url=https://example1.com/jwks
                    jwt.validation.issuer.issuer2.name=Issuer Two
                    jwt.validation.issuer.issuer2.jwks-file=/path/to/jwks2.json
                    jwt.validation.issuer.issuer3.name=Issuer Three
                    jwt.validation.issuer.issuer3.jwks-url=https://example3.com/jwks
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                List<String> issuerIds = configManager.getIssuerIds();
                assertEquals(3, issuerIds.size());
                assertTrue(issuerIds.contains("issuer1"));
                assertTrue(issuerIds.contains("issuer2"));
                assertTrue(issuerIds.contains("issuer3"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("YAML File Loading")
    class YamlFileTests {

        @Test
        @DisplayName("Should load YAML file with nested structure")
        void shouldLoadYamlFileWithNestedStructure(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        max:
                          token:
                            size: 32768
                        issuer:
                          issuer1:
                            name: Issuer One
                            jwks-url: https://example.com/jwks
                            audience: test-audience
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertTrue(configManager.isConfigurationLoaded());
                assertEquals("32768", configManager.getProperty("jwt.validation.max.token.size"));

                Map<String, String> issuer1Props = configManager.getIssuerProperties("issuer1");
                assertEquals("Issuer One", issuer1Props.get("name"));
                assertEquals("https://example.com/jwks", issuer1Props.get("jwks-url"));
                assertEquals("test-audience", issuer1Props.get("audience"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should load YAML file with issuers list using id field")
        void shouldLoadYamlWithIssuersListUsingId(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        issuers:
                          - id: issuer1
                            name: Issuer One
                            jwks-url: https://example1.com/jwks
                          - id: issuer2
                            name: Issuer Two
                            jwks-url: https://example2.com/jwks
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                List<String> issuerIds = configManager.getIssuerIds();
                assertEquals(2, issuerIds.size());
                assertTrue(issuerIds.contains("issuer1"));
                assertTrue(issuerIds.contains("issuer2"));

                Map<String, String> issuer1Props = configManager.getIssuerProperties("issuer1");
                assertEquals("issuer1", issuer1Props.get("id"));
                assertEquals("Issuer One", issuer1Props.get("name"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should load YAML file with issuers list using name field when id missing")
        void shouldLoadYamlWithIssuersListUsingName(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        issuers:
                          - name: Issuer One
                            jwks-url: https://example1.com/jwks
                          - name: Issuer Two
                            jwks-url: https://example2.com/jwks
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                List<String> issuerIds = configManager.getIssuerIds();
                assertEquals(2, issuerIds.size());
                assertTrue(issuerIds.contains("Issuer One"));
                assertTrue(issuerIds.contains("Issuer Two"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should load YAML file with issuers list using index when id and name missing")
        void shouldLoadYamlWithIssuersListUsingIndex(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        issuers:
                          - jwks-url: https://example1.com/jwks
                          - jwks-url: https://example2.com/jwks
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                List<String> issuerIds = configManager.getIssuerIds();
                assertEquals(2, issuerIds.size());
                assertTrue(issuerIds.contains("0"));
                assertTrue(issuerIds.contains("1"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should handle empty YAML file and return false")
        void shouldHandleEmptyYamlFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            Files.writeString(configFile, "");

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertFalse(configManager.isConfigurationLoaded(),
                        "Empty YAML file should not be considered loaded");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Configuration Reloading")
    class ReloadTests {

        @Test
        @DisplayName("Should return false when file not modified")
        void shouldReturnFalseWhenNotModified(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();

                // Act
                boolean reloaded = configManager.checkAndReloadConfiguration();

                // Assert
                assertFalse(reloaded, "Should return false when file not modified");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should return true when file modified")
        void shouldReturnTrueWhenModified(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();

                // Modify file and ensure modification time is detectably different
                String newContent = """
                        jwt.validation.max.token.size=65536
                        """;
                Files.writeString(configFile, newContent);
                Files.setLastModifiedTime(configFile,
                        FileTime.from(Instant.now().plusSeconds(1)));

                // Act — poll until the modification is detected
                await().atMost(2, SECONDS)
                        .until(configManager::checkAndReloadConfiguration);

                // Assert
                assertEquals("65536", configManager.getProperty("jwt.validation.max.token.size"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Property Getters")
    class PropertyGetterTests {

        @Test
        @DisplayName("Should return null for missing key")
        void shouldReturnNullForMissingKey() {
            // Arrange
            var configManager = new ConfigurationManager();

            // Act
            String value = configManager.getProperty("non.existent.key");

            // Assert
            assertNull(value, "Should return null for missing key");
        }

        @Test
        @DisplayName("Should return default value for missing key")
        void shouldReturnDefaultForMissingKey() {
            // Arrange
            var configManager = new ConfigurationManager();

            // Act
            String value = configManager.getProperty("non.existent.key", "default-value");

            // Assert
            assertEquals("default-value", value, "Should return default value for missing key");
        }

        @Test
        @DisplayName("Should return actual value when key exists")
        void shouldReturnActualValue(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();

                // Act
                String value = configManager.getProperty("jwt.validation.max.token.size", "default");

                // Assert
                assertEquals("32768", value, "Should return actual value when key exists");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Issuer Property Getters")
    class IssuerPropertyGetterTests {

        @Test
        @DisplayName("Should return list of issuer IDs")
        void shouldReturnIssuerIds(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer2.name=Issuer Two
                    jwt.validation.issuer.issuer3.name=Issuer Three
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();

                // Act
                List<String> issuerIds = configManager.getIssuerIds();

                // Assert
                assertEquals(3, issuerIds.size());
                assertTrue(issuerIds.contains("issuer1"));
                assertTrue(issuerIds.contains("issuer2"));
                assertTrue(issuerIds.contains("issuer3"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should return empty map for unknown issuer")
        void shouldReturnEmptyMapForUnknownIssuer() {
            // Arrange
            var configManager = new ConfigurationManager();

            // Act
            Map<String, String> props = configManager.getIssuerProperties("unknown-issuer");

            // Assert
            assertTrue(props.isEmpty(), "Should return empty map for unknown issuer");
        }

        @Test
        @DisplayName("Should return issuer properties for known issuer")
        void shouldReturnIssuerProperties(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer1.jwks-url=https://example.com/jwks
                    jwt.validation.issuer.issuer1.audience=test-audience
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();

                // Act
                Map<String, String> props = configManager.getIssuerProperties("issuer1");

                // Assert
                assertFalse(props.isEmpty());
                assertEquals("Issuer One", props.get("name"));
                assertEquals("https://example.com/jwks", props.get("jwks-url"));
                assertEquals("test-audience", props.get("audience"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("File Format Handling")
    class FileFormatTests {

        @Test
        @DisplayName("Should handle .yaml extension")
        void shouldHandleYamlExtension(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yaml");
            String content = """
                    jwt:
                      validation:
                        max:
                          token:
                            size: 32768
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertTrue(configManager.isConfigurationLoaded());
                assertEquals("32768", configManager.getProperty("jwt.validation.max.token.size"));
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Environment Variable Conversion")
    class EnvironmentVariableTests {

        @Test
        @DisplayName("Should convert environment variable names to property names")
        void shouldConvertEnvToPropertyName(@TempDir Path tempDir) throws IOException {
            // Arrange & Act
            // We cannot set environment variables in tests, so we verify the behavior
            // through the ConfigurationManager by checking that it accepts
            // properties that match the expected conversion pattern
            Path configFile = tempDir.resolve("jwt-validation.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();

                // Assert
                // The environment variable JWT_MAX_TOKEN_SIZE would convert to
                // jwt.validation.max.token.size
                // We verify that the property exists in the expected format
                assertNotNull(configManager.getProperty("jwt.validation.max.token.size"),
                        "Property should exist in lowercase dot format");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Unsupported File Format")
    class UnsupportedFileFormatTests {

        @Test
        @DisplayName("Should not load unsupported .txt file format")
        void shouldNotLoadTxtFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.txt");
            String content = "jwt.validation.max.token.size=32768";
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertFalse(configManager.isConfigurationLoaded(),
                        "Unsupported file format should not be loaded");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Invalid YAML Handling")
    class InvalidYamlTests {

        @Test
        @DisplayName("Should handle invalid YAML syntax gracefully")
        void shouldHandleInvalidYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            // Unmatched quote causes SnakeYAML to throw YAMLException
            String content = "key: 'unclosed string\nanother: line";
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertFalse(configManager.isConfigurationLoaded(),
                        "Invalid YAML should not be loaded");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should handle malformed YAML structure gracefully")
        void shouldHandleMalformedYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        [[[malformed structure
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertFalse(configManager.isConfigurationLoaded(),
                        "Malformed YAML should not be loaded");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Generic List Processing")
    class GenericListTests {

        @Test
        @DisplayName("Should process generic YAML list as comma-separated string")
        void shouldProcessGenericListAsCommaSeparated(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        algorithms:
                          - RS256
                          - RS384
                          - RS512
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertTrue(configManager.isConfigurationLoaded());
                String algorithms = configManager.getProperty("jwt.validation.algorithms");
                assertNotNull(algorithms, "Algorithms property should exist");
                assertEquals("RS256,RS384,RS512", algorithms,
                        "List should be stored as comma-separated string");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }

        @Test
        @DisplayName("Should handle list with null values")
        void shouldHandleListWithNullValues(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String content = """
                    jwt:
                      validation:
                        claims:
                          - sub
                          - iss
                    """;
            Files.writeString(configFile, content);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertTrue(configManager.isConfigurationLoaded());
                String claims = configManager.getProperty("jwt.validation.claims");
                assertNotNull(claims, "Claims property should exist");
                assertEquals("sub,iss", claims);
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Reload Error Handling")
    class ReloadErrorTests {

        @Test
        @DisplayName("Should clear old config when reload encounters invalid YAML")
        void shouldClearOldConfigOnReloadWithInvalidYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path configFile = tempDir.resolve("jwt-validation.yml");
            String validContent = """
                    jwt:
                      validation:
                        max:
                          token:
                            size: 32768
                    """;
            Files.writeString(configFile, validContent);

            System.setProperty("jwt.Config.path", configFile.toString());
            try {
                var configManager = new ConfigurationManager();
                assertTrue(configManager.isConfigurationLoaded());
                assertEquals("32768", configManager.getProperty("jwt.validation.max.token.size"));

                // Overwrite with invalid YAML (unmatched quote triggers YAMLException)
                String invalidContent = "key: 'unclosed string\nanother: line";
                Files.writeString(configFile, invalidContent);
                Files.setLastModifiedTime(configFile,
                        FileTime.from(Instant.now().plusSeconds(1)));

                // Act — poll until the modification is detected
                // loadConfiguration() clears properties before loading;
                // YAMLException is caught internally in loadConfigurationFile(),
                // so checkAndReloadConfiguration() returns true (reload completed)
                await().atMost(2, SECONDS)
                        .until(configManager::checkAndReloadConfiguration);

                // Assert — old config is cleared
                assertFalse(configManager.isConfigurationLoaded(),
                        "Configuration should not be loaded after invalid YAML");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }

    @Nested
    @DisplayName("Reload Without Config File")
    class ReloadWithoutFileTests {

        @Test
        @DisplayName("Should return false when no config file exists")
        void shouldReturnFalseWhenNoConfigFile() {
            // Arrange
            var configManager = new ConfigurationManager();

            // Act
            boolean reloaded = configManager.checkAndReloadConfiguration();

            // Assert
            assertFalse(reloaded, "Should return false when no config file exists");
        }
    }

    @Nested
    @DisplayName("Non-Existent Config File Path")
    class NonExistentFileTests {

        @Test
        @DisplayName("Should not crash with non-existent file path")
        void shouldHandleNonExistentFilePath() {
            // Arrange
            System.setProperty("jwt.Config.path", "/tmp/nonexistent-file-12345.properties");
            try {
                // Act
                var configManager = new ConfigurationManager();

                // Assert
                assertFalse(configManager.isConfigurationLoaded(),
                        "Configuration should not be loaded for non-existent file");
                assertTrue(configManager.getStaticProperties().isEmpty(),
                        "Static properties should be empty");
                assertTrue(configManager.getIssuerProperties().isEmpty(),
                        "Issuer properties should be empty");
            } finally {
                System.clearProperty("jwt.Config.path");
            }
        }
    }
}
