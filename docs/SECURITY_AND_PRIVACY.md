# Security and privacy boundary

Phone input normalizes to E.164-style Indian numbers. PINs are Argon2id hashes via `pwdlib`; plaintext PINs are neither stored nor logged. Login returns the same 401 message for unknown number and wrong PIN, locks after five failures for fifteen minutes, creates expiring signed tokens with server-side session records, and audits login failures/successes without secrets.

Every protected endpoint checks a session and role at the API. The backend also checks a worker’s own patient assignment and contractor site scope. UI visibility is not treated as authorization. Sensitive record reads and writes are audited. Error responses avoid echoing health information.

The app uses SecureStore for a small token and an unencrypted Expo SQLite cache for authorized viewing records. It displays offline/cache state and disables all writes while offline. It must not be described as encrypted or safe for shared devices. Before real data, set a cache policy, expiry, secure-device requirement, logout clear behavior, and lost-device response.

Postgres is private to Docker. Do not publish it, commit `.env`, expose the API publicly, use HTTP outside isolated synthetic development, or log request bodies. A LAN is not a security boundary for real health data; approved TLS, firewall rules, host patching, secrets, backups, and security review are required.
