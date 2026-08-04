# =============================================================================
# Analytics Redis — Distributed Cache Service
# =============================================================================
# Standalone Redis instance for analytics-api distributed caching.
# Provides in-memory data store with TTL-based expiration.
#
# Configuration:
#   - Password-protected (requirepass via docker-compose command)
#   - Max memory 256MB with allkeys-lru eviction policy
#   - Persistence disabled (cache-only, data is transient by design)
#   - AOF disabled for performance
# =============================================================================

FROM redis:7-alpine

# Security: run as non-root user
RUN addgroup -S redisgroup && adduser -S redisuser -G redisgroup

# Create data directory with correct permissions
RUN mkdir -p /data && chown -R redisuser:redisgroup /data

# Expose Redis port
EXPOSE 6379

# Switch to non-root user
USER redisuser

# Health check: verify Redis is responding
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD redis-cli ping || exit 1

# Default command (overridden by docker-compose with password)
CMD ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru", "--save", "", "--appendonly", "no"]