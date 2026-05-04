from sqlalchemy import Boolean, create_engine, Column, Integer, String, Float, DateTime, Text
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
    disk_val = Column(Float)
    net_val = Column(Float)
    trigger_type = Column(String)
    cause = Column(String)
    verified = Column(Boolean, default=False, nullable=False)
    logs = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class InstanceStatus(Base):
    __tablename__ = "instance_status"

    id = Column(Integer, primary_key=True, index=True)
    instance = Column(String, unique=True, index=True)
    status = Column(String)  # "Healthy", "Anomalous", "Learning", etc.
    reason = Column(String)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

# Create the tables in PostgreSQL
def init_db():
    Base.metadata.create_all(bind=engine)