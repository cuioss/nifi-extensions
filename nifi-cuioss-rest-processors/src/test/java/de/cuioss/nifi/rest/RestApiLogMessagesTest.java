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
package de.cuioss.nifi.rest;

import de.cuioss.tools.logging.LogRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RestApiLogMessages")
class RestApiLogMessagesTest {

    @Nested
    @DisplayName("INFO Messages")
    class InfoMessages {

        @Test
        @DisplayName("Should have unique identifiers")
        void shouldHaveUniqueIdentifiers() {
            List<LogRecord> records = getLogRecords(RestApiLogMessages.INFO.class);
            Set<String> identifiers = new HashSet<>();
            for (LogRecord record : records) {
                assertTrue(identifiers.add(record.resolveIdentifierString()),
                        "Duplicate INFO identifier: " + record.resolveIdentifierString());
            }
        }

        @Test
        @DisplayName("Should have REST prefix")
        void shouldHaveRestPrefix() {
            List<LogRecord> records = getLogRecords(RestApiLogMessages.INFO.class);
            assertFalse(records.isEmpty());
            for (LogRecord record : records) {
                assertTrue(record.resolveIdentifierString().startsWith("REST-"),
                        "Expected REST prefix but got: " + record.resolveIdentifierString());
            }
        }

        @Test
        @DisplayName("Should have non-blank templates")
        void shouldHaveNonBlankTemplates() {
            List<LogRecord> records = getLogRecords(RestApiLogMessages.INFO.class);
            for (LogRecord record : records) {
                assertFalse(record.getTemplate().isBlank(),
                        "Blank template for: " + record.resolveIdentifierString());
            }
        }
    }

    @Nested
    @DisplayName("WARN Messages")
    class WarnMessages {

        @Test
        @DisplayName("Should have unique identifiers")
        void shouldHaveUniqueIdentifiers() {
            List<LogRecord> records = getLogRecords(RestApiLogMessages.WARN.class);
            Set<String> identifiers = new HashSet<>();
            for (LogRecord record : records) {
                assertTrue(identifiers.add(record.resolveIdentifierString()),
                        "Duplicate WARN identifier: " + record.resolveIdentifierString());
            }
        }

        @Test
        @DisplayName("Should not overlap with INFO identifiers")
        void shouldNotOverlapWithInfoIdentifiers() {
            Set<String> infoIds = new HashSet<>();
            getLogRecords(RestApiLogMessages.INFO.class).forEach(r -> infoIds.add(r.resolveIdentifierString()));

            for (LogRecord record : getLogRecords(RestApiLogMessages.WARN.class)) {
                assertFalse(infoIds.contains(record.resolveIdentifierString()),
                        "WARN identifier overlaps with INFO: " + record.resolveIdentifierString());
            }
        }
    }

    @Nested
    @DisplayName("ERROR Messages")
    class ErrorMessages {

        @Test
        @DisplayName("Should have unique identifiers")
        void shouldHaveUniqueIdentifiers() {
            List<LogRecord> records = getLogRecords(RestApiLogMessages.ERROR.class);
            Set<String> identifiers = new HashSet<>();
            for (LogRecord record : records) {
                assertTrue(identifiers.add(record.resolveIdentifierString()),
                        "Duplicate ERROR identifier: " + record.resolveIdentifierString());
            }
        }
    }

    @Nested
    @DisplayName("All Messages")
    class AllMessages {

        @Test
        @DisplayName("Should have globally unique identifiers")
        void shouldHaveGloballyUniqueIdentifiers() {
            Set<String> allIds = new HashSet<>();
            for (LogRecord r : getLogRecords(RestApiLogMessages.INFO.class)) {
                assertTrue(allIds.add(r.resolveIdentifierString()),
                        "Duplicate identifier: " + r.resolveIdentifierString());
            }
            for (LogRecord r : getLogRecords(RestApiLogMessages.WARN.class)) {
                assertTrue(allIds.add(r.resolveIdentifierString()),
                        "Duplicate identifier: " + r.resolveIdentifierString());
            }
            for (LogRecord r : getLogRecords(RestApiLogMessages.ERROR.class)) {
                assertTrue(allIds.add(r.resolveIdentifierString()),
                        "Duplicate identifier: " + r.resolveIdentifierString());
            }
        }
    }

    private static List<LogRecord> getLogRecords(Class<?> clazz) {
        List<LogRecord> records = new ArrayList<>();
        for (Field field : clazz.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) && LogRecord.class.isAssignableFrom(field.getType())) {
                try {
                    records.add((LogRecord) field.get(null));
                } catch (IllegalAccessException e) {
                    fail("Cannot access field " + field.getName() + ": " + e.getMessage());
                }
            }
        }
        return records;
    }
}
