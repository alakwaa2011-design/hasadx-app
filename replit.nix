{pkgs}: {
  deps = [
    pkgs.libgbm
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.alsa-lib
    pkgs.expat
    pkgs.cairo
    pkgs.pango
    pkgs.libxkbcommon
    pkgs.mesa
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.dbus
    pkgs.nss
    pkgs.nspr
    pkgs.glib
    pkgs.chromium
  ];
}
