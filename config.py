import os
from dotenv import load_dotenv
from langchain_core.embeddings import Embeddings
import voyageai
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
CF_API_TOKEN = os.getenv("CF_API_TOKEN")
CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 30

class VoyageEmbeddings(Embeddings):
    def __init__(self):
        self.client = voyageai.Client(api_key=VOYAGE_API_KEY)

    def embed_documents(self, texts):
        result = self.client.embed(texts, model="voyage-3-lite")
        return result.embeddings

    def embed_query(self, text):
        result = self.client.embed([text], model="voyage-3-lite")
        return result.embeddings[0]
    
INDEX_NAME = "nexus"
EMBEDDING_MODEL = VoyageEmbeddings()
DIMENSIONS = 512
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