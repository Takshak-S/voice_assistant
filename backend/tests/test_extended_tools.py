import pytest
from app.tools.notes_tool import NotesTool
from app.tools.wikipedia_tool import WikipediaTool


@pytest.mark.asyncio
async def test_notes_tool_lifecycle():
    tool = NotesTool()
    assert tool.name == "manage_notes"

    # Save note
    res_save = await tool.execute(action="save", title="Meeting", content="Design sync at 3pm")
    assert res_save.success is True
    assert "Meeting" in res_save.result

    # List notes
    res_list = await tool.execute(action="list")
    assert res_list.success is True
    assert "Design sync at 3pm" in res_list.result

    # Delete note missing id
    res_del_err = await tool.execute(action="delete")
    assert res_del_err.success is False


@pytest.mark.asyncio
async def test_wikipedia_tool_schema():
    tool = WikipediaTool()
    assert tool.name == "search_wikipedia"
    assert "query" in tool.parameters

    empty_res = await tool.execute(query="")
    assert empty_res.success is False
