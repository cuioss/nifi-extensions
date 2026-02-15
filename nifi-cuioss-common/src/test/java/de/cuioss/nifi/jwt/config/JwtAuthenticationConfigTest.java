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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JwtAuthenticationConfig")
class JwtAuthenticationConfigTest {

    @Nested
    @DisplayName("Record Creation")
    class RecordCreationTests {

        @Test
        @DisplayName("Should create record with valid values")
        void shouldCreateWithValidValues() {
            // Arrange
            int maxTokenSize = 4096;
            Set<String> algorithms = Set.of("RS256", "RS384", "RS512");
            boolean requireHttps = true;

            // Act
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    maxTokenSize, algorithms, requireHttps);

            // Assert
            assertEquals(maxTokenSize, config.maxTokenSize());
            assertEquals(algorithms, config.allowedAlgorithms());
            assertEquals(requireHttps, config.requireHttpsForJwks());
        }

        @Test
        @DisplayName("Should create defensive copy of allowed algorithms")
        void shouldCreateDefensiveCopyOfAlgorithms() {
            // Arrange
            Set<String> originalSet = new HashSet<>();
            originalSet.add("RS256");
            originalSet.add("RS512");

            // Act
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, originalSet, true);

            // Modify original set
            originalSet.add("HS256");

            // Assert
            assertEquals(2, config.allowedAlgorithms().size());
            assertTrue(config.allowedAlgorithms().contains("RS256"));
            assertTrue(config.allowedAlgorithms().contains("RS512"));
            assertFalse(config.allowedAlgorithms().contains("HS256"),
                    "Modifications to original set should not affect config");
        }

        @Test
        @DisplayName("Should handle null algorithms as empty set")
        void shouldHandleNullAlgorithms() {
            // Act
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, null, true);

            // Assert
            assertNotNull(config.allowedAlgorithms());
            assertTrue(config.allowedAlgorithms().isEmpty());
        }

        @Test
        @DisplayName("Should handle empty algorithms set")
        void shouldHandleEmptyAlgorithmsSet() {
            // Act
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of(), false);

            // Assert
            assertNotNull(config.allowedAlgorithms());
            assertTrue(config.allowedAlgorithms().isEmpty());
        }
    }

    @Nested
    @DisplayName("Immutability")
    class ImmutabilityTests {

        @Test
        @DisplayName("Should return unmodifiable algorithms set")
        void shouldReturnUnmodifiableAlgorithmsSet() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256", "RS512"), true);

            // Act & Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> config.allowedAlgorithms().add("HS256"));
        }

        @Test
        @DisplayName("Should not allow clearing algorithms set")
        void shouldNotAllowClearingAlgorithmsSet() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);

            // Act & Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> config.allowedAlgorithms().clear());
        }

        @Test
        @DisplayName("Should not allow removing from algorithms set")
        void shouldNotAllowRemovingFromAlgorithmsSet() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256", "RS512"), true);

            // Act & Assert
            assertThrows(UnsupportedOperationException.class,
                    () -> config.allowedAlgorithms().remove("RS256"));
        }
    }

    @Nested
    @DisplayName("Getters")
    class GetterTests {

        @Test
        @DisplayName("Should return correct maxTokenSize")
        void shouldReturnCorrectMaxTokenSize() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    8192, Set.of("RS256"), true);

            // Act & Assert
            assertEquals(8192, config.maxTokenSize());
        }

        @Test
        @DisplayName("Should return correct allowedAlgorithms")
        void shouldReturnCorrectAllowedAlgorithms() {
            // Arrange
            Set<String> algorithms = Set.of("RS256", "RS384", "RS512", "ES256");
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    4096, algorithms, true);

            // Act
            Set<String> result = config.allowedAlgorithms();

            // Assert
            assertEquals(4, result.size());
            assertTrue(result.contains("RS256"));
            assertTrue(result.contains("RS384"));
            assertTrue(result.contains("RS512"));
            assertTrue(result.contains("ES256"));
        }

        @Test
        @DisplayName("Should return correct requireHttpsForJwks when true")
        void shouldReturnTrueForRequireHttps() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);

            // Act & Assert
            assertTrue(config.requireHttpsForJwks());
        }

        @Test
        @DisplayName("Should return correct requireHttpsForJwks when false")
        void shouldReturnFalseForRequireHttps() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), false);

            // Act & Assert
            assertFalse(config.requireHttpsForJwks());
        }
    }

    @Nested
    @DisplayName("Record Equals and HashCode")
    class EqualsHashCodeTests {

        @Test
        @DisplayName("Should be equal when all fields match")
        void shouldBeEqualWhenAllFieldsMatch() {
            // Arrange
            JwtAuthenticationConfig config1 = new JwtAuthenticationConfig(
                    2048, Set.of("RS256", "RS512"), true);
            JwtAuthenticationConfig config2 = new JwtAuthenticationConfig(
                    2048, Set.of("RS256", "RS512"), true);

            // Act & Assert
            assertEquals(config1, config2);
            assertEquals(config1.hashCode(), config2.hashCode());
        }

        @Test
        @DisplayName("Should not be equal when maxTokenSize differs")
        void shouldNotBeEqualWhenMaxTokenSizeDiffers() {
            // Arrange
            JwtAuthenticationConfig config1 = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);
            JwtAuthenticationConfig config2 = new JwtAuthenticationConfig(
                    4096, Set.of("RS256"), true);

            // Act & Assert
            assertNotEquals(config1, config2);
        }

        @Test
        @DisplayName("Should not be equal when allowedAlgorithms differs")
        void shouldNotBeEqualWhenAllowedAlgorithmsDiffers() {
            // Arrange
            JwtAuthenticationConfig config1 = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);
            JwtAuthenticationConfig config2 = new JwtAuthenticationConfig(
                    2048, Set.of("RS512"), true);

            // Act & Assert
            assertNotEquals(config1, config2);
        }

        @Test
        @DisplayName("Should not be equal when requireHttpsForJwks differs")
        void shouldNotBeEqualWhenRequireHttpsDiffers() {
            // Arrange
            JwtAuthenticationConfig config1 = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);
            JwtAuthenticationConfig config2 = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), false);

            // Act & Assert
            assertNotEquals(config1, config2);
        }

        @Test
        @DisplayName("Should be equal to itself")
        void shouldBeEqualToItself() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);

            // Act & Assert
            assertEquals(config, config);
        }

        @Test
        @DisplayName("Should not be equal to null")
        void shouldNotBeEqualToNull() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    2048, Set.of("RS256"), true);

            // Act & Assert
            assertNotEquals(null, config);
        }
    }

    @Nested
    @DisplayName("ToString")
    class ToStringTests {

        @Test
        @DisplayName("Should include all fields in toString")
        void shouldIncludeAllFieldsInToString() {
            // Arrange
            JwtAuthenticationConfig config = new JwtAuthenticationConfig(
                    4096, Set.of("RS256", "ES256"), true);

            // Act
            String result = config.toString();

            // Assert
            assertTrue(result.contains("4096"));
            assertTrue(result.contains("RS256") || result.contains("ES256"));
            assertTrue(result.contains("true"));
        }
    }
}
