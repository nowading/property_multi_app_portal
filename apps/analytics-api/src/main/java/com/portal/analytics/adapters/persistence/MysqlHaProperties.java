package com.portal.analytics.adapters.persistence;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration properties for MySQL with future High Availability extension points.
 *
 * <p>This abstraction decouples the datasource configuration from Spring Boot's
 * auto-configuration, allowing seamless switching between:</p>
 * <ul>
 *   <li>Single-node deployment (current default)</li>
 *   <li>MySQL Replication (read-write split with primary + replicas)</li>
 *   <li>MySQL InnoDB Cluster / Group Replication (multi-master)</li>
 *   <li>External HA proxy (ProxySQL, MaxScale, HAProxy)</li>
 * </ul>
 *
 * <p>When {@code ha.enabled} is {@code false}, configuration falls back to the
 * simple primary-only connection defined by {@link #primary}.</p>
 */
@ConfigurationProperties(prefix = "portal.datasource")
public record MysqlHaProperties(
        Node primary,
        Ha ha,
        Hikari hikari
) {

    public MysqlHaProperties {
        if (primary == null) {
            primary = new Node("localhost", 3306, "analytics_db", "analytics", null);
        }
        if (ha == null) {
            ha = new Ha(false, Ha.Strategy.SINGLE, new ArrayList<>());
        }
        if (hikari == null) {
            hikari = new Hikari(10, 5, 30000, 600000, 1800000);
        }
    }

    public MysqlHaProperties() {
        this(new Node("localhost", 3306, "analytics_db", "analytics", null),
                new Ha(false, Ha.Strategy.SINGLE, new ArrayList<>()),
                new Hikari(10, 5, 30000, 600000, 1800000));
    }

    public record Node(
            String host,
            int port,
            String database,
            String username,
            String password
    ) {
        public Node {
            if (host == null || host.isBlank()) {
                host = "localhost";
            }
            if (port <= 0) {
                port = 3306;
            }
            if (database == null || database.isBlank()) {
                database = "analytics_db";
            }
            if (username == null || username.isBlank()) {
                username = "analytics";
            }
        }

        /** Build the JDBC URL for this node. */
        public String jdbcUrl() {
            return "jdbc:mysql://%s:%d/%s?useSSL=false&serverTimezone=UTC"
                    .formatted(host, port, database);
        }
    }

    public record Ha(
            boolean enabled,
            Strategy strategy,
            List<Node> replicas
    ) {
        public enum Strategy {
            /** Single node — no HA. */
            SINGLE,
            /** Read-write split (primary writes, replicas read). */
            REPLICATION,
            /** Multi-master group replication / InnoDB cluster. */
            CLUSTER,
            /** External proxy (ProxySQL/MaxScale/HAProxy) fronts the topology. */
            PROXY
        }

        public Ha {
            if (strategy == null) {
                strategy = Strategy.SINGLE;
            }
            if (replicas == null) {
                replicas = new ArrayList<>();
            }
        }

        /** Return the primary JDBC URL (used for writes). */
        public String primaryUrl(MysqlHaProperties props) {
            return props.primary().jdbcUrl();
        }

        /**
         * Return the JDBC URL(s) for read traffic.
         * When HA is disabled, returns the primary URL. Otherwise returns the
         * first replica (placeholder — a future RoutingDataSource will pick).
         */
        public String readUrl(MysqlHaProperties props) {
            if (!enabled || replicas.isEmpty()) {
                return props.primary().jdbcUrl();
            }
            return replicas.get(0).jdbcUrl();
        }
    }

    /**
     * HikariCP connection pool settings. Kept outside {@link Node} so the same
     * pool tuning can be reused across future HA strategies.
     */
    public record Hikari(
            int maximumPoolSize,
            int minimumIdle,
            long connectionTimeout,
            long idleTimeout,
            long maxLifetime
    ) {
        public Hikari {
            if (maximumPoolSize <= 0) {
                maximumPoolSize = 10;
            }
            if (minimumIdle < 0) {
                minimumIdle = 0;
            }
            if (connectionTimeout <= 0) {
                connectionTimeout = 30_000L;
            }
            if (idleTimeout < 0) {
                idleTimeout = 600_000L;
            }
            if (maxLifetime < 0) {
                maxLifetime = 1_800_000L;
            }
        }
    }

    /** Convenience: primary JDBC URL. */
    public String primaryJdbcUrl() {
        return primary.jdbcUrl();
    }

    /** Convenience: read-route JDBC URL (current default == primary). */
    public String readJdbcUrl() {
        return ha.readUrl(this);
    }
}
