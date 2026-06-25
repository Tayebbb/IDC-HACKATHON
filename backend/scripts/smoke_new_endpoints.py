"""Full functional smoke test for every backend endpoint after the
RAG-to-backend migration. Assumes uvicorn is running on 127.0.0.1:8000.
"""
import json
import urllib.request
import urllib.error
import uuid
import time

BASE = "http://127.0.0.1:8000"


def call(method, path, body=None, timeout=120, raw_body=None, headers=None):
    url = f"{BASE}{path}"
    if raw_body is not None:
        data = raw_body
        hdrs = dict(headers or {})
    elif body is not None:
        data = json.dumps(body).encode()
        hdrs = {"Content-Type": "application/json"}
        if headers:
            hdrs.update(headers)
    else:
        data = None
        hdrs = dict(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
        ms = int((time.time() - t0) * 1000)
        try:
            return r.status, json.loads(raw), ms
        except Exception:
            return r.status, {"_raw": raw[:300].decode(errors='ignore')}, ms
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="ignore")
        except Exception:
            detail = ""
        return e.code, {"_error": detail[:400]}, int((time.time() - t0) * 1000)
    except Exception as e:
        return 0, {"_error": str(e)[:400]}, int((time.time() - t0) * 1000)


def _make_minimal_pdf(text: str) -> bytes:
    content = f"BT /F1 12 Tf 50 750 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n"
        + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n").encode()
    return bytes(out)


def _multipart(field_name, filename, content, mime="application/pdf"):
    boundary = "----smoke" + uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"{field_name}\"; "
        f"filename=\"{filename}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def fmt(ok, status, ms, label):
    flag = "OK  " if ok else "FAIL"
    return f"[{flag}] {status:3d}  {ms:5d}ms  {label}"


def main():
    print("=" * 78)
    print("FULL FUNCTIONAL TEST — every backend endpoint")
    print("=" * 78)

    s, b, ms = call("GET", "/")
    print(fmt(s == 200, s, ms, "GET /"))

    s, b, ms = call("GET", "/health/dependencies")
    print(fmt(s == 200, s, ms,
              f"GET /health/dependencies  hf_token={b.get('hf_token')} "
              f"corpus={b.get('seed_corpus_loaded')}"))

    # ─── Chatbot ───
    s, b, ms = call("POST", "/chat",
                    {"message": "How do I become a React developer?",
                     "history": []},
                    timeout=60)
    reply = (b.get("reply") or b.get("response") or "")
    print(fmt(s == 200 and len(reply) > 20, s, ms,
              f"POST /chat                 sources={len(b.get('sources') or [])} "
              f"path={b.get('retrieval_path')} reply_len={len(reply)}"))

    # ─── Roadmap ───
    s, b, ms = call("POST", "/roadmap",
                    {"goalJob": "Frontend Developer",
                     "profile": {"skills": ["HTML", "CSS"],
                                 "experienceLevel": "beginner"}},
                    timeout=120)
    content = (b.get("content") or "")
    print(fmt(s == 200 and len(content) > 200, s, ms,
              f"POST /roadmap              content_len={len(content)}"))

    # ─── Mock interview ───
    s, b, ms = call("POST", "/interview/question",
                    {"role": "backend", "difficulty": "intermediate",
                     "questionNumber": 1, "previousQuestions": [],
                     "profile": {"skills": ["Python", "FastAPI"],
                                 "experienceLevel": "intermediate"}},
                    timeout=120)
    q = b.get("question") or ""
    print(fmt(s == 200 and len(q) > 10, s, ms,
              f"POST /interview/question   q_len={len(q)}"))

    s, b, ms = call("POST", "/interview/evaluate",
                    {"question": "What is dependency injection?",
                     "answer": ("Dependency injection is a design pattern where a "
                                "component receives its dependencies from an external "
                                "source rather than constructing them itself, which "
                                "improves testability and decoupling."),
                     "role": "backend", "difficulty": "intermediate",
                     "profile": {"skills": ["Python"],
                                 "experienceLevel": "intermediate"}},
                    timeout=120)
    print(fmt(
        s == 200 and isinstance(b.get("score"), int) and 1 <= b["score"] <= 10,
        s, ms,
        f"POST /interview/evaluate   score={b.get('score')} "
        f"strengths={len(b.get('strengths') or [])} "
        f"improvements={len(b.get('improvements') or [])}"))

    # ─── CV upload (multipart + LLM merge) ───
    pdf_bytes = _make_minimal_pdf(
        "John Doe Python Django React Node.js Docker AWS PostgreSQL Git"
    )
    mp_body, content_type = _multipart("file", "cv.pdf", pdf_bytes)
    s, b, ms = call("POST", "/summarize-cv", raw_body=mp_body,
                    headers={"Content-Type": content_type}, timeout=120)
    data = b.get("data") or {}
    print(fmt(s == 200 and isinstance(data, dict), s, ms,
              f"POST /summarize-cv         keySkills={len(data.get('keySkills') or [])} "
              f"tools={len(data.get('toolsTechnologies') or [])} "
              f"hot_chars={len((b.get('hotSkillsSuggestion') or ''))}"))

    # ─── Envelope routes ───
    s, b, ms = call("POST", "/career-dna",
                    {"skills": ["Python", "React", "Docker", "TensorFlow"]})
    print(fmt(s == 200 and "scores" in b, s, ms,
              f"POST /career-dna           scores={b.get('scores')}"))

    s, b, ms = call("POST", "/readiness-score",
                    {"skills": ["Python", "React"],
                     "profileCompletion": 70, "interviewScore": 75})
    print(fmt(s == 200 and "score" in b, s, ms,
              f"POST /readiness-score      score={b.get('score')}"))

    s, b, ms = call("POST", "/explain-match",
                    {"jobTitle": "Frontend Dev", "score": 72,
                     "matchedSkills": ["React"],
                     "missingSkills": ["TypeScript"],
                     "breakdown": {"skillScore": 48, "expScore": 12, "trackScore": 12}})
    print(fmt(s == 200, s, ms,
              f"POST /explain-match        factors={len(b.get('factors') or [])}"))

    # ─── Static data routes ───
    s, b, ms = call("GET", "/career-advice?q=interview&limit=2")
    print(fmt(s == 200, s, ms,
              f"GET  /career-advice        total={b.get('total')}"))

    s, b, ms = call("GET", "/skill-roadmap?track=Frontend")
    print(fmt(s == 200, s, ms,
              f"GET  /skill-roadmap        total={b.get('total')}"))

    print("=" * 78)


if __name__ == "__main__":
    main()
