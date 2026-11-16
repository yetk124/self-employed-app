"""에러 응답을 명세서 모양으로 통일: {"error": {"code", "message"}}"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def bad(message: str) -> ApiError:
    return ApiError(400, "BAD_REQUEST", message)


def not_found(what: str = "데이터") -> ApiError:
    return ApiError(404, "NOT_FOUND", f"{what}를 찾을 수 없어요.")


def _body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, e: ApiError):
        return JSONResponse(_body(e.code, e.message), status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, e: RequestValidationError):
        first = e.errors()[0] if e.errors() else {}
        where = ".".join(str(x) for x in first.get("loc", [])[1:])
        return JSONResponse(_body("VALIDATION_ERROR", f"입력값을 확인해 주세요. ({where})"), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(e.status_code, "ERROR")
        return JSONResponse(_body(code, str(e.detail)), status_code=e.status_code)

    @app.exception_handler(Exception)
    async def _any(_: Request, e: Exception):
        return JSONResponse(_body("SERVER_ERROR", "잠시 후 다시 시도해 주세요."), status_code=500)
