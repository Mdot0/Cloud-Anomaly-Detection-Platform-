from preprocessing import preprocess_df
import joblib

model = joblib.load("models/model.pkl")

def score_logs(df):
    X = preprocess_df(df)
    scores = model.decision_function(X)
    df["anomaly_score"] = scores
    return df
