# Behavioral Intelligence & Early Warning Platform

A production-ready, privacy-first AI system designed to identify early indicators of stress, anxiety, and burnout by analyzing passive smartphone behavioral telemetry.

## 🚀 Key Features

- **Passive Detection Engine**: Uses Isolation Forest models to identify behavioral outliers in real-time telemetry.
- **Explainable AI (XAI)**: Implements SHAP-based observational language to explain risk factors without implying causation (e.g., *"Shift in late-night activity detected"*).
- **Daily Wellness Surveys**: Integrated mood and energy check-ins to calibrate the personal baseline.
- **Premium User Experience**: Built with React Native, featuring staggered animations, haptic feedback, and shimmering skeleton loaders.
- **Privacy First**: Field-level database encryption and secure local storage for telemetry logs.

## 🛠️ Technical Stack

- **Frontend**: React Native (Expo SDK), Reanimated for gestures and animations.
- **Backend**: FastAPI (Python), SQLite with Alembic for migrations.
- **Machine Learning**: Scikit-Learn (Isolation Forest), SHAP for model interpretability.
- **Infrastructure**: Pydantic for data validation, Python-Dotenv for environment management.

## 📁 Project Structure

- `backend_api/`: FastAPI server handling data ingestion, storage, and insights.
- `ml_engine/`: Modeling scripts, inference logic, and SHAP explanation generation.
- `mobile_app/`: Cross-platform React Native application.

---
*Developed by aryanoob-dev*
