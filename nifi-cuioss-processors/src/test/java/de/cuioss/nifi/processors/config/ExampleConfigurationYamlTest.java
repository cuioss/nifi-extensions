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
package de.cuioss.nifi.processors.config;

import de.cuioss.nifi.jwt.JwtAttributes;
import de.cuioss.nifi.jwt.JwtPropertyKeys;
import de.cuioss.nifi.jwt.config.ConfigurationManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the shipped {@code cui-nifi-extensions-example.yml} against advertising configuration
 * keys that no production code reads.
 * <p>
 * The example file is documentation that operators copy verbatim, so every key it contains must
 * be part of the consumed surface: global keys must be declared {@link JwtAttributes.Properties}
 * constants, and per-issuer keys must be ones
 * {@code de.cuioss.nifi.jwt.config.IssuerConfigurationParser} actually looks up.
 * <p>
 * The example is loaded through {@link ConfigurationManager} itself, so the assertions run against
 * the keys the production loader really produces rather than against a re-implementation of its
 * YAML flattening. Because {@code ConfigurationManager} also folds {@code JWT_*} environment
 * variables into the same maps, the contribution of a manager over an empty directory is
 * subtracted first — that isolates the file's own surface and keeps the test deterministic
 * regardless of the ambient environment.
 */
@DisplayName("Tests for the shipped example configuration YAML")
class ExampleConfigurationYamlTest {

    private static final String EXAMPLE_RESOURCE = "/cui-nifi-extensions-example.yml";
    private static final String CONFIG_FILE = "conf/cui-nifi-extensions.yml";

    /**
     * The per-issuer keys {@code IssuerConfigurationParser} reads. {@code name} is deliberately
     * absent: it remains a legal key for backwards compatibility, but the shipped example must
     * express issuer identity through {@code issuer} only.
     */
    private static final Set<String> CONSUMED_ISSUER_KEYS = Set.of(
            JwtPropertyKeys.Issuer.ISSUER_NAME,
            JwtPropertyKeys.Issuer.JWKS_URL,
            JwtPropertyKeys.Issuer.JWKS_FILE,
            JwtPropertyKeys.Issuer.JWKS_CONTENT,
            JwtPropertyKeys.Issuer.JWKS_TYPE,
            JwtPropertyKeys.Issuer.AUDIENCE,
            JwtPropertyKeys.Issuer.CLIENT_ID,
            // Not declared in JwtPropertyKeys: read as literals by ConfigurationManager
            // (issuer-group id) and IssuerConfigurationParser (enabled flag, jwksUri alias).
            "id", "enabled", "jwksUri");

    @TempDir
    Path tempDir;

    private Set<String> exampleGlobalKeys;
    private Map<String, Set<String>> exampleIssuerKeys;

    @BeforeEach
    void setUp() throws IOException {
        Path emptyBase = Files.createDirectories(tempDir.resolve("empty"));
        Path exampleBase = Files.createDirectories(tempDir.resolve("example"));
        copyExampleTo(exampleBase.resolve(CONFIG_FILE));

        ConfigurationManager environmentOnly = new ConfigurationManager(emptyBase.toString());
        ConfigurationManager withExample = new ConfigurationManager(exampleBase.toString());

        // Isolate the environment at the input boundary rather than subtracting it out of the
        // merged result. Subtracting by key NAME would drop a key the example legitimately
        // declares whenever an ambient JWT_* variable happens to carry the same name — hiding an
        // invalid example key from the contract checks below, which is the one failure mode this
        // test exists to prevent. Asserting the empty-directory manager contributes nothing makes
        // a polluted environment a loud, explained failure instead of a silent false pass.
        assertTrue(environmentOnly.getStaticProperties().isEmpty(),
                "Ambient JWT_* environment variables would make this contract check unsound: "
                        + "a manager over an empty directory contributed global properties "
                        + environmentOnly.getStaticProperties().keySet()
                        + ". Unset them before running this test.");
        assertTrue(environmentOnly.getIssuerProperties().isEmpty(),
                "Ambient JWT_* environment variables would make this contract check unsound: "
                        + "a manager over an empty directory contributed issuers "
                        + environmentOnly.getIssuerProperties().keySet()
                        + ". Unset them before running this test.");

        exampleGlobalKeys = new HashSet<>(withExample.getStaticProperties().keySet());

        exampleIssuerKeys = new HashMap<>();
        withExample.getIssuerProperties().forEach((issuerId, properties) -> {
            if (!properties.isEmpty()) {
                exampleIssuerKeys.put(issuerId, new HashSet<>(properties.keySet()));
            }
        });
    }

