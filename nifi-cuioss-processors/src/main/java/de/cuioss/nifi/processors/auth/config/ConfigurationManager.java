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

import de.cuioss.nifi.processors.auth.util.ErrorContext;
import de.cuioss.tools.logging.CuiLogger;
import lombok.Getter;
import org.yaml.snakeyaml.Yaml;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.*;

/**
 * Manages configuration for the MultiIssuerJWTTokenAuthenticator processor.
 * Handles loading configuration from static files and environment variables.
 */
public class ConfigurationManager {

    private static final CuiLogger LOGGER = new CuiLogger(ConfigurationManager.class);
    private static final String COMPONENT_NAME = "ConfigurationManager";

    // System property and environment variable names
    private static final String CONFIG_PATH_PROPERTY = "jwt.Config.path";
    private static final String CONFIG_PATH_ENV = "JWT_CONFIG_PATH";

    // Default configuration file paths
    private static final String DEFAULT_PROPERTIES_PATH = "conf/jwt-validation.properties";
    private static final String DEFAULT_YAML_PATH = "conf/jwt-validation.yml";

    // Environment variable prefixes
    private static final String ENV_PREFIX = "JWT_";
    private static final String ISSUER_ENV_PREFIX = "JWT_ISSUER_";
    private static final String JWT_VALIDATION_ISSUER_PREFIX = "jwt.validation.issuer.";

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
                } catch (RuntimeException e) {
                    // Catch configuration loading errors (IOException wrapped in RuntimeException, parsing errors, etc.)
                    String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                            .operation("checkAndReloadConfiguration")
                            .errorCode(ErrorContext.ErrorCodes.CONFIGURATION_ERROR)
                            .cause(e)
                            .build()
                            .with("configFile", configFile.getAbsolutePath())
                            .with("lastModified", lastModified)
                            .buildMessage("Failed to reload configuration, using previous configuration");

                    LOGGER.error(e, contextMessage);
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
                boolean loaded = loadYamlFile(file);
                if (loaded) {
                    lastLoadedTimestamp = file.lastModified();
                    LOGGER.info("Loaded YAML configuration from %s", file.getAbsolutePath());
                }
                return loaded;
            } else {
                LOGGER.warn("Unsupported configuration file format: %s", fileName);
                return false;
            }
        } catch (java.io.IOException e) {
            // Catch file I/O errors
            String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                    .operation("loadConfigurationFile")
                    .errorCode(ErrorContext.ErrorCodes.IO_ERROR)
                    .cause(e)
                    .build()
                    .with("file", file.getAbsolutePath())
                    .with("fileFormat", fileName.substring(fileName.lastIndexOf('.') + 1))
                    .buildMessage("Error loading configuration file");

            LOGGER.error(e, contextMessage);
            return false;
        } catch (RuntimeException e) {
            // Catch parsing and other runtime errors
            String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                    .operation("loadConfigurationFile")
                    .errorCode(ErrorContext.ErrorCodes.CONFIGURATION_ERROR)
                    .cause(e)
                    .build()
                    .with("file", file.getAbsolutePath())
                    .with("fileFormat", fileName.substring(fileName.lastIndexOf('.') + 1))
                    .buildMessage("Error parsing configuration file");

            LOGGER.error(e, contextMessage);
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

            if (key.startsWith(JWT_VALIDATION_ISSUER_PREFIX)) {
                // Parse issuer properties
                parseIssuerProperty(key, value);
            } else {
                // Store static property
                staticProperties.put(key, value);
            }
        }
    }

    /**
     * Loads configuration from a YAML file.
     *
     * @param file the YAML file
     * @return true if configuration was loaded successfully, false otherwise
     * @throws IOException if an I/O error occurs
     */
    @SuppressWarnings("unchecked")
    private boolean loadYamlFile(File file) throws IOException {
        Yaml yaml = new Yaml();
        Map<String, Object> yamlData;

        try (FileInputStream fis = new FileInputStream(file)) {
            yamlData = yaml.load(fis);
        }

        if (yamlData == null || yamlData.isEmpty()) {
            LOGGER.warn("YAML file %s is empty or invalid", file.getAbsolutePath());
            return false;
        }

        // Process YAML data
        processYamlData(yamlData, "");
        return true;
    }

    /**
     * Recursively processes YAML data and stores properties.
     *
     * @param data the YAML data map
     * @param prefix the current property prefix
     */
    @SuppressWarnings("unchecked")
    private void processYamlData(Map<String, Object> data, String prefix) {
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            String fullKey = prefix.isEmpty() ? key : prefix + "." + key;

            if (value instanceof Map) {
                // Recursively process nested maps
                processYamlData((Map<String, Object>) value, fullKey);
            } else if (value instanceof List<?> list) {
                // Process lists (typically for issuer configurations)
                processList(fullKey, list);
            } else if (value != null) {
                // Store simple values
                if (fullKey.startsWith(JWT_VALIDATION_ISSUER_PREFIX)) {
                    parseIssuerProperty(fullKey, value.toString());
                } else {
                    staticProperties.put(fullKey, value.toString());
                }
            }
        }
    }

    /**
     * Check if key represents an issuer list.
     *
     * @param key the property key
     * @return true if issuer list key
     */
    private boolean isIssuerListKey(String key) {
        return "jwt.validation.issuers".equals(key) || "issuers".equals(key);
    }

    /**
     * Get issuer ID from config or use index.
     *
     * @param issuerConfig the issuer configuration map
     * @param index the list index
     * @return the issuer ID
     */
    @SuppressWarnings("unchecked")
    private String getIssuerId(Map<String, Object> issuerConfig, int index) {
        if (issuerConfig.containsKey("id")) {
            return issuerConfig.get("id").toString();
        }
        if (issuerConfig.containsKey("name")) {
            return issuerConfig.get("name").toString();
        }
        return String.valueOf(index);
    }

    /**
     * Store issuer properties from config map.
     *
     * @param issuerId the issuer ID
     * @param issuerConfig the issuer configuration map
     */
    private void storeIssuerProperties(String issuerId, Map<String, Object> issuerConfig) {
        Map<String, String> issuerProps = issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>());
        for (Map.Entry<String, Object> issuerEntry : issuerConfig.entrySet()) {
            if (issuerEntry.getValue() != null) {
                issuerProps.put(issuerEntry.getKey(), issuerEntry.getValue().toString());
            }
        }
    }

    /**
     * Process single issuer item from list.
     *
     * @param item the list item
     * @param index the list index
     */
    @SuppressWarnings("unchecked")
    private void processIssuerItem(Object item, int index) {
        if (item instanceof Map) {
            Map<String, Object> issuerConfig = (Map<String, Object>) item;
            String issuerId = getIssuerId(issuerConfig, index);
            storeIssuerProperties(issuerId, issuerConfig);
        }
    }

    /**
     * Process issuer list from YAML.
     *
     * @param list the issuer list
     */
    private void processIssuerList(List<?> list) {
        for (int i = 0; i < list.size(); i++) {
            processIssuerItem(list.get(i), i);
        }
    }

    /**
     * Process non-issuer list as comma-separated values.
     *
     * @param key the property key
     * @param list the list value
     */
    private void processGenericList(String key, List<?> list) {
        String listValue = list.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .reduce((a, b) -> a + "," + b)
                .orElse("");
        staticProperties.put(key, listValue);
    }

    /**
     * Processes a list from YAML configuration.
     *
     * @param key the property key
     * @param list the list value
     */
    @SuppressWarnings("unchecked")
    private void processList(String key, List<?> list) {
        if (isIssuerListKey(key)) {
            processIssuerList(list);
        } else {
            processGenericList(key, list);
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
        String issuerPart = key.substring(JWT_VALIDATION_ISSUER_PREFIX.length());
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