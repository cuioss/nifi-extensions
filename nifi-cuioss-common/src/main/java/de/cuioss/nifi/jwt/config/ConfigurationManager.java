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

import de.cuioss.nifi.jwt.JwtLogMessages;
import de.cuioss.nifi.jwt.util.ErrorContext;
import de.cuioss.tools.logging.CuiLogger;
import lombok.Getter;
import org.jspecify.annotations.Nullable;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import org.yaml.snakeyaml.error.YAMLException;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.*;

/**
 * Manages configuration loading from static files and environment variables.
 */
public class ConfigurationManager {

    private static final CuiLogger LOGGER = new CuiLogger(ConfigurationManager.class);
    private static final String COMPONENT_NAME = "ConfigurationManager";
    private static final String CONFIG_PATH_PROPERTY = "jwt.Config.path";
    private static final String CONFIG_PATH_ENV = "JWT_CONFIG_PATH";
    private static final String DEFAULT_PROPERTIES_PATH = "conf/jwt-validation.properties";
    private static final String DEFAULT_YAML_PATH = "conf/jwt-validation.yml";
    private static final String ENV_PREFIX = "JWT_";
    private static final String ISSUER_ENV_PREFIX = "JWT_ISSUER_";
    private static final String JWT_VALIDATION_ISSUER_PREFIX = "jwt.validation.issuer.";

    @Nullable private File configFile;
    private long lastLoadedTimestamp = 0;
    @Getter private final Map<String, String> staticProperties = new HashMap<>();
    @Getter private final Map<String, Map<String, String>> issuerProperties = new HashMap<>();
    @Getter private boolean configurationLoaded = false;

    public ConfigurationManager() {
        loadConfiguration();
    }

    public void loadConfiguration() {
        staticProperties.clear();
        issuerProperties.clear();
        boolean fileLoaded = loadFromConfigFile();
        loadFromEnvironment();
        configurationLoaded = fileLoaded || !staticProperties.isEmpty() || !issuerProperties.isEmpty();
        if (configurationLoaded) {
            LOGGER.info(JwtLogMessages.INFO.CONFIG_LOADED);
        } else {
            LOGGER.info(JwtLogMessages.INFO.NO_EXTERNAL_CONFIG);
        }
    }

    public boolean checkAndReloadConfiguration() {
        if (configFile != null && configFile.exists()) {
            long lastModified = configFile.lastModified();
            if (lastModified > lastLoadedTimestamp) {
                LOGGER.info(JwtLogMessages.INFO.CONFIG_FILE_RELOADING, configFile);
                try {
                    loadConfiguration();
                    lastLoadedTimestamp = lastModified;
                    return true;
                } catch (IllegalStateException | IllegalArgumentException | YAMLException e) {
                    String contextMessage = ErrorContext.forComponent(COMPONENT_NAME)
                            .operation("checkAndReloadConfiguration")
                            .errorCode(ErrorContext.ErrorCodes.CONFIGURATION_ERROR)
                            .cause(e)
                            .build()
                            .with("configFile", configFile.getAbsolutePath())
                            .with("lastModified", lastModified)
                            .buildMessage("Failed to reload configuration, using previous configuration");
                    LOGGER.error(e, JwtLogMessages.ERROR.CONFIG_RELOAD_FAILED);
                    LOGGER.debug(contextMessage);
                }
            }
        }
        return false;
    }

    private boolean loadFromConfigFile() {
        String configPath = System.getProperty(CONFIG_PATH_PROPERTY);
        if (configPath == null || configPath.isEmpty()) {
            configPath = System.getenv(CONFIG_PATH_ENV);
        }
        if (configPath != null && !configPath.isEmpty()) {
            File file = new File(configPath);
            if (file.exists() && file.isFile()) {
                configFile = file;
                return loadConfigurationFile(file);
            } else {
                LOGGER.warn(JwtLogMessages.WARN.CONFIG_FILE_NOT_FOUND, configPath);
            }
        }
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
        LOGGER.info(JwtLogMessages.INFO.NO_CONFIG_FILE);
        return false;
    }

