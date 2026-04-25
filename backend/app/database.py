from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# Replace with your actual credentials
DATABASE_URL = "postgresql://postgres:123456@localhost:5432/monitoring_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AnomalyRecord(Base):
    __tablename__ = "anomaly_history"

    id = Column(Integer, primary_key=True, index=True)
    instance = Column(String)
    cpu_val = Column(Float)
    ram_val = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    log_preview = Column(String, nullable=True)

# Create the tables in PostgreSQL
def init_db():
    Base.metadata.create_all(bind=engine)