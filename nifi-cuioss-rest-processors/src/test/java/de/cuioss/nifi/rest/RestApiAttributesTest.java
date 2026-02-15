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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RestApiAttributes")
class RestApiAttributesTest {

    @Test
    @DisplayName("Should have non-null and non-blank constants")
    void shouldHaveNonNullConstants() throws IllegalAccessException {
        for (Field field : RestApiAttributes.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) && field.getType() == String.class) {
                String value = (String) field.get(null);
                assertNotNull(value, "Constant " + field.getName() + " is null");
                assertFalse(value.isBlank(), "Constant " + field.getName() + " is blank");
            }
        }
    }

    @Test
    @DisplayName("Should follow naming convention")
    void shouldFollowNamingConvention() {
        assertTrue(RestApiAttributes.ROUTE_NAME.startsWith("rest."));
        assertTrue(RestApiAttributes.ROUTE_PATH.startsWith("rest."));
        assertTrue(RestApiAttributes.HTTP_METHOD.startsWith("http."));
        assertTrue(RestApiAttributes.HTTP_REQUEST_URI.startsWith("http."));
        assertTrue(RestApiAttributes.HTTP_REMOTE_HOST.startsWith("http."));
        assertTrue(RestApiAttributes.CONTENT_TYPE.startsWith("mime."));
        assertTrue(RestApiAttributes.QUERY_PARAM_PREFIX.startsWith("http."));
        assertTrue(RestApiAttributes.HEADER_PREFIX.startsWith("http."));
    }
}
