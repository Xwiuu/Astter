import os
import sys
import time
import subprocess
import Xlib.display
import Xlib.X
import Xlib.XK
import Xlib.ext.xtest

def simulate_paste():
    # 1. Tenta simular via dispositivo de teclado virtual do kernel Linux (/dev/uinput)
    # Isso funciona de forma nativa e transparente no Wayland (Brave, VS Code, Kitty, Discord, etc.)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    uinput_bin = os.path.join(base_dir, 'flow-paste')
    if os.path.isfile(uinput_bin) and os.access(uinput_bin, os.X_OK):
        try:
            res = subprocess.run([uinput_bin], capture_output=True, text=True, timeout=1.5)
            if 'PASTE_SUCCESS' in res.stdout:
                sys.stdout.write("Flow: uinput Ctrl+V simulated successfully on Wayland!\n")
                return True
            else:
                sys.stderr.write(f"Flow: uinput fallback ({res.stdout.strip()})\n")
        except Exception as e:
            sys.stderr.write(f"Flow: flow-paste execution error: {e}\n")

    # 2. Fallback para XTEST / X11 (para apps rodando sob Xwayland / X11 clássico)
    try:
        disp = Xlib.display.Display(':0')
        ctrl_code = disp.keysym_to_keycode(Xlib.XK.XK_Control_L)
        v_code = disp.keysym_to_keycode(Xlib.XK.XK_v)
        
        time.sleep(0.06)
        
        Xlib.ext.xtest.fake_input(disp, Xlib.X.KeyPress, ctrl_code)
        Xlib.ext.xtest.fake_input(disp, Xlib.X.KeyPress, v_code)
        Xlib.ext.xtest.fake_input(disp, Xlib.X.KeyRelease, v_code)
        Xlib.ext.xtest.fake_input(disp, Xlib.X.KeyRelease, ctrl_code)
        disp.sync()
        return True
    except Exception as e:
        sys.stderr.write(f"simulate_paste error: {e}\n")
        return False

if __name__ == '__main__':
    simulate_paste()
