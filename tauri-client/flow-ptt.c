#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/time.h>
#include <linux/input.h>
#include <linux/uinput.h>

#define MAX_FDS 64
#define SOCK_PATH "/tmp/flow-uinput.sock"

static int uinput_fd = -1;

static int setup_uinput(void) {
    int fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (fd < 0) {
        fd = open("/dev/input/uinput", O_WRONLY | O_NONBLOCK);
    }
    if (fd < 0) {
        perror("open uinput");
        return -1;
    }

    ioctl(fd, UI_SET_EVBIT, EV_KEY);
    ioctl(fd, UI_SET_EVBIT, EV_SYN);
    ioctl(fd, UI_SET_EVBIT, EV_REP);
    for (int k = 1; k < 256; k++) {
        ioctl(fd, UI_SET_KEYBIT, k);
    }

    struct uinput_setup usetup;
    memset(&usetup, 0, sizeof(usetup));
    usetup.id.bustype = BUS_USB;
    usetup.id.vendor = 0x1234;
    usetup.id.product = 0x5678;
    strcpy(usetup.name, "Flow Virtual Keyboard");

    ioctl(fd, UI_DEV_SETUP, &usetup);
    ioctl(fd, UI_DEV_CREATE);

    printf("✓ [Flow PTT] Teclado virtual persistente uinput criado com sucesso!\n");
    fflush(stdout);
    return fd;
}

static void emit_key(int fd, int type, int code, int val) {
    struct input_event ie;
    memset(&ie, 0, sizeof(ie));
    gettimeofday(&ie.time, NULL);
    ie.type = type;
    ie.code = code;
    ie.value = val;
    write(fd, &ie, sizeof(ie));
}

// Manda SEMPRE os dois (Ctrl+V e Shift+Insert) duplicava o texto colado: a
// maioria dos apps (incluindo terminais modernos) reconhece os dois atalhos
// como "colar", então cada um deles colava uma cópia inteira do texto. Agora
// o chamador (electron-main.cjs, que detecta o app em foco) escolhe UM modo.
static void do_paste_ctrlv(void) {
    if (uinput_fd < 0) return;
    usleep(50000); // 50ms: dá tempo do Wayland registrar o foco e o clipboard

    emit_key(uinput_fd, EV_KEY, KEY_LEFTCTRL, 1);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);
    usleep(25000);

    emit_key(uinput_fd, EV_KEY, KEY_V, 1);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);
    usleep(45000);

    emit_key(uinput_fd, EV_KEY, KEY_V, 0);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);
    usleep(25000);

    emit_key(uinput_fd, EV_KEY, KEY_LEFTCTRL, 0);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);

    printf("📋 [Flow PTT] Ctrl+V simulado com timestamp real!\n");
    fflush(stdout);
}

static void do_paste_shiftinsert(void) {
    if (uinput_fd < 0) return;
    usleep(50000); // 50ms: dá tempo do Wayland registrar o foco e o clipboard

    emit_key(uinput_fd, EV_KEY, KEY_LEFTSHIFT, 1);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);
    usleep(15000);
    emit_key(uinput_fd, EV_KEY, KEY_INSERT, 1);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);
    usleep(35000);
    emit_key(uinput_fd, EV_KEY, KEY_INSERT, 0);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);
    usleep(15000);
    emit_key(uinput_fd, EV_KEY, KEY_LEFTSHIFT, 0);
    emit_key(uinput_fd, EV_SYN, SYN_REPORT, 0);

    printf("📋 [Flow PTT] Shift+Insert simulado com timestamp real!\n");
    fflush(stdout);
}

static void send_trigger(const char *path) {
    int s = socket(AF_INET, SOCK_STREAM, 0);
    if (s < 0) return;
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(1422);
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 200000; // 200ms
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

    if (connect(s, (struct sockaddr *)&addr, sizeof(addr)) == 0) {
        char buf[256];
        snprintf(buf, sizeof(buf), "GET %s HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n", path);
        write(s, buf, strlen(buf));
    }
    close(s);
}

