from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.core.config import settings
from app.db import check_database_connection, engine

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
def health_check():
    return {
        "status": "ok",
        "service": "autorag-evalops-backend",
        "project": settings.PROJECT_NAME,
        "version": settings.API_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/db")
def database_health_check():
    is_connected = check_database_connection()

    if not is_connected:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        )

    return {
        "status": "ok",
        "database": "connected",
    }


@router.get("/tables")
def database_tables_check():
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    """
                    select table_name
                    from information_schema.tables
                    where table_schema = 'public'
                    order by table_name
                    """
                )
            )

            tables = [row[0] for row in result.fetchall()]

        return {
            "status": "ok",
            "tables": tables,
            "count": len(tables),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )