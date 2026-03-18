from database import SessionLocal
import models
from auth import hash_password

def create_initial_admin():
    db = SessionLocal()
    try:
        # Admin configuration
        admin_data = {
            "name": "Admin",
            "email": "admin@gmail.com",
            "password": "admin1234",
            "org_id": 1
        }

        # Check if email exists
        existing = db.query(models.User).filter(models.User.email == admin_data["email"]).first()
        if existing:
            print(f"User with email {admin_data['email']} already exists. Updating role to admin...")
            existing.role = "admin"
            db.commit()
            print("Role updated successfully.")
            return

        new_admin = models.User(
            name=admin_data["name"],
            email=admin_data["email"],
            password_hash=hash_password(admin_data["password"]),
            role="admin",
            organization_id=admin_data["org_id"],
            status=True
        )
        db.add(new_admin)
        db.commit()
        print(f"✅ Admin created: {admin_data['name']} ({admin_data['email']})")
        print(f"Password: {admin_data['password']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_initial_admin()
