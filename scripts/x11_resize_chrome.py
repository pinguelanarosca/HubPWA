#!/usr/bin/env python3
"""
Zero-dependency X11/XWayland launcher, window resizer, and title keeper for Ubuntu Chrome PWA Hub.
Uses ctypes + libX11.so.6 directly (pre-installed on Ubuntu Desktop) so neither wmctrl nor xdotool is required.
"""

import ctypes
import ctypes.util
import json
import os
import select
import subprocess
import sys
import time


class XEvent(ctypes.Union):
    _fields_ = [
        ("type", ctypes.c_int),
        ("pad", ctypes.c_long * 24),
    ]


class XClientMessageEventData(ctypes.Union):
    _fields_ = [
        ("b", ctypes.c_char * 20),
        ("s", ctypes.c_short * 10),
        ("l", ctypes.c_long * 5),
    ]


class XClientMessageEvent(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_int),
        ("serial", ctypes.c_ulong),
        ("send_event", ctypes.c_int),
        ("display", ctypes.c_void_p),
        ("window", ctypes.c_ulong),
        ("message_type", ctypes.c_ulong),
        ("format", ctypes.c_int),
        ("data", XClientMessageEventData),
    ]


class XClientEventUnion(ctypes.Union):
    _fields_ = [
        ("type", ctypes.c_int),
        ("xclient", XClientMessageEvent),
        ("pad", ctypes.c_long * 24),
    ]


ERROR_HANDLER_TYPE = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p)
_ERR_HANDLER_REF = None


def _noop_x11_error_handler(_dpy, _err):
    return 0


def load_x11():
    global _ERR_HANDLER_REF
    x11 = None
    for candidate in ("libX11.so.6", "libX11.so"):
        try:
            x11 = ctypes.cdll.LoadLibrary(candidate)
            break
        except OSError:
            continue
    if x11 is None:
        lib_path = ctypes.util.find_library("X11") or "libX11.so.6"
        x11 = ctypes.cdll.LoadLibrary(lib_path)

    _ERR_HANDLER_REF = ERROR_HANDLER_TYPE(_noop_x11_error_handler)
    x11.XSetErrorHandler.argtypes = [ERROR_HANDLER_TYPE]
    x11.XSetErrorHandler.restype = ctypes.c_void_p
    x11.XSetErrorHandler(_ERR_HANDLER_REF)

    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = ctypes.c_void_p

    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.restype = ctypes.c_int

    x11.XConnectionNumber.argtypes = [ctypes.c_void_p]
    x11.XConnectionNumber.restype = ctypes.c_int

    x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
    x11.XDefaultRootWindow.restype = ctypes.c_ulong

    x11.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
    x11.XInternAtom.restype = ctypes.c_ulong

    x11.XGetWindowProperty.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_ulong,
        ctypes.c_long,
        ctypes.c_long,
        ctypes.c_int,
        ctypes.c_ulong,
        ctypes.POINTER(ctypes.c_ulong),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_ulong),
        ctypes.POINTER(ctypes.c_ulong),
        ctypes.POINTER(ctypes.c_void_p),
    ]
    x11.XGetWindowProperty.restype = ctypes.c_int

    x11.XChangeProperty.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_ulong,
        ctypes.c_ulong,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_char_p,
        ctypes.c_int,
    ]
    x11.XChangeProperty.restype = ctypes.c_int

    x11.XGetGeometry.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.POINTER(ctypes.c_ulong),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_uint),
        ctypes.POINTER(ctypes.c_uint),
        ctypes.POINTER(ctypes.c_uint),
        ctypes.POINTER(ctypes.c_uint),
    ]
    x11.XGetGeometry.restype = ctypes.c_int

    x11.XSelectInput.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_long]
    x11.XSelectInput.restype = ctypes.c_int

    x11.XPending.argtypes = [ctypes.c_void_p]
    x11.XPending.restype = ctypes.c_int

    x11.XNextEvent.argtypes = [ctypes.c_void_p, ctypes.POINTER(XEvent)]
    x11.XNextEvent.restype = ctypes.c_int

    x11.XFree.argtypes = [ctypes.c_void_p]
    x11.XFree.restype = ctypes.c_int

    x11.XSendEvent.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_int,
        ctypes.c_long,
        ctypes.POINTER(XClientEventUnion),
    ]
    x11.XSendEvent.restype = ctypes.c_int

    x11.XResizeWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_uint, ctypes.c_uint]
    x11.XResizeWindow.restype = ctypes.c_int

    x11.XMoveResizeWindow.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_uint,
        ctypes.c_uint,
    ]
    x11.XMoveResizeWindow.restype = ctypes.c_int

    x11.XDefaultScreen.argtypes = [ctypes.c_void_p]
    x11.XDefaultScreen.restype = ctypes.c_int

    x11.XDisplayWidth.argtypes = [ctypes.c_void_p, ctypes.c_int]
    x11.XDisplayWidth.restype = ctypes.c_int

    x11.XDisplayHeight.argtypes = [ctypes.c_void_p, ctypes.c_int]
    x11.XDisplayHeight.restype = ctypes.c_int

    x11.XTranslateCoordinates.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_ulong,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_int),
        ctypes.POINTER(ctypes.c_ulong),
    ]
    x11.XTranslateCoordinates.restype = ctypes.c_int

    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XFlush.restype = ctypes.c_int

    x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
    x11.XSync.restype = ctypes.c_int

    return x11


