import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib
import os

# Create ml directory in backend if not exists
# Get the root directory (one level up from this script)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACT_DIR = os.path.join(BASE_DIR, "backend", "ml")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def engineer_features(df):
    # Advanced logic from train_model.ipynb
    df["engagement_score"] = (
        0.4 * df["completion_rate"] +
        0.3 * df["quiz_attempt_rate"] +
        0.3 * df["assignment_submission_rate"]
    )
    df["performance_score"] = (
        0.4 * df["quiz_average"] +
        0.6 * df["assignment_average"]
    )
    df["activity_score"] = (
        df["videos_completed"] +
        df["quizzes_attempted"] +
        df["assignments_submitted"]
    )
    return df

def generate_training_data(n=6000):
    np.random.seed(42)
    
    # Generate 11 Base Features
    data = pd.DataFrame({
        "overall_score": np.random.uniform(0, 100, n),
        "quiz_average": np.random.uniform(0, 100, n),
        "assignment_average": np.random.uniform(0, 100, n),
        "completion_rate": np.random.uniform(0, 100, n),
        "avg_watch_time": np.random.uniform(0, 600, n),
        "quiz_attempt_rate": np.random.uniform(0, 100, n),
        "assignment_submission_rate": np.random.uniform(0, 100, n),
        "videos_completed": np.random.randint(0, 25, n),
        "quizzes_attempted": np.random.randint(0, 15, n),
        "assignments_submitted": np.random.randint(0, 15, n),
        "total_course_items": np.random.randint(15, 55, n)
    })

    data = engineer_features(data)

    # 1. Label Learner Level
    def assign_level(row):
        # Academic performance is the primary driver (80% weight)
        # Engagement (watching videos) is secondary (20% weight)
        score = (row['performance_score'] * 0.8 + row['engagement_score'] * 0.2)
        
        if score >= 70: return "Strong" # Lowered from 80 to recognize high achievers
        if score >= 40: return "Average"
        return "Weak"

    # 2. Label Dropout Risk (0=Low, 1=High)
    def assign_risk(row):
        if row['engagement_score'] < 30 or row['performance_score'] < 40:
            return 1 # High Risk
        return 0 # Low Risk

    data['level'] = data.apply(assign_level, axis=1)
    data['risk'] = data.apply(assign_risk, axis=1)
    
    return data

def train_final_models():
    print("Generating and Engineering dataset...")
    df = generate_training_data()
    
    # Base Features for training (the 11 raw ones we send from JS)
    base_features = [
        "overall_score", "quiz_average", "assignment_average", 
        "completion_rate", "avg_watch_time", "quiz_attempt_rate", 
        "assignment_submission_rate", "videos_completed", 
        "quizzes_attempted", "assignments_submitted", "total_course_items"
    ]
    
    X = df[base_features]
    y_level = df['level']
    y_risk = df['risk']
    
    # Train/Test Split
    X_train, X_test, y_level_train, y_level_test = train_test_split(X, y_level, test_size=0.2, random_state=42)
    _, _, y_risk_train, y_risk_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("Training Multi-Output Intelligence...")
    
    # Model 1: Level
    level_model = RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42)
    level_model.fit(X_train_scaled, y_level_train)
    print(f"Level Accuracy: {accuracy_score(y_level_test, level_model.predict(X_test_scaled))*100:.2f}%")
    
    # Model 2: Risk
    risk_model = RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42)
    risk_model.fit(X_train_scaled, y_risk_train)
    print(f"Risk Accuracy: {accuracy_score(y_risk_test, risk_model.predict(X_test_scaled))*100:.2f}%")
    
    # Save Artifacts
    joblib.dump(level_model, f"{ARTIFACT_DIR}/final_level_model.pkl")
    joblib.dump(risk_model, f"{ARTIFACT_DIR}/final_risk_model.pkl")
    joblib.dump(scaler, f"{ARTIFACT_DIR}/final_scaler.pkl")
    joblib.dump(base_features, f"{ARTIFACT_DIR}/model_features.pkl")
    
    
    print(f"✅ All Best Models saved to {ARTIFACT_DIR}/")

if __name__ == "__main__":
    train_final_models()
