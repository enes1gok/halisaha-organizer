# Supabase Postgres performance

Apply this rule when writing SQL, reviewing slow endpoints, defining indexes, or changing data access patterns backed by Supabase Postgres.

## Query rules

- **Avoid `SELECT *`:** Read only required columns to reduce I/O and transfer cost.
- **Filter early:** Push filters into SQL instead of filtering large sets in application code.
- **Paginate intentionally:** Prefer keyset/cursor pagination for large ordered lists; use offset only for small pages.
- **No N+1 patterns:** Replace repetitive per-row queries with joins, views, or RPC where appropriate.

## Indexing rules

- **Index hot predicates:** Add indexes for frequently filtered, joined, and ordered columns.
- **Use composite indexes deliberately:** Match left-to-right order with real query predicates.
- **Use partial indexes for skewed data:** For common filters (for example active rows), prefer partial indexes over broad ones when they reduce index size meaningfully.

## Validation rules

- **Explain before merge:** Use `EXPLAIN (ANALYZE, BUFFERS)` on critical queries and verify scan type and timing.
- **Measure after changes:** Compare before/after latency on the same query shape and realistic row counts.
- **Keep SQL readable:** Split complex queries with CTEs when it improves maintainability without harming plans.

## Performance checklist

```
- [ ] Critical list/detail queries avoid SELECT *
- [ ] Hot-path filters and joins are indexed
- [ ] Pagination strategy fits dataset size
- [ ] EXPLAIN ANALYZE reviewed for critical queries
- [ ] No obvious N+1 data access in touched flow
```
