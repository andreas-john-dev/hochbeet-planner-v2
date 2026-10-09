from bed_assistant.auth import Caller, caller_from_headers

from .helpers import token


def test_reads_sub_and_groups_from_the_bearer_token() -> None:
    headers = {"authorization": f"Bearer {token({'sub': 'u-1', 'cognito:groups': ['admins']})}"}
    assert caller_from_headers(headers) == Caller("u-1", frozenset({"admins"}))


def test_accepts_groups_as_the_string_http_apis_send() -> None:
    headers = {"Authorization": f"Bearer {token({'sub': 'u-1', 'cognito:groups': '[a b]'})}"}
    caller = caller_from_headers(headers)
    assert caller is not None
    assert caller.groups == frozenset({"a", "b"})


def test_no_caller_without_a_readable_token_or_sub() -> None:
    assert caller_from_headers({}) is None
    assert caller_from_headers({"Authorization": "Basic abc"}) is None
    assert caller_from_headers({"Authorization": "Bearer kein.jwt"}) is None
    assert caller_from_headers({"Authorization": "Bearer a.%%%.c"}) is None
    assert caller_from_headers({"Authorization": f"Bearer {token({'groups': []})}"}) is None
