"""Create and inspect our generated plugin ZIP using only Python's stdlib."""
import pathlib
import sys
import zipfile

mode, source_arg, destination_arg = sys.argv[1:]
source = pathlib.Path(source_arg).resolve()
destination = pathlib.Path(destination_arg).resolve()
if mode == "pack":
    with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_symlink():
                raise ValueError("Plugin archive must not contain symlinks")
            if not path.is_file():
                continue
            name = path.relative_to(source).as_posix()
            info = zipfile.ZipInfo(name, (2026, 10, 22, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
elif mode == "unpack":
    with zipfile.ZipFile(source) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive entries")
        for info in archive.infolist():
            path = pathlib.PurePosixPath(info.filename)
            if (path.is_absolute() or ".." in path.parts or "\\" in info.filename
                    or ":" in info.filename or (info.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError("Unsafe archive member")
            target = (destination / info.filename).resolve()
            target.relative_to(destination)
        archive.extractall(destination)
else:
    raise ValueError("Expected pack or unpack")
