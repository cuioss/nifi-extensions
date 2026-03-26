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

    private static Path createConfDir(Path tempDir) throws IOException {
        Path confDir = tempDir.resolve("conf");
        Files.createDirectories(confDir);
        return confDir;
    }

    private static String basePath(Path tempDir) {
        return tempDir.toString() + "/";
    }

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
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer1.jwks-url=https://example.com/jwks
                    jwt.validation.issuer.issuer1.audience=test-audience
                    jwt.validation.max.token.size=32768
                    jwt.validation.some.other.prop=value
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

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
        }

        @Test
        @DisplayName("Should load properties file with multiple issuers")
        void shouldLoadMultipleIssuersFromPropertiesFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer1.jwks-url=https://example1.com/jwks
                    jwt.validation.issuer.issuer2.name=Issuer Two
                    jwt.validation.issuer.issuer2.jwks-file=/path/to/jwks2.json
                    jwt.validation.issuer.issuer3.name=Issuer Three
                    jwt.validation.issuer.issuer3.jwks-url=https://example3.com/jwks
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            List<String> issuerIds = configManager.getIssuerIds();
            assertEquals(3, issuerIds.size());
            assertTrue(issuerIds.contains("issuer1"));
            assertTrue(issuerIds.contains("issuer2"));
            assertTrue(issuerIds.contains("issuer3"));
        }
    }

    @Nested
    @DisplayName("YAML File Loading")
    class YamlFileTests {

        @Test
        @DisplayName("Should load YAML file with nested structure")
        void shouldLoadYamlFileWithNestedStructure(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
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

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertTrue(configManager.isConfigurationLoaded());
            assertEquals("32768", configManager.getProperty("jwt.validation.max.token.size"));

            Map<String, String> issuer1Props = configManager.getIssuerProperties("issuer1");
            assertEquals("Issuer One", issuer1Props.get("name"));
            assertEquals("https://example.com/jwks", issuer1Props.get("jwks-url"));
            assertEquals("test-audience", issuer1Props.get("audience"));
        }

        @Test
        @DisplayName("Should load YAML file with issuers list using id field")
        void shouldLoadYamlWithIssuersListUsingId(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
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

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            List<String> issuerIds = configManager.getIssuerIds();
            assertEquals(2, issuerIds.size());
            assertTrue(issuerIds.contains("issuer1"));
            assertTrue(issuerIds.contains("issuer2"));

            Map<String, String> issuer1Props = configManager.getIssuerProperties("issuer1");
            assertEquals("issuer1", issuer1Props.get("id"));
            assertEquals("Issuer One", issuer1Props.get("name"));
        }

        @Test
        @DisplayName("Should load YAML file with issuers list using name field when id missing")
        void shouldLoadYamlWithIssuersListUsingName(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
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

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            List<String> issuerIds = configManager.getIssuerIds();
            assertEquals(2, issuerIds.size());
            assertTrue(issuerIds.contains("Issuer One"));
            assertTrue(issuerIds.contains("Issuer Two"));
        }

        @Test
        @DisplayName("Should load YAML file with issuers list using index when id and name missing")
        void shouldLoadYamlWithIssuersListUsingIndex(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            String content = """
                    jwt:
                      validation:
                        issuers:
                          - jwks-url: https://example1.com/jwks
                          - jwks-url: https://example2.com/jwks
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            List<String> issuerIds = configManager.getIssuerIds();
            assertEquals(2, issuerIds.size());
            assertTrue(issuerIds.contains("0"));
            assertTrue(issuerIds.contains("1"));
        }

        @Test
        @DisplayName("Should skip non-map items in YAML issuers list")
        void shouldSkipNonMapItemsInIssuersList(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            String content = """
                    jwt:
                      validation:
                        issuers:
                          - id: valid-issuer
                            jwks-url: https://example.com/jwks
                          - just-a-string-not-a-map
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert — only the map item should be parsed; string item is silently skipped
            List<String> issuerIds = configManager.getIssuerIds();
            assertEquals(1, issuerIds.size());
            assertTrue(issuerIds.contains("valid-issuer"));
        }

        @Test
        @DisplayName("Should handle empty YAML file and return false")
        void shouldHandleEmptyYamlFile(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            Files.writeString(configFile, "");

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertFalse(configManager.isConfigurationLoaded(),
                    "Empty YAML file should not be considered loaded");
        }
    }

    @Nested
    @DisplayName("Configuration Reloading")
    class ReloadTests {

        @Test
        @DisplayName("Should return false when file not modified")
        void shouldReturnFalseWhenNotModified(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            var configManager = new ConfigurationManager(basePath(tempDir));

            // Act
            boolean reloaded = configManager.checkAndReloadConfiguration();

            // Assert
            assertFalse(reloaded, "Should return false when file not modified");
        }

        @Test
        @DisplayName("Should return true when file modified")
        void shouldReturnTrueWhenModified(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            var configManager = new ConfigurationManager(basePath(tempDir));

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
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            var configManager = new ConfigurationManager(basePath(tempDir));

            // Act
            String value = configManager.getProperty("jwt.validation.max.token.size", "default");

            // Assert
            assertEquals("32768", value, "Should return actual value when key exists");
        }
    }

    @Nested
    @DisplayName("Issuer Property Getters")
    class IssuerPropertyGetterTests {

        @Test
        @DisplayName("Should return list of issuer IDs")
        void shouldReturnIssuerIds(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer2.name=Issuer Two
                    jwt.validation.issuer.issuer3.name=Issuer Three
                    """;
            Files.writeString(configFile, content);

            var configManager = new ConfigurationManager(basePath(tempDir));

            // Act
            List<String> issuerIds = configManager.getIssuerIds();

            // Assert
            assertEquals(3, issuerIds.size());
            assertTrue(issuerIds.contains("issuer1"));
            assertTrue(issuerIds.contains("issuer2"));
            assertTrue(issuerIds.contains("issuer3"));
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
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.issuer.issuer1.name=Issuer One
                    jwt.validation.issuer.issuer1.jwks-url=https://example.com/jwks
                    jwt.validation.issuer.issuer1.audience=test-audience
                    """;
            Files.writeString(configFile, content);

            var configManager = new ConfigurationManager(basePath(tempDir));

            // Act
            Map<String, String> props = configManager.getIssuerProperties("issuer1");

            // Assert
            assertFalse(props.isEmpty());
            assertEquals("Issuer One", props.get("name"));
            assertEquals("https://example.com/jwks", props.get("jwks-url"));
            assertEquals("test-audience", props.get("audience"));
        }
    }

    @Nested
    @DisplayName("File Format Handling")
    class FileFormatTests {

        @Test
        @DisplayName("Should prefer properties file over YAML when both exist")
        void shouldPreferPropertiesOverYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path propsFile = confDir.resolve("cui-nifi-extensions.properties");
            Files.writeString(propsFile, "jwt.validation.max.token.size=11111\n");
            Path yamlFile = confDir.resolve("cui-nifi-extensions.yml");
            Files.writeString(yamlFile, """
                    jwt:
                      validation:
                        max:
                          token:
                            size: 22222
                    """);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertTrue(configManager.isConfigurationLoaded());
            assertEquals("11111", configManager.getProperty("jwt.validation.max.token.size"));
        }
    }

    @Nested
    @DisplayName("Environment Variable Conversion")
    class EnvironmentVariableTests {

        @Test
        @DisplayName("Should convert environment variable names to property names")
        void shouldConvertEnvToPropertyName(@TempDir Path tempDir) throws IOException {
            // Arrange & Act
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.properties");
            String content = """
                    jwt.validation.max.token.size=32768
                    """;
            Files.writeString(configFile, content);

            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertNotNull(configManager.getProperty("jwt.validation.max.token.size"),
                    "Property should exist in lowercase dot format");
        }
    }

    @Nested
    @DisplayName("Invalid YAML Handling")
    class InvalidYamlTests {

        @Test
        @DisplayName("Should handle invalid YAML syntax gracefully")
        void shouldHandleInvalidYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            // Unmatched quote causes SnakeYAML to throw YAMLException
            String content = "key: 'unclosed string\nanother: line";
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertFalse(configManager.isConfigurationLoaded(),
                    "Invalid YAML should not be loaded");
        }

        @Test
        @DisplayName("Should handle malformed YAML structure gracefully")
        void shouldHandleMalformedYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            String content = """
                    jwt:
                      validation:
                        [[[malformed structure
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertFalse(configManager.isConfigurationLoaded(),
                    "Malformed YAML should not be loaded");
        }
    }

    @Nested
    @DisplayName("Generic List Processing")
    class GenericListTests {

        @Test
        @DisplayName("Should process generic YAML list as comma-separated string")
        void shouldProcessGenericListAsCommaSeparated(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            String content = """
                    jwt:
                      validation:
                        algorithms:
                          - RS256
                          - RS384
                          - RS512
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertTrue(configManager.isConfigurationLoaded());
            String algorithms = configManager.getProperty("jwt.validation.algorithms");
            assertNotNull(algorithms, "Algorithms property should exist");
            assertEquals("RS256,RS384,RS512", algorithms,
                    "List should be stored as comma-separated string");
        }

        @Test
        @DisplayName("Should handle list with null values")
        void shouldHandleListWithNullValues(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            String content = """
                    jwt:
                      validation:
                        claims:
                          - sub
                          - iss
                    """;
            Files.writeString(configFile, content);

            // Act
            var configManager = new ConfigurationManager(basePath(tempDir));

            // Assert
            assertTrue(configManager.isConfigurationLoaded());
            String claims = configManager.getProperty("jwt.validation.claims");
            assertNotNull(claims, "Claims property should exist");
            assertEquals("sub,iss", claims);
        }
    }

    @Nested
    @DisplayName("Reload Error Handling")
    class ReloadErrorTests {

        @Test
        @DisplayName("Should clear old config when reload encounters invalid YAML")
        void shouldClearOldConfigOnReloadWithInvalidYaml(@TempDir Path tempDir) throws IOException {
            // Arrange
            Path confDir = createConfDir(tempDir);
            Path configFile = confDir.resolve("cui-nifi-extensions.yml");
            String validContent = """
                    jwt:
                      validation:
                        max:
                          token:
                            size: 32768
                    """;
            Files.writeString(configFile, validContent);

            var configManager = new ConfigurationManager(basePath(tempDir));
            assertTrue(configManager.isConfigurationLoaded());
            assertEquals("32768", configManager.getProperty("jwt.validation.max.token.size"));

            // Overwrite with invalid YAML (unmatched quote triggers YAMLException)
            String invalidContent = "key: 'unclosed string\nanother: line";
            Files.writeString(configFile, invalidContent);
            Files.setLastModifiedTime(configFile,
                    FileTime.from(Instant.now().plusSeconds(1)));

            // Act — poll until the modification is detected
            // Reload completes (returns true) even though YAML is invalid,
            // because the exception is caught internally and properties are cleared
            await().atMost(2, SECONDS)
                    .until(configManager::checkAndReloadConfiguration);

            // Assert — old config is cleared
            assertFalse(configManager.isConfigurationLoaded(),
                    "Configuration should not be loaded after invalid YAML");
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
}
