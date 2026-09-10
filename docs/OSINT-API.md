# Public OSINT Profile API

Endpoints:
- `POST /api/osint/profile` with `{ "platform": "instagram", "username": "example" }`
- `GET /api/osint/profile?platform=instagram&username=example`

Supported platforms: YouTube, Instagram, TikTok, Facebook, Pinterest, X/Twitter, Reddit, X/Twitter, Reddit.

Only public/profile data that the platform exposes without authentication is returned. Private data is not bypassed. Missing fields are omitted; values are never fabricated.
