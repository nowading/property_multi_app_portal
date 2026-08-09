package com.portal.analytics.adapters.mlclient;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;

/**
 * Phase C helper that builds an {@link SSLContext} which trusts the project
 * CA certificate.
 *
 * <p>Java's {@code javax.net.ssl} APIs use {@link KeyStore} for trust
 * material. We support two common input formats for the trust material:
 * <ul>
 *   <li><b>PKCS#12</b> ({@code .p12}) — produced by
 *       {@code scripts/generate_certs.py} via the {@code cryptography}
 *       library, which writes a key-and-cert entry (not a true trust
 *       store). We import the {@link KeyStore} and re-register each
 *       certificate as a trusted-cert entry so the JDK
 *       {@link TrustManagerFactory} actually trusts it.</li>
 *   <li><b>PEM</b> ({@code .crt} / {@code .pem}) — read directly via
 *       {@link CertificateFactory} and added to an in-memory
 *       {@link KeyStore} as trusted-cert entries.</li>
 * </ul>
 *
 * <p>An empty {@code trustStorePath} or a missing file causes the helper
 * to return {@code null} so callers can fall back to the JVM default
 * trust store (e.g. for local dev with a public CA or unit tests).
 */
public final class MlTlsContextFactory {

    private static final Logger log = LoggerFactory.getLogger(MlTlsContextFactory.class);

    private MlTlsContextFactory() {
        // utility class
    }

    /**
     * Build an {@link SSLContext} that trusts the certificates in the
     * file at {@code trustStorePath}. Returns {@code null} when the path
     * is blank, missing, or no trusted certificates can be loaded.
     *
     * @param trustStorePath  path to a {@code .p12} or {@code .pem} / {@code .crt} file
     * @param trustStorePassword  password for PKCS#12 (ignored for PEM; empty for trust stores)
     * @return  configured SSLContext, or {@code null} to fall back to JVM default
     */
    public static SSLContext build(String trustStorePath, String trustStorePassword) {
        if (trustStorePath == null || trustStorePath.isBlank()) {
            log.info("ml.service.trust-store-path is empty; falling back to JVM default trust store");
            return null;
        }
        Path path = Path.of(trustStorePath);
        if (!Files.exists(path)) {
            log.warn("ml.service.trust-store-path {} does not exist; falling back to JVM default trust store",
                    trustStorePath);
            return null;
        }
        try {
            KeyStore trustStore = loadTrustStore(path, trustStorePassword);
            int aliases = trustStore.size();
            if (aliases == 0) {
                log.warn("Trust store {} contains no certificates; falling back to JVM default", trustStorePath);
                return null;
            }

            TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                    TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, tmf.getTrustManagers(), null);
            log.info("ml.service.trust-store loaded: path={} aliasCount={}", trustStorePath, aliases);
            return sslContext;
        } catch (Exception e) {
            // Do not silently fall back to insecure — bubble up so the
            // misconfiguration is visible at startup.
            throw new IllegalStateException(
                    "Failed to build SSLContext from trust store " + trustStorePath
                            + ": " + e.getMessage(),
                    e);
        }
    }

    /**
     * Load a trust store from either PKCS#12 or PEM input.
     * <p>
     * For PKCS#12 we attempt to load with the supplied password. If the
     * file is a {@code cryptography}-style bundle (key+cert entry, no
     * separate trusted-cert entry) we re-export every certificate as a
     * trusted-cert entry into a fresh in-memory {@link KeyStore}.
     * <p>
     * For PEM we parse the file with {@link CertificateFactory} and add
     * each certificate to a fresh in-memory {@link KeyStore}.
     */
    private static KeyStore loadTrustStore(Path path, String trustStorePassword) throws Exception {
        String filename = path.getFileName().toString().toLowerCase();
        if (filename.endsWith(".p12") || filename.endsWith(".pfx")) {
            return loadPkcs12TrustStore(path, trustStorePassword);
        }
        return loadPemTrustStore(path);
    }

    private static KeyStore loadPkcs12TrustStore(Path path, String trustStorePassword) throws Exception {
        KeyStore source;
        try (InputStream in = Files.newInputStream(path)) {
            source = KeyStore.getInstance("PKCS12");
            char[] passwordChars = (trustStorePassword == null) ? new char[0] : trustStorePassword.toCharArray();
            source.load(in, passwordChars);
        }

        // Re-export each entry as a trusted-cert entry so the TrustManagerFactory
        // actually trusts them (PKCS#12 loaded with a key+cert entry is not a
        // trust store by default).
        KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
        trustStore.load(null, null);
        java.util.Enumeration<String> aliases = source.aliases();
        int trusted = 0;
        while (aliases.hasMoreElements()) {
            String alias = aliases.nextElement();
            Certificate cert = source.getCertificate(alias);
            if (cert == null) {
                continue;
            }
            String trustAlias = "trusted-cert-" + trusted++;
            trustStore.setCertificateEntry(trustAlias, cert);
        }
        return trustStore;
    }

    private static KeyStore loadPemTrustStore(Path path) throws Exception {
        CertificateFactory cf = CertificateFactory.getInstance("X.509");
        KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
        trustStore.load(null, null);
        int trusted = 0;
        try (InputStream in = Files.newInputStream(path)) {
            for (Certificate cert : cf.generateCertificates(in)) {
                String trustAlias = "trusted-cert-" + trusted++;
                trustStore.setCertificateEntry(trustAlias, cert);
            }
        }
        return trustStore;
    }

    /**
     * Visible for testing. Returns the trust managers derived from the
     * supplied trust store file. Returns an empty array if the helper
     * would fall back to the JVM default (i.e. no custom trust store).
     */
    public static TrustManager[] trustManagers(String trustStorePath, String trustStorePassword) {
        if (trustStorePath == null || trustStorePath.isBlank()) {
            return new TrustManager[0];
        }
        Path path = Path.of(trustStorePath);
        if (!Files.exists(path)) {
            return new TrustManager[0];
        }
        try {
            KeyStore trustStore = loadTrustStore(path, trustStorePassword);
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                    TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);
            return tmf.getTrustManagers();
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Failed to load trust managers from " + trustStorePath + ": " + e.getMessage(),
                    e);
        }
    }
}
