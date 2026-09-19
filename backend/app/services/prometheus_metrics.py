from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response

# 1. Total Requests Counter: labeled by project_id, api_id, api_name, method, status_code
REQUEST_COUNT = Counter(
    "api_cortex_requests_total",
    "Total number of HTTP requests executed by API Cortex monitoring engine",
    ["project_id", "api_id", "api_name", "method", "status_code"]
)

# 2. Total Errors Counter: labeled by project_id, api_id, api_name, issue_type
ERROR_COUNT = Counter(
    "api_cortex_errors_total",
    "Total number of monitoring errors and schema drift issues detected",
    ["project_id", "api_id", "api_name", "issue_type"]
)

# 3. Response Time Histogram: labeled by project_id, api_id, api_name, method
RESPONSE_TIME = Histogram(
    "api_cortex_response_time_seconds",
    "Target API response time latency in seconds measured around HTTPX call",
    ["project_id", "api_id", "api_name", "method"],
    buckets=(0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 10.0)
)

# 4. Availability Gauge: labeled by project_id, api_id, api_name (1 = Healthy, 0 = Unhealthy/Issue)
AVAILABILITY_GAUGE = Gauge(
    "api_cortex_api_availability",
    "Target API health status (1 if last check succeeded and valid schema, 0 if error/drift)",
    ["project_id", "api_id", "api_name"]
)

# 5. Last Status Code Gauge: labeled by project_id, api_id, api_name
STATUS_CODE_GAUGE = Gauge(
    "api_cortex_last_status_code",
    "HTTP status code returned by the target API in the most recent check",
    ["project_id", "api_id", "api_name"]
)


def record_monitoring_metrics(
    project_id: int,
    api_id: int,
    api_name: str,
    method: str,
    status_code: int,
    response_time_seconds: float,
    is_healthy: bool,
    issue_type: str = None
):
    """Helper to update Prometheus time-series metrics."""
    pid = str(project_id)
    aid = str(api_id)
    scode = str(status_code) if status_code else "0"

    # Increment request counter
    REQUEST_COUNT.labels(
        project_id=pid,
        api_id=aid,
        api_name=api_name,
        method=method,
        status_code=scode
    ).inc()

    # Observe latency
    if response_time_seconds is not None and response_time_seconds >= 0:
        RESPONSE_TIME.labels(
            project_id=pid,
            api_id=aid,
            api_name=api_name,
            method=method
        ).observe(response_time_seconds)

    # Set status code gauge
    if status_code is not None:
        STATUS_CODE_GAUGE.labels(
            project_id=pid,
            api_id=aid,
            api_name=api_name
        ).set(status_code)

    # Set availability gauge
    AVAILABILITY_GAUGE.labels(
        project_id=pid,
        api_id=aid,
        api_name=api_name
    ).set(1.0 if is_healthy else 0.0)

    # Record error count if issue type present
    if not is_healthy and issue_type:
        ERROR_COUNT.labels(
            project_id=pid,
            api_id=aid,
            api_name=api_name,
            issue_type=issue_type
        ).inc()


def get_metrics_response() -> Response:
    """Renders Prometheus metrics endpoint payload."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