    private boolean loadConfigurationFile(File file) {
        String fileName = file.getName().toLowerCase();
        try {
            if (fileName.endsWith(".properties")) {
                loadPropertiesFile(file);
                lastLoadedTimestamp = file.lastModified();
                LOGGER.info(JwtLogMessages.INFO.LOADED_PROPERTIES_CONFIG, file.getAbsolutePath());
                return true;
            } else if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) {
                boolean loaded = loadYamlFile(file);
                if (loaded) {
                    lastLoadedTimestamp = file.lastModified();
                    LOGGER.info(JwtLogMessages.INFO.LOADED_YAML_CONFIG, file.getAbsolutePath());
                }
                return loaded;
            } else {
                LOGGER.warn(JwtLogMessages.WARN.UNSUPPORTED_CONFIG_FORMAT, fileName);
                return false;
            }
        } catch (IOException e) {
            LOGGER.error(e, JwtLogMessages.ERROR.CONFIG_FILE_IO_ERROR);
            LOGGER.debug(ErrorContext.forComponent(COMPONENT_NAME)
                    .operation("loadConfigurationFile")
                    .errorCode(ErrorContext.ErrorCodes.IO_ERROR)
                    .cause(e)
                    .build()
                    .with("file", file.getAbsolutePath())
                    .with("fileFormat", fileName.substring(fileName.lastIndexOf('.') + 1))
                    .buildMessage("Error loading configuration file"));
            return false;
        } catch (IllegalStateException | IllegalArgumentException | YAMLException e) {
            LOGGER.error(e, JwtLogMessages.ERROR.CONFIG_FILE_PARSE_ERROR);
            LOGGER.debug(ErrorContext.forComponent(COMPONENT_NAME)
                    .operation("loadConfigurationFile")
                    .errorCode(ErrorContext.ErrorCodes.CONFIGURATION_ERROR)
                    .cause(e)
                    .build()
                    .with("file", file.getAbsolutePath())
                    .with("fileFormat", fileName.substring(fileName.lastIndexOf('.') + 1))
                    .buildMessage("Error parsing configuration file"));
            return false;
        }
    }

    private void loadPropertiesFile(File file) throws IOException {
        Properties properties = new Properties();
        try (FileInputStream fis = new FileInputStream(file)) {
            properties.load(fis);
        }
        for (String key : properties.stringPropertyNames()) {
            String value = properties.getProperty(key);
            if (key.startsWith(JWT_VALIDATION_ISSUER_PREFIX)) {
                parseIssuerProperty(key, value);
            } else {
                staticProperties.put(key, value);
            }
        }
    }

    private boolean loadYamlFile(File file) throws IOException {
        Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions()));
        Map<String, Object> yamlData;
        try (FileInputStream fis = new FileInputStream(file)) {
            yamlData = yaml.load(fis);
        }
        if (yamlData == null || yamlData.isEmpty()) {
            LOGGER.warn(JwtLogMessages.WARN.YAML_EMPTY_OR_INVALID, file.getAbsolutePath());
            return false;
        }
        processYamlData(yamlData, "");
        return true;
    }

    @SuppressWarnings("unchecked")
    private void processYamlData(Map<String, Object> data, String prefix) {
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            String fullKey = prefix.isEmpty() ? key : prefix + "." + key;
            if (value instanceof Map) {
                processYamlData((Map<String, Object>) value, fullKey);
            } else if (value instanceof List<?> list) {
                processList(fullKey, list);
            } else if (value != null) {
                if (fullKey.startsWith(JWT_VALIDATION_ISSUER_PREFIX)) {
                    parseIssuerProperty(fullKey, value.toString());
                } else {
                    staticProperties.put(fullKey, value.toString());
                }
            }
        }
    }

    private boolean isIssuerListKey(String key) {
        return "jwt.validation.issuers".equals(key) || "issuers".equals(key);
    }

    private String getIssuerId(Map<String, Object> issuerConfig, int index) {
        if (issuerConfig.containsKey("id")) return issuerConfig.get("id").toString();
        if (issuerConfig.containsKey("name")) return issuerConfig.get("name").toString();
        return String.valueOf(index);
    }

    private void storeIssuerProperties(String issuerId, Map<String, Object> issuerConfig) {
        Map<String, String> issuerProps = issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>());
        for (Map.Entry<String, Object> issuerEntry : issuerConfig.entrySet()) {
            if (issuerEntry.getValue() != null) {
                issuerProps.put(issuerEntry.getKey(), issuerEntry.getValue().toString());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void processIssuerItem(Object item, int index) {
        if (item instanceof Map) {
            Map<String, Object> issuerConfig = (Map<String, Object>) item;
            String issuerId = getIssuerId(issuerConfig, index);
            storeIssuerProperties(issuerId, issuerConfig);
        }
    }

    private void processIssuerList(List<?> list) {
        for (int i = 0; i < list.size(); i++) {
            processIssuerItem(list.get(i), i);
        }
    }

    private void processGenericList(String key, List<?> list) {
        String listValue = list.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .reduce((a, b) -> a + "," + b)
                .orElse("");
        staticProperties.put(key, listValue);
    }

    @SuppressWarnings("unchecked")
    private void processList(String key, List<?> list) {
        if (isIssuerListKey(key)) {
            processIssuerList(list);
        } else {
            processGenericList(key, list);
        }
    }

    private void parseIssuerProperty(String key, String value) {
        String issuerPart = key.substring(JWT_VALIDATION_ISSUER_PREFIX.length());
        int dotIndex = issuerPart.indexOf('.');
        if (dotIndex > 0) {
            String issuerId = issuerPart.substring(0, dotIndex);
            String propertyName = issuerPart.substring(dotIndex + 1);
            issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>())
                    .put(propertyName, value);
        }
    }

    private void loadFromEnvironment() {
        Map<String, String> env = System.getenv();
        for (Map.Entry<String, String> entry : env.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if (key.startsWith(ISSUER_ENV_PREFIX)) {
                parseIssuerEnvironmentVariable(key, value);
            } else if (key.startsWith(ENV_PREFIX)) {
                parseGeneralEnvironmentVariable(key, value);
            }
        }
    }

    private void parseIssuerEnvironmentVariable(String key, String value) {
        String issuerPart = key.substring(ISSUER_ENV_PREFIX.length());
        int underscoreIndex = issuerPart.indexOf('_');
        if (underscoreIndex > 0) {
            String issuerId = issuerPart.substring(0, underscoreIndex).toLowerCase();
            String propertyName = convertEnvToPropertyName(issuerPart.substring(underscoreIndex + 1));
            issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>())
                    .put(propertyName, value);
        }
    }

    private void parseGeneralEnvironmentVariable(String key, String value) {
        String propertyName = convertEnvToPropertyName(key.substring(ENV_PREFIX.length()));
        staticProperties.put("jwt.validation." + propertyName, value);
    }

    private String convertEnvToPropertyName(String envName) {
        return envName.toLowerCase().replace('_', '.');
    }

    public String getProperty(String key) {
        return staticProperties.get(key);
    }

    public String getProperty(String key, String defaultValue) {
        return staticProperties.getOrDefault(key, defaultValue);
    }

    public List<String> getIssuerIds() {
        return new ArrayList<>(issuerProperties.keySet());
    }

    public Map<String, String> getIssuerProperties(String issuerId) {
        return issuerProperties.getOrDefault(issuerId, new HashMap<>());
    }
}