def get_window_property(x11, dpy, wid, atom):
    actual_type = ctypes.c_ulong()
    actual_format = ctypes.c_int()
    nitems = ctypes.c_ulong()
    bytes_after = ctypes.c_ulong()
    prop = ctypes.c_void_p()

    status = x11.XGetWindowProperty(
        dpy,
        wid,
        atom,
        0,
        4096,
        0,
        0,  # AnyPropertyType
        ctypes.byref(actual_type),
        ctypes.byref(actual_format),
        ctypes.byref(nitems),
        ctypes.byref(bytes_after),
        ctypes.byref(prop),
    )
    if status != 0 or not prop.value:
        return None, 0, 0
    return prop, actual_format.value, nitems.value


def get_all_client_list_ids(x11, dpy, root, client_list_atom):
    prop, fmt, count = get_window_property(x11, dpy, root, client_list_atom)
    if not prop or fmt != 32 or count == 0:
        if prop:
            x11.XFree(prop)
        return []

    wids = (ctypes.c_ulong * count).from_address(prop.value)
    all_wids = [int(wids[i]) for i in range(count)]
    x11.XFree(prop)
    return all_wids


def get_chrome_window_ids(x11, dpy, root, client_list_atom, wm_class_atom):
    all_wids = get_all_client_list_ids(x11, dpy, root, client_list_atom)
    chrome_wids = []
    for wid in all_wids:
        cprop, cfmt, ccount = get_window_property(x11, dpy, wid, wm_class_atom)
        if cprop and cfmt == 8 and ccount > 0:
            raw = ctypes.string_at(cprop.value, ccount)
            x11.XFree(cprop)
            lower = raw.decode("utf-8", errors="ignore").lower()
            if "chrome" in lower or "chromium" in lower or "crx_" in lower:
                chrome_wids.append(wid)
        elif cprop:
            x11.XFree(cprop)
    return chrome_wids


def get_window_geometry_abs(x11, dpy, root, wid):
    root_ret = ctypes.c_ulong()
    x_ret = ctypes.c_int()
    y_ret = ctypes.c_int()
    w_ret = ctypes.c_uint()
    h_ret = ctypes.c_uint()
    bw_ret = ctypes.c_uint()
    depth_ret = ctypes.c_uint()
    ok = x11.XGetGeometry(
        dpy,
        wid,
        ctypes.byref(root_ret),
        ctypes.byref(x_ret),
        ctypes.byref(y_ret),
        ctypes.byref(w_ret),
        ctypes.byref(h_ret),
        ctypes.byref(bw_ret),
        ctypes.byref(depth_ret),
    )
    if ok == 0:
        return None
    abs_x = ctypes.c_int()
    abs_y = ctypes.c_int()
    child_ret = ctypes.c_ulong()
    x11.XTranslateCoordinates(dpy, wid, root, 0, 0, ctypes.byref(abs_x), ctypes.byref(abs_y), ctypes.byref(child_ret))
    return (int(abs_x.value), int(abs_y.value), int(w_ret.value), int(h_ret.value))


