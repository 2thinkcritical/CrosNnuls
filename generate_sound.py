import wave
import math
import struct
import random

def generate_click(filename, duration=0.1):
    sample_rate = 44100
    n_frames = int(duration * sample_rate)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(n_frames):
            t = i / sample_rate
            
            # 1. The "Click" (High pitched, very short) - The tactile bump
            # 2kHz to 1kHz drop, lasts 5ms
            click_env = 0
            if t < 0.005:
                click_env = math.exp(-t * 1000)
            click_val = math.sin(2 * math.pi * 1500 * t) * click_env * 0.5
            
            # 2. The "Thock" (Bottom out, lower pitch)
            # 300Hz, lasts longer
            thock_env = 0
            if t < 0.05:
                thock_env = math.exp(-t * 80)
            thock_val = math.sin(2 * math.pi * 250 * t) * thock_env * 0.8
            
            # 3. Plastic "Clack" (Noise burst)
            noise_env = 0
            if t < 0.01:
                noise_env = math.exp(-t * 500)
            noise_val = (random.random() - 0.5) * 2 * noise_env * 0.4
            
            # Mix them together
            final_val = click_val + thock_val + noise_val
            
            # Master volume and clamping
            value = int(32767.0 * final_val * 0.8)
            value = max(-32767, min(32767, value))
            
            data = struct.pack('<h', value)
            wav_file.writeframes(data)

if __name__ == "__main__":
    generate_click('docs/click.wav')
    print("Generated docs/click.wav")
