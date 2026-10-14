#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <linux/uinput.h>
#include <linux/input.h>

static void emit(int fd, int type, int code, int val) {
    struct input_event ie;
    memset(&ie, 0, sizeof(ie));
    ie.type = type;
    ie.code = code;
    ie.value = val;
    write(fd, &ie, sizeof(ie));
}

int main(int argc, char *argv[]) {
    int fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (fd < 0) {
        fd = open("/dev/input/uinput", O_WRONLY | O_NONBLOCK);
    }
    if (fd < 0) {
        fprintf(stderr, "ERR_UINPUT_PERMISSION\n");
        return 1;
    }

    // Enable EV_KEY
    ioctl(fd, UI_SET_EVBIT, EV_KEY);
    ioctl(fd, UI_SET_KEYBIT, KEY_LEFTCTRL);
    ioctl(fd, UI_SET_KEYBIT, KEY_LEFTSHIFT);
    ioctl(fd, UI_SET_KEYBIT, KEY_V);

    struct uinput_setup usetup;
    memset(&usetup, 0, sizeof(usetup));
    usetup.id.bustype = BUS_USB;
    usetup.id.vendor = 0x1234;
    usetup.id.product = 0x5678;
    strcpy(usetup.name, "Flow Virtual Keyboard");

    ioctl(fd, UI_DEV_SETUP, &usetup);
    ioctl(fd, UI_DEV_CREATE);

    // Give kernel/compositor a brief moment to discover device
    usleep(80000); // 80ms

    // Press Ctrl + V
    emit(fd, EV_KEY, KEY_LEFTCTRL, 1);
    emit(fd, EV_SYN, SYN_REPORT, 0);
    usleep(15000);

    emit(fd, EV_KEY, KEY_V, 1);
    emit(fd, EV_SYN, SYN_REPORT, 0);
    usleep(25000);

    emit(fd, EV_KEY, KEY_V, 0);
    emit(fd, EV_SYN, SYN_REPORT, 0);
    usleep(15000);

    emit(fd, EV_KEY, KEY_LEFTCTRL, 0);
    emit(fd, EV_SYN, SYN_REPORT, 0);

    usleep(20000);

    ioctl(fd, UI_DEV_DESTROY);
    close(fd);
    printf("PASTE_SUCCESS\n");
    return 0;
}
