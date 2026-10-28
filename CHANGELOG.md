# Changelog

## 0.1.1 (2026-10-28)

- Removed the rankings operation: the API retired `/v1/rankings` (it answers 410 Gone), so it could never succeed.
- `limit` for search is now 1-50, the API's maximum; 51-100 used to fail with a validation error.

## 0.1.0 (2026-10-28)

- First release: `coworkingview` node with search, space, market rates, rankings and cities operations.
