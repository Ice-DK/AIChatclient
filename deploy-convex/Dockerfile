# Custom Convex Backend image med fixed permissions
# Dette er nødvendigt fordi det officielle image har permission issues i restricted Kubernetes

FROM ghcr.io/get-convex/convex-backend:latest AS source

# Brug Ubuntu 24.04 (Noble) som har glibc 2.39
FROM ubuntu:24.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r convex && useradd -r -g convex convex

# Create data directory
RUN mkdir -p /convex/data && chown -R convex:convex /convex

WORKDIR /convex

# Copy binaries from source image (de ligger i /convex/ mappen)
COPY --from=source /convex/convex-local-backend /convex/convex-local-backend
COPY --from=source /convex/run_backend.sh /convex/run_backend.sh
COPY --from=source /convex/generate_admin_key.sh /convex/generate_admin_key.sh
COPY --from=source /convex/generate_key /convex/generate_key

# Ensure execute permissions
RUN chmod +x /convex/convex-local-backend /convex/run_backend.sh /convex/generate_admin_key.sh /convex/generate_key \
    && chown -R convex:convex /convex

# Switch to non-root user
USER convex

# Default ports
EXPOSE 3210 3211

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3210/version || exit 1

# Run convex backend med environment variabler
# INSTANCE_NAME og INSTANCE_SECRET læses fra env
CMD ["/convex/convex-local-backend"]
