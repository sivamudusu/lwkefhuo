from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from reint.api.deps import SnapshotStore, settings
from reint.api.routes import router
from reint.store.sqlite import SnapshotMissingError


def create_app(snapshot_path: Path | None = None) -> FastAPI:
    application = FastAPI(
        title="REint wind decision desk API",
        version=settings.version,
        description=(
            "Point-in-time wind forecast selection and reserve sizing from Elexon "
            "FUELHH actuals and WINDFOR forecast vintages."
        ),
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    application.state.snapshot_store = SnapshotStore(snapshot_path or settings.snapshot_path)

    if settings.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=False,
            allow_methods=["GET"],
            allow_headers=["*"],
        )

    @application.exception_handler(SnapshotMissingError)
    async def snapshot_missing(_: Any, exc: SnapshotMissingError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    application.include_router(router, prefix="/api")

    @application.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "service": "reint-api",
            "docs": "/api/docs",
            "health": "/api/health",
            "meta": "/api/meta",
        }

    return application


app = create_app()
