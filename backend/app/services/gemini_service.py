import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError
import httpx

from app.config import settings
from app.models.ai_diagnosis import AiDiagnosis
from app.models.api_config import ApiConfig
from app.models.issue import Issue
from app.models.monitoring_log import MonitoringLog
from app.models.project import Project

logger = logging.getLogger("api_cortex.gemini_service")

DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"


# ==============================================================================
# Custom Exceptions (Never leak API keys in messages or stack traces)
# ==============================================================================
class GeminiServiceError(Exception):
    """Base exception for all Gemini service errors."""
    pass


class GeminiAPIKeyMissingError(GeminiServiceError):
    """Raised when Gemini API key is missing or not configured."""
    pass


class GeminiInvalidKeyError(GeminiServiceError):
    """Raised when the Gemini API key is rejected as invalid."""
    pass


class GeminiQuotaExceededError(GeminiServiceError):
    """Raised when Gemini quota or rate limits are exhausted."""
    pass


class GeminiTimeoutError(GeminiServiceError):
    """Raised when a request to Gemini times out."""
    pass


class GeminiNetworkError(GeminiServiceError):
    """Raised on low-level connection or network failures communicating with Gemini."""
    pass


class GeminiMalformedResponseError(GeminiServiceError):
    """Raised when Gemini returns a response that cannot be parsed as structured diagnosis."""
    pass


class IssueNotFoundError(GeminiServiceError):
    """Raised when the requested issue cannot be found in PostgreSQL."""
    pass


class InvalidIssueStateError(GeminiServiceError):
    """Raised when attempting to diagnose an issue in an invalid state (e.g. healthy/resolved)."""
    pass


# ==============================================================================
# Structured Output Schema
# ==============================================================================
class GeminiDiagnosisResponse(BaseModel):
    root_cause: str = Field(description="Clear, technical root cause of the failure or schema drift.")
    explanation: str = Field(description="Detailed technical explanation of what failed and why.")
    severity: str = Field(description="Severity rating: LOW, MEDIUM, HIGH, or CRITICAL.")
    possible_impact: str = Field(description="Impact on downstream services, clients, or business operations.")
    recommended_action: str = Field(description="Specific, actionable remediation steps or code/config fix.")

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v: Any) -> str:
        if isinstance(v, str):
            v_upper = v.strip().upper()
            if v_upper in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
                return v_upper
            # Map common variants
            if "CRIT" in v_upper:
                return "CRITICAL"
            if "HIGH" in v_upper:
                return "HIGH"
            if "MED" in v_upper:
                return "MEDIUM"
            if "LOW" in v_upper:
                return "LOW"
        return "HIGH"


# ==============================================================================
# Helper Utilities
# ==============================================================================
def sanitize_text(text: str, sensitive_strings: Optional[List[str]] = None) -> str:
    """
    Ensures API keys or credentials never leak into logs, output, or error messages.
    """
    if not text:
        return ""
    sanitized = text
    if sensitive_strings:
        for s in sensitive_strings:
            if s and len(s) > 4:
                sanitized = sanitized.replace(s, "***REDACTED_API_KEY***")

    # Generic regex check for Gemini AI keys (AIzaSy...)
    sanitized = re.sub(r"AIzaSy[A-Za-z0-9_-]{33}", "***REDACTED_API_KEY***", sanitized)
    return sanitized


def build_diagnostic_payload(issue: Issue) -> Dict[str, Any]:
    """
    Extracts ONLY the relevant structured issue and contract context required
    for diagnosis. CRITICAL: NEVER includes Prometheus time-series metrics.
    """
    api_config = issue.api_config
    monitoring_log = issue.monitoring_log

    # 1. API endpoint contract context
    api_info = {
        "api_id": api_config.id if api_config else None,
        "name": api_config.name if api_config else "Unknown API",
        "url": api_config.url if api_config else "N/A",
        "method": api_config.method if api_config else "GET",
        "expected_status_code": api_config.expected_status_code if api_config else 200,
        "polling_interval_seconds": api_config.polling_interval_seconds if api_config else None,
    }

    # 2. Issue specifics
    issue_info = {
        "issue_id": issue.id,
        "project_id": issue.project_id,
        "issue_type": issue.issue_type,
        "actual_status_code": issue.status_code,
        "error_details": issue.error_details,
        "created_at": issue.created_at.isoformat() if issue.created_at else None,
    }

    # 3. Schema drift details (if present)
    schema_context: Dict[str, Any] = {}
    if api_config and api_config.expected_schema:
        schema_context["expected_schema"] = api_config.expected_schema

    if issue.schema_validation_results:
        schema_context["drift_summary"] = issue.schema_validation_results.get("summary")
        schema_context["drift_details"] = issue.schema_validation_results.get("drift_details", [])

    # 4. Response snippet from monitoring log (truncated to avoid prompt bloat)
    response_context: Dict[str, Any] = {}
    if monitoring_log:
        response_context["response_time_ms"] = monitoring_log.response_time_ms
        if monitoring_log.response_body is not None:
            body_val = monitoring_log.response_body
            if isinstance(body_val, (dict, list)):
                # Truncate string representation if too large
                body_str = json.dumps(body_val)
                if len(body_str) > 2000:
                    response_context["response_body_sample"] = body_str[:2000] + "... [truncated]"
                else:
                    response_context["response_body_sample"] = body_val
            else:
                response_context["response_body_sample"] = str(body_val)[:1000]

    return {
        "api_info": api_info,
        "issue_info": issue_info,
        "schema_context": schema_context,
        "response_context": response_context,
    }


