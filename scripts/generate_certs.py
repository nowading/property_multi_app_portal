"""
Self-signed CA + service cert generation for mTLS (Phase C).

Outputs to <repo-root>/certs/:
    ca.crt, ca.key, ca.p12               (CA — trust anchor for clients)
    ml-container.crt, ml-container.key   (server cert signed by CA)
    ml-container.p12                     (key + cert + chain bundle)

Idempotent: re-runs only regenerate files within 30 days of expiry.
The CA key is reused across regenerations so existing clients continue
to trust new server certs.

Usage:
    python scripts/generate_certs.py
    python scripts/generate_certs.py --force     # regenerate now
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CERTS_DIR = REPO_ROOT / "certs"

CA_DAYS = 1825         # 5 years
SERVER_DAYS = 365      # 1 year
RENEWAL_WINDOW_DAYS = 30

PKCS12_PASSWORD = b""  # Empty password — convenience for local dev


def step(msg: str) -> None:
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def parse_cert_expiry(cert_path: Path) -> datetime.datetime | None:
    """Return the cert's notAfter as a UTC datetime, or None if unreadable."""
    if not cert_path.exists():
        return None
    try:
        cert = x509.load_pem_x509_certificate(cert_path.read_bytes())
    except Exception:
        return None
    return cert.not_valid_after_utc


def needs_renewal(cert_path: Path) -> bool:
    expiry = parse_cert_expiry(cert_path)
    if expiry is None:
        return True
    days_left = (expiry - datetime.datetime.now(datetime.timezone.utc)).total_seconds() / 86400
    return days_left < RENEWAL_WINDOW_DAYS


def generate_rsa_key(bits: int = 2048) -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=bits)


def write_key(key: rsa.RSAPrivateKey, path: Path) -> None:
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    path.write_bytes(pem)


def write_cert_pem(cert: x509.Certificate, path: Path) -> None:
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


def build_ca(ca_key: rsa.RSAPrivateKey) -> x509.Certificate:
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "PropertyPortal"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Internal"),
        x509.NameAttribute(NameOID.COMMON_NAME, "property-portal-ca"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=1))
        .not_valid_after(now + datetime.timedelta(days=CA_DAYS))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                key_encipherment=False,
                data_encipherment=False,
                content_commitment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),
            critical=False,
        )
        .sign(private_key=ca_key, algorithm=hashes.SHA256())
    )
    write_cert_pem(cert, CERTS_DIR / "ca.crt")
    return cert


def build_server(ca_cert: x509.Certificate, ca_key: rsa.RSAPrivateKey) -> x509.Certificate:
    key = generate_rsa_key()
    write_key(key, CERTS_DIR / "ml-container.key")

    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "PropertyPortal"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Internal"),
        x509.NameAttribute(NameOID.COMMON_NAME, "ml-container"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    san = x509.SubjectAlternativeName([
        x509.DNSName("ml-container"),  # Docker network hostname
        x509.DNSName("localhost"),      # in-container curl tests
        x509.IPAddress(__import__("ipaddress").IPv4Address("127.0.0.1")),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=1))
        .not_valid_after(now + datetime.timedelta(days=SERVER_DAYS))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([x509.ExtendedKeyUsageOID.SERVER_AUTH,
                                    x509.ExtendedKeyUsageOID.CLIENT_AUTH]),
            critical=False,
        )
        .add_extension(san, critical=False)
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(key.public_key()),
            critical=False,
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
            critical=False,
        )
        .sign(private_key=ca_key, algorithm=hashes.SHA256())
    )
    write_cert_pem(cert, CERTS_DIR / "ml-container.crt")
    return cert


def write_pkcs12_truststore_java(ca_cert_pem_path: Path, out_path: Path) -> bool:
    """Use a JDK ``keytool`` binary to create a proper PKCS#12 trust store
    from a PEM cert.

    The Python ``cryptography`` library can only emit PKCS#12 bundles that
    contain a *key*+cert entry (not a trusted-cert entry), so the JDK
    TrustManagerFactory will not trust the cert when loaded from such a
    file. Falling back to ``keytool`` produces a proper trust store that
    the JDK treats as authoritative.

    Returns True on success. Returns False when ``keytool`` is not on PATH
    — callers should fall back to the Python-emitted bundle and accept that
    the JDK will need the alternative ``loadPemTrustStore`` code path.
    """
    import shutil
    import subprocess

    keytool = shutil.which("keytool")
    if not keytool:
        return False

    # Create an empty PKCS#12 trust store first by initialising one with
    # ``-importpassword`` (or use ``-genkeypair`` then delete the key — but
    # the cleanest is ``-importcert`` into a fresh store).
    # ``keytool -importcert`` requires the store to exist; we use
    # ``-storetype PKCS12`` with ``-storepass changeit`` and let keytool
    # create the file on first import.
    cmd = [
        keytool,
        "-importcert",
        "-noprompt",
        "-alias", "property-portal-ca",
        "-file", str(ca_cert_pem_path),
        "-keystore", str(out_path),
        "-storetype", "PKCS12",
        "-storepass", "changeit",
    ]
    try:
        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
            print(f"[warn] keytool import failed: {stderr.strip()}", file=sys.stderr)
            return False
        return True
    except FileNotFoundError:
        return False


