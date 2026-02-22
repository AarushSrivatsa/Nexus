import os
import tempfile
from uuid import uuid4, UUID

from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.tools import tool

from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader

from langchain_community.document_compressors import FlashrankRerank
from langchain_classic.retrievers.contextual_compression import ContextualCompressionRetriever

from config import INDEX_NAME, EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP, SEPARATORS, BASE_K, TOP_N, USE_RERANKING, RERANK_MODEL, DIMENSIONS

pc = Pinecone()

if not pc.has_index(INDEX_NAME):
    pc.create_index(
        name=INDEX_NAME,
        dimension=DIMENSIONS,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
index = pc.Index(INDEX_NAME)

def add_to_rag(conversation_id: str, file_bytes: bytes, filename: str) -> str:
    """Insert file into vector database for a specific conversation."""
    namespace = str(conversation_id)
    
    vector_store = PineconeVectorStore(
        index=index,
        embedding=EMBEDDING_MODEL,
        namespace=namespace
    )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp_file:
        tmp_file.write(file_bytes)
        tmp_path = tmp_file.name
    
    try:
        filename_lower = filename.lower()
        
        if filename_lower.endswith('.pdf'):
            loader = PyPDFLoader(tmp_path)
        elif filename_lower.endswith('.docx'):
            loader = Docx2txtLoader(tmp_path)
        elif filename_lower.endswith('.txt'):
            loader = TextLoader(tmp_path)
        else:
            raise ValueError(f"Unsupported file type: {filename}")
        
        documents = loader.load()
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=SEPARATORS
        )
        
        split_docs = splitter.split_documents(documents)
        
        for doc in split_docs:
            doc.metadata['source'] = filename
            doc.metadata['conversation_id'] = str(conversation_id)
        
        uuids = [str(uuid4()) for _ in range(len(split_docs))]
        vector_store.add_documents(documents=split_docs, ids=uuids)
        
        return f"Insertion Successful: {len(split_docs)} chunks created from {filename}"
    
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def make_query_rag_tool(conversation_id: UUID):

    def _rag_runtime(query: str) -> str:
        """Actual RAG logic. Pydantic never inspects this."""

        namespace = str(conversation_id)

        vector_store = PineconeVectorStore(
            index=index,
            embedding=EMBEDDING_MODEL,
            namespace=namespace
        )

        base_retriever = vector_store.as_retriever(
            search_kwargs={"k": BASE_K}
        )

        if USE_RERANKING:
            retriever = ContextualCompressionRetriever(
                base_retriever=base_retriever,
                base_compressor=FlashrankRerank(
                    model=RERANK_MODEL,
                    top_n=TOP_N
                )
            )
        else:
            retriever = base_retriever

        doc_results = retriever.invoke(query)

        formatted_docs = []
        for i, doc in enumerate(doc_results, 1):
            formatted_docs.append(
                f"---DOCUMENT {i}---\n{doc.page_content}\n---END OF DOCUMENT {i}---"
            )

        return "\n\n".join(formatted_docs) or "No relevant information found."

    @tool
    def query_rag(query: str) -> str:
        """
            Search through documents that the user has uploaded to this conversation.

            This tool queries a vector database containing chunked, embedded content 
            from all files the user has uploaded (PDFs, DOCX, TXT). It performs 
            semantic similarity search to find the most relevant passages for the 
            given query, then reranks results for maximum relevance.

            WHEN TO USE:
            - User asks a question that could be answered by something they uploaded
            - User references "the document", "the file", "what I shared", "the PDF" etc.
            - User asks you to summarize, analyze, or extract info from uploaded content
            - ANY question where uploaded documents might be relevant — check RAG first,
            web search second

            WHEN NOT TO USE:
            - No documents have been uploaded in this conversation
            - User is asking about general knowledge or current events unrelated to uploads
            - User explicitly asks you to search the web

            INPUT:
            - query: A natural language search query. Be specific. 
            Good: "what are the key findings in chapter 3"
            Bad: "document"

            OUTPUT:
            - Relevant excerpts from uploaded documents, formatted as numbered chunks
            - Returns "No relevant information found." if nothing matches
            
            NOTE: Each conversation has its own isolated document namespace. 
            You only see documents uploaded to THIS conversation.
        """
        return _rag_runtime(query)

    return query_rag

def clear_rag(conversation_id: int) -> str:
    """Delete all documents for a specific conversation."""
    namespace = str(conversation_id)
    index.delete(namespace=namespace, delete_all=True)
    return f"RAG memory of conversation {conversation_id} was successfully wiped out"