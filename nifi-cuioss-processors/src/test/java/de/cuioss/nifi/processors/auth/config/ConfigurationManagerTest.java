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

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ConfigurationManager.
 */
class ConfigurationManagerTest {

    @TempDir
    Path tempDir;

    private ConfigurationManager configManager;
    private String originalConfigPath;

    @BeforeEach
    void setUp() {
        // Save original system property
        originalConfigPath = System.getProperty("jwt.Config.path");
        configManager = null;
    }

    @AfterEach
    void tearDown() {
        // Restore original system property
        if (originalConfigPath != null) {
            System.setProperty("jwt.Config.path", originalConfigPath);
        } else {
            System.clearProperty("jwt.Config.path");
        }
    }

    @Test
    void testLoadYamlConfiguration() throws IOException {
        // Create a test YAML file
        String yamlContent = """
            jwt:
              validation:
                enabled: true
                clockSkew: 60
                issuers:
                  - id: issuer1
                    name: Test Issuer 1
                    jwksUri: https://example.com/jwks1
                    audience: api1
                  - id: issuer2
                    name: Test Issuer 2
                    jwksUri: https://example.com/jwks2
                    audience: api2
            """;

        File yamlFile = tempDir.resolve("jwt-validation.yml").toFile();
        Files.writeString(yamlFile.toPath(), yamlContent);

        // Set system property to point to test file
        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());

        // Create configuration manager
        configManager = new ConfigurationManager();

        // Verify configuration was loaded
        assertTrue(configManager.isConfigurationLoaded());

        // Check static properties
        assertEquals("true", configManager.getProperty("jwt.validation.enabled"));
        assertEquals("60", configManager.getProperty("jwt.validation.clockSkew"));

        // Check issuer properties
        assertEquals(2, configManager.getIssuerIds().size());

        Map<String, String> issuer1 = configManager.getIssuerProperties("issuer1");
        assertEquals("issuer1", issuer1.get("id"));
        assertEquals("Test Issuer 1", issuer1.get("name"));
        assertEquals("https://example.com/jwks1", issuer1.get("jwksUri"));
        assertEquals("api1", issuer1.get("audience"));

        Map<String, String> issuer2 = configManager.getIssuerProperties("issuer2");
        assertEquals("issuer2", issuer2.get("id"));
        assertEquals("Test Issuer 2", issuer2.get("name"));
        assertEquals("https://example.com/jwks2", issuer2.get("jwksUri"));
        assertEquals("api2", issuer2.get("audience"));
    }

    @Test
    void testLoadYamlConfigurationWithoutIds() throws IOException {
        // Create a test YAML file without explicit IDs
        String yamlContent = """
            jwt:
              validation:
                issuers:
                  - name: Test Issuer 1
                    jwksUri: https://example.com/jwks1
                  - jwksUri: https://example.com/jwks2
                    audience: api2
            """;

        File yamlFile = tempDir.resolve("jwt-validation.yml").toFile();
        Files.writeString(yamlFile.toPath(), yamlContent);

        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());
        configManager = new ConfigurationManager();

        // First issuer should use name as ID
        Map<String, String> issuer1 = configManager.getIssuerProperties("Test Issuer 1");
        assertEquals("Test Issuer 1", issuer1.get("name"));
        assertEquals("https://example.com/jwks1", issuer1.get("jwksUri"));

        // Second issuer should use index as ID
        Map<String, String> issuer2 = configManager.getIssuerProperties("1");
        assertEquals("https://example.com/jwks2", issuer2.get("jwksUri"));
        assertEquals("api2", issuer2.get("audience"));
    }

    @Test
    void testLoadNestedYamlConfiguration() throws IOException {
        // Create a test YAML file with nested structure
        String yamlContent = """
            jwt:
              validation:
                security:
                  algorithms:
                    - RS256
                    - ES256
                  keySize: 2048
                cache:
                  enabled: true
                  ttl: 300
            """;

        File yamlFile = tempDir.resolve("jwt-validation.yml").toFile();
        Files.writeString(yamlFile.toPath(), yamlContent);

        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());
        configManager = new ConfigurationManager();

        // Check nested properties
        assertEquals("RS256,ES256", configManager.getProperty("jwt.validation.security.algorithms"));
        assertEquals("2048", configManager.getProperty("jwt.validation.security.keySize"));
        assertEquals("true", configManager.getProperty("jwt.validation.cache.enabled"));
        assertEquals("300", configManager.getProperty("jwt.validation.cache.ttl"));
    }

    @Test
    void testEmptyYamlFile() throws IOException {
        // Create an empty YAML file
        File yamlFile = tempDir.resolve("empty.yml").toFile();
        Files.writeString(yamlFile.toPath(), "");

        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());
        configManager = new ConfigurationManager();

        // Should handle gracefully
        assertFalse(configManager.isConfigurationLoaded());
    }

    @Test
    void testInvalidYamlFile() throws IOException {
        // Create an invalid YAML file
        String invalidYaml = """
            jwt:
              validation:
                - this is invalid
              : also invalid
            """;

        File yamlFile = tempDir.resolve("invalid.yml").toFile();
        Files.writeString(yamlFile.toPath(), invalidYaml);

        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());

        // Should not throw, but log error
        assertDoesNotThrow(() -> {
            configManager = new ConfigurationManager();
        });
        assertFalse(configManager.isConfigurationLoaded());
    }

    @Test
    void testYamlReload() throws IOException {
        // Create initial YAML file
        String initialYaml = """
            jwt:
              validation:
                enabled: true
            """;

        File yamlFile = tempDir.resolve("reload.yml").toFile();
        Files.writeString(yamlFile.toPath(), initialYaml);

        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());
        configManager = new ConfigurationManager();

        assertEquals("true", configManager.getProperty("jwt.validation.enabled"));
        assertNull(configManager.getProperty("jwt.validation.newProperty"));

        // Modify the file
        try {
            Thread.sleep(100); // Ensure file timestamp changes
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        String updatedYaml = """
            jwt:
              validation:
                enabled: false
                newProperty: added
            """;
        Files.writeString(yamlFile.toPath(), updatedYaml);

        // Check and reload
        assertTrue(configManager.checkAndReloadConfiguration());

        // Verify updated values
        assertEquals("false", configManager.getProperty("jwt.validation.enabled"));
        assertEquals("added", configManager.getProperty("jwt.validation.newProperty"));
    }

    @Test
    void testAlternativeYamlStructure() throws IOException {
        // Test with a flatter YAML structure
        String yamlContent = """
            issuers:
              - id: google
                jwksUri: https://www.googleapis.com/oauth2/v3/certs
                issuer: https://accounts.google.com
              - id: auth0
                jwksUri: https://example.auth0.com/.well-known/jwks.json
                issuer: https://example.auth0.com/
            clockSkew: 30
            enabled: true
            """;

        File yamlFile = tempDir.resolve("flat.yml").toFile();
        Files.writeString(yamlFile.toPath(), yamlContent);

        System.setProperty("jwt.Config.path", yamlFile.getAbsolutePath());
        configManager = new ConfigurationManager();

        // Check properties
        assertEquals("30", configManager.getProperty("clockSkew"));
        assertEquals("true", configManager.getProperty("enabled"));

        // Check issuers
        Map<String, String> google = configManager.getIssuerProperties("google");
        assertEquals("https://www.googleapis.com/oauth2/v3/certs", google.get("jwksUri"));
        assertEquals("https://accounts.google.com", google.get("issuer"));
    }
}