def get_window_size(x11, dpy, wid):
    root_ret = ctypes.c_ulong()
    x_ret = ctypes.c_int()
    y_ret = ctypes.c_int()
    w_ret = ctypes.c_uint()
    h_ret = ctypes.c_uint()
    bw_ret = ctypes.c_uint()
    depth_ret = ctypes.c_uint()
    ok = x11.XGetGeometry(
        dpy,
        wid,
        ctypes.byref(root_ret),
        ctypes.byref(x_ret),
        ctypes.byref(y_ret),
        ctypes.byref(w_ret),
        ctypes.byref(h_ret),
        ctypes.byref(bw_ret),
        ctypes.byref(depth_ret),
    )
    if ok == 0:
        return None
    return (int(w_ret.value), int(h_ret.value))


def get_net_wm_name_bytes(x11, dpy, wid, net_wm_name_atom):
    prop, fmt, count = get_window_property(x11, dpy, wid, net_wm_name_atom)
    if not prop:
        return b""
    try:
        if fmt == 8 and count > 0:
            return ctypes.string_at(prop.value, count)
        return b""
    finally:
        x11.XFree(prop)


def set_window_title(x11, dpy, wid, title, atoms):
    if not title:
        return
    utf8_bytes = title.encode("utf-8")
    latin1_bytes = title.encode("latin-1", errors="replace")

    current = get_net_wm_name_bytes(x11, dpy, wid, atoms["net_wm_name"])
    if current == utf8_bytes:
        return

    PropModeReplace = 0
    XA_STRING = 31

    x11.XChangeProperty(
        dpy, wid, atoms["net_wm_name"], atoms["utf8_string"], 8, PropModeReplace, utf8_bytes, len(utf8_bytes)
    )
    x11.XChangeProperty(
        dpy, wid, atoms["net_wm_icon_name"], atoms["utf8_string"], 8, PropModeReplace, utf8_bytes, len(utf8_bytes)
    )
    x11.XChangeProperty(
        dpy, wid, atoms["wm_name"], XA_STRING, 8, PropModeReplace, latin1_bytes, len(latin1_bytes)
    )
    x11.XChangeProperty(
        dpy, wid, atoms["wm_icon_name"], XA_STRING, 8, PropModeReplace, latin1_bytes, len(latin1_bytes)
    )
    x11.XFlush(dpy)


