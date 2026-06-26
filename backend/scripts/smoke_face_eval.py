"""Quick smoke test for the /face-expression + /interview/evaluate fixes."""
import json
import urllib.request

BASE = 'http://127.0.0.1:7860'
JPG = bytes([
    255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,
    255,219,0,67,0,8,6,6,7,6,5,8,7,7,7,9,9,8,10,12,20,
    13,12,11,11,12,25,18,19,15,20,29,26,31,30,29,26,28,28,
    32,36,46,39,32,34,44,35,28,28,40,55,41,44,48,49,52,52,
    52,31,39,57,61,56,50,60,46,51,52,50,255,217
])


def hit_face():
    boundary = '----CPbnd'
    body = (
        f'--{boundary}\r\n'
        'Content-Disposition: form-data; name="file"; filename="t.jpg"\r\n'
        'Content-Type: image/jpeg\r\n\r\n'
    ).encode() + JPG + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(
        BASE + '/face-expression',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
    )
    r = urllib.request.urlopen(req, timeout=30)
    return r.status, json.loads(r.read())


def hit_eval(emotion=False):
    payload = {
        'question': 'What is REST?',
        'answer': 'REST is an architectural style for HTTP APIs using resources and verbs.',
        'role': 'Backend',
        'difficulty': 'intermediate',
    }
    if emotion:
        payload.update({
            'emotionSummary': {'dominant': 'fear'},
            'presenceScore': 72,
            'dominantEmotion': 'fear',
            'negativePct': 48,
        })
    req = urllib.request.Request(
        BASE + '/interview/evaluate',
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
    )
    r = urllib.request.urlopen(req, timeout=60)
    return r.status, json.loads(r.read())


print('=== /face-expression ===')
s, body = hit_face()
print('status =', s)
print(json.dumps(body, indent=2))
labels = body.get('labels') or []
print('-- assertions --')
print('  200?                     ', s == 200)
print('  has labels field?        ', 'labels' in body)
print('  has top_label/top_score? ', 'top_label' in body and 'top_score' in body)
print('  has retrieval_path?      ', 'retrieval_path' in body)
print('  has success?             ', 'success' in body)
print('  labels list of dicts?    ', isinstance(labels, list) and all(isinstance(x, dict) for x in labels))
print('  labels lowercase?        ', all(x.get('label', '').islower() for x in labels))
print('  sorted desc by score?    ', labels == sorted(labels, key=lambda x: x.get('score', 0), reverse=True))

print()
print('=== /interview/evaluate (no emotion) ===')
s, body = hit_eval(emotion=False)
print('status =', s)
print(json.dumps(body, indent=2))
print('-- assertions --')
print('  4 frozen fields present? ',
      all(k in body for k in ('score', 'feedback', 'strengths', 'improvements')))
print('  expression_feedback OMITTED when no emotion? ',
      'expression_feedback' not in body)

print()
print('=== /interview/evaluate (with emotion, high stress) ===')
s, body = hit_eval(emotion=True)
print('status =', s)
print(json.dumps(body, indent=2))
print('-- assertions --')
print('  4 frozen fields present? ',
      all(k in body for k in ('score', 'feedback', 'strengths', 'improvements')))
print('  expression_feedback present when emotion provided? ',
      'expression_feedback' in body)
