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
package de.cuioss.nifi.ui.util;

import org.jspecify.annotations.Nullable;

import java.util.regex.Pattern;

/**
 * Neutralizes externally-sourced values before they reach a log placeholder.
 *
 * <p>The servlets in this module log request-supplied URLs, paths and form fields on
 * rejection paths. A literal CR or LF inside such a value would let the writer forge a
 * second log line — CWE-117 log injection — and mislead anyone (or anything) reading the
 * log afterwards. The primary trust boundaries reject most malformed input before it ever
 * reaches a log call; this is the defense-in-depth layer behind them, applied at the sink
 * so no individual call site has to remember.
 */
public final class LogSanitizer {

    /**
     * Every ISO control character ({@code \p{javaISOControl}}), not just CR and LF —
     * {@code \p{Cntrl}} would cover only the ASCII C0 range plus DEL and would let a C1
     * control such as {@code U+009B} through. The line and paragraph separators
     * ({@code U+2028}/{@code U+2029}) are not ISO control characters but are treated as
     * line breaks by some log viewers, so they are matched explicitly.
     */
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\p{javaISOControl}\\u2028\\u2029]");

    private static final String REPLACEMENT = "_";

    private LogSanitizer() {
        // utility class
    }

    /**
     * Returns {@code value} with every control character replaced by an underscore, so the
     * result occupies exactly one log line.
     *
     * @param value the externally-sourced value, may be {@code null}
     * @return a single-line rendering of {@code value}, or the literal {@code "null"} when
     * {@code value} is {@code null} — callers log the absence rather than dropping the field
     */
    public static String forLog(@Nullable String value) {
        if (value == null) {
            return "null";
        }
        return CONTROL_CHARS.matcher(value).replaceAll(REPLACEMENT);
    }
}
