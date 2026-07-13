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
package de.cuioss.nifi.jwt;

import de.cuioss.tools.logging.LogRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JwtLogMessages")
class JwtLogMessagesTest {

    private static final String EXPECTED_PREFIX = "JWT";

    /**
     * Reflectively enumerates every {@code LogRecord} field declared on the given holder
     * class. Enumerating by reflection keeps coverage drift-free: any record added to or
     * removed from {@link JwtLogMessages} is picked up automatically, so the test can never
     * silently omit a newly added record (the manual-enumeration drift this rewrite fixes).
     */
    private static Stream<Arguments> logRecordsOf(Class<?> holder) {
        return Arrays.stream(holder.getDeclaredFields())
                .filter(field -> LogRecord.class.equals(field.getType()))
                .map(field -> Arguments.of(field.getName(), readRecord(field)));
    }

    private static LogRecord readRecord(Field field) {
        try {
            return (LogRecord) field.get(null);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("Unable to read LogRecord field " + field.getName(), e);
        }
    }

    private static void assertWellFormed(LogRecord logRecord) {
        assertAll("LogRecord is well-formed",
                () -> assertNotNull(logRecord, "LogRecord should be defined"),
                () -> assertNotNull(logRecord.getTemplate(), "Template should be defined"),
                () -> assertTrue(logRecord.getTemplate() != null && !logRecord.getTemplate().isBlank(),
                        "Template should not be blank"),
                () -> assertTrue(logRecord.resolveIdentifierString().startsWith(EXPECTED_PREFIX + "-"),
                        "Resolved identifier should carry the JWT prefix"));
    }

    @Nested
    @DisplayName("INFO LogRecords")
    class InfoLogRecordsTest {

        static Stream<Arguments> infoRecords() {
            return logRecordsOf(JwtLogMessages.INFO.class);
        }

        @ParameterizedTest(name = "INFO.{0} should be a well-formed LogRecord")
        @MethodSource("infoRecords")
        @DisplayName("Should define well-formed INFO LogRecords")
        void shouldDefineWellFormedInfoRecord(String name, LogRecord logRecord) {
            assertWellFormed(logRecord);
        }
    }

    @Nested
    @DisplayName("WARN LogRecords")
    class WarnLogRecordsTest {

        static Stream<Arguments> warnRecords() {
            return logRecordsOf(JwtLogMessages.WARN.class);
        }

        @ParameterizedTest(name = "WARN.{0} should be a well-formed LogRecord")
        @MethodSource("warnRecords")
        @DisplayName("Should define well-formed WARN LogRecords")
        void shouldDefineWellFormedWarnRecord(String name, LogRecord logRecord) {
            assertWellFormed(logRecord);
        }
    }

    @Nested
    @DisplayName("ERROR LogRecords")
    class ErrorLogRecordsTest {

        static Stream<Arguments> errorRecords() {
            return logRecordsOf(JwtLogMessages.ERROR.class);
        }

        @ParameterizedTest(name = "ERROR.{0} should be a well-formed LogRecord")
        @MethodSource("errorRecords")
        @DisplayName("Should define well-formed ERROR LogRecords")
        void shouldDefineWellFormedErrorRecord(String name, LogRecord logRecord) {
            assertWellFormed(logRecord);
        }
    }

    @Nested
    @DisplayName("Identifier Uniqueness")
    class IdentifierUniquenessTest {

        @Test
        @DisplayName("Should assign a unique resolved identifier to every LogRecord")
        void shouldAssignUniqueIdentifiers() {
            List<LogRecord> allRecords = new ArrayList<>();
            for (Class<?> holder : List.of(
                    JwtLogMessages.INFO.class, JwtLogMessages.WARN.class, JwtLogMessages.ERROR.class)) {
                Arrays.stream(holder.getDeclaredFields())
                        .filter(field -> LogRecord.class.equals(field.getType()))
                        .forEach(field -> allRecords.add(readRecord(field)));
            }

            Set<String> identifiers = new HashSet<>();
            for (LogRecord logRecord : allRecords) {
                assertTrue(identifiers.add(logRecord.resolveIdentifierString()),
                        "Duplicate LogRecord identifier: " + logRecord.resolveIdentifierString());
            }
            assertFalse(identifiers.isEmpty(), "At least one LogRecord should be defined");
        }
    }
}
