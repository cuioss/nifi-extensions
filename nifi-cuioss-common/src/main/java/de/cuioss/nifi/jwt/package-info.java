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
/**
 * Shared JWT authentication and validation infrastructure for NiFi extensions.
 * Contains supporting classes for JWT token validation, issuer configuration
 * parsing, and authorization checking. The
 * {@link de.cuioss.nifi.jwt.config.JwtIssuerConfigService} controller-service
 * interface itself lives in the {@code nifi-cuioss-api} artifact: the
 * {@code de.cuioss.nifi.jwt.config} package is intentionally split across the api
 * (interface) and common (implementation) modules.
 */
@NullMarked
package de.cuioss.nifi.jwt;

import org.jspecify.annotations.NullMarked;
