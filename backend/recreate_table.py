from database import engine, Base
import models
from sqlalchemy import text

def super_force_fix():
    print("--- 🚨 Super Force Recreating Performance Table 🚨 ---")
    try:
        with engine.connect() as conn:
            # Drop the table by force
            print("1. Dropping old table using CASCADE...")
            conn.execute(text("DROP TABLE IF EXISTS student_performance_summary CASCADE;"))
            conn.commit()
            print("   ✅ Table dropped.")

        print("2. Re-creating all tables from scratch...")
        # This will create everything defined in models.py including the new column
        Base.metadata.create_all(bind=engine)
        print("   ✅ Database schema re-synced.")
        
        print("\n🎉 SUCCESS! You can now restart your backend.")
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    super_force_fix()