    private static void copyExampleTo(Path target) throws IOException {
        Files.createDirectories(target.getParent());
        try (InputStream in = ExampleConfigurationYamlTest.class.getResourceAsStream(EXAMPLE_RESOURCE)) {
            assertNotNull(in, "Example configuration " + EXAMPLE_RESOURCE + " must be on the classpath");
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @Nested
    @DisplayName("Global configuration keys")
    class GlobalKeys {

        @Test
        @DisplayName("Should contribute global keys through ConfigurationManager")
        void shouldContributeGlobalKeys() {
            assertFalse(exampleGlobalKeys.isEmpty(),
                    "The example must contribute global keys, otherwise the key assertions are vacuous");
        }

        @Test
        @DisplayName("Should only use global keys declared as JwtAttributes.Properties constants")
        void shouldOnlyUseDeclaredGlobalKeys() {
            Set<String> undeclared = undeclaredGlobalKeys(exampleGlobalKeys);

            assertTrue(undeclared.isEmpty(),
                    "Example declares global keys no production code reads: " + undeclared);
        }
    }

    @Nested
    @DisplayName("Issuer entries")
    class IssuerEntries {

        @Test
        @DisplayName("Should contribute issuer entries through ConfigurationManager")
        void shouldContributeIssuerEntries() {
            assertFalse(exampleIssuerKeys.isEmpty(),
                    "The example must contribute issuer entries, otherwise the key assertions are vacuous");
        }

        @Test
        @DisplayName("Should only use per-issuer keys the issuer parser consumes")
        void shouldOnlyUseConsumedIssuerKeys() {
            Map<String, Set<String>> unconsumed = new HashMap<>();
            exampleIssuerKeys.forEach((issuerId, keys) -> {
                Set<String> offending = unconsumedIssuerKeys(keys);
                if (!offending.isEmpty()) {
                    unconsumed.put(issuerId, offending);
                }
            });

            assertTrue(unconsumed.isEmpty(),
                    "Example declares per-issuer keys no production code reads: " + unconsumed);
        }

        @Test
        @DisplayName("Should declare an explicit issuer for every entry")
        void shouldDeclareIssuerForEveryEntry() {
            Set<String> withoutIssuer = new TreeSet<>();
            exampleIssuerKeys.forEach((issuerId, keys) -> {
                if (!keys.contains("issuer")) {
                    withoutIssuer.add(issuerId);
                }
            });

            assertTrue(withoutIssuer.isEmpty(),
                    "Every example issuer must carry an explicit issuer key; missing for: " + withoutIssuer);
        }

        @Test
        @DisplayName("Should not identify issuers through the legacy name key")
        void shouldNotUseNameKey() {
            Set<String> withName = new TreeSet<>();
            exampleIssuerKeys.forEach((issuerId, keys) -> {
                if (keys.contains("name")) {
                    withName.add(issuerId);
                }
            });

            assertTrue(withName.isEmpty(),
                    "Issuer identity must be expressed through issuer, not name; name used by: " + withName);
        }
    }

    @Nested
    @DisplayName("Key classification")
    class KeyClassification {

        @Test
        @DisplayName("Should flag a global key that is not a declared constant")
        void shouldFlagUndeclaredGlobalKey() {
            Set<String> undeclared = undeclaredGlobalKeys(
                    Set.of(JwtAttributes.Properties.Validation.ALLOWED_ALGORITHMS, "jwt.validation.clockSkew"));

            assertAll("Undeclared global key detection",
                    () -> assertEquals(Set.of("jwt.validation.clockSkew"), undeclared,
                            "Only the unconsumed key should be reported"),
                    () -> assertFalse(undeclared.contains(JwtAttributes.Properties.Validation.ALLOWED_ALGORITHMS),
                            "A declared constant must not be reported"));
        }

        @Test
        @DisplayName("Should flag a per-issuer key that the parser does not consume")
        void shouldFlagUnconsumedIssuerKey() {
            Set<String> unconsumed = unconsumedIssuerKeys(Set.of("issuer", "name", "requiredClaims"));

            assertEquals(Set.of("name", "requiredClaims"), unconsumed,
                    "Both unconsumed keys should be reported, and issuer should not");
        }
    }

    private static Set<String> undeclaredGlobalKeys(Set<String> keys) {
        Set<String> declared = declaredPropertyConstants();
        Set<String> undeclared = new TreeSet<>(keys);
        undeclared.removeAll(declared);
        return undeclared;
    }

    private static Set<String> unconsumedIssuerKeys(Set<String> keys) {
        Set<String> unconsumed = new TreeSet<>(keys);
        unconsumed.removeAll(CONSUMED_ISSUER_KEYS);
        return unconsumed;
    }

    /**
     * Collects every {@code public static final String} constant declared by the nested classes of
     * {@link JwtAttributes.Properties}. Reading the constants reflectively rather than restating
     * them keeps this test honest: a key is "declared" only if production code declares it.
     */
    private static Set<String> declaredPropertyConstants() {
        Set<String> constants = new HashSet<>();
        collectStringConstants(JwtAttributes.Properties.class, constants);
        return constants;
    }

    private static void collectStringConstants(Class<?> type, Set<String> target) {
        for (Field field : type.getDeclaredFields()) {
            if (field.getType() == String.class
                    && Modifier.isStatic(field.getModifiers())
                    && Modifier.isFinal(field.getModifiers())
                    && Modifier.isPublic(field.getModifiers())) {
                try {
                    Object value = field.get(null);
                    if (value != null) {
                        target.add(value.toString());
                    }
                } catch (IllegalAccessException e) {
                    throw new IllegalStateException("Unable to read constant " + field.getName(), e);
                }
            }
        }
        for (Class<?> nested : type.getDeclaredClasses()) {
            collectStringConstants(nested, target);
        }
    }
}
