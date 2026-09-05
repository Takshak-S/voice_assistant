import httpx
from typing import Any
from urllib.parse import quote

from app.schemas.tools import ToolParameter, ToolResult
from app.tools.base import BaseTool


class WikipediaTool(BaseTool):
    @property
    def name(self) -> str:
        return "search_wikipedia"

    @property
    def description(self) -> str:
        return "Search Wikipedia for factual, biographical, scientific, historical, or geographical information."

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "query": ToolParameter(
                type="string",
                description="The search topic, entity name, or question subject (e.g. 'Albert Einstein', 'James Webb Space Telescope', 'Tokyo')",
            ),
        }

    @property
    def required(self) -> list[str]:
        return ["query"]

    async def execute(self, query: str, **kwargs: Any) -> ToolResult:
        if not query or not query.strip():
            return ToolResult(success=False, error="Query cannot be empty.")

        clean_query = query.strip()
        encoded = quote(clean_query.replace(" ", "_"))
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"

        headers = {
            "User-Agent": "VoiceAssistant/1.0 (https://github.com/Takshak-S/voice_assistant; contact@example.com)"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    title = data.get("title", clean_query)
                    extract = data.get("extract")
                    if extract:
                        return ToolResult(
                            success=True,
                            result=f"{title}: {extract}",
                        )

                # Fallback to search if direct page summary 404
                search_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={quote(clean_query)}&limit=1&namespace=0&format=json"
                search_resp = await client.get(search_url, headers=headers)
                if search_resp.status_code == 200:
                    search_data = search_resp.json()
                    # format: [query, [titles], [descriptions], [links]]
                    if len(search_data) >= 3 and search_data[2] and search_data[2][0]:
                        matched_title = search_data[1][0]
                        matched_desc = search_data[2][0]
                        return ToolResult(
                            success=True,
                            result=f"{matched_title}: {matched_desc}",
                        )

            return ToolResult(
                success=True,
                result=f"No direct Wikipedia article found for '{clean_query}'.",
            )
        except Exception as e:
            return ToolResult(
                success=False,
                error=f"Wikipedia search failed: {str(e)}",
            )