def format_gemini_prompt(context: Dict[str, Any]) -> str:
    """Formats the prompt sent to Gemini with issue details and contract expectations."""
    api_info = context["api_info"]
    issue_info = context["issue_info"]
    schema_context = context["schema_context"]
    response_context = context["response_context"]

    prompt_parts = [
        "You are API Cortex's AI Diagnostic Engine. Analyze the following API failure or contract drift.",
        "",
        "=== TARGET API INFORMATION ===",
        f"- Name: {api_info['name']}",
        f"- Target Endpoint: {api_info['method']} {api_info['url']}",
        f"- Expected HTTP Status: {api_info['expected_status_code']}",
        "",
        "=== DETECTED ISSUE DETAILS ===",
        f"- Issue ID: {issue_info['issue_id']}",
        f"- Issue Type: {issue_info['issue_type']}",
        f"- Received HTTP Status: {issue_info['actual_status_code']}",
        f"- Error Message: {issue_info['error_details']}",
    ]

    if schema_context:
        prompt_parts.append("")
        prompt_parts.append("=== CONTRACT & SCHEMA VALIDATION CONTEXT ===")
        if "expected_schema" in schema_context:
            prompt_parts.append(f"Expected JSON Schema:\n{json.dumps(schema_context['expected_schema'], indent=2)}")
        if "drift_summary" in schema_context and schema_context["drift_summary"]:
            prompt_parts.append(f"Drift Summary: {schema_context['drift_summary']}")
        if "drift_details" in schema_context and schema_context["drift_details"]:
            prompt_parts.append(f"Field-Level Drift Details:\n{json.dumps(schema_context['drift_details'], indent=2)}")

    if response_context:
        prompt_parts.append("")
        prompt_parts.append("=== RESPONSE PAYLOAD / ERROR CONTEXT ===")
        if "response_time_ms" in response_context:
            prompt_parts.append(f"Latency: {response_context['response_time_ms']} ms")
        if "response_body_sample" in response_context:
            sample = response_context["response_body_sample"]
            if isinstance(sample, (dict, list)):
                prompt_parts.append(f"Response Payload Sample:\n{json.dumps(sample, indent=2)}")
            else:
                prompt_parts.append(f"Response Payload Sample:\n{sample}")

    prompt_parts.extend([
        "",
        "=== INSTRUCTIONS ===",
        "Provide a structured Root Cause Analysis (RCA) in JSON format with:",
        "1. root_cause: Direct, technical root cause of why this failure or drift occurred.",
        "2. explanation: In-depth explanation of the failure mechanism and divergence from contract.",
        "3. severity: One of 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'. Use 'CRITICAL' for complete outages or essential key loss, 'HIGH' for 4xx/5xx or breaking contract drifts, 'MEDIUM' for non-breaking type/property drift, 'LOW' for minor cosmetic anomalies.",
        "4. possible_impact: Operational and user-facing impact on downstream consumers and clients.",
        "5. recommended_action: Step-by-step, actionable remediation recommendation (code patch, config change, or infrastructure fix)."
    ])

    return "\n".join(prompt_parts)


