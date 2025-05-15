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

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;


import lombok.Getter;

import de.cuioss.tools.logging.CuiLogger;

/**
 * Manages configuration for the MultiIssuerJWTTokenAuthenticator processor.
 * Handles loading configuration from static files and environment variables.
 */
public class ConfigurationManager {

    private static final CuiLogger LOGGER = new CuiLogger(ConfigurationManager.class);

    // System property and environment variable names
    private static final String CONFIG_PATH_PROPERTY = "jwt.config.path";
    private static final String CONFIG_PATH_ENV = "JWT_CONFIG_PATH";

    // Default configuration file paths
    private static final String DEFAULT_PROPERTIES_PATH = "conf/jwt-validation.properties";
    private static final String DEFAULT_YAML_PATH = "conf/jwt-validation.yml";

    // Environment variable prefixes
    private static final String ENV_PREFIX = "JWT_";
    private static final String ISSUER_ENV_PREFIX = "JWT_ISSUER_";

    // Configuration file and timestamp
    private File configFile;
    private long lastLoadedTimestamp = 0;

    // Configuration storage
    @Getter
    private final Map<String, String> staticProperties = new HashMap<>();

    @Getter
    private final Map<String, Map<String, String>> issuerProperties = new HashMap<>();

    @Getter
    private boolean configurationLoaded = false;

    /**
     * Creates a new ConfigurationManager and loads configuration from available sources.
     */
    public ConfigurationManager() {
        loadConfiguration();
    }

    /**
     * Loads configuration from all available sources.
     */
    public void loadConfiguration() {
        // Clear existing configuration
        staticProperties.clear();
        issuerProperties.clear();

        // Try to load from configuration file
        boolean fileLoaded = loadFromConfigFile();

        // Load from environment variables
        loadFromEnvironment();

        // Set configuration loaded flag
        configurationLoaded = fileLoaded || !staticProperties.isEmpty() || !issuerProperties.isEmpty();

        if (configurationLoaded) {
            LOGGER.info("Configuration loaded successfully");
        } else {
            LOGGER.info("No external configuration found, using UI configuration");
        }
    }

    /**
     * Checks if the configuration file has been modified and reloads if necessary.
     * 
     * @return true if configuration was reloaded, false otherwise
     */
    public boolean checkAndReloadConfiguration() {
        if (configFile != null && configFile.exists()) {
            long lastModified = configFile.lastModified();
            if (lastModified > lastLoadedTimestamp) {
                LOGGER.info("Configuration file %s has been modified, reloading", configFile);
                try {
                    loadConfiguration();
                    lastLoadedTimestamp = lastModified;
                    return true;
                } catch (Exception e) {
                    LOGGER.error(e, "Failed to reload configuration, using previous configuration");
                }
            }
        }
        return false;
    }

    /**
     * Attempts to load configuration from a file.
     * 
     * @return true if configuration was loaded from a file, false otherwise
     */
    private boolean loadFromConfigFile() {
        // Try to find configuration file
        String configPath = System.getProperty(CONFIG_PATH_PROPERTY);
        if (configPath == null || configPath.isEmpty()) {
            configPath = System.getenv(CONFIG_PATH_ENV);
        }

        if (configPath != null && !configPath.isEmpty()) {
            // Try to load from specified path
            File file = new File(configPath);
            if (file.exists() && file.isFile()) {
                configFile = file;
                return loadConfigurationFile(file);
            } else {
                LOGGER.warn("Configuration file not found at specified path: %s", configPath);
            }
        }

        // Try default locations
        File propertiesFile = new File(DEFAULT_PROPERTIES_PATH);
        if (propertiesFile.exists() && propertiesFile.isFile()) {
            configFile = propertiesFile;
            return loadConfigurationFile(propertiesFile);
        }

        File yamlFile = new File(DEFAULT_YAML_PATH);
        if (yamlFile.exists() && yamlFile.isFile()) {
            configFile = yamlFile;
            return loadConfigurationFile(yamlFile);
        }

        LOGGER.info("No configuration file found");
        return false;
    }

