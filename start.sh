#!/bin/bash

# Start Ollama in background
ollama serve &

# Wait for it to be ready
sleep 5

# Pull the model
ollama pull nomic-embed-text:v1.5

# Start your FastAPI app
exec uvicorn main:app --host 0.0.0.0 --port 8080