def parse_gemini_response_text(raw_text: str) -> GeminiDiagnosisResponse:
    """
    Parses and validates the Gemini text response into a structured GeminiDiagnosisResponse.
    Strips any code block markdown wrappers (` ```json ... ``` `) if present.
    """
    if not raw_text or not raw_text.strip():
        raise GeminiMalformedResponseError("Gemini returned an empty response.")

    cleaned = raw_text.strip()
    # Strip markdown code fences if wrapped in ```json ... ``` or ``` ... ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as jde:
        raise GeminiMalformedResponseError(f"Failed to parse Gemini response as JSON: {str(jde)}") from jde

    if not isinstance(data, dict):
        raise GeminiMalformedResponseError(f"Expected JSON object from Gemini, got {type(data).__name__}")

    # Ensure required fields exist or map fallbacks
    try:
        return GeminiDiagnosisResponse.model_validate(data)
    except Exception as ve:
        raise GeminiMalformedResponseError(f"Gemini response failed schema validation: {str(ve)}") from ve


# ==============================================================================
# Gemini Client & API Invocation
# ==============================================================================
def get_effective_gemini_api_key(api_key: Optional[str] = None) -> str:
    """
    Retrieves the Gemini API key from explicit argument, settings, or .env.
    Validates that the key is present and not a dummy placeholder.
    """
    if api_key and api_key.strip() not in {"your_gemini_api_key_here", "TODO", "PLACEHOLDER"}:
        return api_key.strip()
    
    for key_attr in ["GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY"]:
        key = getattr(settings, key_attr, "") or os.environ.get(key_attr, "")
        key = key.strip()
        if key and key not in {"your_gemini_api_key_here", "TODO", "PLACEHOLDER"}:
            return key

    raise GeminiAPIKeyMissingError(
        "Gemini API key is not configured. Please set a valid GEMINI_API_KEY in your .env file."
    )


def call_gemini_api(
    prompt: str,
    api_key: str,
    model: str = DEFAULT_GEMINI_MODEL,
    client_override: Optional[Any] = None
) -> GeminiDiagnosisResponse:
    """
    Invokes the Google Gemini API using google-genai SDK with structured output schema.
    Handles network errors, timeouts, invalid API keys, and rate limits gracefully.
    """
    try:
        if client_override is not None:
            client = client_override
        else:
            client = genai.Client(api_key=api_key)

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiDiagnosisResponse,
            temperature=0.2,
        )

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )

        raw_text = response.text if hasattr(response, "text") else str(response)
        return parse_gemini_response_text(raw_text)

    except (ClientError, APIError) as e:
        error_str = str(e).lower()
        # Sanitize error message so API key is never exposed
        clean_msg = sanitize_text(str(e), [api_key])

        if any(term in error_str for term in ["api_key_invalid", "api key not valid", "invalid api key", "403"]):
            raise GeminiInvalidKeyError("Provided Gemini API key is invalid or unauthorized.") from e
        elif any(term in error_str for term in ["resource_exhausted", "quota", "rate limit", "429"]):
            raise GeminiQuotaExceededError("Gemini API quota or rate limit exceeded. Please retry later.") from e
        else:
            raise GeminiServiceError(f"Gemini API error occurred: {clean_msg}") from e

    except (httpx.TimeoutException, TimeoutError) as e:
        raise GeminiTimeoutError("Gemini API request timed out after waiting for response.") from e

    except (httpx.ConnectError, ConnectionError) as e:
        clean_msg = sanitize_text(str(e), [api_key])
        raise GeminiNetworkError(f"Network error connecting to Gemini API: {clean_msg}") from e

    except GeminiMalformedResponseError:
        raise

    except Exception as e:
        clean_msg = sanitize_text(str(e), [api_key])
        raise GeminiServiceError(f"Unexpected error in Gemini AI service: {clean_msg}") from e


# ==============================================================================
# Core Service Functions
# ==============================================================================
def get_issue_for_diagnosis(db: Session, issue_id: int) -> Issue:
    """
    Retrieves and validates an issue from PostgreSQL for AI diagnosis.
    Ensures healthy or resolved responses are never diagnosed.
    """
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise IssueNotFoundError(f"Issue with ID {issue_id} not found in database.")

    # Rule: Do not automatically send healthy API responses to Gemini
    if issue.status == "RESOLVED":
        raise InvalidIssueStateError(f"Issue {issue_id} has already been RESOLVED and cannot be diagnosed.")

    if issue.issue_type in {"HEALTHY", "CLEAN", "NO_ERROR"}:
        raise InvalidIssueStateError(f"Issue {issue_id} represents a healthy state; AI diagnosis is not applicable.")

    return issue