    /**
     * Loads configuration from a specific file.
     * 
     * @param file the configuration file
     * @return true if configuration was loaded successfully, false otherwise
     */
    private boolean loadConfigurationFile(File file) {
        String fileName = file.getName().toLowerCase();
        try {
            if (fileName.endsWith(".properties")) {
                loadPropertiesFile(file);
                lastLoadedTimestamp = file.lastModified();
                LOGGER.info("Loaded properties configuration from %s", file.getAbsolutePath());
                return true;
            } else if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) {
                LOGGER.warn("YAML configuration not yet implemented, skipping %s", file.getAbsolutePath());
                // TODO: Implement YAML configuration loading
                return false;
            } else {
                LOGGER.warn("Unsupported configuration file format: %s", fileName);
                return false;
            }
        } catch (Exception e) {
            LOGGER.error(e, "Error loading configuration from %s", file.getAbsolutePath());
            return false;
        }
    }

    /**
     * Loads configuration from a properties file.
     * 
     * @param file the properties file
     * @throws IOException if an I/O error occurs
     */
    private void loadPropertiesFile(File file) throws IOException {
        Properties properties = new Properties();
        try (FileInputStream fis = new FileInputStream(file)) {
            properties.load(fis);
        }

        // Process properties
        for (String key : properties.stringPropertyNames()) {
            String value = properties.getProperty(key);

            if (key.startsWith("jwt.validation.issuer.")) {
                // Parse issuer properties
                parseIssuerProperty(key, value);
            } else {
                // Store static property
                staticProperties.put(key, value);
            }
        }
    }

    /**
     * Parses an issuer property from a properties file.
     * 
     * @param key the property key
     * @param value the property value
     */
    private void parseIssuerProperty(String key, String value) {
        // Format: jwt.validation.issuer.<index>.<property>
        // or: jwt.validation.issuer.<name>.<property>
        String issuerPart = key.substring("jwt.validation.issuer.".length());
        int dotIndex = issuerPart.indexOf('.');

        if (dotIndex > 0) {
            String issuerId = issuerPart.substring(0, dotIndex);
            String propertyName = issuerPart.substring(dotIndex + 1);

            // Store in issuer properties map
            issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>())
                    .put(propertyName, value);
        }
    }

    /**
     * Loads configuration from environment variables.
     */
    private void loadFromEnvironment() {
        Map<String, String> env = System.getenv();

        for (Map.Entry<String, String> entry : env.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();

            if (key.startsWith(ISSUER_ENV_PREFIX)) {
                // Parse issuer environment variables
                parseIssuerEnvironmentVariable(key, value);
            } else if (key.startsWith(ENV_PREFIX)) {
                // Parse general environment variables
                parseGeneralEnvironmentVariable(key, value);
            }
        }
    }

    /**
     * Parses an issuer environment variable.
     * 
     * @param key the environment variable name
     * @param value the environment variable value
     */
    private void parseIssuerEnvironmentVariable(String key, String value) {
        // Format: JWT_ISSUER_<NAME>_<PROPERTY>
        String issuerPart = key.substring(ISSUER_ENV_PREFIX.length());
        int underscoreIndex = issuerPart.indexOf('_');

        if (underscoreIndex > 0) {
            String issuerId = issuerPart.substring(0, underscoreIndex).toLowerCase();
            String propertyName = convertEnvToPropertyName(issuerPart.substring(underscoreIndex + 1));

            // Store in issuer properties map
            issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>())
                    .put(propertyName, value);
        }
    }

    /**
     * Parses a general environment variable.
     * 
     * @param key the environment variable name
     * @param value the environment variable value
     */
    private void parseGeneralEnvironmentVariable(String key, String value) {
        // Format: JWT_<PROPERTY>
        String propertyName = convertEnvToPropertyName(key.substring(ENV_PREFIX.length()));

        // Store in static properties map
        staticProperties.put("jwt.validation." + propertyName, value);
    }

    /**
     * Converts an environment variable name to a property name.
     * 
     * @param envName the environment variable name
     * @return the property name
     */
    private String convertEnvToPropertyName(String envName) {
        return envName.toLowerCase().replace('_', '.');
    }

    /**
     * Gets a static property value.
     * 
     * @param key the property key
     * @return the property value, or null if not found
     */
    public String getProperty(String key) {
        return staticProperties.get(key);
    }

    /**
     * Gets a static property value with a default value.
     * 
     * @param key the property key
     * @param defaultValue the default value
     * @return the property value, or the default value if not found
     */
    public String getProperty(String key, String defaultValue) {
        return staticProperties.getOrDefault(key, defaultValue);
    }

    /**
     * Gets all issuer IDs from the configuration.
     * 
     * @return a list of issuer IDs
     */
    public List<String> getIssuerIds() {
        return new ArrayList<>(issuerProperties.keySet());
    }

    /**
     * Gets all properties for an issuer.
     * 
     * @param issuerId the issuer ID
     * @return a map of properties for the issuer, or an empty map if not found
     */
    public Map<String, String> getIssuerProperties(String issuerId) {
        return issuerProperties.getOrDefault(issuerId, new HashMap<>());
    }
}