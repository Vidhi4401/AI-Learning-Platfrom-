"""
AI E-Learning Platform
Advanced Dropout Risk Prediction Model
Production-style ML pipeline
"""

import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

import matplotlib.pyplot as plt
import seaborn as sns

np.random.seed(42)

# ==========================================================
# 1. SYNTHETIC DATA GENERATION (REALISTIC EDTECH FEATURES)
# ==========================================================

def generate_student_dataset(n=4000):

    data = pd.DataFrame({

        # Academic performance
        "quiz_average": np.random.uniform(40, 100, n),
        "assignment_average": np.random.uniform(35, 100, n),
        "overall_score": np.random.uniform(40, 100, n),

        # Engagement
        "completion_rate": np.random.uniform(0, 100, n),
        "quiz_attempt_rate": np.random.uniform(0, 100, n),
        "assignment_submission_rate": np.random.uniform(0, 100, n),

        # Activity metrics
        "days_since_last_activity": np.random.randint(0, 30, n),
        "days_since_enrollment": np.random.randint(10, 120, n),
        "streak_days": np.random.randint(0, 15, n),

        # Video engagement
        "avg_watch_time": np.random.uniform(30, 600, n),
        "videos_completed": np.random.randint(0, 30, n),
        "videos_total": np.random.randint(10, 30, n),

        # Assignments
        "assignments_submitted": np.random.randint(0, 15, n),
        "assignments_pending": np.random.randint(0, 10, n),

        # Quiz behavior
        "quizzes_attempted": np.random.randint(0, 15, n),
        "quizzes_total": np.random.randint(5, 15, n),

        # Learning behaviour
        "forum_posts": np.random.randint(0, 20, n),
        "forum_replies": np.random.randint(0, 30, n),
        "notes_taken": np.random.randint(0, 50, n),

        # Weekly activity
        "videos_this_week": np.random.randint(0, 8, n)
    })

    # =====================================================
    # Feature Engineering
    # =====================================================

    data["engagement_score"] = (
        0.4 * data["completion_rate"] +
        0.3 * data["quiz_attempt_rate"] +
        0.3 * data["assignment_submission_rate"]
    )

    data["activity_recency_score"] = 100 / (1 + data["days_since_last_activity"])

    data["consistency_score"] = (
        data["streak_days"] * (100 / data["days_since_enrollment"])
    )

    # =====================================================
    # Risk Label Logic
    # =====================================================

    risk_conditions = (
        (data["completion_rate"] < 30) |
        (data["quiz_attempt_rate"] < 40) |
        (data["assignment_submission_rate"] < 40) |
        (data["days_since_last_activity"] > 10) |
        (data["overall_score"] < 55)
    )

    data["at_risk"] = risk_conditions.astype(int)

    return data


# ==========================================================
# 2. LOAD DATA
# ==========================================================

print("Generating dataset...")

df = generate_student_dataset()

X = df.drop("at_risk", axis=1)
y = df["at_risk"]

print("Dataset shape:", df.shape)


# ==========================================================
# 3. TRAIN TEST SPLIT
# ==========================================================

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    stratify=y,
    random_state=42
)


# ==========================================================
# 4. PREPROCESSING PIPELINE
# ==========================================================

numeric_features = X.columns.tolist()

numeric_transformer = Pipeline(steps=[
    ("scaler", StandardScaler())
])

preprocessor = ColumnTransformer(
    transformers=[
        ("num", numeric_transformer, numeric_features)
    ]
)


# ==========================================================
# 5. MODEL PIPELINE
# ==========================================================

pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("model", RandomForestClassifier(random_state=42))
])


# ==========================================================
# 6. HYPERPARAMETER TUNING
# ==========================================================

param_grid = {

    "model__n_estimators": [100, 200],
    "model__max_depth": [10, 15, 20],
    "model__min_samples_split": [2, 5],
    "model__min_samples_leaf": [1, 2]
}

grid = GridSearchCV(
    pipeline,
    param_grid,
    cv=5,
    scoring="roc_auc",
    n_jobs=-1,
    verbose=1
)

print("Training model...")

grid.fit(X_train, y_train)

best_model = grid.best_estimator_

print("Best parameters:")
print(grid.best_params_)


# ==========================================================
# 7. MODEL EVALUATION
# ==========================================================

y_pred = best_model.predict(X_test)
y_prob = best_model.predict_proba(X_test)[:,1]

print("\nClassification Report\n")
print(classification_report(y_test, y_pred))

roc = roc_auc_score(y_test, y_prob)

print("ROC AUC:", roc)


# ==========================================================
# 8. CONFUSION MATRIX
# ==========================================================

cm = confusion_matrix(y_test, y_pred)

plt.figure(figsize=(6,5))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues")
plt.title("Confusion Matrix")
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.show()


# ==========================================================
# 9. FEATURE IMPORTANCE
# ==========================================================

model = best_model.named_steps["model"]

importances = model.feature_importances_
features = X.columns

importance_df = pd.DataFrame({
    "feature": features,
    "importance": importances
}).sort_values("importance", ascending=False)

print("\nTop Important Features")
print(importance_df.head(10))


# ==========================================================
# 10. SAVE MODEL
# ==========================================================

joblib.dump(best_model, "advanced_dropout_model.pkl")

joblib.dump(features.tolist(), "model_features.pkl")

print("\nModel saved successfully!")