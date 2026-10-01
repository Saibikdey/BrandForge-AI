from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, SessionLocal, seed_initial_brand_data
from .migrations import run_migrations
from .routers import brands, campaigns, audits, approvals, memory, scheduling, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to safely migrate DB schema and seed initial brand data."""
    run_migrations(engine)
    db = SessionLocal()
    try:
        seed_initial_brand_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="BrandForge AI Engine",
    description="Backend API for Brand DNA extraction, Campaign Management, and AI Strategy Generation",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")] if settings.CORS_ORIGINS != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(brands.router)
app.include_router(brands.system_router)
app.include_router(campaigns.router)
app.include_router(campaigns.content_router)
app.include_router(audits.router)
app.include_router(approvals.router)
app.include_router(memory.router)
app.include_router(scheduling.router)
app.include_router(analytics.router)






@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint to verify backend service status."""
    return {"status": "healthy", "service": "BrandForge AI Backend", "version": "1.0.0"}
