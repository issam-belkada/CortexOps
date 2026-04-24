from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# Using the PostgreSQL instance you likely already have from your previous projects
DATABASE_URL = "postgresql://user:password@localhost/monitoring_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id = Column(Integer, primary_key=True, index=True)
    instance = Column(String)
    cpu_value = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String) # e.g., "Detected", "Resolved", "Ignored"
    logs_summary = Column(String, nullable=True)

# Create the tables
Base.metadata.create_all(bind=engine)