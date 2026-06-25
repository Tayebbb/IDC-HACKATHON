"""Smoke test the three new endpoints."""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def call(method, path, body=None, timeout=120):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            payload = json.loads(r.read())
        return r.status, payload
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="ignore")
        except Exception:
            detail = ""
        return e.code, {"_error": detail[:600]}
    except Exception as e:
        return 0, {"_error": str(e)[:600]}


def main():
    results = []

    # /roadmap
    status, body = call(
        "POST", "/roadmap",
        {"goalJob": "Backend Developer",
         "profile": {"skills": ["Python", "Django"],
                     "experienceLevel": "beginner"}},
    )
    content = (body or {}).get("content") or body.get("_error", "")
    results.append((
        "POST /roadmap",
        status,
        f"len={len(content)}",
        content[:250].replace("\n", " | "),
    ))

    # /interview/question
    status, body = call(
        "POST", "/interview/question",
        {"role": "frontend", "difficulty": "intermediate",
         "questionNumber": 1, "previousQuestions": [],
         "profile": {"skills": ["React", "JavaScript"],
                     "experienceLevel": "intermediate"}},
    )
    q = (body or {}).get("question") or body.get("_error", "")
    results.append(("POST /interview/question", status, f"len={len(q)}", q[:250]))

    # /interview/evaluate
    status, body = call(
        "POST", "/interview/evaluate",
        {"question": "What is React's virtual DOM?",
         "answer": "The virtual DOM is an in-memory representation of the real DOM "
                   "that React uses to diff and patch only the changed nodes, "
                   "minimizing direct DOM mutations.",
         "role": "frontend", "difficulty": "intermediate",
         "profile": {"skills": ["React"], "experienceLevel": "intermediate"}},
    )
    if isinstance(body, dict) and "score" in body:
        summary = (
            f"score={body.get('score')} "
            f"strengths={len(body.get('strengths') or [])} "
            f"improvements={len(body.get('improvements') or [])}"
        )
        feedback = (body.get("feedback") or "")[:180]
    else:
        summary = str(body)[:120]
        feedback = ""
    results.append(("POST /interview/evaluate", status, summary, feedback))

    print("\n=== ENDPOINT SMOKE TEST RESULTS ===")
    for name, status, summary, preview in results:
        flag = "OK " if 200 <= int(status) < 300 else "FAIL"
        print(f"[{flag}] {status:3d}  {name}")
        print(f"        {summary}")
        if preview:
            print(f"        > {preview}")
        print()


if __name__ == "__main__":
    main()