int main(int argc, char *argv[]) {
    // 1. Inicializa o dispositivo de teclado virtual persistente
    uinput_fd = setup_uinput();

    // 2. Cria socket UNIX de comando para colagem instantânea
    unlink(SOCK_PATH);
    int server_sock = socket(AF_UNIX, SOCK_STREAM, 0);
    if (server_sock >= 0) {
        struct sockaddr_un sun;
        memset(&sun, 0, sizeof(sun));
        sun.sun_family = AF_UNIX;
        strncpy(sun.sun_path, SOCK_PATH, sizeof(sun.sun_path) - 1);
        if (bind(server_sock, (struct sockaddr *)&sun, sizeof(sun)) == 0) {
            listen(server_sock, 8);
            chmod(SOCK_PATH, 0666);
        }
    }

    // 3. Descobre teclados em /dev/input (filtrando o próprio teclado virtual Flow)
    struct pollfd pfds[MAX_FDS];
    int pfd_count = 0;

    // Slot 0 é o server_sock
    if (server_sock >= 0) {
        pfds[pfd_count].fd = server_sock;
        pfds[pfd_count].events = POLLIN;
        pfd_count++;
    }

    DIR *dir = opendir("/dev/input");
    if (!dir) {
        perror("opendir /dev/input");
        return 1;
    }

    struct dirent *ent;
    while ((ent = readdir(dir)) != NULL) {
        if (strncmp(ent->d_name, "event", 5) != 0) continue;
        char path[256];
        snprintf(path, sizeof(path), "/dev/input/%s", ent->d_name);
        int fd = open(path, O_RDONLY | O_NONBLOCK);
        if (fd >= 0) {
            char name[256] = {0};
            ioctl(fd, EVIOCGNAME(sizeof(name)), name);
            if (strstr(name, "Flow Virtual Keyboard")) {
                close(fd);
                continue;
            }

            unsigned long evbit[1] = {0};
            ioctl(fd, EVIOCGBIT(0, sizeof(evbit)), evbit);
            if (evbit[0] & (1 << EV_KEY)) {
                pfds[pfd_count].fd = fd;
                pfds[pfd_count].events = POLLIN;
                pfd_count++;
                if (pfd_count >= MAX_FDS) break;
            } else {
                close(fd);
            }
        }
    }
    closedir(dir);

    printf("Flow PTT Daemon: ativo e monitorando %d dispositivos físicos de entrada (Ctrl + Win)!\\n", pfd_count - 1);
    fflush(stdout);

    int is_recording = 0;
    int ctrl_down = 0;
    int meta_down = 0;

    while (1) {
        int ret = poll(pfds, pfd_count, 1000);
        if (ret < 0) break;
        if (ret == 0) continue;

        // Verifica pedidos de paste no server_sock
        if (server_sock >= 0 && (pfds[0].revents & POLLIN)) {
            int client = accept(server_sock, NULL, NULL);
            if (client >= 0) {
                char cmd[32];
                int n = read(client, cmd, sizeof(cmd) - 1);
                if (n > 0) {
                    cmd[n] = '\0';
                    if (strstr(cmd, "PASTE:SHIFTINS")) {
                        do_paste_shiftinsert();
                    } else if (strstr(cmd, "PASTE")) {
                        do_paste_ctrlv();
                    }
                }
                close(client);
            }
        }

        // Verifica teclas nos dispositivos de entrada físicos (i = 1 até pfd_count)
        for (int i = 1; i < pfd_count; i++) {
            if (pfds[i].revents & POLLIN) {
                struct input_event ev;
                while (read(pfds[i].fd, &ev, sizeof(ev)) > 0) {
                    if (ev.type != EV_KEY) continue;

                    // Atualiza estado de Ctrl e Win (Super)
                    if (ev.code == KEY_LEFTCTRL || ev.code == KEY_RIGHTCTRL) {
                        ctrl_down = (ev.value != 0);
                    } else if (ev.code == KEY_LEFTMETA || ev.code == KEY_RIGHTMETA) {
                        meta_down = (ev.value != 0);
                    }

                    // Condição EXCLUSIVA: Segurar Ctrl + Win (Push-to-Talk)
                    int should_record = (ctrl_down && meta_down);

                    if (should_record && !is_recording) {
                        is_recording = 1;
                        printf("🎙️ [Flow PTT] Ctrl+Win pressionado! Gravando...\n");
                        fflush(stdout);
                        send_trigger("/start");
                    } else if (!should_record && is_recording) {
                        is_recording = 0;
                        printf("⏹️ [Flow PTT] Ctrl+Win solto! Finalizando gravação e colando...\n");
                        fflush(stdout);
                        send_trigger("/stop");
                    }
                }
            }
        }
    }

    if (uinput_fd >= 0) {
        ioctl(uinput_fd, UI_DEV_DESTROY);
        close(uinput_fd);
    }
    if (server_sock >= 0) {
        close(server_sock);
        unlink(SOCK_PATH);
    }
    for (int i = 1; i < pfd_count; i++) {
        close(pfds[i].fd);
    }
    return 0;
}
