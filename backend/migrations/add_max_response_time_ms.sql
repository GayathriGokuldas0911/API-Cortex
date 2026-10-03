-- Migration to add max_response_time_ms for latency-based health checks
ALTER TABLE api_configs ADD COLUMN max_response_time_ms INTEGER;
