import ast
import operator

from app.schemas.tools import ToolParameter, ToolResult
from app.tools.base import BaseTool


class CalculatorTool(BaseTool):
    _operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
        ast.Mod: operator.mod,
    }

    @property
    def name(self) -> str:
        return "calculator"

    @property
    def description(self) -> str:
        return "Evaluate a mathematical expression safely. Supports +, -, *, /, %, **, and parentheses."

    @property
    def parameters(self) -> dict[str, ToolParameter]:
        return {
            "expression": ToolParameter(
                type="string",
                description="The mathematical expression to evaluate (e.g., '2 + 3 * 4', '(10 - 5) / 2')",
            ),
        }

    @property
    def required(self) -> list[str]:
        return ["expression"]

    def _eval(self, node: ast.AST) -> float:
        if isinstance(node, ast.Constant):
            if isinstance(node.value, int | float):
                return node.value
            raise ValueError("Only numeric constants are allowed")

        if isinstance(node, ast.BinOp):
            left = self._eval(node.left)
            right = self._eval(node.right)
            op_type = type(node.op)
            if op_type in self._operators:
                return self._operators[op_type](left, right)  # type: ignore[no-any-return, operator]
            raise ValueError(f"Unsupported operator: {op_type}")

        if isinstance(node, ast.UnaryOp):
            operand = self._eval(node.operand)
            op_type = type(node.op)  # type: ignore[assignment]
            if op_type in self._operators:
                return self._operators[op_type](operand)  # type: ignore[no-any-return, operator]
            raise ValueError(f"Unsupported unary operator: {op_type}")

        if isinstance(node, ast.Expression):
            return self._eval(node.body)

        raise ValueError(f"Unsupported expression type: {type(node)}")

    async def execute(self, expression: str) -> ToolResult:
        try:
            if not expression or not expression.strip():
                return ToolResult(success=False, error="Empty expression")

            if len(expression) > 500:
                return ToolResult(success=False, error="Expression too long")

            node = ast.parse(expression, mode="eval")
            result = self._eval(node)
            return ToolResult(success=True, result=result)

        except ZeroDivisionError:
            return ToolResult(success=False, error="Division by zero")
        except (SyntaxError, ValueError, TypeError, OverflowError) as e:
            return ToolResult(success=False, error=f"Invalid expression: {str(e)}")
        except Exception as e:
            return ToolResult(success=False, error=f"Calculation error: {str(e)}")
