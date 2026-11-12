import subprocess
import time
import re
import json

def get_mem():
    out = subprocess.check_output(['adb', 'shell', 'dumpsys', 'meminfo', 'org.m3.surveillance']).decode('utf-8')
    pss_match = re.search(r'TOTAL PSS:\s+(\d+)', out)
    total_pss_kb = int(pss_match.group(1)) if pss_match else 0
    native_match = re.search(r'Native Heap\s+(\d+)', out)
    java_match = re.search(r'Java Heap\s+(\d+)', out)
    total_rss_match = re.search(r'TOTAL RSS:\s+(\d+)', out)
    
    return {
        'total_pss_mb': round(total_pss_kb / 1024, 2),
        'native_mb': round(int(native_match.group(1)) / 1024, 2) if native_match else 0,
        'java_mb': round(int(java_match.group(1)) / 1024, 2) if java_match else 0,
        'total_rss_mb': round(int(total_rss_match.group(1)) / 1024, 2) if total_rss_match else 0
    }

def get_pid():
    out = subprocess.check_output(['adb', 'shell', 'pidof', 'org.m3.surveillance']).decode('utf-8').strip()
    return out

def get_battery_thermal():
    b_out = subprocess.check_output(['adb', 'shell', 'dumpsys', 'battery']).decode('utf-8')
    t_out = subprocess.check_output(['adb', 'shell', 'dumpsys', 'thermalservice']).decode('utf-8')
    level = re.search(r'level:\s+(\d+)', b_out)
    temp = re.search(r'temperature:\s+(\d+)', b_out)
    charging = 'USB powered: true' in b_out or 'AC powered: true' in b_out
    t_status = re.search(r'Thermal Status:\s+(\d+)', t_out)
    cpu_temp = re.search(r'Temperature{mValue=([0-9.]+), mType=0, mName=CPU', t_out)
    return {
        'level': int(level.group(1)) if level else None,
        'battery_temp_c': float(temp.group(1))/10.0 if temp else None,
        'charging': charging,
        'thermal_status': int(t_status.group(1)) if t_status else 0,
        'cpu_temp_c': float(cpu_temp.group(1)) if cpu_temp else None
    }

print("Starting audio & memory profiling suite...")
initial_bt = get_battery_thermal()
initial_pid = get_pid()
print(f"Initial PID: {initial_pid}, Initial Battery/Thermal: {initial_bt}")

results = {
    'initial_battery_thermal': initial_bt,
    'tests': {}
}

# Ensure we are in a fresh audio state by tapping delete if present
subprocess.run(['adb', 'shell', 'input', 'tap', '665', '1236'])
time.sleep(1)

# Helper to record for duration
def record_test(name, duration_sec):
    print(f"\n--- Running {name} ({duration_sec}s) ---")
    # Tap Record
    subprocess.run(['adb', 'shell', 'input', 'tap', '399', '1246'])
    samples = []
    start_time = time.time()
    while time.time() - start_time < duration_sec:
        m = get_mem()
        samples.append(m)
        time.sleep(1)
    
    # Tap Stop
    subprocess.run(['adb', 'shell', 'input', 'tap', '399', '1270'])
    time.sleep(1)
    post_stop_mem = get_mem()
    
    # Tap Play
    subprocess.run(['adb', 'shell', 'input', 'tap', '135', '1268'])
    time.sleep(2)
    playback_mem = get_mem()
    
    # Let playback run for 2s then tap delete for next run
    subprocess.run(['adb', 'shell', 'input', 'tap', '665', '1236'])
    time.sleep(1)
    
    peak_pss = max(s['total_pss_mb'] for s in samples) if samples else post_stop_mem['total_pss_mb']
    headroom = round(150.0 - peak_pss, 2)
    pid_now = get_pid()
    stable = (pid_now == initial_pid)
    
    res = {
        'duration_sec': duration_sec,
        'peak_pss_mb': peak_pss,
        'post_stop_pss_mb': post_stop_mem['total_pss_mb'],
        'playback_pss_mb': playback_mem['total_pss_mb'],
        'headroom_mb': headroom,
        'pid': pid_now,
        'stable': stable
    }
    print(f"Result for {name}: {res}")
    return res

results['tests']['duration_5s'] = record_test("Audio 5s", 5)
results['tests']['duration_15s'] = record_test("Audio 15s", 15)
results['tests']['duration_30s'] = record_test("Audio 30s", 30)

# Memory leak test: 5 consecutive record & play cycles
print("\n--- Running 5-Cycle Leak Test ---")
leak_cycles = []
for c in range(1, 6):
    print(f"Cycle {c}...")
    subprocess.run(['adb', 'shell', 'input', 'tap', '399', '1246'])
    time.sleep(3)
    rec_m = get_mem()
    subprocess.run(['adb', 'shell', 'input', 'tap', '399', '1270'])
    time.sleep(1)
    subprocess.run(['adb', 'shell', 'input', 'tap', '135', '1268'])
    time.sleep(2)
    play_m = get_mem()
    subprocess.run(['adb', 'shell', 'input', 'tap', '665', '1236'])
    time.sleep(1)
    idle_m = get_mem()
    cycle_res = {
        'cycle': c,
        'rec_pss': rec_m['total_pss_mb'],
        'play_pss': play_m['total_pss_mb'],
        'idle_pss': idle_m['total_pss_mb']
    }
    leak_cycles.append(cycle_res)
    print(f"Cycle {c} result: {cycle_res}")

results['tests']['leak_cycles'] = leak_cycles

# Audio + GPS active test
print("\n--- Running Audio + Concurrent GPS Activity Test ---")
# Trigger GPS location provider update on device
subprocess.run(['adb', 'shell', 'cmd', 'location', 'set-location-enabled', 'true'])
# Tap Record
subprocess.run(['adb', 'shell', 'input', 'tap', '399', '1246'])
time.sleep(1)
gps_samples = []
for _ in range(5):
    # send a location ping / query location services
    subprocess.run(['adb', 'shell', 'dumpsys', 'location'])
    gps_samples.append(get_mem())
    time.sleep(1)
subprocess.run(['adb', 'shell', 'input', 'tap', '399', '1270'])
time.sleep(1)
subprocess.run(['adb', 'shell', 'input', 'tap', '665', '1236'])
time.sleep(1)

peak_gps_pss = max(s['total_pss_mb'] for s in gps_samples)
results['tests']['audio_with_gps'] = {
    'peak_pss_mb': peak_gps_pss,
    'headroom_mb': round(150.0 - peak_gps_pss, 2),
    'stable': (get_pid() == initial_pid)
}
print(f"Audio + GPS Result: {results['tests']['audio_with_gps']}")

final_bt = get_battery_thermal()
results['final_battery_thermal'] = final_bt
print(f"Final Battery/Thermal: {final_bt}")

with open('/tmp/audio_memory_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("\nAll memory profiling tests completed successfully! Results written to /tmp/audio_memory_results.json")