def write_pkcs12_truststore(ca_cert: x509.Certificate, ca_key: rsa.RSAPrivateKey, path: Path) -> None:
    """Write a PKCS#12 trust store containing only the CA cert.

    Strategy: prefer ``keytool -importcert`` because it produces a proper
    trusted-cert entry that the JDK TrustManagerFactory can use directly.
    When ``keytool`` is unavailable we fall back to a ``cryptography``-
    emitted bundle (which is a key+cert entry, not a trust entry — the
    analytics-api Java client then has to re-export the cert via the
    ``loadPkcs12TrustStore`` workaround in ``MlTlsContextFactory``).
    """
    if write_pkcs12_truststore_java(CERTS_DIR / "ca.crt", path):
        return

    # Python-only fallback. The bundle below is recognised as a
    # PrivateKeyEntry by the JDK, so callers must re-export the cert as a
    # trusted-cert entry before passing it to TrustManagerFactory.
    import cryptography.hazmat.primitives.serialization.pkcs12 as pkcs12
    p12_data = pkcs12.serialize_key_and_certificates(
        name=b"ca-trust",
        key=ca_key,
        cert=ca_cert,
        cas=None,
        encryption_algorithm=serialization.NoEncryption(),
    )
    path.write_bytes(p12_data)


def write_pkcs12_bundle(
    key: rsa.RSAPrivateKey,
    cert: x509.Certificate,
    ca_cert: x509.Certificate,
    path: Path,
) -> None:
    """Write a PKCS#12 bundle: server key + cert + CA chain.

    Encryption password is a single space (PKCS12 requires non-empty password
    when using BestAvailableEncryption). The empty-password case would
    require NoEncryption which still works for JDK 21 keytool loading.
    """
    import cryptography.hazmat.primitives.serialization.pkcs12 as pkcs12
    # Use a 1-byte password for compatibility — " " (single space) is fine
    # and the analytics-api will be configured with the same value.
    bundle_password = b"changeit"  # Java's default keystore password
    p12_data = pkcs12.serialize_key_and_certificates(
        name=b"ml-container",
        key=key,
        cert=cert,
        cas=[ca_cert],
        encryption_algorithm=serialization.BestAvailableEncryption(bundle_password),
    )
    path.write_bytes(p12_data)
    # Persist the bundle password so the docker compose env can read it
    (CERTS_DIR / "ml-container.p12.password").write_bytes(bundle_password + b"\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Regenerate all certs now")
    args = parser.parse_args()

    CERTS_DIR.mkdir(exist_ok=True)
    step(f"Certs directory: {CERTS_DIR}")

    ca_key_path = CERTS_DIR / "ca.key"
    ca_crt_path = CERTS_DIR / "ca.crt"
    ca_p12_path = CERTS_DIR / "ca.p12"

    server_key_path = CERTS_DIR / "ml-container.key"
    server_crt_path = CERTS_DIR / "ml-container.crt"
    server_p12_path = CERTS_DIR / "ml-container.p12"

    # ---- CA --------------------------------------------------------------
    if args.force or not ca_key_path.exists():
        step("Generating CA key (2048-bit RSA)")
        ca_key = generate_rsa_key()
        write_key(ca_key, ca_key_path)
    else:
        step("CA key exists, reusing")
        ca_key = serialization.load_pem_private_key(ca_key_path.read_bytes(), password=None)

    if args.force or not ca_crt_path.exists() or needs_renewal(ca_crt_path):
        step(f"Generating self-signed CA cert (validity: {CA_DAYS} days)")
        ca_cert = build_ca(ca_key)
    else:
        step("CA cert exists and outside renewal window, reusing")
        ca_cert = x509.load_pem_x509_certificate(ca_crt_path.read_bytes())

    if args.force or not ca_p12_path.exists():
        step("Building CA PKCS12 trust store (ca.p12)")
        write_pkcs12_truststore(ca_cert, ca_key, ca_p12_path)
    else:
        step("ca.p12 exists, reusing")

    # ---- Server (ml-container) ------------------------------------------
    if args.force or not server_key_path.exists():
        step("Generating server key (2048-bit RSA)")
    else:
        step("Server key exists, reusing")
        server_key = serialization.load_pem_private_key(
            server_key_path.read_bytes(), password=None
        )

    if args.force or not server_crt_path.exists() or needs_renewal(server_crt_path):
        step(f"Generating server cert signed by CA (validity: {SERVER_DAYS} days)")
        server_cert = build_server(ca_cert, ca_key)
        # Reload the freshly written key
        server_key = serialization.load_pem_private_key(
            server_key_path.read_bytes(), password=None
        )
    else:
        step("Server cert exists and outside renewal window, reusing")
        server_cert = x509.load_pem_x509_certificate(server_crt_path.read_bytes())

    if args.force or not server_p12_path.exists():
        step("Building server PKCS12 bundle (ml-container.p12) — empty password")
        write_pkcs12_bundle(server_key, server_cert, ca_cert, server_p12_path)
    else:
        step("ml-container.p12 exists, reusing")

    # ---- Summary --------------------------------------------------------
    print()
    print(f"Certs under {CERTS_DIR}:")
    for p in sorted(CERTS_DIR.iterdir()):
        if p.is_file():
            print(f"  {p.name}  ({p.stat().st_size} bytes)")
    print()
    print("Mount in docker-compose.yml as read-only volumes:")
    print("  ./certs/ca.crt:/app/certs/ca.crt:ro                (estimator-api)")
    print("  ./certs/ca.p12:/app/certs/ca.p12:ro                (analytics-api)")
    print("  ./certs/ml-container.crt:/app/certs/ml-container.crt:ro  (ml-container)")
    print("  ./certs/ml-container.key:/app/certs/ml-container.key:ro  (ml-container)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
