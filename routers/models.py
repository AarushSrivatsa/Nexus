from fastapi import APIRouter

router = APIRouter(prefix='/api/v1/models')

MODELS = [
    {"id": "moonshotai/kimi-k2-instruct-0905",    "name": "Kimi K2",           "provider": "groq"},
    {"id": "openai/gpt-oss-120b",                 "name": "GPT-OSS 120B",      "provider": "groq"},
    {"id": "openai/gpt-oss-20b",                  "name": "GPT-OSS 20B",       "provider": "groq"},
    {"id": "qwen/qwen3-32b",                      "name": "Qwen3 32B",         "provider": "groq"},
    {"id": "llama-3.1-8b-instant",                "name": "Llama 3.1 8B",      "provider": "groq"},
    {"id": "llama-3.3-70b-versatile",             "name": "Llama 3.3 70B",     "provider": "groq"},
]

@router.get('/get_models')
def send_model_list():
    return MODELS