#!/usr/bin/env python3
"""
Zero-dependency X11/XWayland window detector and resizer for Ubuntu Chrome PWA Hub.
Uses ctypes + libX11.so.6 (pre-installed on Ubuntu Desktop) so neither wmctrl nor xdotool is required.
"""

import ctypes
import ctypes.util
import json
import os
import sys
import time


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


class XEvent(ctypes.Union):
    _fields_ = [
        ("type", ctypes.c_int),
        ("xclient", XClientMessageEvent),
        ("pad", ctypes.c_long * 24),
    ]


def load_x11():
    lib_path = ctypes.util.find_library("X11") or "libX11.so.6"
    x11 = ctypes.cdll.LoadLibrary(lib_path)

    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = ctypes.c_void_p

    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.restype = ctypes.c_int

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

    x11.XFree.argtypes = [ctypes.c_void_p]
    x11.XFree.restype = ctypes.c_int

    x11.XSendEvent.argtypes = [
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_int,
        ctypes.c_long,
        ctypes.POINTER(XEvent),
    ]
    x11.XSendEvent.restype = ctypes.c_int

    x11.XResizeWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_uint, ctypes.c_uint]
    x11.XResizeWindow.restype = ctypes.c_int

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
        1024,
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


def get_chrome_window_ids(x11, dpy, root, client_list_atom, wm_class_atom):
    prop, fmt, count = get_window_property(x11, dpy, root, client_list_atom)
    if not prop or fmt != 32 or count == 0:
        if prop:
            x11.XFree(prop)
        return []

    wids = (ctypes.c_ulong * count).from_address(prop.value)
    all_wids = [int(wids[i]) for i in range(count)]
    x11.XFree(prop)

    chrome_wids = []
    for wid in all_wids:
        cprop, cfmt, ccount = get_window_property(x11, dpy, wid, wm_class_atom)
        if cprop and cfmt == 8 and ccount > 0:
            raw = ctypes.string_at(cprop.value, ccount)
            x11.XFree(cprop)
            lower = raw.decode("utf-8", errors="ignore").lower()
            if "chrome" in lower or "chromium" in lower:
                chrome_wids.append(wid)
        elif cprop:
            x11.XFree(cprop)
    return chrome_wids


def unmaximize_and_resize(x11, dpy, root, wid, width, height):
    net_wm_state = x11.XInternAtom(dpy, b"_NET_WM_STATE", 0)
    max_vert = x11.XInternAtom(dpy, b"_NET_WM_STATE_MAXIMIZED_VERT", 0)
    max_horz = x11.XInternAtom(dpy, b"_NET_WM_STATE_MAXIMIZED_HORZ", 0)

    ev = XEvent()
    ev.xclient.type = 33  # ClientMessage
    ev.xclient.send_event = 1
    ev.xclient.display = dpy
    ev.xclient.window = wid
    ev.xclient.message_type = net_wm_state
    ev.xclient.format = 32
    ev.xclient.data.l[0] = 0  # _NET_WM_STATE_REMOVE
    ev.xclient.data.l[1] = max_vert
    ev.xclient.data.l[2] = max_horz
    ev.xclient.data.l[3] = 2  # source indication: pager/tool
    ev.xclient.data.l[4] = 0

    # SubstructureRedirectMask (1 << 20) | SubstructureNotifyMask (1 << 19)
    mask = (1 << 20) | (1 << 19)
    x11.XSendEvent(dpy, root, 0, mask, ctypes.byref(ev))
    x11.XFlush(dpy)
    time.sleep(0.05)

    x11.XResizeWindow(dpy, wid, int(width), int(height))
    x11.XSync(dpy, 0)

    # Re-apply briefly after initial map/paint in case Chrome overrides first bounds
    time.sleep(0.18)
    x11.XSendEvent(dpy, root, 0, mask, ctypes.byref(ev))
    x11.XResizeWindow(dpy, wid, int(width), int(height))
    x11.XSync(dpy, 0)


def main():
    if len(sys.argv) < 2:
        sys.exit(0)

    display_name = os.environ.get("DISPLAY") or ":0"
    try:
        x11 = load_x11()
        dpy = x11.XOpenDisplay(display_name.encode("utf-8"))
        if not dpy:
            sys.exit(0)
    except Exception:
        sys.exit(0)

    try:
        root = x11.XDefaultRootWindow(dpy)
        client_list_atom = x11.XInternAtom(dpy, b"_NET_CLIENT_LIST", 0)
        wm_class_atom = x11.XInternAtom(dpy, b"WM_CLASS", 0)

        mode = sys.argv[1]
        if mode == "--snapshot":
            ids = get_chrome_window_ids(x11, dpy, root, client_list_atom, wm_class_atom)
            print(json.dumps(ids))
        elif mode == "--watch-new" and len(sys.argv) >= 4:
            width = int(sys.argv[2])
            height = int(sys.argv[3])
            pre_raw = sys.argv[4] if len(sys.argv) > 4 else ""
            pre_ids = set(int(x) for x in pre_raw.split(",") if x.strip().isdigit())

            deadline = time.time() + 6.0
            while time.time() < deadline:
                current_ids = get_chrome_window_ids(x11, dpy, root, client_list_atom, wm_class_atom)
                new_ids = [wid for wid in current_ids if wid not in pre_ids]
                if new_ids:
                    unmaximize_and_resize(x11, dpy, root, new_ids[-1], width, height)
                    break
                time.sleep(0.15)
    except Exception:
        pass
    finally:
        try:
            x11.XCloseDisplay(dpy)
        except Exception:
            pass


if __name__ == "__main__":
    main()
