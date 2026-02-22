from langchain_tavily import TavilySearch, TavilyCrawl, TavilyExtract, TavilyMap
from langchain.tools import tool

from datetime import datetime
from config import TAVILY_API_KEY

search = TavilySearch(
    max_results=3,                   
    topic="general",
    include_answer="basic",           
    include_raw_content=False,        
    include_images=True,             
    include_image_descriptions=False, 
    search_depth="advanced",          
  )

crawl = TavilyCrawl(
    max_depth=3,                      
    max_breadth=15,                   
    limit=20,                         
    extract_depth="basic",            
    format="markdown",                
    include_images=False,             
    allow_external=False,             
)

extract = TavilyExtract(
    extract_depth="advanced",         
    format="markdown",        
    include_images=False,             
)

mapsite = TavilyMap(
    max_depth=3,
    max_breadth=25,
    limit=150,
    allow_external=False,
)

@tool
def getDateAndTime():
    """Returns The Current Date & Time (Timezone IST)"""
    return datetime.now()

universal_tools = [getDateAndTime, search, crawl, extract, mapsite]