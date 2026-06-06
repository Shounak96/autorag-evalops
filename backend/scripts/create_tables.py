from app.db import Base, enable_pgvector_extension, engine

# Import models so SQLAlchemy knows about all tables.
from app import models  # noqa: F401


def main():
    print("Enabling pgvector extension...")
    enable_pgvector_extension()

    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    print("Database tables created successfully.")


if __name__ == "__main__":
    main()