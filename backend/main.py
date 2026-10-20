from fastapi import FastAPI
from core.exceptions import SentinelException, sentinel_exception_handler, global_exception_handler
from core.logger import logger
from core.config import settings
from fastapi.middleware.cors import CORSMiddleware

from api import routes_repos, routes_prs, routes_agent, routes_stats
from scheduler.scheduler import start_scheduler, stop_scheduler

from db.database import engine, Base
import db.models  # Import all models to register with Base metadata

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.project_name,
        description="Agentic PR Intelligence Workflow API",
        version="1.0.0"
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Error handlers
    app.add_exception_handler(SentinelException, sentinel_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)

    # Routes
    app.include_router(routes_repos.router)
    app.include_router(routes_prs.router)
    app.include_router(routes_agent.router)
    app.include_router(routes_stats.router)

    @app.on_event("startup")
    async def startup_event():
        logger.info("server_startup", environment=settings.environment)
        
        # Automatically create SQLite tables on startup purely synchronously
        Base.metadata.create_all(bind=engine)
            
        start_scheduler()

    @app.on_event("shutdown")
    async def shutdown_event():
        stop_scheduler()
        logger.info("server_shutdown")

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "service": settings.project_name}

    return app

app = create_app()
