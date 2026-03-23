from database import engine
from sqlalchemy import text, inspect

def migrate():
    print("--- 🛠 Running Database Migration (Adding Missing Columns) 🛠 ---")
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        # 1. Check Certificates table
        columns = [c['name'] for c in inspector.get_columns('certificates')]
        
        if 'status' not in columns:
            print("Adding 'status' to certificates...")
            conn.execute(text("ALTER TABLE certificates ADD COLUMN status VARCHAR(20) DEFAULT 'pending';"))
        
        if 'request_date' not in columns:
            print("Adding 'request_date' to certificates...")
            conn.execute(text("ALTER TABLE certificates ADD COLUMN request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))

        if 'issued_at' not in columns:
            print("Adding 'issued_at' to certificates...")
            conn.execute(text("ALTER TABLE certificates ADD COLUMN issued_at TIMESTAMP;"))

        # 2. Check Student Performance table
        columns_perf = [c['name'] for c in inspector.get_columns('student_performance_summary')]
        
        if 'dropout_risk' not in columns_perf:
            print("Adding 'dropout_risk' to performance table...")
            conn.execute(text("ALTER TABLE student_performance_summary ADD COLUMN dropout_risk VARCHAR(20) DEFAULT 'Low';"))

        if 'global_learner_level' not in columns_perf:
            print("Adding 'global_learner_level' to performance table...")
            conn.execute(text("ALTER TABLE student_performance_summary ADD COLUMN global_learner_level VARCHAR(20);"))

        conn.commit()
        print("✅ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