def send_resize_commands(x11, dpy, root, wid, width, height, atoms):
    mask = (1 << 20) | (1 << 19)  # SubstructureRedirectMask | SubstructureNotifyMask

    # 1. Remove maximized / fullscreen states so WM allows exact portrait size
    for prop_atom_a, prop_atom_b in (
        (atoms["max_vert"], atoms["max_horz"]),
        (atoms["fullscreen"], 0),
    ):
        ev = XClientEventUnion()
        ev.xclient.type = 33
        ev.xclient.send_event = 1
        ev.xclient.display = dpy
        ev.xclient.window = wid
        ev.xclient.message_type = atoms["net_wm_state"]
        ev.xclient.format = 32
        ev.xclient.data.l[0] = 0  # _NET_WM_STATE_REMOVE
        ev.xclient.data.l[1] = prop_atom_a
        ev.xclient.data.l[2] = prop_atom_b
        ev.xclient.data.l[3] = 2  # source indication: pager/tool
        ev.xclient.data.l[4] = 0
        x11.XSendEvent(dpy, root, 0, mask, ctypes.byref(ev))

    x11.XSync(dpy, 0)
    time.sleep(0.05)

    # 2. Ensure target position keeps full height inside screen workarea so GNOME Mutter never clamps 993px
    scr = x11.XDefaultScreen(dpy)
    scr_w = max(800, int(x11.XDisplayWidth(dpy, scr)))
    scr_h = max(600, int(x11.XDisplayHeight(dpy, scr)))
    geom = get_window_geometry_abs(x11, dpy, root, wid)
    cur_x = geom[0] if geom else max(40, (scr_w - int(width)) // 2)
    cur_y = geom[1] if geom else 36
    safe_x = max(8, min(cur_x, max(8, scr_w - int(width) - 8)))
    safe_y = max(32, min(cur_y, max(32, scr_h - int(height) - 12)))

    # 3. EWMH _NET_MOVERESIZE_WINDOW with NorthWestGravity (1) + X/Y/W/H + source=2
    mrev = XClientEventUnion()
    mrev.xclient.type = 33
    mrev.xclient.send_event = 1
    mrev.xclient.display = dpy
    mrev.xclient.window = wid
    mrev.xclient.message_type = atoms["net_moveresize_window"]
    mrev.xclient.format = 32
    mrev.xclient.data.l[0] = 1 | (1 << 8) | (1 << 9) | (1 << 10) | (1 << 11) | (2 << 12)
    mrev.xclient.data.l[1] = safe_x
    mrev.xclient.data.l[2] = safe_y
    mrev.xclient.data.l[3] = int(width)
    mrev.xclient.data.l[4] = int(height)
    x11.XSendEvent(dpy, root, 0, mask, ctypes.byref(mrev))

    # 4. Direct XMoveResizeWindow + XResizeWindow fallback for non-EWMH/plain WMs
    x11.XMoveResizeWindow(dpy, wid, safe_x, safe_y, int(width), int(height))
    x11.XResizeWindow(dpy, wid, int(width), int(height))
    x11.XFlush(dpy)


def unmaximize_and_resize(x11, dpy, root, wid, width, height, title, atoms):
    send_resize_commands(x11, dpy, root, wid, width, height, atoms)
    set_window_title(x11, dpy, wid, title, atoms)
    x11.XSync(dpy, 0)

    # Re-verify across Chrome's post-map placement restoration window (up to ~2s)
    for delay in (0.12, 0.25, 0.45, 0.70, 0.90):
        time.sleep(delay)
        all_ids = get_all_client_list_ids(x11, dpy, root, atoms["client_list"])
        if wid not in all_ids:
            return
        geom = get_window_size(x11, dpy, wid)
        if geom is None or abs(geom[0] - width) > 24 or abs(geom[1] - height) > 24:
            send_resize_commands(x11, dpy, root, wid, width, height, atoms)
        set_window_title(x11, dpy, wid, title, atoms)
        x11.XSync(dpy, 0)


def watch_window_title(x11, dpy, root, wid, title, atoms):
    """
    Event-driven watcher (0% idle CPU via select on X11 socket):
    keeps _NET_WM_NAME / WM_NAME locked to the Hub PWA name whenever the loaded page
    changes document.title, until the window is closed.
    """
    if not title:
        return

    PropertyChangeMask = 1 << 22
    StructureNotifyMask = 1 << 17
    DestroyNotify = 17

    x11.XSelectInput(dpy, wid, PropertyChangeMask | StructureNotifyMask)
    set_window_title(x11, dpy, wid, title, atoms)
    x11.XSync(dpy, 0)

    xfd = x11.XConnectionNumber(dpy)
    ev = XEvent()

    while True:
        ready, _, _ = select.select([xfd], [], [], 8.0)
        if not ready:
            all_ids = get_all_client_list_ids(x11, dpy, root, atoms["client_list"])
            if wid not in all_ids:
                break
            set_window_title(x11, dpy, wid, title, atoms)
            continue

        destroyed = False
        while x11.XPending(dpy) > 0:
            x11.XNextEvent(dpy, ctypes.byref(ev))
            if ev.type == DestroyNotify:
                destroyed = True
                break

        if destroyed:
            break

        all_ids = get_all_client_list_ids(x11, dpy, root, atoms["client_list"])
        if wid not in all_ids:
            break

        set_window_title(x11, dpy, wid, title, atoms)


def spawn_detached_shell(cmd):
    if not cmd:
        return
    subprocess.Popen(
        ["sh", "-c", cmd],
        start_new_session=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
    )


def build_atoms(x11, dpy):
    return {
        "client_list": x11.XInternAtom(dpy, b"_NET_CLIENT_LIST", 0),
        "wm_class": x11.XInternAtom(dpy, b"WM_CLASS", 0),
        "net_wm_name": x11.XInternAtom(dpy, b"_NET_WM_NAME", 0),
        "net_wm_icon_name": x11.XInternAtom(dpy, b"_NET_WM_ICON_NAME", 0),
        "wm_name": x11.XInternAtom(dpy, b"WM_NAME", 0),
        "wm_icon_name": x11.XInternAtom(dpy, b"WM_ICON_NAME", 0),
        "utf8_string": x11.XInternAtom(dpy, b"UTF8_STRING", 0),
        "net_wm_state": x11.XInternAtom(dpy, b"_NET_WM_STATE", 0),
        "max_vert": x11.XInternAtom(dpy, b"_NET_WM_STATE_MAXIMIZED_VERT", 0),
        "max_horz": x11.XInternAtom(dpy, b"_NET_WM_STATE_MAXIMIZED_HORZ", 0),
        "fullscreen": x11.XInternAtom(dpy, b"_NET_WM_STATE_FULLSCREEN", 0),
        "net_moveresize_window": x11.XInternAtom(dpy, b"_NET_MOVERESIZE_WINDOW", 0),
    }


def main():
    if len(sys.argv) < 2:
        sys.exit(0)

    mode = sys.argv[1]
    display_name = os.environ.get("DISPLAY") or ":0"

    # In --launch-and-watch mode, ALWAYS launch the command even if X11 Display is unavailable (e.g. pure Wayland)
    launch_cmd = ""
    if mode == "--launch-and-watch" and len(sys.argv) >= 6:
        launch_cmd = sys.argv[5]

    x11 = None
    dpy = None
    try:
        x11 = load_x11()
        dpy = x11.XOpenDisplay(display_name.encode("utf-8"))
    except Exception:
        dpy = None

    if not dpy:
        if launch_cmd:
            try:
                spawn_detached_shell(launch_cmd)
            except Exception:
                pass
        sys.exit(0)

    try:
        root = x11.XDefaultRootWindow(dpy)
        atoms = build_atoms(x11, dpy)

        if mode == "--snapshot":
            ids = get_chrome_window_ids(x11, dpy, root, atoms["client_list"], atoms["wm_class"])
            print(json.dumps(ids))
        elif mode == "--launch-and-watch" and len(sys.argv) >= 6:
            width = int(sys.argv[2])
            height = int(sys.argv[3])
            title = sys.argv[4]
            pre_ids = set(get_chrome_window_ids(x11, dpy, root, atoms["client_list"], atoms["wm_class"]))

            spawn_detached_shell(launch_cmd)

            is_wayland = bool(os.environ.get("WAYLAND_DISPLAY")) or os.environ.get("XDG_SESSION_TYPE", "").lower() == "wayland"
            watch_secs = 6.0 if (is_wayland and not pre_ids) else 14.0
            deadline = time.time() + watch_secs
            target_wid = None
            while time.time() < deadline:
                current_ids = get_chrome_window_ids(x11, dpy, root, atoms["client_list"], atoms["wm_class"])
                new_ids = [wid for wid in current_ids if wid not in pre_ids]
                if new_ids:
                    target_wid = new_ids[-1]
                    unmaximize_and_resize(x11, dpy, root, target_wid, width, height, title, atoms)
                    break
                time.sleep(0.06)

            if target_wid is not None and title:
                watch_window_title(x11, dpy, root, target_wid, title, atoms)
        elif mode == "--watch-new" and len(sys.argv) >= 4:
            width = int(sys.argv[2])
            height = int(sys.argv[3])
            pre_raw = sys.argv[4] if len(sys.argv) > 4 else ""
            title = sys.argv[5] if len(sys.argv) > 5 else ""
            pre_ids = set(int(x) for x in pre_raw.split(",") if x.strip().isdigit())

            deadline = time.time() + 14.0
            target_wid = None
            while time.time() < deadline:
                current_ids = get_chrome_window_ids(x11, dpy, root, atoms["client_list"], atoms["wm_class"])
                new_ids = [wid for wid in current_ids if wid not in pre_ids]
                if new_ids:
                    target_wid = new_ids[-1]
                    unmaximize_and_resize(x11, dpy, root, target_wid, width, height, title, atoms)
                    break
                time.sleep(0.06)

            if target_wid is not None and title:
                watch_window_title(x11, dpy, root, target_wid, title, atoms)
    except Exception:
        if launch_cmd:
            try:
                spawn_detached_shell(launch_cmd)
            except Exception:
                pass
    finally:
        try:
            if x11 and dpy:
                x11.XCloseDisplay(dpy)
        except Exception:
            pass


if __name__ == "__main__":
    main()
