import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Configure engine based on dialect
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(target_engine=None):
    """Initializes the database schema with migrations and seeds initial data."""
    from .migrations import run_migrations
    target_engine = target_engine or engine
    run_migrations(target_engine)
    db = SessionLocal()
    try:
        seed_initial_brand_data(db)
    finally:
        db.close()



def seed_initial_brand_data(db):
    """Seed default Arkiva Studio brand DNA and products if none exist."""
    from .models import Brand, Product

    existing_brand = db.query(Brand).first()
    if existing_brand:
        return

    brand_id = str(uuid.uuid4())
    brand = Brand(
        id=brand_id,
        name="Arkiva Studio",
        industry="Creative Software & Design Tools",
        founded="2019",
        stage="Growth",
        tagline='"Design without limits."',
        mission="Empower creative professionals with intelligent design tools.",
        completeness=82,
        values=["Craft", "Clarity", "Empowerment", "Innovation", "Community", "Integrity"],
        voice_traits=[
            {"trait": "Confident", "opposite": "Timid", "value": 78},
            {"trait": "Creative", "opposite": "Conservative", "value": 85},
            {"trait": "Approachable", "opposite": "Formal", "value": 62},
            {"trait": "Precise", "opposite": "Casual", "value": 71},
        ],
        voice_descriptors=[
            "Expert but accessible",
            "Inspiring",
            "Honest",
            "Forward-thinking",
            "Warm but professional",
            "Empowering",
        ],
        messaging_pillars=[
            {
                "title": "Creative Empowerment",
                "desc": "We give creative professionals the tools to realize their vision without technical barriers.",
            },
            {
                "title": "Design Intelligence",
                "desc": "Arkiva learns from your creative patterns to suggest smarter, faster workflows.",
            },
            {
                "title": "Community & Craft",
                "desc": "Great design is shaped by community. We celebrate makers, teachers, and creators.",
            },
        ],
        do_list=[
            "Speak directly to the creative's challenge",
            "Use specific, vivid examples",
            "Celebrate craft and attention to detail",
            "Reference real user outcomes",
            "Use confident, clear language",
        ],
        dont_list=[
            'Use jargon or buzzwords like "synergy"',
            "Make unsubstantiated claims",
            "Use pushy or salesy language",
            "Compare negatively to competitors",
            "Oversimplify professional design work",
        ],
        target_audience=[
            {
                "label": "Primary",
                "name": "The Professional Creative",
                "age": "28–42",
                "role": "Graphic designers, art directors, brand designers",
                "pain": "Too many tools, too little time, inconsistent output quality",
            },
            {
                "label": "Secondary",
                "name": "The Creative Entrepreneur",
                "age": "24–36",
                "role": "Freelancers, indie studio founders, content creators",
                "pain": "Scaling creative output without hiring a full team",
            },
        ],
        visual_identity={
            "colors": [
                {"name": "Obsidian", "hex": "#0A0908", "role": "Primary"},
                {"name": "Copper", "hex": "#C4813A", "role": "Accent"},
                {"name": "Cream", "hex": "#EDE8DF", "role": "Foreground"},
                {"name": "Slate", "hex": "#6B6560", "role": "Muted"},
            ],
            "typography": {
                "display": {"font": "Fraunces", "usage": "Display / Headings"},
                "body": {"font": "Inter", "usage": "Body / UI"},
            },
        },
    )
    db.add(brand)

    products = [
        Product(
            id=str(uuid.uuid4()),
            brand_id=brand_id,
            name="Arkiva Pro Suite",
            product_type="Core Product",
            price="$49/mo",
            description="Full-featured design workspace with AI-powered tools, smart templates, and collaboration.",
        ),
        Product(
            id=str(uuid.uuid4()),
            brand_id=brand_id,
            name="Arkiva Templates",
            product_type="Add-on",
            price="$12/mo",
            description="2,000+ professionally designed, brand-customizable templates for every platform.",
        ),
        Product(
            id=str(uuid.uuid4()),
            brand_id=brand_id,
            name="Arkiva Community",
            product_type="Platform",
            price="Free",
            description="Peer-to-peer learning, showcases, and design resources for the creative community.",
        ),
    ]
    for p in products:
        db.add(p)

    db.commit()
