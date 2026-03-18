"""
AI E-Learning Platform - Enhanced Risk Prediction Model (v2)
========================================================
Training script with SHAP explainability, proper categorical
handling, and production-ready artifact management.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report, 
    accuracy_score, 
    roc_auc_score,
    confusion_matrix,
    precision_recall_curve,
    average_precision_score
)
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
import shap
from datetime import datetime
from pathlib import Path
import warnings

warnings.filterwarnings('ignore')

# Setup Artifacts Directory
ARTIFACTS_DIR = Path('artifacts')
ARTIFACTS_DIR.mkdir(exist_ok=True)

# Custom Exceptions
class ModelNotTrainedError(Exception):
    """Raised when prediction is attempted before model artifacts exist."""
    pass

# ================================================================
# 1. ENHANCED DATA GENERATION
# ================================================================

def generate_realistic_student_data(num_students=2000):
    """
    Generate realistic training data matching the frontend dashboard.
    """
    np.random.seed(42)
    courses = ['Web Development', 'Data Science', 'Python Basics']
    all_records = []
    
    for student_id in range(num_students):
        student_motivation = np.random.choice(['high', 'medium', 'low'], p=[0.3, 0.5, 0.2])
        base_engagement = {'high': 0.8, 'medium': 0.5, 'low': 0.2}[student_motivation]
        
        for course_name in courses:
            course_affinity = np.random.uniform(0.7, 1.3)
            
            videos_total = np.random.randint(10, 20)
            videos_completed = int(videos_total * base_engagement * course_affinity * np.random.uniform(0.5, 1.2))
            videos_completed = np.clip(videos_completed, 0, videos_total)
            
            quizzes_total = np.random.randint(6, 12)
            quizzes_attempted = int(quizzes_total * base_engagement * np.random.uniform(0.6, 1.1))
            quizzes_attempted = np.clip(quizzes_attempted, 0, quizzes_total)
            
            assignments_total = np.random.randint(8, 15)
            assignments_submitted = int(assignments_total * base_engagement * course_affinity * np.random.uniform(0.4, 1.0))
            assignments_submitted = np.clip(assignments_submitted, 0, assignments_total)
            
            days_since_enrollment = np.random.randint(7, 90)
            days_since_last_activity = int(np.random.exponential(3) if base_engagement > 0.4 else np.random.exponential(10))
            days_since_last_activity = min(days_since_last_activity, days_since_enrollment)
            
            avg_watch_time = base_engagement * course_affinity * np.random.uniform(120, 600)
            streak_days = int(base_engagement * 7 * np.random.uniform(0.5, 1.5))
            
            quiz_average = base_engagement * course_affinity * np.random.uniform(60, 100)
            assignment_average = base_engagement * course_affinity * np.random.uniform(50, 100)
            overall_score = (quiz_average * 0.4 + assignment_average * 0.6)
            
            completion_rate = (videos_completed / videos_total) * 100 if videos_total > 0 else 0
            quiz_attempt_rate = (quizzes_attempted / quizzes_total) * 100 if quizzes_total > 0 else 0
            assignment_submission_rate = (assignments_submitted / assignments_total) * 100 if assignments_total > 0 else 0
            
            videos_this_week = int(videos_completed * 0.2) if days_since_last_activity < 7 else 0
            
            record = {
                'student_id': f'STU_{student_id:04d}',
                'course_name': course_name,
                'overall_score': overall_score,
                'quiz_average': quiz_average,
                'assignment_average': assignment_average,
                'completion_rate': completion_rate,
                'quiz_attempt_rate': quiz_attempt_rate,
                'assignment_submission_rate': assignment_submission_rate,
                'videos_completed': videos_completed,
                'videos_total': videos_total,
                'videos_this_week': videos_this_week,
                'avg_watch_time': avg_watch_time,
                'quizzes_attempted': quizzes_attempted,
                'quizzes_total': quizzes_total,
                'assignments_submitted': assignments_submitted,
                'assignments_pending': assignments_total - assignments_submitted,
                'days_since_enrollment': days_since_enrollment,
                'days_since_last_activity': days_since_last_activity,
                'streak_days': streak_days,
            }
            all_records.append(record)
    
    df = pd.DataFrame(all_records)
    df['at_risk'] = df.apply(calculate_risk_label, axis=1)
    return df

def calculate_risk_label(row):
    """Rule-based baseline for synthetic data generation."""
    risk_score = 0
    if row['completion_rate'] < 15: risk_score += 4
    elif row['completion_rate'] < 30: risk_score += 2
    
    if row['quiz_attempt_rate'] < 25: risk_score += 3
    elif row['quiz_attempt_rate'] < 40: risk_score += 1
    
    if row['assignment_submission_rate'] < 30: risk_score += 3
    elif row['assignment_submission_rate'] < 50: risk_score += 1
    
    if row['overall_score'] < 50: risk_score += 2
    elif row['overall_score'] < 60: risk_score += 1
    
    if row['days_since_last_activity'] > 14: risk_score += 4
    elif row['days_since_last_activity'] > 7: risk_score += 2
    
    if row['avg_watch_time'] < 60: risk_score += 2
    if row['streak_days'] < 2: risk_score += 1
    
    return 1 if risk_score >= 5 else 0

# ================================================================
# 2. MODEL TRAINING & EVALUATION
# ================================================================

def train_enhanced_model():
    print("=" * 70)
    print("TRAINING AI RISK PREDICTION MODEL (v2)")
    print("=" * 70)
    
    print("\n[1/6] Generating training data...")
    df = generate_realistic_student_data(num_students=3000)
    
    print("[2/6] Engineering features & Encoding categorical data...")
    # Feature Engineering
    df['engagement_score'] = (
        df['completion_rate'] * 0.3 + 
        df['quiz_attempt_rate'] * 0.3 + 
        df['assignment_submission_rate'] * 0.4
    )
    df['activity_recency_score'] = 100 / (1 + df['days_since_last_activity'])
    df['consistency_score'] = df['streak_days'] * (100 / df['days_since_enrollment'])
    
    # One-Hot Encoding for course_name
    df = pd.get_dummies(df, columns=['course_name'])
    
    # Define exact columns to drop to get feature set
    cols_to_drop = ['student_id', 'at_risk']
    feature_columns = [col for col in df.columns if col not in cols_to_drop]
    
    X = df[feature_columns]
    y = df['at_risk']
    
    print(f"\n   Class Distribution:")
    print(f"   - Not at risk: {(y == 0).sum()} ({(y == 0).sum() / len(y) * 100:.1f}%)")
    print(f"   - At risk:     {(y == 1).sum()} ({(y == 1).sum() / len(y) * 100:.1f}%)")
    
    print("\n[3/6] Splitting data (80-20 train-test)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print("[4/6] Training RandomForest classifier (No scaling needed)...")
    model = RandomForestClassifier(
        n_estimators=150, max_depth=15, min_samples_split=10,
        min_samples_leaf=5, random_state=42, class_weight='balanced', n_jobs=-1
    )
    model.fit(X_train, y_train)
    
    print("[5/6] Running Cross-validation...")
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='roc_auc')
    print(f"   Cross-validation ROC-AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
    
    print("\n[6/6] Evaluating & Saving artifacts...")
    evaluate_model_comprehensive(model, X_test, y_test, feature_columns)
    
    # Save artifacts cleanly into the artifacts directory
    joblib.dump(model, ARTIFACTS_DIR / 'elearning_risk_model.pkl')
    joblib.dump(feature_columns, ARTIFACTS_DIR / 'feature_columns.pkl')
    
    metadata = {
        'training_date': datetime.now().isoformat(),
        'model_type': 'RandomForestClassifier',
        'features': feature_columns,
        'cv_roc_auc': cv_scores.mean()
    }
    joblib.dump(metadata, ARTIFACTS_DIR / 'model_metadata.pkl')
    
    print("\n✓ Model and metadata saved to /artifacts directory.")
    return model, feature_columns

def evaluate_model_comprehensive(model, X_test, y_test, feature_names):
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    print("\n   CLASSIFICATION METRICS:")
    print(f"   Accuracy:  {accuracy_score(y_test, y_pred) * 100:.2f}%")
    print(f"   ROC-AUC:   {roc_auc_score(y_test, y_proba):.4f}")
    
    cm = confusion_matrix(y_test, y_pred)
    create_evaluation_plots(model, y_test, y_proba, feature_names, cm)

def create_evaluation_plots(model, y_test, y_proba, feature_names, cm):
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    # Confusion Matrix
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[0],
                xticklabels=['Not at Risk', 'At Risk'],
                yticklabels=['Not at Risk', 'At Risk'])
    axes[0].set_title('Confusion Matrix')
    axes[0].set_ylabel('Actual')
    axes[0].set_xlabel('Predicted')
    
    # Precision-Recall
    precision, recall, _ = precision_recall_curve(y_test, y_proba)
    ap_score = average_precision_score(y_test, y_proba)
    axes[1].plot(recall, precision, color='purple', linewidth=2)
    axes[1].set_xlabel('Recall')
    axes[1].set_ylabel('Precision')
    axes[1].set_title(f'Precision-Recall Curve (AP={ap_score:.3f})')
    axes[1].grid(True, alpha=0.3)
    
    plot_path = ARTIFACTS_DIR / 'model_evaluation_report.png'
    plt.tight_layout()
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    plt.close()

# ================================================================
# 3. PREDICTION & EXPLAINABILITY ENGINE (SHAP)
# ================================================================

def predict_student_risk(student_features):
    try:
        model = joblib.load(ARTIFACTS_DIR / 'elearning_risk_model.pkl')
        feature_columns = joblib.load(ARTIFACTS_DIR / 'feature_columns.pkl')
    except FileNotFoundError:
        raise ModelNotTrainedError("Model files not found in /artifacts. Run train_enhanced_model() first.")
    
    # Engineer base features
    if 'engagement_score' not in student_features:
        student_features['engagement_score'] = (
            student_features.get('completion_rate', 0) * 0.3 +
            student_features.get('quiz_attempt_rate', 0) * 0.3 +
            student_features.get('assignment_submission_rate', 0) * 0.4
        )
    if 'activity_recency_score' not in student_features:
        student_features['activity_recency_score'] = 100 / (1 + student_features.get('days_since_last_activity', 1))
    if 'consistency_score' not in student_features:
        days_enrolled = student_features.get('days_since_enrollment', 30)
        student_features['consistency_score'] = student_features.get('streak_days', 0) * (100 / days_enrolled)
    
    # Convert to DataFrame
    student_df = pd.DataFrame([student_features])
    
    # Handle One-Hot Encoding for the specific input
    if 'course_name' in student_df.columns:
        student_df = pd.get_dummies(student_df, columns=['course_name'])
    
    # Align columns with training data (fill missing dummies with 0)
    for col in feature_columns:
        if col not in student_df.columns:
            student_df[col] = 0
    student_df = student_df[feature_columns] # Reorder strictly to match training
    
    # Predict
    prediction = model.predict(student_df)[0]
    probability = model.predict_proba(student_df)[0][1]
    
    # SHAP Explainability
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(student_df)
    
    # Extract class 1 (At Risk) SHAP values handling different SHAP versions
    if isinstance(shap_values, list):
        shap_vals_class1 = shap_values[1][0] 
    elif len(shap_values.shape) == 3:
        shap_vals_class1 = shap_values[0, :, 1]
    else:
        shap_vals_class1 = shap_values[0]

    # Format top contributions
    contributions = []
    for i, name in enumerate(feature_columns):
        if shap_vals_class1[i] != 0: # Only include features that moved the needle
            contributions.append({
                'feature': name,
                'value': float(student_df.iloc[0, i]),
                'impact': float(shap_vals_class1[i])
            })
    
    # Sort by absolute impact to find biggest drivers (positive or negative)
    contributions.sort(key=lambda x: abs(x['impact']), reverse=True)
    
    return {
        'prediction': int(prediction),
        'probability': float(probability),
        'risk_level': categorize_risk_level(probability),
        'top_risk_factors': contributions[:4]
    }

def categorize_risk_level(probability):
    if probability >= 0.75: return 'CRITICAL'
    elif probability >= 0.50: return 'HIGH'
    elif probability >= 0.30: return 'MEDIUM'
    else: return 'LOW'

# ================================================================
# 4. TESTING
# ================================================================

def test_with_dashboard_student():
    print("\n" + "=" * 70)
    print("TESTING WITH FRONTEND DASHBOARD STUDENT")
    print("=" * 70)
    
    dashboard_student = {
        'course_name': 'Data Science',  # Added categorical feature
        'overall_score': 82.0,
        'quiz_average': 87.0,
        'assignment_average': 78.0,
        'completion_rate': 0.0,
        'quiz_attempt_rate': 37.5,
        'assignment_submission_rate': 41.67,
        'avg_watch_time': 145.0,
        'days_since_last_activity': 5,
        'streak_days': 0,
        'videos_completed': 0,
        'videos_total': 12,
        'videos_this_week': 0,
        'quizzes_attempted': 3,
        'quizzes_total': 8,
        'assignments_submitted': 5,
        'assignments_pending': 7,
        'days_since_enrollment': 30,
    }
    
    result = predict_student_risk(dashboard_student)
    
    status_emoji = "🔴" if result['prediction'] == 1 else "🟢"
    print(f"\n{status_emoji} Status: {'AT RISK' if result['prediction'] == 1 else 'NOT AT RISK'}")
    print(f"   Risk Level: {result['risk_level']}")
    print(f"   Dropout Probability: {result['probability']*100:.1f}%")
    
    print("\n📊 Top SHAP Explanations (Why was this score given?):")
    for i, factor in enumerate(result['top_risk_factors'], 1):
        direction = "Increased Risk" if factor['impact'] > 0 else "Decreased Risk"
        print(f"   {i}. {factor['feature']} = {factor['value']:.2f}")
        print(f"      → {direction} (SHAP Value: {factor['impact']:+.3f})")

if __name__ == "__main__":
    train_enhanced_model()
    test_with_dashboard_student()