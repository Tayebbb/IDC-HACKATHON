import json, sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\User\.gemini\antigravity\brain\81068cac-1eee-4445-9231-93aa82a06809\.system_generated\logs\transcript.jsonl'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

responses = [json.loads(l) for l in lines if json.loads(l).get('type') == 'PLANNER_RESPONSE']
print(f'Total responses: {len(responses)}')

# Show last 5 responses
for i, r in enumerate(responses[-5:]):
    print(f'\n=== RESPONSE {len(responses)-5+i} ===')
    content = r.get('content', '')
    print(content[:800] if content else '(no text content)')
    for tc in r.get('tool_calls', []):
        name = tc.get('name', '')
        args = tc.get('args', {})
        # show only key args
        if name == 'run_command':
            print(f"  TOOL: run_command -> {str(args.get('CommandLine', ''))[:200]}")
        elif name == 'write_to_file':
            print(f"  TOOL: write_to_file -> {args.get('TargetFile', '')}")
        else:
            print(f"  TOOL: {name}")
