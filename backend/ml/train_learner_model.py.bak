import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib
import os

def generate_balanced_data(n=6000):
    np.random.seed(42)
    
    # Generate 11 Features
    # We create 3 distinct groups to ensure the model learns the boundaries
    
    # --- Group 1: Weak Students (Low scores, low activity) ---
    n_weak = n // 3
    weak_data = pd.DataFrame({
        "overall_score": np.random.uniform(0, 45, n_weak),
        "quiz_average": np.random.uniform(0, 40, n_weak),
        "assignment_average": np.random.uniform(0, 40, n_weak),
        "completion_rate": np.random.uniform(0, 30, n_weak),
        "avg_watch_time": np.random.uniform(0, 100, n_weak),
        "quiz_attempt_rate": np.random.uniform(0, 30, n_weak),
        "assignment_submission_rate": np.random.uniform(0, 30, n_weak),
        "videos_completed": np.random.randint(0, 5, n_weak),
        "quizzes_attempted": np.random.randint(0, 3, n_weak),
        "assignments_submitted": np.random.randint(0, 2, n_weak),
        "total_course_items": np.random.randint(10, 40, n_weak)
    })
    weak_data['level'] = "Weak"

    # --- Group 2: Average Students (Mid scores, moderate activity) ---
    n_avg = n // 3
    avg_data = pd.DataFrame({
        "overall_score": np.random.uniform(46, 79, n_avg),
        "quiz_average": np.random.uniform(40, 75, n_avg),
        "assignment_average": np.random.uniform(40, 75, n_avg),
        "completion_rate": np.random.uniform(30, 70, n_avg),
        "avg_watch_time": np.random.uniform(100, 300, n_avg),
        "quiz_attempt_rate": np.random.uniform(30, 70, n_avg),
        "assignment_submission_rate": np.random.uniform(30, 70, n_avg),
        "videos_completed": np.random.randint(5, 12, n_avg),
        "quizzes_attempted": np.random.randint(3, 8, n_avg),
        "assignments_submitted": np.random.randint(2, 6, n_avg),
        "total_course_items": np.random.randint(10, 40, n_avg)
    })
    avg_data['level'] = "Average"

    # --- Group 3: Strong Students (High scores, high activity) ---
    n_strong = n // 3
    strong_data = pd.DataFrame({
        "overall_score": np.random.uniform(80, 100, n_strong),
        "quiz_average": np.random.uniform(76, 100, n_strong),
        "assignment_average": np.random.uniform(76, 100, n_strong),
        "completion_rate": np.random.uniform(70, 100, n_strong),
        "avg_watch_time": np.random.uniform(300, 600, n_strong),
        "quiz_attempt_rate": np.random.uniform(70, 100, n_strong),
        "assignment_submission_rate": np.random.uniform(70, 100, n_strong),
        "videos_completed": np.random.randint(12, 25, n_strong),
        "quizzes_attempted": np.random.randint(8, 15, n_strong),
        "assignments_submitted": np.random.randint(6, 12, n_strong),
        "total_course_items": np.random.randint(10, 40, n_strong)
    })
    strong_data['level'] = "Strong"

    return pd.concat([weak_data, avg_data, strong_data]).sample(frac=1).reset_index(drop=True)

def train_and_save():
    print("Generating highly-distinguishable training data...")
    df = generate_balanced_data()
    
    X = df.drop('level', axis=1)
    y = df['level']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("Training Model (RF with 200 estimators)...")
    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    acc = accuracy_score(y_test, model.predict(X_test_scaled))
    print(f"Model Accuracy: {acc * 100:.2f}%")
    
    # Overwrite old files
    joblib.dump(model, 'ml/learner_level_model.pkl')
    joblib.dump(scaler, 'ml/feature_scaler.pkl')
    print("✅ Model Refreshed: learner_level_model.pkl and feature_scaler.pkl updated.")

if __name__ == "__main__":
    train_and_save()
