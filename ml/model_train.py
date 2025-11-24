from preprocessing import preprocess_df
from sklearn.ensemble import IsolationForest
import joblib
import pandas as pd

df = pd.read_csv("logon.csv")
X = preprocess_df(df)

model = IsolationForest(n_estimators=200, contamination="auto")
model.fit(X)

joblib.dump(model, "models/model.pkl")
