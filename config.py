import os
from dotenv import load_dotenv
from langchain_ollama import OllamaEmbeddings
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
CF_API_TOKEN = os.getenv("CF_API_TOKEN")
CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 30

INDEX_NAME = "nexus"
EMBEDDING_MODEL = OllamaEmbeddings(model="nomic-embed-text:v1.5")
DIMENSIONS = 768
CHUNK_SIZE = 400
CHUNK_OVERLAP = 75
SEPARATORS = ["\n\n", "\n", ".", ",", " ", ""]
BASE_K = 20
TOP_N = 5
USE_RERANKING = False
RERANK_MODEL = "ms-marco-MiniLM-L-12-v2"
MESSAGE_LIMIT = 25
FILE_EVENT_PREFIX = "024b4faf-5861-4f6b-840c-8f9b4cb660b1_"

BREVO_SENDER_EMAIL = "pitlaaarushsrivatsa@gmail.com"
BREVO_API_KEY = os.getenv("BREVO_API_KEY")

REQUIRED_ENV_VARS = ["DATABASE_URL", "GROQ_API_KEY", "PINECONE_API_KEY", "TAVILY_API_KEY", "CF_API_TOKEN", "CF_ACCOUNT_ID", "BREVO_API_KEY"]
missing = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")