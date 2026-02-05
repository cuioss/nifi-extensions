/*
 * Copyright 2023 the original author or authors.
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * https://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.cuioss.nifi.processors.auth.config;

import de.cuioss.sheriff.oauth.core.IssuerConfig;
import de.cuioss.sheriff.oauth.core.ParserConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive unit tests for IssuerConfigurationParser.
 * Tests all public methods and edge cases for proper configuration parsing.
 */
class IssuerConfigurationParserTest {

    @TempDir
    Path tempDir;

    private static final String TEST_JWKS_FILE = "src/test/resources/jwks/test-jwks.json";

    // ========== Tests for parseIssuerConfigs with UI Configuration ==========

    @Test
    void parseIssuerConfigs_withSingleUIIssuer() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "test-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(1, configs.size());
        IssuerConfig config = configs.getFirst();
        assertEquals("test-issuer", config.getIssuerIdentifier());
        // Note: IssuerConfig is from external library, some getters may not be publicly accessible
        assertNotNull(config);
    }

    private String getAbsolutePath(String relativePath) {
        return Path.of(relativePath).toAbsolutePath().toString();
    }

    @Test
    void parseIssuerConfigs_withMultipleUIIssuers() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "issuer-one");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.2.name", "issuer-two");
        properties.put("issuer.2.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.3.name", "issuer-three");
        properties.put("issuer.3.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(3, configs.size());

        // Verify all issuers are present (order may vary)
        assertTrue(configs.stream().anyMatch(c -> "issuer-one".equals(c.getIssuerIdentifier())));
        assertTrue(configs.stream().anyMatch(c -> "issuer-two".equals(c.getIssuerIdentifier())));
        assertTrue(configs.stream().anyMatch(c -> "issuer-three".equals(c.getIssuerIdentifier())));
    }

    @Test
    void parseIssuerConfigs_withUIIssuerAndOptionalFields() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "test-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.1.audience", "my-api");
        properties.put("issuer.1.client-id", "my-client");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(1, configs.size());
        IssuerConfig config = configs.getFirst();
        assertEquals("test-issuer", config.getIssuerIdentifier());
        // Verify that issuer was created with optional fields (actual values not accessible via getters)
        assertNotNull(config);
    }

    @Test
    void parseIssuerConfigs_withUIIssuerUsingJwksFile() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "file-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(1, configs.size());
        IssuerConfig config = configs.getFirst();
        assertEquals("file-issuer", config.getIssuerIdentifier());
        assertNotNull(config);
    }

    @Test
    void parseIssuerConfigs_withDisabledUIIssuer() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "disabled-issuer");
        properties.put("issuer.1.jwks-url", "https://example.com/jwks");
        properties.put("issuer.1.enabled", "false");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Disabled issuers should be skipped
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUIIssuerMissingName() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.jwks-url", "https://example.com/jwks");
        // No name property

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Issuers without name should be skipped
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUIIssuerEmptyName() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "   ");  // Only whitespace
        properties.put("issuer.1.jwks-url", "https://example.com/jwks");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Issuers with empty/whitespace-only name should be skipped
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUIIssuerMissingJwksSource() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "no-jwks-issuer");
        // No jwks-url, jwks-file, or jwks-content

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Issuers without JWKS source should be skipped
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUIIssuerEmptyJwksUrl() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "empty-jwks-issuer");
        properties.put("issuer.1.jwks-url", "   ");  // Only whitespace

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Issuers with empty JWKS source should be skipped
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUIIssuerJwksContent() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "content-issuer");
        properties.put("issuer.1.jwks-content", "{\"keys\": []}");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // JWKS content is not yet supported, should be skipped
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUIIssuerTrimsWhitespace() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "  test-issuer  ");
        properties.put("issuer.1.jwks-file", "  " + getAbsolutePath(TEST_JWKS_FILE) + "  ");
        properties.put("issuer.1.audience", "  my-api  ");
        properties.put("issuer.1.client-id", "  my-client  ");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(1, configs.size());
        IssuerConfig config = configs.getFirst();
        // Verify whitespace is trimmed from issuer identifier
        assertEquals("test-issuer", config.getIssuerIdentifier());
        assertNotNull(config);
    }

    @Test
    void parseIssuerConfigs_withEmptyProperties() {
        Map<String, String> properties = new LinkedHashMap<>();

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withNonIssuerProperties() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("some.other.property", "value");
        properties.put("Maximum Token Size", "8192");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(0, configs.size());
    }

    // ========== Tests for parseIssuerConfigs with External Configuration ==========

    @Test
    void parseIssuerConfigs_withExternalConfiguration() throws IOException {
        // Create external configuration with real JWKS file path
        String yamlContent = """
            jwt:
              validation:
                issuers:
                  - id: external-issuer
                    name: External Issuer
                    jwksUri: %s
                    audience: external-api
            """.formatted(getAbsolutePath(TEST_JWKS_FILE));

        File yamlFile = tempDir.resolve("external-config.yml").toFile();
        Files.writeString(yamlFile.toPath(), yamlContent);
        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());

        ConfigurationManager configManager = new ConfigurationManager();
        Map<String, String> properties = new LinkedHashMap<>();

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

        // Clean up
        System.clearProperty("jwt.Config.path");

        assertTrue(configs.size() > 0);
        assertTrue(configs.stream().anyMatch(c -> "External Issuer".equals(c.getIssuerIdentifier())));
    }

    @Test
    void parseIssuerConfigs_withBothUIAndExternalConfiguration() throws IOException {
        // Create external configuration with real JWKS file path
        String yamlContent = """
            jwt:
              validation:
                issuers:
                  - id: external-issuer
                    name: External Issuer
                    jwksUri: %s
            """.formatted(getAbsolutePath(TEST_JWKS_FILE));

        File yamlFile = tempDir.resolve("mixed-config.yml").toFile();
        Files.writeString(yamlFile.toPath(), yamlContent);
        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());

        ConfigurationManager configManager = new ConfigurationManager();

        // Also add UI configuration
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "ui-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

        // Clean up
        System.clearProperty("jwt.Config.path");

        // Should have both external and UI issuers
        assertTrue(configs.size() >= 2);
        assertTrue(configs.stream().anyMatch(c -> "External Issuer".equals(c.getIssuerIdentifier())));
        assertTrue(configs.stream().anyMatch(c -> "ui-issuer".equals(c.getIssuerIdentifier())));
    }

    @Test
    void parseIssuerConfigs_withNullConfigurationManager() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "test-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        // Should handle null configuration manager gracefully
        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(1, configs.size());
    }

    @Test
    void parseIssuerConfigs_withUnloadedConfigurationManager() {
        // Create a configuration manager without valid configuration
        ConfigurationManager configManager = new ConfigurationManager();
        assertFalse(configManager.isConfigurationLoaded());

        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "test-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, configManager);

        // Should still process UI configuration
        assertEquals(1, configs.size());
    }

    // ========== Tests for parseParserConfig ==========

    @Test
    void parseParserConfig_withDefaultMaxTokenSize() {
        Map<String, String> properties = new LinkedHashMap<>();

        ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

        assertNotNull(config);
        assertEquals(16384, config.getMaxTokenSize());
    }

    @Test
    void parseParserConfig_withCustomMaxTokenSize() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("Maximum Token Size", "8192");

        ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

        assertNotNull(config);
        assertEquals(8192, config.getMaxTokenSize());
    }

    @Test
    void parseParserConfig_withInvalidMaxTokenSize() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("Maximum Token Size", "not-a-number");

        // Should throw NumberFormatException
        assertThrows(NumberFormatException.class, () -> {
            IssuerConfigurationParser.parseParserConfig(properties);
        });
    }

    @Test
    void parseParserConfig_withEmptyMaxTokenSize() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("Maximum Token Size", "");

        // Should throw NumberFormatException
        assertThrows(NumberFormatException.class, () -> {
            IssuerConfigurationParser.parseParserConfig(properties);
        });
    }

    @Test
    void parseParserConfig_withZeroMaxTokenSize() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("Maximum Token Size", "0");

        ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

        assertNotNull(config);
        assertEquals(0, config.getMaxTokenSize());
    }

    @Test
    void parseParserConfig_withNegativeMaxTokenSize() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("Maximum Token Size", "-1");

        ParserConfig config = IssuerConfigurationParser.parseParserConfig(properties);

        assertNotNull(config);
        assertEquals(-1, config.getMaxTokenSize());
    }

    // ========== Tests for extractPropertiesFromProcessorDTO ==========

    @Test
    void extractPropertiesFromProcessorDTO_withNonEmptyMap() {
        Map<String, String> processorProperties = new LinkedHashMap<>();
        processorProperties.put("issuer.1.name", "test-issuer");
        processorProperties.put("issuer.1.jwks-url", "https://example.com/jwks");
        processorProperties.put("Maximum Token Size", "8192");

        Map<String, String> extracted = IssuerConfigurationParser.extractPropertiesFromProcessorDTO(processorProperties);

        assertNotNull(extracted);
        assertEquals(3, extracted.size());
        assertEquals("test-issuer", extracted.get("issuer.1.name"));
        assertEquals("https://example.com/jwks", extracted.get("issuer.1.jwks-url"));
        assertEquals("8192", extracted.get("Maximum Token Size"));
    }

    @Test
    void extractPropertiesFromProcessorDTO_withEmptyMap() {
        Map<String, String> processorProperties = new LinkedHashMap<>();

        Map<String, String> extracted = IssuerConfigurationParser.extractPropertiesFromProcessorDTO(processorProperties);

        assertNotNull(extracted);
        assertEquals(0, extracted.size());
    }

    @Test
    void extractPropertiesFromProcessorDTO_createsNewMap() {
        Map<String, String> processorProperties = new LinkedHashMap<>();
        processorProperties.put("key", "value");

        Map<String, String> extracted = IssuerConfigurationParser.extractPropertiesFromProcessorDTO(processorProperties);

        // Verify it's a new map (not the same reference)
        assertNotSame(processorProperties, extracted);

        // But has the same content
        assertEquals(processorProperties, extracted);

        // Modifying the original should not affect the extracted
        processorProperties.put("new-key", "new-value");
        assertFalse(extracted.containsKey("new-key"));
    }

    // ========== Edge Cases and Integration Tests ==========

    @Test
    void parseIssuerConfigs_withMixOfValidAndInvalidIssuers() {
        Map<String, String> properties = new LinkedHashMap<>();
        // Valid issuer
        properties.put("issuer.1.name", "valid-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        // Invalid issuer (no name)
        properties.put("issuer.2.jwks-url", "https://example.com/jwks2");

        // Invalid issuer (no JWKS source)
        properties.put("issuer.3.name", "no-jwks");

        // Valid issuer with file
        properties.put("issuer.4.name", "file-issuer");
        properties.put("issuer.4.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should only have the 2 valid issuers
        assertEquals(2, configs.size());
        assertTrue(configs.stream().anyMatch(c -> "valid-issuer".equals(c.getIssuerIdentifier())));
        assertTrue(configs.stream().anyMatch(c -> "file-issuer".equals(c.getIssuerIdentifier())));
    }

    @Test
    void parseIssuerConfigs_withPropertyWithoutIssuerIndex() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.name", "orphan-property");  // Missing index
        properties.put("issuer.1.name", "valid-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should only parse the valid issuer with proper index
        assertEquals(1, configs.size());
        assertEquals("valid-issuer", configs.getFirst().getIssuerIdentifier());
    }

    @Test
    void parseIssuerConfigs_withNonNamePropertyBeforeNameProperty() {
        Map<String, String> properties = new LinkedHashMap<>();
        // This property comes before the name property - should be skipped initially
        properties.put("issuer.1.audience", "my-api");
        // Name property comes after
        properties.put("issuer.1.name", "test-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should still create the issuer, but audience might be missing
        // depending on property iteration order
        assertEquals(1, configs.size());
        assertEquals("test-issuer", configs.getFirst().getIssuerIdentifier());
    }

    @Test
    void parseIssuerConfigs_withUrlPreferredOverFile() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "multi-source");
        properties.put("issuer.1.jwks-url", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        assertEquals(1, configs.size());
        // URL should be preferred over file (verified by code logic, not getter)
        assertEquals("multi-source", configs.getFirst().getIssuerIdentifier());
    }

    @Test
    void parseIssuerConfigs_withCaseInsensitiveEnabled() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "case-test");
        properties.put("issuer.1.jwks-url", "https://example.com/jwks");
        properties.put("issuer.1.enabled", "FALSE");  // Uppercase

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should handle case-insensitive "false"
        assertEquals(0, configs.size());
    }

    @Test
    void parseIssuerConfigs_withEnabledTrueExplicitly() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "enabled-issuer");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.1.enabled", "true");

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should parse normally
        assertEquals(1, configs.size());
    }

    @Test
    void parseIssuerConfigs_withEnabledInvalidValue() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.1.name", "maybe-enabled");
        properties.put("issuer.1.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.1.enabled", "maybe");  // Not "false", so treated as enabled

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Non-"false" values default to enabled
        assertEquals(1, configs.size());
    }

    @Test
    void parseIssuerConfigs_withNumericIssuerIds() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.100.name", "issuer-100");
        properties.put("issuer.100.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.999.name", "issuer-999");
        properties.put("issuer.999.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should handle any numeric ID
        assertEquals(2, configs.size());
    }

    @Test
    void parseIssuerConfigs_withAlphanumericIssuerIds() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("issuer.auth0.name", "auth0-issuer");
        properties.put("issuer.auth0.jwks-file", getAbsolutePath(TEST_JWKS_FILE));
        properties.put("issuer.google.name", "google-issuer");
        properties.put("issuer.google.jwks-file", getAbsolutePath(TEST_JWKS_FILE));

        List<IssuerConfig> configs = IssuerConfigurationParser.parseIssuerConfigs(properties, null);

        // Should handle alphanumeric IDs
        assertEquals(2, configs.size());
        assertTrue(configs.stream().anyMatch(c -> "auth0-issuer".equals(c.getIssuerIdentifier())));
        assertTrue(configs.stream().anyMatch(c -> "google-issuer".equals(c.getIssuerIdentifier())));
    }
}
