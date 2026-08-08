package com.portal.analytics.adapters.mlclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.portal.analytics.domain.DomainException;
import com.portal.analytics.domain.PredictionResult;
import com.portal.analytics.domain.PropertyFeatures;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies that {@link MlModelClient} attaches the {@code x-internal-token}
 * header to outgoing requests when a token is configured.
 *
 * <p>Uses an embedded {@link HttpServer} bound to an ephemeral port to capture
 * the actual HTTP request, which is the most realistic way to exercise the
 * JDK's {@link java.net.http.HttpClient} without coupling to internal state.
 */
@DisplayName("MlModelClient outbound auth header")
class MlModelClientAuthHeaderTest {

    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> capturedToken = new AtomicReference<>();
    private final AtomicReference<String> capturedPath = new AtomicReference<>();
    private final AtomicReference<String> capturedMethod = new AtomicReference<>();

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();

        HttpHandler handler = new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                capturedToken.set(exchange.getRequestHeaders().getFirst("x-internal-token"));
                capturedPath.set(exchange.getRequestURI().getPath());
                capturedMethod.set(exchange.getRequestMethod());

                byte[] body;
                if ("/predict".equals(exchange.getRequestURI().getPath())) {
                    body = "{\"prediction\": 350000.0}".getBytes();
                } else if ("/model-info".equals(exchange.getRequestURI().getPath())) {
                    body = "{\"model_type\": \"ridge\", \"training_date\": \"2024-01-01\"}".getBytes();
                } else {
                    body = "{}".getBytes();
                }
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            }
        };

        server.createContext("/predict", handler);
        server.createContext("/model-info", handler);
        server.start();
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    @DisplayName("predict() attaches x-internal-token when token is configured")
    void predictAttachesToken() {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        MlModelClient client = new MlModelClient(baseUrl, "secret-token-123", mapper);

        PredictionResult result = client.predict(
                new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7));

        assertThat(result.predictedPrice()).isEqualTo(350000.0);
        assertThat(capturedToken.get()).isEqualTo("secret-token-123");
        assertThat(capturedPath.get()).isEqualTo("/predict");
        assertThat(capturedMethod.get()).isEqualTo("POST");
    }

    @Test
    @DisplayName("getModelInfo() attaches x-internal-token when token is configured")
    void modelInfoAttachesToken() {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        MlModelClient client = new MlModelClient(baseUrl, "secret-token-123", mapper);

        client.getModelInfo();

        assertThat(capturedToken.get()).isEqualTo("secret-token-123");
        assertThat(capturedPath.get()).isEqualTo("/model-info");
        assertThat(capturedMethod.get()).isEqualTo("GET");
    }

    @Test
    @DisplayName("predictBatch() propagates x-internal-token for each call")
    void predictBatchAttachesToken() {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        MlModelClient client = new MlModelClient(baseUrl, "batch-token", mapper);

        List<PredictionResult> results = client.predictBatch(List.of(
                new PropertyFeatures(1500, 2, 1, 1990, 3000, 6, 5),
                new PropertyFeatures(2500, 4, 2, 2000, 7000, 3, 9)
        ));

        assertThat(results).hasSize(2);
        // Last request captured is the second predict() call
        assertThat(capturedToken.get()).isEqualTo("batch-token");
    }

    @Test
    @DisplayName("predict() does NOT attach header when token is empty (dev mode)")
    void predictNoHeaderWhenTokenEmpty() {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        MlModelClient client = new MlModelClient(baseUrl, "", mapper);

        client.predict(new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7));

        assertThat(capturedToken.get()).isNull();
    }

    @Test
    @DisplayName("predict() does NOT attach header when token is null (defensive)")
    void predictNoHeaderWhenTokenNull() {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        MlModelClient client = new MlModelClient(baseUrl, null, mapper);

        client.predict(new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7));

        assertThat(capturedToken.get()).isNull();
    }

    @Test
    @DisplayName("predict() surfaces 5xx errors as DomainException even with token attached")
    void predictHandlesServerErrorWithToken() throws IOException {
        // Replace the handler with one that returns 500 for /predict
        server.removeContext("/predict");
        server.createContext("/predict", exchange -> {
            capturedToken.set(exchange.getRequestHeaders().getFirst("x-internal-token"));
            byte[] body = "{\"error\": \"boom\"}".getBytes();
            exchange.sendResponseHeaders(500, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        MlModelClient client = new MlModelClient(baseUrl, "err-token", mapper);

        assertThatThrownBy(() -> client.predict(
                new PropertyFeatures(2000, 3, 2, 1995, 6000, 5, 7)))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("HTTP 500");
        assertThat(capturedToken.get()).isEqualTo("err-token");
    }
}
