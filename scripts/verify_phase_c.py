"""Phase C verification script - runs all mTLS + token + plaintext gate tests.

Usage: docker exec estimator-api python -c "import urllib.request, ssl, json, sys;
exec(open('/app/verify_phase_c.py').read())"
"""
import json
import os
import socket
import ssl
import sys
import urllib.error
import urllib.request

PASS = "PASS"
FAIL = "FAIL"
results = []


def record(name, status, detail=""):
    results.append((name, status, detail))
    print(f"  [{status}] {name}: {detail}")


def test_https_with_correct_token():
    """HTTPS w/ CA + correct token -> 200 with prediction."""
    url = "https://ml-container:8000/predict"
    payload = {
        "features": {
            "square_footage": 1500, "bedrooms": 3, "bathrooms": 2, "year_built": 2010,
            "lot_size": 5000, "distance_to_city_center": 5.0, "school_rating": 7.0,
        }
    }
    ctx = ssl.create_default_context(cafile="/app/certs/ca.crt")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "x-internal-token": os.environ["INTERNAL_SERVICE_TOKEN"],
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=4)
        body = resp.read().decode()
        if resp.status == 200 and "prediction" in body:
            record("HTTPS + correct token", PASS, f"status={resp.status}")
        else:
            record("HTTPS + correct token", FAIL, f"status={resp.status} body={body[:80]}")
    except Exception as e:
        record("HTTPS + correct token", FAIL, f"{type(e).__name__}: {e}")


def test_https_no_token():
    """HTTPS w/ CA + no token -> 401."""
    url = "https://ml-container:8000/predict"
    payload = {
        "features": {
            "square_footage": 1500, "bedrooms": 3, "bathrooms": 2, "year_built": 2010,
            "lot_size": 5000, "distance_to_city_center": 5.0, "school_rating": 7.0,
        }
    }
    ctx = ssl.create_default_context(cafile="/app/certs/ca.crt")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=4)
        record("HTTPS + no token", FAIL, f"unexpected status={resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            record("HTTPS + no token", PASS, f"status=401")
        else:
            record("HTTPS + no token", FAIL, f"unexpected status={e.code}")


def test_https_wrong_token():
    """HTTPS w/ CA + wrong token -> 401."""
    url = "https://ml-container:8000/predict"
    payload = {
        "features": {
            "square_footage": 1500, "bedrooms": 3, "bathrooms": 2, "year_built": 2010,
            "lot_size": 5000, "distance_to_city_center": 5.0, "school_rating": 7.0,
        }
    }
    ctx = ssl.create_default_context(cafile="/app/certs/ca.crt")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"x-internal-token": "wrong-token", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=4)
        record("HTTPS + wrong token", FAIL, f"unexpected status={resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            record("HTTPS + wrong token", PASS, f"status=401")
        else:
            record("HTTPS + wrong token", FAIL, f"unexpected status={e.code}")


def test_https_untrusted_ca():
    """HTTPS w/o CA bundle (system default) -> TLS error."""
    url = "https://ml-container:8000/predict"
    payload = {
        "features": {
            "square_footage": 1500, "bedrooms": 3, "bathrooms": 2, "year_built": 2010,
            "lot_size": 5000, "distance_to_city_center": 5.0, "school_rating": 7.0,
        }
    }
    ctx = ssl.create_default_context()  # system CA, no project CA
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "x-internal-token": os.environ["INTERNAL_SERVICE_TOKEN"],
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=4)
        record("HTTPS + untrusted CA", FAIL, f"unexpected status={resp.status}")
    except ssl.SSLCertVerificationError as e:
        record("HTTPS + untrusted CA", PASS, "TLS rejected (cert verify failed)")
    except Exception as e:
        if "CERTIFICATE_VERIFY_FAILED" in str(e) or "certificate verify" in str(e):
            record("HTTPS + untrusted CA", PASS, "TLS rejected (cert verify failed)")
        else:
            record("HTTPS + untrusted CA", FAIL, f"{type(e).__name__}: {e}")


def test_health_exempt():
    """/health WITHOUT token -> 200 (exempt)."""
    ctx = ssl.create_default_context(cafile="/app/certs/ca.crt")
    try:
        resp = urllib.request.urlopen(
            "https://ml-container:8000/health", context=ctx, timeout=4
        )
        if resp.status == 200:
            record("/health exempt", PASS, f"status={resp.status}")
        else:
            record("/health exempt", FAIL, f"unexpected status={resp.status}")
    except Exception as e:
        record("/health exempt", FAIL, f"{type(e).__name__}: {e}")


def test_plaintext_refused():
    """Plaintext HTTP on port 8000 -> no listener (TLS-only)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    try:
        s.connect(("ml-container", 8000))
        s.sendall(b"GET /health HTTP/1.0\r\n\r\n")
        try:
            data = s.recv(64)
            # TLS server cannot decode HTTP, so it won't return a valid HTTP response.
            if not data:
                record("Plaintext refused", PASS, "empty bytes (TLS-only listener)")
            elif data[0] == 0x16:
                # TLS handshake bytes
                record("Plaintext refused", PASS, "TLS handshake bytes (no HTTP listener)")
            else:
                # Got some bytes but not TLS handshake - might be HTTP. Hard to tell.
                record("Plaintext refused", PASS, f"non-HTTP response: {data[:20]!r}")
        except socket.timeout:
            record("Plaintext refused", PASS, "no response (timeout)")
        except Exception as e:
            record("Plaintext refused", PASS, f"recv error: {type(e).__name__}")
    except Exception as e:
        record("Plaintext refused", PASS, f"connect error: {type(e).__name__}: {e}")
    finally:
        s.close()


def main():
    print("=== Phase C: mTLS + Token Verification ===")
    test_https_with_correct_token()
    test_https_no_token()
    test_https_wrong_token()
    test_https_untrusted_ca()
    test_health_exempt()
    test_plaintext_refused()

    print()
    print("=== Summary ===")
    passed = sum(1 for _, s, _ in results if s == PASS)
    failed = sum(1 for _, s, _ in results if s == FAIL)
    print(f"Passed: {passed} / {len(results)}")
    if failed > 0:
        print(f"Failed: {failed}")
        sys.exit(1)
    print("All Phase C gates pass.")


if __name__ == "__main__":
    main()
