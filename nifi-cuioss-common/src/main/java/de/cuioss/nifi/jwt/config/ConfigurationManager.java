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
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;
import java.util.stream.Collectors;

/**
 * Manages configuration loading from static files and environment variables.
 */
public class ConfigurationManager {

    private static final CuiLogger LOGGER = new CuiLogger(ConfigurationManager.class);
    private static final String COMPONENT_NAME = "ConfigurationManager";
    private static final String DEFAULT_PROPERTIES_PATH = "conf/cui-nifi-extensions.properties";
    private static final String DEFAULT_YAML_PATH = "conf/cui-nifi-extensions.yml";
    private static final String ENV_PREFIX = "JWT_";
    private static final String ISSUER_ENV_PREFIX = "JWT_ISSUER_";
    private static final String JWT_VALIDATION_ISSUER_PREFIX = "jwt.validation.issuer.";

    @Nullable private File configFile;
    private long lastLoadedTimestamp = 0;
    // The property maps are mutated under the instance monitor by loadConfiguration()/
    // checkAndReloadConfiguration() and read by the synchronized getters below, establishing
    // the happens-before edge the concurrent reload path needs.
    private final Map<String, String> staticProperties = new HashMap<>();
    private final Map<String, Map<String, String>> issuerProperties = new HashMap<>();
    @Getter private volatile boolean configurationLoaded = false;
    private final String basePath;
    /**
     * The environment this manager reads {@code JWT_*} configuration from. Production always
     * supplies the real process environment; the package-private constructor below lets tests
     * pin it to a controlled map so env-driven behaviour is deterministic regardless of what the
     * developer happens to have exported.
     */
    private final Map<String, String> environment;

    private enum FileLoadResult {NO_FILE, LOADED, FAILED}

    public ConfigurationManager() {
        this("");
    }

    public ConfigurationManager(String basePath) {
        this(basePath, System.getenv());
    }

    /**
     * Test seam: builds a manager over an explicit environment map instead of the ambient process
     * environment. Package-private on purpose — this is the minimum needed to make the {@code JWT_*}
     * handling testable, not a general configuration abstraction.
     *
     * @param basePath    the configuration base path
     * @param environment the environment variables to read
     */
    ConfigurationManager(String basePath, Map<String, String> environment) {
        this.basePath = normalizeBasePath(basePath);
        this.environment = Map.copyOf(environment);
        loadConfiguration();
    }

    /**
     * Ensures a non-empty base path ends with a separator so it composes correctly with the
     * relative default config paths (e.g. {@code /etc/nifi} becomes {@code /etc/nifi/}). An
     * empty base path is left untouched so the defaults resolve against the working directory.
     */
    private static String normalizeBasePath(String basePath) {
        if (basePath.isEmpty() || basePath.endsWith("/") || basePath.endsWith(File.separator)) {
            return basePath;
        }
        return basePath + File.separator;
    }

    /**
     * Loads (or reloads) the configuration from the config file and environment.
     * If a config file exists but cannot be parsed, the previously loaded
     * configuration is kept instead of running with a wiped state.
     *
     * @return {@code true} if loading succeeded (or no file exists), {@code false}
     *         if a present config file failed to load and the previous configuration was kept
     */
    public synchronized boolean loadConfiguration() {
        Map<String, String> previousStatic = new HashMap<>(staticProperties);
        Map<String, Map<String, String>> previousIssuers = copyIssuerProperties();
        boolean previouslyLoaded = configurationLoaded;

        staticProperties.clear();
        issuerProperties.clear();
        FileLoadResult result = loadFromConfigFile();
        if (result == FileLoadResult.FAILED && previouslyLoaded) {
            // Restore the previous configuration rather than wiping the running state
            staticProperties.clear();
            issuerProperties.clear();
            staticProperties.putAll(previousStatic);
            issuerProperties.putAll(previousIssuers);
            LOGGER.error(JwtLogMessages.ERROR.CONFIG_RELOAD_FAILED);
            return false;
        }
        loadFromEnvironment();
        configurationLoaded = result == FileLoadResult.LOADED
                || !staticProperties.isEmpty() || !issuerProperties.isEmpty();
        if (result == FileLoadResult.FAILED) {
            // A present config file failed to parse and there was no previous config to keep.
            // Environment variables may still have supplied config, but never claim a clean
            // "loaded successfully" — surface the parse failure instead.
            LOGGER.warn(JwtLogMessages.WARN.CONFIG_FILE_PARSE_FALLBACK);
        } else if (configurationLoaded) {
            LOGGER.info(JwtLogMessages.INFO.CONFIG_LOADED);
        } else {
            LOGGER.info(JwtLogMessages.INFO.NO_EXTERNAL_CONFIG);
        }
        return result != FileLoadResult.FAILED;
    }

    private Map<String, Map<String, String>> copyIssuerProperties() {
        Map<String, Map<String, String>> copy = new HashMap<>();
        issuerProperties.forEach((issuerId, props) -> copy.put(issuerId, new HashMap<>(props)));
        return copy;
    }

