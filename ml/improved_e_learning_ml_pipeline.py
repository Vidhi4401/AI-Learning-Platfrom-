import pandas as pd
import numpy as np
import os
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score
)


# 1. SETUP

ARTIFACT_DIR = os.path.join(os.getcwd(), "backend", "ml")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

np.random.seed(42)


# 2. REALISTIC DATA GENERATION

def generate_realistic_data(n=6000):
    base_ability = np.random.normal(60, 15, n)
    engagement_factor = np.random.normal(50, 20, n)

    data = pd.DataFrame({
        "quiz_average": np.clip(base_ability + np.random.normal(0, 10, n), 0, 100),
        "assignment_average": np.clip(base_ability + np.random.normal(5, 10, n), 0, 100),
        "completion_rate": np.clip(engagement_factor + np.random.normal(0, 15, n), 0, 100),
        "avg_watch_time": np.clip(engagement_factor * 5 + np.random.normal(0, 50, n), 0, 600),
        "quiz_attempt_rate": np.clip(engagement_factor + np.random.normal(0, 10, n), 0, 100),
        "assignment_submission_rate": np.clip(engagement_factor + np.random.normal(0, 10, n), 0, 100),
        "videos_completed": np.random.randint(0, 25, n),
        "quizzes_attempted": np.random.randint(0, 15, n),
        "assignments_submitted": np.random.randint(0, 15, n),
        "total_course_items": np.random.randint(20, 50, n)
    })

    data["overall_score"] = (
        0.5 * data["quiz_average"] +
        0.5 * data["assignment_average"]
    )

    return data


# 3. FEATURE ENGINEERING

def engineer_features(df):
    df["engagement_score"] = (
        0.4 * df["completion_rate"] +
        0.3 * df["quiz_attempt_rate"] +
        0.3 * df["assignment_submission_rate"]
    )

    df["performance_score"] = (
        0.4 * df["quiz_average"] +
        0.6 * df["assignment_average"]
    )

    df["consistency"] = abs(df["quiz_average"] - df["assignment_average"])

    return df


# 4. TARGET CREATION (LESS LEAKAGE)

def create_targets(df):
    # Add noise so model learns patterns, not exact rules
    noisy_perf = df["performance_score"] + np.random.normal(0, 5, len(df))
    noisy_eng = df["engagement_score"] + np.random.normal(0, 5, len(df))

    # Handle any NaN safely
    noisy_perf = np.nan_to_num(noisy_perf)
    noisy_eng = np.nan_to_num(noisy_eng)

    # Skill Level
    conditions = [
        noisy_perf >= 70,
        (noisy_perf >= 40) & (noisy_perf < 70),
        noisy_perf < 40
    ]

    choices = ["Strong", "Average", "Weak"]

    df["level"] = np.select(conditions, choices, default="Weak").astype(str)

    # Dropout Risk (probabilistic)
    risk_score = 0.6 * (100 - noisy_eng) + 0.4 * (100 - noisy_perf)
    df["risk"] = (risk_score > 60).astype(int)

    return df


# 5. TRAIN FUNCTION

def train_models():
    print("Generating realistic dataset...")
    df = generate_realistic_data()
    df = engineer_features(df)
    df = create_targets(df)

    base_features = [
        "overall_score", "quiz_average", "assignment_average",
        "completion_rate", "avg_watch_time", "quiz_attempt_rate",
        "assignment_submission_rate", "videos_completed",
        "quizzes_attempted", "assignments_submitted", "total_course_items"
    ]

    X = df[base_features]
    y_level = df["level"]
    y_risk = df["risk"]

    X_train, X_test, y_level_train, y_level_test = train_test_split(
        X, y_level, test_size=0.2, random_state=42
    )

    _, _, y_risk_train, y_risk_test = train_test_split(
        X, y_risk, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    
    # 6.MODEL TRAINING
    
    level_model = RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42)
    level_model.fit(X_train_scaled, y_level_train)

    risk_model = RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42)
    risk_model.fit(X_train_scaled, y_risk_train)

    
    # 7.EVALUATION
    
    print("\n=== LEVEL MODEL ===")
    level_pred = level_model.predict(X_test_scaled)
    print("Accuracy:", accuracy_score(y_level_test, level_pred))
    print(classification_report(y_level_test, level_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_level_test, level_pred))

    print("\n=== RISK MODEL ===")
    risk_pred = risk_model.predict(X_test_scaled)
    print("Accuracy:", accuracy_score(y_risk_test, risk_pred))
    print(classification_report(y_risk_test, risk_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_risk_test, risk_pred))

    try:
        risk_prob = risk_model.predict_proba(X_test_scaled)[:, 1]
        print("ROC-AUC:", roc_auc_score(y_risk_test, risk_prob))
    except:
        print("ROC-AUC not available")

    
    # 8.FEATURE IMPORTANCE
    
    importance_df = pd.DataFrame({
        "feature": base_features,
        "importance": risk_model.feature_importances_
    }).sort_values(by="importance", ascending=False)

    print("\nTop Features:\n", importance_df.head(10))

    
    # 9.SAVE ARTIFACTS
    
    joblib.dump(level_model, f"{ARTIFACT_DIR}/final_level_model.pkl")
    joblib.dump(risk_model, f"{ARTIFACT_DIR}/final_risk_model.pkl")
    joblib.dump(scaler, f"{ARTIFACT_DIR}/final_scaler.pkl")
    joblib.dump(base_features, f"{ARTIFACT_DIR}/model_features.pkl")

    print("\nModels saved successfully!")
    print("Saved at:", ARTIFACT_DIR)
    
    import os
    print("Files in folder:", os.listdir(ARTIFACT_DIR))

if __name__ == "__main__":
    train_models()
