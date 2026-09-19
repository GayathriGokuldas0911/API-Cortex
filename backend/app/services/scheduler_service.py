import asyncio
import logging
from typing import Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.api_config import ApiConfig
from app.services.monitoring_service import execute_api_monitoring_check

logger = logging.getLogger("api_cortex.scheduler")
scheduler = AsyncIOScheduler()


async def poll_active_apis_task():
    """
    Background job triggered periodically to check all active API configurations across projects.
    Executes checks concurrently using asyncio tasks.
    """
    db: Session = SessionLocal()
    try:
        active_apis = db.query(ApiConfig).filter(ApiConfig.is_active == True).all()
        if not active_apis:
            return

        tasks = []
        for api in active_apis:
            # Create isolated async task per API
            tasks.append(asyncio.create_task(run_single_api_check_with_db(api.id)))

        # Run all active API checks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for idx, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(f"Error checking API ID {active_apis[idx].id}: {res}")

    except Exception as e:
        logger.error(f"Scheduler error in poll_active_apis_task: {e}")
    finally:
        db.close()


async def run_single_api_check_with_db(api_id: int) -> Dict[str, Any]:
    """Runs monitoring execution for a single API using an isolated database session."""
    db: Session = SessionLocal()
    try:
        api = db.query(ApiConfig).filter(ApiConfig.id == api_id, ApiConfig.is_active == True).first()
        if not api:
            return {"error": f"API ID {api_id} not found or inactive"}

        result = await execute_api_monitoring_check(api, db)
        return result
    except Exception as e:
        logger.error(f"Failed execution for API ID {api_id}: {e}")
        return {"error": str(e), "api_id": api_id}
    finally:
        db.close()


def start_monitoring_scheduler(interval_seconds: int = 15):
    """Starts the background AsyncIO scheduler."""
    if not scheduler.running:
        scheduler.add_job(
            poll_active_apis_task,
            "interval",
            seconds=interval_seconds,
            id="api_cortex_global_polling_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info("API Cortex Background Monitoring Scheduler started successfully.")


def stop_monitoring_scheduler():
    """Stops the background AsyncIO scheduler cleanly."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("API Cortex Background Monitoring Scheduler stopped.")
