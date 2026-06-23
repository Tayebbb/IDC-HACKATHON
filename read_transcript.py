import json

path = r'C:\Users\User\.gemini\antigravity\brain\81068cac-1eee-4445-9231-93aa82a06809\.system_generated\logs\transcript.jsonl'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

inputs = [json.loads(l) for l in lines if json.loads(l).get('type') == 'USER_INPUT']
responses = [json.loads(l) for l in lines if json.loads(l).get('type') == 'PLANNER_RESPONSE']

print(f"Total user inputs: {len(inputs)}")
print(f"Total model responses: {len(responses)}")
print()

for i, x in enumerate(inputs[-5:]):
    print(f"--- USER MSG {i} ---")
    print(x.get('content', '')[:800])
    print()

print("\n=== LAST MODEL RESPONSE ===")
if responses:
    last = responses[-1]
    content = last.get('content', '')
    print(content[:2000])
