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
package de.cuioss.nifi.rest.server;

import de.cuioss.nifi.rest.RestApiLogMessages;
import de.cuioss.tools.logging.CuiLogger;
import org.eclipse.jetty.http.HttpVersion;
import org.eclipse.jetty.server.*;
import org.eclipse.jetty.util.ssl.SslContextFactory;
import org.jspecify.annotations.Nullable;

import javax.net.ssl.SSLContext;
import java.io.IOException;

/**
 * Manages the lifecycle of an embedded Jetty {@link Server} instance.
 * <p>
 * Provides start, stop, and state query operations for the REST API
 * Gateway's HTTP server. Uses a single {@link ServerConnector} bound
 * to the configured port (port 0 for OS-assigned in tests).
 */
public class JettyServerManager {

    private static final CuiLogger LOGGER = new CuiLogger(JettyServerManager.class);

    private Server server;

    /**
     * Starts the Jetty server on the given port with plain HTTP, binding to all interfaces.
     *
     * @param port    the port to listen on (0 for OS-assigned)
     * @param handler the request handler
     * @throws IllegalStateException if the server is already running
     */
    public void start(int port, Handler handler) {
        start(port, null, handler, null);
    }

    /**
     * Starts the Jetty server on the given port with the specified handler, binding to all interfaces.
     * Uses HTTPS when an {@link SSLContext} is provided, plain HTTP otherwise.
     *
     * @param port       the port to listen on (0 for OS-assigned)
     * @param handler    the request handler
     * @param sslContext the SSL context for HTTPS, or {@code null} for HTTP
     * @throws IllegalStateException if the server is already running
     */
    public void start(int port, Handler handler, @Nullable SSLContext sslContext) {
        start(port, null, handler, sslContext);
    }

    /**
     * Starts the Jetty server on the given port and host with the specified handler.
     * Uses HTTPS when an {@link SSLContext} is provided, plain HTTP otherwise.
     *
     * @param port       the port to listen on (0 for OS-assigned)
     * @param host       the host/IP to bind to, or {@code null} for all interfaces
     * @param handler    the request handler
     * @param sslContext the SSL context for HTTPS, or {@code null} for HTTP
     * @throws IllegalStateException if the server is already running
     */
    @SuppressWarnings("java:S2147") // Jetty LifeCycle.start() declares 'throws Exception'
    public void start(int port, @Nullable String host, Handler handler, @Nullable SSLContext sslContext) {
        if (isRunning()) {
            throw new IllegalStateException("Server is already running on port " + getPort());
        }

        server = new Server();
        ServerConnector connector = createConnector(server, port, host, sslContext);
        server.addConnector(connector);
        server.setHandler(handler);

        try {
            server.start();
            LOGGER.info(RestApiLogMessages.INFO.SERVER_STARTED, getPort());
        } catch (IOException e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.SERVER_START_FAILED, port, e.getMessage());
            server = null;
            throw new IllegalStateException("Failed to start Jetty server on port " + port, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.error(e, RestApiLogMessages.ERROR.SERVER_START_FAILED, port, e.getMessage());
            server = null;
            throw new IllegalStateException("Jetty server start interrupted on port " + port, e);
        } catch (Exception e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.SERVER_START_FAILED, port, e.getMessage());
            server = null;
            throw new IllegalStateException("Failed to start Jetty server on port " + port, e);
        }
    }

    private static ServerConnector createConnector(
            Server server, int port, @Nullable String host, @Nullable SSLContext sslContext) {
        if (sslContext == null) {
            ServerConnector connector = new ServerConnector(server);
            connector.setPort(port);
            if (host != null) {
                connector.setHost(host);
            }
            return connector;
        }

        SslContextFactory.Server sslContextFactory = new SslContextFactory.Server();
        sslContextFactory.setSslContext(sslContext);

        HttpConfiguration httpsConfig = new HttpConfiguration();
        httpsConfig.addCustomizer(new SecureRequestCustomizer());

        ServerConnector connector = new ServerConnector(server,
                new SslConnectionFactory(sslContextFactory, HttpVersion.HTTP_1_1.asString()),
                new HttpConnectionFactory(httpsConfig));
        connector.setPort(port);
        if (host != null) {
            connector.setHost(host);
        }
        return connector;
    }

    /**
     * Gracefully stops the Jetty server.
     */
    @SuppressWarnings("java:S2147") // Jetty LifeCycle.stop() declares 'throws Exception'
    public void stop() {
        if (server == null) {
            return;
        }
        try {
            server.stop();
            LOGGER.info(RestApiLogMessages.INFO.SERVER_STOPPED);
        } catch (IOException e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.SERVER_STOP_FAILED, e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.error(e, RestApiLogMessages.ERROR.SERVER_STOP_FAILED, e.getMessage());
        } catch (Exception e) {
            LOGGER.error(e, RestApiLogMessages.ERROR.SERVER_STOP_FAILED, e.getMessage());
        } finally {
            server = null;
        }
    }

    /**
     * Returns whether the server is currently running.
     */
    public boolean isRunning() {
        return server != null && server.isRunning();
    }

    /**
     * Returns the actual listening port. Useful when started with port 0.
     *
     * @return the port number, or -1 if not running
     */
    public int getPort() {
        if (server == null || server.getConnectors().length == 0) {
            return -1;
        }
        return ((ServerConnector) server.getConnectors()[0]).getLocalPort();
    }
}