def diagnose_issue(
    db: Session,
    issue_id: int,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    client_override: Optional[Any] = None
) -> AiDiagnosis:
    """
    Retrieves the detected issue from PostgreSQL, performs Root Cause Analysis (RCA)
    and remediation generation via Google Gemini, stores the diagnosis in the PostgreSQL
    ai_diagnoses table associated with the issue, API, and project, and marks the issue as DIAGNOSED.
    """
    # 1. Fetch and validate issue from PostgreSQL
    issue = get_issue_for_diagnosis(db, issue_id)

    # 2. Try all available API keys
    keys_to_try = []
    if api_key and api_key.strip() not in {"your_gemini_api_key_here", "TODO", "PLACEHOLDER"}:
        keys_to_try.append(api_key.strip())
    
    for key_attr in ["GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY"]:
        k = getattr(settings, key_attr, "") or os.environ.get(key_attr, "")
        k = k.strip()
        if k and k not in {"your_gemini_api_key_here", "TODO", "PLACEHOLDER"} and k not in keys_to_try:
            keys_to_try.append(k)

    if not keys_to_try:
        raise GeminiAPIKeyMissingError("Gemini API key is not configured. Please set a valid GEMINI_API_KEY in your .env file.")

    effective_model = model or os.environ.get("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL

    # 3. Build focused diagnostic payload (NO Prometheus metrics included)
    context = build_diagnostic_payload(issue)
    prompt = format_gemini_prompt(context)

    # 4. Invoke Gemini AI with fallback
    diagnosis_response = None
    last_error = None
    for k in keys_to_try:
        try:
            diagnosis_response = call_gemini_api(
                prompt=prompt,
                api_key=k,
                model=effective_model,
                client_override=client_override
            )
            break # Success!
        except (GeminiInvalidKeyError, GeminiQuotaExceededError) as e:
            last_error = e
            logger.warning(f"Key failed, trying next. Error: {e}")
            continue # Try next key
            
    if diagnosis_response is None:
        if last_error:
            raise last_error
        raise GeminiServiceError("Failed to get diagnosis using all available API keys.")

    # 5. Persist diagnosis in PostgreSQL (associate with issue, API config, and project)
    existing_diagnosis = db.query(AiDiagnosis).filter(AiDiagnosis.issue_id == issue.id).first()
    if existing_diagnosis:
        existing_diagnosis.project_id = issue.project_id
        existing_diagnosis.api_config_id = issue.api_config_id
        existing_diagnosis.root_cause = diagnosis_response.root_cause
        existing_diagnosis.explanation = diagnosis_response.explanation
        existing_diagnosis.severity = diagnosis_response.severity
        existing_diagnosis.possible_impact = diagnosis_response.possible_impact
        existing_diagnosis.recommended_action = diagnosis_response.recommended_action
        existing_diagnosis.raw_ai_response = diagnosis_response.model_dump()
        ai_record = existing_diagnosis
    else:
        ai_record = AiDiagnosis(
            project_id=issue.project_id,
            api_config_id=issue.api_config_id,
            issue_id=issue.id,
            root_cause=diagnosis_response.root_cause,
            explanation=diagnosis_response.explanation,
            severity=diagnosis_response.severity,
            possible_impact=diagnosis_response.possible_impact,
            recommended_action=diagnosis_response.recommended_action,
            raw_ai_response=diagnosis_response.model_dump()
        )
        db.add(ai_record)

    # Update issue status to DIAGNOSED
    issue.status = "DIAGNOSED"

    db.commit()
    db.refresh(ai_record)

    return ai_record


def diagnose_issue_safe(
    db: Session,
    issue_id: int,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    client_override: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Safe wrapper around diagnose_issue.
    Guarantees that Gemini failures will NEVER crash the caller or monitoring engine.
    """
    try:
        diagnosis = diagnose_issue(
            db=db,
            issue_id=issue_id,
            api_key=api_key,
            model=model,
            client_override=client_override
        )
        return {
            "success": True,
            "diagnosis_id": diagnosis.id,
            "issue_id": diagnosis.issue_id,
            "api_config_id": diagnosis.api_config_id,
            "project_id": diagnosis.project_id,
            "severity": diagnosis.severity,
            "root_cause": diagnosis.root_cause,
            "recommended_action": diagnosis.recommended_action,
            "error": None
        }
    except Exception as e:
        error_msg = sanitize_text(str(e), [api_key] if api_key else None)
        logger.error(f"Safe diagnosis execution caught error for issue {issue_id}: {error_msg}")
        return {
            "success": False,
            "diagnosis_id": None,
            "issue_id": issue_id,
            "api_config_id": None,
            "project_id": None,
            "severity": None,
            "root_cause": None,
            "recommended_action": None,
            "error": error_msg,
            "error_type": type(e).__name__
        }
