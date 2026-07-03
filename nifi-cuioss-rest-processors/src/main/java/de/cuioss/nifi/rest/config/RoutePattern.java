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
package de.cuioss.nifi.rest.config;

import de.cuioss.tools.logging.CuiLogger;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Immutable compiled representation of a URL path template containing
 * {@code {parameterName}} placeholders.
 * <p>
 * A path template such as {@code /api/v1/personalprozesse/{processid}/status}
 * is compiled <em>once</em> (at handler registration time) into a
 * {@link java.util.regex.Pattern} with named capturing groups. Subsequent
 * {@link #match(String)} calls extract the placeholder values from an incoming
 * request path without re-parsing the template.
 * <p>
 * Placeholder syntax:
 * <ul>
 *   <li>{@code {name}} — matches a single path segment ({@code [^/]+}).</li>
 *   <li>{@code {name:regex}} — matches a single segment that also satisfies the
 *       supplied {@code regex} constraint, e.g. {@code {id:\\d+}}.</li>
 * </ul>
 * Literal portions of the template are matched verbatim (regex-quoted), so the
 * compiled pattern only matches the full request path.
 * <p>
 * The factory {@link #compile(String)} validates the template at construction
 * time and throws {@link IllegalArgumentException} for unclosed braces, empty
 * parameter names, duplicate parameter names, or an invalid constraint regex.
 * Plain templates without placeholders should be detected up front via
 * {@link #containsPlaceholders(String)} and routed through exact/prefix matching
 * instead of being compiled here.
 */
public final class RoutePattern {

    private static final CuiLogger LOGGER = new CuiLogger(RoutePattern.class);

    private final String template;
    private final Pattern pattern;
    private final List<String> parameterNames;

    private RoutePattern(String template, Pattern pattern, List<String> parameterNames) {
        this.template = template;
        this.pattern = pattern;
        this.parameterNames = List.copyOf(parameterNames);
    }

    /**
     * Whether the given path contains at least one {@code {placeholder}} segment.
     * <p>
     * Callers use this to decide whether a route path needs pattern compilation
     * (returns {@code true}) or can stay on the exact/prefix matching paths
     * (returns {@code false}).
     *
     * @param path the route path to inspect; may be {@code null}
     * @return {@code true} if the path declares any curly-brace placeholder
     */
    public static boolean containsPlaceholders(String path) {
        return path != null && path.indexOf('{') >= 0;
    }

    /**
     * Compiles a path template into a reusable {@link RoutePattern}.
     *
     * @param template the path template, e.g. {@code /api/{id}/resource} or
     *                 {@code /api/{id:\\d+}/resource}; must not be {@code null}
     * @return the compiled pattern
     * @throws IllegalArgumentException if the template is {@code null}, contains
     *                                  unclosed braces, empty or duplicate
     *                                  parameter names, or an invalid constraint
     *                                  regex
     */
    public static RoutePattern compile(String template) {
        if (template == null) {
            throw new IllegalArgumentException("template must not be null");
        }
        StringBuilder regex = new StringBuilder();
        List<String> names = new ArrayList<>();
        int index = 0;
        int length = template.length();
        StringBuilder literal = new StringBuilder();
        while (index < length) {
            char current = template.charAt(index);
            if (current == '{') {
                if (!literal.isEmpty()) {
                    regex.append(Pattern.quote(literal.toString()));
                    literal.setLength(0);
                }
                index = appendPlaceholder(template, index, regex, names);
            } else if (current == '}') {
                throw new IllegalArgumentException(
                        "Unbalanced '}' in path template at index " + index + ": " + template);
            } else {
                literal.append(current);
                index++;
            }
        }
        if (!literal.isEmpty()) {
            regex.append(Pattern.quote(literal.toString()));
        }
        Pattern compiled = Pattern.compile(regex.toString());
        LOGGER.debug("Compiled route template '%s' to regex '%s' with parameters %s",
                template, regex, names);
        return new RoutePattern(template, compiled, names);
    }

    /**
     * Parses a single {@code {name}} or {@code {name:regex}} placeholder starting
     * at {@code braceIndex}, appends its named capturing group to {@code regex},
     * records its name in {@code names}, and returns the index just past the
     * closing brace.
     */
    private static int appendPlaceholder(String template, int braceIndex,
            StringBuilder regex, List<String> names) {
        int close = findClosingBrace(template, braceIndex);
        if (close < 0) {
            throw new IllegalArgumentException(
                    "Unclosed '{' in path template at index " + braceIndex + ": " + template);
        }
        String body = template.substring(braceIndex + 1, close);
        int colon = body.indexOf(':');
        String name = colon < 0 ? body : body.substring(0, colon);
        String constraint = colon < 0 ? "[^/]+" : body.substring(colon + 1);
        if (name.isEmpty()) {
            throw new IllegalArgumentException(
                    "Empty parameter name in path template: " + template);
        }
        if (!name.matches("[A-Za-z][A-Za-z0-9]*")) {
            throw new IllegalArgumentException(
                    "Invalid parameter name '" + name + "' in path template: " + template
                            + " (parameter names must be alphanumeric and start with a letter)");
        }
        if (names.contains(name)) {
            throw new IllegalArgumentException(
                    "Duplicate parameter name '" + name + "' in path template: " + template);
        }
        if (constraint.isEmpty()) {
            throw new IllegalArgumentException(
                    "Empty constraint for parameter '" + name + "' in path template: " + template);
        }
        validateConstraintRegex(name, constraint, template);
        names.add(name);
        regex.append("(?<").append(name).append('>').append(constraint).append(')');
        return close + 1;
    }

    /**
     * Finds the brace that closes the placeholder opened at {@code braceIndex},
     * accounting for balanced {@code {...}} groups inside a constraint regex
     * (e.g. the {@code {3}} quantifier in {@code {code:[A-Z]{3}}}). Returns the
     * index of the matching {@code '}'}, or {@code -1} when none balances.
     */
    private static int findClosingBrace(String template, int braceIndex) {
        int depth = 0;
        for (int i = braceIndex; i < template.length(); i++) {
            char c = template.charAt(i);
            if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static void validateConstraintRegex(String name, String constraint, String template) {
        try {
            Pattern.compile(constraint);
        } catch (PatternSyntaxException e) {
            throw new IllegalArgumentException(
                    "Invalid constraint regex '" + constraint + "' for parameter '"
                            + name + "' in path template: " + template,
                    e);
        }
    }

    /**
     * Matches a request path against this compiled template and extracts the
     * placeholder values.
     *
     * @param requestPath the incoming request path to match; may be {@code null}
     * @return an {@link Optional} containing the ordered name&rarr;value map of
     *         extracted parameters when the path matches, or
     *         {@link Optional#empty()} when it does not match
     */
    public Optional<Map<String, String>> match(String requestPath) {
        if (requestPath == null) {
            return Optional.empty();
        }
        Matcher matcher = pattern.matcher(requestPath);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        for (String name : parameterNames) {
            parameters.put(name, matcher.group(name));
        }
        return Optional.of(Collections.unmodifiableMap(parameters));
    }

    /**
     * The original path template this pattern was compiled from.
     *
     * @return the source template
     */
    public String template() {
        return template;
    }

    /**
     * The ordered placeholder parameter names declared by this template.
     *
     * @return an immutable list of parameter names in declaration order
     */
    public List<String> parameterNames() {
        return parameterNames;
    }

    @Override
    public String toString() {
        return "RoutePattern[template=" + template + ", parameters=" + parameterNames + "]";
    }
}