    public synchronized boolean checkAndReloadConfiguration() {
        if (configFile != null && configFile.exists()) {
            long lastModified = configFile.lastModified();
            if (lastModified > lastLoadedTimestamp) {
                LOGGER.info(JwtLogMessages.INFO.CONFIG_FILE_RELOADING, configFile);
                // loadConfiguration keeps the previous configuration on failure; the
                // timestamp is only advanced on success so the next check retries.
                if (loadConfiguration()) {
                    lastLoadedTimestamp = lastModified;
                    return true;
                }
            }
        }
        return false;
    }

    private FileLoadResult loadFromConfigFile() {
        File propertiesFile = new File(basePath + DEFAULT_PROPERTIES_PATH);
        if (propertiesFile.exists() && propertiesFile.isFile()) {
            configFile = propertiesFile;
            return loadConfigurationFile(propertiesFile) ? FileLoadResult.LOADED : FileLoadResult.FAILED;
        }
        File yamlFile = new File(basePath + DEFAULT_YAML_PATH);
        if (yamlFile.exists() && yamlFile.isFile()) {
            configFile = yamlFile;
            return loadConfigurationFile(yamlFile) ? FileLoadResult.LOADED : FileLoadResult.FAILED;
        }
        LOGGER.info(JwtLogMessages.INFO.NO_CONFIG_FILE);
        return FileLoadResult.NO_FILE;
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
        Object id = issuerConfig.get("id");
        if (id != null) {
            return id.toString();
        }
        Object name = issuerConfig.get("name");
        if (name != null) {
            return name.toString();
        }
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

    private void processList(String key, List<?> list) {
        if (isIssuerListKey(key)) {
            for (int i = 0; i < list.size(); i++) {
                if (list.get(i) instanceof Map) {
                    @SuppressWarnings("unchecked")
                    final Map<String, Object> issuerConfig = (Map<String, Object>) list.get(i);
                    final String issuerId = getIssuerId(issuerConfig, i);
                    storeIssuerProperties(issuerId, issuerConfig);
                }
            }
        } else {
            String listValue = list.stream()
                    .filter(Objects::nonNull)
                    .map(Object::toString)
                    .collect(Collectors.joining(","));
            staticProperties.put(key, listValue);
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
        for (Map.Entry<String, String> entry : environment.entrySet()) {
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
            String issuerId = issuerPart.substring(0, underscoreIndex).toLowerCase(Locale.ROOT);
            String propertyName = convertEnvToIssuerPropertyName(issuerPart.substring(underscoreIndex + 1));
            issuerProperties.computeIfAbsent(issuerId, k -> new HashMap<>())
                    .put(propertyName, value);
        }
    }

    private void parseGeneralEnvironmentVariable(String key, String value) {
        String propertyName = convertEnvToPropertyName(key.substring(ENV_PREFIX.length()));
        staticProperties.put("jwt.validation." + propertyName, value);
    }

    private String convertEnvToPropertyName(String envName) {
        return envName.toLowerCase(Locale.ROOT).replace('_', '.');
    }

    /**
     * Converts an issuer environment-variable suffix (e.g. {@code JWKS_URL}) to the
     * dash-separated key the {@link IssuerConfigurationParser} expects
     * (e.g. {@code jwks-url}). General (non-issuer) keys keep the dotted convention.
     */
    private String convertEnvToIssuerPropertyName(String envName) {
        return envName.toLowerCase(Locale.ROOT).replace('_', '-');
    }

    /**
     * Returns an unmodifiable snapshot of the static (non-issuer) configuration properties.
     * The snapshot decouples callers from concurrent reloads that clear and repopulate the map.
     */
    public synchronized Map<String, String> getStaticProperties() {
        return Collections.unmodifiableMap(new HashMap<>(staticProperties));
    }

    /**
     * Returns an unmodifiable snapshot of all issuer configuration properties; neither the
     * outer map nor the inner per-issuer maps are modifiable by callers.
     */
    public synchronized Map<String, Map<String, String>> getIssuerProperties() {
        Map<String, Map<String, String>> view = new HashMap<>();
        issuerProperties.forEach((issuerId, props) ->
                view.put(issuerId, Collections.unmodifiableMap(new HashMap<>(props))));
        return Collections.unmodifiableMap(view);
    }

    public synchronized Optional<String> getProperty(String key) {
        return Optional.ofNullable(staticProperties.get(key));
    }

    public synchronized String getProperty(String key, String defaultValue) {
        return staticProperties.getOrDefault(key, defaultValue);
    }

    public synchronized List<String> getIssuerIds() {
        return new ArrayList<>(issuerProperties.keySet());
    }

    /**
     * Returns a defensive copy of the properties for the given issuer,
     * or an empty map if the issuer is unknown.
     */
    public synchronized Map<String, String> getIssuerProperties(String issuerId) {
        Map<String, String> props = issuerProperties.get(issuerId);
        return props != null ? new HashMap<>(props) : new HashMap<>();
    }
}
